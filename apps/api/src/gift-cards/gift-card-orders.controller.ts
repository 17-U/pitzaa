import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-request.interface';
import { DisputesService } from '../disputes/disputes.service';
import { CreateDisputeDto } from '../disputes/dto/create-dispute.dto';
import { BuyListingDto } from './dto/buy-listing.dto';
import { GiftCardOrdersService } from './gift-card-orders.service';

@ApiTags('gift-card-orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('gift-cards')
export class GiftCardOrdersController {
  constructor(
    private readonly ordersService: GiftCardOrdersService,
    private readonly disputesService: DisputesService,
  ) {}

  @Post('listings/:id/buy')
  @ApiOperation({
    summary:
      'Achète une carte cadeau (solde Pitzaa ou mobile money, PIN requis)',
  })
  buy(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') listingId: string,
    @Body() dto: BuyListingDto,
  ) {
    return this.ordersService.buy(user.id, listingId, dto);
  }

  @Post('orders/:id/reveal-code')
  @ApiOperation({
    summary: 'Révèle le code (une seule fois, consultation journalisée)',
  })
  revealCode(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') orderId: string,
  ) {
    return this.ordersService.revealCode(user.id, orderId);
  }

  @Post('orders/:id/dispute')
  @ApiOperation({
    summary: 'Ouvre un litige sur une commande (code invalide/inutilisable)',
  })
  dispute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') orderId: string,
    @Body() dto: CreateDisputeDto,
  ) {
    return this.disputesService.createForGiftCardOrder(
      user.id,
      orderId,
      dto.reason,
      dto.evidenceUrls,
    );
  }

  @Get('orders/mine')
  @ApiOperation({ summary: 'Mes achats de cartes cadeaux' })
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.listMine(user.id);
  }
}
