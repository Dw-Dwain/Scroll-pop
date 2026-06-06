/**
 * ESP (Email Service Provider) adapters — Klaviyo (P1-8) + Mailchimp (P1-9).
 *
 * Each adapter is best-effort and never throws — failures are silently swallowed
 * so a broken ESP config never breaks the ingest path.
 *
 * Klaviyo v3 API ref:  https://developers.klaviyo.com/en/reference/subscribe_profiles
 * Mailchimp API ref:   https://mailchimp.com/developer/marketing/api/list-members/add-member-to-list/
 */

const KLAVIYO_REVISION = '2024-02-15';

interface EspContact {
  email: string;
  firstName?: string | undefined;
  lastName?: string | undefined;
}

/**
 * Result of an ESP sync attempt. On the live ingest path the result is ignored
 * (best-effort); in test mode (`/integrations/test`) the caller inspects `ok`/`error`
 * to surface credential failures instead of always reporting success.
 */
export interface EspSyncResult {
  ok: boolean;
  error?: string;
}

// ─── Klaviyo ──────────────────────────────────────────────────────────────────

/**
 * Subscribe a contact to a Klaviyo list.
 * Uses the `profile-subscription-bulk-create-jobs` endpoint (server-side, requires private key).
 */
export async function syncToKlaviyo(opts: {
  apiKey: string;
  listId: string;
  contact: EspContact;
  testMode?: boolean;
}): Promise<EspSyncResult> {
  const { apiKey, listId, contact, testMode } = opts;
  if (!apiKey || !listId || !contact.email) {
    return { ok: false, error: 'Klaviyo API key, list ID, and contact email are required' };
  }

  const profileAttrs: Record<string, string> = { email: contact.email };
  if (contact.firstName) profileAttrs['first_name'] = contact.firstName;
  if (contact.lastName)  profileAttrs['last_name']  = contact.lastName;

  try {
    const res = await fetch('https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs/', {
      method: 'POST',
      headers: {
        'Authorization': `Klaviyo-API-Key ${apiKey}`,
        'revision': KLAVIYO_REVISION,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        data: {
          type: 'profile-subscription-bulk-create-job',
          attributes: {
            profiles: {
              data: [{
                type: 'profile',
                attributes: {
                  ...profileAttrs,
                  subscriptions: {
                    email: { marketing: { consent: 'SUBSCRIBED' } },
                  },
                },
              }],
            },
          },
          relationships: {
            list: { data: { type: 'list', id: listId } },
          },
        },
      }),
      signal: AbortSignal.timeout(8000),
    });
    // 202 Accepted is the success response for this bulk endpoint
    if (!res.ok && res.status !== 202) {
      const body = await res.text().catch(() => '');
      if (testMode) return { ok: false, error: `Klaviyo ${res.status}: ${body.slice(0, 200)}` };
      console.warn(`[esp] Klaviyo sync failed (${res.status}): ${body.slice(0, 200)}`);
      return { ok: false, error: `Klaviyo ${res.status}` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'request failed';
    if (testMode) return { ok: false, error: `Klaviyo request failed: ${msg}` };
    return { ok: false, error: msg };
  }
  return { ok: true };
}

// ─── Mailchimp ────────────────────────────────────────────────────────────────

/**
 * Subscribe a contact to a Mailchimp audience list.
 * Server prefix is extracted from the API key (format: `<key>-<prefix>`, e.g. `abc123-us1`).
 */
export async function syncToMailchimp(opts: {
  apiKey: string;
  listId: string;
  contact: EspContact;
  testMode?: boolean;
}): Promise<EspSyncResult> {
  const { apiKey, listId, contact, testMode } = opts;
  if (!apiKey || !listId || !contact.email) {
    return { ok: false, error: 'Mailchimp API key, list ID, and contact email are required' };
  }

  // Extract data center prefix from the API key (e.g. "us1" from "key-us1").
  // SR-05: the prefix is interpolated into the fetch host, so a crafted key like
  // `xxxx-us1.evil.com/p?q=` would leak the Authorization header to an attacker.
  // Mailchimp data center codes are always 2 letters + 1-2 digits (us1, us6, eu1…).
  const serverPrefix = apiKey.split('-').pop();
  if (!serverPrefix || !/^[a-z]{2}\d{1,2}$/i.test(serverPrefix)) {
    const error = 'Mailchimp API key has an invalid data center suffix';
    if (!testMode) console.warn(`[esp] ${error} — skipping sync`);
    return { ok: false, error };
  }

  const mergeFields: Record<string, string> = {};
  if (contact.firstName) mergeFields['FNAME'] = contact.firstName;
  if (contact.lastName)  mergeFields['LNAME']  = contact.lastName;

  const auth = Buffer.from(`anystring:${apiKey}`).toString('base64');

  try {
    const res = await fetch(
      `https://${serverPrefix}.api.mailchimp.com/3.0/lists/${listId}/members`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email_address: contact.email,
          status: 'subscribed',
          ...(Object.keys(mergeFields).length > 0 ? { merge_fields: mergeFields } : {}),
        }),
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      // SR-08: Mailchimp returns 400 for many fatal errors (bad key, bad list ID,
      // compliance state), not only "member already exists". Only treat the genuine
      // "Member Exists" 400 as non-fatal; everything else is a real failure.
      let title: string | undefined;
      try { title = (JSON.parse(body) as { title?: string }).title; } catch { /* non-JSON body */ }
      const isMemberExists = res.status === 400 &&
        (title === 'Member Exists' || body.includes('Member Exists'));
      if (!isMemberExists) {
        if (testMode) return { ok: false, error: `Mailchimp ${res.status}: ${body.slice(0, 200)}` };
        console.warn(`[esp] Mailchimp sync failed (${res.status}): ${body.slice(0, 200)}`);
        return { ok: false, error: `Mailchimp ${res.status}` };
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'request failed';
    if (testMode) return { ok: false, error: `Mailchimp request failed: ${msg}` };
    return { ok: false, error: msg };
  }
  return { ok: true };
}

// ─── Shared dispatcher ────────────────────────────────────────────────────────

export interface TenantIntegrations {
  klaviyo?: { apiKey?: string; listId?: string; enabled?: boolean };
  mailchimp?: { apiKey?: string; listId?: string; enabled?: boolean };
}

export interface CampaignEspConfig {
  klaviyo?: boolean;
  mailchimp?: boolean;
}

/**
 * Dispatch an email_capture event to all enabled ESPs. Best-effort — never throws.
 *
 * @param tenantIntegrations  - tenant-level credentials from `tenants.integrations`
 * @param campaignEspConfig   - per-campaign opt-in flags from `campaigns.esp_config`
 * @param contact             - the captured lead's contact info
 */
export async function dispatchToEsps(
  tenantIntegrations: TenantIntegrations,
  campaignEspConfig: CampaignEspConfig,
  contact: EspContact,
): Promise<void> {
  // Live ingest path — results are ignored (best-effort); errors are logged inside
  // the adapters. Test mode surfaces results via /integrations/test instead.
  const promises: Promise<EspSyncResult>[] = [];

  const kl = tenantIntegrations.klaviyo;
  if (campaignEspConfig.klaviyo !== false && kl?.enabled && kl.apiKey && kl.listId) {
    promises.push(syncToKlaviyo({ apiKey: kl.apiKey, listId: kl.listId, contact }));
  }

  const mc = tenantIntegrations.mailchimp;
  if (campaignEspConfig.mailchimp !== false && mc?.enabled && mc.apiKey && mc.listId) {
    promises.push(syncToMailchimp({ apiKey: mc.apiKey, listId: mc.listId, contact }));
  }

  if (promises.length > 0) {
    await Promise.allSettled(promises);
  }
}
