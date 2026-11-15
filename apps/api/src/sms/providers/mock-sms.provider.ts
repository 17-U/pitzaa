import { Injectable, Logger } from '@nestjs/common';
import { SmsProvider } from '../sms-provider.interface';

/**
 * Fournisseur SMS simulé pour le développement et les tests.
 * TODO(QUESTIONS.md) : brancher un vrai fournisseur SMS (Twilio, Vonage, agrégateur
 * local...) derrière SmsProvider une fois le choix fait — voir QUESTIONS.md.
 */
@Injectable()
export class MockSmsProvider implements SmsProvider {
  private readonly logger = new Logger(MockSmsProvider.name);

  async send(to: string, message: string): Promise<void> {
    this.logger.log(`[SMS mock] -> ${to}: ${message}`);
  }
}
