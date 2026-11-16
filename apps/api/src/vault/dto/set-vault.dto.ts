import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class SetVaultDto {
  @ApiProperty({
    example: 'identifiant: partage@pitzaa.app / mot de passe: ChangeMoi123',
    description: 'Texte libre (identifiants du service) à chiffrer et stocker.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  payload!: string;
}
