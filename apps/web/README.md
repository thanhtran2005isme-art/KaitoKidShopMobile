# KaitoKidShop Web

React + TypeScript + Vite frontend nằm trong `apps/web`.

## Cài đặt

```bash
cd apps/web
npm install
```

## Chạy development

```bash
npm run dev
```

Web mặc định chạy tại `http://localhost:5173` và gọi Node API tại `http://localhost:5300`.

Có thể override Node API bằng một trong các biến môi trường:

```text
VITE_NODE_API_URL
VITE_API_BASE_URL
VITE_API_AUTH_URL
```

## Google Sign-In

Vite Web dùng Google Identity Services để lấy Google ID token, sau đó gửi token về Node backend qua:

```text
POST /api/Auth/google
```

Backend mới là trust boundary và phát JWT KaitoKid sau khi xác minh Google token.

Web mặc định dùng cùng Google Web Client ID với Mobile/Node API:

```text
609254164052-81mv1bn2kegd4nmic386q1fdv3o5oviq.apps.googleusercontent.com
```

Có thể override bằng:

```text
VITE_GOOGLE_CLIENT_ID
```

Trong Google Cloud Console, OAuth Web Client tương ứng phải có Authorized JavaScript origin cho môi trường chạy Web, tối thiểu khi dev local:

```text
http://localhost:5173
```

Nếu chạy bằng `127.0.0.1`, domain/port khác hoặc production domain, phải thêm đúng origin đó vào Google OAuth client.

## Build

```bash
npm run build
```

Backend hiện hành nằm tại `../api` và dùng NestJS/Node trên cổng `5300`. Legacy ASP.NET Core đã retire, không dùng lại các cổng `5053/5265/5089/5155`.

Launcher Windows từ root:

```bat
scripts\run-web.bat
```

README dự án cũ được giữ tại `README.legacy.md`; README mặc định của Vite được giữ tại `README.vite.md`.
