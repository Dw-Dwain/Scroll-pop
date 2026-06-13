import sanitizeHtml from 'sanitize-html';

// CSS value matchers for the inline-style allowlist below. Anything not matching is dropped.
const COLOR = [
  /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i,
  /^rgb\(\s*\d{1,3}(?:\s*,\s*\d{1,3}){2}\s*\)$/i,
  /^rgba\(\s*\d{1,3}(?:\s*,\s*\d{1,3}){2}\s*,\s*(?:0|1|0?\.\d+)\s*\)$/i,
  /^[a-z]+$/i, // named colors (red, transparent, …) — letters only, so url()/expression() can't match
];
const LEN = /^-?\d+(?:\.\d+)?(?:px|em|rem|%|pt)$/;
const BOX = /^(?:-?\d+(?:\.\d+)?(?:px|em|rem|%|pt)\s*){1,4}$/; // 1–4 lengths (margin/padding shorthand)

/**
 * Sanitize operator-supplied auto-responder email HTML down to a safe allowlist before it is sent
 * to subscribers' inboxes (SR-07).
 *
 * Tags and attributes are allow-listed, schemes are restricted to http(s)/mailto, and — crucially —
 * inline CSS is restricted to a safe property/value allowlist via `allowedStyles`. Without that, the
 * permitted `style` attribute would pass arbitrary CSS, letting a malicious or compromised operator
 * smuggle tracking pixels (`background:url(…)`), overlay/clickjacking layouts (`position:fixed`), or
 * other CSS-based abuse into outbound email — even though most clients also sanitize, we don't rely
 * on that. Disallowed properties (position, float, background shorthand/url(), z-index, transform,
 * content, …) are stripped; <script> and event handlers were never allowed.
 */
export function sanitizeEmailHtml(rawHtml: string): string {
  return sanitizeHtml(rawHtml, {
    allowedTags: ['p', 'br', 'b', 'i', 'strong', 'em', 'a', 'ul', 'ol', 'li',
                  'h1', 'h2', 'h3', 'img', 'div', 'span', 'table', 'tr', 'td'],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height'],
      '*': ['style'],
    },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowedStyles: {
      '*': {
        'color': COLOR,
        'background-color': COLOR,
        'font-family': [/^[\w\s,"'-]+$/],
        'font-size': [LEN],
        'font-weight': [/^(?:normal|bold|bolder|lighter|[1-9]00)$/i],
        'font-style': [/^(?:normal|italic|oblique)$/i],
        'line-height': [/^(?:normal|[\d.]+(?:px|em|rem|%)?)$/i],
        'text-align': [/^(?:left|right|center|justify)$/i],
        'text-decoration': [/^(?:none|underline|line-through|overline)$/i],
        'text-transform': [/^(?:none|uppercase|lowercase|capitalize)$/i],
        'padding': [BOX],
        'padding-top': [LEN], 'padding-right': [LEN], 'padding-bottom': [LEN], 'padding-left': [LEN],
        'margin': [BOX],
        'margin-top': [LEN], 'margin-right': [LEN], 'margin-bottom': [LEN], 'margin-left': [LEN],
        'width': [LEN], 'max-width': [LEN], 'min-width': [LEN],
        'border-radius': [BOX],
      },
    },
  });
}
