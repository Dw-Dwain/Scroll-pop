import { useState, ChangeEvent, FormEvent } from 'react';
import { Send, CheckCircle2, Calendar, Phone, Mail, MapPin, ArrowRight, ShieldAlert, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ContactView() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    storefrontUrl: '',
    platformType: 'shopify',
    projectScope: 'install-help',
    briefMessage: '',
  });

  const [formSubmitted, setFormSubmitted] = useState(false);
  const [selectedConsultDate, setSelectedConsultDate] = useState<string | null>(null);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.email) {
      setFormSubmitted(true);
    }
  };

  const dates = [
    { id: 'date_1', day: 'Mon', num: '01', month: 'June', time: '10:00 AM EST' },
    { id: 'date_2', day: 'Tue', num: '02', month: 'June', time: '02:30 PM EST' },
    { id: 'date_3', day: 'Wed', num: '03', month: 'June', time: '11:15 AM EST' },
    { id: 'date_4', day: 'Thu', num: '04', month: 'June', time: '04:00 PM EST' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-16 font-sans text-neutral-850">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
        
        {/* LEFT: Contact Narrative & Core Details */}
        <div className="lg:col-span-5 flex flex-col justify-between">
          <div className="flex flex-col gap-6">
            <span className="text-xs uppercase font-mono tracking-widest text-[#C05621] font-semibold block">GET IN TOUCH</span>
            <h1 className="font-serif text-4xl md:text-5xl font-normal tracking-tight leading-none text-gradient">
              Let’s build premium conversions.
            </h1>
            <p className="font-light text-neutral-600 leading-relaxed text-sm md:text-base">
              Have a highly customized headless checkout or a custom storefront theme you need audit-reviewed? Contact our core studio for direct configuration advisory, bespoke Shopify liquid structures or custom WP patterns.
            </p>

            <div className="flex flex-col gap-5 mt-4 text-sm">
              <div className="flex items-center gap-3.5 text-neutral-700">
                <Mail className="h-5 w-5 text-neutral-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-xs font-mono uppercase tracking-wider text-neutral-500">EMAIL ENQUIRIES</p>
                  <p className="text-sm font-medium text-neutral-900 mt-0.5">design-studio@scrollpop.co</p>
                </div>
              </div>

              <div className="flex items-center gap-3.5 text-neutral-700">
                <Phone className="h-5 w-5 text-neutral-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-xs font-mono uppercase tracking-wider text-neutral-500">TELEPHONE CONSULTATIONS</p>
                  <p className="text-sm font-medium text-neutral-900 mt-0.5">1-800-SCRL-POP (Mon-Fri 9AM - 5PM EST)</p>
                </div>
              </div>

              <div className="flex items-center gap-3.5 text-neutral-700">
                <MapPin className="h-5 w-5 text-neutral-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-xs font-mono uppercase tracking-wider text-neutral-500">STUDIO HEADQUARTERS</p>
                  <p className="text-sm font-medium text-neutral-900 mt-0.5">Rue de la Paix, 75002 Paris, France</p>
                </div>
              </div>
            </div>
          </div>

          {/* Secure details card */}
          <div className="p-5 border border-neutral-200 rounded-xl bg-neutral-100/50 mt-10 md:mt-0 flex gap-4 backdrop-blur-md">
            <ShieldAlert className="h-5 w-5 text-[#C05621] flex-shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-semibold text-neutral-900">Guaranteed Privacy Lock</p>
              <p className="text-neutral-600 font-light mt-0.5 leading-relaxed">
                We never share your storefront information, acquisition metrics, or custom liquid scripts with competitors. All technical briefs are signed with reciprocal NDA templates automatically.
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT: Inquiry form or Simulated Booking Widget */}
        <div className="lg:col-span-7 glass rounded-2xl overflow-hidden p-8 md:p-10 flex flex-col gap-8">
          
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
                  <h3 className="font-serif text-xl font-normal text-neutral-900">Submit Design Mission</h3>
                  <p className="text-xs text-neutral-600 mt-1 font-light">Complete this brief, and an integration architect will contact your dev team within 12 business hours.</p>
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

                <button
                  type="submit"
                  className="h-11 w-full bg-neutral-950 text-white hover:bg-neutral-850 transition-colors font-mono text-xs uppercase tracking-wider rounded-full font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md active:scale-98"
                >
                  <span>Submit Studio Inquiry</span> <Send className="h-3.5 w-3.5" />
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
                  <h3 className="font-serif text-2xl font-normal text-neutral-900">Mission Received</h3>
                  <p className="text-neutral-600 text-sm mt-1 max-w-sm mx-auto font-light leading-relaxed">
                    Thank you, {formData.name}. Your blueprint mission has been routed to our lead visual engineer under ticket ID #{Math.floor(Math.random() * 90000 + 10000)}.
                  </p>
                </div>

                {/* SIMULATED SCHEDULING INTERACTIVE CARD */}
                <div className="w-full max-w-md border border-neutral-200 rounded-3xl bg-neutral-100/40 p-6 text-left mt-6">
                  <span className="text-[9px] font-mono tracking-widest text-[#C05621] uppercase font-bold block mb-2">OPTIONAL NEXT STEP</span>
                  <h4 className="font-serif text-base font-normal text-neutral-900 flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-neutral-700" /> Book immediate tech briefing
                  </h4>
                  <p className="text-xs text-neutral-600 font-light mt-1">Select a simulated slot below with custom compiler engineers to discuss your storefront liquid attributes:</p>
                  
                  {!bookingConfirmed ? (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
                        {dates.map((d) => (
                          <button
                            type="button"
                            key={d.id}
                            onClick={() => setSelectedConsultDate(d.id)}
                            className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col gap-0.5 ${
                              selectedConsultDate === d.id 
                                ? 'bg-neutral-950 border-neutral-950 text-white shadow-md scale-105 font-medium'
                                : 'bg-white border-neutral-250 text-neutral-700 hover:border-neutral-350 hover:bg-neutral-50'
                            }`}
                          >
                            <span className={`text-[9px] font-mono uppercase tracking-wider ${selectedConsultDate === d.id ? 'text-white/80' : 'text-neutral-500'}`}>{d.day}</span>
                            <span className="text-sm font-serif font-bold">{d.num}</span>
                            <span className="text-[8px] font-mono leading-tight">{d.time.split(' ')[0]} {d.time.split(' ')[1]}</span>
                          </button>
                        ))}
                      </div>

                      {selectedConsultDate && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-4 pt-4 border-t border-neutral-200 text-center"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setBookingConfirmed(true);
                            }}
                            className="w-full h-9 bg-neutral-950 hover:bg-neutral-850 text-white transition-colors text-[10px] font-mono uppercase tracking-widest font-bold rounded-full flex items-center justify-center gap-1 cursor-pointer shadow-md"
                          >
                            Confirm Slot Selection <ArrowRight className="h-3 w-3" />
                          </button>
                        </motion.div>
                      )}
                    </>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-4 p-4 bg-emerald-50 border border-emerald-250 rounded-full text-emerald-850 text-xs font-semibold text-center flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="h-4 w-4 text-emerald-700" />
                      <span>Briefing confirmed block June {dates.find(x => x.id === selectedConsultDate)?.num}! invitation dispatched.</span>
                    </motion.div>
                  )}
                </div>

                <button
                  onClick={() => {
                    setFormSubmitted(false);
                    setBookingConfirmed(false);
                    setSelectedConsultDate(null);
                  }}
                  className="text-xs text-neutral-600 hover:text-neutral-950 hover:underline cursor-pointer transition-colors mt-4 block"
                >
                  ← Submit another custom brief
                </button>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

      </div>
    </div>
  );
}
