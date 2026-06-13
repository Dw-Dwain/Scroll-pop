import { describe, it, expect } from 'vitest';
import { sanitizeEmailHtml } from './email-html.js';

describe('sanitizeEmailHtml (auto-responder email allowlist — SR-07)', () => {
  it('keeps allow-listed tags, links and images', () => {
    const out = sanitizeEmailHtml(
      '<p>Hi</p><a href="https://example.com" target="_blank" rel="noopener">link</a>' +
        '<img src="https://cdn.example.com/a.png" alt="a" width="40" height="40">',
    );
    expect(out).toContain('<p>Hi</p>');
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('src="https://cdn.example.com/a.png"');
  });

  it('keeps safe inline CSS (color, font, spacing, alignment)', () => {
    const out = sanitizeEmailHtml(
      '<p style="color:#ff0000;background-color:rgb(0,0,0);font-size:14px;font-weight:bold;' +
        'text-align:center;padding:8px;margin:4px 8px;max-width:600px">x</p>',
    );
    expect(out).toContain('color:#ff0000');
    expect(out).toContain('background-color:rgb(0,0,0)');
    expect(out).toContain('font-size:14px');
    expect(out).toContain('text-align:center');
    expect(out).toContain('padding:8px');
    expect(out).toContain('max-width:600px');
  });

  it('strips position (overlay/clickjacking) but keeps neighbouring safe CSS', () => {
    const out = sanitizeEmailHtml('<div style="position:fixed;top:0;left:0;color:red">x</div>');
    expect(out).not.toMatch(/position/i);
    expect(out).not.toMatch(/top\s*:/i);
    expect(out).not.toMatch(/left\s*:/i);
    expect(out).toContain('color:red');
  });

  it('strips CSS url() vectors (tracking pixels via background/background-image)', () => {
    const out = sanitizeEmailHtml(
      '<div style="background:url(https://evil.example/x.gif);background-image:url(https://evil.example/y.gif);color:blue">x</div>',
    );
    expect(out.toLowerCase()).not.toContain('url(');
    expect(out).not.toMatch(/background-image/i);
    expect(out).toContain('color:blue');
  });

  it('strips other dangerous properties (z-index, transform, opacity, behavior)', () => {
    const out = sanitizeEmailHtml(
      '<div style="z-index:9999;transform:scale(2);opacity:0;behavior:url(x.htc);color:green">x</div>',
    );
    expect(out).not.toMatch(/z-index|transform|opacity|behavior/i);
    expect(out).toContain('color:green');
  });

  it('strips <script>, event handlers and javascript: URLs', () => {
    const out = sanitizeEmailHtml(
      '<script>alert(1)</script><p onclick="evil()">ok</p><a href="javascript:alert(1)">x</a>',
    );
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toMatch(/onclick/i);
    expect(out).not.toMatch(/javascript:/i);
    expect(out).toContain('ok');
  });

  it('drops disallowed tags (iframe) and their content wrappers', () => {
    const out = sanitizeEmailHtml('<iframe src="https://evil.example"></iframe><p>safe</p>');
    expect(out).not.toMatch(/<iframe/i);
    expect(out).toContain('<p>safe</p>');
  });
});
