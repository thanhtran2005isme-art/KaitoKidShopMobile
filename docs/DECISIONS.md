# Technical Decisions

This file records durable decisions and their rationale. It is not a chronological transcript.

## D001 — Use a full-stack monorepo

**Date:** 2026-09-21

**Decision:** Keep client applications under `apps/`, backend code under `backend/`, development launchers under `scripts/`, and documentation under `docs/`.

**Rationale:** The previous repository mixed mobile source at the root, backend under `BACKEND/`, and web under a nested `web/kaito-kid-react/` directory. The normalized structure makes ownership and tooling clearer.

**Consequence:** Do not move mobile/web source trees back to the repository root.

## D002 — Keep a root `run.bat` for the common mobile workflow

**Date:** 2026-09-21

**Decision:** Keep `run.bat` at repository root as a convenience launcher for API.Auth, API.Customer and Expo Mobile.

**Rationale:** The developer frequently uses the mobile stack and wants a one-click Windows workflow.

**Consequence:** Lower-level scripts remain in `scripts/`, while root `run.bat` acts as the convenient entry point.

## D003 — Use MariaDB locally through Pomelo

**Date:** 2026-09-21

**Decision:** Runtime backend persistence uses MariaDB 10.4.x / MySQL protocol through `Pomelo.EntityFrameworkCore.MySql`.

**Rationale:** The local development environment uses XAMPP MariaDB 10.4.32.

**Consequence:** Backend DbContexts use `AddMariaDb<TContext>()` / `UseMySql`. Legacy SQL Server migrations are retained only as historical material.

## D004 — Use one consolidated MariaDB schema for a fresh local database

**Date:** 2026-09-21

**Decision:** For a fresh MariaDB setup, use `backend/Database/KaitoKid_MariaDB.sql` rather than independently applying the legacy EF migration trees.

**Rationale:** Multiple DbContexts overlap tables, while the consolidated schema represents the intended local database.

**Consequence:** Do not run the old SQL Server migrations against MariaDB.

## D005 — Keep local DB credentials outside Git

**Date:** 2026-09-21

**Decision:** Store the local connection string in `backend/db.local.bat`, generated from `backend/db.local.example.bat`.

**Rationale:** A real password must not be committed, while the Windows launcher still needs a one-click development experience.

**Consequence:** `backend/db.local.bat` is gitignored and loaded through `scripts/load-db-local.bat`.

## D006 — Use short-lived branches + PRs for meaningful changes

**Date:** 2026-09-21

**Decision:** Develop meaningful changes on focused branches, merge through PRs, then delete stale merged branches.

**Rationale:** This provides reviewable history and safer rollback without turning branches into permanent documentation.

**Consequence:** Project memory is kept in Git history and `docs/`, not in long-lived “memory branches”.

## D007 — Treat Git + structured docs as durable AI project memory

**Date:** 2026-09-21

**Decision:** New AI/chat sessions should reconstruct context from `AGENTS.md`, `docs/AI_HANDOFF.md`, architecture/decision/troubleshooting docs, relevant source, and Git history.

**Rationale:** Chat memory is not a reliable store for an entire repository, every commit, and a long-running transcript.

**Consequence:** Keep `AI_HANDOFF.md` current and concise. Move old chronology to `docs/history/` rather than letting one file grow indefinitely.


## D008 — Viết commit message bằng tiếng Việt

**Ngày:** 2026-09-22

**Quyết định:** Mọi commit do AI/GPT tạo trong repository KaitoKidShop phải có phần mô tả bằng tiếng Việt.

**Lý do:** Dự án được người phát triển theo dõi và trao đổi chủ yếu bằng tiếng Việt. Commit tiếng Việt giúp lịch sử Git dễ đọc, dễ tra cứu và giúp các phiên ChatGPT/AI sau hiểu nhanh mục đích thay đổi.

**Quy ước:** Có thể dùng tiền tố Conventional Commits bằng tiếng Anh như `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`; phần mô tả sau tiền tố phải là tiếng Việt. Ví dụ: `fix: sửa ảnh sản phẩm bị 404`.

**Hệ quả:** Trước khi commit, AI phải kiểm tra commit message đã mô tả đúng thay đổi và dùng tiếng Việt, trừ khi người dùng yêu cầu rõ ràng một ngôn ngữ khác.


## D009 — Chốt KaitoKid là thời trang trẻ em 0–12 tuổi

**Ngày:** 2026-09-22

**Quyết định:** KaitoKid được định vị thống nhất là thương hiệu thời trang trẻ em 0–12 tuổi, không phải shop thời trang nam/nữ người lớn.

