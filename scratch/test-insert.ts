import { db } from '../apps/api/src/db/client.js';
import { events, campaigns, tenants, sites } from '../apps/api/src/db/schema.js';
import { eq } from 'drizzle-orm';

async function main() {
  try {
    console.log('Finding first available campaign...');
    let campaign = await db.query.campaigns.findFirst();
    
    if (!campaign) {
      console.log('No campaign found locally, creating seed data first...');
      
      // 1. Create Tenant
      let [tenant] = await db.insert(tenants).values({
        clerkOrgId: 'org_demo_12345',
        name: 'Demo Local Org',
        plan: 'free',
        monthlyViewLimit: 1000,
      }).returning();
      
      // 2. Create Site
      let [site] = await db.insert(sites).values({
        tenantId: tenant.id,
        name: 'test-site',
        domain: 'localhost',
      }).returning();
      
      // 3. Create Campaign
      const results = await db.insert(campaigns).values({
        tenantId: tenant.id,
        siteId: site.id,
        name: 'Test Campaign',
        status: 'active',
      }).returning();
      campaign = results[0];
    }
    
    console.log('Inserting event locally for campaign:', campaign.id);
    const result = await db.insert(events).values({
      tenantId: campaign.tenantId,
      siteId: campaign.siteId,
      campaignId: campaign.id,
      eventType: 'impression',
      visitorId: 'test-visitor',
      sessionId: 'test-session',
      device: 'desktop',
      pageUrl: 'http://localhost/test',
      referrer: '',
      ts: new Date(),
      country: 'US',
    });
    console.log('Successfully inserted event!', result);
  } catch (err) {
    console.error('Failed to insert event! Error:', err);
  } finally {
    process.exit(0);
  }
}

main();
