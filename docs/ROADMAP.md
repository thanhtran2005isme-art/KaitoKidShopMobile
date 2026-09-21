# KaitoKid Mobile Roadmap

Roadmap này là thứ tự triển khai chính. Không nhảy phase khi phần phụ thuộc cốt lõi của phase trước chưa ổn định.

## Trạng thái

- [x] PHASE 1 — Chốt branding + dữ liệu
- [ ] PHASE 2 — Nâng cấp Home
- [ ] PHASE 3 — Product Detail hoàn chỉnh
- [ ] PHASE 4 — Wishlist + Add to Cart
- [ ] PHASE 5 — Cart thật
- [ ] PHASE 6 — Checkout + Address + Shipping + Payment
- [ ] PHASE 7 — Orders + Tracking
- [ ] PHASE 8 — Reviews + Notifications + Account
- [ ] PHASE 9 — Collections + Lookbook + Recommendation
- [ ] PHASE 10 — Polish UI + performance + testing

## PHASE 1 — Chốt branding + dữ liệu

Định vị đã chốt:

**KaitoKid = thời trang trẻ em 0–12 tuổi.**

Đã thực hiện:

- chuẩn hóa category, product, collection, banner, lookbook và nội dung thương hiệu sang trẻ em;
- giữ nguyên ID/SKU/quan hệ để không phá review/order/backend hiện tại;
- chuẩn hóa size mẫu theo chiều cao 90–150;
- thêm `NhomTuoi = TreEm` cho dữ liệu sản phẩm;
- thêm `apps/mobile/src/constants/brand.ts`;
- đổi tên hiển thị Expo app thành `KaitoKid`;
- thêm `docs/BRAND.md`;
- thêm migration không phá bảng cho database local hiện tại:
  `backend/Database/migrations/20260922_phase1_kids_branding.sql`.

### Việc vận hành cần làm sau khi pull PHASE 1

Chạy migration trên database local hiện tại:

```bat
"C:\xampp\mysql\bin\mysql.exe" -u root kaitokid < backend\Database\migrations\20260922_phase1_kids_branding.sql
```

Sau đó restart `run.bat`.

## PHASE 2 — Nâng cấp Home

Mục tiêu tiếp theo:

- header rõ brand hơn;
- cart badge;
- wishlist/notification entry point;
- hero auto-slide + pagination;
- promo/value strip;
- category presentation tốt hơn;
- product section tốt hơn;
- skeleton/loading state;
- collections/flash sale/recommendation entry points phù hợp phạm vi Home;
- giữ tương thích API hiện tại và chuẩn bị cho PHASE 3–5.

## Nguyên tắc triển khai

- commit bằng tiếng Việt;
- mỗi phase dùng branch riêng;
- cập nhật `AI_HANDOFF.md`, `ROADMAP.md`, `DECISIONS.md` hoặc `TROUBLESHOOTING.md` khi trạng thái bền vững thay đổi;
- không commit secret;
- không sửa dữ liệu thành thời trang người lớn trở lại.
