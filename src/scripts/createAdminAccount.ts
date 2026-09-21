/**
 * Seed Script — Creates admin test account with full access
 * Run once: npx tsx src/scripts/createAdminAccount.ts
 */
import dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env') });

import { createBusiness, findBusinessByEmail } from '../db/business.store.js';
import { activateTool } from '../db/toolConfig.store.js';
import { TOOL_CATALOG } from '../catalog/toolCatalog.js';
import { getDb, closeDb } from '../db/mongodb.js';

const ADMIN_EMAIL = 'admin@heytam.io';
const ADMIN_PASSWORD = 'HeytamAdmin2024!';
const ADMIN_BUSINESS_NAME = 'Heytam Demo Clinic (Admin)';

async function seedAdmin() {
  console.log('🌱 Seeding admin account...');

  // Check if exists
  const existing = await findBusinessByEmail(ADMIN_EMAIL);
  if (existing) {
    console.log(`✅ Admin account already exists: ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    await closeDb();
    return;
  }

  // Create business
  const business = await createBusiness({
    name: ADMIN_BUSINESS_NAME,
    ownerName: 'Heytam Admin',
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    phone: '+1 (555) 000-0001',
    location: 'Beverly Hills, CA',
    tone: 'Professional, warm, and helpful',
    services: ['Botox', 'Fillers', 'HydraFacial', 'Laser Treatments', 'Microneedling', 'Chemical Peels'],
  });

  console.log(`✅ Created business: ${business.name} (${business.id})`);

  // Set plan to premium
  const db = await getDb();
  await db.collection('businesses').updateOne(
    { id: business.id },
    { $set: { plan: { name: 'Enterprise (Admin)', monthlyFee: 0 }, status: 'active' } }
  );

  // Activate ALL 30 tools
  console.log('🔧 Activating all 30 AI tools...');
  let activated = 0;
  for (const tool of TOOL_CATALOG) {
    try {
      await activateTool(business.id, tool.id, tool.name, tool.category, tool.priceMonthly);
      activated++;
      process.stdout.write(`   [${activated}/30] ${tool.name}\r`);
    } catch {
      // Already exists
    }
  }

  console.log(`\n✅ All ${activated} tools activated for admin account`);

  // Add some mock training data
  await db.collection('business_training').insertOne({
    businessId: business.id,
    knowledgeBase: {
      businessOverview: `${ADMIN_BUSINESS_NAME} is a premier MedSpa offering cutting-edge aesthetic treatments. We specialize in non-surgical rejuvenation using the latest technology. Our team of board-certified physicians and expert aestheticians deliver exceptional results in a luxurious, welcoming environment.`,
      brandVoice: 'Warm & reassuring',
      policies: '24-hour cancellation notice required. No refunds on completed services. Consultation required for all new treatments. Patients must be 18+.',
      faqs: [
        { q: 'What services do you offer?', a: 'We offer Botox, fillers, HydraFacial, laser treatments, microneedling, chemical peels, and more. Book a free consultation to discuss the best treatment plan for you.' },
        { q: 'How long do results last?', a: 'Results vary by treatment: Botox 3-4 months, fillers 6-18 months, HydraFacial glow lasts 1 week.' },
        { q: 'Is there downtime?', a: 'Most of our treatments have minimal downtime. Injectable treatments may cause mild swelling for 24-48 hours.' },
      ],
      documents: ['Treatment Menu 2024.pdf', 'Pre-Treatment Instructions.pdf', 'After-Care Guide.pdf'],
    },
    agentTraining: {
      'lead-concierge': 'Always introduce yourself as "Aria, your personal concierge." Be warm and enthusiastic. Respond within 15 seconds of a lead reaching out.',
      'booking-agent': 'Offer 3 appointment options when booking. Always confirm with the patient before finalizing.',
      'voice-agent': 'Keep calls under 5 minutes when possible. Always end with "Is there anything else I can help you with today?"',
    },
    updatedAt: new Date().toISOString(),
  });

  console.log(`\n🎉 Admin seed complete!`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📧 Email:    ${ADMIN_EMAIL}`);
  console.log(`🔑 Password: ${ADMIN_PASSWORD}`);
  console.log(`🏢 Business: ${ADMIN_BUSINESS_NAME}`);
  console.log(`🛠️  Tools:    All 30 activated`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  await closeDb();
}

seedAdmin().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