**Lý do:** Tên thương hiệu, mobile UI và định hướng sản phẩm cần cùng một thông điệp. Dữ liệu cũ trộn thời trang người lớn làm Home, category và Product Detail mâu thuẫn với thương hiệu.

**Quy ước dữ liệu:** Sản phẩm mẫu dùng `NhomTuoi = TreEm`; `GioiTinh = Nam/Nu/Unisex` được UI diễn giải thành bé trai/bé gái/unisex. Size trẻ em ưu tiên theo chiều cao 90–150.

**Hệ quả:** Mọi dữ liệu, copy, banner, collection và UI mới phải tuân theo `docs/BRAND.md`. Không thêm lại nội dung kiểu công sở người lớn, body/quyến rũ hoặc category nam/nữ người lớn nếu không có quyết định thay đổi thương hiệu mới.


## D010 — Product Detail dùng tồn kho biến thể thật khi có

**Ngày:** 2026-09-22

**Quyết định:** Product Detail ưu tiên tồn kho khả dụng từ `TonKhoBienThe` theo cặp `(size, màu)`. Nếu sản phẩm chưa có dữ liệu biến thể, UI fallback về `SanPham.TonKho` và danh sách `DanhSachMau/DanhSachSize`.

**Lý do:** Add to Cart ở PHASE 4 phải dựa trên lựa chọn size/màu hợp lệ và không được giả định mọi tổ hợp đều còn hàng khi backend đã có tồn kho biến thể.

**Quy tắc:** `Available = Stock - Reserved` là số lượng dùng để quyết định biến thể còn hàng. Product Detail vẫn được phép mở sản phẩm có trạng thái `out-of-stock` để người dùng xem thông tin; các danh sách bán hàng vẫn có thể lọc chỉ `active`.

**Hệ quả:** Khi nối Add to Cart, phải tái sử dụng state màu/size/số lượng của Product Detail và tôn trọng `variantInventory`; không tự tạo stock giả ở mobile.


## D011 — Dùng ShoppingContext làm state mua sắm chung trên mobile

**Ngày:** 2026-09-22

**Quyết định:** Wishlist state và cart badge được quản lý tập trung trong `ShoppingContext`, đặt bên trong `AuthProvider`.

**Lý do:** ProductCard xuất hiện ở Home, Category, Search, Related Products và Wishlist. Nếu mỗi card tự gọi Wishlist/Cart API sẽ gây nhiều request trùng và state không đồng bộ giữa các màn.

**Hệ quả:** Các màn/component cần wishlist hoặc cart count phải dùng `useShopping()`. Không tạo lại hook cart badge riêng theo từng màn.

## D012 — Reserve tồn kho ở cả cấp sản phẩm và biến thể

**Ngày:** 2026-09-22

**Quyết định:** Khi item được thêm vào giỏ, backend tăng `SanPham.SoLuongDaGiu` cho tổng sản phẩm và, nếu có variant, đồng thời tăng `TonKhoBienThe.SoLuongDaGiu` cho đúng cặp size/màu.

**Lý do:** Seed hiện chưa có `TonKhoBienThe` nhưng production có thể có. Chỉ reserve variant làm tồn tổng trên ProductCard sai; chỉ reserve product làm mất kiểm soát size/màu. Hai cấp phải đồng bộ.

**Quy tắc:** `AvailableStock = Stock - Reserved`. Add/update/remove/cart-expiry/checkout phải cập nhật reserve đối xứng. Request Add to Cart phải validate product đang `active`, quantity > 0, size/màu hợp lệ và variant tồn tại nếu sản phẩm có inventory biến thể.

**Hệ quả:** Không được bypass reservation bằng cách ghi trực tiếp vào `GioHang`. Luồng Cart/Checkout tiếp theo phải đi qua CartService để giữ invariant tồn kho.


## D013 — Một task/fix/PHASE chỉ dùng một commit mặc định

**Ngày:** 2026-09-22

**Quyết định:** Mặc định mỗi yêu cầu sửa, mỗi task hoặc mỗi PHASE chỉ tạo **một commit tổng hợp**.

**Lý do:** Việc commit từng file hoặc từng bước nhỏ làm lịch sử Git rất dài và khó đọc. PHASE 4 đã tạo quá nhiều commit trung gian dù về mặt người dùng đó là một công việc duy nhất.

**Quy tắc triển khai:**

