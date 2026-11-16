import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-request.interface';
import { RevealVaultDto } from './dto/reveal-vault.dto';
import { SetVaultDto } from './dto/set-vault.dto';
import { VaultService } from './vault.service';

@ApiTags('vault')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('groups/:groupId/vault')
export class VaultController {
  constructor(private readonly vaultService: VaultService) {}

  @Post()
  @ApiOperation({
    summary:
      'Définit ou met à jour les identifiants chiffrés du groupe (propriétaire uniquement)',
  })
  setCredentials(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Body() dto: SetVaultDto,
  ) {
    return this.vaultService.setCredentials(user.id, groupId, dto.payload);
  }

  @Post('reveal')
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  @ApiOperation({
    summary:
      'Révèle les identifiants (PIN requis, chaque accès est journalisé)',
  })
  reveal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Body() dto: RevealVaultDto,
  ) {
    return this.vaultService.reveal(user.id, groupId, dto.pin);
  }
}
