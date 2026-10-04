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
- Google continues through Google Identity Services + `authApi.loginWithGoogle`.
- Existing reCAPTCHA and 2FA behavior remains functional.
- Email/phone identifier login is preserved even though the visual reference labels the field as Email.
- No fake auth data and no local commerce/auth source of truth is introduced.

## Responsive/accessibility

- Desktop/tablet >= 768px: two equal columns.
- Below 768px: form takes the viewport; decorative image panel is hidden.
- Form labels remain visible.
- Password eye controls have accessible labels.
- Keyboard focus is visible.
- Reduced-motion preference disables nonessential transitions/typewriter animation.
