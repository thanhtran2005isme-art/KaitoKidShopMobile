# Orders — Page Design Override

Applies to `apps/mobile/src/app/orders/index.tsx` and the Mobile/Expo orders list.

This page follows `design-system/kaitokid/MASTER.md` and the Phase 7 rules in `docs/UI_UX.md`. The rules below override the Master only where the Orders list needs page-specific behavior.

## Product and UX intent

- Surface: post-purchase order management.
- Primary user need: scan order status quickly, reopen an order safely, and refresh server state.
- Style: Fashion Commerce × Minimal Swiss; neutral surfaces, strong hierarchy, restrained purple.
- Do not turn order history into a decorative dashboard or card carousel.

## Layout hierarchy

1. Compact back/header block.
2. Horizontal order-status filter rail.
3. Error/loading state when needed.
4. Virtualized vertical order list.

The order list must own the remaining vertical space.

## Filter rail

Required filters remain:

- Tất cả
- Chờ xử lý (`pending + confirmed`)
- Đang giao
- Hoàn tất
- Đã hủy

Rules:

- Each filter is a compact 44px touch target with text + count.
- Active state uses purple soft background + visible border + semantic selected state.
- The horizontal `ScrollView` must never grow to fill the vertical viewport.
- On Expo Web, explicitly keep the filter scroller non-flexing (`flexGrow: 0`, bounded height) and center its content vertically.
- Filters scroll horizontally on narrow screens; they must never become tall vertical cards/columns.

## Order card hierarchy

Each card prioritizes:

1. order code + created time;
2. text status badge with semantic color;
3. up to two real product previews using `expo-image`;
4. quantity + total amount;
5. one clear `Xem chi tiết đơn hàng` affordance using the project icon system.

The whole card remains the primary touch target. Do not add nested competing primary actions on the list card.

## Visual rules

- Mobile gutter: 16px.
- Card radius: 18px, one neutral border, no heavy shadow.
- Product preview: fixed dimensions with `contentFit="cover"` to avoid layout shift.
- Total amount uses high-contrast ink; orange is not required for transactional totals.
- Purple is reserved for selected filter state and the detail affordance.
- No Unicode/emoji arrows; use `AppIcon`/`expo-symbols`.

## States and behavior

- Keep `FlatList`, stable keys, pull-to-refresh and windowing.
- Keep loading, error + retry, empty state and unauthenticated state.
- Empty history has one useful action: continue shopping.
- A filtered empty result should explain that another filter can be selected.
- No fake orders, status, shipping events or totals.
- Order status/filter semantics remain sourced from `utils/order-status.ts`.

## Accessibility

- Back, filters, retry and other interactive controls require labels/roles.
- Filter selected state must be exposed with `accessibilityState.selected`.
- Practical touch targets are at least 44px.
- Status cannot be communicated by color alone; badge text is mandatory.

## Responsive acceptance

Review at minimum on Expo Web/mobile widths around 375–412px and larger tablet widths.

Acceptance criteria:

- no horizontal page overflow;
- filter rail height stays compact;
- no chip/card stretches vertically;
- order list remains immediately visible below filters;
- card text does not collide with status badge or total;
- product media remains fixed-ratio and undistorted.
