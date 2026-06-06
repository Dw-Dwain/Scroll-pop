import type React from 'react';
import { TemplatePreset } from '../types/campaign';

const createText = (content: string, size: string, weight: string, color: string, extraStyles: React.CSSProperties = {}) => ({
  id: Math.random().toString(36).substring(7),
  type: 'text',
  content,
  styles: { fontSize: size, fontWeight: weight, color, textAlign: 'center', lineHeight: '1.2', ...extraStyles } as Record<string, string>,
});

const createButton = (content: string, bg: string, color: string, extraStyles: React.CSSProperties = {}) => ({
  id: Math.random().toString(36).substring(7),
  type: 'button',
  content,
  styles: { backgroundColor: bg, color, width: '100%', padding: '16px', borderRadius: '12px', fontWeight: 'bold', border: 'none', cursor: 'pointer', ...extraStyles } as Record<string, string>,
});

const createImage = (url: string, height: string, extraStyles: React.CSSProperties = {}) => ({
  id: Math.random().toString(36).substring(7),
  type: 'image',
  content: url,
  styles: { width: '100%', height, objectFit: 'cover', ...extraStyles } as Record<string, string>,
});

const createTimer = (color: string) => ({
  id: Math.random().toString(36).substring(7),
  type: 'timer',
  styles: { color } as Record<string, string>,
});

const createForm = (btnText: string, btnBg: string) => ({
  id: Math.random().toString(36).substring(7),
  type: 'form',
  content: btnText,
  styles: { backgroundColor: btnBg, color: '#fff' } as Record<string, string>,
});

const createCoupon = (code: string) => ({
  id: Math.random().toString(36).substring(7),
  type: 'coupon',
  content: code,
  styles: {} as Record<string, string>,
});

const createSpacer = (height: string) => ({
  id: Math.random().toString(36).substring(7),
  type: 'spacer',
  props: { height }
});

