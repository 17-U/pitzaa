import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class LogoutDto {
  @ApiProperty({
    required: false,
    description: 'Si omis, révoque toutes les sessions actives.',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