- Không commit ngay sau mỗi lần sửa file.
- Hoàn thành toàn bộ phạm vi task, static review/build/test phù hợp, cập nhật docs cần thiết, rồi mới commit một lần.
- Khi công cụ cập nhật từng file có hành vi auto-commit, AI phải dùng batch Git tree/commit hoặc cơ chế tương đương để gom nhiều file vào một commit.
- PR của một task/PHASE nên dùng squash merge để `main` chỉ có một commit đại diện.
- Chỉ tách nhiều commit nếu có các thay đổi độc lập cần rollback/review riêng hoặc người dùng yêu cầu.
- Không squash nhiều task không liên quan vào một commit.

**Quy ước tên:** Commit vẫn phải tuân D008 — phần mô tả bằng tiếng Việt. Ví dụ: `feat: hoàn thành phase 5 giỏ hàng mobile`.

**Hệ quả:** Các phiên AI/GPT sau phải tránh cách làm “mỗi file một commit”. Git history trên `main` nên phản ánh các đơn vị công việc có ý nghĩa ở cấp task/fix/PHASE.


## D014 — Bắt buộc dùng skill `.codex` trước khi sửa UI

**Ngày:** 2026-09-22

**Quyết định:** Mọi task/PHASE có sửa hoặc thêm UI/UX phải đọc `docs/UI_UX.md` và dùng `skill/.codex/skills/ui-ux-pro-max/SKILL.md` trước khi viết giao diện.

**Quy trình:** Generate/search design system trước, sau đó đọc guideline stack tương ứng; Mobile dùng `react-native`. Brand token hiện có trong `docs/BRAND.md` và `apps/mobile/src/constants/brand.ts` vẫn là source of truth của KaitoKid.

**Lý do:** Repository đã có skill thiết kế riêng; dùng quy trình này giúp UI giữa các phase nhất quán, có accessibility/touch/keyboard/loading/error review và tránh thiết kế cảm tính giữa các phiên AI khác nhau.

**Hệ quả:** `AGENTS.md` và `docs/UI_UX.md` ghi quy tắc này như workflow bắt buộc. Nếu môi trường không chạy được script của skill, agent phải đọc script/data và áp dụng cùng logic/guideline, không được bỏ qua skill.


## D015 — Partial checkout và tổng tiền phải được xác thực server-side

**Ngày:** 2026-09-22

**Quyết định:** Checkout Mobile gửi `CartItemIds` đã chọn. Backend chỉ tạo order từ các ID thuộc đúng user và chỉ xóa/trừ stock/release reserve các item đó.

**Quy tắc source of truth:**

- subtotal lấy từ Product/Cart phía server;
- coupon được validate lại khi tạo order;
- combo discount tính lại trên selected items;
- shipping fee/ETA được quote lại server-side từ địa chỉ + provider/service, không tin fee client;
- payment method phải đang được bật trong cấu hình cửa hàng;
- tài khoản/QR chuyển khoản do backend/store setting trả; Mobile không hard-code gateway hoặc tài khoản.

**Hệ quả:** Item không chọn vẫn còn nguyên trong Cart và tiếp tục giữ reservation. Web checkout gửi thêm structured address để dùng cùng contract shipping an toàn.


## D016 — Order tracking phải owner-only và quyền hủy do backend quyết định

**Ngày:** 2026-09-22

**Quyết định:** `GET /api/shipping/track/{orderCode}` phải yêu cầu JWT và chỉ trả tracking khi `Order.UserId` khớp user hiện tại. `OrderDTO` trả `CanCancel` được tính từ cùng rule server-side mà `CancelOrderAsync` sử dụng.

**Lý do:** Order code không phải secret đủ mạnh để dùng làm authorization. Nếu tracking public theo orderCode thì người biết/đoán mã có thể xem lịch sử đơn khác. Đồng thời nếu Mobile tự suy quyền hủy từ status, rule frontend có thể lệch backend.

**Hệ quả:** Mobile luôn gửi Bearer token khi gọi tracking, chỉ render nút hủy khi `canCancel=true`, và vẫn xử lý backend reject như source of truth cuối cùng. Web `shippingApi.track` tiếp tục tương thích vì customer `apiClient` đã tự gắn JWT.


## D017 — Review phải gắn đúng order và biến thể đã mua

**Ngày:** 2026-09-22

**Quyết định:** Tạo review chỉ hợp lệ khi `OrderId` thuộc user hiện tại, order đã `completed`, product nằm trong chính order đó và backend xác định được đúng size/color đã mua. Backend lưu size/color từ `OrderItem`, không tin metadata biến thể do client tự khai.

