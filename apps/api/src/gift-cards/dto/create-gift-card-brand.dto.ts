import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class CreateGiftCardBrandDto {
  @ApiProperty({ example: 'Amazon' })
  @IsString()
  @MaxLength(80)
  name!: string;

  @ApiProperty({
    example: 'US',
    description: "Code pays ISO 3166-1 alpha-2 du pays d'émission.",
  })
  @IsString()
  @Length(2, 2)
  country!: string;

  @ApiProperty({ default: true })
  @IsOptional()
  @IsBoolean()
  resaleAllowed?: boolean;
}
