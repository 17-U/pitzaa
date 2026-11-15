import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import {
  IsCemacPhone,
  IsOtpCode,
} from '../../common/validators/shared-schema.validator';

export class VerifyOtpDto {
  @ApiProperty({ example: '+237612345678' })
  @IsCemacPhone()
  phone!: string;

  @ApiProperty({ example: '123456' })
  @IsOtpCode()
  code!: string;

  @ApiProperty({ required: false, example: 'Amina' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @ApiProperty({ required: false, example: 'Njoya' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;
}
