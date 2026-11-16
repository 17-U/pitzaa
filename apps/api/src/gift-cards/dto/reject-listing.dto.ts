import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RejectListingDto {
  @ApiProperty({
    example: 'Solde déclaré non conforme au solde réel constaté.',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}
