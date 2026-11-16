import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

const OUTCOMES = ['INITIATOR', 'COUNTERPARTY'] as const;
export type DisputeOutcome = (typeof OUTCOMES)[number];

export class ResolveDisputeDto {
  @ApiProperty({
    enum: OUTCOMES,
    description:
      'INITIATOR = la personne qui a ouvert le litige a raison (remboursement) ; COUNTERPARTY = l’autre partie a raison (libération normale).',
  })
  @IsIn(OUTCOMES)
  outcome!: DisputeOutcome;

  @ApiProperty({
    example:
      'Capture fournie par le vendeur confirmant la disponibilité du service.',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  notes!: string;
}
