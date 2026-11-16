import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateDisputeDto {
  @ApiProperty({
    example: "Je n'ai pas reçu d'invitation et je n'ai pas les identifiants.",
  })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;

  @ApiProperty({
    required: false,
    type: [String],
    description: 'URLs de preuves (captures d’écran, etc.)',
  })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  evidenceUrls?: string[];
}