**Lý do:** Check “user từng mua product” là chưa đủ; client có thể gửi một `OrderId` khác hoặc metadata size/color không khớp. Ngoài ra một order có thể chứa cùng product ở nhiều biến thể.

**Hệ quả:** `OrderDTO.HasReviewed` dùng khóa `order + product + size + color`; review pending vẫn khóa submit trùng ở Order Detail. Product Detail chỉ công khai review `approved`, giữ moderation hiện có.


## D018 — Delete Account phải giải phóng reservation qua CartService

**Ngày:** 2026-09-22

**Quyết định:** `DELETE /api/account` không được xóa trực tiếp các dòng `GioHang`. Trước khi xóa/ẩn danh dữ liệu tài khoản, backend phải gọi `CartService.ClearCartAsync(userId)` để release `SanPham.SoLuongDaGiu` và `TonKhoBienThe.SoLuongDaGiu`.

**Lý do:** Xóa Cart trực tiếp làm tồn kho bị giữ ảo sau khi user hủy tài khoản, vi phạm invariant D012.

**Hệ quả:** Delete-account tiếp tục giữ order history theo contract hiện có, xóa notification/wishlist/address, anonymize review display name, vô hiệu voucher cá nhân và Mobile logout để Auth/Notifications/Shopping/Checkout protected state tự clear.


## D019 — Discovery PHASE 9 dùng query server-side, hotspot phần trăm và recommendation rule-based

**Ngày:** 2026-09-24

**Quyết định:** Collection product query dùng `ProductFilterDTO.CollectionId` trên `GET /api/products`; Lookbook hotspot giữ tọa độ phần trăm `0..100`; Recommendation MVP dùng endpoint `GET /api/recommendations/for-me` với optional auth và rule-based signal từ Wishlist/completed Orders.

**Lý do:** Collection cần paging/sort server-side thay vì tải toàn catalog xuống client. Hotspot phần trăm giữ vị trí tương đối trên nhiều kích thước màn hình. Recommendation rule-based đủ giải thích được cho MVP, tái sử dụng dữ liệu commerce hiện có và không cần đưa ML phức tạp vào PHASE 9.

**Quy tắc:**

- Mobile không filter Collection từ toàn bộ catalog.
- Backend là source of truth cho candidate recommendation.
- User có signal: ưu tiên category từ Wishlist/Order, sau đó best seller/new/general active; sản phẩm đã mua hoàn tất được loại khỏi candidate hiện tại.
- Guest hoặc user không có signal nhận fallback và response phải có `IsPersonalized = false`.
- UI guest không được gọi fallback là “cá nhân hóa” hoặc “AI”.
- Hotspot Mobile phải chuyển `X/Y` phần trăm sang vị trí trên kích thước ảnh render và giữ touch target khoảng 44px.
- Không tạo global Recommendation/Collection/Lookbook context nếu dữ liệu chỉ dùng ở Home/screen local.

**Hệ quả:** PHASE 9 thêm `RecommendationDTO`, recommendation controller/service rule và `CollectionId` filter nhưng không thêm bảng database. Seed Lookbook local được bổ sung bằng migration idempotent riêng.


## D020 — KaitoKid Shop Fashion phục vụ mọi lứa tuổi và giới tính; D009 bị thay thế

**Ngày:** 2026-09-24

**Quyết định:** KaitoKid Shop Fashion bán quần áo và phụ kiện cho nam, nữ, bé trai, bé gái, người lớn, trẻ em và unisex. Quyết định này **supersede D009** về phạm vi thương hiệu kids-only.

**Lý do:** Chủ dự án xác nhận Web hiện tại với các khu vực NỮ / NAM / TRẺ EM là đúng nghiệp vụ. Việc PHASE 1 chuẩn hóa bộ seed Mobile thành trẻ em chỉ là phạm vi dữ liệu mẫu của giai đoạn Mobile, không phải định vị toàn shop.

**Quy ước dữ liệu:**

- `GioiTinh = Nam/Nu/Unisex` mô tả giới tính/phân nhóm mặc.
- `NhomTuoi = NguoiLon/TreEm` mô tả nhóm tuổi.
- Trang trẻ em phải filter theo `NhomTuoi=TreEm`; không dùng `gender=Tre em`.
- Size trẻ em và người lớn cùng tồn tại; UI đọc danh sách size thật từ sản phẩm.

**Hệ quả:** Không xóa hoặc đổi các route/menu Web Nam/Nữ/Trẻ em chỉ vì D009 cũ. D009 được giữ để bảo toàn lịch sử nhưng không còn là quyết định hiện hành.
