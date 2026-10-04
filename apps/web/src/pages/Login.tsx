import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PiEyeClosedFill, PiEyeFill } from 'react-icons/pi';

import { useAuth } from '../context/AuthContext';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { authApi } from '../services/api/authApi';
import '../styles/login-showcase.css';

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
    };
  };
};

type TypewriterProps = {
  text: string;
  speed?: number;
};

const SIGN_IN_CONTENT = {
  image:
    'https://cdn.21st.dev/assets/mirror/39/39e7b0edd6a7156713d08ec970769bf29360427d3dc8523ee32079885ccca5dd.png',
  alt: 'A beautiful interior design for sign-in',
  quote: 'Welcome Back! The journey continues.',
  author: 'EaseMize UI',
};

const SIGN_UP_CONTENT = {
  image:
    'https://cdn.21st.dev/assets/mirror/c7/c7cb3a073970aa03472c652391db88fbbe39f1e33c8deb336a9c8e53b039ee01.png',
  alt: 'A vibrant, modern space for new beginnings',
  quote: 'Create an account. A new chapter awaits.',
  author: 'EaseMize UI',
};

async function getRecaptchaToken(action: string): Promise<string> {
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;
  if (!siteKey) return '';

  type GReCAPTCHA = {
    ready: (callback: () => void) => void;
    execute: (key: string, options: { action: string }) => Promise<string>;
  };

  const browser = window as unknown as { grecaptcha?: GReCAPTCHA };

  await new Promise<void>((resolve) => {
    if (browser.grecaptcha) {
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
    if (!browser.grecaptcha) {
      resolve('');
      return;
    }

    browser.grecaptcha.ready(async () => {
      try {
        resolve(await browser.grecaptcha!.execute(siteKey, { action }));
      } catch {
        resolve('');
      }
    });
  });
}

function Typewriter({ text, speed = 60 }: TypewriterProps) {
  const [displayText, setDisplayText] = useState('');

  useEffect(() => {
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      setDisplayText(text);
      return;
    }

    setDisplayText('');
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setDisplayText(text.slice(0, index));
      if (index >= text.length) window.clearInterval(timer);
    }, speed);

    return () => window.clearInterval(timer);
  }, [speed, text]);

  return (
    <span>
      {displayText}
      <span className="auth-showcase-cursor" aria-hidden="true">
        |
      </span>
    </span>
  );
}

function GoogleIcon() {
  return (
    <img
      src="https://cdn.21st.dev/assets/mirror/38/38146bfd9eff6dbf0d74771f2e625c70d87d3770e0d080dbb6e50db1d5403f46.svg"
      alt=""
      aria-hidden="true"
      className="auth-showcase-google-icon"
    />
  );
}

