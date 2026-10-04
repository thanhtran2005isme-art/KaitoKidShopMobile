# Web Login — Auth Showcase override

Scope: `apps/web` route `/login`.

## Visual source

The page follows the user-provided Auth UI sample:

- full-screen two-column auth layout on desktop;
- form panel on the left, image panel on the right;
- Sign in / Sign up toggle inside the same screen;
- password show/hide control;
- divider + Continue with Google;
- right-side image and quote change with auth mode;
- quote uses a typewriter treatment;
- image panel is hidden on narrow/mobile viewports.

## Project integration rules

- `/login` is outside `MainLayout` so Header/Footer do not break the full-screen composition.
- Sign in continues to use `AuthContext.login` and the Node Auth API.
- Sign up continues to use the real pending-registration/email-verification flow.
- Google uses Google Identity Services in Vite Web to obtain an **ID token**; Web never treats Google profile data as a KaitoKid session by itself.
- Google ID token is posted to Node `POST /api/Auth/google`; backend verifies token audience/expiry and is the trust boundary before issuing KaitoKid JWT.
- Vite Web uses `VITE_GOOGLE_CLIENT_ID` when provided; otherwise it uses the same committed default Google Web Client ID as Mobile and Node API.
- Customer auth defaults to Node `http://localhost:5300`; do not restore legacy auth fallbacks to `:5053` or other retired C# ports.
- Existing reCAPTCHA and 2FA behavior remains functional.
- Email/phone identifier login is preserved even though the visual reference labels the field as Email.
- No fake auth data and no local commerce/auth source of truth is introduced.

## Google local-development requirement

The OAuth Web Client in Google Cloud must allow the exact browser origin. For the normal Vite workflow add at least:

```text
http://localhost:5173
```

If development uses `127.0.0.1`, another port, or production domain, that exact origin must also be registered in Google Cloud.

## Responsive/accessibility

- Desktop/tablet >= 768px: two equal columns.
- Below 768px: form takes the viewport; decorative image panel is hidden.
- Form labels remain visible.
- Password eye controls have accessible labels.
- Keyboard focus is visible.
- Reduced-motion preference disables nonessential transitions/typewriter animation.