export const MASSIVE_TEMPLATES: TemplatePreset[] = [

  // ================= WELCOME POPUPS =================
  {
    id: 'welcome-round-clean',
    name: 'Round Welcome — Clean',
    kind: 'modal',
    category: 'Welcome',
    desc: 'Simple welcome popup with a single CTA and highlighted first-order offer. Best triggered after 10–15 seconds.',
    thumbnail: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=400&q=80',
    tags: ['Welcome', 'First Visit', 'Coupon', 'New Visitor'],
    colors: { bg: '#ffffff', text: '#111827', accent: '#6366f1' },
    fields: {
      position: 'center', size: 'md', animation: 'zoom', borderRadius: 24, layoutMode: 'blocks',
      elements: [
        createText('Welcome! 👋', '32px', '800', '#111827'),
        createSpacer('8px'),
        createText('Get 10% off your first order', '20px', '600', '#6366f1'),
        createSpacer('8px'),
        createText('Sign up and we\'ll send you an exclusive coupon right away.', '14px', '400', '#6b7280'),
        createSpacer('16px'),
        createCoupon('WELCOME10'),
        createSpacer('16px'),
        createForm('Claim My 10% Off', '#6366f1'),
      ]
    }
  },
  {
    id: 'welcome-high-contrast',
    name: 'High Contrast Welcome',
    kind: 'modal',
    category: 'Welcome',
    desc: 'Two-column high-contrast welcome popup with bold offer messaging and email capture.',
    thumbnail: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?auto=format&fit=crop&w=400&q=80',
    tags: ['Welcome', 'High Contrast', 'Two Column', 'New Visitor'],
    colors: { bg: '#0f172a', text: '#ffffff', accent: '#f59e0b' },
    fields: {
      position: 'center', size: 'lg', animation: 'slide_up', borderRadius: 16, layoutMode: 'blocks',
      elements: [
        createImage('https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?auto=format&fit=crop&w=800&q=80', '160px'),
        createSpacer('20px'),
        createText('WELCOME OFFER', '12px', '800', '#f59e0b', { letterSpacing: '3px', textTransform: 'uppercase' }),
        createSpacer('8px'),
        createText('15% Off Your First Purchase', '30px', '900', '#ffffff', { lineHeight: '1.1' }),
        createSpacer('8px'),
        createText('Join thousands of happy customers. Unsubscribe any time.', '13px', '400', '#94a3b8'),
        createSpacer('20px'),
        createForm('Get My 15% Discount', '#f59e0b'),
      ]
    }
  },
  {
    id: 'welcome-first-order',
    name: 'First Order Offer',
    kind: 'modal',
    category: 'Welcome',
    desc: 'Email capture with coupon reveal on first visit. Ideal for ecommerce stores.',
    thumbnail: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=400&q=80',
    tags: ['Welcome', 'First Order', 'Email Capture', 'Coupon'],
    colors: { bg: '#fff7ed', text: '#7c2d12', accent: '#ea580c' },
    fields: {
      position: 'center', size: 'md', animation: 'fade', borderRadius: 20, layoutMode: 'blocks',
      elements: [
        createText('🎁', '48px', '400', '#ea580c'),
        createSpacer('8px'),
        createText('A gift for you!', '28px', '800', '#7c2d12'),
        createText('Sign up and unlock 20% off your first order.', '15px', '400', '#9a3412'),
        createSpacer('16px'),
        createForm('Unlock My 20% Off', '#ea580c'),
        createSpacer('8px'),
        createText('No spam. Unsubscribe any time.', '11px', '400', '#c2410c'),
      ]
    }
  },
  {
    id: 'welcome-free-shipping',
    name: 'Welcome + Free Shipping',
    kind: 'modal',
    category: 'Welcome',
    desc: 'Welcome new visitors with free shipping on their first order — a proven conversion driver.',
    thumbnail: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=400&q=80',
    tags: ['Welcome', 'Free Shipping', 'First Visit', 'Ecommerce'],
    colors: { bg: '#f0fdf4', text: '#14532d', accent: '#16a34a' },
    fields: {
      position: 'center', size: 'md', animation: 'slide_up', borderRadius: 16, layoutMode: 'blocks',
      elements: [
        createText('🚚', '44px', '400', '#16a34a'),
        createSpacer('8px'),
        createText('Free Shipping On Your First Order', '26px', '800', '#14532d', { lineHeight: '1.2' }),
        createText('No minimum spend. Sign up and get your free shipping code instantly.', '14px', '400', '#166534'),
        createSpacer('20px'),
        createForm('Send Me The Code', '#16a34a'),
      ]
    }
  },
  {
    id: 'welcome-minimal-slide',
    name: 'Minimal Welcome Slide-in',
    kind: 'slide_in',
    category: 'Welcome',
    desc: 'Non-intrusive slide-in welcome offer that doesn\'t block the page. Perfect for subtle first impressions.',
    thumbnail: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=400&q=80',
    tags: ['Welcome', 'Minimal', 'Slide-in', 'Non-intrusive'],
    colors: { bg: '#ffffff', text: '#111827', accent: '#8b5cf6' },
    fields: {
      position: 'bottom-right', size: 'sm', animation: 'slide_up', borderRadius: 16, layoutMode: 'blocks',
      elements: [
        createText('First time here? 👀', '18px', '700', '#111827', { textAlign: 'left' }),
        createSpacer('4px'),
        createText('Use code HELLO10 for 10% off.', '13px', '400', '#6b7280', { textAlign: 'left' }),
        createSpacer('12px'),
        createForm('Claim Offer', '#8b5cf6'),
      ]
    }
  },

  // ================= UPSELL & CROSS-SELL =================
  {
    id: 'upsell-quantity',
    name: 'Buy More, Save More',
    kind: 'modal',
    category: 'Upsell',
    desc: 'Upsell popup triggered after a product is added to cart — buy more of the same product at a discount.',
    thumbnail: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=400&q=80',
    tags: ['Upsell', 'AOV', 'Quantity', 'Cart'],
    colors: { bg: '#ffffff', text: '#111827', accent: '#2563eb' },
    fields: {
      position: 'center', size: 'md', animation: 'zoom', borderRadius: 16, layoutMode: 'blocks',
      elements: [
        createText('💡 Quick Tip', '13px', '700', '#2563eb', { textTransform: 'uppercase', letterSpacing: '1px' }),
        createSpacer('8px'),
        createText('Buy 2 and save an extra 20%', '26px', '800', '#111827'),
        createText('Customers who buy 2+ save an average of $14. Add one more to unlock the deal.', '14px', '400', '#6b7280'),
        createSpacer('16px'),
        createButton('Add Another & Save 20%', '#2563eb', '#ffffff'),
        createSpacer('8px'),
        createText('No thanks, I\'ll pay full price', '12px', '400', '#9ca3af'),
      ]
    }
  },
  {
    id: 'upsell-upgrade',
    name: 'Upgrade Upsell',
    kind: 'slide_in',
    category: 'Upsell',
    desc: 'Suggest a premium version of the item already in the cart for a small price bump.',
    thumbnail: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=400&q=80',
    tags: ['Upsell', 'Premium', 'Upgrade', 'Cart'],
    colors: { bg: '#1e1b4b', text: '#ffffff', accent: '#a855f7' },
    fields: {
      position: 'bottom-right', size: 'md', animation: 'slide_up', borderRadius: 16, layoutMode: 'blocks',
      elements: [
        createText('✨ Upgrade Available', '13px', '700', '#a855f7', { textTransform: 'uppercase' }),
        createSpacer('8px'),
        createText('Switch to Pro for just $10 more', '20px', '700', '#ffffff'),
        createImage('https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=400&q=80', '100px', { borderRadius: '8px' }),
        createText('⭐⭐⭐⭐⭐  4.9 rating — our most popular option.', '12px', '400', '#c4b5fd'),
        createSpacer('12px'),
        createButton('Upgrade For $10 More', '#a855f7', '#ffffff'),
      ]
    }
  },
  {
    id: 'crosssell-bundle',
    name: 'Bundle & Complete the Look',
    kind: 'modal',
    category: 'Cross-Sell',
    desc: 'Complete-the-look cross-sell popup triggered after add-to-cart.',
    thumbnail: 'https://images.unsplash.com/photo-1526947425960-945c6e72858f?auto=format&fit=crop&w=400&q=80',
    tags: ['Cross-Sell', 'Bundle', 'Complete the Look', 'AOV'],
    colors: { bg: '#ffffff', text: '#111827', accent: '#111827' },
    fields: {
      position: 'center', size: 'md', animation: 'slide_up', borderRadius: 12, layoutMode: 'blocks',
      elements: [
        createText('Customers also bought', '14px', '600', '#6b7280', { textTransform: 'uppercase', letterSpacing: '1px' }),
        createSpacer('12px'),
        createImage('https://images.unsplash.com/photo-1526947425960-945c6e72858f?auto=format&fit=crop&w=400&q=80', '140px', { borderRadius: '8px' }),
        createText('Matching Accessories Kit — $29', '16px', '700', '#111827'),
        createText('Pairs perfectly with your selection. Rated 4.8 stars.', '13px', '400', '#6b7280'),
        createSpacer('12px'),
        createButton('Add to Cart — $29', '#111827', '#ffffff'),
        createText('No thanks', '12px', '400', '#9ca3af'),
      ]
    }
  },
  {
    id: 'crosssell-free-gift',
    name: 'Free Gift With Purchase',
    kind: 'modal',
    category: 'Cross-Sell',
    desc: 'Increase cart value by showing a free gift threshold popup.',
    thumbnail: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=400&q=80',
    tags: ['Cross-Sell', 'Free Gift', 'Threshold', 'AOV'],
    colors: { bg: '#fdf4ff', text: '#581c87', accent: '#9333ea' },
    fields: {
      position: 'center', size: 'md', animation: 'zoom', borderRadius: 20, layoutMode: 'blocks',
      elements: [
        createText('🎁 Free Gift Unlocked!', '28px', '800', '#581c87'),
        createText('Spend $75+ today and receive a free gift at checkout.', '15px', '400', '#6b21a8'),
        createSpacer('8px'),
        createText('You\'re only $15 away from qualifying!', '16px', '700', '#9333ea'),
        createSpacer('16px'),
        createButton('Add $15 More To Qualify', '#9333ea', '#ffffff'),
        createText('Proceed without gift', '12px', '400', '#9ca3af'),
      ]
    }
  },

  // ================= EXIT INTENT =================
  {
    id: 'exit-last-chance-coupon',
    name: 'Exit — Last Chance Coupon',
    kind: 'modal',
    category: 'Exit Intent',
    desc: 'Final offer before a visitor leaves — high-value coupon to bring them back to checkout.',
    thumbnail: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=400&q=80',
    tags: ['Exit Intent', 'Last Chance', 'Coupon', 'Recovery'],
    colors: { bg: '#ffffff', text: '#111827', accent: '#dc2626' },
    fields: {
      position: 'center', size: 'md', animation: 'fade', borderRadius: 16, layoutMode: 'blocks',
      elements: [
        createText('⏳ Wait! Don\'t miss out', '28px', '800', '#111827'),
        createSpacer('8px'),
        createText('We don\'t do this often — but here\'s 20% off just for you.', '15px', '400', '#6b7280'),
        createSpacer('12px'),
        createCoupon('LASTCHANCE20'),
        createTimer('#dc2626'),
        createSpacer('16px'),
        createForm('Claim 20% Off Now', '#dc2626'),
        createText('No thanks, I prefer full price', '12px', '400', '#9ca3af'),
      ]
    }
  },
  {
    id: 'exit-cart-recovery',
    name: 'Exit — Cart Recovery',
    kind: 'modal',
    category: 'Exit Intent',
    desc: 'Triggered when a visitor leaves the cart page. Discount + urgency to close the sale.',
    thumbnail: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=400&q=80',
    tags: ['Exit Intent', 'Cart Recovery', 'Urgency', 'Ecommerce'],
    colors: { bg: '#0f172a', text: '#ffffff', accent: '#f59e0b' },
    fields: {
      position: 'center', size: 'md', animation: 'slide_up', borderRadius: 16, layoutMode: 'blocks',
      elements: [
        createText('🛒 Your cart is about to expire', '24px', '800', '#ffffff'),
        createText('Items sell out fast. Complete your order in the next 10 minutes.', '14px', '400', '#94a3b8'),
        createTimer('#f59e0b'),
        createSpacer('12px'),
        createButton('Complete My Order', '#f59e0b', '#0f172a'),
        createText('Forget my cart', '12px', '400', '#475569'),
      ]
    }
  },
  {
    id: 'exit-browse-abandon',
    name: 'Exit — Browse Recovery',
    kind: 'modal',
    category: 'Exit Intent',
    desc: 'Re-engage visitors who are browsing but haven\'t added anything to cart yet.',
    thumbnail: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?auto=format&fit=crop&w=400&q=80',
    tags: ['Exit Intent', 'Browse Abandon', 'Email Capture', 'Recovery'],
    colors: { bg: '#ffffff', text: '#111827', accent: '#0ea5e9' },
    fields: {
      position: 'center', size: 'md', animation: 'fade', borderRadius: 16, layoutMode: 'blocks',
      elements: [
        createText('Still looking? Let us help 👇', '26px', '700', '#111827'),
        createText('Sign up and we\'ll send you our best deals + a first-order discount.', '14px', '400', '#6b7280'),
        createSpacer('16px'),
        createForm('Show Me The Best Deals', '#0ea5e9'),
        createText('No thanks', '12px', '400', '#9ca3af'),
      ]
    }
  },
  {
    id: 'exit-saas-demo',
    name: 'Exit — Book a Demo',
    kind: 'modal',
    category: 'Exit Intent',
    desc: 'Capture B2B leads leaving without converting by offering a personalised demo.',
    thumbnail: 'https://images.unsplash.com/photo-1432821596592-e2c18b78144f?auto=format&fit=crop&w=400&q=80',
    tags: ['Exit Intent', 'SaaS', 'Demo', 'B2B'],
    colors: { bg: '#ffffff', text: '#111827', accent: '#4f46e5' },
    fields: {
      position: 'center', size: 'md', animation: 'fade', borderRadius: 16, layoutMode: 'blocks',
      elements: [
        createText('Before you go...', '28px', '800', '#111827'),
        createText('See ScrollPop in action with a personalised 15-minute demo. We\'ll show you exactly how to boost conversions.', '14px', '400', '#6b7280'),
        createSpacer('16px'),
        createForm('Book My Free Demo', '#4f46e5'),
        createText('No thanks, I\'ll figure it out', '12px', '400', '#9ca3af'),
      ]
    }
  },

  // ================= SALES & PROMOTIONS =================
  {
    id: 'promo-flash-sale',
    name: 'Flash Sale — Countdown',
    kind: 'modal',
    category: 'Sale & Promotions',
    desc: 'Urgency-driven flash sale popup with countdown timer. Great for time-limited offers.',
    thumbnail: 'https://images.unsplash.com/photo-1512411831835-23c267b2d56a?auto=format&fit=crop&w=400&q=80',
    tags: ['Sale', 'Flash Sale', 'Countdown', 'Urgency'],
    colors: { bg: '#7f1d1d', text: '#ffffff', accent: '#fbbf24' },
    fields: {
      position: 'center', size: 'md', animation: 'zoom', borderRadius: 16, layoutMode: 'blocks',
      elements: [
        createText('⚡ FLASH SALE', '13px', '800', '#fbbf24', { letterSpacing: '3px' }),
        createSpacer('8px'),
        createText('40% Off Everything', '36px', '900', '#ffffff', { lineHeight: '1.1' }),
        createText('Ends tonight at midnight. Don\'t miss it.', '14px', '400', '#fca5a5'),
        createTimer('#fbbf24'),
        createSpacer('8px'),
        createButton('Shop The Flash Sale', '#fbbf24', '#7f1d1d'),
      ]
    }
  },
  {
    id: 'promo-discount-bar',
    name: 'Promo Announcement Bar',
    kind: 'bar',
    category: 'Sale & Promotions',
    desc: 'Persistent top or bottom bar announcing current sales without blocking content.',
    thumbnail: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=400&q=80',
    tags: ['Bar', 'Announcement', 'Sale', 'Minimal'],
    colors: { bg: '#6366f1', text: '#ffffff', accent: '#ffffff' },
    fields: {
      position: 'top-center', size: 'lg', animation: 'slide_down', borderRadius: 0, layoutMode: 'blocks',
      elements: [
        createText('🎉  SUMMER SALE — 30% off all orders with code SUMMER30  |  Free shipping over $50', '13px', '600', '#ffffff'),
      ]
    }
  },
  {
    id: 'promo-seasonal-holiday',
    name: 'Christmas Sale',
    kind: 'modal',
    category: 'Sale & Promotions',
    desc: 'Festive holiday sale popup with coupon reveal.',
    thumbnail: 'https://images.unsplash.com/photo-1512411831835-23c267b2d56a?auto=format&fit=crop&w=400&q=80',
    tags: ['Sale', 'Christmas', 'Holiday', 'Seasonal'],
    colors: { bg: '#14532d', text: '#ffffff', accent: '#fbbf24' },
    fields: {
      position: 'center', size: 'md', animation: 'zoom', borderRadius: 20, layoutMode: 'blocks',
      elements: [
        createText('🎄', '56px', '400', '#fbbf24'),
        createText('Merry Christmas! 🎁', '28px', '800', '#ffffff'),
        createText('Here\'s a special gift from us to you.', '15px', '400', '#bbf7d0'),
        createSpacer('12px'),
        createCoupon('XMAS25'),
        createSpacer('12px'),
        createButton('Unwrap My 25% Off', '#fbbf24', '#14532d'),
      ]
    }
  },
  {
    id: 'promo-black-friday',
    name: 'Black Friday Blowout',
    kind: 'modal',
    category: 'Sale & Promotions',
    desc: 'High-impact Black Friday popup. Maximum contrast, maximum urgency.',
    thumbnail: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=400&q=80',
    tags: ['Black Friday', 'Sale', 'Urgency', 'Holiday'],
    colors: { bg: '#000000', text: '#ffffff', accent: '#eab308' },
    fields: {
      position: 'center', size: 'lg', animation: 'fade', borderRadius: 8, layoutMode: 'blocks',
      elements: [
        createText('BLACK FRIDAY', '40px', '900', '#eab308', { letterSpacing: '4px' }),
        createText('50% OFF', '72px', '900', '#ffffff', { lineHeight: '1' }),
        createText('SITEWIDE', '24px', '700', '#eab308', { letterSpacing: '6px' }),
        createSpacer('8px'),
        createText('Biggest sale of the year. Ends Sunday.', '14px', '400', '#a1a1aa'),
        createTimer('#eab308'),
        createSpacer('8px'),
        createButton('Shop Black Friday', '#eab308', '#000000'),
      ]
    }
  },
  {
    id: 'promo-valentine',
    name: 'Valentine\'s Day Sale',
    kind: 'modal',
    category: 'Sale & Promotions',
    desc: 'Romantic Valentine\'s Day offer popup.',
    thumbnail: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=400&q=80',
    tags: ['Valentine\'s Day', 'Sale', 'Holiday', 'Seasonal'],
    colors: { bg: '#fff1f2', text: '#881337', accent: '#e11d48' },
    fields: {
      position: 'center', size: 'md', animation: 'zoom', borderRadius: 24, layoutMode: 'blocks',
      elements: [
        createText('💝', '52px', '400', '#e11d48'),
        createText('Happy Valentine\'s Day', '28px', '800', '#881337'),
        createText('Share the love — 20% off gifts for the ones that matter.', '15px', '400', '#9f1239'),
        createSpacer('12px'),
        createCoupon('LOVE20'),
        createSpacer('12px'),
        createButton('Shop Valentine\'s Gifts', '#e11d48', '#ffffff'),
      ]
    }
  },

  // ================= EMAIL CAPTURE =================
  {
    id: 'email-lightbox-offer',
    name: 'Lightbox Email Offer',
    kind: 'modal',
    category: 'Email Capture',
    desc: 'Classic lightbox email popup — clear CTA, coupon incentive, minimal fields.',
    thumbnail: 'https://images.unsplash.com/photo-1432821596592-e2c18b78144f?auto=format&fit=crop&w=400&q=80',
    tags: ['Email', 'Lead Gen', 'Lightbox', 'Coupon'],
    colors: { bg: '#ffffff', text: '#111827', accent: '#059669' },
    fields: {
      position: 'center', size: 'md', animation: 'fade', borderRadius: 16, layoutMode: 'blocks',
      elements: [
        createText('Get 15% Off Your First Order', '26px', '800', '#111827'),
        createText('Drop your email and we\'ll send your discount code instantly. No spam, ever.', '14px', '400', '#6b7280'),
        createSpacer('16px'),
        createForm('Get My 15% Off', '#059669'),
        createSpacer('8px'),
        createText('🔒 We respect your privacy. Unsubscribe any time.', '11px', '400', '#9ca3af'),
      ]
    }
  },
  {
    id: 'email-course-lead',
    name: 'Free Course Lead Capture',
    kind: 'modal',
    category: 'Email Capture',
    desc: 'Capture emails by offering a free course or downloadable guide as the incentive.',
    thumbnail: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=400&q=80',
    tags: ['Email', 'Lead Gen', 'Free Course', 'Value'],
    colors: { bg: '#eff6ff', text: '#1e3a5f', accent: '#2563eb' },
    fields: {
      position: 'center', size: 'md', animation: 'slide_up', borderRadius: 16, layoutMode: 'blocks',
      elements: [
        createText('📚 Free Course', '13px', '700', '#2563eb', { textTransform: 'uppercase', letterSpacing: '2px' }),
        createSpacer('8px'),
        createText('Learn How To Double Your Conversion Rate', '24px', '800', '#1e3a5f', { lineHeight: '1.2' }),
        createText('Join 12,000+ marketers. Get instant access to the free 5-day email course.', '14px', '400', '#3b5998'),
        createSpacer('16px'),
        createForm('Send Me The Free Course', '#2563eb'),
        createText('Instant access. No credit card required.', '11px', '400', '#9ca3af'),
      ]
    }
  },
  {
    id: 'email-nanobar',
    name: 'Email Nanobar',
    kind: 'bar',
    category: 'Email Capture',
    desc: 'Persistent floating bar for email capture — least intrusive, always visible.',
    thumbnail: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=400&q=80',
    tags: ['Email', 'Nanobar', 'Bar', 'Minimal', 'Persistent'],
    colors: { bg: '#111827', text: '#ffffff', accent: '#6366f1' },
    fields: {
      position: 'bottom-center', size: 'lg', animation: 'slide_up', borderRadius: 0, layoutMode: 'blocks',
      elements: [
        createText('📧  Join 5,000+ subscribers — get weekly tips & exclusive deals.', '13px', '500', '#e5e7eb'),
        createForm('Subscribe', '#6366f1'),
      ]
    }
  },
  {
    id: 'email-referral',
    name: 'Refer a Friend',
    kind: 'modal',
    category: 'Email Capture',
    desc: 'Drive referrals by giving existing customers a bonus for inviting friends.',
    thumbnail: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=400&q=80',
    tags: ['Email', 'Referral', 'Loyalty', 'Give & Get'],
    colors: { bg: '#f5f3ff', text: '#4c1d95', accent: '#7c3aed' },
    fields: {
      position: 'center', size: 'md', animation: 'zoom', borderRadius: 20, layoutMode: 'blocks',
      elements: [
        createText('Give $10 · Get $10', '32px', '900', '#4c1d95'),
        createText('Invite a friend and you both get $10 off your next order.', '15px', '400', '#5b21b6'),
        createSpacer('16px'),
        createForm('Invite a Friend', '#7c3aed'),
        createText('Your friend gets $10 off. You get $10 when they buy.', '12px', '400', '#7c3aed'),
      ]
    }
  },

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
      position: 'top-center',
      size: 'lg',
      animation: 'slide_down',
      borderRadius: 0,
      layoutMode: 'blocks',
      elements: [
        { id: 'b1', type: 'text', content: 'ðŸ”¥ BLACK FRIDAY: 50% OFF SITEWIDE + FREE SHIPPING. ENDS IN:', styles: { fontSize: '12px', fontWeight: 'bold', color: '#fff', textAlign: 'center', letterSpacing: '1px' } },
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
        createText('ðŸŽ„ Holiday Super Sale!', '32px', '800', '#ffffff'),
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
      position: 'top-center', size: 'sm', animation: 'slide_down', borderRadius: 8, layoutMode: 'blocks',
      elements: [
        createText('New Feature Alert ðŸš€', '16px', 'bold', '#ffffff', { textAlign: 'left' }),
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
        createText('ðŸŽ‰ You are $15 away from FREE shipping!', '14px', 'bold', '#ffffff')
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

// Curated themes for over 200 distinct premium customizable layouts
interface StyleTheme {
  name: string;
  bg: string;
  text: string;
  accent: string;
  borderRadius: number;
  boxShadow: string;
  fontScale: string;
}

const _PREMIUM_THEMES: StyleTheme[] = [
  { name: 'Luxury Obsidian', bg: '#0b0f19', text: '#f3f4f6', accent: '#f59e0b', borderRadius: 0, boxShadow: 'premium', fontScale: 'serif' },
  { name: 'Cyberpunk Neon', bg: '#090514', text: '#ffffff', accent: '#ec4899', borderRadius: 8, boxShadow: 'dark', fontScale: 'sans' },
  { name: 'Kawaii Pastel', bg: '#fff1f2', text: '#4c0519', accent: '#f43f5e', borderRadius: 24, boxShadow: 'soft', fontScale: 'sans' },
  { name: 'Nordic Clean', bg: '#f4f4f5', text: '#18181b', accent: '#10b981', borderRadius: 16, boxShadow: 'medium', fontScale: 'sans' },
  { name: 'Midnight Glow', bg: '#030712', text: '#f9fafb', accent: '#3b82f6', borderRadius: 12, boxShadow: 'floating', fontScale: 'sans' },
  { name: 'Autumn warmth', bg: '#fffbeb', text: '#78350f', accent: '#ea580c', borderRadius: 20, boxShadow: 'soft', fontScale: 'sans' },
  { name: 'Oceanic Pearl', bg: '#f0fdfa', text: '#115e59', accent: '#0d9488', borderRadius: 16, boxShadow: 'glass', fontScale: 'sans' },
  { name: 'Minimalist Editorial', bg: '#ffffff', text: '#000000', accent: '#000000', borderRadius: 4, boxShadow: 'none', fontScale: 'serif' },
  { name: 'Crimson Urgent', bg: '#7f1d1d', text: '#fef2f2', accent: '#facc15', borderRadius: 12, boxShadow: 'premium', fontScale: 'sans' },
  { name: 'Royal Velvet', bg: '#1e1b4b', text: '#e0e7ff', accent: '#fbbf24', borderRadius: 16, boxShadow: 'floating', fontScale: 'serif' }
];

const _TEMPLATE_CATEGORIES = ['Ecommerce', 'Lead Capture', 'Gamified', 'Holiday', 'SaaS', 'Urgency', 'Social Proof', 'Events'];
const _PREVIEW_IMAGES = [
  'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1512411831835-23c267b2d56a?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1432821596592-e2c18b78144f?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=400&q=80'
];

const _ANIMATION_TYPES = ['fade', 'slide_up', 'slide_down', 'zoom', 'none'] as const;
const _POSITION_TYPES = ['center', 'bottom-right', 'bottom-left', 'top', 'bottom'] as const;
const _SIZE_TYPES = ['sm', 'md', 'lg'] as const;
const _KIND_TYPES = ['modal', 'slide_in', 'banner', 'bar', 'fullscreen', 'floating_bubble', 'notification_toast'] as const;

// â”€â”€â”€ Open-Source Inspired Templates â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Sourced from: Magnific-Popup (MIT), css-modal (MIT), exit-intent-popup (MIT),
// modal-vanilla (MIT), freefrontend.com CSS modal patterns.
// All adapted for Shadow DOM / ScrollPop's block engine.

export const OSS_TEMPLATES: TemplatePreset[] = [

  // â”€â”€ Lightbox / Magnific-Popup style â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  {
    id: 'oss-lightbox-product-spotlight',
    name: 'Product Spotlight Lightbox',
    kind: 'modal',
    category: 'Ecommerce',
    desc: 'Dark overlay with hero product image, limited-drop badge, and single strong CTA.',
    thumbnail: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80',
    tags: ['Lightbox', 'Product', 'Dark'],
    colors: { bg: '#0d0d0d', text: '#ffffff', accent: '#f59e0b' },
    fields: {
      position: 'center', size: 'md', animation: 'zoom', borderRadius: 4,
      boxShadow: 'premium', overlayEnabled: true, overlayOpacity: 0.9,
      layoutMode: 'blocks',
      elements: [
        createImage('https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80', '200px', { borderRadius: '4px 4px 0 0', width: '100%' }),
        createSpacer('16px'),
        { id: 'l1', type: 'text', content: 'âš¡ LIMITED DROP â€” 50 PIECES ONLY', styles: { fontSize: '10px', fontWeight: '800', color: '#f59e0b', letterSpacing: '2.5px', textTransform: 'uppercase', textAlign: 'center' } },
        createSpacer('8px'),
        createText('Precision Crafted Watch', '24px', '800', '#ffffff', { lineHeight: '1.15', textAlign: 'center' }),
        createText('Free worldwide shipping Â· Ships in 24 h', '12px', '400', 'rgba(255,255,255,0.5)', { textAlign: 'center' }),
        createSpacer('16px'),
        createButton('Shop Now â€” $249', '#f59e0b', '#000000', { fontWeight: '900', letterSpacing: '0.5px' }),
        { id: 'l2', type: 'text', content: 'No thanks, I\'ll pass.', styles: { fontSize: '11px', color: 'rgba(255,255,255,0.3)', textAlign: 'center', textDecoration: 'underline', cursor: 'pointer' } },
      ]
    }
  },

  {
    id: 'oss-lightbox-fashion',
    name: 'Fashion Fullscreen Takeover',
    kind: 'fullscreen',
    category: 'Ecommerce',
    desc: 'Full-bleed background image with editorial headline and clean white CTA.',
    thumbnail: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=400&q=80',
    tags: ['Lightbox', 'Fullscreen', 'Fashion'],
    colors: { bg: 'rgba(0,0,0,0.55)', text: '#ffffff', accent: '#ffffff' },
    fields: {
      position: 'center', size: 'lg', animation: 'fade', borderRadius: 0,
      boxShadow: 'none', overlayEnabled: false, overlayOpacity: 0,
      backgroundImage: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1600&q=80',
      layoutMode: 'blocks',
      elements: [
        createSpacer('80px'),
        { id: 'f1', type: 'text', content: 'SS 2026', styles: { fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.6)', letterSpacing: '5px', textTransform: 'uppercase', textAlign: 'center' } },
        createSpacer('12px'),
        createText('The New Arrivals', '52px', '200', '#ffffff', { lineHeight: '1.0', letterSpacing: '-2px', textAlign: 'center' }),
        createSpacer('20px'),
        createButton('Explore Collection', '#ffffff', '#000000', { fontWeight: '600', letterSpacing: '1px', width: 'auto', margin: '0 auto', display: 'block', maxWidth: '200px', textAlign: 'center' }),
      ]
    }
  },

  // â”€â”€ css-modal clean splits â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  {
    id: 'oss-split-panel-signup',
    name: 'Newsletter â€” Image + Form',
    kind: 'modal',
    category: 'Lead Capture',
    desc: 'Hero image above email form. Clean white card, strong indigo CTA.',
    thumbnail: 'https://images.unsplash.com/photo-1432821596592-e2c18b78144f?auto=format&fit=crop&w=400&q=80',
    tags: ['Newsletter', 'Email', 'Clean'],
    colors: { bg: '#ffffff', text: '#111827', accent: '#4f46e5' },
    fields: {
      position: 'center', size: 'md', animation: 'elastic', borderRadius: 20,
      boxShadow: 'floating', overlayEnabled: true, overlayOpacity: 0.55,
      layoutMode: 'blocks',
      elements: [
        createImage('https://images.unsplash.com/photo-1432821596592-e2c18b78144f?auto=format&fit=crop&w=600&q=80', '160px', { borderRadius: '12px 12px 0 0', width: '100%' }),
        createSpacer('20px'),
        createText('Get the insider edge.', '24px', '800', '#111827', { lineHeight: '1.15' }),
        createText('40,000+ readers get our weekly digest. No spam. Unsubscribe any time.', '13px', '400', '#6b7280', { marginTop: '6px' }),
        createSpacer('16px'),
        createForm('Subscribe â€” It\'s Free', '#4f46e5'),
        { id: 's1', type: 'text', content: 'ðŸ”’ Your email stays private.', styles: { fontSize: '11px', color: '#9ca3af', textAlign: 'center', marginTop: '4px' } },
      ]
    }
  },

  {
    id: 'oss-dark-product-deal',
    name: 'Dark Product Deal',
    kind: 'modal',
    category: 'Ecommerce',
    desc: 'Slate-dark card with product image, accent coupon strip, and a single green CTA.',
    thumbnail: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=400&q=80',
    tags: ['Dark', 'Product', 'Coupon'],
    colors: { bg: '#111827', text: '#f9fafb', accent: '#10b981' },
    fields: {
      position: 'center', size: 'md', animation: 'slide_up', borderRadius: 16,
      boxShadow: 'dark', overlayEnabled: true, overlayOpacity: 0.75,
      layoutMode: 'blocks',
      elements: [
        createImage('https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80', '160px', { borderRadius: '10px', width: '100%' }),
        createSpacer('16px'),
        { id: 'd1', type: 'text', content: 'TODAY ONLY', styles: { fontSize: '10px', fontWeight: '900', color: '#10b981', letterSpacing: '3px', textTransform: 'uppercase' } },
        createSpacer('4px'),
        createText('40% Off Wireless Headphones', '22px', '800', '#f9fafb', { lineHeight: '1.2' }),
        createSpacer('12px'),
        createCoupon('AUDIO40'),
        createSpacer('12px'),
        createButton('Claim 40% Off', '#10b981', '#000000', { fontWeight: '900' }),
      ]
    }
  },

  {
    id: 'oss-glass-card',
    name: 'Glassmorphism Waitlist',
    kind: 'modal',
    category: 'Lead Capture',
    desc: 'Frosted glass card over a gradient background. Early-access email capture.',
    thumbnail: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=400&q=80',
    tags: ['Glass', 'Frosted', 'Waitlist'],
    colors: { bg: 'rgba(255,255,255,0.1)', text: '#ffffff', accent: '#818cf8' },
    fields: {
      position: 'center', size: 'md', animation: 'zoom', borderRadius: 24,
      boxShadow: 'glass', overlayEnabled: true, overlayOpacity: 0.25,
      backgroundImage: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1200&q=80',
      layoutMode: 'blocks',
      elements: [
        { id: 'g1', type: 'text', content: 'âœ¨ EARLY ACCESS', styles: { fontSize: '10px', fontWeight: '800', color: '#c7d2fe', letterSpacing: '2.5px', textTransform: 'uppercase', textAlign: 'center' } },
        createSpacer('10px'),
        createText('Be First In.', '32px', '900', '#ffffff', { lineHeight: '1.0', textAlign: 'center' }),
        createText('Join the waitlist â€” early members unlock exclusive pricing.', '13px', '400', 'rgba(255,255,255,0.7)', { textAlign: 'center', marginTop: '6px' }),
        createSpacer('20px'),
        createForm('Join the Waitlist', '#818cf8'),
        { id: 'g2', type: 'text', content: 'ðŸ”’ No spam. Ever.', styles: { fontSize: '11px', color: 'rgba(255,255,255,0.4)', textAlign: 'center' } },
      ]
    }
  },

  {
    id: 'oss-slide-in-offer',
    name: 'Free Shipping Slide-in',
    kind: 'slide_in',
    category: 'Ecommerce',
    desc: 'Bottom-right slide-in with product image and free-shipping unlock message.',
    thumbnail: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=400&q=80',
    tags: ['Slide-in', 'Free Shipping', 'AOV'],
    colors: { bg: '#1e293b', text: '#f1f5f9', accent: '#f97316' },
    fields: {
      position: 'bottom-right', size: 'sm', animation: 'slide_up', borderRadius: 16,
      boxShadow: 'dark', overlayEnabled: false, overlayOpacity: 0,
      layoutMode: 'blocks',
      elements: [
        createImage('https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=400&q=80', '90px', { borderRadius: '8px', width: '100%' }),
        createSpacer('12px'),
        { id: 'si1', type: 'text', content: 'ðŸ”¥ TODAY ONLY', styles: { fontSize: '10px', fontWeight: '800', color: '#f97316', letterSpacing: '2px', textTransform: 'uppercase' } },
        createSpacer('4px'),
        createText('Free Shipping over $50', '17px', '700', '#f1f5f9', { lineHeight: '1.25' }),
        createText('Add $12 more to unlock it now.', '12px', '400', '#94a3b8', { marginTop: '4px' }),
        createSpacer('12px'),
        createButton('Shop Now â†’', '#f97316', '#ffffff', { fontWeight: '800' }),
      ]
    }
  },

  // â”€â”€ Exit-intent patterns â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  {
    id: 'oss-exit-recovery-urgency',
    name: 'Exit Recovery â€” Last Chance',
    kind: 'modal',
    category: 'Ecommerce',
    desc: 'Bold red "WAIT!" modal triggered on exit intent with expiring coupon.',
    thumbnail: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=400&q=80',
    tags: ['Exit Intent', 'Recovery', 'Coupon'],
    colors: { bg: '#ffffff', text: '#111827', accent: '#dc2626' },
    fields: {
      position: 'center', size: 'md', animation: 'flip_in', borderRadius: 12,
      boxShadow: 'premium', overlayEnabled: true, overlayOpacity: 0.65,
      layoutMode: 'blocks',
      elements: [
        createText('Wait â€” one last thing.', '28px', '900', '#dc2626', { lineHeight: '1.1' }),
        createSpacer('8px'),
        createText('We saved a discount just for you. It expires when you close this window.', '14px', '400', '#4b5563'),
        createSpacer('16px'),
        createCoupon('EXIT20'),
        { id: 'e1', type: 'text', content: '20% off your entire order', styles: { fontSize: '13px', fontWeight: '600', color: '#dc2626', textAlign: 'center' } },
        createSpacer('16px'),
        createButton('Use My Discount â†’', '#dc2626', '#ffffff', { fontWeight: '900' }),
        { id: 'e2', type: 'text', content: 'No thanks, I\'ll pay full price.', styles: { fontSize: '11px', color: '#9ca3af', textAlign: 'center', textDecoration: 'underline', cursor: 'pointer' } },
      ]
    }
  },

  {
    id: 'oss-exit-cart-recovery',
    name: 'Cart Recovery â€” Time Running Out',
    kind: 'modal',
    category: 'Ecommerce',
    desc: 'Dark countdown modal for cart abandonment. Exit intent + timer urgency.',
    thumbnail: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=400&q=80',
    tags: ['Exit Intent', 'Cart', 'Timer'],
    colors: { bg: '#0f172a', text: '#f8fafc', accent: '#22d3ee' },
    fields: {
      position: 'center', size: 'md', animation: 'elastic', borderRadius: 20,
      boxShadow: 'dark', overlayEnabled: true, overlayOpacity: 0.85,
      layoutMode: 'blocks',
      elements: [
        createText('Your cart expires soon.', '24px', '800', '#f8fafc', { lineHeight: '1.15' }),
        createText('Complete now to lock in your items and get a bonus discount.', '13px', '400', '#94a3b8', { marginTop: '6px' }),
        createTimer('#22d3ee'),
        createCoupon('BACK15'),
        createSpacer('4px'),
        createButton('Complete Order â†’', '#22d3ee', '#000000', { fontWeight: '900' }),
        { id: 'c1', type: 'text', content: 'Discard my cart.', styles: { fontSize: '11px', color: 'rgba(255,255,255,0.2)', textAlign: 'center', textDecoration: 'underline', cursor: 'pointer' } },
      ]
    }
  },

  {
    id: 'oss-exit-mobile-scroll',
    name: 'Mobile Scroll-Up Bar',
    kind: 'bar',
    category: 'Lead Capture',
    desc: 'Compact bottom bar for mobile fast-upward-scroll exit detection.',
    thumbnail: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=400&q=80',
    tags: ['Mobile', 'Exit', 'Bottom Bar'],
    colors: { bg: '#1d1d1f', text: '#f5f5f7', accent: '#0071e3' },
    fields: {
      position: 'bottom-center', size: 'lg', animation: 'slide_up', borderRadius: 0,
      boxShadow: 'dark', overlayEnabled: false, overlayOpacity: 0,
      layoutMode: 'blocks',
      elements: [
        { id: 'm1', type: 'text', content: 'Before you go â€” get 15% off your first order.', styles: { fontSize: '14px', fontWeight: '700', color: '#f5f5f7', textAlign: 'center' } },
        createSpacer('10px'),
        createForm('Get 15% Off', '#0071e3'),
      ]
    }
  },

  // â”€â”€ Freefrontend visual patterns â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  {
    id: 'oss-neon-glow',
    name: 'Neon Glow â€” Gaming Deal',
    kind: 'modal',
    category: 'Gamified',
    desc: 'Cyberpunk neon dark modal with timer countdown and glowing CTA button.',
    thumbnail: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=400&q=80',
    tags: ['Neon', 'Gaming', 'Cyberpunk'],
    colors: { bg: '#04040c', text: '#ffffff', accent: '#00e5ff' },
    fields: {
      position: 'center', size: 'md', animation: 'zoom', borderRadius: 8,
      boxShadow: 'dark', overlayEnabled: true, overlayOpacity: 0.9,
      layoutMode: 'blocks',
      elements: [
        { id: 'n1', type: 'text', content: 'âš¡ PLAYER EXCLUSIVE', styles: { fontSize: '10px', fontWeight: '900', color: '#00e5ff', textTransform: 'uppercase', letterSpacing: '3px', textAlign: 'center' } },
        createSpacer('10px'),
        createText('60% Off Bundle', '36px', '900', '#ffffff', { lineHeight: '1.0', textAlign: 'center' }),
        createText('Gear Â· Skins Â· Premium Access â€” ends at midnight.', '13px', '400', 'rgba(255,255,255,0.6)', { textAlign: 'center', marginTop: '4px' }),
        createTimer('#00e5ff'),
        createCoupon('NEON60'),
        createButton('Unlock Bundle â†’', '#00e5ff', '#000000', { fontWeight: '900' }),
      ]
    }
  },

  {
    id: 'oss-editorial-newsletter',
    name: 'Editorial Newsletter',
    kind: 'modal',
    category: 'Lead Capture',
    desc: 'Magazine-style white card with bold red accent. Clean, high-brow feel.',
    thumbnail: 'https://images.unsplash.com/photo-1512411831835-23c267b2d56a?auto=format&fit=crop&w=400&q=80',
    tags: ['Editorial', 'Magazine', 'Newsletter'],
    colors: { bg: '#fafaf8', text: '#1a1a1a', accent: '#b91c1c' },
    fields: {
      position: 'center', size: 'md', animation: 'fade', borderRadius: 2,
      boxShadow: 'premium', overlayEnabled: true, overlayOpacity: 0.5,
      layoutMode: 'blocks',
      elements: [
        createImage('https://images.unsplash.com/photo-1512411831835-23c267b2d56a?auto=format&fit=crop&w=600&q=80', '150px', { width: '100%', borderRadius: '0' }),
        createSpacer('20px'),
        { id: 'ed1', type: 'text', content: 'THE WEEKLY BRIEF', styles: { fontSize: '10px', fontWeight: '800', color: '#b91c1c', letterSpacing: '4px', textTransform: 'uppercase' } },
        createSpacer('6px'),
        createText('Stories worth reading. Twice a week.', '22px', '300', '#1a1a1a', { lineHeight: '1.3', fontStyle: 'italic' }),
        createText('85,000 readers. No ads. No noise. Unsubscribe any time.', '13px', '400', '#666', { marginTop: '4px' }),
        createSpacer('16px'),
        createForm('Subscribe Free', '#b91c1c'),
      ]
    }
  },

  {
    id: 'oss-stock-urgency',
    name: 'Low Stock Urgency',
    kind: 'modal',
    category: 'Ecommerce',
    desc: 'Clean white card with product image, text urgency indicator, and red CTA.',
    thumbnail: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=400&q=80',
    tags: ['Urgency', 'Stock', 'FOMO'],
    colors: { bg: '#ffffff', text: '#111827', accent: '#dc2626' },
    fields: {
      position: 'center', size: 'md', animation: 'bounce', borderRadius: 16,
      boxShadow: 'floating', overlayEnabled: true, overlayOpacity: 0.5,
      layoutMode: 'blocks',
      elements: [
        createImage('https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=600&q=80', '160px', { borderRadius: '10px', width: '100%' }),
        createSpacer('16px'),
        { id: 'sk1', type: 'text', content: 'ðŸ”´ Only 7 units left Â· 73 people viewing', styles: { fontSize: '12px', fontWeight: '700', color: '#dc2626', textAlign: 'center' } },
        createSpacer('6px'),
        createText('Almost Sold Out', '24px', '800', '#111827'),
        createText('This item sells out weekly. Reserve yours now.', '13px', '400', '#6b7280', { marginTop: '4px' }),
        createSpacer('12px'),
        createButton('Reserve Mine â†’', '#dc2626', '#ffffff', { fontWeight: '900' }),
        { id: 'sk2', type: 'text', content: 'ðŸ”’ Free returns Â· Secure checkout', styles: { fontSize: '11px', color: '#9ca3af', textAlign: 'center' } },
      ]
    }
  },

  {
    id: 'oss-referral-share',
    name: 'Give $10 Â· Get $10',
    kind: 'modal',
    category: 'Lead Capture',
    desc: 'Green referral card with two CTA buttons â€” copy link and share on WhatsApp.',
    thumbnail: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=400&q=80',
    tags: ['Referral', 'Share', 'Viral'],
    colors: { bg: '#f0fdf4', text: '#14532d', accent: '#16a34a' },
    fields: {
      position: 'center', size: 'md', animation: 'elastic', borderRadius: 20,
      boxShadow: 'floating', overlayEnabled: true, overlayOpacity: 0.45,
      layoutMode: 'blocks',
      elements: [
        createText('ðŸŽ  Give $10, Get $10', '28px', '900', '#14532d', { lineHeight: '1.1' }),
        createText('Share your link. When a friend buys, you both save $10.', '14px', '400', '#166534', { marginTop: '6px' }),
        createSpacer('16px'),
        createCoupon('FRIEND-REF-XXXX'),
        createSpacer('12px'),
        createButton('Copy My Referral Link', '#16a34a', '#ffffff', { fontWeight: '800' }),
        createSpacer('8px'),
        { id: 'r1', type: 'button', content: 'ðŸ’¬ Share on WhatsApp', styles: { background: '#25d366', color: '#ffffff', borderRadius: '12px', padding: '12px 16px', fontWeight: '700', fontSize: '14px', width: '100%', cursor: 'pointer' } },
      ]
    }
  },

  {
    id: 'oss-bundle-offer',
    name: 'Bundle & Save 55%',
    kind: 'modal',
    category: 'Ecommerce',
    desc: 'Dark purple bundle upsell showing all items included with combined discount price.',
    thumbnail: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=400&q=80',
    tags: ['Bundle', 'AOV', 'Upsell'],
    colors: { bg: '#0f0f23', text: '#f8fafc', accent: '#a855f7' },
    fields: {
      position: 'center', size: 'md', animation: 'zoom', borderRadius: 20,
      boxShadow: 'dark', overlayEnabled: true, overlayOpacity: 0.85,
      layoutMode: 'blocks',
      elements: [
        { id: 'bu1', type: 'text', content: 'BUNDLE Â· SAVE 55%', styles: { fontSize: '10px', fontWeight: '900', color: '#a855f7', letterSpacing: '3px', textTransform: 'uppercase', textAlign: 'center' } },
        createSpacer('10px'),
        createText('The Ultimate Tech Bundle', '26px', '800', '#f8fafc', { lineHeight: '1.1', textAlign: 'center' }),
        createSpacer('8px'),
        { id: 'bu2', type: 'text', content: 'ðŸ“¦  Headphones  Â·  Smart Watch  Â·  USB-C Hub', styles: { fontSize: '12px', fontWeight: '600', color: '#c4b5fd', textAlign: 'center', background: 'rgba(168,85,247,0.12)', padding: '10px', borderRadius: '8px' } },
        createSpacer('12px'),
        { id: 'bu3', type: 'text', content: '$349 â†’ $159 today only', styles: { fontSize: '20px', fontWeight: '900', color: '#a855f7', textAlign: 'center' } },
        createCoupon('BUNDLE55'),
        createButton('Get the Bundle â€” $159', '#a855f7', '#ffffff', { fontWeight: '900' }),
      ]
    }
  },

  {
    id: 'oss-social-proof',
    name: 'Customer Reviews Wall',
    kind: 'modal',
    category: 'Sales',
    desc: 'Star rating headline with two verified review quotes and a bold amber CTA.',
    thumbnail: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=400&q=80',
    tags: ['Reviews', 'Social Proof', 'Trust'],
    colors: { bg: '#ffffff', text: '#111827', accent: '#f59e0b' },
    fields: {
      position: 'center', size: 'md', animation: 'elastic', borderRadius: 16,
      boxShadow: 'floating', overlayEnabled: true, overlayOpacity: 0.4,
      layoutMode: 'blocks',
      elements: [
        createText('â­â­â­â­â­  4.9 Â· 12,400+ reviews', '13px', '700', '#f59e0b', { textAlign: 'center' }),
        createSpacer('16px'),
        { id: 'sv1', type: 'text', content: '"Next-day delivery, perfect packaging. Best buy this year." â€” Sarah K. âœ…', styles: { fontSize: '13px', fontStyle: 'italic', color: '#374151', background: '#fafafa', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #f59e0b' } },
        createSpacer('8px'),
        { id: 'sv2', type: 'text', content: '"Worth every penny. Recommended it to everyone I know." â€” Marcus T. âœ…', styles: { fontSize: '13px', fontStyle: 'italic', color: '#374151', background: '#fafafa', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #10b981' } },
        createSpacer('16px'),
        createButton('Shop with Confidence â†’', '#f59e0b', '#000000', { fontWeight: '900' }),
      ]
    }
  },

  {
    id: 'oss-vip-membership',
    name: 'VIP Founding Member',
    kind: 'fullscreen',
    category: 'Lead Capture',
    desc: 'Black fullscreen takeover for exclusive membership launch with perks list.',
    thumbnail: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=400&q=80',
    tags: ['VIP', 'Members', 'Launch'],
    colors: { bg: '#030712', text: '#f9fafb', accent: '#fbbf24' },
    fields: {
      position: 'center', size: 'lg', animation: 'flip_in', borderRadius: 0,
      boxShadow: 'none', overlayEnabled: false, overlayOpacity: 0,
      layoutMode: 'blocks',
      elements: [
        createSpacer('48px'),
        { id: 'v1', type: 'text', content: 'â—ˆ  VIP  â—ˆ', styles: { fontSize: '11px', fontWeight: '900', color: '#fbbf24', letterSpacing: '6px', textTransform: 'uppercase', textAlign: 'center' } },
        createSpacer('16px'),
        createText('Founding Member.', '48px', '900', '#f9fafb', { lineHeight: '1.0', letterSpacing: '-2px', textAlign: 'center' }),
        createSpacer('12px'),
        createText('500 spots. Lifetime pricing. Early access forever.', '16px', '400', '#6b7280', { textAlign: 'center' }),
        createSpacer('24px'),
        { id: 'v2', type: 'text', content: 'âœ“  30% off every order  Â·  âœ“  Free express shipping  Â·  âœ“  Member-only drops', styles: { fontSize: '13px', fontWeight: '600', color: '#fbbf24', textAlign: 'center', lineHeight: '2.2' } },
        createSpacer('28px'),
        createForm('Claim My Founding Spot', '#fbbf24'),
        { id: 'v3', type: 'text', content: '347 / 500 spots taken.', styles: { fontSize: '12px', color: '#374151', textAlign: 'center', marginTop: '8px' } },
      ]
    }
  },

  {
    id: 'oss-affiliate-deal-card',
    name: 'Affiliate Deal Card',
    kind: 'modal',
    category: 'Ecommerce',
    desc: 'Clean product card with star rating, benefit bullet, and tracked affiliate CTA.',
    thumbnail: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=400&q=80',
    tags: ['Affiliate', 'Product', 'Deal'],
    colors: { bg: '#ffffff', text: '#111827', accent: '#6366f1' },
    fields: {
      position: 'center', size: 'md', animation: 'slide_up', borderRadius: 16,
      boxShadow: 'floating', overlayEnabled: true, overlayOpacity: 0.5,
      layoutMode: 'blocks',
      elements: [
        { id: 'af1', type: 'text', content: 'ðŸ·ï¸ FEATURED DEAL', styles: { fontSize: '10px', fontWeight: '800', color: '#6366f1', letterSpacing: '2px', textTransform: 'uppercase', textAlign: 'center', background: '#eef2ff', padding: '4px 12px', borderRadius: '20px', width: 'fit-content', margin: '0 auto' } },
        createSpacer('12px'),
        createImage('https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=600&q=80', '160px', { borderRadius: '10px', width: '100%' }),
        createSpacer('12px'),
        createText('Pixel Watch 3 â€” Editor\'s Pick', '20px', '800', '#111827'),
        createText('Track heart rate, sleep & workouts in a sleek wearable.', '13px', '400', '#6b7280', { marginTop: '4px' }),
        { id: 'af2', type: 'text', content: 'â˜…â˜…â˜…â˜…â˜…  4.8 / 5  Â·  2,341 reviews', styles: { fontSize: '12px', fontWeight: '600', color: '#f59e0b', textAlign: 'center', marginTop: '8px' } },
        createSpacer('12px'),
        createButton('See Best Price â†’', '#6366f1', '#ffffff', { fontWeight: '900' }),
        { id: 'af3', type: 'text', content: 'We may earn a commission. Same price for you.', styles: { fontSize: '10px', color: '#d1d5db', textAlign: 'center' } },
      ]
    }
  },

  {
    id: 'oss-announcement-bar',
    name: 'Sitewide Promo Bar',
    kind: 'bar',
    category: 'Ecommerce',
    desc: 'Full-width purple announcement bar for flash sales and sitewide offers.',
    thumbnail: 'https://images.unsplash.com/photo-1512411831835-23c267b2d56a?auto=format&fit=crop&w=400&q=80',
    tags: ['Bar', 'Announcement', 'Promo'],
    colors: { bg: '#7c3aed', text: '#ffffff', accent: '#fbbf24' },
    fields: {
      position: 'top-center', size: 'lg', animation: 'slide_down', borderRadius: 0,
      boxShadow: 'none', overlayEnabled: false, overlayOpacity: 0,
      layoutMode: 'blocks',
      elements: [
        { id: 'ab1', type: 'text', content: '🚀  FREE SHIPPING this week — use code FREESHIP at checkout  ·  🎉  New arrivals every Monday', styles: { fontSize: '13px', fontWeight: '600', color: '#ffffff', textAlign: 'center', letterSpacing: '0.3px' } },
      ]
    }
  },
];

export const BACKEND_LIBRARY_TEMPLATES: TemplatePreset[] = [];

