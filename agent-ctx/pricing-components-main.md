# Task: Build PricingPage and PremiumPlanModal Components

## Agent: Main Developer
## Status: Completed

## What was built:

### 1. PricingPage (`/home/z/my-project/src/components/campus/PricingPage.tsx`)
- Full pricing page with Normal and Premium plan cards
- Header section with gradient text "Choose Your Plan" and back button
- Current Plan Status Banner for logged-in users (fetches from `/api/payment?userId=xxx`)
- Two pricing cards in responsive grid (2-col desktop, stacked mobile)
  - Normal Plan: Free to Start, 5 features with check icons, outline CTA
  - Premium Plan: ₹149/30 days, Crown icon, "MOST POPULAR" badge, gold glow border, 7 features, gradient CTA
- Collapsible FAQ section with 5 questions (AnimatePresence for smooth open/close)
- Feature comparison table between Normal and Premium plans
- Framer Motion animations (stagger, fade-in, spring transitions)
- CSS classes used: `gradient-text`, `btn-gradient`, brand color variables

### 2. PremiumPlanModal (`/home/z/my-project/src/components/campus/PremiumPlanModal.tsx`)
- Payment modal specifically for Premium plan purchase (₹149)
- 7-step flow: initiating → qr_payment → submit_proof → verifying → success → expired → error
- Calls `POST /api/payment` with `{ userId, paymentType: 'premium_plan' }`
- Shows QR code, UPI ID copy button, 5-minute countdown timer
- UTR number input + optional screenshot upload
- Premium-specific header with amber/orange gradient (different from regular PaymentModal)
- Premium benefits summary badges in header
- Premium-specific success messaging about activation
- Framer Motion spring animations for modal open/close

### 3. Integration
- Added PricingPage to PAGE_COMPONENTS in `page.tsx`
- The 'pricing' PageType was already defined in the store
- Navigation: `setCurrentPage('pricing')` from any component

## Key Design Decisions:
- Used amber/orange color scheme for premium elements (matching the Crown/gold theme)
- Normal plan card uses brand (navy) color scheme
- Premium card has gold glow border effect using absolute-positioned gradient div
- FAQ uses custom collapsible implementation with AnimatePresence
- Comparison table uses responsive horizontal scroll for small screens
- All CSS utility classes (btn-gradient, gradient-text, card-premium) already existed in globals.css

## Lint Status:
- No new lint errors introduced (only pre-existing TranslationContext.tsx issue)
