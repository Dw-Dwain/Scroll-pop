/**
 * Minimal, dependency-free email sender via Resend's HTTP API.
 *
 * No `resend` npm package (keeps the lockfile lean and avoids pnpm v11 build-script
 * prompts) — just `fetch` (global in Node 22). Fully DORMANT until BOTH `RESEND_API_KEY`
 * and `RESEND_FROM` are set, so nothing is sent and nothing breaks before you configure it.
 *
 * `RESEND_FROM` must be an address on a domain you've verified in Resend, e.g.
 *   notifications@scrollpop.online
 */

export function emailEnabled(): boolean {
  return !!(process.env['RESEND_API_KEY'] && process.env['RESEND_FROM']);
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Optional Reply-To (e.g. a contact-form submitter's address). */
  replyTo?: string;
}): Promise<boolean> {
  const key = process.env['RESEND_API_KEY'];
  const from = process.env['RESEND_FROM'];
  if (!key || !from) return false; // dormant — not configured yet

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        ...(opts.text ? { text: opts.text } : {}),
        ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
      }),
    });
    return res.ok;
  } catch {
    return false; // best-effort — never throw into the caller
  }
}
