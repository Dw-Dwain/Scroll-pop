import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { sendEmail, emailEnabled } from '../lib/email.js';

// Marketing "Contact / Agency enquiry" form (scrollpop.online). This endpoint is PUBLIC and
// unauthenticated, so it's hardened accordingly:
//  - the recipient is HARD-CODED server-side (never taken from the request) → cannot be abused
//    as an open relay to arbitrary addresses;
//  - tight per-IP rate limit (see route config) on top of the global limit;
//  - Zod validation + HTML-escaped body (Resend's HTTP API takes JSON fields, not raw headers,
//    so there's no SMTP header-injection surface either);
//  - the submitter's address goes in `reply_to` so the team can reply directly.
const CONTACT_TO = 'noreply@novatise.com';

const ContactBody = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  message: z.string().trim().max(5000).default(''),
  storefrontUrl: z.string().trim().max(300).default(''),
  platformType: z.string().trim().max(60).default(''),
  projectScope: z.string().trim().max(120).default(''),
});

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const contactRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/contact',
    { config: { rateLimit: { max: 5, timeWindow: '10 minutes' } } },
    async (request, reply) => {
      const parsed = ContactBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: { code: 'VALIDATION', message: 'Please include your name and a valid email.' },
        });
      }
      const b = parsed.data;

      if (!emailEnabled()) {
        // Resend not configured on this host — fail loudly so the form can tell the visitor to
        // email us directly, rather than silently dropping the enquiry.
        return reply.code(503).send({
          error: { code: 'EMAIL_DISABLED', message: 'Contact email is not configured.' },
        });
      }

      const fields: [string, string][] = [
        ['Name', b.name],
        ['Email', b.email],
        ['Storefront URL', b.storefrontUrl || '—'],
        ['Platform', b.platformType || '—'],
        ['Enquiry type', b.projectScope || '—'],
      ];
      const html =
        `<h2 style="margin:0 0 12px">New ScrollPop enquiry</h2>` +
        `<table cellpadding="4" style="border-collapse:collapse;font:14px sans-serif">` +
        fields
          .map(([k, v]) => `<tr><td style="color:#666">${escapeHtml(k)}</td><td><strong>${escapeHtml(v)}</strong></td></tr>`)
          .join('') +
        `</table>` +
        `<p style="font:14px sans-serif;margin:16px 0 4px;color:#666">Message</p>` +
        `<p style="font:14px sans-serif;white-space:pre-wrap">${escapeHtml(b.message) || '—'}</p>`;
      const text =
        fields.map(([k, v]) => `${k}: ${v}`).join('\n') + `\n\nMessage:\n${b.message || '—'}`;

      const sent = await sendEmail({
        to: CONTACT_TO,
        replyTo: b.email,
        subject: `ScrollPop enquiry — ${b.name}`,
        html,
        text,
      });

      if (!sent) {
        return reply.code(502).send({
          error: {
            code: 'SEND_FAILED',
            message: 'Could not send your message. Please email noreply@novatise.com directly.',
          },
        });
      }

      return reply.code(200).send({ data: { ok: true } });
    },
  );
};
