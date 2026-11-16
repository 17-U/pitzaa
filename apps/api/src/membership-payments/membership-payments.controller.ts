import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-request.interface';
import { DisputesService } from '../disputes/disputes.service';
import { PayMembershipDto } from './dto/pay-membership.dto';
import { ReportNoAccessDto } from './dto/report-no-access.dto';
import { MembershipPaymentsService } from './membership-payments.service';

@ApiTags('membership-payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('memberships')
export class MembershipPaymentsController {
  constructor(
    private readonly membershipPaymentsService: MembershipPaymentsService,
    private readonly disputesService: DisputesService,
  ) {}

  @Post(':membershipId/payments')
  @ApiOperation({
    summary:
      'Paie l’échéance (1, 3 ou 6 mois), depuis le portefeuille Pitzaa ou par mobile money',
  })
  pay(
    @CurrentUser() user: AuthenticatedUser,
    @Param('membershipId') membershipId: string,
    @Body() dto: PayMembershipDto,
  ) {
    return this.membershipPaymentsService.pay(user.id, membershipId, dto);
  }

  @Post('payments/:membershipPaymentId/no-access')
  @ApiOperation({
    summary: '« Je n’ai pas accès » : gèle le paiement et ouvre un litige',
  })
  reportNoAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('membershipPaymentId') membershipPaymentId: string,
    @Body() dto: ReportNoAccessDto,
  ) {
    return this.disputesService.createForMembershipPayment(
      user.id,
      membershipPaymentId,
      dto.reason,
    );
  }
}
