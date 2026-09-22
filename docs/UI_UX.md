# KaitoKid UI/UX Guide

Last updated: 2026-09-22

Tài liệu này là **durable UI/UX memory** cho các phiên AI/coding sau.

## UI skill bắt buộc

Mọi task có tạo mới, redesign hoặc thay đổi đáng kể UI/UX phải đọc:

`skill/.codex/skills/ui-ux-pro-max/SKILL.md`

Dữ liệu tìm kiếm/design intelligence của skill nằm tại:

`skill/.codex/skills/ui-ux-pro-max/data/`

Guideline riêng cho Mobile React Native:

`skill/.codex/skills/ui-ux-pro-max/data/stacks/react-native.csv`

Skill là công cụ thiết kế, không thay thế source of truth của KaitoKid. Khi có xung đột, ưu tiên code hiện tại, `docs/BRAND.md`, file này và yêu cầu task.

## Workflow bắt buộc trước khi code UI

1. Xác định product type, user, mục tiêu màn hình và stack.
2. Đọc `ui-ux-pro-max/SKILL.md`.
3. Generate/synthesize design system trước khi viết UI.
4. Search/đọc guideline UX, accessibility và stack liên quan.
5. Áp dụng brand override của KaitoKid.
6. Tái sử dụng component/state hiện tại khi hợp lý.
7. Trước commit, review lại checklist của skill và acceptance criteria của task.

Nếu môi trường công cụ không chạy được script search của skill, phải đọc chính script/data của skill và tổng hợp theo cùng logic; không bỏ qua skill rồi thiết kế từ trí nhớ.

## Brand override KaitoKid

KaitoKid là thời trang trẻ em 0–12 tuổi. Người mua chủ yếu là phụ huynh/người chăm sóc, vì vậy commerce UI cần thân thiện nhưng rõ ràng, thực dụng và dễ kiểm tra.

Mobile dùng token hiện tại từ `apps/mobile/src/constants/brand.ts`:

- Primary: `#7C3AED`
- Primary dark: `#5B21B6`
- Accent: `#F97316`
- Canvas: `#F8FAFC`
- Surface: `#FFFFFF`
- Ink: `#111827`

Không thay palette KaitoKid bằng palette generic do skill gợi ý nếu chưa có quyết định brand mới.

## Mobile interaction rules

Với React Native UI mới:

- ưu tiên `Pressable` cho touch interaction;
- touch target chính tối thiểu khoảng 44×44 px;
- giữ khoảng cách đủ rõ giữa các action cạnh nhau;
- thêm `accessibilityLabel`, `accessibilityRole`, selected/checked state khi phù hợp;
- không dùng màu sắc làm tín hiệu trạng thái duy nhất;
- form phải có label luôn hiển thị, không dựa vào placeholder;
- validation/error nên hiển thị sát field hoặc interaction gây lỗi;
- dùng `KeyboardAvoidingView` cho màn nhiều input;
- dùng keyboard type phù hợp cho phone/email/numeric;
- dùng `expo-image` cho ảnh remote/product;
- có pressed/loading/disabled feedback;
- tránh animation thừa trong critical flow như checkout;
- không thêm emoji làm icon UI mới; dùng icon treatment nhất quán của project;
- trên Expo Web, giới hạn max content width thay vì kéo layout mobile toàn màn hình.

## PHASE 6 Checkout design system

Checkout dùng flow tập trung, single-column, ưu tiên giảm sai sót hơn trang trí.

Hierarchy:

1. selected products;
2. địa chỉ giao hàng;
3. shipping service + fee + ETA;
4. coupon/combo;
5. payment method;
6. tổng tiền;
7. explicit review;
8. create order.

Quy tắc kỹ thuật/UX đã chốt:

- selected `CartItemIds` nằm trong scoped checkout state, không nhét toàn bộ state vào query params;
- Address management là route riêng, quay lại Checkout bằng context state;
- shipping options là radio-style choice và backend **re-quote** khi tạo order;
- subtotal/coupon/combo/shipping/payment validity đều được backend xác thực lại;
- COD/ATM availability và bank/QR instructions đến từ backend/store settings;
- ATM có payment pending screen, countdown, status polling và cancel;
- dev-only simulate-paid chỉ render khi backend cho phép;
- create-order phải có hard submission lock chống double tap;
- Order Success nhấn mạnh order code và next action;
- Web không gửi `CartItemIds` vẫn giữ all-cart checkout để backward-compatible.

## Source of truth

- Brand/data language: `docs/BRAND.md`
- Durable UI/UX workflow + KaitoKid overrides: file này
- Codex design intelligence: `skill/.codex/skills/ui-ux-pro-max/`
- Current implementation: Git `main`
