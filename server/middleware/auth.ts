import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { UserRole } from '../../shared/types';
import { db } from '../db';

const RUNTIME_JWT_SECRET = process.env.JWT_SECRET?.trim() || crypto.randomBytes(32).toString('hex');
export const AUTH_COOKIE_NAME = 'msh_session';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  authViaCookie?: boolean;
}

export function signAuthToken(user: AuthUser): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    },
    RUNTIME_JWT_SECRET,
    { expiresIn: '12h' }
  );
}

export function setAuthCookie(req: Request, res: Response, token: string): void {
  const isHttps =
    req.secure ||
    String(req.headers['x-forwarded-proto'] || '')
      .split(',')[0]
      .trim() === 'https';

  const parts = [
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${12 * 60 * 60}`,
  ];

  if (isHttps) {
    parts.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }

  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearAuthCookie(req: Request, res: Response): void {
  const isHttps =
    req.secure ||
    String(req.headers['x-forwarded-proto'] || '')
      .split(',')[0]
      .trim() === 'https';

  const parts = [`${AUTH_COOKIE_NAME}=`, 'HttpOnly', 'Path=/', 'Max-Age=0'];
  if (isHttps) {
    parts.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function extractCookieToken(req: Request): string | null {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    if (key === AUTH_COOKIE_NAME) {
      return decodeURIComponent(pair.slice(idx + 1).trim());
    }
  }
  return null;
}

function verifyMutationOrigin(req: Request): boolean {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase())) {
    return true;
  }
  const hasCustomHeader = req.headers['x-requested-with'] === 'MShRentalApp';
  const origin = req.headers.origin;
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  if (!origin) {
    return hasCustomHeader;
  }
  try {
    const parsedOrigin = new URL(origin);
    return parsedOrigin.host === host || hasCustomHeader;
  } catch {
    return false;
  }
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    let token: string | null = null;
    let viaCookie = false;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    } else {
      token = extractCookieToken(req);
      viaCookie = !!token;
    }

    if (!token) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    if (viaCookie && !verifyMutationOrigin(req)) {
      res.status(403).json({ success: false, error: 'Invalid request origin' });
      return;
    }

    const decoded = jwt.verify(token, RUNTIME_JWT_SECRET) as { sub?: string };
    if (!decoded?.sub) {
      res.status(401).json({ success: false, error: 'Invalid session token' });
      return;
    }

    const user = await db.findUserById(decoded.sub);
    if (!user || !user.isActive) {
      res.status(401).json({ success: false, error: 'Account inactive or not found' });
      return;
    }

    req.user = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    };
    req.authViaCookie = viaCookie;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Session expired or invalid' });
  }
}

export function requireManager(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }
  if (req.user.role !== 'MANAGER') {
    res.status(403).json({ success: false, error: 'Manager permission required' });
    return;
  }
  next();
}

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }
  if (req.user.role !== 'ADMIN') {
    res.status(403).json({
      success: false,
      error: 'Manager accounts are strictly read-only for operational records. Admin access required.',
    });
    return;
  }
  next();
}
