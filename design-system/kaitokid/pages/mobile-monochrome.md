# Mobile Monochrome Override

Applies only to `apps/mobile` (Android, iOS and Expo Web). It does not change the React/Vite surface in `apps/web`.

## Palette

Mobile commerce chrome uses a black / white / neutral-gray palette:

- Primary/action: `#111111`
- Primary dark: `#000000`
- Soft selected/background: `#F3F4F6`
- Canvas: `#F7F7F7`
- Surface: `#FFFFFF`
- Ink: `#111111`
- Muted: `#6B7280`
- Line: `#E5E7EB`

Do not reintroduce purple/violet/pink/orange as decorative UI chrome, focus, selected, link, icon, badge or gradient colors on Mobile. Selected state must remain understandable through border/fill/text/icon semantics, not color alone.

## Exceptions

- Product, banner, lookbook and category photography keeps its original media colors; never grayscale real fashion imagery.
- Semantic danger/error, success/stock and warning states may retain red/green/amber where the color carries real meaning and is paired with text/icon semantics.
- Actual product color swatches keep the real variant color because that is product data, not theme chrome.

## Scope rule

When changing Mobile UI, prefer `BRAND_COLORS` over page-local accent hex values. Any page-local styling added later must follow this monochrome override unless it is one of the semantic/data exceptions above.
