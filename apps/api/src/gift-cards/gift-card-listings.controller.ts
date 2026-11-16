import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-request.interface';
import { CreateListingDto } from './dto/create-listing.dto';
import { RejectListingDto } from './dto/reject-listing.dto';
import { GiftCardListingsService } from './gift-card-listings.service';

@ApiTags('gift-card-listings')
@Controller('gift-cards/listings')
export class GiftCardListingsController {
  constructor(private readonly listingsService: GiftCardListingsService) {}

  @Get()
  @ApiOperation({
    summary: 'Annonces de cartes cadeaux publiées (vérifiées, non expirées)',
  })
  listPublic(@Query('brandId') brandId?: string) {
    return this.listingsService.listPublic(brandId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('mine')
  @ApiOperation({ summary: 'Mes annonces, tous statuts' })
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.listingsService.listMine(user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'MODERATOR')
  @ApiBearerAuth()
  @Get('admin/pending')
  @ApiOperation({
    summary: 'Annonces en attente de vérification manuelle (admin)',
  })
  listPendingForAdmin() {
    return this.listingsService.listPendingForAdmin();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'MODERATOR')
  @ApiBearerAuth()
  @Get(':id/admin/code')
  @ApiOperation({
    summary: 'Révèle le code pour vérification manuelle (admin, journalisé)',
  })
  adminRevealPendingCode(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.listingsService.adminRevealPendingCode(user.id, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'MODERATOR')
  @ApiBearerAuth()
  @Post(':id/verify')
  @ApiOperation({
    summary: 'Valide une annonce après vérification manuelle du solde (admin)',
  })
  verify(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.listingsService.verify(user.id, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'MODERATOR')
  @ApiBearerAuth()
  @Post(':id/reject')
  @ApiOperation({
    summary: 'Rejette une annonce après vérification manuelle (admin)',
  })
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RejectListingDto,
  ) {
    return this.listingsService.reject(user.id, id, dto.reason);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post()
  @ApiOperation({
    summary:
      'Met en vente une carte cadeau (vérification manuelle avant publication)',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateListingDto,
  ) {
    return this.listingsService.create(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Annule une annonce non encore vendue (vendeur uniquement)',
  })
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.listingsService.cancel(user.id, id);
  }
}
