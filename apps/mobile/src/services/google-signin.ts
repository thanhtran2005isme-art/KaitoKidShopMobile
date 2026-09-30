export type GoogleLoginCredential = {
  idToken?: string;
  accessToken?: string;
};

export function preloadGoogleSignIn() {
  // Platform-specific implementation lives in .native.ts / .web.ts.
}

export async function signInWithGoogle(): Promise<GoogleLoginCredential | null> {
  throw new Error('Đăng nhập Google chưa được hỗ trợ trên nền tảng này.');
}
