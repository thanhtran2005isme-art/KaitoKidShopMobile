import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import GoogleLoginButton from '../components/GoogleLoginButton.jsx';
import MonkeyLoginForm from '../components/MonkeyLoginForm.jsx';
import { useAuth } from '../context/AuthContext';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { authApi } from '../services/api/authApi';

async function getRecaptchaToken(action: string): Promise<string> {
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;
  if (!siteKey) return '';

  type GReCAPTCHA = {
    ready: (cb: () => void) => void;
    execute: (key: string, opts: { action: string }) => Promise<string>;
  };

  const w = window as unknown as { grecaptcha?: GReCAPTCHA };

  await new Promise<void>((resolve) => {
    if (w.grecaptcha) {
      resolve();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-recaptcha]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    script.dataset.recaptcha = '1';
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });

  return new Promise<string>((resolve) => {
    if (!w.grecaptcha) {
      resolve('');
      return;
    }

    w.grecaptcha.ready(async () => {
      try {
        resolve(await w.grecaptcha!.execute(siteKey, { action }));
      } catch {
        resolve('');
      }
    });
  });
}

type GoogleIdentity = {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (response: { credential: string }) => void;
        ux_mode?: 'popup';
        auto_select?: boolean;
      }) => void;
      renderButton: (
        element: HTMLElement,
        options: {
          theme: string;
          size: string;
          width: number;
          text: string;
          shape: string;
          logo_alignment: string;
        },
      ) => void;
      prompt: () => void;
    };
  };
};

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const pageRef = useRef<HTMLDivElement>(null);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const twoFaDialogRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [twoFaState, setTwoFaState] = useState<{
    identifier: string;
    password: string;
  } | null>(null);
  const [twoFaCode, setTwoFaCode] = useState('');

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  useFocusTrap(twoFaDialogRef, !!twoFaState, () => setTwoFaState(null));

  useEffect(() => {
    const savedIdentifier = localStorage.getItem('lastLoginId');
    if (!savedIdentifier) return;

    const input = pageRef.current?.querySelector<HTMLInputElement>('#email-input');
    if (input && !input.value) input.value = savedIdentifier;
  }, []);

  useEffect(() => {
    const submitButton = pageRef.current?.querySelector<HTMLButtonElement>('.submit');
    if (!submitButton) return;

    submitButton.disabled = loading;
    submitButton.textContent = loading ? 'Đang xử lý...' : 'Submit';
    submitButton.setAttribute('aria-busy', loading ? 'true' : 'false');
  }, [loading]);

  const handleGoogleCredential = useCallback(async (response: { credential: string }) => {
    if (!response?.credential) return;

    setLoading(true);
    try {
      const result = await authApi.loginWithGoogle(response.credential);
      if (!result.success) {
        toast.error(result.error || 'Đăng nhập Google thất bại');
        return;
      }

      toast.success('Đăng nhập Google thành công');
      window.location.href = '/';
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current) return;

    let cancelled = false;
    const w = window as unknown as { google?: GoogleIdentity };

    const initGoogle = () => {
      if (cancelled || !w.google?.accounts?.id || !googleButtonRef.current) return;

      w.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredential,
        ux_mode: 'popup',
        auto_select: false,
      });

      googleButtonRef.current.innerHTML = '';
      w.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        width: 320,
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'left',
      });
      setGoogleReady(true);
    };

    if (w.google?.accounts?.id) {
      initGoogle();
    } else {
      const existing = document.querySelector<HTMLScriptElement>('script[data-gsi]');
      if (existing) {
        existing.addEventListener('load', initGoogle, { once: true });
      } else {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.dataset.gsi = '1';
        script.onload = initGoogle;
        document.head.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
    };
  }, [googleClientId, handleGoogleCredential]);

  const handleLogin = async () => {
    if (loading) return;

    const emailInput = pageRef.current?.querySelector<HTMLInputElement>('#email-input');
    const passwordInput = pageRef.current?.querySelector<HTMLInputElement>('#password-input');
    const identifier = emailInput?.value.trim() ?? '';
    const password = passwordInput?.value ?? '';

    if (!identifier || !password) {
      toast.error('Vui lòng nhập đầy đủ email và mật khẩu');
      return;
    }

    setLoading(true);
    try {
      const recaptchaToken = await getRecaptchaToken('login');
      const result = await login(identifier, password, recaptchaToken);

      if (!result.success) {
        toast.error(result.error || 'Đăng nhập thất bại');
        return;
      }

      if (result.requireTwoFactor && result.identifier && result.password) {
        setTwoFaState({
          identifier: result.identifier,
          password: result.password,
        });
        setTwoFaCode('');
        return;
      }

      localStorage.setItem('lastLoginId', identifier);
      toast.success('Đăng nhập thành công');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit2Fa = async () => {
    if (!twoFaState || loading) return;

    if (twoFaCode.length !== 6) {
      toast.error('Nhập đủ 6 số');
      return;
    }

    setLoading(true);
    try {
      const result = await authApi.loginWithTwoFactor(
        twoFaState.identifier,
        twoFaState.password,
        twoFaCode,
      );

      if (!result.success) {
        toast.error(result.error || 'Mã 2FA không đúng');
        return;
      }

      localStorage.setItem('lastLoginId', twoFaState.identifier);
      toast.success('Đăng nhập thành công');
      window.location.href = '/';
    } finally {
      setLoading(false);
    }
  };

  const handleClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;

    if (target.closest('.submit')) {
      event.preventDefault();
      void handleLogin();
      return;
    }

    if (target.closest('.frg_pss a')) {
      event.preventDefault();
      navigate('/forgot-password');
      return;
    }

    if (target.closest('.button')) {
      event.preventDefault();
      if (!googleClientId) {
        toast.error('Google OAuth chưa được cấu hình.');
        return;
      }

      if (!googleReady) {
        toast('Google Sign-In đang tải...');
        return;
      }

      const w = window as unknown as { google?: GoogleIdentity };
      w.google?.accounts?.id.prompt();
    }
  };

  const handleSubmitCapture = (event: React.FormEvent<HTMLDivElement>) => {
    event.preventDefault();
    void handleLogin();
  };

  return (
    <div
      ref={pageRef}
      onClickCapture={handleClickCapture}
      onSubmitCapture={handleSubmitCapture}
      style={{
        minHeight: 'calc(100vh - 200px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: '48px 20px',
        background: '#f5f5f5',
      }}
    >
      <MonkeyLoginForm />

      <div style={{ position: 'relative', display: 'inline-flex' }}>
        <GoogleLoginButton />
        {googleClientId && (
          <div
            ref={googleButtonRef}
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 2,
              overflow: 'hidden',
              opacity: 0,
              pointerEvents: googleReady && !loading ? 'auto' : 'none',
            }}
          />
        )}
      </div>

      {twoFaState && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !loading) setTwoFaState(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            background: 'rgba(0, 0, 0, 0.45)',
          }}
        >
          <div
            ref={twoFaDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="twofa-title"
            style={{
              width: 'min(400px, 100%)',
              borderRadius: 16,
              background: '#fff',
              padding: 24,
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.18)',
              fontFamily: 'Arial, sans-serif',
            }}
          >
            <h2 id="twofa-title" style={{ margin: '0 0 8px', fontSize: 22 }}>
              Xác thực 2 yếu tố
            </h2>
            <p style={{ margin: '0 0 16px', color: '#555', lineHeight: 1.5 }}>
              Nhập mã 6 số từ ứng dụng Authenticator cho tài khoản{' '}
              <strong>{twoFaState.identifier}</strong>.
            </p>
            <input
              type="text"
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={twoFaCode}
              onChange={(event) =>
                setTwoFaCode(event.target.value.replace(/\D/g, '').slice(0, 6))
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter' && twoFaCode.length === 6) {
                  event.preventDefault();
                  void handleSubmit2Fa();
                }
              }}
              aria-label="Mã xác thực 2 yếu tố"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px 14px',
                marginBottom: 14,
                border: '1px solid #8f8f8f',
                borderRadius: 6,
                fontSize: 20,
                letterSpacing: 6,
                textAlign: 'center',
              }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => void handleSubmit2Fa()}
                disabled={loading || twoFaCode.length !== 6}
                style={{
                  flex: 1,
                  minHeight: 40,
                  border: '1px solid #222',
                  borderRadius: 6,
                  background: '#111',
                  color: '#fff',
                  cursor: loading ? 'wait' : 'pointer',
                }}
              >
                {loading ? 'Đang kiểm tra...' : 'Xác nhận'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTwoFaState(null);
                  setTwoFaCode('');
                }}
                disabled={loading}
                style={{
                  minHeight: 40,
                  padding: '0 18px',
                  border: '1px solid #bbb',
                  borderRadius: 6,
                  background: '#fff',
                  color: '#222',
                  cursor: loading ? 'wait' : 'pointer',
                }}
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
