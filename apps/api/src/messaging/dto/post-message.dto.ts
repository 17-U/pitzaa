import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class PostMessageDto {
  @ApiProperty({
    example: 'Bonjour, est-ce que tout est en ordre de votre côté ?',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;
}
