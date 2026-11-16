import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({
    required: false,
    description: 'Requis si l’avis porte sur un abonnement partagé.',
  })
  @IsOptional()
  @IsString()
  membershipPaymentId?: string;

  @ApiProperty({
    required: false,
    description: 'Requis si l’avis porte sur une carte cadeau.',
  })
  @IsOptional()
  @IsString()
  giftCardOrderId?: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
