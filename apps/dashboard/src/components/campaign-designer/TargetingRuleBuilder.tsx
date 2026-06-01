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

  return (
    <div className="space-y-4">
      {rules.length === 0 ? (
        <div className="text-sm text-gray-500 italic bg-gray-50 p-3 rounded-md border border-gray-100">
          Ads will trigger on <strong>all pages</strong> of your site. Add a rule to restrict targeting.
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-gray-50 p-2 rounded-md border border-gray-100">
              <select
                value={rule.operator}
                onChange={(e) => updateRule(idx, 'operator', e.target.value)}
                className="text-xs bg-white border border-gray-200 rounded p-1 w-24"
              >
                <option value="include">Show on</option>
                <option value="exclude">Hide on</option>
              </select>
              
              <select
                value={rule.matchType}
                onChange={(e) => updateRule(idx, 'matchType', e.target.value)}
                className="text-xs bg-white border border-gray-200 rounded p-1 w-24"
              >
                <option value="contains">URL contains</option>
                <option value="exact">Exact match</option>
                <option value="regex">Regex</option>
              </select>

              <input
                type="text"
                value={rule.value}
                onChange={(e) => updateRule(idx, 'value', e.target.value)}
                placeholder="/products/"
                className="text-xs bg-white border border-gray-200 rounded p-1 flex-1 min-w-0"
              />

              <button
                type="button"
                className="h-7 w-7 p-0 flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                onClick={() => removeRule(idx)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
                type="button"
        className="w-full text-xs h-8 border border-dashed border-gray-300 rounded flex items-center justify-center hover:bg-gray-50"
        onClick={addRule}
      >
        <Plus className="h-3 w-3 mr-2" /> Add Targeting Rule
      </button>
    </div>
  );
}
