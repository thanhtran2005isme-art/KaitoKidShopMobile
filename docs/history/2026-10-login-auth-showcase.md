# 2026-10-04 — Web login Auth Showcase

Customer Web `/login` được thay toàn bộ theo mẫu Auth UI do project owner cung cấp:

- auth screen toàn màn hình, hai cột trên desktop;
- Sign in / Sign up trong cùng màn hình;
- password show/hide;
- Google Identity Services;
- ảnh + quote typewriter đổi theo auth mode;
- mobile ẩn panel ảnh và giữ form toàn viewport;
- `/login` tách khỏi `MainLayout` để không bị Header/Footer phá bố cục mẫu;
- giữ login thật, pending registration/email verification, reCAPTCHA và 2FA;
- xóa Monkey Login Form / Google button component cũ và dependency `styled-components` không còn dùng.

Không thay đổi backend, database hoặc Mobile.
