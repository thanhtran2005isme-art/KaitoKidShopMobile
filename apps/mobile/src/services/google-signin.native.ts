import { Platform } from 'react-native';

import { GOOGLE_WEB_CLIENT_ID } from '@/services/google-oauth-config';
import type { GoogleLoginCredential } from '@/services/google-signin';

let configured = false;

async function loadGoogleModule() {
  try {
    return await import('@react-native-google-signin/google-signin');
  } catch {
    throw new Error(
      'Đăng nhập Google trên Android/iOS cần development build có native module. Expo Go không hỗ trợ Google Sign-In native.',
    );
  }
}

async function ensureConfigured() {
  if (configured) return await loadGoogleModule();

  if (!GOOGLE_WEB_CLIENT_ID) {
    throw new Error('Thiếu Google Web Client ID cho đăng nhập Google.');
  }

  const googleModule = await loadGoogleModule();

  if (Platform.OS === 'ios') {
    throw new Error(
      'Google Sign-In iOS chưa được cấu hình OAuth Client ID/URL scheme. Hiện luồng native đã sẵn sàng cho Android.',
    );
  }

  googleModule.GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    offlineAccess: false,
  });
  configured = true;
  return googleModule;
}

export function preloadGoogleSignIn() {
  // Không import native module sớm để Expo Go vẫn mở app bình thường.
}

export async function signInWithGoogle(): Promise<GoogleLoginCredential | null> {
  try {
    const googleModule = await ensureConfigured();

    if (Platform.OS === 'android') {
      await googleModule.GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
    }

    const response = await googleModule.GoogleSignin.signIn();
    if (!googleModule.isSuccessResponse(response)) return null;

    let idToken = response.data.idToken;
    if (!idToken) {
      const tokens = await googleModule.GoogleSignin.getTokens();
      idToken = tokens.idToken;
    }

    if (!idToken) {
      throw new Error(
        'Google không trả ID token. Kiểm tra Web Client ID trong Google Cloud.',
      );
    }

    return { idToken };
  } catch (error) {
    if (error instanceof Error) {
      const message = error.message || '';
      if (
        /RNGoogleSignin|TurboModule|native module|not found|cannot find/i.test(
          message,
        )
      ) {
        throw new Error(
          'Google Sign-In cần development build. Hãy build app Android riêng; Expo Go không chứa native module này.',
        );
      }
      throw error;
    }

    throw new Error('Không thể mở đăng nhập Google.');
  }
}
