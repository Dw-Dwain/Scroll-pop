import { useState, ChangeEvent, FormEvent } from 'react';
import { Send, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// The form POSTs to the ScrollPop API's public /contact endpoint, which emails the enquiry
// (via Resend) to the inbox below. CONTACT_EMAIL is also shown as a direct fallback.
const API_URL = 'https://scrollpop-api.fly.dev/api/v1';
const CONTACT_EMAIL = 'noreply@novatise.com';

export default function ContactView() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    storefrontUrl: '',
    platformType: 'shopify',
    projectScope: 'custom-sections',
    briefMessage: '',
  });

  const [formSubmitted, setFormSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || submitting) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_URL}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          message: formData.briefMessage,
          storefrontUrl: formData.storefrontUrl,
          platformType: formData.platformType,
          projectScope: formData.projectScope,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setFormSubmitted(true);
    } catch {
      setErrorMsg(`Sorry — we couldn't send that just now. Please email us directly at ${CONTACT_EMAIL}.`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-16 font-sans text-neutral-850">
      {/* Header */}
      <div className="text-center mb-12">
        <span className="text-xs uppercase font-mono tracking-widest text-[#C05621] font-semibold block mb-3">GET IN TOUCH</span>
        <h1 className="font-serif text-4xl md:text-5xl font-normal tracking-tight leading-none text-gradient">
          Questions? We’re here to help.
        </h1>
        <p className="font-light text-neutral-600 leading-relaxed text-sm md:text-base mt-4 max-w-xl mx-auto">
          Whether you’re evaluating ScrollPop, need install help, or want to discuss the Agency plan — fill in the form and we’ll get back to you within one business day.
        </p>
      </div>

      {/* Form only — full width */}
      <div className="glass rounded-2xl overflow-hidden p-8 md:p-10 flex flex-col gap-8">

          <AnimatePresence mode="wait">
            {!formSubmitted ? (
              <motion.form
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={handleSubmit}
                className="flex flex-col gap-6"
              >
                <div>
                  <h3 className="font-serif text-xl font-normal text-neutral-900">Tell us about your project</h3>
                  <p className="text-xs text-neutral-600 mt-1 font-light">Complete this brief and our team will reply to your email within one business day.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-600 font-bold">Your Full Name</label>
                    <input
                      required
                      type="text"
                      name="name"
                      placeholder="e.g. Christian Gainsbourg"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full text-xs h-10 border border-neutral-250 rounded-full px-4 bg-white text-neutral-800 placeholder-neutral-400 hover:border-neutral-350 focus:outline-hidden focus:border-neutral-400 transition-colors"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-600 font-bold">Your Company Email</label>
                    <input
                      required
                      type="email"
                      name="email"
                      placeholder="e.g. christian@brand.com"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full text-xs h-10 border border-neutral-250 rounded-full px-4 bg-white text-neutral-800 placeholder-neutral-400 hover:border-neutral-350 focus:outline-hidden focus:border-neutral-400 transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-600 font-bold">Storefront Home URL</label>
                    <input
                      type="text"
                      name="storefrontUrl"
                      placeholder="e.g. www.boutique-store.com"
                      value={formData.storefrontUrl}
                      onChange={handleInputChange}
                      className="w-full text-xs h-10 border border-neutral-250 rounded-full px-4 bg-white text-neutral-800 placeholder-neutral-400 hover:border-neutral-350 focus:outline-hidden focus:border-neutral-400 transition-colors"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-600 font-bold">Primary CMS Architecture</label>
                    <select
                      name="platformType"
                      value={formData.platformType}
                      onChange={handleInputChange}
                      className="w-full text-xs h-10 border border-neutral-250 rounded-full px-4 bg-white text-neutral-800 cursor-pointer hover:border-neutral-350 focus:outline-hidden focus:border-neutral-400 transition-colors"
                    >
                      <option value="shopify">Shopify Plus Storefront</option>
                      <option value="wordpress">WordPress Gutenberg / Custom Theme</option>
                      <option value="headless">Headless Framework (React / Nuxt)</option>
                      <option value="other">Other Platform</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-600 font-bold">Enquiry Type</label>
                  <select
                    name="projectScope"
                    value={formData.projectScope}
                    onChange={handleInputChange}
                    className="w-full text-xs h-10 border border-neutral-250 rounded-full px-4 bg-white text-neutral-800 cursor-pointer hover:border-neutral-350 focus:outline-hidden focus:border-neutral-400 transition-colors"
                  >
                    <option value="custom-sections">Convert ScrollPop into custom Shopify Theme Sections</option>
                    <option value="wp-blocks">Write reusable WordPress Gutenberg block patterns</option>
                    <option value="speed-optimization">Audit-review page speed & repair layout shift offsets</option>
                    <option value="bespoke-commission">Commission bespoke layout design (High-End Design Study)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-600 font-bold">Message</label>
                  <textarea
                    rows={4}
                    name="briefMessage"
                    placeholder="Tell us what you need — install help, billing question, feature request, or anything else..."
                    value={formData.briefMessage}
                    onChange={handleInputChange}
                    className="w-full text-xs border border-neutral-250 p-4 rounded-3xl bg-white text-neutral-800 placeholder-neutral-400 hover:border-neutral-350 focus:outline-hidden focus:border-neutral-400 transition-colors resize-none leading-relaxed"
                  />
                </div>

                {errorMsg && (
                  <p className="text-xs text-red-600 font-medium text-center -mt-2">{errorMsg}</p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="h-11 w-full bg-neutral-950 text-white hover:bg-neutral-850 transition-colors font-mono text-xs uppercase tracking-wider rounded-full font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md active:scale-98 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span>{submitting ? 'Sending…' : 'Send Enquiry'}</span> <Send className="h-3.5 w-3.5" />
                </button>
              </motion.form>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-12 flex flex-col items-center justify-center gap-6"
              >
                <div className="h-14 w-14 rounded-full bg-neutral-950 text-white flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-neutral-200" />
                </div>
                <div>
                  <h3 className="font-serif text-2xl font-normal text-neutral-900">Thanks, {formData.name}!</h3>
                  <p className="text-neutral-600 text-sm mt-1 max-w-md mx-auto font-light leading-relaxed">
                    Your enquiry is on its way to our team — we’ll reply within one business day. Prefer email? Reach us any time at{' '}
                    <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#C05621] font-medium hover:underline">{CONTACT_EMAIL}</a>.
                  </p>
                </div>

                <button
                  onClick={() => setFormSubmitted(false)}
                  className="text-xs text-neutral-600 hover:text-neutral-950 hover:underline cursor-pointer transition-colors mt-2 block"
                >
                  ← Submit another enquiry
                </button>
              </motion.div>
            )}
          </AnimatePresence>

      </div>
    </div>
  );
}
