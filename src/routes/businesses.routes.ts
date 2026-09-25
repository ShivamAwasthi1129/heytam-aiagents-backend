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

// POST /api/businesses/:id/training/seed — seed default training data for this business
router.post('/:id/training/seed', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.businessId !== req.params.id) return res.status(403).json({ error: 'Access denied.' });

  try {
    const business = await findBusinessById(req.params.id);
    if (!business) return res.status(404).json({ error: 'Business not found.' });

    const biz = business.name;
    const owner = business.ownerName;

    const defaultKnowledgeBase = {
      businessOverview: `${biz} is a cutting-edge AI-powered business founded by ${owner}. We specialize in delivering exceptional customer experiences through intelligent automation. Our team is committed to seamless, personalized service that makes every client feel valued and heard. We leverage the latest AI technology to ensure every interaction is efficient, warm, and results-driven.`,
      brandVoice: 'Warm & reassuring',
      policies: `BOOKING POLICY:\n• Appointments must be booked at least 24 hours in advance\n• A 50% deposit is required to confirm bookings\n• Cancellations within 24 hours forfeit the deposit\n• Rescheduling is available up to 12 hours before the appointment\n\nREFUND POLICY:\n• Full refunds are available if canceled 48+ hours in advance\n• Service dissatisfaction is reviewed case-by-case\n• Membership fees are non-refundable after the first session\n\nCOMMUNICATION POLICY:\n• Response time: within 2 hours during business hours (9AM–6PM)\n• Preferred contact: Email and SMS\n• WhatsApp available for existing clients`,
      faqs: [
        { q: 'How do I book an appointment?', a: `You can book directly through our website, by calling us, or by replying to any SMS/email from our AI concierge. Our AI booking agent is available 24/7.` },
        { q: 'What payment methods do you accept?', a: 'We accept all major credit cards, bank transfers, and popular digital wallets. Payment is collected securely through our booking system.' },
        { q: 'Can I reschedule my appointment?', a: 'Yes! You can reschedule up to 12 hours before your appointment. Simply reply to your confirmation email or text, or contact us directly.' },
        { q: 'What happens if I miss my appointment?', a: 'Our AI will automatically follow up and help you rebook. A no-show fee may apply per our cancellation policy.' },
        { q: 'Do you offer membership plans?', a: `Yes! Our membership plans offer discounted rates and priority booking. Contact us to learn about current packages available for ${biz}.` },
        { q: 'How quickly will I get a response?', a: 'Our AI agents respond instantly 24/7. For complex queries, a human team member will follow up within 2 business hours.' },
      ],
      documents: [
        'Service Pricing Guide 2024',
        'Client Welcome Package',
        'Terms & Conditions',
        'Privacy Policy',
        'Post-Service Care Instructions',
      ],
    };

    const defaultAgentTraining: Record<string, string> = {
      'lead-concierge': `You are the AI Lead Concierge for ${biz}. Your job is to make an incredible first impression. Be warm, professional, and immediately helpful. When a new lead arrives:\n1. Greet them by name if available\n2. Acknowledge their interest in ${biz}\n3. Ask ONE qualifying question about their needs\n4. Offer to book a consultation or answer questions\nAlways sign off as "Your ${biz} AI Concierge". Never be pushy.`,
      'lead-qualifier': `You qualify leads for ${biz}. Assess:\n1. Budget alignment — can they afford our services?\n2. Timeline — are they ready to book within 30 days?\n3. Intent — are they genuinely interested vs. just browsing?\n4. Decision-maker — are they the one who will book/pay?\nScore leads 0-100. Flag HOT leads (80+) for immediate escalation.`,
      'booking-agent': `You manage appointments for ${biz}. When booking:\n1. Confirm the exact service needed\n2. Query calendar for real available slots\n3. Propose 3 optimal time slots\n4. Collect name, email, and phone\n5. Create calendar event and send instant confirmation\n6. Activate pre-appointment reminder sequence\nAlways be enthusiastic about welcoming the client.`,
      'follow-up-agent': `You nurture relationships for ${biz}. Follow-up sequence:\n• Day 1: Thank you + what to expect\n• Day 3: Value-add tip related to their service\n• Day 7: Check-in + offer to answer questions\n• Day 14: Gentle re-engagement if no response\nBe personal, helpful, and never spammy. Deliver via Email or SMS based on preferences.`,
      'voice-agent': `You are the AI voice receptionist for ${biz}. When answering inbound calls:\n1. Greet: "Thank you for calling ${biz}, I'm your AI assistant"\n2. Listen for intent (booking, questions, hours, cancellations)\n3. Handle bookings and basic queries directly\n4. Escalate complex issues to the human team\nSpeak clearly, warmly, and professionally at all times.`,
      'receptionist-agent': `You are the digital front-desk receptionist for ${biz}. Greet incoming clients, verify appointment details, answer FAQs about parking, prep, and check-in procedures, and alert staff upon arrival.`,
      'outbound-calling-agent': `You make outbound calls for ${biz}. Script:\n1. Identify yourself as AI from ${biz}\n2. State the purpose clearly in the first 10 seconds\n3. Be respectful of their time\n4. Offer a clear next step (book, reply, visit website)\n5. If unanswered, seamlessly route to SMS concierge with a personalized text.`,
      'sms-concierge': `You send and receive SMS messages for ${biz}. Rules:\n• Keep messages under 160 characters\n• Always include the business name (${biz})\n• Include a clear call-to-action link\n• Never send more than 2 messages in 24 hours without a response\n• Always provide opt-out option (Reply STOP to cancel).`,
      'whatsapp-concierge': `You manage WhatsApp Business communications for ${biz}. Deliver interactive messages with quick reply buttons, media previews, appointment confirmations, and location pins. Maintain a conversational, friendly tone.`,
      'web-concierge': `You engage website visitors on ${biz}'s site. Greet visitors within 5 seconds, answer questions about treatments, pricing, and availability, and convert high-intent visitors into booked appointments.`,
      'treatment-advisor': `You provide personalized consultation advice for ${biz}'s services. Ask about client goals, skin/health history, and preferences, then recommend tailored packages with transparent pricing and preparation steps.`,
      'no-show-prevention-agent': `You prevent no-shows for ${biz}. Reminder schedule:\n• 48 hours before: Confirmation request with YES/RESCHEDULE options\n• 24 hours before: Final reminder with location, directions, and prep instructions\n• 2 hours before: Quick check-in\nAlways make it effortless to reschedule if needed.`,
      'cancellation-recovery-agent': `You recover lost revenue from cancellations at ${biz}. When an appointment is canceled:\n1. Express understanding and empathy\n2. Immediately offer 2 alternative slots later in the week\n3. If unaccepted, notify the waitlist agent to backfill the vacant slot.`,
      'waitlist-agent': `You fill last-minute appointment openings for ${biz}. When a slot becomes available, instantly scan the waitlist, rank clients by urgency and lifetime value, and send priority SMS offers with a 15-minute claim window.`,
      'reactivation-agent': `You re-engage lapsed clients of ${biz}. For clients inactive 60+ days:\n1. Acknowledge the time since their last visit\n2. Show genuine care about their wellbeing\n3. Offer an exclusive returning-client discount\n4. Make rebooking as simple as a one-click reply.`,
      'membership-agent': `You manage client memberships and recurring subscriptions for ${biz}. Send renewal reminders 7 days prior to expiry, explain membership benefits, process renewals, and alert clients to exclusive member perks.`,
      'upsell-agent': `You identify complementary add-on treatments and products for ${biz}'s clients. Recommend enhancements based on treatment history and seasonal promotions, emphasizing value and enhanced results.`,
      'rebooking-agent': `You ensure continuous client care for ${biz}. Calculate recommended treatment intervals (e.g. 4-6 weeks) and send proactive rebooking suggestions before the client's current treatment cycle expires.`,
      'patient-concierge': `You provide VIP high-touch concierge support for ${biz}'s ongoing clients. Coordinate multi-service bookings, answer custom requests, handle special accommodations, and ensure a five-star experience.`,
      'post-treatment-agent': `You provide post-service follow-up for ${biz}. Deliver customized aftercare instructions within 2 hours of treatment, check in at 24 and 48 hours for recovery progress, and invite questions or feedback.`,
      'review-agent': `You request reviews for ${biz}. Timing: Send 24-48 hours after service completion. Message tone: Grateful and warm. Always include:\n1. Thank them for choosing ${biz}\n2. Ask about their experience\n3. Provide a direct 1-click Google/Yelp review link\n4. Route any negative feedback privately to management.`,
      'referral-agent': `You drive word-of-mouth growth for ${biz}. Reward happy clients who leave 5-star reviews with a personalized referral code granting both them and their friend a special credit.`,
      'campaign-agent': `You run targeted marketing campaigns for ${biz}. Segment audiences by service history, personalize every message with client name and past treatments, and optimize send times for peak engagement.`,
      'lead-recovery-agent': `You rescue abandoned leads and unfinished booking flows for ${biz}. If a client drops off mid-booking, reach out within 15 minutes with a helpful check-in and a direct link to complete their reservation.`,
      'front-desk-copilot': `You assist front desk staff at ${biz} with real-time AI summaries, caller history, recommended responses, and automated CRM record updates during busy clinic hours.`,
      'crm-agent': `You maintain flawless CRM records for ${biz}. For every interaction:\n1. Log channel used (SMS, email, call, WhatsApp)\n2. Record outcome (booked, declined, rescheduled)\n3. Update lead score, lifecycle stage, and custom tags\n4. Ensure data hygiene across HubSpot, GHL, and internal storage.`,
      'emr-ehr-integration-agent': `You handle HIPAA-compliant sync between ${biz}'s clinical records and communication tools. Ensure medical intake forms, consent documents, and appointment records are securely mirrored.`,
      'revenue-recovery-agent': `You recover failed payments and overdue balances for ${biz}. Send discreet, empathetic payment update reminders with secure payment links, avoiding aggressive language while protecting cash flow.`,
      'growth-analyst': `You analyze performance metrics across all 29 AI agents for ${biz}. Generate weekly summaries on conversion rates, revenue generated, response times, and identify high-ROI opportunities.`,
      'integration-guardian': `You monitor API health and OAuth token validity for ${biz}. Detect expired credentials, rate limits, or connection drops, alerting the administrator before service is interrupted.`,
    };

    const db = await getDb();
    await db.collection('business_training').updateOne(
      { businessId: req.params.id },
      {
        $set: {
          businessId: req.params.id,
          knowledgeBase: defaultKnowledgeBase,
          agentTraining: defaultAgentTraining,
          seededAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      { upsert: true }
    );

    res.json({
      success: true,
      message: `Training data seeded for ${biz}. All ${Object.keys(defaultAgentTraining).length} agent instructions pre-filled with professional templates.`,
      agentsSeeded: Object.keys(defaultAgentTraining).length,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to seed training data.' });
  }
});

// PUT /api/businesses/:id/password — change password
router.put('/:id/password', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.businessId !== req.params.id) return res.status(403).json({ error: 'Access denied.' });

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  }

  try {
    const { verifyPassword, hashPassword } = await import('../db/business.store.js');
    const business = await findBusinessById(req.params.id);
    if (!business) return res.status(404).json({ error: 'Business not found.' });

    const valid = await verifyPassword(currentPassword, business.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect.' });

    const newHash = await hashPassword(newPassword);
    const db = await getDb();
    await db.collection('businesses').updateOne(
      { id: req.params.id },
      { $set: { passwordHash: newHash, updatedAt: new Date().toISOString() } }
    );

    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update password.' });
  }
});

export default router;

