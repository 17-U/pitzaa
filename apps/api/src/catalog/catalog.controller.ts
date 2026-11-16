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
import { CatalogService } from './catalog.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@ApiTags('catalog')
@Controller('services')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  @ApiOperation({
    summary: 'Catalogue public des services qui autorisent le partage',
  })
  listPublic() {
    return this.catalogService.listPublic();
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'un service du catalogue" })
  getById(@Param('id') id: string) {
    return this.catalogService.getById(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'MODERATOR')
  @ApiBearerAuth()
  @Get('admin/all')
  @ApiOperation({
    summary: 'Catalogue complet, y compris les services masqués (admin)',
  })
  listAllForAdmin() {
    return this.catalogService.listAllForAdmin();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'MODERATOR')
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Ajoute un service au catalogue (admin)' })
  create(@Body() dto: CreateServiceDto) {
    return this.catalogService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'MODERATOR')
  @ApiBearerAuth()
  @Patch(':id')
  @ApiOperation({ summary: 'Met à jour un service du catalogue (admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateServiceDto) {
    return this.catalogService.update(id, dto);
  }
}
