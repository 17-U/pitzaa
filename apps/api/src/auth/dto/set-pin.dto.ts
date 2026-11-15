import { ApiProperty } from '@nestjs/swagger';
import { IsPitzaaPin } from '../../common/validators/shared-schema.validator';

export class SetPinDto {
  @ApiProperty({
    example: '1234',
    description: 'PIN Pitzaa (4 à 6 chiffres), jamais le PIN mobile money.',
  })
  @IsPitzaaPin()
  pin!: string;
}
