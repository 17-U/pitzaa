import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Locale, OtpPurpose } from '@prisma/client';
import {
  generateNumericCode,
  hashSecret,
  verifySecret,
} from '../common/crypto.util';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';

const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 60_000;

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
  ) {}

  async request(
    phone: string,
    purpose: OtpPurpose,
    locale: Locale = 'fr',
  ): Promise<{ expiresAt: Date }> {
    const recent = await this.prisma.otpCode.findFirst({
      where: { phone, purpose },
      orderBy: { createdAt: 'desc' },
    });
    if (
      recent &&
      Date.now() - recent.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS
    ) {
      throw new BadRequestException(
        'Veuillez attendre avant de demander un nouveau code.',
      );
    }

    const code = generateNumericCode(OTP_LENGTH);
    const codeHash = await hashSecret(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await this.prisma.otpCode.create({
      data: {
        phone,
        purpose,
        codeHash,
        expiresAt,
        maxAttempts: OTP_MAX_ATTEMPTS,
      },
    });

    await this.sms.sendOtp(phone, code, locale);
    this.logger.log(`OTP requested for ${phone} (${purpose})`);

    return { expiresAt };
  }

  /** Vérifie et consomme le code le plus récent non expiré pour ce numéro/objet. */
  async verify(
    phone: string,
    purpose: OtpPurpose,
    code: string,
  ): Promise<void> {
    const otp = await this.prisma.otpCode.findFirst({
      where: { phone, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp || otp.expiresAt < new Date()) {
      throw new BadRequestException('Code invalide ou expiré.');
    }
    if (otp.attempts >= otp.maxAttempts) {
      throw new BadRequestException(
        'Nombre maximal de tentatives atteint, demandez un nouveau code.',
      );
    }

    const isValid = await verifySecret(otp.codeHash, code);
    if (!isValid) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Code invalide ou expiré.');
    }

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });
  }
}
