import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-request.interface';
import { PostMessageDto } from './dto/post-message.dto';
import { MessagingService } from './messaging.service';

@ApiTags('messaging')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get(':id/messages')
  @ApiOperation({
    summary:
      'Historique des messages (participants au groupe/transaction/litige uniquement)',
  })
  listMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') conversationId: string,
  ) {
    return this.messagingService.listMessages(user.id, conversationId);
  }

  @Post(':id/messages')
  @ApiOperation({
    summary:
      'Envoie un message (les numéros de téléphone/mobile money et liens WhatsApp sont automatiquement masqués)',
  })
  postMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') conversationId: string,
    @Body() dto: PostMessageDto,
  ) {
    return this.messagingService.postMessage(
      user.id,
      conversationId,
      dto.content,
    );
  }
}
