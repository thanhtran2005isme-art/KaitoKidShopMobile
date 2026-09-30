export const DEFAULT_GOOGLE_WEB_CLIENT_ID =
  '609254164052-81mv1bn2kegd4nmic386q1fdv3o5oviq.apps.googleusercontent.com';

export const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ||
  DEFAULT_GOOGLE_WEB_CLIENT_ID;
