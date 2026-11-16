import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ReportNoAccessDto {
  @ApiProperty({
    example: "Je n'ai pas reçu d'invitation et je n'ai pas les identifiants.",
  })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;
}
