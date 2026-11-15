import { ApiProperty } from '@nestjs/swagger';
import { MobileMoneyOperator } from '@prisma/client';
import { IsIn, IsInt, Min } from 'class-validator';
import {
  IsCemacPhone,
  IsOtpCode,
} from '../../common/validators/shared-schema.validator';

const OPERATORS: MobileMoneyOperator[] = ['MTN_MOMO', 'ORANGE_MONEY'];

export class CreateWithdrawalDto {
  @ApiProperty({
    example: 5000,
    description: 'Montant en XAF (minimum 500 XAF).',
  })
  @IsInt()
  @Min(1)
  amountXaf!: number;

  @ApiProperty({ enum: OPERATORS })
  @IsIn(OPERATORS)
  operator!: MobileMoneyOperator;

  @ApiProperty({ example: '+237612345678' })
  @IsCemacPhone()
  destinationMsisdn!: string;

  @ApiProperty({
    example: '123456',
    description: '2FA obligatoire : code OTP demandé via POST /withdrawals/otp',
  })
  @IsOtpCode()
  otpCode!: string;
}
