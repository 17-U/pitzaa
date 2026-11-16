import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateGiftCardBrandDto } from './dto/create-gift-card-brand.dto';
import { UpdateGiftCardBrandDto } from './dto/update-gift-card-brand.dto';
import { GiftCardBrandsService } from './gift-card-brands.service';

@ApiTags('gift-card-brands')
@Controller('gift-card-brands')
export class GiftCardBrandsController {
  constructor(private readonly brandsService: GiftCardBrandsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Catalogue public des marques de cartes cadeaux dont la revente est autorisée',
  })
  listPublic() {
    return this.brandsService.listPublic();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'MODERATOR')
  @ApiBearerAuth()
  @Get('admin/all')
  @ApiOperation({
    summary: 'Catalogue complet des marques, y compris masquées (admin)',
  })
  listAllForAdmin() {
    return this.brandsService.listAllForAdmin();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'MODERATOR')
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Ajoute une marque de carte cadeau (admin)' })
  create(@Body() dto: CreateGiftCardBrandDto) {
    return this.brandsService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'MODERATOR')
  @ApiBearerAuth()
  @Patch(':id')
  @ApiOperation({ summary: 'Met à jour une marque de carte cadeau (admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateGiftCardBrandDto) {
    return this.brandsService.update(id, dto);
  }
}
