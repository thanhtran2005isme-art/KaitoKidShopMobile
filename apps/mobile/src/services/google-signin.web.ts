import { GOOGLE_WEB_CLIENT_ID } from '@/services/google-oauth-config';
import type { GoogleLoginCredential } from '@/services/google-signin';

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GooglePopupError = {
  type?: string;
  message?: string;
};

type GoogleTokenClient = {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
};

type GoogleIdentityApi = {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (response: GoogleTokenResponse) => void;
        error_callback?: (error: GooglePopupError) => void;
      }) => GoogleTokenClient;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentityApi;
  }
}

const GOOGLE_SCRIPT_ID = 'kaitokid-google-identity';
const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

let scriptPromise: Promise<GoogleIdentityApi> | null = null;

function loadGoogleIdentity(): Promise<GoogleIdentityApi> {
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve(window.google);
  }

  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const finish = () => {
      if (window.google?.accounts?.oauth2) {
        resolve(window.google);
      } else {
        reject(new Error('Google Identity Services không khởi tạo được.'));
      }
    };

    const existing = document.getElementById(
      GOOGLE_SCRIPT_ID,
    ) as HTMLScriptElement | null;

    if (existing) {
      existing.addEventListener('load', finish, { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error('Không tải được Google Identity Services.')),
        { once: true },
      );
      return;
    }

    const script = document.createElement('script');
    script.id = GOOGLE_SCRIPT_ID;
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', finish, { once: true });
    script.addEventListener(
      'error',
      () => reject(new Error('Không tải được Google Identity Services.')),
      { once: true },
    );
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export function preloadGoogleSignIn() {
  void loadGoogleIdentity().catch(() => {
    scriptPromise = null;
  });
}

export async function signInWithGoogle(): Promise<GoogleLoginCredential | null> {
  if (!GOOGLE_WEB_CLIENT_ID) {
    throw new Error('Thiếu Google Web Client ID cho đăng nhập Google.');
  }

  const google = await loadGoogleIdentity();

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (value: GoogleLoginCredential | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      reject(new Error(message));
    };

    const client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_WEB_CLIENT_ID,
      scope: 'openid email profile',
      callback: (response) => {
        if (response.error) {
          fail(
            response.error_description ||
              'Google từ chối yêu cầu đăng nhập. Vui lòng thử lại.',
          );
          return;
        }

        if (!response.access_token) {
          fail('Google không trả access token.');
          return;
        }

        finish({ accessToken: response.access_token });
      },
      error_callback: (error) => {
        if (error.type === 'popup_closed') {
          finish(null);
          return;
        }

        fail(
          error.message ||
            'Không thể mở cửa sổ đăng nhập Google. Kiểm tra popup của trình duyệt.',
        );
      },
    });

    client.requestAccessToken({ prompt: 'select_account' });
  });
}
