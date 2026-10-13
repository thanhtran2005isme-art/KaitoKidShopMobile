# 2026-10 — Expo Go USB/ADB launcher hardening

PR #75 được bổ sung hardening cho launcher Mobile sau khi Expo Go trên thiết bị thật có thể bị kẹt ở màn hình loading khi Metro rơi về LAN mode ngoài ý muốn.

## Triệu chứng

- Metro in `exp://<IP-LAN>:8081` thay vì `exp://127.0.0.1:8081` dù điện thoại đang cắm USB;
- `apps/mobile/app.config.js` log backend theo IP LAN thay vì `127.0.0.1:5300`;
- Expo Go mở project nhưng xoay loading lâu nếu mạng Wi-Fi/LAN có client isolation, firewall hoặc route không tới máy development.

## Nguyên nhân launcher

`run-mobile.bat` trước đây chỉ tìm `adb` từ PATH và Android SDK mặc định. Trên máy dùng platform-tools độc lập, ví dụ `C:\platform-tools`, launcher có thể không thấy ADB và âm thầm fallback sang LAN.

## Hành vi hiện tại

`scripts/run-mobile.bat` tìm `adb.exe` theo thứ tự:

1. `PATH`;
2. `%ANDROID_SDK_ROOT%\platform-tools\adb.exe`;
3. `%ANDROID_HOME%\platform-tools\adb.exe`;
4. `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`;
5. `C:\platform-tools\adb.exe`.

Launcher in rõ executable ADB đang dùng, trạng thái `unauthorized/offline` và chỉ chuyển sang `--localhost` khi ít nhất một thiết bị reverse thành công cả `8081` và `5300`.

Khi USB reverse thành công:

```text
Metro: exp://127.0.0.1:8081
Backend: http://127.0.0.1:5300
```

Khi không có reverse hoàn chỉnh, launcher vẫn dùng `--lan` và cảnh báo rằng Expo Go có thể kẹt loading nếu thiết bị không truy cập được PC qua LAN.

Không thay đổi API, database, auth, cart, checkout hoặc payment contract.
