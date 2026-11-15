import { ApiProperty } from '@nestjs/swagger';
import { IsCemacPhone } from '../../common/validators/shared-schema.validator';

export class RequestOtpDto {
  @ApiProperty({ example: '+237612345678' })
  @IsCemacPhone()
  phone!: string;
}
