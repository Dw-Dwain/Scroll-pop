import React from 'react';
import { FormDataShape } from '../../types/campaign';
import { Check, Mail, Webhook, Zap, UserPlus, Gift } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ActionsBuilderProps {
  formData: FormDataShape;
  setFormData: React.Dispatch<React.SetStateAction<FormDataShape>>;
}

export const ActionsBuilder: React.FC<ActionsBuilderProps> = ({ formData, setFormData }) => {
  const toggleIntegration = (id: string) => {
    setFormData(prev => {
      const integrations = prev.integrations || [];
      return {
        ...prev,
        integrations: integrations.includes(id) ? integrations.filter(i => i !== id) : [...integrations, id],
      };
    });
  };

  const integrationsList = formData.integrations || [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Actions & Integrations</h2>
        <p className="text-xs text-slate-500">Configure what happens after a user submits the form.</p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
            <Check className="w-4 h-4 text-indigo-500" />
            After submission show the user:
          </h3>
          <select 
            value={formData.afterSubmitAction || 'thank_you_view'}
            onChange={e => setFormData(prev => ({ ...prev, afterSubmitAction: e.target.value as 'thank_you_view' | 'redirect_url' | 'none' }))}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="thank_you_view">Show 'Thank You' view</option>
            <option value="redirect_url">Redirect to URL</option>
            <option value="none">None (Close display)</option>
          </select>

          {formData.afterSubmitAction === 'redirect_url' && (
            <div className="mt-3">
              <input 
                type="url"
                value={formData.afterSubmitUrl || ''}
                onChange={e => setFormData(prev => ({ ...prev, afterSubmitUrl: e.target.value }))}
                placeholder="https://example.com/thank-you"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-indigo-500" />
            After submission effect:
          </h3>
          <select 
            value={formData.afterSubmitEffect || 'none'}
            onChange={e => setFormData(prev => ({ ...prev, afterSubmitEffect: e.target.value as 'confetti' | 'none' }))}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="none">None</option>
            <option value="confetti">Confetti</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-2">
          <Gift className="w-4 h-4 text-indigo-500" />
          Enter collected information into:
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950/50">
            <span className="text-sm font-medium">ScrollPop List (Default)</span>
            <div className="px-3 py-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 rounded text-xs font-semibold">Enabled</div>
          </div>
          
          <div className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-800 rounded-lg">
            <span className="text-sm font-medium">Mailchimp</span>
            <button 
              onClick={() => toggleIntegration('mailchimp')}
              className={cn("px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors", integrationsList.includes('mailchimp') ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700")}
            >
              {integrationsList.includes('mailchimp') ? 'Connected' : 'Connect to Mailchimp'}
            </button>
          </div>
          
          <div className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-800 rounded-lg">
            <span className="text-sm font-medium">Klaviyo</span>
            <button 
              onClick={() => toggleIntegration('klaviyo')}
              className={cn("px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors", integrationsList.includes('klaviyo') ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700")}
            >
              {integrationsList.includes('klaviyo') ? 'Connected' : 'Connect to Klaviyo'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-indigo-500" />
          Who can complete this form:
        </h3>
        <div className="space-y-2 pl-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="radio" 
              name="whoCanComplete" 
              value="only_new"
              checked={formData.whoCanComplete === 'only_new' || !formData.whoCanComplete}
              onChange={() => setFormData(prev => ({ ...prev, whoCanComplete: 'only_new' }))}
              className="text-indigo-600 focus:ring-indigo-500 w-4 h-4"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">Only new customers</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="radio" 
              name="whoCanComplete" 
              value="anyone_once"
              checked={formData.whoCanComplete === 'anyone_once'}
              onChange={() => setFormData(prev => ({ ...prev, whoCanComplete: 'anyone_once' }))}
              className="text-indigo-600 focus:ring-indigo-500 w-4 h-4"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">Anyone, a single time</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="radio" 
              name="whoCanComplete" 
              value="anyone_multiple"
              checked={formData.whoCanComplete === 'anyone_multiple'}
              onChange={() => setFormData(prev => ({ ...prev, whoCanComplete: 'anyone_multiple' }))}
              className="text-indigo-600 focus:ring-indigo-500 w-4 h-4"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">Anyone, multiple times</span>
          </label>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Mail className="w-4 h-4 text-indigo-500" />
            Follow up email:
          </h3>
          <div className="bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">Premium</div>
        </div>
        
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Notification email:
          </h3>
          <label className="flex items-center cursor-pointer">
            <div className="relative">
              <input 
                type="checkbox" 
                className="sr-only" 
                checked={formData.sendNotificationEmail || false}
                onChange={e => setFormData(prev => ({ ...prev, sendNotificationEmail: e.target.checked }))}
              />
              <div className={cn("block w-10 h-6 rounded-full transition-colors", formData.sendNotificationEmail ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700')}></div>
              <div className={cn("absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform", formData.sendNotificationEmail ? 'transform translate-x-4' : '')}></div>
            </div>
            <span className="ml-3 text-xs text-slate-500 dark:text-slate-400">Send notification email when form is submitted</span>
          </label>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <Webhook className="w-4 h-4 text-indigo-500" />
          Webhook:
        </h3>
        <div className="flex gap-2">
          <input 
            type="url"
            value={formData.webhookUrl || ''}
            onChange={e => setFormData(prev => ({ ...prev, webhookUrl: e.target.value }))}
            placeholder="https://mywebhook.com"
            className="flex-grow bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <button className="px-4 py-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:hover:bg-indigo-500/30 rounded-lg text-sm font-medium transition-colors">
            Send test data
          </button>
        </div>
      </div>
    </div>
  );
};
