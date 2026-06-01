export type ActivePage =
  | 'home'
  | 'templates'
  | 'pricing'
  | 'integration-guide'
  | 'contact'
  | 'privacy-policy'
  | 'terms'
  | 'security';

export interface PopupTemplate {
  id: string;
  name: string;
  category: 'newsletter' | 'coupon' | 'slide-in' | 'cart-abandonment' | 'floating-bar';
  title: string;
  subtitle: string;
  ctaText: string;
  badge?: string;
  discountCode?: string;
  themeStyle: 'minimalist' | 'warm-editorial' | 'tech-mono' | 'luxury-bold';
  imageUrl?: string;
}

export interface DemoSettings {
  popupType: 'newsletter' | 'coupon' | 'slide-in' | 'cart-abandonment' | 'floating-bar';
  triggerType: 'scroll' | 'exit' | 'delay' | 'click';
  triggerValue: number; // e.g., 30% scroll, 3 seconds delay
  themeStyle: 'minimalist' | 'warm-editorial' | 'tech-mono' | 'luxury-bold';
  textColor: string;
  bgColor: string;
  accentColor: string;
  position: 'center' | 'bottom-right' | 'bottom-left' | 'top-bar';
  roundness: 'none' | 'md' | 'full';
  animationType: 'fade-scale' | 'slide-up' | 'slide-in-right' | 'spin-draw';
}

export interface Testimonial {
  id: string;
  quote: string;
  author: string;
  role: string;
  company: string;
  industry: string;
  logoUrl?: string;
  metric: string;
  metricLabel: string;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: 'product' | 'wordpress' | 'shopify' | 'performance' | 'billing';
}
