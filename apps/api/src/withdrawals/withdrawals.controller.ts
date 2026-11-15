import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-request.interface';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { WithdrawalsService } from './withdrawals.service';

@ApiTags('withdrawals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('withdrawals')
export class WithdrawalsController {
  constructor(private readonly withdrawalsService: WithdrawalsService) {}

  @Post('otp')
  @Throttle({ default: { limit: 3, ttl: 600_000 } })
  @ApiOperation({
    summary: 'Demande le code OTP obligatoire (2FA) avant un retrait',
  })
  requestOtp(@CurrentUser() user: AuthenticatedUser) {
    return this.withdrawalsService.requestWithdrawalOtp(user.id);
  }

  @Post()
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  @ApiOperation({
    summary:
      'Crée un retrait vers un compte MTN MoMo ou Orange Money (2FA requis)',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWithdrawalDto,
  ) {
    return this.withdrawalsService.createWithdrawal({
      userId: user.id,
      amountXaf: dto.amountXaf,
      operator: dto.operator,
      destinationMsisdn: dto.destinationMsisdn,
      otpCode: dto.otpCode,
    });
  }

  @Get()
  @ApiOperation({
    summary: "Historique des retraits de l'utilisateur connecté",
  })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.withdrawalsService.listForUser(user.id);
  }
}
