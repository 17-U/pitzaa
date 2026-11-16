import { BullModule } from '@nestjs/bullmq';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { CatalogModule } from '../src/catalog/catalog.module';
import { GroupsModule } from '../src/groups/groups.module';
import { MembershipMaintenanceProcessor } from '../src/membership-payments/maintenance/membership-maintenance.processor';
import { MembershipPaymentsModule } from '../src/membership-payments/membership-payments.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SMS_PROVIDER, SmsProvider } from '../src/sms/sms-provider.interface';
import { VaultModule } from '../src/vault/vault.module';

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

describe('Groups & membership payments (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let maintenanceProcessor: MembershipMaintenanceProcessor;
  let sms: CapturingSmsProvider;
  let serviceId: string;

  const OWNER_PHONE = '+237699100001';
  const MEMBER_PHONE = '+237699100002';

  beforeAll(async () => {
    sms = new CapturingSmsProvider();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['../../.env', '.env'],
        }),
        // Préfixe Redis dédié : isole entièrement les files BullMQ de ce test de
        // celles du serveur de dev qui peut tourner en parallèle sur le même Redis.
        BullModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            connection: { url: config.getOrThrow<string>('REDIS_URL') },
            prefix: 'pitzaa-test',
          }),
        }),
        PrismaModule,
        AuthModule,
        CatalogModule,
        GroupsModule,
        MembershipPaymentsModule,
        VaultModule,
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
    maintenanceProcessor = app.get(MembershipMaintenanceProcessor);

    const service = await prisma.service.create({
      data: {
        name: `Streamix e2e ${Date.now()}`,
        category: 'Streaming',
        maxSlots: 4,
        recommendedPricePerSlotXaf: 2000,
        allowsSharing: true,
      },
    });
    serviceId = service.id;
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { phone: { startsWith: '+237699100' } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    if (userIds.length > 0) {
      await prisma.ledgerEntry.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.dispute.deleteMany({
        where: { raisedById: { in: userIds } },
      });
      await prisma.membershipPayment.deleteMany({
        where: { membership: { userId: { in: userIds } } },
      });
      await prisma.groupMembership.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.credentialVault.deleteMany({
        where: { group: { ownerId: { in: userIds } } },
      });
      await prisma.subscriptionGroup.deleteMany({
        where: { ownerId: { in: userIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.service.deleteMany({ where: { id: serviceId } });
    await prisma.otpCode.deleteMany({
      where: { phone: { startsWith: '+237699100' } },
    });
    await app.close();
  });

  async function requestAndExtractOtp(
    path: string,
    body: Record<string, unknown>,
    token?: string,
  ): Promise<string> {
    const req = request(app.getHttpServer()).post(path).send(body);
    if (token) req.set('Authorization', `Bearer ${token}`);
    await req.expect((res) => {
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

  /** Raccourci de test uniquement : aucun code applicatif ne modifie un solde hors du grand livre. */
  async function fundWallet(userId: string, amountXaf: number): Promise<void> {
    await prisma.wallet.update({
      where: { userId },
      data: { availableBalanceXaf: amountXaf },
    });
  }

  it('completes the full sharing flow: join, accept, pay, escrow, release', async () => {
    const owner = await registerUser(OWNER_PHONE);
    const member = await registerUser(MEMBER_PHONE);
    await setPin(member.accessToken);
    await fundWallet(member.userId, 100_000);

    const groupRes = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        serviceId,
        pricePerSlotXaf: 2000,
        totalSlots: 3,
        visibility: 'PUBLIC',
      })
      .expect(201);
    const groupId = groupRes.body.id;

    const joinRes = await request(app.getHttpServer())
      .post(`/groups/${groupId}/join`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .expect(201);
    expect(joinRes.body.status).toBe('PENDING');

    const acceptRes = await request(app.getHttpServer())
      .post(`/groups/memberships/${joinRes.body.id}/accept`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(201);
    expect(acceptRes.body.status).toBe('ACTIVE');
    const membershipId = acceptRes.body.id;

    const payRes = await request(app.getHttpServer())
      .post(`/memberships/${membershipId}/payments`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ pin: '1234', method: 'WALLET', monthsCount: 1 })
      .expect(201);
    expect(payRes.body.status).toBe('PAID');
    // 2000 XAF (part du propriétaire) + 250 + 5% de 2000 = 2350 XAF de commission.
    expect(payRes.body.amountXaf).toBe(2350);
    expect(payRes.body.commissionXaf).toBe(350);

    const memberWalletAfterPay = await prisma.wallet.findUniqueOrThrow({
      where: { userId: member.userId },
    });
    expect(memberWalletAfterPay.availableBalanceXaf).toBe(100_000 - 2350);

    const ownerWalletAfterPay = await prisma.wallet.findUniqueOrThrow({
      where: { userId: owner.userId },
    });
    expect(ownerWalletAfterPay.escrowBalanceXaf).toBe(2350);
    expect(ownerWalletAfterPay.availableBalanceXaf).toBe(0);

    const membershipAfterPay = await prisma.groupMembership.findUniqueOrThrow({
      where: { id: membershipId },
    });
    expect(membershipAfterPay.nextPaymentDueAt).not.toBeNull();
    expect(membershipAfterPay.nextPaymentDueAt!.getTime()).toBeGreaterThan(
      Date.now(),
    );

    // Force le délai de séquestre à expirer puis déclenche manuellement la tâche de libération.
    await prisma.membershipPayment.update({
      where: { id: payRes.body.id },
      data: { escrowReleaseAt: new Date(Date.now() - 1000) },
    });
    await maintenanceProcessor.process({
      name: 'release-membership-escrow',
    } as never);

    const ownerWalletAfterRelease = await prisma.wallet.findUniqueOrThrow({
      where: { userId: owner.userId },
    });
    expect(ownerWalletAfterRelease.escrowBalanceXaf).toBe(0);
    expect(ownerWalletAfterRelease.availableBalanceXaf).toBe(2000); // 2350 - 350 de commission

    const membershipPaymentAfterRelease =
      await prisma.membershipPayment.findUniqueOrThrow({
        where: { id: payRes.body.id },
      });
    expect(membershipPaymentAfterRelease.status).toBe('ESCROW_RELEASED');
  });

  it('rejects joining a group that is already full', async () => {
    const owner = await registerUser('+237699100003');
    const memberA = await registerUser('+237699100004');
    const memberB = await registerUser('+237699100005');

    const groupRes = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        serviceId,
        pricePerSlotXaf: 2000,
        totalSlots: 1,
        autoAcceptJoinRequests: true,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/groups/${groupRes.body.id}/join`)
      .set('Authorization', `Bearer ${memberA.accessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/groups/${groupRes.body.id}/join`)
      .set('Authorization', `Bearer ${memberB.accessToken}`)
      .expect(400);
  });

  it('freezes a paid period and opens a dispute when the member reports no access', async () => {
    const owner = await registerUser('+237699100006');
    const member = await registerUser('+237699100007');
    await setPin(member.accessToken);
    await fundWallet(member.userId, 100_000);

    const groupRes = await request(app.getHttpServer())
      .post('/groups')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        serviceId,
        pricePerSlotXaf: 1000,
        totalSlots: 2,
        autoAcceptJoinRequests: true,
      })
      .expect(201);

    const joinRes = await request(app.getHttpServer())
      .post(`/groups/${groupRes.body.id}/join`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .expect(201);
    const membershipId = joinRes.body.id;

    const payRes = await request(app.getHttpServer())
      .post(`/memberships/${membershipId}/payments`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ pin: '1234', method: 'WALLET', monthsCount: 1 })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/memberships/payments/${payRes.body.id}/no-access`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ reason: "Je n'ai pas reçu les identifiants du groupe." })
      .expect(201);

    const membershipPayment = await prisma.membershipPayment.findUniqueOrThrow({
      where: { id: payRes.body.id },
    });
    expect(membershipPayment.status).toBe('DISPUTED');

    const dispute = await prisma.dispute.findFirstOrThrow({
      where: { membershipPaymentId: payRes.body.id },
    });
    expect(dispute.raisedById).toBe(member.userId);
    expect(dispute.againstId).toBe(owner.userId);
    expect(dispute.status).toBe('OPEN');

    // Le séquestre d'un paiement contesté ne doit pas être libéré par la tâche planifiée.
    await prisma.membershipPayment.update({
      where: { id: payRes.body.id },
      data: { escrowReleaseAt: new Date(Date.now() - 1000) },
    });
    await maintenanceProcessor.process({
      name: 'release-membership-escrow',
    } as never);

    const stillDisputed = await prisma.membershipPayment.findUniqueOrThrow({
      where: { id: payRes.body.id },
    });
    expect(stillDisputed.status).toBe('DISPUTED');
  });
});
