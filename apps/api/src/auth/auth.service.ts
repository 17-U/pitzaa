import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Locale, OtpPurpose, User } from '@prisma/client';
import { generateSecureToken, hashToken } from '../common/crypto.util';
import { parseDurationMs } from '../common/duration.util';
import { OtpService } from '../otp/otp.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { JwtPayload } from './types/jwt-payload.interface';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly otp: OtpService,
    private readonly users: UsersService,
  ) {}

  async requestRegisterOrLoginOtp(
    phone: string,
    locale: Locale,
  ): Promise<{ expiresAt: Date }> {
    const existing = await this.users.findByPhone(phone);
    const purpose: OtpPurpose = existing ? 'LOGIN' : 'REGISTRATION';
    return this.otp.request(phone, purpose, existing?.locale ?? locale);
  }

  async verifyRegisterOrLoginOtp(params: {
    phone: string;
    code: string;
    locale: Locale;
    firstName?: string;
    lastName?: string;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<{ user: User; tokens: TokenPair }> {
    let user = await this.users.findByPhone(params.phone);
    const purpose: OtpPurpose = user ? 'LOGIN' : 'REGISTRATION';

    await this.otp.verify(params.phone, purpose, params.code);

    if (!user) {
      user = await this.users.createWithWallet({
        phone: params.phone,
        locale: params.locale,
        firstName: params.firstName,
        lastName: params.lastName,
      });
    }

    const tokens = await this.issueTokenPair(
      user,
      params.userAgent,
      params.ipAddress,
    );
    return { user, tokens };
  }

  async refresh(
    refreshToken: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<TokenPair> {
    const tokenHash = hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Jeton de rafraîchissement invalide.');
    }

    const user = await this.users.findById(stored.userId);
    if (!user || user.deletedAt) {
      throw new UnauthorizedException();
    }

    const newTokens = await this.issueTokenPair(user, userAgent, ipAddress);
    const newTokenHash = hashToken(newTokens.refreshToken);
    const newRecord = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: newTokenHash },
    });

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedByTokenId: newRecord?.id },
    });

    return newTokens;
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await this.prisma.refreshToken.updateMany({
        where: { userId, tokenHash: hashToken(refreshToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return;
    }
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokenPair(
    user: User,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<TokenPair> {
    const payload: JwtPayload = { sub: user.id, role: user.role };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
    });

    const refreshToken = generateSecureToken();
    const refreshTtl = this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '30d');
    const expiresAt = new Date(Date.now() + parseDurationMs(refreshTtl));

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        userAgent,
        ipAddress,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }
}
