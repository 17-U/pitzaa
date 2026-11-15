import { Inject, Injectable } from '@nestjs/common';
import { Locale } from '@prisma/client';
import { SMS_PROVIDER, SmsProvider } from './sms-provider.interface';

@Injectable()
export class SmsService {
  constructor(@Inject(SMS_PROVIDER) private readonly provider: SmsProvider) {}

  async sendOtp(phone: string, code: string, locale: Locale): Promise<void> {
    const message =
      locale === 'en'
        ? `Pitzaa: your verification code is ${code}. It expires in 5 minutes. Never share it.`
        : `Pitzaa : votre code de vérification est ${code}. Il expire dans 5 minutes. Ne le partagez jamais.`;
    await this.provider.send(phone, message);
  }
}
