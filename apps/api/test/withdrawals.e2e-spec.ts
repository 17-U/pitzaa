import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { PAYMENT_CONFIRMATION_QUEUE } from '../src/payments/payments.constants';
import { PaymentsService } from '../src/payments/payments.service';
import { SMS_PROVIDER, SmsProvider } from '../src/sms/sms-provider.interface';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { WithdrawalsModule } from '../src/withdrawals/withdrawals.module';

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

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Withdrawals (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let paymentsService: PaymentsService;
  let sms: CapturingSmsProvider;

  const PHONE = '+237699000002';

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
        WithdrawalsModule,
      ],
    })
      .overrideProvider(SMS_PROVIDER)
      .useValue(sms)
      .compile();

    // rawBody: true est nécessaire pour la vérification de signature des webhooks
    // (calculée sur le corps brut), comme en production (voir src/main.ts).
    app = moduleFixture.createNestApplication({ rawBody: true });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    paymentsService = app.get(PaymentsService);

    // Repart d'une file vide : des jobs orphelins d'une exécution précédente (process
    // interrompu, etc.) pourraient sinon retarder le worker pendant ce test.
    const queue = app.get<import('bullmq').Queue>(
      getQueueToken(PAYMENT_CONFIRMATION_QUEUE),
    );
    await queue.obliterate({ force: true });
  });

  afterAll(async () => {
    // Nettoyage scopé au préfixe de numéros utilisé par ce fichier : la base de
    // test est partagée avec d'autres fichiers e2e qui peuvent tourner en parallèle.
    // Payment/Withdrawal/LedgerEntry n'ont pas de cascade sur User : à supprimer
    // d'abord, dans cet ordre, avant de pouvoir supprimer les utilisateurs.
    const users = await prisma.user.findMany({
      where: { phone: { startsWith: '+237699000' } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    if (userIds.length > 0) {
      await prisma.ledgerEntry.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.payment.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.withdrawal.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    // Les OtpCode ne sont pas liés par clé étrangère à User (ils précèdent la
    // création du compte) : à nettoyer séparément pour que des relances rapides
    // de la suite ne se heurtent pas au délai anti-spam de l'OTP (60s).
    await prisma.otpCode.deleteMany({
      where: { phone: { startsWith: '+237699000' } },
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

  /** Raccourci de test uniquement : aucun code applicatif ne modifie un solde hors du grand livre. */
  async function fundWallet(userId: string, amountXaf: number): Promise<void> {
    await prisma.wallet.update({
      where: { userId },
      data: { availableBalanceXaf: amountXaf },
    });
  }

  it('rejects a withdrawal below the minimum amount', async () => {
    const { accessToken } = await registerUser(PHONE);
    const otpCode = await requestAndExtractOtp(
      '/withdrawals/otp',
      {},
      accessToken,
    );

    await request(app.getHttpServer())
      .post('/withdrawals')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        amountXaf: 100,
        operator: 'MTN_MOMO',
        destinationMsisdn: PHONE,
        otpCode,
      })
      .expect(400);
  });

  it('rejects a withdrawal when the OTP is missing or wrong', async () => {
    const { userId, accessToken } = await registerUser('+237699000003');
    await fundWallet(userId, 10_000);

    await request(app.getHttpServer())
      .post('/withdrawals')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        amountXaf: 1000,
        operator: 'MTN_MOMO',
        destinationMsisdn: '+237699000003',
        otpCode: '000000',
      })
      .expect(400);
  });

  it('rejects a withdrawal when the available balance is insufficient', async () => {
    const { userId, accessToken } = await registerUser('+237699000004');
    await fundWallet(userId, 500);
    const otpCode = await requestAndExtractOtp(
      '/withdrawals/otp',
      {},
      accessToken,
    );

    await request(app.getHttpServer())
      .post('/withdrawals')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        amountXaf: 5000,
        operator: 'MTN_MOMO',
        destinationMsisdn: '+237699000004',
        otpCode,
      })
      .expect(400);
  });

  it('completes a withdrawal end-to-end: reserve, confirm, settle', async () => {
    const phone = '+237699000005';
    const { userId, accessToken } = await registerUser(phone);
    await fundWallet(userId, 10_000);
    const otpCode = await requestAndExtractOtp(
      '/withdrawals/otp',
      {},
      accessToken,
    );

    const createRes = await request(app.getHttpServer())
      .post('/withdrawals')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        amountXaf: 1000,
        operator: 'MTN_MOMO',
        destinationMsisdn: phone,
        otpCode,
      })
      .expect(201);

    expect(createRes.body.status).toBe('PENDING');

    const walletAfterReservation = await prisma.wallet.findUniqueOrThrow({
      where: { userId },
    });
    // 1000 XAF retiré + 100 XAF de frais (sous le seuil de 5000 XAF) réservés immédiatement.
    expect(walletAfterReservation.availableBalanceXaf).toBe(10_000 - 1100);

    const payment = await prisma.payment.findFirstOrThrow({
      where: { withdrawalId: createRes.body.id },
    });
    // Laisse passer le court délai simulé par MockPaymentProvider avant qu'il ne
    // rapporte un statut définitif (voir RESOLUTION_DELAY_MS dans mock-payment.provider.ts).
    await wait(100);
    await paymentsService.confirmPendingPayment(payment.id);

    const withdrawal = await prisma.withdrawal.findUniqueOrThrow({
      where: { id: createRes.body.id },
    });
    expect(withdrawal.status).toBe('SUCCEEDED');

    const listRes = await request(app.getHttpServer())
      .get('/withdrawals')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(listRes.body[0].status).toBe('SUCCEEDED');
  });

  it('refunds the reserved balance when the provider confirms a failed payout', async () => {
    // Le numéro mobile money de test se terminant par 0000 force un échec dans MockPaymentProvider.
    const phone = '+237699990000';
    const { userId, accessToken } = await registerUser('+237699000006');
    await fundWallet(userId, 10_000);
    const otpCode = await requestAndExtractOtp(
      '/withdrawals/otp',
      {},
      accessToken,
    );

    const createRes = await request(app.getHttpServer())
      .post('/withdrawals')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        amountXaf: 1000,
        operator: 'MTN_MOMO',
        destinationMsisdn: phone,
        otpCode,
      })
      .expect(201);

    const payment = await prisma.payment.findFirstOrThrow({
      where: { withdrawalId: createRes.body.id },
    });
    await paymentsService.confirmPendingPayment(payment.id);

    const withdrawal = await prisma.withdrawal.findUniqueOrThrow({
      where: { id: createRes.body.id },
    });
    expect(withdrawal.status).toBe('FAILED');

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
    expect(wallet.availableBalanceXaf).toBe(10_000);
  });

  it('confirms a payment asynchronously through the real webhook → BullMQ queue → worker pipeline', async () => {
    const phone = '+237699000007';
    const { userId, accessToken } = await registerUser(phone);
    await fundWallet(userId, 10_000);
    const otpCode = await requestAndExtractOtp(
      '/withdrawals/otp',
      {},
      accessToken,
    );

    const createRes = await request(app.getHttpServer())
      .post('/withdrawals')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        amountXaf: 1000,
        operator: 'MTN_MOMO',
        destinationMsisdn: phone,
        otpCode,
      })
      .expect(201);

    const payment = await prisma.payment.findFirstOrThrow({
      where: { withdrawalId: createRes.body.id },
    });

    await request(app.getHttpServer())
      .post('/webhooks/mock')
      .set('x-mock-signature', 'mock_webhook_secret')
      .send({
        eventId: `evt_${payment.id}`,
        providerReference: payment.providerReference,
        status: 'SUCCEEDED',
      })
      .expect(200);

    let withdrawal = await prisma.withdrawal.findUniqueOrThrow({
      where: { id: createRes.body.id },
    });
    for (
      let attempt = 0;
      attempt < 20 && withdrawal.status === 'PENDING';
      attempt++
    ) {
      await wait(200);
      withdrawal = await prisma.withdrawal.findUniqueOrThrow({
        where: { id: createRes.body.id },
      });
    }

    expect(withdrawal.status).toBe('SUCCEEDED');

    // Un deuxième envoi du même événement ne doit rien retraiter (idempotence).
    await request(app.getHttpServer())
      .post('/webhooks/mock')
      .set('x-mock-signature', 'mock_webhook_secret')
      .send({
        eventId: `evt_${payment.id}`,
        providerReference: payment.providerReference,
        status: 'SUCCEEDED',
      })
      .expect(200);
  });

  it('rejects a webhook with an invalid signature', async () => {
    await request(app.getHttpServer())
      .post('/webhooks/mock')
      .set('x-mock-signature', 'wrong-secret')
      .send({
        eventId: 'evt_x',
        providerReference: 'mock_x',
        status: 'SUCCEEDED',
      })
      .expect(401);
  });
});
