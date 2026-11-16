import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-request.interface';
import { DisputesService } from './disputes.service';
import { RespondDisputeDto } from './dto/respond-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';

@ApiTags('disputes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Get('mine')
  @ApiOperation({ summary: 'Litiges où je suis à l’origine ou mis en cause' })
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.disputesService.listMine(user.id);
  }

  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'MODERATOR', 'SUPPORT')
  @Get('admin/pending')
  @ApiOperation({ summary: 'Litiges ouverts ou en arbitrage (admin)' })
  listPendingForAdmin() {
    return this.disputesService.listPendingForAdmin();
  }

  @Post(':id/respond')
  @ApiOperation({
    summary:
      'La partie mise en cause répond dans les 48h (sinon arbitrage automatique)',
  })
  respond(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RespondDisputeDto,
  ) {
    return this.disputesService.respond(user.id, id, dto.message);
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Annule un litige que j’ai ouvert (avant toute réponse)',
  })
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.disputesService.cancel(user.id, id);
  }

  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'MODERATOR', 'SUPPORT')
  @Post(':id/resolve')
  @ApiOperation({
    summary:
      'Tranche le litige : déclenche remboursement ou libération normale (admin)',
  })
  resolve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.disputesService.resolve(user.id, id, dto.outcome, dto.notes);
  }
}
