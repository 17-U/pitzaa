import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { OtpModule } from '../otp/otp.module';
import { PaymentsModule } from '../payments/payments.module';
import { WithdrawalsController } from './withdrawals.controller';
import { WithdrawalsService } from './withdrawals.service';

@Module({
  imports: [LedgerModule, OtpModule, PaymentsModule],
  controllers: [WithdrawalsController],
  providers: [WithdrawalsService],
  exports: [WithdrawalsService],
})
export class WithdrawalsModule {}
