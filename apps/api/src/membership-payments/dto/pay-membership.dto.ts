import { ApiProperty } from '@nestjs/swagger';
import { MobileMoneyOperator } from '@prisma/client';
import { IsIn, IsOptional } from 'class-validator';
import {
  IsCemacPhone,
  IsPitzaaPin,
} from '../../common/validators/shared-schema.validator';

const METHODS = ['WALLET', 'MOBILE_MONEY'] as const;
export type PaymentMethod = (typeof METHODS)[number];

const OPERATORS: MobileMoneyOperator[] = ['MTN_MOMO', 'ORANGE_MONEY'];
const MONTHS_OPTIONS = [1, 3, 6] as const;

export class PayMembershipDto {
  @ApiProperty({
    example: 1234,
    description: 'PIN Pitzaa requis pour valider tout paiement.',
  })
  @IsPitzaaPin()
  pin!: string;

  @ApiProperty({ enum: METHODS, default: 'WALLET' })
  @IsIn(METHODS)
  method!: PaymentMethod;

  @ApiProperty({
    enum: MONTHS_OPTIONS,
    default: 1,
    description: 'Paiement de 1, 3 ou 6 mois d’avance.',
  })
  @IsIn(MONTHS_OPTIONS)
  monthsCount!: number;

  @ApiProperty({
    required: false,
    enum: OPERATORS,
    description: 'Requis si method = MOBILE_MONEY',
  })
  @IsOptional()
  @IsIn(OPERATORS)
  operator?: MobileMoneyOperator;

  @ApiProperty({
    required: false,
    example: '+237612345678',
    description: 'Requis si method = MOBILE_MONEY',
  })
  @IsOptional()
  @IsCemacPhone()
  msisdn?: string;
}
