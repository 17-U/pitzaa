import { Injectable, Logger } from '@nestjs/common';
import {
  GiftCardVerificationParams,
  GiftCardVerificationResult,
  GiftCardVerifier,
} from './gift-card-verifier.interface';

/**
 * Aucune vérification automatisée au MVP : chaque mise en vente attend une
 * validation manuelle par un admin (voir QUESTIONS.md pour une future API par marque).
 */
@Injectable()
export class ManualGiftCardVerifier implements GiftCardVerifier {
  private readonly logger = new Logger(ManualGiftCardVerifier.name);

  async verify(
    params: GiftCardVerificationParams,
  ): Promise<GiftCardVerificationResult> {
    this.logger.log(
      `Vérification manuelle requise pour une carte ${params.brandName} (${params.country})`,
    );
    return {
      verified: false,
      notes: 'Vérification manuelle requise par un admin.',
    };
  }
}
