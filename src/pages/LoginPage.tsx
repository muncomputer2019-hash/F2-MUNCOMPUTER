import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Globe,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { OFFICIAL_WEB_APP_URL } from '../config/businessConfig';
import { useAuth } from '../context/AuthContext';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { recordAuditLog } from '../services/auditLogger';
import type { UserRole } from '../types';
import { LogoMark } from '../components/LogoMark';

function createMathChallenge(): { a: number; b: number; answer: number } {
  const a = Math.floor(Math.random() * 9) + 2;
  const b = Math.floor(Math.random() * 9) + 1;
  return { a, b, answer: a + b };
}

function generateSessionOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    firebaseUser,
    staffProfile,
    isAuthorizedStaff,
    isSecurityVerified,
    deviceId,
    signInWithGoogleForPortal,
    completePortalSecurityCheck,
    logoutPortal,
  } = useAuth();

  const [showLocalPortal, setShowLocalPortal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');
  const [captcha, setCaptcha] = useState(() => createMathChallenge());
  const [captchaInput, setCaptchaInput] = useState('');
  const [step, setStep] = useState<'auth' | 'otp'>('auth');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const redirectTriggeredRef = useRef(false);

  const isInsideIframe = useMemo(() => {
    try {
      return typeof window !== 'undefined' && window.self !== window.top;
    } catch {
      return true;
    }
  }, []);

  useDocumentMeta({
    title: 'Official Login – MUN COMPUTER',
    description: 'Sign in to MUN COMPUTER Official Web App and Business Manager Portal.',
  });

  // Preserve authenticated Staff / Admin navigation without redirect loops
  useEffect(() => {
    if (isAuthorizedStaff && isSecurityVerified && staffProfile) {
      navigate(staffProfile.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
    }
  }, [isAuthorizedStaff, isSecurityVerified, staffProfile, navigate]);

  // Immediately initiate navigation to the connected MUN COMPUTER Web App on /login
  useEffect(() => {
    if (showLocalPortal || redirectTriggeredRef.current) return;
    if (isAuthorizedStaff && isSecurityVerified && staffProfile) return;

    redirectTriggeredRef.current = true;
    if (isInsideIframe) {
      return;
    }

    const timer = window.setTimeout(() => {
      try {
        window.location.assign(OFFICIAL_WEB_APP_URL);
      } catch {
        // Manual Open Web App Now button remains available
      }
    }, 150);

    return () => window.clearTimeout(timer);
  }, [showLocalPortal, isInsideIframe, isAuthorizedStaff, isSecurityVerified, staffProfile]);

  const handleGoogleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (Number(captchaInput.trim()) !== captcha.answer) {
      setErrorMsg('CAPTCHA verification failed. Please solve the security sum correctly.');
      setCaptcha(createMathChallenge());
      setCaptchaInput('');
      return;
    }

    setLoading(true);
    try {
      const { profile } = await signInWithGoogleForPortal(selectedRole);
      const code = generateSessionOtp();
      setGeneratedOtp(code);
      setOtpInput('');
      setStep('otp');
      void profile;
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to sign in. Please verify your account role.'
      );
      setCaptcha(createMathChallenge());
      setCaptchaInput('');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtpAndDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (otpInput.trim() !== generatedOtp) {
      setErrorMsg('Invalid verification code. Please enter the 6-digit code shown above.');
      return;
    }

    if (!firebaseUser) {
      setStep('auth');
      return;
    }

    setLoading(true);
    try {
      await completePortalSecurityCheck(firebaseUser.uid);
      await recordAuditLog(
        'PORTAL_LOGIN_VERIFIED',
        'Authentication',
        firebaseUser.uid,
        `Verified ${staffProfile?.role || selectedRole} login from registered device ${deviceId}`
      );
      navigate(staffProfile?.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Device verification failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between px-4 py-8">
      <div className="max-w-7xl w-full mx-auto flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-950 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Public Website
        </Link>
        <LogoMark variant="header" />
      </div>

      <div className="max-w-md w-full mx-auto my-8 space-y-5">
        {!showLocalPortal ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="space-y-2 text-center">
              <div className="w-12 h-12 rounded-xl bg-[#0a2d67]/10 text-[#0a2d67] flex items-center justify-center mx-auto">
                <Globe className="w-6 h-6" />
              </div>
              <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider">
                Official Web Application Portal
              </p>
              <h1 className="font-display text-2xl font-bold tracking-tight text-slate-950">
                Redirecting to MUN COMPUTER Web App...
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">
                {isInsideIframe
                  ? 'Automatic redirection is paused inside this preview frame. Click below to open your MUN COMPUTER Web App directly in a new tab.'
                  : 'You are being redirected to the connected MUN COMPUTER Web App dashboard. If it does not open automatically, click the button below.'}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-center">
              <p className="text-[11px] font-mono-tabular text-slate-600 break-all">
                {OFFICIAL_WEB_APP_URL}
              </p>
            </div>

            <div className="space-y-3">
              <a
                href={OFFICIAL_WEB_APP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 text-sm font-semibold text-white bg-[#0a2d67] rounded-lg hover:bg-[#07204a] transition-colors shadow-xs"
              >
                <span>Open Web App Now</span>
                <ExternalLink className="w-4 h-4 shrink-0" />
              </a>

              <Link
                to="/"
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 shrink-0" />
                <span>Back to Public Website</span>
              </Link>
            </div>

            <div className="pt-4 border-t border-slate-200 text-center">
              <button
                type="button"
                onClick={() => setShowLocalPortal(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-800 hover:text-blue-950 underline underline-offset-4 cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Sign In to Website Admin &amp; Business Manager</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-800">
                <ShieldCheck className="w-4 h-4" />
                <span>Website Admin &amp; Business Manager Portal</span>
              </div>
              <button
                type="button"
                onClick={() => setShowLocalPortal(false)}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                Web App Link
              </button>
            </div>

            <div className="space-y-1.5">
              <h1 className="font-display text-2xl font-bold tracking-tight text-slate-950">
                Sign in to MUN COMPUTER
              </h1>
              <p className="text-sm text-slate-600">
                Authorized Admin, Manager, and Staff access with CAPTCHA, OTP verification, and
                device registration.
              </p>
            </div>

            {step === 'auth' ? (
              <form onSubmit={handleGoogleSignIn} className="space-y-5">
                <div className="space-y-2">
                  <span className="block text-xs font-semibold text-slate-700">
                    Select Portal Role
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {(['admin', 'manager', 'staff'] as UserRole[]).map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setSelectedRole(role)}
                        className={`py-2.5 px-3 text-xs font-semibold rounded-lg border capitalize transition-colors cursor-pointer ${
                          selectedRole === role
                            ? 'bg-blue-800 text-white border-blue-800'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <label htmlFor="captcha-input" className="text-xs font-semibold text-slate-800">
                      Security CAPTCHA: What is {captcha.a} + {captcha.b}?
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setCaptcha(createMathChallenge());
                        setCaptchaInput('');
                      }}
                      aria-label="Refresh CAPTCHA"
                      className="text-slate-500 hover:text-slate-900 p-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    id="captcha-input"
                    type="number"
                    required
                    value={captchaInput}
                    onChange={(e) => setCaptchaInput(e.target.value)}
                    placeholder="Enter sum"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white font-mono-tabular focus:outline-none focus:border-blue-800"
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                  <span className="flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5" />
                    Device ID:
                  </span>
                  <span className="font-mono-tabular font-medium text-slate-800">{deviceId}</span>
                </div>

                {errorMsg && (
                  <div
                    role="alert"
                    className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs sm:text-sm text-red-800"
                  >
                    {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 text-sm font-semibold text-white bg-blue-800 rounded-lg hover:bg-blue-900 disabled:opacity-60 transition-colors cursor-pointer"
                >
                  {loading ? 'Authenticating...' : 'Continue with Official Google Sign-In'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtpAndDevice} className="space-y-5">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1.5">
                  <p className="text-xs font-semibold text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Google Identity Verified
                  </p>
                  <p className="text-xs text-emerald-800 break-all">{firebaseUser?.email}</p>
                  <p className="text-xs text-emerald-800 capitalize">
                    Assigned Role: <strong className="font-semibold">{staffProfile?.role}</strong>
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-blue-800" />
                      Session OTP Verification
                    </span>
                    <span className="font-mono-tabular text-sm font-bold tracking-widest text-blue-800 bg-white px-2.5 py-1 rounded border border-slate-200">
                      {generatedOtp}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Enter the 6-digit verification code above to confirm this session and register
                    device <span className="font-mono-tabular font-medium">{deviceId}</span>.
                  </p>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value)}
                    placeholder="Enter 6-digit OTP"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white font-mono-tabular tracking-widest focus:outline-none focus:border-blue-800"
                  />
                </div>

                {errorMsg && (
                  <div
                    role="alert"
                    className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs sm:text-sm text-red-800"
                  >
                    {errorMsg}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      await logoutPortal();
                      setStep('auth');
                      setErrorMsg('');
                    }}
                    className="px-4 py-2.5 text-sm font-medium border border-slate-300 text-slate-800 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 px-4 text-sm font-semibold text-white bg-blue-800 rounded-lg hover:bg-blue-900 disabled:opacity-60 transition-colors cursor-pointer"
                  >
                    {loading ? 'Verifying Device...' : 'Verify & Open Workspace'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      <p className="text-center text-xs text-slate-500">
        MUN COMPUTER Business Manager · Protected by Firebase Authentication &amp; Role-Based Rules
      </p>
    </div>
  );
};
