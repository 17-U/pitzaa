import { BullModule } from '@nestjs/bullmq';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { GiftCardMaintenanceProcessor } from '../src/gift-cards/maintenance/gift-card-maintenance.processor';
import { GiftCardsModule } from '../src/gift-cards/gift-cards.module';
import { PaymentsService } from '../src/payments/payments.service';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SMS_PROVIDER, SmsProvider } from '../src/sms/sms-provider.interface';

class CapturingSmsProvider implements SmsProvider {
  messages: { to: string; message: string }[] = [];

  async send(to: string, message: string): Promise<void> {
    this.messages.push({ to, message });
  }
}

function extractOtpCode(message: string): string {
  const match = /(\d{6})/.exec(message);
  if (!match) {
    throw new Error(`No OTP code found in message: ${message}`);
  }
  return match[1];
}

describe('Gift cards (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let maintenanceProcessor: GiftCardMaintenanceProcessor;
  let sms: CapturingSmsProvider;
  let brandId: string;

  const SELLER_PHONE = '+237699200001';
  const BUYER_PHONE = '+237699200002';

  beforeAll(async () => {
    sms = new CapturingSmsProvider();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['../../.env', '.env'],
        }),
        BullModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            connection: { url: config.getOrThrow<string>('REDIS_URL') },
            prefix: 'pitzaa-test',
          }),
        }),
        PrismaModule,
        AuthModule,
        GiftCardsModule,
      ],
    })
      .overrideProvider(SMS_PROVIDER)
      .useValue(sms)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    maintenanceProcessor = app.get(GiftCardMaintenanceProcessor);

    const brand = await prisma.giftCardBrand.create({
      data: {
        name: `Amazon e2e ${Date.now()}`,
        country: 'US',
        resaleAllowed: true,
      },
    });
    brandId = brand.id;
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { phone: { startsWith: '+237699200' } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    if (userIds.length > 0) {
      // Payment référence giftCardOrderId sans cascade : à supprimer avant les
      // commandes, qui doivent elles-mêmes être supprimées avant les annonces/utilisateurs.
      await prisma.ledgerEntry.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.giftCardCodeAccessLog.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
      await prisma.payment.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.giftCardOrder.deleteMany({
        where: {
          OR: [
            { listing: { sellerId: { in: userIds } } },
            { buyerId: { in: userIds } },
          ],
        },
      });
      await prisma.giftCardListing.deleteMany({
        where: { sellerId: { in: userIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.giftCardBrand.deleteMany({ where: { id: brandId } });
    await prisma.otpCode.deleteMany({
      where: { phone: { startsWith: '+237699200' } },
    });
    await app.close();
  });

  async function requestAndExtractOtp(
    path: string,
    body: Record<string, unknown>,
  ): Promise<string> {
    await request(app.getHttpServer())
      .post(path)
      .send(body)
      .expect((res) => {
        if (res.status >= 400)
          throw new Error(
            `Unexpected status ${res.status}: ${JSON.stringify(res.body)}`,
          );
      });
    const lastMessage = sms.messages.at(-1);
    if (!lastMessage) {
      throw new Error('No OTP message captured');
    }
    return extractOtpCode(lastMessage.message);
  }

  async function registerUser(
    phone: string,
  ): Promise<{ userId: string; accessToken: string }> {
    const code = await requestAndExtractOtp(
      '/auth/register-or-login/request-otp',
      { phone },
    );
    const res = await request(app.getHttpServer())
      .post('/auth/register-or-login/verify-otp')
      .send({ phone, code })
      .expect(201);
    return { userId: res.body.user.id, accessToken: res.body.accessToken };
  }

  async function setPin(accessToken: string, pin = '1234'): Promise<void> {
    await request(app.getHttpServer())
      .post('/auth/me/pin')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ pin })
      .expect(204);
  }

  async function promoteToAdmin(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { role: 'SUPER_ADMIN' },
    });
  }

  async function fundWallet(userId: string, amountXaf: number): Promise<void> {
    await prisma.wallet.update({
      where: { userId },
      data: { availableBalanceXaf: amountXaf },
    });
  }

  it('completes the full flow: list, verify, buy, reveal once, release escrow', async () => {
    const seller = await registerUser(SELLER_PHONE);
    const admin = await registerUser('+237699200009');
    await promoteToAdmin(admin.userId);
    const buyer = await registerUser(BUYER_PHONE);
    await setPin(buyer.accessToken);
    await fundWallet(buyer.userId, 100_000);

    const createRes = await request(app.getHttpServer())
      .post('/gift-cards/listings')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({
        brandId,
        balanceXaf: 25_000,
        askingPriceXaf: 20_000,
        code: 'ABCD-EFGH-IJKL',
      })
      .expect(201);
    expect(createRes.body.status).toBe('PENDING_VERIFICATION');
    const listingId = createRes.body.id;

    // L'annonce n'est pas encore visible publiquement avant vérification.
    const publicBefore = await request(app.getHttpServer())
      .get('/gift-cards/listings')
      .expect(200);
    expect(
      publicBefore.body.find((l: { id: string }) => l.id === listingId),
    ).toBeUndefined();

    const revealForAdmin = await request(app.getHttpServer())
      .get(`/gift-cards/listings/${listingId}/admin/code`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    expect(revealForAdmin.body.code).toBe('ABCD-EFGH-IJKL');

    const verifyRes = await request(app.getHttpServer())
      .post(`/gift-cards/listings/${listingId}/verify`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(201);
    expect(verifyRes.body.status).toBe('LISTED');

    const publicAfter = await request(app.getHttpServer())
      .get('/gift-cards/listings')
      .expect(200);
    expect(
      publicAfter.body.some((l: { id: string }) => l.id === listingId),
    ).toBe(true);

    const buyRes = await request(app.getHttpServer())
      .post(`/gift-cards/listings/${listingId}/buy`)
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({ pin: '1234', method: 'WALLET' })
      .expect(201);
    expect(buyRes.body.status).toBe('PAID');
    // 8% de commission sur 20 000 XAF = 1 600 XAF.
    expect(buyRes.body.commissionXaf).toBe(1_600);
    const orderId = buyRes.body.id;

    const buyerWalletAfterBuy = await prisma.wallet.findUniqueOrThrow({
      where: { userId: buyer.userId },
    });
    expect(buyerWalletAfterBuy.availableBalanceXaf).toBe(100_000 - 20_000);
    const sellerWalletAfterBuy = await prisma.wallet.findUniqueOrThrow({
      where: { userId: seller.userId },
    });
    expect(sellerWalletAfterBuy.escrowBalanceXaf).toBe(20_000);

    const revealRes = await request(app.getHttpServer())
      .post(`/gift-cards/orders/${orderId}/reveal-code`)
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .expect(201);
    expect(revealRes.body.code).toBe('ABCD-EFGH-IJKL');

    // Le code ne peut être révélé qu'une seule fois.
    await request(app.getHttpServer())
      .post(`/gift-cards/orders/${orderId}/reveal-code`)
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .expect(403);

    await prisma.giftCardOrder.update({
      where: { id: orderId },
      data: { escrowReleaseAt: new Date(Date.now() - 1000) },
    });
    await maintenanceProcessor.process({
      name: 'release-gift-card-escrow',
    } as never);

    const sellerWalletAfterRelease = await prisma.wallet.findUniqueOrThrow({
      where: { userId: seller.userId },
    });
    expect(sellerWalletAfterRelease.escrowBalanceXaf).toBe(0);
    expect(sellerWalletAfterRelease.availableBalanceXaf).toBe(20_000 - 1_600);

    const sellerAfterRelease = await prisma.user.findUniqueOrThrow({
      where: { id: seller.userId },
    });
    expect(sellerAfterRelease.lifetimeSalesXaf).toBe(20_000);
    expect(sellerAfterRelease.giftCardSalesCurrentMonthXaf).toBe(20_000);

    const orderAfterRelease = await prisma.giftCardOrder.findUniqueOrThrow({
      where: { id: orderId },
    });
    expect(orderAfterRelease.status).toBe('ESCROW_RELEASED');
  });

  it('reopens the listing for sale when a mobile money collection ultimately fails', async () => {
    const seller = await registerUser('+237699200003');
    const buyer = await registerUser('+237699200004');
    await setPin(buyer.accessToken);

    const listingRes = await request(app.getHttpServer())
      .post('/gift-cards/listings')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({
        brandId,
        balanceXaf: 5_000,
        askingPriceXaf: 4_000,
        code: 'FAIL-CODE',
      })
      .expect(201);

    await prisma.giftCardListing.update({
      where: { id: listingRes.body.id },
      data: { status: 'LISTED' },
    });

    await request(app.getHttpServer())
      .post(`/gift-cards/listings/${listingRes.body.id}/buy`)
      .set('Authorization', `Bearer ${buyer.accessToken}`)
      .send({
        pin: '1234',
        method: 'MOBILE_MONEY',
        operator: 'MTN_MOMO',
        msisdn: '+237690000000',
      })
      .expect(201);

    const soldListing = await prisma.giftCardListing.findUniqueOrThrow({
      where: { id: listingRes.body.id },
    });
    expect(soldListing.status).toBe('SOLD');

    const order = await prisma.giftCardOrder.findFirstOrThrow({
      where: { listingId: listingRes.body.id },
    });
    const payment = await prisma.payment.findFirstOrThrow({
      where: { giftCardOrderId: order.id },
    });

    // +237690000000 est le numéro de test MockProvider qui échoue toujours.
    const paymentsService = app.get(PaymentsService);
    await paymentsService.confirmPendingPayment(payment.id);

    const listingAfterFailure = await prisma.giftCardListing.findUniqueOrThrow({
      where: { id: listingRes.body.id },
    });
    expect(listingAfterFailure.status).toBe('LISTED');

    const orderAfterFailure = await prisma.giftCardOrder.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(orderAfterFailure.status).toBe('PAYMENT_FAILED');
  });

  it('rejects a new listing once the monthly cap would be exceeded without KYC', async () => {
    const seller = await registerUser('+237699200005');
    await prisma.user.update({
      where: { id: seller.userId },
      data: {
        giftCardSalesCurrentMonthXaf: 290_000,
        giftCardSalesMonthStartAt: new Date(),
      },
    });

    await request(app.getHttpServer())
      .post('/gift-cards/listings')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({
        brandId,
        balanceXaf: 20_000,
        askingPriceXaf: 15_000,
        code: 'OVER-CAP',
      })
      .expect(400);
  });
});
