import React from 'react';
import { Plus, Trash2 } from 'lucide-react';


export interface PageTargetingRule {
  operator: 'include' | 'exclude';
  matchType: 'contains' | 'exact' | 'regex';
  value: string;
}

interface TargetingRuleBuilderProps {
  rules: PageTargetingRule[];
  onChange: (rules: PageTargetingRule[]) => void;
}

export function TargetingRuleBuilder({ rules, onChange }: TargetingRuleBuilderProps) {
  const addRule = () => {
    onChange([...rules, { operator: 'include', matchType: 'contains', value: '' }]);
  };

  const removeRule = (index: number) => {
    const newRules = [...rules];
    newRules.splice(index, 1);
    onChange(newRules);
  };

  const updateRule = (index: number, field: keyof PageTargetingRule, val: string) => {
    const newRules = [...rules];
    newRules[index] = { ...newRules[index], [field]: val } as PageTargetingRule;
    onChange(newRules);
  };

  // Per-match-type placeholder so the example matches the selected mode.
  const placeholderFor = (m: PageTargetingRule['matchType']) =>
    m === 'regex' ? '^/blog/.*$' : m === 'exact' ? 'https://yoursite.com/page' : '/products/';

  // Plain-English summary of a rule so operators can read it at a glance.
  const describe = (rule: PageTargetingRule) => {
    if (!rule.value.trim()) return 'Enter the URL text to match.';
    const verb = rule.operator === 'include' ? 'Show' : 'Hide';
    const match =
      rule.matchType === 'exact' ? 'exactly equals' :
      rule.matchType === 'regex' ? 'matches regex' : 'contains';
    return `${verb} when the page URL ${match} “${rule.value.trim()}”.`;
  };

  return (
    <div className="space-y-3">
      {rules.length === 0 ? (
        <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded-md border border-gray-200 leading-relaxed">
          Popups trigger on <strong className="font-semibold text-gray-800">all pages</strong> of your site.
          Add a rule to limit where they appear.
        </div>
      ) : (
        <div className="space-y-2.5">
          {rules.map((rule, idx) => (
            <div key={idx} className="bg-gray-50 rounded-lg border border-gray-200 p-2.5 space-y-2">
              {/* Header: rule number + remove */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Rule {idx + 1}
                </span>
                <button
                  type="button"
                  aria-label={`Remove rule ${idx + 1}`}
                  title="Remove rule"
                  className="h-6 w-6 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  onClick={() => removeRule(idx)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Selects: full width, side by side — no more truncation */}
              <div className="flex gap-2">
                <select
                  aria-label="Show or hide on matching pages"
                  value={rule.operator}
                  onChange={(e) => updateRule(idx, 'operator', e.target.value)}
                  className="flex-1 min-w-0 text-xs bg-white border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                >
                  <option value="include">Show on</option>
                  <option value="exclude">Hide on</option>
                </select>

                <select
                  aria-label="URL match type"
                  value={rule.matchType}
                  onChange={(e) => updateRule(idx, 'matchType', e.target.value)}
                  className="flex-1 min-w-0 text-xs bg-white border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                >
                  <option value="contains">URL contains</option>
                  <option value="exact">Exact match</option>
                  <option value="regex">Regex</option>
                </select>
              </div>

              {/* Value: full width — the most important field finally has room */}
              <input
                type="text"
                aria-label="URL pattern to match"
                value={rule.value}
                onChange={(e) => updateRule(idx, 'value', e.target.value)}
                placeholder={placeholderFor(rule.matchType)}
                className="w-full text-xs font-mono bg-white border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />

              {/* Plain-English preview */}
              <p className="text-[10px] text-gray-500 leading-snug">{describe(rule)}</p>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        className="w-full text-xs font-medium h-9 border border-dashed border-gray-300 rounded-md flex items-center justify-center gap-1.5 text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-colors"
        onClick={addRule}
      >
        <Plus className="h-3.5 w-3.5" /> Add Targeting Rule
      </button>
    </div>
  );
}
