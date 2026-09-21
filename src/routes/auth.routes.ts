/**
 * Auth Routes — Business registration and login
 */
import { Router, Request, Response } from 'express';
import { createBusiness, findBusinessByEmail, verifyPassword, findBusinessById } from '../db/business.store.js';
import { signToken, requireAuth, type AuthenticatedRequest } from '../middleware/auth.middleware.js';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  const { businessName, ownerName, email, password, phone, location, tone, services } = req.body;

  if (!businessName || !email || !password || !ownerName) {
    return res.status(400).json({ error: 'businessName, ownerName, email, and password are required.' });
  }

  try {
    const business = await createBusiness({ name: businessName, ownerName, email, password, phone: phone || '', location: location || '', tone, services });
    const token = signToken(business.id, business.email);

    return res.status(201).json({
      success: true,
      token,
      business: {
        id: business.id,
        name: business.name,
        ownerName: business.ownerName,
        email: business.email,
        phone: business.phone,
        location: business.location,
        tone: business.tone,
        services: business.services,
        status: business.status,
        plan: business.plan,
        webhookKey: business.webhookKey,
        createdAt: business.createdAt,
      },
    });
  } catch (err: any) {
    if (err.message?.includes('already exists')) return res.status(409).json({ error: err.message });
    console.error('[Register Error]', err);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

  try {
    const business = await findBusinessByEmail(email);
    if (!business) return res.status(401).json({ error: 'Invalid email or password.' });

    const valid = await verifyPassword(password, business.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password.' });

    const token = signToken(business.id, business.email);

    return res.json({
      success: true,
      token,
      business: {
        id: business.id,
        name: business.name,
        ownerName: business.ownerName,
        email: business.email,
        phone: business.phone,
        location: business.location,
        tone: business.tone,
        services: business.services,
        status: business.status,
        plan: business.plan,
        webhookKey: business.webhookKey,
        createdAt: business.createdAt,
      },
    });
  } catch (err) {
    console.error('[Login Error]', err);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const business = await findBusinessById(req.businessId!);
    if (!business) return res.status(404).json({ error: 'Business not found.' });

    return res.json({
      id: business.id,
      name: business.name,
      ownerName: business.ownerName,
      email: business.email,
      phone: business.phone,
      location: business.location,
      tone: business.tone,
      services: business.services,
      status: business.status,
      plan: business.plan,
      webhookKey: business.webhookKey,
      createdAt: business.createdAt,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch profile.' });
  }
});

export default router;
