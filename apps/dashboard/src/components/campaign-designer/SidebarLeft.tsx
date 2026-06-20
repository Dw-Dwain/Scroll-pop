import React, { useState } from 'react';
import { 
  Layout, 
  Sparkles, 
  Type, 
  Sliders, 
  Layers, 
  Palette, 
  Plus, 
  Zap, 
  Clock, 
  FormInput, 
  Star, 
  QrCode, 
  ShieldAlert, 
  Calendar, 
  Smartphone, 
  MapPin, 
  Trash2, 
  FolderSync, 
  Tv, 
  Image,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  CheckSquare,
  ChevronDown
} from 'lucide-react';
import { Campaign, CampaignElement, ElementType, PopupType, BrandStyle, CampaignTriggers } from './types';
import { TargetingRuleBuilder } from './TargetingRuleBuilder';
import { TemplateGalleryModal } from './TemplateGalleryModal';

// Deferred element types. These (product/review/qrcode/ticker/progressbar/couponcard) are in the
// palette source + type system but are half-built: no property editors and the live snippet renders
// them blank. Hidden from the palette so nobody can add an element that shows nothing on a customer
// site. Flip to true once they have a real data model + editors + snippet renderers.
// Roadmap: "render/audit gaps → 6 element types" (deferred Jun 13 2026).
const WIP_ELEMENT_TYPES_ENABLED = false;

interface SidebarLeftProps {
  campaign: Campaign;
  siblingCampaigns?: { id: string; name: string }[];
  activeStep: 'teaser' | 'main' | 'success';
  onUpdateStepConfig: (keyOrObj: string | Record<string, unknown>, value?: unknown) => void;
  onUpdateTriggers: (key: string, value: unknown) => void;
  onSelectTemplate: (template: Campaign) => void;
  /** When true, the template gallery modal opens on mount (the campaign-create flow). */
  autoOpenGallery?: boolean;
  onAddElement: (type: ElementType) => void;
  onRemoveElement: (id: string) => void;
  onReorderElement: (id: string, action: 'up' | 'down') => void;
  selectedElementId?: string | null;
  onSelectElement?: (id: string | null) => void;
  onUpdateElement?: (id: string, keyOrObj: string | Record<string, unknown>, value?: unknown) => void;
}

const BRAND_PALETTES: BrandStyle[] = [
  {
    id: 'f-noir',
    name: 'Atelier Minimal (Noir)',
    fontHeading: 'serif',
    fontBody: 'sans-serif',
    primaryColor: '#000000',
    secondaryColor: '#4B5563',
    backgroundColor: '#FCFCFC',
    textColor: '#111827',
  },
  {
    id: 'b-glow',
    name: 'Glow Nude (Skincare)',
    fontHeading: 'sans-serif',
    fontBody: 'sans-serif',
    primaryColor: '#E78C73',
    secondaryColor: '#D27F65',
    backgroundColor: '#FCF8F6',
    textColor: '#2C1B18',
  },
  {
    id: 'k-cute',
    name: 'Kawaii Sweet (Harajuku)',
    fontHeading: 'sans-serif',
    fontBody: 'sans-serif',
    primaryColor: '#FF477E',
    secondaryColor: '#FF8FAB',
    backgroundColor: '#FFF2F4',
    textColor: '#6B3E49',
  },
  {
    id: 'c-neon',
    name: 'Cyber Void (Pro Tech)',
    fontHeading: 'monospace',
    fontBody: 'monospace',
    primaryColor: '#38BDF8',
    secondaryColor: '#0EA5E9',
    backgroundColor: '#020617',
    textColor: '#FFFFFF',
  },
  {
    id: 'l-royal',
    name: 'Luxury Velvet (Imperial)',
    fontHeading: 'serif',
    fontBody: 'serif',
    primaryColor: '#F59E0B',
    secondaryColor: '#FFD700',
    backgroundColor: '#022C22',
    textColor: '#FFFFFF',
  },
  // New brand palettes
  {
    id: 'sage-wellness',
    name: 'Sage & Oat Wellness',
    fontHeading: 'serif',
    fontBody: 'sans-serif',
    primaryColor: '#6B8F71',
    secondaryColor: '#A8BFA8',
    backgroundColor: '#F5F2EB',
    textColor: '#2D3A2E',
  },
  {
    id: 'coral-sunset',
    name: 'Coral Sunset Editorial',
    fontHeading: 'serif',
    fontBody: 'sans-serif',
    primaryColor: '#E8735A',
    secondaryColor: '#C45C44',
    backgroundColor: '#FFF8F6',
    textColor: '#3D1A12',
  },
  {
    id: 'y2k-vaporwave',
    name: 'Y2K Vaporwave',
    fontHeading: 'sans-serif',
    fontBody: 'sans-serif',
    primaryColor: '#E879F9',
    secondaryColor: '#818CF8',
    backgroundColor: '#0F0A1A',
    textColor: '#F0ABFC',
  },
  {
    id: 'streetwear-dark',
    name: 'Streetwear Dark',
    fontHeading: 'monospace',
    fontBody: 'sans-serif',
    primaryColor: '#A3E635',
    secondaryColor: '#84CC16',
    backgroundColor: '#09090B',
    textColor: '#FFFFFF',
  },
  {
    id: 'forest-premium',
    name: 'Forest & Ivory Premium',
    fontHeading: 'serif',
    fontBody: 'serif',
    primaryColor: '#2D6A4F',
    secondaryColor: '#52B788',
    backgroundColor: '#F9F7F0',
    textColor: '#1B3A2A',
  },
  {
    id: 'cobalt-minimal',
    name: 'Cobalt Blueprint',
    fontHeading: 'sans-serif',
    fontBody: 'sans-serif',
    primaryColor: '#2563EB',
    secondaryColor: '#3B82F6',
    backgroundColor: '#FFFFFF',
    textColor: '#1E3A8A',
  },
  {
    id: 'terracotta-lux',
    name: 'Terracotta Editorial',
    fontHeading: 'serif',
    fontBody: 'sans-serif',
    primaryColor: '#C1440E',
    secondaryColor: '#E07B54',
    backgroundColor: '#FAF4EE',
    textColor: '#3A1A0A',
  },
  {
    id: 'midnight-rose',
    name: 'Midnight Rose',
    fontHeading: 'serif',
    fontBody: 'sans-serif',
    primaryColor: '#F9A8D4',
    secondaryColor: '#EC4899',
    backgroundColor: '#0C0A18',
    textColor: '#FDF2F8',
  },
  {
    id: 'matcha-zen',
    name: 'Matcha Zen Studio',
    fontHeading: 'serif',
    fontBody: 'sans-serif',
    primaryColor: '#4A7C59',
    secondaryColor: '#6B9E7A',
    backgroundColor: '#F7F5EE',
    textColor: '#2A3D2E',
  },
  {
    id: 'obsidian-gold',
    name: 'Obsidian & Gold Ultra',
    fontHeading: 'serif',
    fontBody: 'sans-serif',
    primaryColor: '#F4D03F',
    secondaryColor: '#F7DC6F',
    backgroundColor: '#000000',
    textColor: '#FFFFFF',
  },
];


const getCloseButton = (): CampaignElement => ({
  id: 'close-btn',
  type: 'close',
  x: 94,
  y: 4,
  w: 4,
  h: 6,
  content: '✕',
  color: '#9CA3AF',
  fontSize: 12,
  zIndex: 10,
});

const getDefaultTriggers = (): CampaignTriggers => ({
  exitIntent: false,
  scrollPercent: 0,
  inactivitySeconds: 0,
  timeDelaySeconds: 5,
  pageTargeting: '*',
  deviceTargeting: 'all' as const,
  geoTargeting: 'JP', // Default region (Japan); any country is selectable via the Geo Targeting dropdown.
  frequencyCapDays: 1,
  newVisitorOnly: false,
  sessionPageCount: 0,
  utmParam: 'utm_source',
  utmValue: '',
  startsAt: '',
  endsAt: '',
  abTestPercent: 100,
});


