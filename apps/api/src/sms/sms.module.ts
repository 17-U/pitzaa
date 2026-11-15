import { Module } from '@nestjs/common';
import { MockSmsProvider } from './providers/mock-sms.provider';
import { SMS_PROVIDER } from './sms-provider.interface';
import { SmsService } from './sms.service';

@Module({
  providers: [
    MockSmsProvider,
    { provide: SMS_PROVIDER, useExisting: MockSmsProvider },
    SmsService,
  ],
  exports: [SmsService],
})
export class SmsModule {}
