import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  RawBodyRequest,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Prisma, PaymentProviderName } from '@prisma/client';
import { Queue } from 'bullmq';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { PAYMENT_CONFIRMATION_QUEUE } from '../payments.constants';
import { InvalidWebhookSignatureError } from '../providers/payment-provider.interface';
import { PaymentProviderRegistry } from '../providers/payment-provider.registry';

const PROVIDER_NAMES = new Set<string>(['FAPSHI', 'KPAY', 'MOCK']);

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

/**
 * Un endpoint par fournisseur, jamais exposé à Swagger (URL sensible, pas d'auth
 * utilisateur — la confiance vient de la vérification de signature du provider).
 */
@ApiExcludeController()
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly registry: PaymentProviderRegistry,
    private readonly prisma: PrismaService,
    @InjectQueue(PAYMENT_CONFIRMATION_QUEUE) private readonly queue: Queue,
  ) {}

  @Post(':provider')
  @HttpCode(HttpStatus.OK)
  async handle(
    @Param('provider') providerParam: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    const providerName = providerParam.toUpperCase();
    if (!PROVIDER_NAMES.has(providerName)) {
      throw new NotFoundException();
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Corps de requête brut manquant.');
    }

    const provider = this.registry.get(providerName as PaymentProviderName);

    let event;
    try {
      event = provider.parseWebhook(
        rawBody,
        req.headers as Record<string, string>,
      );
    } catch (error) {
      if (error instanceof InvalidWebhookSignatureError) {
        throw new UnauthorizedException(error.message);
      }
      throw error;
    }

    let webhookEvent;
    try {
      webhookEvent = await this.prisma.webhookEvent.create({
        data: {
          provider: providerName as PaymentProviderName,
          providerEventId: event.providerEventId,
          payload: JSON.parse(rawBody.toString('utf8')),
        },
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        // Événement déjà reçu et traité : on répond 200 sans rien refaire.
        return { status: 'duplicate' };
      }
      throw error;
    }

    const payment = await this.prisma.payment.findFirst({
      where: {
        provider: providerName as PaymentProviderName,
        providerReference: event.providerReference,
      },
    });

    if (payment) {
      await this.queue.add('confirm', { paymentId: payment.id });
    }

    await this.prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: { processedAt: new Date() },
    });

    return { status: 'accepted' };
  }
}