export default function Login() {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const twoFaDialogRef = useRef<HTMLDivElement>(null);

  const [isSignIn, setIsSignIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);

  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);

  const [twoFaState, setTwoFaState] = useState<{
    identifier: string;
    password: string;
  } | null>(null);
  const [twoFaCode, setTwoFaCode] = useState('');

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const currentContent = isSignIn ? SIGN_IN_CONTENT : SIGN_UP_CONTENT;

  useFocusTrap(twoFaDialogRef, !!twoFaState, () => setTwoFaState(null));

  useEffect(() => {
    const savedIdentifier = localStorage.getItem('lastLoginId');
    if (savedIdentifier) setLoginIdentifier(savedIdentifier);
  }, []);

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
    const browser = window as unknown as { google?: GoogleIdentity };

    const initializeGoogle = () => {
      if (cancelled || !browser.google?.accounts?.id || !googleButtonRef.current) return;

      browser.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredential,
        ux_mode: 'popup',
        auto_select: false,
      });

      googleButtonRef.current.innerHTML = '';
      browser.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        width: 350,
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'left',
      });
      setGoogleReady(true);
    };

    if (browser.google?.accounts?.id) {
      initializeGoogle();
    } else {
      const existing = document.querySelector<HTMLScriptElement>('script[data-gsi]');
      if (existing) {
        existing.addEventListener('load', initializeGoogle, { once: true });
      } else {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.dataset.gsi = '1';
        script.onload = initializeGoogle;
        document.head.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
    };
  }, [googleClientId, handleGoogleCredential]);

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    const identifier = loginIdentifier.trim();
    if (!identifier || !loginPassword) {
      toast.error('Vui lòng nhập đầy đủ thông tin đăng nhập');
      return;
    }

    setLoading(true);
    try {
      const recaptchaToken = await getRecaptchaToken('login');
      const result = await login(identifier, loginPassword, recaptchaToken);

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

  const handleSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    const name = signUpName.trim();
    const email = signUpEmail.trim().toLowerCase();
    const password = signUpPassword;

    if (!name || !email || !password) {
      toast.error('Vui lòng nhập đầy đủ thông tin đăng ký');
      return;
    }

    if (password.length < 6) {
      toast.error('Mật khẩu cần tối thiểu 6 ký tự');
      return;
    }

    setLoading(true);
    try {
      const recaptchaToken = await getRecaptchaToken('register');
      const result = await register({
        name,
        email,
        password,
        recaptchaToken,
      });

      if (!result.success) {
        toast.error(result.error || 'Đăng ký thất bại');
        return;
      }

      toast.success(
        result.message || 'Đã gửi email xác nhận. Mở liên kết trong email để tạo tài khoản.',
      );
      setLoginIdentifier(result.email || email);
      setLoginPassword('');
      setSignUpPassword('');
      setIsSignIn(true);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleFallback = () => {
    if (!googleClientId) {
      toast.error('Google OAuth chưa được cấu hình.');
      return;
    }

    if (!googleReady) {
      toast('Google Sign-In đang tải...');
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

  return (
    <main className="auth-showcase-page">
      <section className="auth-showcase-form-pane" aria-label={isSignIn ? 'Đăng nhập' : 'Đăng ký'}>
        <div className="auth-showcase-form-container">
          {isSignIn ? (
            <form onSubmit={handleSignIn} autoComplete="on" className="auth-showcase-form">
              <header className="auth-showcase-heading">
                <h1>Sign in to your account</h1>
                <p>Enter your email below to sign in</p>
              </header>

              <div className="auth-showcase-fields">
                <label className="auth-showcase-field">
                  <span>Email hoặc số điện thoại</span>
                  <input
                    name="identifier"
                    type="text"
                    placeholder="m@example.com"
                    required
                    autoComplete="username"
                    value={loginIdentifier}
                    onChange={(event) => setLoginIdentifier(event.target.value)}
                    disabled={loading}
                  />
                </label>

                <label className="auth-showcase-field">
                  <span className="auth-showcase-password-label">
                    <span>Password</span>
                    <Link to="/forgot-password">Forgot password?</Link>
                  </span>
                  <span className="auth-showcase-password-wrap">
                    <input
                      name="password"
                      type={showLoginPassword ? 'text' : 'password'}
                      placeholder="Password"
                      required
                      autoComplete="current-password"
                      value={loginPassword}
                      onChange={(event) => setLoginPassword(event.target.value)}
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="auth-showcase-eye"
                      onClick={() => setShowLoginPassword((value) => !value)}
                      aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                      disabled={loading}
                    >
                      {showLoginPassword ? <PiEyeClosedFill aria-hidden="true" /> : <PiEyeFill aria-hidden="true" />}
                    </button>
                  </span>
                </label>

                <button type="submit" className="auth-showcase-primary" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSignUp} autoComplete="on" className="auth-showcase-form">
              <header className="auth-showcase-heading">
                <h1>Create an account</h1>
                <p>Enter your details below to sign up</p>
              </header>

              <div className="auth-showcase-fields">
                <label className="auth-showcase-field">
                  <span>Full Name</span>
                  <input
                    name="name"
                    type="text"
                    placeholder="John Doe"
                    required
                    autoComplete="name"
                    value={signUpName}
                    onChange={(event) => setSignUpName(event.target.value)}
                    disabled={loading}
                  />
                </label>

                <label className="auth-showcase-field">
                  <span>Email</span>
                  <input
                    name="email"
                    type="email"
                    placeholder="m@example.com"
                    required
                    autoComplete="email"
                    value={signUpEmail}
                    onChange={(event) => setSignUpEmail(event.target.value)}
                    disabled={loading}
                  />
                </label>

                <label className="auth-showcase-field">
                  <span>Password</span>
                  <span className="auth-showcase-password-wrap">
                    <input
                      name="password"
                      type={showSignUpPassword ? 'text' : 'password'}
                      placeholder="Password"
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={signUpPassword}
                      onChange={(event) => setSignUpPassword(event.target.value)}
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="auth-showcase-eye"
                      onClick={() => setShowSignUpPassword((value) => !value)}
                      aria-label={showSignUpPassword ? 'Hide password' : 'Show password'}
                      disabled={loading}
                    >
                      {showSignUpPassword ? <PiEyeClosedFill aria-hidden="true" /> : <PiEyeFill aria-hidden="true" />}
                    </button>
                  </span>
                </label>

                <button type="submit" className="auth-showcase-primary" disabled={loading}>
                  {loading ? 'Creating account...' : 'Sign Up'}
                </button>
              </div>
            </form>
          )}

          <p className="auth-showcase-toggle">
            {isSignIn ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={() => setIsSignIn((value) => !value)}
              disabled={loading}
            >
              {isSignIn ? 'Sign up' : 'Sign in'}
            </button>
          </p>

          <div className="auth-showcase-divider" aria-hidden="true">
            <span>Or continue with</span>
          </div>

          <div className="auth-showcase-google-wrap">
            <button
              type="button"
              className="auth-showcase-google"
              onClick={handleGoogleFallback}
              disabled={loading}
            >
              <GoogleIcon />
              Continue with Google
            </button>

            {googleClientId && (
              <div
                ref={googleButtonRef}
                className="auth-showcase-google-native"
                aria-hidden="true"
                style={{ pointerEvents: googleReady && !loading ? 'auto' : 'none' }}
              />
            )}
          </div>
        </div>
      </section>

      <aside
        className="auth-showcase-visual"
        style={{ backgroundImage: `url(${currentContent.image})` }}
        aria-label={currentContent.alt}
      >
        <div className="auth-showcase-gradient" aria-hidden="true" />
        <blockquote className="auth-showcase-quote">
          <p>
            “<Typewriter key={currentContent.quote} text={currentContent.quote} speed={60} />”
          </p>
          <cite>— {currentContent.author}</cite>
        </blockquote>
      </aside>

      {twoFaState && (
        <div
          className="auth-showcase-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !loading) setTwoFaState(null);
          }}
        >
          <div
            ref={twoFaDialogRef}
            className="auth-showcase-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="twofa-title"
          >
            <h2 id="twofa-title">Xác thực 2 yếu tố</h2>
            <p>
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
            />
            <div className="auth-showcase-dialog-actions">
              <button
                type="button"
                className="auth-showcase-dialog-primary"
                onClick={() => void handleSubmit2Fa()}
                disabled={loading || twoFaCode.length !== 6}
              >
                {loading ? 'Đang kiểm tra...' : 'Xác nhận'}
              </button>
              <button
                type="button"
                className="auth-showcase-dialog-secondary"
                onClick={() => {
                  setTwoFaState(null);
                  setTwoFaCode('');
                }}
                disabled={loading}
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
