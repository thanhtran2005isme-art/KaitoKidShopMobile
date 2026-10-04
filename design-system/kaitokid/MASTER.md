# KaitoKid Design System — Master

Generated/synthesized from `skill/.codex/skills/ui-ux-pro-max/` before the UI refactor on 2026-10-02.

## Input

- Product: Fashion e-commerce / retail / marketplace-style shopping.
- Audience: Nam, Nữ, Trẻ em, Unisex; many ages.
- Style intent: modern, clean, youthful, practical fashion, moderate premium, easy to shop, not AI-looking, not decorative-heavy.
- Surfaces: Expo React Native Mobile + React/Vite Web.

## Skill result and project override

The skill classifies the product as **E-commerce** with a **Feature-Rich Showcase** conversion pattern. Generic e-commerce reasoning suggests Vibrant & Block-based styling, success green and urgency orange. KaitoKid's durable brand rules override generic palette/style choices:

- Keep existing brand purple as the primary action/focus color.
- Keep orange only as a controlled accent, not a page-wide dominant color.
- Product photography is the strongest visual element; UI chrome stays neutral.
- Use the clarity, whitespace, grid discipline and restrained motion of **Minimalism & Swiss Style** instead of neon/vibrant block styling.
- Moderate premium comes from image quality, typography, rhythm and restraint — not gold, glassmorphism, neon or AI purple/pink gradients.

## Visual direction

**Fashion Commerce × Minimal Swiss**

- White/near-white surfaces with cool neutral canvas.
- High-contrast ink typography.
- Tight but breathable commerce rhythm.
- Cards use subtle border/depth only where interaction hierarchy needs it.
- Images use fixed aspect ratios and `cover` semantics; never stretch.
- Rounded corners are consistent and moderate, not bubbly.
- No decorative infinite animation in shopping/checkout flows.

## Color tokens

Existing KaitoKid brand tokens remain source of truth:

- Primary: `#7C3AED`
- Primary dark: `#5B21B6`
- Primary soft: `#EDE9FE`
- Accent: `#F97316`
- Accent soft: `#FFF7ED`
- Canvas: `#F8FAFC`
- Surface: `#FFFFFF`
- Ink: `#111827`
- Muted: `#6B7280`
- Line: `#E5E7EB`
- Success: `#047857`
- Danger: `#DC2626`

Usage rules:

- Purple = primary action, selected state, link/focus.
- Orange = small merchandising accent only.
- Green = semantic success/stock only.
- Red = destructive/error/discount only.
- Neutral surfaces should dominate the viewport.
- Never use color alone to communicate state; pair with text/icon.

## Typography

Skill references Fashion Forward (`Syne` + `Manrope`) and Vietnamese-friendly (`Be Vietnam Pro` + `Noto Sans`). Do not add font dependencies just for this refactor.

Use the existing app font stack/system font and enforce hierarchy consistently:

- Display/page title: 24–32, 800–900, compact line-height.
- Section title: 18–22, 800–900.
- Product title: 13–16, 700–800, max 2 lines.
- Body: 14–16, 400–500.
- Metadata: 12–13, 500–600.
- Button: 14–16, 700–800.

Vietnamese diacritics must remain fully legible. Avoid all-caps for long text.

## Spacing

Use a 4px base rhythm:

- 4: micro-gap
- 8: compact internal gap
- 12: control/content gap
- 16: default page/card padding
- 20: section internal spacing
- 24: section separation
- 32: major section separation

Mobile horizontal page gutter: 16px. Web container should use a consistent max width and responsive gutters.

## Radius

- Small control/tag: 8–10
- Input/chip/button: 12–14
- Product/media card: 14–18
- Large panel/sheet: 18–24
- Pills only for chips/status, not every container.

## Elevation and borders

- Default surfaces: 1px neutral border or no border.
- Hoverable desktop card: subtle shadow/border change, 150–220ms.
- Mobile press: opacity/background/border feedback; no layout-shifting scale.
- Avoid stacked heavy shadows, neon glow and glass effects in commerce content.

## Buttons

Primary:
- Purple background, white label.
- 44px+ touch height on Mobile.
- Clear pressed/focus/loading/disabled states.

Secondary:
- White/surface background, neutral visible border, ink label.

Destructive:
- Red semantics only; confirm before destructive account/order actions.

Icon buttons:
- Visible hit area around 44×44 even when glyph is smaller.
- Always provide accessibility label.

## Forms

- Persistent label; placeholder is supplementary only.
- 44–48px minimum control height.
- Field-local error message.
- Visible focus ring/border.
- Correct keyboard/autocomplete types.
- Checkout remains single-column and low-motion.

## Product card

List card is discovery-first, not a miniature product detail page:

1. Product image with stable aspect ratio.
2. Optional small merchandising badges.
3. Wishlist action with 44px hit area.
4. Product name (max 2 lines).
5. Rating/sold meta when real data exists.
6. Current price + optional old price/discount.
7. Compact color preview when real variants exist.

Size selection, quantity and full Add-to-Cart belong to Product Detail unless a dedicated quick-buy flow is explicitly designed and validated.

## Product grid

- Mobile: 2 columns by default; consistent gutters/gaps; never squeeze desktop cards into mobile.
- Tablet/Web: increase columns progressively with min card width and stable media ratio.
- Long lists use virtualization/pagination already supported by each surface.

## Navigation

- Preserve current information architecture and business routes.
- Active state uses purple + text/icon, not color alone.
- Mobile bottom navigation keeps 44px+ interactive targets and safe-area spacing.
- Web navigation gets visible keyboard focus and stable hover feedback.

## State components

Every data surface must define:

- Loading: skeleton or spinner that preserves layout.
- Empty: concise explanation + one useful next action when available.
- Error: human-readable message + retry where safe.
- Disabled/loading actions: prevent duplicate submits.

Do not use fake data to make a state look populated.

## Images

- Mobile remote product media uses `expo-image`.
- Web uses fixed aspect-ratio wrappers + `object-fit: cover`.
- Never `stretch` fashion imagery.
- Reserve dimensions to prevent layout shift.
- Fallbacks must not distort surrounding layout.

## Motion

- Standard transition: 150–220ms.
- Modal/sheet: 220–320ms.
- Respect reduced-motion settings.
- Motion communicates state; no decorative infinite motion in critical commerce flows.
- Hover must not shift surrounding layout.

## Accessibility

- 44×44 minimum practical touch target.
- Text contrast at least WCAG AA; prefer stronger contrast for commerce metadata.
- Visible keyboard focus on Web.
- Screen-reader labels/roles for interactive icons.
- Selected/filter state includes semantics and text, not only color.
- Images have meaningful alt/accessibility labels where appropriate.

## Responsive checkpoints

Review at minimum:

- 375px phone
- 768px tablet
- 1024px laptop
- 1440px desktop

No horizontal scroll on standard mobile content. Fixed/sticky navigation must not obscure page content.

## Anti-patterns

- Agricultural copy/visual language.
- Kids-only assumptions across the whole catalog.
- AI-purple/pink decorative gradients.
- Excessive glassmorphism/neon/glow.
- Too many colored chips/badges competing with product imagery.
- Product cards that become mini product-detail pages.
- Fake reviews/stock/shipping/data.
- Stretched/blurry media.
- Tiny touch targets.
- Placeholder-only forms.
- Multiple near-identical components with drifting styles.
