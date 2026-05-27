import { TemplatePreset } from '../types/campaign';

const createText = (content: string, size: string, weight: string, color: string, extraStyles: any = {}) => ({
  id: Math.random().toString(36).substring(7),
  type: 'text',
  content,
  styles: { fontSize: size, fontWeight: weight, color, textAlign: 'center', lineHeight: '1.2', ...extraStyles }
});

const createButton = (content: string, bg: string, color: string, extraStyles: any = {}) => ({
  id: Math.random().toString(36).substring(7),
  type: 'button',
  content,
  styles: { backgroundColor: bg, color, width: '100%', padding: '16px', borderRadius: '12px', fontWeight: 'bold', border: 'none', cursor: 'pointer', ...extraStyles }
});

const createImage = (url: string, height: string, extraStyles: any = {}) => ({
  id: Math.random().toString(36).substring(7),
  type: 'image',
  content: url,
  styles: { width: '100%', height, objectFit: 'cover', ...extraStyles }
});

const createTimer = (color: string) => ({
  id: Math.random().toString(36).substring(7),
  type: 'timer',
  styles: { color }
});

const createForm = (btnText: string, btnBg: string) => ({
  id: Math.random().toString(36).substring(7),
  type: 'form',
  content: btnText,
  styles: { backgroundColor: btnBg, color: '#fff' }
});

const createCoupon = (code: string) => ({
  id: Math.random().toString(36).substring(7),
  type: 'coupon',
  content: code,
  styles: {}
});

const createSpacer = (height: string) => ({
  id: Math.random().toString(36).substring(7),
  type: 'spacer',
  props: { height }
});

