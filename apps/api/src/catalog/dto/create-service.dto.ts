import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateServiceDto {
  @ApiProperty({ example: 'Netflix' })
  @IsString()
  @MaxLength(80)
  name!: string;

  @ApiProperty({ example: 'Streaming vidéo' })
  @IsString()
  @MaxLength(80)
  category!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiProperty({
    example: 4,
    description: 'Nombre maximal de places partageables',
  })
  @IsInt()
  @Min(1)
  @Max(50)
  maxSlots!: number;

  @ApiProperty({
    required: false,
    description: 'Règles de partage (texte libre affiché aux utilisateurs)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  sharingRules?: string;

  @ApiProperty({
    example: 2000,
    description: 'Prix conseillé par place en XAF',
  })
  @IsInt()
  @Min(0)
  recommendedPricePerSlotXaf!: number;

  @ApiProperty({
    default: true,
    description:
      'Seules les offres avec allowsSharing=true sont listées publiquement',
  })
  @IsOptional()
  @IsBoolean()
  allowsSharing?: boolean;
}
