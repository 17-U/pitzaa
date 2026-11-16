import { ApiProperty } from '@nestjs/swagger';
import { IsPitzaaPin } from '../../common/validators/shared-schema.validator';

export class RevealVaultDto {
  @ApiProperty({
    example: '1234',
    description: 'PIN Pitzaa requis pour révéler les identifiants.',
  })
  @IsPitzaaPin()
  pin!: string;
}
