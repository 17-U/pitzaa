import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-request.interface';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GroupsService } from './groups.service';

@ApiTags('groups')
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  @ApiOperation({
    summary: 'Liste les groupes publics (optionnellement filtrés par service)',
  })
  listPublic(@Query('serviceId') serviceId?: string) {
    return this.groupsService.listPublic(serviceId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('mine')
  @ApiOperation({
    summary: 'Groupes possédés ou rejoints par l’utilisateur connecté',
  })
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.groupsService.listMine(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'un groupe" })
  getById(@Param('id') id: string) {
    return this.groupsService.getById(id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post()
  @ApiOperation({
    summary: 'Crée un groupe de partage (gratuit pour le propriétaire)',
  })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateGroupDto) {
    return this.groupsService.create(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch(':id')
  @ApiOperation({ summary: 'Met à jour un groupe (propriétaire uniquement)' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.groupsService.update(user.id, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post(':id/close')
  @ApiOperation({
    summary:
      'Ferme un groupe aux nouvelles adhésions (propriétaire uniquement)',
  })
  close(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.groupsService.close(user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post(':id/join')
  @ApiOperation({ summary: 'Demande à rejoindre un groupe' })
  requestJoin(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.groupsService.requestJoin(user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('memberships/:membershipId/accept')
  @ApiOperation({
    summary: 'Accepte une demande d’adhésion (propriétaire uniquement)',
  })
  acceptJoinRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('membershipId') membershipId: string,
  ) {
    return this.groupsService.acceptJoinRequest(user.id, membershipId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('memberships/:membershipId/reject')
  @ApiOperation({
    summary: 'Rejette une demande d’adhésion (propriétaire uniquement)',
  })
  rejectJoinRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('membershipId') membershipId: string,
  ) {
    return this.groupsService.rejectJoinRequest(user.id, membershipId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('memberships/:membershipId/leave')
  @ApiOperation({
    summary:
      'Quitte un groupe sans engagement (effectif à la fin de la période payée)',
  })
  leave(
    @CurrentUser() user: AuthenticatedUser,
    @Param('membershipId') membershipId: string,
  ) {
    return this.groupsService.leave(user.id, membershipId);
  }
}