export const MASSIVE_TEMPLATES: TemplatePreset[] = [
  // ================= GAMIFIED & INTERACTIVE =================
  {
    id: 'gamified-spin-wheel',
    name: 'Spin-to-Win Wheel',
    kind: 'gamified_overlay',
    category: 'Gamified',
    desc: 'High-converting interactive spin wheel that captures emails in exchange for a discount.',
    thumbnail: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=400&q=80',
    tags: ['Interactive', 'Ecommerce', 'High-Converting'],
    colors: { bg: '#ffffff', text: '#111827', accent: '#ec4899' },
    fields: {
      position: 'center',
      size: 'lg',
      animation: 'zoom',
      borderRadius: 24,
      layoutMode: 'blocks',
      elements: [
        createText('SPIN TO WIN!', '32px', '900', '#111827', { textTransform: 'uppercase' }),
        createText('Enter your email for a chance to win up to 50% off.', '16px', '500', '#4b5563', { marginTop: '8px', marginBottom: '24px' }),
        { id: 'w1', type: 'wheel', styles: { margin: '0 auto' } },
        createSpacer('24px'),
        createForm('Try my luck', '#ec4899')
      ]
    }
  },
  {
    id: 'gamified-scratch-card',
    name: 'Scratch & Reveal',
    kind: 'modal',
    category: 'Gamified',
    desc: 'A scratch-card style popup that builds curiosity before revealing the discount.',
    thumbnail: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=400&q=80',
    tags: ['Curiosity', 'Sales', 'Fun'],
    colors: { bg: '#1e1b4b', text: '#ffffff', accent: '#fbbf24' },
    fields: {
      position: 'center',
      size: 'md',
      animation: 'slide_up',
      borderRadius: 16,
      layoutMode: 'blocks',
      elements: [
        createText('Uncover your mystery gift', '28px', '800', '#ffffff'),
        createSpacer('16px'),
        { id: 's1', type: 'scratch_card', styles: { width: '100%', height: '150px', backgroundColor: '#fbbf24', borderRadius: '12px' } },
        createSpacer('16px'),
        createButton('Claim Gift', '#fbbf24', '#000000')
      ]
    }
  },

  // ================= ECOMMERCE & SALES =================
  {
    id: 'ecom-abandoned-cart',
    name: 'Cart Abandonment Timer',
    kind: 'modal',
    category: 'Ecommerce',
    desc: 'Urgency-driven modal to prevent cart abandonment with a live countdown timer.',
    thumbnail: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=400&q=80',
    tags: ['Urgency', 'Cart Recovery', 'Timer'],
    colors: { bg: '#ffffff', text: '#000000', accent: '#ef4444' },
    fields: {
      position: 'center',
      size: 'md',
      animation: 'slide_down',
      borderRadius: 16,
      layoutMode: 'blocks',
      elements: [
        createText('Wait! Don\'t leave your items behind.', '24px', '800', '#000000'),
        createSpacer('12px'),
        createText('Complete your purchase in the next 15 minutes and get an extra 10% off.', '15px', '500', '#666666'),
        createTimer('#ef4444'),
        createCoupon('SAVE10NOW'),
        createSpacer('16px'),
        createButton('Checkout Now', '#ef4444', '#ffffff')
      ]
    }
  },
  {
    id: 'ecom-flash-sale-bar',
    name: 'Black Friday Top Bar',
    kind: 'bar',
    category: 'Holiday',
    desc: 'Sticky top bar for site-wide flash sale announcements.',
    thumbnail: 'https://images.unsplash.com/photo-1512411831835-23c267b2d56a?auto=format&fit=crop&w=400&q=80',
    tags: ['Bar', 'Sale', 'Minimal'],
    colors: { bg: '#000000', text: '#ffffff', accent: '#ffffff' },
    fields: {
      position: 'top',
      size: 'lg',
      animation: 'slide_down',
      borderRadius: 0,
      layoutMode: 'blocks',
      elements: [
        { id: 'b1', type: 'text', content: '🔥 BLACK FRIDAY: 50% OFF SITEWIDE + FREE SHIPPING. ENDS IN:', styles: { fontSize: '12px', fontWeight: 'bold', color: '#fff', textAlign: 'center', letterSpacing: '1px' } },
        createTimer('#ffffff')
      ]
    }
  },

  // ================= SAAS & LEAD GEN =================
  {
    id: 'saas-webinar-invite',
    name: 'Webinar Registration',
    kind: 'slide_in',
    category: 'Webinar',
    desc: 'Floating slide-in for SaaS companies to drive webinar registrations.',
    thumbnail: 'https://images.unsplash.com/photo-1432821596592-e2c18b78144f?auto=format&fit=crop&w=400&q=80',
    tags: ['B2B', 'SaaS', 'Events'],
    colors: { bg: '#ffffff', text: '#111827', accent: '#4f46e5' },
    fields: {
      position: 'bottom-right',
      size: 'sm',
      animation: 'slide_up',
      borderRadius: 16,
      layoutMode: 'blocks',
      elements: [
        createText('Free Masterclass', '12px', '800', '#4f46e5', { textTransform: 'uppercase', letterSpacing: '1px' }),
        createSpacer('8px'),
        createText('How to scale your MRR to $100k in 90 days', '20px', '700', '#111827', { textAlign: 'left' }),
        createSpacer('16px'),
        createForm('Reserve My Seat', '#4f46e5')
      ]
    }
  },
  {
    id: 'saas-beta-waitlist',
    name: 'Exclusive Beta Waitlist',
    kind: 'fullscreen',
    category: 'SaaS',
    desc: 'High-end fullscreen takeover for product launches.',
    thumbnail: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=400&q=80',
    tags: ['Launch', 'Premium', 'Fullscreen'],
    colors: { bg: '#0f172a', text: '#f8fafc', accent: '#38bdf8' },
    fields: {
      position: 'center',
      size: 'lg',
      animation: 'fade',
      borderRadius: 0,
      layoutMode: 'blocks',
      elements: [
        createSpacer('40px'),
        createText('THE FUTURE OF WORK IS HERE', '14px', '800', '#38bdf8', { textTransform: 'uppercase', letterSpacing: '3px' }),
        createSpacer('16px'),
        createText('Join the exclusive waitlist.', '48px', '900', '#ffffff', { lineHeight: '1.1' }),
        createSpacer('32px'),
        createForm('Join Waitlist', '#38bdf8')
      ]
    }
  },

  // ================= MODERN / LUXURY =================
  {
    id: 'luxury-newsletter',
    name: 'Editorial Newsletter',
    kind: 'modal',
    category: 'Lead Capture',
    desc: 'Minimalist, high-fashion editorial style newsletter capture.',
    thumbnail: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=400&q=80',
    tags: ['Luxury', 'Fashion', 'Minimal'],
    colors: { bg: '#ffffff', text: '#000000', accent: '#000000' },
    fields: {
      position: 'center',
      size: 'md',
      animation: 'fade',
      borderRadius: 0, // Sharp edges for luxury
      layoutMode: 'blocks',
      elements: [
        createImage('https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=80', '200px'),
        createSpacer('24px'),
        createText('THE EDIT', '20px', '400', '#000000', { letterSpacing: '4px' }),
        createSpacer('12px'),
        createText('Curated styles delivered to your inbox weekly.', '14px', '300', '#333333'),
        createSpacer('24px'),
        createForm('Subscribe', '#000000')
      ]
    }
  },
  
  // ================= BUBBLES & TOASTS =================
  {
    id: 'social-proof-toast',
    name: 'Recent Purchase Toast',
    kind: 'notification_toast',
    category: 'Sales',
    desc: 'Small floating notification simulating social proof (e.g. "John from NY just bought...").',
    thumbnail: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=400&q=80',
    tags: ['Social Proof', 'FOMO', 'Small'],
    colors: { bg: '#ffffff', text: '#111827', accent: '#10b981' },
    fields: {
      position: 'bottom-left',
      size: 'sm',
      animation: 'slide_up',
      borderRadius: 12,
      layoutMode: 'blocks',
      elements: [
        { id: 't1', type: 'text', content: 'Sarah from Texas just purchased', styles: { fontSize: '11px', color: '#6b7280', textAlign: 'left' } },
        { id: 't2', type: 'text', content: 'Premium Leather Tote Bag', styles: { fontSize: '14px', fontWeight: 'bold', color: '#111827', textAlign: 'left' } },
        { id: 't3', type: 'text', content: '2 minutes ago', styles: { fontSize: '10px', color: '#10b981', textAlign: 'left', marginTop: '4px' } }
      ]
    }
  },
  {
    id: 'events-seasonal-1',
    name: 'Holiday Special',
    kind: 'modal',
    category: 'Ecommerce',
    desc: 'Festive popup for seasonal sales and events.',
    thumbnail: 'https://images.unsplash.com/photo-1512411831835-23c267b2d56a?auto=format&fit=crop&w=400&q=80',
    tags: ['Events', 'Seasonal', 'Ecommerce'],
    colors: { bg: '#b91c1c', text: '#ffffff', accent: '#facc15' },
    fields: {
      position: 'center', size: 'lg', animation: 'zoom', borderRadius: 16, layoutMode: 'blocks',
      elements: [
        createText('🎄 Holiday Super Sale!', '32px', '800', '#ffffff'),
        createText('Unwrap our biggest discounts of the year.', '18px', 'normal', '#fca5a5'),
        createTimer('#ffffff'),
        createButton('Shop the Sale', '#facc15', '#b91c1c')
      ]
    }
  },
  {
    id: 'mail-popup-1',
    name: 'Classic Mail Popup',
    kind: 'modal',
    category: 'Lead Capture',
    desc: 'The most flexible way to grow your email list.',
    thumbnail: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=400&q=80',
    tags: ['Mail', 'Newsletter', 'Grow email list'],
    colors: { bg: '#ffffff', text: '#111827', accent: '#4f46e5' },
    fields: {
      position: 'center', size: 'md', animation: 'fade', borderRadius: 12, layoutMode: 'blocks',
      elements: [
        createText('Join our Newsletter', '24px', 'bold', '#111827'),
        createText('Get the best tips and tricks straight to your inbox.', '16px', 'normal', '#6b7280'),
        createForm('Subscribe', '#4f46e5')
      ]
    }
  },
  {
    id: 'mail-slidein-1',
    name: 'Subtle Mail Slide-in',
    kind: 'slide_in',
    category: 'Lead Capture',
    desc: 'Capture emails without blocking the whole UI.',
    thumbnail: 'https://images.unsplash.com/photo-1432821596592-e2c18b78144f?auto=format&fit=crop&w=400&q=80',
    tags: ['Mail slide-in', 'Subtle', 'Newsletter'],
    colors: { bg: '#ffffff', text: '#111827', accent: '#000000' },
    fields: {
      position: 'bottom-right', size: 'sm', animation: 'slide_up', borderRadius: 12, layoutMode: 'blocks',
      elements: [
        createText('Stay Updated', '20px', 'bold', '#111827'),
        createForm('Join', '#000000')
      ]
    }
  },
  {
    id: 'abandonment-saver-1',
    name: 'Cart Saver',
    kind: 'modal',
    category: 'Ecommerce',
    desc: 'Catch 65% of abandoning shoppers with a discount.',
    thumbnail: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=400&q=80',
    tags: ['Abandonment saver', 'Discount', 'Exit intent'],
    colors: { bg: '#ffffff', text: '#000000', accent: '#ef4444' },
    fields: {
      position: 'center', size: 'md', animation: 'zoom', borderRadius: 12, layoutMode: 'blocks',
      elements: [
        createText('Wait! Don\'t leave empty handed.', '28px', 'bold', '#000000'),
        createText('Complete your purchase now and get 15% off.', '16px', 'normal', '#4b5563'),
        createCoupon('SAVE15NOW'),
        createButton('Complete Purchase', '#ef4444', '#ffffff')
      ]
    }
  },
  {
    id: 'notification-1',
    name: 'Announcement Toast',
    kind: 'notification_toast',
    category: 'SaaS',
    desc: 'Notify customers of sales, blog posts, or hours changes.',
    thumbnail: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=400&q=80',
    tags: ['Notification', 'Updates', 'Improve usability'],
    colors: { bg: '#111827', text: '#ffffff', accent: '#3b82f6' },
    fields: {
      position: 'top', size: 'sm', animation: 'slide_down', borderRadius: 8, layoutMode: 'blocks',
      elements: [
        createText('New Feature Alert 🚀', '16px', 'bold', '#ffffff', { textAlign: 'left' }),
        createText('Check out our latest update right now.', '14px', 'normal', '#9ca3af', { textAlign: 'left' })
      ]
    }
  },
  {
    id: 'free-shipping-1',
    name: 'Free Shipping Unlock',
    kind: 'floating_bubble',
    category: 'Ecommerce',
    desc: 'Increase AOV by notifying customers of free shipping limits.',
    thumbnail: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=400&q=80',
    tags: ['Free shipping', 'AOV', 'Upsell'],
    colors: { bg: '#10b981', text: '#ffffff', accent: '#ffffff' },
    fields: {
      position: 'bottom-left', size: 'sm', animation: 'slide_up', borderRadius: 30, layoutMode: 'blocks',
      elements: [
        createText('🎉 You are $15 away from FREE shipping!', '14px', 'bold', '#ffffff')
      ]
    }
  },
  {
    id: 'single-image-1',
    name: 'Full Image Banner',
    kind: 'fullscreen',
    category: 'Ecommerce',
    desc: 'Bypass builder text and upload a single responsive image.',
    thumbnail: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=400&q=80',
    tags: ['Single image', 'Banner', 'Full customization'],
    colors: { bg: 'transparent', text: '#ffffff', accent: '#000000' },
    fields: {
      position: 'center', size: 'lg', animation: 'fade', borderRadius: 0, layoutMode: 'blocks',
      elements: [
        createImage('https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=800&q=80', '100%')
      ]
    }
  },
  {
    id: 'cross-sell-1',
    name: 'Product Cross-sell',
    kind: 'slide_in',
    category: 'Ecommerce',
    desc: 'Increase AOV by introducing related products on product pages.',
    thumbnail: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=400&q=80',
    tags: ['Cross sell', 'AOV', 'Products'],
    colors: { bg: '#ffffff', text: '#111827', accent: '#000000' },
    fields: {
      position: 'bottom-right', size: 'md', animation: 'slide_up', borderRadius: 12, layoutMode: 'blocks',
      elements: [
        createText('Frequently Bought Together', '18px', 'bold', '#111827'),
        createImage('https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=400&q=80', '150px'),
        createText('Premium Wireless Headphones - $99', '14px', 'normal', '#4b5563'),
        createButton('Add to Cart', '#111827', '#ffffff')
      ]
    }
  }
];

// Replicate variants to hit 30+ items for a massive marketplace feel
const baseTemplates = [...MASSIVE_TEMPLATES];
for (let i = 0; i < 25; i++) {
  const clone = JSON.parse(JSON.stringify(baseTemplates[i % baseTemplates.length]));
  clone.id = `variant-${i}`;
  clone.name = `${clone.name} Variant ${i+1}`;
  clone.category = i % 2 === 0 ? 'Ecommerce' : 'Lead Capture';
  MASSIVE_TEMPLATES.push(clone);
}
