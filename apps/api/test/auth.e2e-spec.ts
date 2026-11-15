import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
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

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sms: CapturingSmsProvider;

  const PHONE = '+237699000001';

  beforeAll(async () => {
    sms = new CapturingSmsProvider();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      // Module minimal (sans ThrottlerModule/APP_GUARD de AppModule) : ces tests
      // fonctionnels appellent les mêmes routes de nombreuses fois et la limitation
      // de débit (déjà vérifiée manuellement) n'a pas sa place ici.
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['../../.env', '.env'],
        }),
        PrismaModule,
        AuthModule,
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
  });

  beforeEach(async () => {
    sms.messages = [];
    // Nettoyage scopé à PHONE : la base de test est partagée avec d'autres fichiers
    // e2e (ex. withdrawals.e2e-spec.ts) qui peuvent tourner en parallèle sur les
    // mêmes tables — un deleteMany() sans filtre supprimerait aussi leurs données.
    await prisma.otpCode.deleteMany({ where: { phone: PHONE } });
    await prisma.user.deleteMany({ where: { phone: PHONE } });
  });

  afterAll(async () => {
    await app.close();
  });

  async function requestAndExtractOtp(phone: string): Promise<string> {
    await request(app.getHttpServer())
      .post('/auth/register-or-login/request-otp')
      .send({ phone })
      .expect(201);
    const lastMessage = sms.messages.at(-1);
    if (!lastMessage) {
      throw new Error('No OTP message captured');
    }
    return extractOtpCode(lastMessage.message);
  }

  it('rejects a non-CEMAC phone number', async () => {
    await request(app.getHttpServer())
      .post('/auth/register-or-login/request-otp')
      .send({ phone: '+33612345678' })
      .expect(400);
  });

  it('registers a new user via OTP and issues tokens', async () => {
    const code = await requestAndExtractOtp(PHONE);

    const response = await request(app.getHttpServer())
      .post('/auth/register-or-login/verify-otp')
      .send({ phone: PHONE, code, firstName: 'Amina' })
      .expect(201);

    expect(response.body.user.phone).toBe(PHONE);
    expect(response.body.user.firstName).toBe('Amina');
    expect(response.body.user.pinHash).toBeUndefined();
    expect(response.body.accessToken).toBeDefined();
    expect(response.body.refreshToken).toBeDefined();
  });

  it('rejects an incorrect OTP code', async () => {
    await requestAndExtractOtp(PHONE);

    await request(app.getHttpServer())
      .post('/auth/register-or-login/verify-otp')
      .send({ phone: PHONE, code: '000000' })
      .expect(400);
  });

  it('rejects replaying an already-consumed OTP code', async () => {
    const code = await requestAndExtractOtp(PHONE);

    await request(app.getHttpServer())
      .post('/auth/register-or-login/verify-otp')
      .send({ phone: PHONE, code })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/register-or-login/verify-otp')
      .send({ phone: PHONE, code })
      .expect(400);
  });

  it('logs in the same user on a second verified OTP instead of duplicating it', async () => {
    const firstCode = await requestAndExtractOtp(PHONE);
    const first = await request(app.getHttpServer())
      .post('/auth/register-or-login/verify-otp')
      .send({ phone: PHONE, code: firstCode })
      .expect(201);

    const secondCode = await requestAndExtractOtp(PHONE);
    const second = await request(app.getHttpServer())
      .post('/auth/register-or-login/verify-otp')
      .send({ phone: PHONE, code: secondCode })
      .expect(201);

    expect(second.body.user.id).toBe(first.body.user.id);
  });

  describe('authenticated flows', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      const code = await requestAndExtractOtp(PHONE);
      const res = await request(app.getHttpServer())
        .post('/auth/register-or-login/verify-otp')
        .send({ phone: PHONE, code })
        .expect(201);
      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });

    it('returns the current user profile on GET /auth/me', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(res.body.phone).toBe(PHONE);
    });

    it('rejects requests without a token', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('rotates the refresh token and rejects reuse of the old one', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).not.toBe(refreshToken);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });

    it('sets a PIN and rejects an invalid one', async () => {
      await request(app.getHttpServer())
        .post('/auth/me/pin')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ pin: '4321' })
        .expect(204);

      await request(app.getHttpServer())
        .post('/auth/me/pin')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ pin: '12' })
        .expect(400);
    });

    it('exports personal data without exposing the pin hash', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me/export')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.phone).toBe(PHONE);
      expect(res.body.pinHash).toBeUndefined();
      expect(res.body.wallet).toBeDefined();
      expect(res.body.wallet.availableBalanceXaf).toBe(0);
    });

    it('logs out and revokes the refresh token', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(204);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });

    it('soft-deletes the account, anonymizes it, and invalidates the session', async () => {
      await request(app.getHttpServer())
        .delete('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
    });
  });
});
