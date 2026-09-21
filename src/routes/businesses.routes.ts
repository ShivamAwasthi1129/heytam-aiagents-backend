/**
 * Businesses Routes — Profile management and dashboard stats
 */
import { Router, Response } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { findBusinessById, updateBusiness, getBusinessStats } from '../db/business.store.js';
import { getBusinessTools } from '../db/toolConfig.store.js';
import { getDb } from '../db/mongodb.js';

const router = Router();

// GET /api/businesses/:id — get business profile
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.businessId !== req.params.id) return res.status(403).json({ error: 'Access denied.' });

  try {
    const business = await findBusinessById(req.params.id);
    if (!business) return res.status(404).json({ error: 'Business not found.' });

    const { passwordHash, ...safe } = business;
    res.json({ success: true, business: safe });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch business.' });
  }
});

// PUT /api/businesses/:id — update business profile
router.put('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.businessId !== req.params.id) return res.status(403).json({ error: 'Access denied.' });

  const { name, ownerName, phone, location, tone, services } = req.body;

  try {
    const updated = await updateBusiness(req.params.id, { name, ownerName, phone, location, tone, services });
    if (!updated) return res.status(404).json({ error: 'Business not found.' });
    const { passwordHash, ...safe } = updated;
    res.json({ success: true, business: safe });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update business.' });
  }
});

// GET /api/businesses/:id/stats — dashboard stats
router.get('/:id/stats', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.businessId !== req.params.id) return res.status(403).json({ error: 'Access denied.' });

  try {
    const stats = await getBusinessStats(req.params.id);
    const db = await getDb();
    const leadsCount = await db.collection('leads').countDocuments({ tenantId: req.params.id });
    const logsCount = await db.collection('logs').countDocuments({ tenantId: req.params.id });

    res.json({
      success: true,
      stats: {
        ...stats,
        leadsCount,
        activityLogsCount: logsCount,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats.' });
  }
});

// GET /api/businesses/:id/training — get training/knowledge base
router.get('/:id/training', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.businessId !== req.params.id) return res.status(403).json({ error: 'Access denied.' });

  try {
    const db = await getDb();
    const training = await db.collection('business_training').findOne({ businessId: req.params.id });
    res.json({ success: true, training: training || { businessId: req.params.id, knowledgeBase: {}, agentTraining: {} } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch training data.' });
  }
});

// PUT /api/businesses/:id/training — save training/knowledge base
router.put('/:id/training', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.businessId !== req.params.id) return res.status(403).json({ error: 'Access denied.' });

  const { knowledgeBase, agentTraining } = req.body;

  try {
    const db = await getDb();
    await db.collection('business_training').updateOne(
      { businessId: req.params.id },
      { $set: { businessId: req.params.id, knowledgeBase, agentTraining, updatedAt: new Date().toISOString() } },
      { upsert: true }
    );
    res.json({ success: true, message: 'Training data saved.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save training data.' });
  }
});

export default router;
