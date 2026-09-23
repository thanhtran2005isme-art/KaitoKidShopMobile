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

## PHASE 7 Orders + Tracking design system

Orders/Tracking là khu vực quản lý sau mua, ưu tiên khả năng quét nhanh trạng thái và hành động an toàn.

Quy tắc:

- Orders list dùng `FlatList` với key ổn định, pull-to-refresh, loading/error/empty state;
- filter bắt buộc: Tất cả / Chờ xử lý / Đang giao / Hoàn tất / Đã hủy;
- `pending + confirmed` cùng nằm trong filter “Chờ xử lý” để không làm mất đơn đã xác nhận;
- status mapper tập trung ở một utility; badge luôn có **text + semantic color**, không dùng màu đơn độc;
- card đơn hàng ưu tiên order code, ngày, item preview, total và status;
- Order Detail dùng backend `canCancel`; Mobile không tự suy quyền hủy;
- action hủy luôn có confirmation dialog và loading state;
- Reorder phải báo số item added/skipped, refresh cart badge rồi đưa user tới Cart để kiểm tra variant/tồn kho;
- Tracking timeline chỉ render event backend trả về; không tự chèn event “đã giao/đang giao” nếu API chưa ghi nhận;
- ETA chỉ được tính từ `createdAt + leadTimeHours` và phải trình bày là dự kiến;
- Tracking API là owner-only; UI lỗi 404/401 không được suy đoán nội dung đơn khác;
- không dùng animation trang trí; motion chỉ dành cho loading/feedback cần thiết;
- mỗi màn chỉ có một primary action rõ ràng khi có thể.

## PHASE 8 Reviews + Notifications + Account design system

PHASE 8 dùng mô hình **account hub + task screens**: Account là dashboard tổng quan, còn Review/Profile/Points/Vouchers/Notifications/Delete Account là các màn nhiệm vụ riêng.

Quy tắc:

- Account dashboard ưu tiên avatar, name/email/phone, member tier, loyalty points, total orders/spent và entry point rõ;
- unread notification là global badge state nhỏ dưới Auth; profile/loyalty vẫn screen-local để tránh global context phình to;
- notification list dùng `FlatList`, pagination, pull-to-refresh, unread text + badge; mark-read trước khi deep-link;
- chỉ dùng `notification.link` khi backend thật sự trả internal path bắt đầu bằng `/`; không tự suy target từ type;
- Review chỉ mở từ completed Order Item chưa review; route params chỉ là navigation hint, màn phải fetch lại order để kiểm tra;
- Review form single-column, 1–5 sao, comment, purchased variant, tối đa 4 ảnh; submit có hard lock;
- review công khai chỉ render dữ liệu `approved`; review mới pending được phản ánh qua `HasReviewed` ở Order Detail trước khi moderation hoàn tất;
- Product Detail có verified-purchase badge, media, admin reply, Helpful và khả năng mở toàn bộ review đã duyệt;
- Profile dùng label luôn hiển thị, field-local validation, KeyboardAvoidingView và avatar gallery picker;
- Loyalty/Voucher chỉ hiển thị giá trị server trả; Mobile không tự sinh coupon, tier hoặc số điểm quy đổi;
- delete-account có route riêng + keyword `DELETE` + destructive confirmation; protected state phải clear sau logout;
- mọi action upload/redeem/submit/destructive có loading/disabled feedback và chống double tap;
- action mới phải giữ vùng bấm khoảng 44px trở lên; icon overlay nhỏ phải tăng hitSlop;
- PHASE 8 dùng `expo-image-picker` SDK 57 gallery-only; không xin camera/microphone và không làm video review vì flow video chưa cần cho core.

## PHASE 9 Collections + Lookbook + Recommendation design system

PHASE 9 dùng mô hình **discovery cards + immersive shop-the-look + explainable recommendations**, giữ KaitoKid là e-commerce trẻ em thực dụng thay vì biến Home thành feed quá dài.

Quy tắc:

- Collection/Lookbook list dùng card ảnh lớn, hierarchy title → mô tả/meta → action; không nhồi nhiều CTA trên một card.
- Collection product grid tái sử dụng `ProductCard` + `ShoppingContext` để wishlist luôn đồng bộ; sorting là chip 44px và query lại backend.
- List/grid dài dùng `FlatList`, stable key; Expo Web giới hạn `maxWidth` và thay số cột theo viewport.
- Ảnh remote dùng `expo-image` + kích thước/aspect ratio rõ để tránh layout shift.
- Lookbook hotspot lấy `X/Y` phần trăm `0..100`; vị trí pixel tính từ layout ảnh render, clamp để pin 44px không tràn khỏi ảnh.
- Hotspot có số thứ tự + accessibilityLabel; tap hiển thị mini product card trước khi mở Product Detail để tránh điều hướng nhầm.
- Season/style filters dùng selected state có text + màu; “Tất cả” luôn có đường quay về.
- Recommendation personalized chỉ dùng copy “Gợi ý cho bạn” khi backend trả `isPersonalized=true`. Guest/fallback dùng copy trung tính như “Khám phá thêm”.
- Home chỉ render Collection/Lookbook/Recommendation section khi có data; không để empty block làm Home dài.
- Không thêm animation trang trí nặng; pressed/loading feedback đủ rõ.
- Tất cả screen mới có loading/error/empty/retry thích hợp và touch target chính khoảng 44px.

## Source of truth

- Brand/data language: `docs/BRAND.md`
- Durable UI/UX workflow + KaitoKid overrides: file này
- Codex design intelligence: `skill/.codex/skills/ui-ux-pro-max/`
- Current implementation: Git `main`
