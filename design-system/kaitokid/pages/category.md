# Category Page Override — KaitoKid

This page-specific override extends `design-system/kaitokid/MASTER.md` for Mobile + Web category/catalog browsing.

## Goal

Make browsing fast, fashionable and conversion-friendly without turning the catalog into a decorative landing page.

## Information hierarchy

1. Compact page heading + useful result context.
2. Audience/category navigation.
3. Search/filter/sort controls.
4. Active filter summary / clear-all when applicable.
5. Product grid.
6. Pagination/load-more/infinite behavior already supported by current logic.

## Mobile

- Mobile-first, 16px page gutter.
- Sticky/compact top controls only if they do not cover content.
- 2-column product grid on normal phones.
- Filter and sort actions each have ~44px touch target.
- Category chips scroll horizontally rather than shrinking text.
- Product media ratio stays stable and uses `cover`.
- Do not show full size selector/quantity/add-to-cart controls in every grid card.
- Filter UI should use existing data fields and API params only.
- Preserve loading/error/empty states in the same page geometry.

## Web

- Use a consistent centered container, max width around 1200–1280px.
- Desktop toolbar keeps title/result count on the left and sort/filter controls on the right.
- Filters can become a sidebar/drawer only when backed by existing filter state; do not invent unavailable facets.
- Product grid progresses responsively (2 → 3 → 4 columns depending available width).
- Hover uses border/shadow/color feedback only; no layout-moving scale.
- Keyboard focus must be visible on chips, controls, cards and wishlist actions.

## Product card override

- Image dominates roughly 65–72% of perceived card weight.
- Name max 2 lines.
- Price has stronger hierarchy than metadata.
- Old price/discount render only when real values support them.
- Wishlist is an independent action, never nested inside another button/Pressable.
- Color swatches are compact and optional; no fake variant dots.
- Keep badges sparse: only meaningful real states.

## Empty state

- Clear title describing no matching products.
- Short instruction to remove/adjust filters.
- A single reset action when filter state exists.
- No fake product cards.

## Error state

- Keep user’s current filter/search context.
- Show concise error + retry.
- Do not silently replace API failure with fallback/mock products.

## Loading

- Preserve grid rhythm with skeletons/placeholders when current stack supports it.
- Avoid fullscreen blocking loaders for incremental filter/sort refresh if existing logic can retain content safely.

## Interaction

- 150–220ms feedback.
- Mobile press feedback via opacity/background/border.
- Web hover + focus-visible.
- Respect reduced motion.

## Visual constraints

- Neutral canvas/surface dominate.
- Purple only for selected/action/focus.
- Orange only for small merchandising accents.
- Discount red and stock green remain semantic.
- No decorative glow, mesh gradient, glass panel or neon treatment on catalog controls/cards.
