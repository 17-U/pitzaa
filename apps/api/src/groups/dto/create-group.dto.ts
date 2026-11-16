import { ApiProperty } from '@nestjs/swagger';
import { GroupVisibility } from '@prisma/client';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

const VISIBILITIES: GroupVisibility[] = ['PUBLIC', 'PRIVATE'];

export class CreateGroupDto {
  @ApiProperty()
  @IsString()
  serviceId!: string;

  @ApiProperty({ example: 2000 })
  @IsInt()
  @Min(0)
  pricePerSlotXaf!: number;

  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(1)
  @Max(50)
  totalSlots!: number;

  @ApiProperty({ enum: VISIBILITIES, default: 'PRIVATE' })
  @IsOptional()
  @IsIn(VISIBILITIES)
  visibility?: GroupVisibility;

  @ApiProperty({
    default: false,
    description: 'Acceptation automatique des demandes pour rejoindre',
  })
  @IsOptional()
  @IsBoolean()
  autoAcceptJoinRequests?: boolean;
}
