import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Locale, User } from '@prisma/client';
import { Request } from 'express';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { SetPinDto } from './dto/set-pin.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthenticatedUser } from './types/authenticated-request.interface';

function resolveLocale(req: Request): Locale {
  const header = req.headers['accept-language'];
  return typeof header === 'string' && header.toLowerCase().startsWith('en')
    ? 'en'
    : 'fr';
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function toPublicUser(user: User) {
  const { pinHash: _pinHash, ...rest } = user;
  return rest;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('register-or-login/request-otp')
  @Throttle({ default: { limit: 3, ttl: 600_000 } })
  @ApiOperation({
    summary: "Demande un code OTP par SMS pour l'inscription ou la connexion",
  })
  async requestOtp(@Body() dto: RequestOtpDto, @Req() req: Request) {
    return this.authService.requestRegisterOrLoginOtp(
      dto.phone,
      resolveLocale(req),
    );
  }

  @Post('register-or-login/verify-otp')
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  @ApiOperation({
    summary:
      'Vérifie le code OTP, crée le compte si besoin, retourne les jetons',
  })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    const { user, tokens } = await this.authService.verifyRegisterOrLoginOtp({
      phone: dto.phone,
      code: dto.code,
      locale: resolveLocale(req),
      firstName: dto.firstName,
      lastName: dto.lastName,
      userAgent: firstHeader(req.headers['user-agent']),
      ipAddress: ip,
    });
    return { user: toPublicUser(user), ...tokens };
  }

  @Post('refresh')
  @Throttle({ default: { limit: 20, ttl: 600_000 } })
  @ApiOperation({
    summary: 'Renouvelle la paire de jetons à partir du refresh token',
  })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.authService.refresh(
      dto.refreshToken,
      firstHeader(req.headers['user-agent']),
      ip,
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Révoque le refresh token fourni, ou toutes les sessions si omis',
  })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: LogoutDto,
  ): Promise<void> {
    await this.authService.logout(user.id, dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: "Profil de l'utilisateur connecté" })
  async me(@CurrentUser() user: AuthenticatedUser) {
    const fullUser = await this.usersService.findById(user.id);
    return fullUser ? toPublicUser(fullUser) : null;
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch('me')
  @ApiOperation({ summary: 'Met à jour le profil (nom, langue)' })
  async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    const updated = await this.usersService.updateProfile(user.id, dto);
    return toPublicUser(updated);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('me/pin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Définit ou met à jour le PIN Pitzaa' })
  async setPin(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetPinDto,
  ): Promise<void> {
    await this.usersService.setPin(user.id, dto.pin);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('me/export')
  @ApiOperation({
    summary: 'Exporte les données personnelles de l’utilisateur',
  })
  async exportMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.exportPersonalData(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprime (anonymise) le compte' })
  async deleteMe(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.usersService.softDelete(user.id);
  }
}
