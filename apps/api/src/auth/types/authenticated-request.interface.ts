import { Request } from 'express';
import { Locale, UserRole } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  phone: string;
  locale: Locale;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
