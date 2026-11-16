import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RespondDisputeDto {
  @ApiProperty({
    example: "L'invitation a bien été envoyée le 12 mars, voir capture jointe.",
  })
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  message!: string;
}
