/**
 * JWT Auth Middleware
 * Verifies Bearer token and attaches business context to req.
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedRequest extends Request {
  businessId?: string;
  businessEmail?: string;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized. No token provided.' });
  }

  const token = header.slice(7);
  const secret = process.env.JWT_SECRET || 'heytam-secret-key-2024';

  try {
    const decoded = jwt.verify(token, secret) as { businessId: string; email: string };
    req.businessId = decoded.businessId;
    req.businessEmail = decoded.email;
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized. Invalid or expired token.' });
  }
}

export function signToken(businessId: string, email: string): string {
  const secret = process.env.JWT_SECRET || 'heytam-secret-key-2024';
  return jwt.sign({ businessId, email }, secret, { expiresIn: '30d' });
}
