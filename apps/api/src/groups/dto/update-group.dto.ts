import { ApiProperty } from '@nestjs/swagger';
import { GroupVisibility } from '@prisma/client';
import { IsBoolean, IsIn, IsInt, IsOptional, Min } from 'class-validator';

const VISIBILITIES: GroupVisibility[] = ['PUBLIC', 'PRIVATE'];

export class UpdateGroupDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  pricePerSlotXaf?: number;

  @ApiProperty({ required: false, enum: VISIBILITIES })
  @IsOptional()
  @IsIn(VISIBILITIES)
  visibility?: GroupVisibility;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  autoAcceptJoinRequests?: boolean;
}
