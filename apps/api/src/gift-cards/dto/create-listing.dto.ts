import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateListingDto {
  @ApiProperty()
  @IsString()
  brandId!: string;

  @ApiProperty({ example: 25000, description: 'Solde de la carte en XAF' })
  @IsInt()
  @Min(1)
  balanceXaf!: number;

  @ApiProperty({ example: 20000, description: 'Prix demandé en XAF' })
  @IsInt()
  @Min(1)
  askingPriceXaf!: number;

  @ApiProperty({ required: false, type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date;

  @ApiProperty({
    example: 'XXXX-XXXX-XXXX-XXXX',
    description:
      'Code de la carte, chiffré dès réception, jamais stocké en clair.',
  })
  @IsString()
  code!: string;
}
