import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { DisputesModule } from './disputes/disputes.module';
import { GiftCardsModule } from './gift-cards/gift-cards.module';
import { GroupsModule } from './groups/groups.module';
import { HealthModule } from './health/health.module';
import { LedgerModule } from './ledger/ledger.module';
import { MembershipPaymentsModule } from './membership-payments/membership-payments.module';
import { MessagingModule } from './messaging/messaging.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReviewsModule } from './reviews/reviews.module';
import { VaultModule } from './vault/vault.module';
import { WalletModule } from './wallet/wallet.module';
import { WithdrawalsModule } from './withdrawals/withdrawals.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Le .env canonique vit à la racine du monorepo (docker-compose s'en sert aussi) ;
      // un .env local à apps/api, s'il existe, reste prioritaire pour surcharger localement.
      envFilePath: ['../../.env', '.env'],
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 60 }]),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.getOrThrow<string>('REDIS_URL') },
      }),
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    LedgerModule,
    WalletModule,
    PaymentsModule,
    WithdrawalsModule,
    CatalogModule,
    GroupsModule,
    MembershipPaymentsModule,
    VaultModule,
    GiftCardsModule,
    MessagingModule,
    NotificationsModule,
    DisputesModule,
    ReviewsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