export default function SidebarLeft({
  campaign,
  siblingCampaigns = [],
  activeStep,
  onUpdateStepConfig,
  onUpdateTriggers,
  onSelectTemplate,
  autoOpenGallery = false,
  onAddElement,
  onRemoveElement,
  onReorderElement,
  selectedElementId = null,
  onSelectElement,
  onUpdateElement,
}: SidebarLeftProps) {
  // Inline Renaming State for Layers (Puck / GrapesJS style)
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingName, setRenamingName] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'templates' | 'elements' | 'triggers' | 'brands' | 'layers' | 'mixer'>('templates');
  // Template gallery modal (replaces the old cramped sidebar list). Auto-opens on the create flow.
  const [galleryOpen, setGalleryOpen] = useState<boolean>(false);
  React.useEffect(() => { if (autoOpenGallery) setGalleryOpen(true); }, [autoOpenGallery]);

  // Magic Mixer States
  const [mixerStyle, setMixerStyle] = useState<string>('noir');
  const [mixerCategory, setMixerCategory] = useState<string>('christmas');
  const [mixerLayout, setMixerLayout] = useState<PopupType>('modal');
  const [mixerHeading, setMixerHeading] = useState<string>('');
  const [mixerCta, setMixerCta] = useState<string>('');

  const stepConfig = campaign.steps[activeStep];
  const elements = stepConfig.elements;

  // Programmatically compiles customized step configs using Canva visual guidelines
  const handleGenerateProceduralMixer = () => {
    let bg = '#FFFFFF';
    let primary = '#000000';
    let text = '#111827';
    let border = '#E4E4E7';
    let tint = '#F4F4F5';
    let fHeading = 'sans-serif';
    let fBody = 'sans-serif';

    switch (mixerStyle) {
      case 'noir':
        bg = '#FFFFFF'; primary = '#000000'; text = '#111827'; border = '#111111'; tint = '#F4F4F5'; fHeading = 'serif'; fBody = 'sans-serif';
        break;
      case 'sweet':
        bg = '#FFF2F4'; primary = '#FF477E'; text = '#5C0620'; border = '#FFC2D1'; tint = '#FFE5EC'; fHeading = 'sans-serif'; fBody = 'sans-serif';
        break;
      case 'glow':
        bg = '#FCF8F6'; primary = '#E78C73'; text = '#2C1B18'; border = '#FFEBE3'; tint = '#FFF4E0'; fHeading = 'sans-serif'; fBody = 'sans-serif';
        break;
      case 'tech':
        bg = '#020617'; primary = '#22D3EE'; text = '#E2E8F0'; border = '#0891B2'; tint = '#0F172A'; fHeading = 'monospace'; fBody = 'monospace';
        break;
      case 'emerald':
        bg = '#022C22'; primary = '#F59E0B'; text = '#FFFFFF'; border = '#065F46'; tint = '#064E3B'; fHeading = 'serif'; fBody = 'serif';
        break;
      case 'alarm':
        bg = '#FCFAF7'; primary = '#EF4444'; text = '#111827'; border = '#EF4444'; tint = '#FFF1F1'; fHeading = 'monospace'; fBody = 'sans-serif';
        break;
      case 'pastel':
        bg = '#FAF5FF'; primary = '#9333EA'; text = '#581C87'; border = '#E9D5FF'; tint = '#F3E8FF'; fHeading = 'serif'; fBody = 'sans-serif';
        break;
      case 'retro':
        bg = '#FEFCE8'; primary = '#854D0E'; text = '#451A03'; border = '#FEF08A'; tint = '#FEF9C3'; fHeading = 'serif'; fBody = 'sans-serif';
        break;
      default:
        break;
    }

    let titleText = mixerHeading || 'VIP SELECTIONS';
    let subText = 'Limited time. Complete your email subscription & unlock vip rewards.';
    let imgPath = 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=600&q=80';
    let btnValue = mixerCta || 'CLAIM MY VOUCHER CODE';
    let promoCode = 'MIXERVIP20';
    let targetCat = 'Sales & Store Campaigns';

    // Premium presets dict mapping covering all required motifs
    const presets: Record<string, { title: string, sub: string, img: string, btn: string, coupon: string, cat: string }> = {
      valentine: {
        title: 'ROSE VALENTINE LOVE 💕',
        sub: 'Unpack custom botanical perfume sets for your loved ones + 15% off discount code applied instantly.',
        img: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=600&q=80',
        btn: 'REDEEM ROSE ACCESS 🌹',
        coupon: 'LOVE15',
        cat: 'Holiday specific sales'
      },
      christmas: {
        title: 'COZY CHRISTMAS EVE FESTIVE 🎄',
        sub: 'Ruby ribbons & organic skincare serums under the fireplace. Claim deluxe Holiday sampler tags.',
        img: 'https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&w=600&q=80',
        btn: 'UNWRAP MY GIFTSET 🎁',
        coupon: 'SANTASECRETS',
        cat: 'Holiday specific sales'
      },
      halloween: {
        title: 'SPOOKY HARVEST CONGREGATION 🎃',
        sub: 'No tricks, only premium skincare treats! Crack the virtual potion lock to save flat 20% off product shelves.',
        img: 'https://images.unsplash.com/photo-1566576912321-d58edd7a26a4?auto=format&fit=crop&w=600&q=80',
        btn: 'RECLAIM SPOOKY POTION',
        coupon: 'GHOST20',
        cat: 'Holiday specific sales'
      },
      blackfriday: {
        title: 'BLACK FRIDAY SUPERSTORM 🔥',
        sub: 'Collapse prices to absolute minimum floors! Unlock unprecedented 30% off all checkout elements.',
        img: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=600&q=80',
        btn: 'COLLECT 30% DEDUCTION',
        coupon: 'BF30NOW',
        cat: 'Holiday specific sales'
      },
      cybermonday: {
        title: 'CYBER DATA MULTIVERSE 🖥',
        sub: 'Obsidian hardware specs and neon styling. Grab your early entry $40 subscription coupon voucher.',
        img: 'https://images.unsplash.com/photo-1526947425960-945c6e72858f?auto=format&fit=crop&w=600&q=80',
        btn: 'DECRYPT CYBER VOUCHER',
        coupon: 'CYBER40NOW',
        cat: 'Holiday specific sales'
      },
      easter: {
        title: 'EASTER BLOSSOM EGG HUNT 🥚',
        sub: 'A bundle of sweet pastel treasures. Claim free stickers and random rewards up to 50% discount codes.',
        img: 'https://images.unsplash.com/photo-1566576912321-d58edd7a26a4?auto=format&fit=crop&w=600&q=80',
        btn: 'CRACK EASTER EGG NOW',
        coupon: 'EGGHUNTER',
        cat: 'Holiday specific sales'
      },
      newyear: {
        title: 'NEW YEAR NEW FRESH GLOW',
        sub: 'Start pristine routines with high radiance! Receive complimentary jade stone sculptor tools.',
        img: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=600&q=80',
        btn: 'START GLOW ROUTINES ✨',
        coupon: 'NEWGLOW2026',
        cat: 'Holiday specific sales'
      },
      springcamp: {
        title: 'BOTANICAL SPRING AWAKENING',
        sub: 'Breathe spring floral energy. Access organic hydrating arrays at flat 15% reduction.',
        img: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=600&q=80',
        btn: 'AWAKEN SENSES PASS',
        coupon: 'SPRINGFLOW',
        cat: 'Seasons'
      },
      summercamp: {
        title: 'SUNKISSED BEACH ESCAPE 🏖',
        sub: 'Glow under the golden coastlines! Claim deluxe SPF guards & marine face masks at 20% off.',
        img: 'https://images.unsplash.com/photo-1590156546746-c2370ae25d71?auto=format&fit=crop&w=600&q=80',
        btn: 'APPLY BEACH PASS',
        coupon: 'SUNKISSED20',
        cat: 'Seasons'
      },
      anime: {
        title: 'HARAJUKU NEKOMIMI CAT POP 🐱',
        sub: 'Insanely cute mochi stickers and collectibles! Snag an instant free stickers box on registration.',
        img: 'https://images.unsplash.com/photo-1566576912321-d58edd7a26a4?auto=format&fit=crop&w=500&q=80',
        btn: 'COLLECT LUCKY PLUSH 🍭',
        coupon: 'NEKOMIMI15',
        cat: 'Sales & Store Campaigns'
      },
      luxury: {
        title: 'IMPERIAL GOLD AURELIA GALA',
        sub: 'Private concierge invitation to elite emerald lockets. Grab your $100 VIP customer coupon.',
        img: 'https://images.unsplash.com/photo-1526947425960-945c6e72858f?auto=format&fit=crop&w=600&q=80',
        btn: 'CLAIM PRIVATE $100 SPOT',
        coupon: 'AURELIA100',
        cat: 'Sales & Store Campaigns'
      },
      amazon: {
        title: 'PRIME RECOMMEND WIDGETS 📦',
        sub: 'Verified choices from our botanical series. Double reward checkouts + 10% Prime offsets.',
        img: 'https://images.unsplash.com/photo-1556228578-0d85b1a4a503?auto=format&fit=crop&w=400&q=80',
        btn: 'REDEEM PRIME PASS',
        coupon: 'AMZPRIME10',
        cat: 'Affiliate & Widgets'
      },
      shipping: {
        title: 'COMPLIMENTARY DHL EXPRESS DELIVERY',
        sub: 'Unlocking free zero-fee shipping on checkout baskets over $50! Use active token automatically.',
        img: '',
        btn: 'LOCK FREE CARGO SHIPPING 🚚',
        coupon: 'SHIP50NOW',
        cat: 'Layout & Positioning'
      },
      influencer: {
        title: 'EXCLUSIVE COLLAB DROP 🎤',
        sub: 'Limited edition pieces from our influencer collaboration. Get early access + 20% off before it goes public.',
        img: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
        btn: 'GET EARLY ACCESS NOW',
        coupon: 'COLLAB20',
        cat: 'Sales & Store Campaigns'
      },
      bfcm: {
        title: 'BLACK FRIDAY + CYBER MONDAY ⚡🖥',
        sub: 'The biggest sale of the year. Both days, one massive discount. 35% off everything, no exclusions.',
        img: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=600&q=80',
        btn: 'UNLOCK 35% BFCM DEAL',
        coupon: 'BFCM35',
        cat: 'Holiday specific sales'
      },
      saas: {
        title: 'START YOUR FREE TRIAL TODAY 🧪',
        sub: '14 days free, no card required. Join 10,000+ teams using our platform to grow faster.',
        img: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=600&q=80',
        btn: 'START FREE TRIAL',
        coupon: 'FREETRIAL14',
        cat: 'Sales & Store Campaigns'
      },
      luxwatch: {
        title: 'PRECISION CRAFTED. LIMITED PIECES. ⌚',
        sub: 'Swiss-inspired mechanisms. Only 50 units released. Reserve yours before public launch.',
        img: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?auto=format&fit=crop&w=600&q=80',
        btn: 'RESERVE MY PIECE',
        coupon: 'LUXWATCH',
        cat: 'Sales & Store Campaigns'
      },
      food: {
        title: 'HUNGRY? ORDER IN 30 MIN ⏱🍕',
        sub: 'First order free delivery + 15% off your basket. Grab the code before it expires.',
        img: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=600&q=80',
        btn: 'APPLY FREE DELIVERY CODE',
        coupon: 'FEED15NOW',
        cat: 'Sales & Store Campaigns'
      },
      fitness: {
        title: 'BUILD YOUR BEST BODY 💪',
        sub: 'Premium supplements & activewear. First bundle ships free + 20% member discount applied.',
        img: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=600&q=80',
        btn: 'START MY FITNESS JOURNEY',
        coupon: 'FIT20START',
        cat: 'Sales & Store Campaigns'
      },
      travel: {
        title: 'ESCAPE SOMEWHERE BEAUTIFUL ✈️',
        sub: 'Exclusive flight + hotel bundles from $299. Limited seats at this price. Book before midnight.',
        img: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=600&q=80',
        btn: 'BOOK MY GETAWAY NOW',
        coupon: 'TRAVEL299',
        cat: 'Seasons'
      },
      realestate: {
        title: 'FIND YOUR DREAM HOME 🏠',
        sub: 'Browse 5,000+ verified listings. Get a free market report + priority agent callback.',
        img: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=600&q=80',
        btn: 'GET FREE MARKET REPORT',
        coupon: 'HOMEFREE',
        cat: 'Affiliate & Widgets'
      },
    };


    const targetPreset = presets[mixerCategory] || presets['valentine'];
    if (mixerHeading) titleText = mixerHeading;
    else titleText = targetPreset?.title || '';
    subText = targetPreset?.sub || '';
    imgPath = targetPreset?.img || '';
    if (mixerCta) btnValue = mixerCta;
    else btnValue = targetPreset?.btn || '';
    promoCode = targetPreset?.coupon || '';
    targetCat = targetPreset?.cat || '';

    // Create steps
    const mainElementsList: CampaignElement[] = [
      getCloseButton()
    ];

    if (mixerLayout === 'stickybar') {
      mainElementsList.push(
        {
          id: 'proc-sticky-lbl',
          type: 'text',
          x: 2,
          y: 20,
          w: 16,
          h: 60,
          content: `🌟 ${titleText}`,
          color: primary,
          fontSize: 11,
          fontWeight: '900',
          fontFamily: fHeading,
          zIndex: 3,
        },
        {
          id: 'proc-sticky-txt',
          type: 'text',
          x: 20,
          y: 22,
          w: 42,
          h: 60,
          content: subText,
          color: text,
          fontSize: 11,
          fontFamily: fBody,
          align: 'left',
          zIndex: 3,
        },
        {
          id: 'proc-sticky-cbox',
          type: 'text',
          x: 65,
          y: 15,
          w: 12,
          h: 70,
          content: promoCode,
          color: bg,
          backgroundColor: primary,
          borderRadius: 6,
          fontSize: 13,
          fontWeight: '800',
          fontFamily: 'monospace',
          align: 'center',
          zIndex: 3,
        },
        {
          id: 'proc-sticky-btn',
          type: 'button',
          x: 80,
          y: 15,
          w: 14,
          h: 70,
          content: 'REDEEM',
          color: '#FFFFFF',
          backgroundColor: primary,
          borderRadius: 6,
          fontSize: 11,
          fontWeight: '700',
          align: 'center',
          zIndex: 4,
        }
      );
    } else {
      if (imgPath) {
        mainElementsList.push(
          {
            id: 'proc-split-tint',
            type: 'shape',
            x: 0,
            y: 0,
            w: 42,
            h: 100,
            content: 'rect',
            backgroundColor: tint,
            zIndex: 1,
          },
          {
            id: 'proc-split-img',
            type: 'image',
            x: 4,
            y: 6,
            w: 34,
            h: 88,
            content: imgPath,
            borderRadius: 12,
            zIndex: 2,
          }
        );
      }

      const lCoord = imgPath ? 46 : 8;
      const wCoord = imgPath ? 48 : 84;

      mainElementsList.push(
        {
          id: 'proc-main-tag',
          type: 'text',
          x: lCoord,
          y: 12,
          w: wCoord,
          h: 6,
          content: `★ PROURAL WIZARD PRESET`,
          color: primary,
          fontSize: 9,
          fontWeight: '800',
          fontFamily: fHeading,
          align: 'left',
          zIndex: 3,
        },
        {
          id: 'proc-main-head',
          type: 'heading',
          x: lCoord,
          y: 18,
          w: wCoord,
          h: 18,
          content: titleText,
          color: primary,
          fontSize: 22,
          fontWeight: '900',
          fontFamily: fHeading,
          align: 'left',
          zIndex: 3,
        },
        {
          id: 'proc-main-desc',
          type: 'text',
          x: lCoord,
          y: 36,
          w: wCoord,
          h: 14,
          content: subText,
          color: text,
          fontSize: 11.5,
          fontFamily: fBody,
          align: 'left',
          zIndex: 3,
        },
        {
          id: 'proc-main-input',
          type: 'input',
          x: lCoord,
          y: 52,
          w: wCoord,
          h: 12,
          content: 'Enter email...',
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: border,
          borderRadius: 8,
          zIndex: 3,
          extraProps: {
            placeholder: 'Claim points email...',
            label: 'Claim target'
          }
        },
        {
          id: 'proc-main-btn',
          type: 'button',
          x: lCoord,
          y: 68,
          w: wCoord,
          h: 12,
          content: btnValue,
          color: '#FFFFFF',
          backgroundColor: primary,
          borderRadius: 8,
          fontSize: 10.5,
          fontWeight: '800',
          align: 'center',
          zIndex: 4,
        },
        {
          id: 'proc-main-urg',
          type: 'urgency',
          x: lCoord,
          y: 84,
          w: wCoord,
          h: 8,
          content: `⚡ Dynamic priority code expires shortly! Claim it!`,
          color: primary,
          fontSize: 9,
          zIndex: 3,
        }
      );
    }

    const compiledCamp: Campaign = {
      id: `proc-mixer-${Date.now()}`,
      name: `${titleText.replace(/[^\w\s-]/g, '')} - Mixed Custom`,
      category: targetCat || '',
      isActive: true,
      conversions: 0,
      views: 0,
      createdAt: new Date().toISOString().split('T')[0] || '',
      triggers: getDefaultTriggers(),
      steps: {
        teaser: {
          popupType: 'floating',
          position: mixerLayout === 'stickybar' ? 'top' : 'bottom-right',
          width: 140,
          height: 64,
          backgroundColor: bg,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: primary,
          boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
          overlayColor: 'rgba(0,0,0,0)',
          animationEntrance: 'slide-up',
          elements: [
            {
              id: 'proc-teaser-ship',
              type: 'shape',
              x: 0,
              y: 0,
              w: 100,
              h: 100,
              content: 'rect',
              backgroundColor: bg,
              borderRadius: 12,
              zIndex: 1,
            },
            {
              id: 'proc-teaser-txt',
              type: 'text',
              x: 5,
              y: 25,
              w: 90,
              h: 50,
              content: `🎁 ${promoCode}`,
              color: primary,
              fontSize: 11,
              fontWeight: '900',
              align: 'center',
              zIndex: 3,
            }
          ]
        },
        main: {
          popupType: mixerLayout,
          position: mixerLayout === 'stickybar' ? 'top' : mixerLayout === 'slidein' ? 'bottom-right' : 'center',
          width: mixerLayout === 'stickybar' ? 1100 : mixerLayout === 'slidein' ? 360 : 660,
          height: mixerLayout === 'stickybar' ? 64 : mixerLayout === 'slidein' ? 240 : 420,
          backgroundColor: bg,
          borderRadius: mixerLayout === 'stickybar' ? 0 : 20,
          borderWidth: 1,
          borderColor: primary,
          boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
          overlayColor: 'rgba(50,30,20,0.2)',
          animationEntrance: 'scale-up',
          elements: mainElementsList,
        },
        success: {
          popupType: mixerLayout,
          position: mixerLayout === 'stickybar' ? 'top' : mixerLayout === 'slidein' ? 'bottom-right' : 'center',
          width: mixerLayout === 'stickybar' ? 1100 : mixerLayout === 'slidein' ? 360 : 600,
          height: mixerLayout === 'stickybar' ? 64 : mixerLayout === 'slidein' ? 240 : 390,
          backgroundColor: bg,
          borderRadius: mixerLayout === 'stickybar' ? 0 : 20,
          borderWidth: 1,
          borderColor: primary,
          boxShadow: '0 25px 40px rgba(0,0,0,0.1)',
          overlayColor: 'rgba(50,30,20,0.2)',
          animationEntrance: 'scale-up',
          elements: [
            getCloseButton(),
            {
              id: 'proc-suc-tag',
              type: 'text',
              x: 10,
              y: 12,
              w: 80,
              h: 10,
              content: '🎉 ACCESS KEY DECODED 🎉',
              color: primary,
              fontSize: 10,
              fontWeight: '800',
              align: 'center',
              zIndex: 3,
            },
            {
              id: 'proc-suc-head',
              type: 'heading',
              x: 10,
              y: 22,
              w: 80,
              h: 16,
              content: 'Your key coupon is copyable!',
              color: primary,
              fontSize: 22,
              fontWeight: '900',
              align: 'center',
              zIndex: 3,
            },
            {
              id: 'proc-suc-desc',
              type: 'text',
              x: 10,
              y: 40,
              w: 80,
              h: 12,
              content: 'Apply key code below in simulated store.',
              color: text,
              fontSize: 11,
              align: 'center',
              zIndex: 3,
            },
            {
              id: 'proc-suc-code',
              type: 'text',
              x: 25,
              y: 54,
              w: 50,
              h: 14,
              content: promoCode,
              color: primary,
              backgroundColor: tint,
              borderRadius: 12,
              fontSize: 20,
              fontWeight: '900',
              fontFamily: 'monospace',
              align: 'center',
              zIndex: 4,
              borderWidth: 1,
              borderColor: primary,
            },
            {
              id: 'proc-suc-btn',
              type: 'button',
              x: 25,
              y: 74,
              w: 50,
              h: 12,
              content: 'SHOP WITH CODE VOUCHER',
              color: '#FFFFFF',
              backgroundColor: primary,
              borderRadius: 12,
              fontSize: 11,
              fontWeight: '800',
              align: 'center',
              zIndex: 4,
            }
          ]
        }
      }
    };

    onSelectTemplate(compiledCamp);
  };

  // Apply Brand Styles dynamically
  const applyBrandStyle = (brand: BrandStyle) => {
    // Generate updated elements mapping and styling
    const updatedElements = stepConfig.elements.map((el) => {
      const updated = { ...el };
      if (el.type === 'heading') {
        updated.color = brand.primaryColor === '#FCFCFC' ? '#111827' : brand.primaryColor;
        updated.fontFamily = brand.fontHeading;
      } else if (el.type === 'text') {
        updated.color = brand.textColor;
        updated.fontFamily = brand.fontBody;
      } else if (el.type === 'button') {
        updated.backgroundColor = brand.primaryColor;
        updated.color = brand.primaryColor === '#FFFFFF' || brand.primaryColor === '#FCFCFC' ? '#000000' : '#FFFFFF';
        updated.fontFamily = brand.fontHeading;
      } else if (el.type === 'input') {
        updated.borderColor = brand.primaryColor;
        updated.fontFamily = brand.fontBody;
      }
      return updated;
    });

    onUpdateStepConfig({
      elements: updatedElements,
      backgroundColor: brand.backgroundColor,
      borderColor: brand.primaryColor
    });
  };

  return (
    <div
      className="flex h-full w-[400px] shrink-0 border-r border-zinc-800 bg-zinc-950 select-none designer-panel"
    >
      {/* Template gallery (grid modal) — replaces the old cramped vertical list. Opened by the
          "Browse templates" button below, and auto-opened on the create flow via autoOpenGallery. */}
      <TemplateGalleryModal
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        onPick={onSelectTemplate}
        activeId={campaign.id}
      />

      {/* 1. Left Icon Navigation Rail */}
      <div className="flex w-[80px] flex-col items-center border-r border-zinc-800 bg-zinc-900 py-4 gap-4 justify-between shrink-0">
        <div className="flex flex-col items-center gap-3 w-full">
          <button
            onClick={() => setActiveTab('templates')}
            className={`flex h-14 w-14 flex-col items-center justify-center rounded-lg transition-all duration-150 cursor-pointer ${
              activeTab === 'templates' 
                ? 'bg-white text-zinc-900 font-medium shadow-xs' 
                : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-100'
            }`}
          >
            <Layout className="h-4.5 w-4.5 mb-1" />
            <span className="text-[9px] tracking-wider font-medium">Presets</span>
          </button>

          <button
            onClick={() => setActiveTab('mixer')}
            className={`flex h-14 w-14 flex-col items-center justify-center rounded-lg transition-all duration-150 cursor-pointer ${
              activeTab === 'mixer' 
                ? 'bg-gradient-to-tr from-rose-500 to-indigo-600 text-white font-medium shadow-md' 
                : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-100'
            }`}
          >
            <Sparkles className="h-4.5 w-4.5 mb-1 animate-pulse" />
            <span className="text-[9px] tracking-wider font-semibold">Mixer</span>
          </button>

          <button
            onClick={() => setActiveTab('elements')}
            className={`flex h-14 w-14 flex-col items-center justify-center rounded-lg transition-all duration-150 cursor-pointer ${
              activeTab === 'elements' 
                ? 'bg-white text-zinc-900 font-medium shadow-xs' 
                : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-100'
            }`}
          >
            <Plus className="h-4.5 w-4.5 mb-1" />
            <span className="text-[9px] tracking-wider font-medium">Elements</span>
          </button>

          <button
            onClick={() => setActiveTab('triggers')}
            className={`flex h-14 w-14 flex-col items-center justify-center rounded-lg transition-all duration-150 cursor-pointer ${
              activeTab === 'triggers' 
                ? 'bg-white text-zinc-900 font-medium shadow-xs' 
                : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-100'
            }`}
          >
            <Sliders className="h-4.5 w-4.5 mb-1" />
            <span className="text-[9px] tracking-wider font-medium">Triggers</span>
          </button>

          <button
            onClick={() => setActiveTab('brands')}
            className={`flex h-14 w-14 flex-col items-center justify-center rounded-lg transition-all duration-150 cursor-pointer ${
              activeTab === 'brands' 
                ? 'bg-white text-zinc-900 font-medium shadow-xs' 
                : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-100'
            }`}
          >
            <Palette className="h-4.5 w-4.5 mb-1" />
            <span className="text-[9px] tracking-wider font-medium">Brands</span>
          </button>

          <button
            onClick={() => setActiveTab('layers')}
            className={`flex h-14 w-14 flex-col items-center justify-center rounded-lg transition-all duration-150 cursor-pointer relative ${
              activeTab === 'layers' 
                ? 'bg-white text-zinc-900 font-medium shadow-xs' 
                : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-100'
            }`}
          >
            <Layers className="h-4.5 w-4.5 mb-1" />
            <span className="text-[9px] tracking-wider font-medium">Layers</span>
            {elements.length > 0 && (
              <span className="absolute top-1 right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-indigo-500 border border-zinc-900 text-[8px] font-bold text-white shadow-xs">
                {elements.length}
              </span>
            )}
          </button>
        </div>
        
        {/* Subtle branding watermark at bottom of navigation rail */}
        <div className="text-[8px] tracking-widest text-zinc-600 font-mono scale-90 pt-4 border-t border-zinc-800 w-full text-center select-none uppercase">
          c-pop
        </div>
      </div>

      {/* 2. Right Expanded Navigation Drawer */}
      <div className="flex flex-1 flex-col overflow-hidden bg-zinc-950 p-5">
        
        {/* TEMPLATES DRAWER */}
        {activeTab === 'templates' && (
          <div className="flex h-full flex-col overflow-hidden text-left">
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-white tracking-tight uppercase font-mono flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-zinc-400" />
                Templates
              </h3>
              <p className="text-[11px] text-zinc-500 mt-1 leading-normal">Browse the full preset gallery and pick a starting design.</p>
            </div>
            <button
              onClick={() => setGalleryOpen(true)}
              className="w-full flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-700 bg-zinc-900 hover:border-zinc-500 hover:bg-zinc-800/60 transition-all py-10 px-4 cursor-pointer"
            >
              <Layout className="h-6 w-6 text-zinc-400" />
              <span className="text-sm font-semibold text-white">Browse templates</span>
              <span className="text-[11px] text-zinc-500">Open the full gallery (grid view)</span>
            </button>
          </div>
        )}

        {/* MIXER DRAWER */}
        {activeTab === 'mixer' && (
          <div className="flex h-full flex-col overflow-hidden text-left font-sans">
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-white tracking-tight uppercase font-mono flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
                Procedural Canvas Mixer
              </h3>
              <p className="text-[11px] text-zinc-500 mt-1 leading-normal">
                Assemble high-end campaign structures procedurally using handcrafted aesthetic variables.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-4 scrollbar-thin select-none">
              
              {/* Option 1: Visual Accent Palettes */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 font-mono">
                  1. Visual Accent Style
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'noir', name: 'Atelier Noir', bg: 'bg-zinc-950 text-white', color: '#111827' },
                    { id: 'sweet', name: 'Sakura Pastel', bg: 'bg-rose-100 text-rose-700', color: '#FF477E' },
                    { id: 'glow', name: 'Skincare Glow', bg: 'bg-orange-50 text-orange-850', color: '#E78C73' },
                    { id: 'tech', name: 'Cyber Void', bg: 'bg-slate-900 text-cyan-400 border border-cyan-500/20', color: '#22D3EE' },
                    { id: 'alarm', name: 'Flash Coral', color: '#EF4444' },
                    { id: 'pastel', name: 'Soft Lavender', color: '#9333EA' },
                    { id: 'retro', name: 'Retro Sepia', color: '#854D0E' },
                  ].map(style => (
                    <button
                      key={style.id}
                      onClick={() => setMixerStyle(style.id)}
                      className={`flex items-center gap-2 p-2 border rounded-lg transition-all duration-150 cursor-pointer text-left ${
                        mixerStyle === style.id
                          ? 'border-zinc-500 bg-zinc-800 font-bold'
                          : 'border-zinc-700 bg-zinc-900 hover:border-zinc-500'
                      }`}
                    >
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: style.color }} />
                      <span className="text-[11px] font-semibold text-zinc-100">{style.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Option 2: Campaign Motif Themes */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 font-mono">
                  2. Campaign Theme Motif
                </label>
                <select
                  value={mixerCategory}
                  onChange={(e) => setMixerCategory(e.target.value)}
                  className="w-full text-xs font-semibold p-2.5 border border-zinc-700 focus:border-zinc-500 rounded-lg outline-hidden focus:ring-1 focus:ring-zinc-500 dark-select"
                  style={{ backgroundColor: '#18181b', color: '#f4f4f5' }}
                >
                  <option value="valentine">🌹 Valentine's Day Rose Promo</option>
                  <option value="christmas">🎄 Cozy Christmas Velvet Lounge</option>
                  <option value="halloween">🎃 Spooky Halloween Treat Hunt</option>
                  <option value="newyear">✨ Radiant New Year Resolutions</option>
                  <option value="blackfriday">🔥 Midnight Black Friday Blowout</option>
                  <option value="bfcm">⚡🖥 BFCM Double Weekend</option>
                  <option value="cybermonday">🖥 Pro Tech Cyber Monday Void</option>
                  <option value="easter">🥚 Easter Blossom Egg Raffle</option>
                  <option value="springcamp">🌱 Botanical Spring Awakening</option>
                  <option value="summercamp">🏝 Riviera Sunkissed Summer Sale</option>
                  <option value="travel">✈️ Travel Deal Holiday Escape</option>
                  <option value="anime">🐱 Tokyo Pop Kawaii Nekomimi</option>
                  <option value="luxury">💎 Aurelia Imperial VIP Gala</option>
                  <option value="luxwatch">⌚ Precision Luxury Watch Drop</option>
                  <option value="influencer">🎤 Influencer Collab Drop</option>
                  <option value="saas">🧪 SaaS Free Trial Conversion</option>
                  <option value="fitness">💪 Fitness & Supplement Launch</option>
                  <option value="food">🍕 Food Delivery Flash Promo</option>
                  <option value="realestate">🏠 Real Estate Lead Capture</option>
                  <option value="amazon">📦 Prime Recommendation Hub</option>
                  <option value="shipping">🚚 Complimentary DHL Delivery</option>
                </select>
              </div>

              {/* Option 3: Popup Type Layout */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 font-mono">
                  3. Canvas Dimension Profile
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'modal', name: 'Classic Pop Modal' },
                    { id: 'stickybar', name: 'Fixed Header Bar' },
                    { id: 'slidein', name: 'Bottom Drawer Slide' },
                    { id: 'fullscreen', name: 'Takeover Overlay' }
                  ].map(layout => (
                    <button
                      key={layout.id}
                      onClick={() => setMixerLayout(layout.id as PopupType)}
                      className={`p-2 border rounded-lg transition-all text-xs font-semibold duration-150 cursor-pointer ${
                        mixerLayout === layout.id
                          ? 'bg-white text-zinc-900 border-white shadow-xs'
                          : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500 hover:text-zinc-100'
                      }`}
                    >
                      {layout.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Option 4: Tailored Copy overrides */}
              <div className="space-y-2 p-3 border border-zinc-200 bg-zinc-50/50 rounded-lg">
                <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-400 font-mono block mb-1">
                  4. Design custom text overlays (Optional)
                </span>
                
                <div className="space-y-1.5">
                  <span className="text-[10px] font-medium text-zinc-500 font-sans">Custom Headline Override:</span>
                  <input
                    type="text"
                    placeholder="Auto-derived from motif theme..."
                    value={mixerHeading}
                    onChange={(e) => setMixerHeading(e.target.value)}
                    className="w-full text-xs font-medium p-2 border border-zinc-200 rounded bg-white focus:border-zinc-950 outline-hidden"
                  />
                </div>

                <div className="space-y-1.5 mt-2">
                  <span className="text-[10px] font-medium text-zinc-500 font-sans font-sans">CTA button override text:</span>
                  <input
                    type="text"
                    placeholder="Auto-derived button label..."
                    value={mixerCta}
                    onChange={(e) => setMixerCta(e.target.value)}
                    className="w-full text-xs font-medium p-2 border border-zinc-200 rounded bg-white focus:border-zinc-950 outline-hidden"
                    id="mixer-override-cta"
                  />
                </div>
              </div>

              {/* Submit trigger button */}
              <button
                onClick={handleGenerateProceduralMixer}
                className="w-full py-3 bg-gradient-to-r from-rose-500 via-pink-600 to-indigo-600 hover:opacity-95 text-white rounded-lg font-semibold text-xs tracking-wide uppercase shadow-md active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1"
                id="mixer-trigger-proc-composition"
              >
                <Sparkles className="h-4 w-4" />
                Mix Procedural Preset
              </button>

            </div>
          </div>
        )}

        {/* ELEMENTS DRAWER */}
        {activeTab === 'elements' && (
          <div className="flex h-full flex-col text-left">
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-white tracking-tight uppercase font-mono">Campaign Elements</h3>
              <p className="text-[11px] text-zinc-500 mt-1 leading-normal">Click any block to inject it directly onto your canvas step layout.</p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
              <div className="grid grid-cols-2 gap-2.5">
                {/* 1. Heading */}
                <button
                  onClick={() => onAddElement('heading')}
                  className="flex flex-col items-center justify-center p-3 border border-zinc-700 rounded-md bg-zinc-800 hover:bg-zinc-700 hover:border-zinc-500 transition-all duration-150 text-zinc-100 cursor-pointer text-center group"
                >
                  <Type className="h-5 w-5 text-zinc-300 mb-1.5 group-hover:scale-105 transition-transform" />
                  <span className="text-xs font-semibold">Large Title</span>
                  <span className="text-[9px] text-zinc-500 mt-0.5">Headline block</span>
                </button>

                {/* 2. Subtext */}
                <button
                  onClick={() => onAddElement('text')}
                  className="flex flex-col items-center justify-center p-3 border border-zinc-700 rounded-md bg-zinc-800 hover:bg-zinc-700 hover:border-zinc-500 transition-all duration-150 text-zinc-100 cursor-pointer text-center group"
                >
                  <Plus className="h-5 w-5 text-zinc-300 mb-1.5 group-hover:scale-105 transition-transform" />
                  <span className="text-xs font-semibold">Paragraph</span>
                  <span className="text-[9px] text-zinc-500 mt-0.5">Captions & body</span>
                </button>

                {/* 3. Button */}
                <button
                  onClick={() => onAddElement('button')}
                  className="flex flex-col items-center justify-center p-3 border border-zinc-700 rounded-md bg-zinc-800 hover:bg-zinc-700 hover:border-zinc-500 transition-all duration-150 text-zinc-100 cursor-pointer text-center group"
                >
                  <Zap className="h-5 w-5 text-zinc-300 mb-1.5 group-hover:scale-105 transition-transform" />
                  <span className="text-xs font-semibold">Action Button</span>
                  <span className="text-[9px] text-zinc-500 mt-0.5">CTA & click promo</span>
                </button>

                {/* 4. Form Input */}
                <button
                  onClick={() => onAddElement('input')}
                  className="flex flex-col items-center justify-center p-3 border border-zinc-700 rounded-md bg-zinc-800 hover:bg-zinc-700 hover:border-zinc-500 transition-all duration-150 text-zinc-100 cursor-pointer text-center group"
                >
                  <FormInput className="h-5 w-5 text-zinc-300 mb-1.5 group-hover:scale-105 transition-transform" />
                  <span className="text-xs font-semibold">Email Input</span>
                  <span className="text-[9px] text-zinc-500 mt-0.5">Collect addresses</span>
                </button>

                {/* 4b. Consent Checkbox */}
                <button
                  onClick={() => onAddElement('consent')}
                  className="flex flex-col items-center justify-center p-3 border border-zinc-700 rounded-md bg-zinc-800 hover:bg-zinc-700 hover:border-zinc-500 transition-all duration-150 text-zinc-100 cursor-pointer text-center group"
                >
                  <CheckSquare className="h-5 w-5 text-zinc-300 mb-1.5 group-hover:scale-105 transition-transform" />
                  <span className="text-xs font-semibold">Consent Box</span>
                  <span className="text-[9px] text-zinc-500 mt-0.5">Opt-in checkbox</span>
                </button>

                {/* 5. Countdown Timer */}
                <button
                  onClick={() => onAddElement('countdown')}
                  className="flex flex-col items-center justify-center p-3 border border-zinc-700 rounded-md bg-zinc-800 hover:bg-zinc-700 hover:border-zinc-500 transition-all duration-150 text-zinc-100 cursor-pointer text-center group"
                >
                  <Clock className="h-5 w-5 text-zinc-300 mb-1.5 group-hover:scale-105 transition-transform" />
                  <span className="text-xs font-semibold">Countdown</span>
                  <span className="text-[9px] text-zinc-500 mt-0.5">Limited offer clock</span>
                </button>

                {/* 6. Product Box — DEFERRED (hidden; see WIP_ELEMENT_TYPES_ENABLED) */}
                {WIP_ELEMENT_TYPES_ENABLED && (
                <button
                  onClick={() => onAddElement('product')}
                  className="flex flex-col items-center justify-center p-3 border border-zinc-700 rounded-md bg-zinc-800 hover:bg-zinc-700 hover:border-zinc-500 transition-all duration-150 text-zinc-100 cursor-pointer text-center group"
                >
                  <FolderSync className="h-5 w-5 text-zinc-300 mb-1.5 group-hover:scale-105 transition-transform" />
                  <span className="text-xs font-semibold">Product Card</span>
                  <span className="text-[9px] text-zinc-500 mt-0.5">Featured item node</span>
                </button>
                )}

                {/* 7. Star Review — DEFERRED (hidden; see WIP_ELEMENT_TYPES_ENABLED) */}
                {WIP_ELEMENT_TYPES_ENABLED && (
                <button
                  onClick={() => onAddElement('review')}
                  className="flex flex-col items-center justify-center p-3 border border-zinc-700 rounded-md bg-zinc-800 hover:bg-zinc-700 hover:border-zinc-500 transition-all duration-150 text-zinc-100 cursor-pointer text-center group"
                >
                  <Star className="h-5 w-5 text-zinc-300 mb-1.5 group-hover:scale-105 transition-transform" />
                  <span className="text-xs font-semibold">Reviews</span>
                  <span className="text-[9px] text-zinc-500 mt-0.5">Proof star reviewer</span>
                </button>
                )}

                {/* 8. QR Code — DEFERRED (hidden; see WIP_ELEMENT_TYPES_ENABLED) */}
                {WIP_ELEMENT_TYPES_ENABLED && (
                <button
                  onClick={() => onAddElement('qrcode')}
                  className="flex flex-col items-center justify-center p-3 border border-zinc-700 rounded-md bg-zinc-800 hover:bg-zinc-700 hover:border-zinc-500 transition-all duration-150 text-zinc-100 cursor-pointer text-center group"
                >
                  <QrCode className="h-5 w-5 text-zinc-300 mb-1.5 group-hover:scale-105 transition-transform" />
                  <span className="text-xs font-semibold">QR Code</span>
                  <span className="text-[9px] text-zinc-500 mt-0.5">Offline mobile scan</span>
                </button>
                )}

                {/* 9. Urgent Notice */}
                <button
                  onClick={() => onAddElement('urgency')}
                  className="flex flex-col items-center justify-center p-3 border border-zinc-700 rounded-md bg-zinc-800 hover:bg-zinc-700 hover:border-zinc-500 transition-all duration-150 text-zinc-100 cursor-pointer text-center group"
                >
                  <ShieldAlert className="h-5 w-5 text-zinc-300 mb-1.5 group-hover:scale-105 transition-transform" />
                  <span className="text-xs font-semibold">Demand Tag</span>
                  <span className="text-[9px] text-zinc-500 mt-0.5">Urgent low stock text</span>
                </button>

                {/* 10. Image Block */}
                <button
                  onClick={() => onAddElement('image')}
                  className="flex flex-col items-center justify-center p-3 border border-zinc-700 rounded-md bg-zinc-800 hover:bg-zinc-700 hover:border-zinc-500 transition-all duration-150 text-zinc-100 cursor-pointer text-center group"
                >
                  <Image className="h-5 w-5 text-zinc-300 mb-1.5 group-hover:scale-105 transition-transform" />
                  <span className="text-xs font-semibold">Image Asset</span>
                  <span className="text-[9px] text-zinc-500 mt-0.5">Brand graphic node</span>
                </button>

                {/* 11. Social Proof Ticker — DEFERRED (hidden; see WIP_ELEMENT_TYPES_ENABLED) */}
                {WIP_ELEMENT_TYPES_ENABLED && (
                <button
                  onClick={() => onAddElement('ticker')}
                  className="flex flex-col items-center justify-center p-3 border border-zinc-700 rounded-md bg-zinc-800 hover:bg-zinc-700 hover:border-zinc-500 transition-all duration-150 text-zinc-100 cursor-pointer text-center group"
                >
                  <Tv className="h-5 w-5 text-zinc-300 mb-1.5 group-hover:scale-105 transition-transform" />
                  <span className="text-xs font-semibold">Live Ticker</span>
                  <span className="text-[9px] text-zinc-500 mt-0.5">Social proof feed</span>
                </button>
                )}

                {/* 12. Progress Bar — DEFERRED (hidden; see WIP_ELEMENT_TYPES_ENABLED) */}
                {WIP_ELEMENT_TYPES_ENABLED && (
                <button
                  onClick={() => onAddElement('progressbar')}
                  className="flex flex-col items-center justify-center p-3 border border-zinc-700 rounded-md bg-zinc-800 hover:bg-zinc-700 hover:border-zinc-500 transition-all duration-150 text-zinc-100 cursor-pointer text-center group"
                >
                  <ArrowUp className="h-5 w-5 text-zinc-300 mb-1.5 group-hover:scale-105 transition-transform" />
                  <span className="text-xs font-semibold">Progress Bar</span>
                  <span className="text-[9px] text-zinc-500 mt-0.5">Goal completion</span>
                </button>
                )}

                {/* 13. Coupon Reveal Card — DEFERRED (hidden; see WIP_ELEMENT_TYPES_ENABLED) */}
                {WIP_ELEMENT_TYPES_ENABLED && (
                <button
                  onClick={() => onAddElement('couponcard')}
                  className="flex flex-col items-center justify-center p-3 border border-zinc-700 rounded-md bg-zinc-800 hover:bg-zinc-700 hover:border-zinc-500 transition-all duration-150 text-zinc-100 cursor-pointer text-center group"
                >
                  <Sparkles className="h-5 w-5 text-zinc-300 mb-1.5 group-hover:scale-105 transition-transform" />
                  <span className="text-xs font-semibold">Coupon Card</span>
                  <span className="text-[9px] text-zinc-500 mt-0.5">Reveal promo code</span>
                </button>
                )}

                {/* 14. Phone Input */}
                <button
                  onClick={() => onAddElement('phoneinput')}
                  className="flex flex-col items-center justify-center p-3 border border-zinc-700 rounded-md bg-zinc-800 hover:bg-zinc-700 hover:border-zinc-500 transition-all duration-150 text-zinc-100 cursor-pointer text-center group"
                >
                  <Smartphone className="h-5 w-5 text-zinc-300 mb-1.5 group-hover:scale-105 transition-transform" />
                  <span className="text-xs font-semibold">Phone / SMS</span>
                  <span className="text-[9px] text-zinc-500 mt-0.5">Mobile opt-in field</span>
                </button>

                {/* 15. Trust Badge */}
                <button
                  onClick={() => onAddElement('badge')}
                  className="flex flex-col items-center justify-center p-3 border border-zinc-700 rounded-md bg-zinc-800 hover:bg-zinc-700 hover:border-zinc-500 transition-all duration-150 text-zinc-100 cursor-pointer text-center group"
                >
                  <ShieldAlert className="h-5 w-5 text-amber-400 mb-1.5 group-hover:scale-105 transition-transform" />
                  <span className="text-xs font-semibold">Trust Badge</span>
                  <span className="text-[9px] text-zinc-500 mt-0.5">Verified / secure stamp</span>
                </button>

                {/* 16. Divider */}
                <button
                  onClick={() => onAddElement('divider')}
                  className="flex flex-col items-center justify-center p-3 border border-zinc-700 rounded-md bg-zinc-800 hover:bg-zinc-700 hover:border-zinc-500 transition-all duration-150 text-zinc-100 cursor-pointer text-center group"
                >
                  <ArrowDown className="h-5 w-5 text-zinc-300 mb-1.5 group-hover:scale-105 transition-transform" />
                  <span className="text-xs font-semibold">Divider</span>
                  <span className="text-[9px] text-zinc-500 mt-0.5">Section separator</span>
                </button>
              </div>

              {/* Decorative instructions */}
              <div className="p-4 bg-zinc-800 border border-zinc-700 rounded-lg text-center mt-4">
                <span className="text-[10px] text-zinc-400 font-medium font-mono uppercase tracking-wider block mb-1">DESIGN TIP</span>
                <p className="text-[11px] text-zinc-500 leading-relaxed font-sans">
                  Click any block to inject it onto the canvas. Drag elements to reposition, and resize via handles.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TRIGGERS DRAWER */}
        {activeTab === 'triggers' && (
          <div className="flex h-full flex-col overflow-hidden text-left">
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-white tracking-tight uppercase font-mono">Campaign Triggers</h3>
              <p className="text-[11px] text-zinc-500 mt-1 leading-normal">Determine exactly when and how the promotional popups or stickybars activate.</p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-4 scrollbar-thin">
              {/* Geo Targeting — single-region dropdown, pinned to the top of the triggers panel. */}
              <div className="p-3.5 border border-zinc-800 rounded-lg bg-zinc-900 space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-zinc-400" />
                  <span className="text-xs font-semibold text-zinc-100">Geo Targeting</span>
                </div>
                {(() => {
                  const ALL = 'All Countries';
                  const COUNTRIES: [string, string][] = [
                    ['US', '🇺🇸 USA'], ['JP', '🇯🇵 Japan'], ['CA', '🇨🇦 Canada'],
                    ['GB', '🇬🇧 UK'], ['AU', '🇦🇺 Australia'], ['DE', '🇩🇪 Germany'],
                    ['FR', '🇫🇷 France'], ['IN', '🇮🇳 India'], ['BR', '🇧🇷 Brazil'],
                  ];
                  // Single-region selection. Legacy comma-joined values (e.g. "JP,IN") or the old
                  // "All Worldwide Markets" sentinel resolve to their first code / All so old
                  // campaigns keep working.
                  const raw = (campaign.triggers.geoTargeting || ALL).trim();
                  const current =
                    raw === ALL || raw === 'All Worldwide Markets' || !raw
                      ? ALL
                      : (raw.split(',').map((s) => s.trim()).filter(Boolean)[0] || ALL);
                  const label = COUNTRIES.find(([c]) => c === current)?.[1];
                  return (
                    <div className="space-y-1.5">
                      <div className="relative">
                        <select
                          value={current}
                          onChange={(e) => onUpdateTriggers('geoTargeting', e.target.value)}
                          className="w-full appearance-none bg-zinc-800 border border-zinc-700 rounded-md pl-3 pr-8 py-2 text-[11px] font-medium text-zinc-100 cursor-pointer hover:border-zinc-600 focus:outline-hidden focus:border-indigo-500 transition-colors"
                        >
                          <option value={ALL}>🌍 All Worldwide Markets</option>
                          {COUNTRIES.map(([code, lbl]) => (
                            <option key={code} value={code}>{lbl}</option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                      </div>
                      <p className="text-[10px] text-zinc-500 pt-0.5">
                        {current === ALL
                          ? 'Shows to visitors in every country.'
                          : <>Shows only to visitors in <span className="text-zinc-300 font-medium">{label ?? current}</span>.</>}
                      </p>
                    </div>
                  );
                })()}
              </div>

              {/* 0. Display Frequency */}
              <div className="p-3.5 border border-zinc-800 rounded-lg bg-zinc-900 space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-zinc-300" />
                  <span className="text-xs font-semibold text-zinc-100">Display Frequency</span>
                </div>
                <select
                  value={campaign.triggers.frequency ?? 'once_per_session'}
                  onChange={(e) => onUpdateTriggers('frequency', e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-100 px-2 py-1.5 focus:outline-hidden focus:border-indigo-500"
                >
                  <option value="always">Every page view</option>
                  <option value="once_per_session">Once per session</option>
                  <option value="once_per_day">Once per day</option>
                  <option value="once_per_visitor">Once per visitor</option>
                </select>
                <p className="text-[10.5px] text-zinc-600 leading-normal">
                  How often a single visitor may see this popup.
                </p>

                {/* Recurrence (optional) — layered on top of the mode above */}
                <div className="pt-2 mt-1 border-t border-zinc-800 space-y-2">
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">Recurrence (optional)</span>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-zinc-300 flex-1">Max displays <span className="text-zinc-600">(0 = ∞)</span></label>
                    <input
                      type="number" min={0} max={1000}
                      value={campaign.triggers.maxDisplayCount ?? 0}
                      onChange={(e) => onUpdateTriggers('maxDisplayCount', Math.max(0, Math.min(1000, parseInt(e.target.value) || 0)))}
                      className="w-16 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-100 px-2 py-1 focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-zinc-300 flex-1">Min gap <span className="text-zinc-600">(minutes)</span></label>
                    <input
                      type="number" min={0}
                      value={campaign.triggers.cooldownMinutes ?? 0}
                      onChange={(e) => onUpdateTriggers('cooldownMinutes', Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-16 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-100 px-2 py-1 focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={campaign.triggers.showAgainIfConverts ?? false}
                      onChange={(e) => onUpdateTriggers('showAgainIfConverts', e.target.checked)}
                      className="accent-indigo-600"
                    />
                    <span className="text-[11px] text-zinc-300">Keep showing after a conversion</span>
                  </label>
                  <p className="text-[10.5px] text-zinc-600 leading-normal">
                    e.g. Max 3, Min gap 60 → shows up to 3 times, at least 1h apart, then stops once they convert.
                  </p>
                </div>

                {/* Auto-reopen (same page) */}
                <div className="pt-2 mt-1 border-t border-zinc-800 space-y-2">
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">Auto-reopen (same page)</span>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-zinc-300 flex-1">Reopen after <span className="text-zinc-600">(seconds, 0 = off)</span></label>
                    <input
                      type="number" min={0} max={300}
                      value={campaign.triggers.reopenAfterSeconds ?? 0}
                      onChange={(e) => onUpdateTriggers('reopenAfterSeconds', Math.max(0, Math.min(300, parseInt(e.target.value) || 0)))}
                      className="w-16 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-100 px-2 py-1 focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-zinc-300 flex-1">Max reopens</label>
                    <input
                      type="number" min={0} max={20}
                      value={campaign.triggers.reopenMaxTimes ?? 1}
                      onChange={(e) => onUpdateTriggers('reopenMaxTimes', Math.max(0, Math.min(20, parseInt(e.target.value) || 0)))}
                      className="w-16 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-100 px-2 py-1 focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>
                  {(campaign.triggers.reopenAfterSeconds ?? 0) > 0 && (campaign.triggers.reopenAfterSeconds ?? 0) < 15 && (
                    <p className="text-[10.5px] text-red-400 leading-snug">
                      ⚠️ Below 15s is auto-raised to 15s at runtime — a shorter gap is too aggressive and risks ad-blocker / policy flags.
                    </p>
                  )}
                  <p className="text-[10.5px] text-zinc-600 leading-normal">
                    Re-shows the popup on the same page after it's closed. A 15s minimum gap is enforced; keep reopens low (e.g. 1). The X/close keeps the same behavior each cycle.
                  </p>
                </div>

                {/* Sequence chaining (FU-7) — advance to another campaign's popup */}
                <div className="pt-2 mt-1 border-t border-zinc-800 space-y-2">
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">Next popup (sequence)</span>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-zinc-300 flex-1">Then show</label>
                    <select
                      value={campaign.triggers.sequenceNextCampaignId ?? ''}
                      onChange={(e) => onUpdateTriggers('sequenceNextCampaignId', e.target.value)}
                      className="w-40 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-100 px-2 py-1 focus:outline-hidden focus:border-indigo-500"
                    >
                      <option value="">— None (off) —</option>
                      {siblingCampaigns.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  {!!campaign.triggers.sequenceNextCampaignId && (
                    <>
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-zinc-300 flex-1">Advance on</label>
                        <select
                          value={campaign.triggers.sequenceAdvanceOn ?? 'dismiss'}
                          onChange={(e) => onUpdateTriggers('sequenceAdvanceOn', e.target.value)}
                          className="w-40 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-100 px-2 py-1 focus:outline-hidden focus:border-indigo-500"
                        >
                          <option value="dismiss">Dismiss / close</option>
                          <option value="convert">Conversion</option>
                          <option value="both">Either</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-zinc-300 flex-1">Delay <span className="text-zinc-600">(seconds, min 5)</span></label>
                        <input
                          type="number" min={5} max={300}
                          value={campaign.triggers.sequenceDelaySeconds ?? 5}
                          onChange={(e) => onUpdateTriggers('sequenceDelaySeconds', Math.max(0, Math.min(300, parseInt(e.target.value) || 0)))}
                          className="w-16 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-100 px-2 py-1 focus:outline-hidden focus:border-indigo-500"
                        />
                      </div>
                    </>
                  )}
                  <p className="text-[10.5px] text-zinc-600 leading-normal">
                    Chains to a second popup after this one. Hard limits protect the visitor: at most <b>2</b> chained popups per page, never the same one twice, and a <b>5s+</b> gap. Use a different campaign as the follow-up (e.g. offer → email capture).
                  </p>
                </div>

                {/* Why recurrence/auto-reopen aren't preferred — informational */}
                <div className="mt-1 p-2 rounded bg-amber-500/10 border border-amber-500/20">
                  <p className="text-[10.5px] text-amber-300/90 leading-snug">
                    ⚠️ <b>Heads-up:</b> Recurrence &amp; auto-reopen are <b>aggressive by design</b>. Re-showing or auto-reopening a popup a visitor just dismissed tends to raise bounce, annoy users, and can trip ad-blocker / Google "annoyance" filters — which may hide your popup or hurt the host site's standing. They're here for power use, but a single, well-targeted display almost always converts better. Use sparingly.
                  </p>
                </div>
              </div>

              {/* 1. Exit intent */}
              <div className="p-3.5 border border-zinc-800 rounded-lg bg-zinc-900 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-zinc-300" />
                    <span className="text-xs font-semibold text-zinc-100">Exit Intent System</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={campaign.triggers.exitIntent}
                      onChange={(e) => onUpdateTriggers('exitIntent', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4.5 bg-zinc-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-3.5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
                <p className="text-[10.5px] text-zinc-600 leading-normal">
                  Fires instantly when user cursor drifts toward closing the page tab. Restores abandoned sales!
                </p>
              </div>

              {/* 2. Scroll Percentage */}
              <div className="p-3.5 border border-zinc-800 rounded-lg bg-zinc-900 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowDown className="h-4 w-4 text-zinc-400" />
                    <span className="text-xs font-semibold text-zinc-100">Scroll Depth Trigger</span>
                  </div>
                  <span className="text-[11px] font-mono font-medium text-zinc-100 bg-zinc-800 px-2 py-0.5 rounded">
                    {campaign.triggers.scrollPercent > 0 ? `${campaign.triggers.scrollPercent}%` : 'Disabled'}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={campaign.triggers.scrollPercent}
                  onChange={(e) => onUpdateTriggers('scrollPercent', parseInt(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer h-1 bg-zinc-700 rounded-lg"
                />
                <p className="text-[10.5px] text-zinc-600 leading-normal font-sans">
                  Loads after shopper scrolls down a target depth of the page.
                </p>
              </div>

              {/* 3. Inactivity */}
              <div className="p-3.5 border border-zinc-800 rounded-lg bg-zinc-900 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-zinc-400" />
                    <span className="text-xs font-semibold text-zinc-100">Idle Inactivity</span>
                  </div>
                  <span className="text-[11px] font-mono font-medium text-zinc-100 bg-zinc-800 px-2 py-0.5 rounded">
                    {campaign.triggers.inactivitySeconds > 0 ? `${campaign.triggers.inactivitySeconds}s` : 'Disabled'}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="120"
                  value={campaign.triggers.inactivitySeconds}
                  onChange={(e) => onUpdateTriggers('inactivitySeconds', parseInt(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer h-1 bg-zinc-700 rounded-lg"
                />
                <p className="text-[10.5px] text-zinc-600 leading-normal font-sans">
                  Launches when the shopper remains static for a set duration.
                </p>
              </div>

              {/* 4. Time Delay */}
              <div className="p-3.5 border border-zinc-800 rounded-lg bg-zinc-900 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-zinc-400" />
                    <span className="text-xs font-semibold text-zinc-100">Landing Time Delay</span>
                  </div>
                  <span className="text-[11px] font-mono font-medium text-zinc-100 bg-zinc-800 px-2 py-0.5 rounded">
                    {campaign.triggers.timeDelaySeconds > 0 ? `${campaign.triggers.timeDelaySeconds}s` : 'Instant'}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="60"
                  value={campaign.triggers.timeDelaySeconds}
                  onChange={(e) => onUpdateTriggers('timeDelaySeconds', parseInt(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer h-1 bg-zinc-700 rounded-lg"
                />
              </div>

              {/* 5. Device Target */}
              <div className="p-3.5 border border-zinc-800 rounded-lg bg-zinc-900 space-y-3">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-zinc-400" />
                  <span className="text-xs font-semibold text-zinc-100">Device Restrictions</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['all', 'desktop', 'tablet', 'mobile'] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => onUpdateTriggers('deviceTargeting', d)}
                      className={`py-1.5 px-1 rounded text-[10px] font-medium border capitalize transition-all duration-150 cursor-pointer text-center ${
                        campaign.triggers.deviceTargeting === d
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>


              {/* 7. New vs Returning Visitor */}
              <div className="p-3.5 border border-zinc-800 rounded-lg bg-zinc-900 space-y-3">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-zinc-400" />
                  <span className="text-xs font-semibold text-zinc-100">Visitor Audience</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[{v: false, l: 'All'}, {v: true, l: 'New Only'}].map(opt => (
                    <button
                      key={String(opt.v)}
                      onClick={() => onUpdateTriggers('newVisitorOnly', opt.v)}
                      className={`py-1.5 px-2 rounded text-[10px] font-medium border transition-all cursor-pointer ${
                        campaign.triggers.newVisitorOnly === opt.v
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100'
                      }`}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>

              {/* 7.5. Page Targeting Rules */}
              <div className="p-3.5 border border-zinc-800 rounded-lg bg-zinc-900 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-zinc-400" />
                  <span className="text-xs font-semibold text-zinc-100">Page Targeting Rules</span>
                </div>
                <div className="bg-white rounded-lg p-2">
                  <TargetingRuleBuilder
                    rules={campaign.triggers.pageTargetingRules || []}
                    onChange={(rules) => onUpdateTriggers('pageTargetingRules', rules)}
                  />
                </div>
              </div>

              {/* 7.6. Smart Affiliate Detection */}
              <div className="p-3.5 border border-zinc-800 rounded-lg bg-zinc-900 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-zinc-400" />
                    <span className="text-xs font-semibold text-zinc-100">Smart Product Match</span>
                  </div>
                  <button
                    onClick={() => onUpdateTriggers('enableSmartAffiliate', !campaign.triggers.enableSmartAffiliate)}
                    className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${
                      campaign.triggers.enableSmartAffiliate ? 'bg-indigo-600' : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                        campaign.triggers.enableSmartAffiliate ? 'translate-x-4' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-[10.5px] text-zinc-600 leading-normal">Automatically scrape the current page for product details and override the popup's static image and CTA link with the page's actual product.</p>
              </div>

              {/* 8. Session Page Count */}
              <div className="p-3.5 border border-zinc-800 rounded-lg bg-zinc-900 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-zinc-400" />
                    <span className="text-xs font-semibold text-zinc-100">Session Page Count</span>
                  </div>
                  <span className="text-[11px] font-mono font-medium text-zinc-100 bg-zinc-800 px-2 py-0.5 rounded">
                    {(campaign.triggers.sessionPageCount > 0) ? `After ${campaign.triggers.sessionPageCount}p` : 'Disabled'}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={campaign.triggers.sessionPageCount ?? 0}
                  onChange={(e) => onUpdateTriggers('sessionPageCount', parseInt(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer h-1 bg-zinc-700 rounded-lg"
                />
                <p className="text-[10.5px] text-zinc-600 leading-normal font-sans">Fire after visitor views N pages in same session.</p>
              </div>

              {/* 9. UTM Filter */}
              <div className="p-3.5 border border-zinc-800 rounded-lg bg-zinc-900 space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-zinc-400" />
                  <span className="text-xs font-semibold text-zinc-100">UTM Filter</span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  <select
                    value={campaign.triggers.utmParam ?? 'utm_source'}
                    onChange={(e) => onUpdateTriggers('utmParam', e.target.value)}
                    className="col-span-2 text-xs p-2 border border-zinc-700 rounded bg-zinc-800 text-zinc-100 focus:border-indigo-500 outline-hidden font-mono"
                  >
                    <option value="utm_source">utm_source</option>
                    <option value="utm_medium">utm_medium</option>
                    <option value="utm_campaign">utm_campaign</option>
                    <option value="utm_term">utm_term</option>
                    <option value="utm_content">utm_content</option>
                  </select>
                  <input
                    type="text"
                    placeholder="e.g. instagram, newsletter…"
                    value={campaign.triggers.utmValue ?? ''}
                    onChange={(e) => onUpdateTriggers('utmValue', e.target.value)}
                    className="col-span-3 text-xs p-2 border border-zinc-700 rounded bg-zinc-800 text-zinc-100 focus:border-indigo-500 outline-hidden font-mono placeholder:text-zinc-600"
                  />
                </div>
                <p className="text-[10.5px] text-zinc-600 leading-normal">Only show to visitors whose chosen UTM parameter matches this value (case-insensitive). Matches the current URL or the visitor's first-touch UTM. Leave the value empty for all.</p>
              </div>

              {/* 9.5. Campaign Schedule */}
              <div className="p-3.5 border border-zinc-800 rounded-lg bg-zinc-900 space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-zinc-400" />
                  <span className="text-xs font-semibold text-zinc-100">Campaign Schedule</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-[10.5px] text-zinc-500 block mb-1">Starts</span>
                    <input
                      type="datetime-local"
                      value={campaign.triggers.startsAt ?? ''}
                      onChange={(e) => onUpdateTriggers('startsAt', e.target.value)}
                      className="w-full text-xs p-2 border border-zinc-700 rounded bg-zinc-800 text-zinc-100 focus:border-indigo-500 outline-hidden"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10.5px] text-zinc-500 block mb-1">Ends</span>
                    <input
                      type="datetime-local"
                      value={campaign.triggers.endsAt ?? ''}
                      onChange={(e) => onUpdateTriggers('endsAt', e.target.value)}
                      className="w-full text-xs p-2 border border-zinc-700 rounded bg-zinc-800 text-zinc-100 focus:border-indigo-500 outline-hidden"
                    />
                  </label>
                </div>
                <p className="text-[10.5px] text-zinc-600 leading-normal">The popup only fires within this window, evaluated in each <strong className="text-zinc-400">visitor's local time</strong>. Leave a field empty for no bound (starts now / never expires).</p>
              </div>

              {/* 10. A/B Testing — now handled by real weighted variants on Campaign Detail */}
              <div className="p-3.5 border border-zinc-800 rounded-lg bg-zinc-900 space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-zinc-400" />
                  <span className="text-xs font-semibold text-zinc-100">A/B Testing</span>
                </div>
                <p className="text-[10.5px] text-zinc-600 leading-normal">
                  Run real split tests with weighted variants from the <strong className="text-zinc-400">A/B Test</strong> panel
                  on the campaign's detail page — create variants, set their traffic split, and compare results per variant.
                </p>
              </div>

              {/* 11. Frequency Cap */}
              <div className="p-3.5 border border-zinc-800 rounded-lg bg-zinc-900 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-zinc-400" />
                    <span className="text-xs font-semibold text-zinc-100">Frequency Cap</span>
                  </div>
                  <span className="text-[11px] font-mono font-medium text-zinc-100 bg-zinc-800 px-2 py-0.5 rounded">
                    Every {campaign.triggers.frequencyCapDays}d
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="90"
                  value={campaign.triggers.frequencyCapDays}
                  onChange={(e) => onUpdateTriggers('frequencyCapDays', parseInt(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer h-1 bg-zinc-700 rounded-lg"
                />
                <p className="text-[10.5px] text-zinc-600 leading-normal">Minimum days before showing this popup to the same visitor again.</p>
              </div>

            </div>
          </div>
        )}

        {/* BRANDS DRAWER */}
        {activeTab === 'brands' && (
          <div className="flex h-full flex-col text-left font-sans">
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-white tracking-tight uppercase font-mono">Brand Architect</h3>
              <p className="text-[11px] text-zinc-500 mt-1 leading-normal">Enforce art-directed color palettes and cohesive font families dynamically in one click.</p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
              <div className="space-y-2.5">
                {BRAND_PALETTES.map((brand) => (
                  <div
                    key={brand.id}
                    onClick={() => applyBrandStyle(brand)}
                    className="p-3 border border-zinc-800 rounded-lg hover:border-zinc-600 cursor-pointer bg-zinc-900 group flex flex-col gap-2 transition-all duration-150"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-zinc-100 group-hover:text-white transition-colors">
                        {brand.name}
                      </span>
                      <span className="text-[9px] bg-zinc-800 px-1.5 py-0.5 rounded font-mono font-medium text-zinc-400 uppercase tracking-widest">
                        {brand.fontHeading}
                      </span>
                    </div>

                    {/* Color layout indicators */}
                    <div className="flex items-center gap-1.5">
                      <span className="h-3.5 w-3.5 border border-white/10 rounded-full shrink-0" style={{ backgroundColor: brand.backgroundColor }} title="Canvas BG" />
                      <span className="h-3.5 w-3.5 border border-white/10 rounded-full shrink-0" style={{ backgroundColor: brand.primaryColor }} title="Primary" />
                      <span className="h-3.5 w-3.5 border border-white/10 rounded-full shrink-0" style={{ backgroundColor: brand.secondaryColor }} title="Secondary" />
                      <span className="h-3.5 w-3.5 border border-white/10 rounded-full shrink-0" style={{ backgroundColor: brand.textColor }} title="Text" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* LAYERS DRAWER */}
        {activeTab === 'layers' && (
          <div className="flex h-full flex-col text-left font-sans">
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-white tracking-tight uppercase font-mono">Canvas Layers ({elements.length})</h3>
              <p className="text-[11px] text-zinc-500 mt-1 leading-normal">Control stacking hierarchy, rename elements, toggle visibility, or drag indices.</p>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin">
              {elements.length === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center p-4 border border-dashed border-zinc-800 rounded-lg bg-zinc-900">
                  <Layers className="h-6 w-6 text-zinc-700 mb-2" />
                  <span className="text-[11px] text-zinc-600 font-medium text-center leading-normal">Empty canvas. Click Elements tab to insert nodes.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {elements
                    .slice()
                    .sort((a,b) => b.zIndex - a.zIndex) // Display highest z-index layers on top
                    .map((el) => {
                      const isSelected = selectedElementId === el.id;
                      const customName = (el.extraProps?.title as string) || el.type;
                      const isHidden = el.opacity === 0;

                      return (
                        <div 
                          key={el.id}
                          onClick={() => {
                            if (onSelectElement) onSelectElement(el.id);
                          }}
                          className={`p-2.5 border rounded-lg flex items-center justify-between transition-all duration-150 cursor-pointer ${
                            isSelected 
                              ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600' 
                              : 'border-zinc-200 bg-zinc-50/50 hover:bg-zinc-100/50'
                          }`}
                        >
                          <div className="flex-1 overflow-hidden text-left flex items-center gap-2">
                            {/* Type Icon indicator tag (Puck style catalog) */}
                            <div className="h-7 w-7 rounded-md bg-white border border-zinc-200 flex items-center justify-center shrink-0">
                              {el.type === 'heading' && <Type className="h-3.5 w-3.5 text-zinc-650" />}
                              {el.type === 'text' && <Sliders className="h-3.5 w-3.5 text-zinc-455" />}
                              {el.type === 'button' && <Zap className="h-3.5 w-3.5 text-indigo-500" />}
                              {el.type === 'image' && <Image className="h-3.5 w-3.5 text-emerald-500" />}
                              {el.type === 'countdown' && <Clock className="h-3.5 w-3.5 text-blue-500" />}
                              {el.type === 'input' && <FormInput className="h-3.5 w-3.5 text-orange-500" />}
                              {el.type === 'review' && <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />}
                              {el.type === 'qrcode' && <QrCode className="h-3.5 w-3.5 text-purple-500" />}
                              {el.type === 'urgency' && <ShieldAlert className="h-3.5 w-3.5 text-rose-500 animate-pulse" />}
                              {!['heading','text','button','image','countdown','input','review','qrcode','urgency'].includes(el.type) && <Layers className="h-3.5 w-3.5 text-zinc-400" />}
                            </div>

                            <div className="flex flex-col overflow-hidden leading-tight">
                              {renamingId === el.id ? (
                                <input
                                  type="text"
                                  value={renamingName}
                                  autoFocus
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => setRenamingName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.stopPropagation();
                                      if (onUpdateElement) {
                                        onUpdateElement(el.id, 'extraProps', {
                                          ...(el.extraProps || {}),
                                          title: renamingName
                                        });
                                      }
                                      setRenamingId(null);
                                    }
                                  }}
                                  onBlur={() => {
                                    if (onUpdateElement) {
                                      onUpdateElement(el.id, 'extraProps', {
                                        ...(el.extraProps || {}),
                                        title: renamingName
                                      });
                                    }
                                    setRenamingId(null);
                                  }}
                                  className="text-xs p-1 border border-zinc-400 rounded bg-white font-sans text-black focus:outline-none"
                                />
                              ) : (
                                <span 
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    setRenamingId(el.id);
                                    setRenamingName(customName);
                                  }}
                                  className="text-[10px] font-bold text-zinc-700 tracking-wide font-mono hover:underline uppercase block cursor-pointer"
                                  title="Double click to rename custom layer label"
                                >
                                  {customName}
                                </span>
                              )}
                              
                              <span className="text-[11px] text-zinc-500 truncate mt-0.5 max-w-[140px]">
                                {el.content || `(${el.type} container block)`}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            {/* Layer Visibility Toggle Eye icon */}
                            <button
                              onClick={() => {
                                if (onUpdateElement) {
                                  onUpdateElement(el.id, 'opacity', isHidden ? 1 : 0);
                                }
                              }}
                              className={`p-1 rounded cursor-pointer transition-colors hover:bg-zinc-200 ${
                                isHidden ? 'text-zinc-300' : 'text-zinc-650 hover:text-black'
                              }`}
                              title={isHidden ? 'Show segment layer on canvas' : 'Hide segment layer (Sets opacity 0)'}
                            >
                              {isHidden ? <EyeOff className="h-3.5 w-3.5 text-amber-500" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>

                            {/* Layer Up */}
                            <button
                              onClick={() => onReorderElement(el.id, 'up')}
                              className="p-1 rounded hover:bg-zinc-200 hover:text-zinc-950 text-zinc-400 transition-colors cursor-pointer"
                              title="Bring layer forward (Z-index +1)"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>

                            {/* Layer Down */}
                            <button
                              onClick={() => onReorderElement(el.id, 'down')}
                              className="p-1 rounded hover:bg-zinc-200 hover:text-zinc-950 text-zinc-400 transition-colors cursor-pointer"
                              title="Send layer backward (Z-index -1)"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>

                            {/* Delete layer */}
                            <button
                              disabled={el.id === 'close-btn'}
                              onClick={() => onRemoveElement(el.id)}
                              className={`p-1 rounded transition-colors text-zinc-400 font-medium cursor-pointer ${
                                el.id === 'close-btn' ? 'opacity-20 cursor-not-allowed' : 'text-zinc-400 hover:bg-red-50 hover:text-red-600'
                              }`}
                              title="Delete element node"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
