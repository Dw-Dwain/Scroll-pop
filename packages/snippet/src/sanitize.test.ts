import { describe, it, expect } from 'vitest';
import {
  escapeHtml, safeHref, safeCssColor, safeCssUrl, safeCssInt,
  cssNum, cssFont, cssAlign, cssWeight, cssLen, isSafeRegex,
} from './sanitize.js';

describe('escapeHtml', () => {
  it('escapes all HTML-significant characters', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(escapeHtml(`"'&<>`)).toBe('&quot;&#039;&amp;&lt;&gt;');
  });
  it('handles null/undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});

describe('safeHref', () => {
  it('allows http(s)', () => {
    expect(safeHref('https://example.com/x?a=1')).toBe('https://example.com/x?a=1');
    expect(safeHref('http://example.com')).toBe('http://example.com');
  });
  it('blocks javascript: and data: and other schemes', () => {
    expect(safeHref('javascript:alert(document.cookie)')).toBe('#');
    expect(safeHref('JaVaScRiPt:alert(1)')).toBe('#');
    expect(safeHref('data:text/html,<script>alert(1)</script>')).toBe('#');
    expect(safeHref('vbscript:msgbox(1)')).toBe('#');
  });
  it('blocks empty / malformed', () => {
    expect(safeHref('')).toBe('#');
    expect(safeHref(null)).toBe('#');
    expect(safeHref('not a url')).toBe('#');
  });
  it('normalizes scheme-less affiliate links to https (so they do not resolve relative to the host page)', () => {
    // Operators paste links without a scheme; these must become absolute https URLs, not '#'
    // (which navigates to the host page) and not a bogus relative resolution.
    expect(safeHref('www.shop.com/deal?id=5')).toBe('https://www.shop.com/deal?id=5');
    expect(safeHref('shop.com/aff/123')).toBe('https://shop.com/aff/123');
    expect(safeHref('//cdn.example.com/x')).toBe('https://cdn.example.com/x'); // protocol-relative
  });
  it('still rejects bare relative paths / single tokens (no dotted host)', () => {
    expect(safeHref('/blog')).toBe('#');
    expect(safeHref('deal')).toBe('#');
  });
  it('does not let scheme normalization smuggle a dangerous scheme back in', () => {
    // A real scheme is honored (and blocked); we never prepend https:// to it.
    expect(safeHref('javascript:alert(1)')).toBe('#');
    expect(safeHref('  JAVASCRIPT:alert(1)  ')).toBe('#');
  });
});

describe('safeCssColor', () => {
  it('allows hex colors (incl. 8-digit alpha)', () => {
    expect(safeCssColor('#fff', 'X')).toBe('#fff');
    expect(safeCssColor('#6366f1', 'X')).toBe('#6366f1');
    expect(safeCssColor('#00000000', 'X')).toBe('#00000000'); // fully transparent
  });
  it('allows the transparent keyword and numeric rgb()/rgba()', () => {
    expect(safeCssColor('transparent', 'X')).toBe('transparent');
    expect(safeCssColor('rgba(0,0,0,0)', 'X')).toBe('rgba(0,0,0,0)');
    expect(safeCssColor('rgb(255, 255, 255)', 'X')).toBe('rgb(255, 255, 255)');
    expect(safeCssColor('rgba(15, 15, 15, 0.85)', 'X')).toBe('rgba(15, 15, 15, 0.85)');
  });
  it('rejects injection attempts', () => {
    expect(safeCssColor('red;}</style><script>alert(1)</script>', '#000')).toBe('#000');
    expect(safeCssColor('#fff;background:url(//evil)', '#000')).toBe('#000');
    expect(safeCssColor('expression(alert(1))', '#000')).toBe('#000');
    expect(safeCssColor('red', '#000')).toBe('#000'); // arbitrary named colors still rejected
    expect(safeCssColor('rgba(0,0,0,0);}</style>', '#000')).toBe('#000'); // no breakout via rgba
    expect(safeCssColor('rgb(1,2,url(x))', '#000')).toBe('#000');
  });
});

describe('safeCssUrl', () => {
  it('allows clean http(s) urls', () => {
    expect(safeCssUrl('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png');
  });
  it('blocks url()-breakout and non-http schemes', () => {
    expect(safeCssUrl('https://x/a.png");background:url("//evil')).toBe('');
    expect(safeCssUrl('javascript:alert(1)')).toBe('');
    expect(safeCssUrl("https://x/a.png')")).toBe('');
  });
});

describe('cssNum', () => {
  it('passes finite numbers, falls back otherwise', () => {
    expect(cssNum(42, 0)).toBe(42);
    expect(cssNum('50', 0)).toBe(50);
    expect(cssNum('10px;}</style>', 99)).toBe(99);
    expect(cssNum(undefined, 7)).toBe(7);
    expect(cssNum(NaN, 7)).toBe(7);
  });
});

describe('cssFont', () => {
  it('keeps valid font names', () => {
    expect(cssFont('Inter, sans-serif')).toBe('Inter, sans-serif');
  });
  it('strips style/attribute breakout characters', () => {
    expect(cssFont('a;}</style><img src=x onerror=alert(1)>')).not.toContain('<');
    expect(cssFont('a"onmouseover="alert(1)')).not.toContain('}');
    expect(cssFont('x;color:red')).toBe('xcolorred');
    expect(cssFont(123)).toBe('inherit');
  });
  it('strips the double quote so it cannot break out of style="…"', () => {
    // The value is rendered inside a double-quoted style attribute; a surviving " would
    // terminate the attribute and inject markup. (Regression for cssFont allowlist fix.)
    expect(cssFont('a" autofocus tabindex=0 x')).not.toContain('"');
    expect(cssFont('"')).toBe('inherit');
  });
});

describe('cssAlign / cssWeight', () => {
  it('whitelists alignment', () => {
    expect(cssAlign('center', 'left')).toBe('center');
    expect(cssAlign('center;}</style>', 'left')).toBe('left');
  });
  it('whitelists weight', () => {
    expect(cssWeight('700', '400')).toBe('700');
    expect(cssWeight('bold', '400')).toBe('bold');
    expect(cssWeight('700;}<x>', '400')).toBe('400');
  });
});

describe('cssLen', () => {
  it('numbers become px', () => {
    expect(cssLen(12, '0')).toBe('12px');
  });
  it('allows safe length strings', () => {
    expect(cssLen('8px 12px', '0')).toBe('8px 12px');
    expect(cssLen('1.5rem', '0')).toBe('1.5rem');
  });
  it('rejects css-breaking strings', () => {
    expect(cssLen('12px;}</style>', '0')).toBe('0');
    expect(cssLen('url(//evil)', '0')).toBe('0');
    expect(cssLen('12px"onload="x', '0')).toBe('0');
  });
});

describe('safeCssInt', () => {
  it('clamps to range', () => {
    expect(safeCssInt(12, 0, 32, 8)).toBe(12);
    expect(safeCssInt(999, 0, 32, 8)).toBe(8);
    expect(safeCssInt('8;}', 0, 32, 8)).toBe(8);
  });
});

describe('isSafeRegex', () => {
  it('allows simple URL-matching patterns', () => {
    expect(isSafeRegex('^/products/.*')).toBe(true);
    expect(isSafeRegex('/blog/')).toBe(true);
    expect(isSafeRegex('^https://example\\.com/blog/\\d+')).toBe(true);
    expect(isSafeRegex('/products/[a-z0-9-]+')).toBe(true);
  });
  it('rejects nested-quantifier ReDoS patterns', () => {
    expect(isSafeRegex('(a+)+$')).toBe(false);
    expect(isSafeRegex('([a-z]+)*')).toBe(false);
    expect(isSafeRegex('(a*)*')).toBe(false);
    expect(isSafeRegex('([a-z]+){5}')).toBe(false);
  });
  it('rejects quantified-alternation ReDoS patterns', () => {
    expect(isSafeRegex('(a|b)+')).toBe(false);
    expect(isSafeRegex('(foo|foobar)*')).toBe(false);
    expect(isSafeRegex('(x|y){3}')).toBe(false);
  });
  it('rejects absurdly large bounded repetitions', () => {
    expect(isSafeRegex('a{1001}')).toBe(false);
    expect(isSafeRegex('a{0,5000}')).toBe(false);
  });
  it('rejects patterns that do not compile', () => {
    expect(isSafeRegex('(unclosed')).toBe(false);
    expect(isSafeRegex('[z-a]')).toBe(false);
  });
  it('rejects over-length patterns', () => {
    expect(isSafeRegex('a'.repeat(201))).toBe(false);
  });
  it('rejects non-string input', () => {
    expect(isSafeRegex(undefined as unknown as string)).toBe(false);
  });
});
