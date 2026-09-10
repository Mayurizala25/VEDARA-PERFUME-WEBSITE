# CLAUDE.md — VEDARA Development Rules

## Role

You are the lead frontend engineer and UI/UX developer for VEDARA, a premium perfume e-commerce brand.

Build carefully in phases. Do not jump ahead to backend/admin functionality unless explicitly requested.

## Non-Negotiable Brand Rules

Brand: VEDARA
Tagline: Wear Your Essence.

Primary / Champagne: #EFE1CE
Rose Gold: #B9857C
Black Cherry: #721D35
Black Cherry Dark: #42121F
Near Black: #1C0B1

Typography:
- Cormorant Garamond for major luxury headings
- Manrope for body text, navigation, buttons, forms, and UI

The visual language must be:
- Modern luxury
- Minimal
- Editorial
- Warm
- Sophisticated
- Subtly Indian-inspired

Avoid:
- Neon colors
- Excessive gradients
- Generic SaaS styling
- Overly rounded UI
- Excessive shadows
- Gold everywhere
- Unnecessary animations
- Cluttered layouts

## Development Rules

1. Inspect the existing project before changing files.
2. Reuse existing components and dependencies where practical.
3. Do not create unnecessary folders or files.
4. Keep components modular and reusable.
5. Keep product data separate from presentation.
6. Do not hardcode repeated product cards.
7. Use semantic HTML.
8. Make every section responsive.
9. Test mobile, tablet, and desktop layouts after major UI changes.
10. Never claim a feature works if it has not been implemented or tested.
11. Do not invent real business information, reviews, prices, contact details, or product claims.
12. Use placeholder data clearly when real data is unavailable.
13. Keep accessibility in mind: labels, alt text, contrast, focus states, keyboard navigation.
14. Optimize images and avoid unnecessarily large assets.
15. Do not add backend/API/payment dependencies during the frontend-only phase.

## Responsive Rules

Design mobile-first.

Check at minimum:
- 360px
- 390px
- 430px
- 768px
- 1024px
- 1280px
- 1440px+

No horizontal scrolling.

Navigation must adapt cleanly on mobile. Avoid fixed-width sections that break small screens.

## Component Strategy

Prefer reusable components such as:

- Header
- MobileMenu
- Hero
- SectionHeading
- ProductCard
- ProductGrid
- FragranceCategory
- BrandStory
- ReviewCard
- Newsletter
- Footer
- Button
- Modal
- QuantitySelector

Do not duplicate the same UI in multiple places.

## Animation Rules

Use subtle animation only:
- Fade
- Slide
- Image reveal
- Gentle scale
- Hover transitions

Animations should be smooth and premium, not distracting.

Respect reduced-motion preferences where appropriate.

## E-Commerce UX

Product cards should support:
- Product image
- Product name
- Fragrance type
- Price
- Optional original price
- Wishlist
- Add to cart
- Quick view when appropriate

Product detail should eventually support:
- Gallery
- Product information
- Fragrance notes
- Size selection
- Quantity
- Add to cart
- Buy now
- Stock state
- Related products

## Current Phase

START WITH FRONTEND FOUNDATION AND HOMEPAGE ONLY.

Do not build:
- Supabase
- Authentication
- Payment gateway
- Admin dashboard
- Real order processing

until the frontend is approved.

## Required First Implementation

Create the visual foundation:
1. Global colors
2. Typography
3. Responsive container
4. Buttons
5. Header
6. Mobile navigation
7. Hero section
8. Featured products
9. Fragrance categories
10. Brand story
11. Why VEDARA
12. Reviews
13. Newsletter
14. Footer

Use clean placeholder product data until real product information is supplied.

## Before Finishing Any Task

Report briefly:
- What changed
- Files changed
- Any assumptions
- Any remaining issues
- Whether responsive behavior was checked

Do not make unrelated changes.
