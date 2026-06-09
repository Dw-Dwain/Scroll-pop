// ─── Advanced Targeting (lazy chunk) ────────────────────────────────────────────
// Loaded by the core snippet (p.js) only when a campaign uses one of the heavier rule
// kinds below. Keeps regex-safety + storage/UTM bookkeeping out of the core bundle so the
// core stays under its 10 KB gate. Attaches window.__sp_targeting = { evaluateRule }.
//
// The core still handles the common, cheap kinds inline (url_exact, url_contains, device,
// geo, ab_test). This chunk owns: url_regex, returning_visitor, session_page_views, utm.
// Budget: ≤2 KB gzip (see CI snippet-size-check).

import { isSafeRegex } from './sanitize.js';

type Rule = { kind: string; value: Record<string, unknown> };

function evaluateRule(rule: Rule): boolean {
  const { kind, value } = rule;
  const url = window.location.href;

  switch (kind) {
    case 'url_regex': {
      try {
        const pattern = (value['pattern'] as string) || '';
        if (!isSafeRegex(pattern)) return false;
        return new RegExp(pattern).test(url);
      } catch {
        return false;
      }
    }

    case 'returning_visitor': {
      const isReturning = !!localStorage.getItem('_sp_visited');
      localStorage.setItem('_sp_visited', '1');
      return isReturning === (value['is_returning'] as boolean);
    }

    case 'session_page_views': {
      let c = +(sessionStorage.getItem('_sp_pc') || 0);
      if (!sessionStorage.getItem('_sp_pcd')) {
        sessionStorage.setItem('_sp_pc', ++c + '');
        sessionStorage.setItem('_sp_pcd', '1');
      }
      return c >= +(value['count'] || 0);
    }

    case 'utm': {
      // Match a UTM param against the current URL, falling back to the first-touch query
      // string saved in localStorage. Legacy rules used { source }; current use { param, value }.
      const s = location.search, h = s.indexOf('utm_') >= 0;
      let ft = localStorage.getItem('_sp_utm');
      if (h && !ft) localStorage.setItem('_sp_utm', ft = s);
      const got = new URLSearchParams(h ? s : (ft || '')).get((value['param'] as string) || 'utm_source') || '';
      return got.toLowerCase() === String(value['value'] ?? '').toLowerCase();
    }

    default:
      return true;
  }
}

(window as unknown as { __sp_targeting?: { evaluateRule: (r: Rule) => boolean } }).__sp_targeting = { evaluateRule };
