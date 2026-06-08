import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { MessageCircle, Eye, EyeOff, CheckCircle2, Sparkles } from "lucide-react";
import { useLogin, useRegister } from "@workspace/api-client-react/generated/api";
import { setAuthToken, setAuthUser, getAuthToken } from "../lib/auth";
import { initWebSocket } from "../lib/websocket";
import type { AuthUser } from "../lib/auth";
import { Button } from "@/components/ui/button";

function stripHttpPrefix(message: string) {
  return message.replace(/^HTTP \d{3}[^:]*:\s*/, "");
}

function WelcomeScreen({ name, onDone }: { name: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="flex flex-col items-center gap-5">
        <div className="relative">
          <div className="w-24 h-24 rounded-3xl bg-primary/15 flex items-center justify-center shadow-xl">
            <MessageCircle size={44} className="text-primary" />
          </div>
          <div className="absolute -top-2 -right-2 w-9 h-9 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
            <CheckCircle2 size={20} className="text-white" />
          </div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles size={18} className="text-primary" />
            <h2 className="text-2xl font-bold">Welcome!</h2>
            <Sparkles size={18} className="text-primary" />
          </div>
          <p className="text-muted-foreground text-sm">
            Account created for <span className="font-semibold text-foreground">@{name}</span>
          </p>
          <p className="text-muted-foreground text-xs mt-1">Taking you to your chats…</p>
        </div>
        <div className="flex gap-1.5 mt-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function AuthPage() {
  const [, setLocation] = useLocation();
  const [isLogin, setIsLogin]           = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError]         = useState("");
  const [welcomeName, setWelcomeName]   = useState<string | null>(null);
  const [pendingData, setPendingData]   = useState<{ token: string; user: unknown } | null>(null);

  // Login form state
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register form state
  const [regEmail, setRegEmail]       = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (getAuthToken()) setLocation("/chats");
  }, []);

  function onAuthSuccess(data: { token: string; user: unknown }) {
    setAuthToken(data.token);
    setAuthUser(data.user as AuthUser);
    initWebSocket();
    // Handle pending invite from invite link
    const pendingInvite = sessionStorage.getItem("pendingInvite");
    if (pendingInvite) {
      sessionStorage.removeItem("pendingInvite");
      setLocation(`/invite/${pendingInvite}`);
    } else {
      setLocation("/chats");
    }
  }

  function onRegisterSuccess(data: { token: string; user: unknown }) {
    const u = data.user as any;
    setPendingData(data);
    setWelcomeName(u?.username || "you");
  }

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => onAuthSuccess(data as { token: string; user: unknown }),
      onError: (err) => setApiError(stripHttpPrefix((err as Error).message ?? "Login failed")),
    },
  });

  const registerMutation = useRegister({
    mutation: {
      onSuccess: (data) => onRegisterSuccess(data as { token: string; user: unknown }),
      onError: (err) => setApiError(stripHttpPrefix((err as Error).message ?? "Registration failed")),
    },
  });

  const switchTab = (toLogin: boolean) => {
    setIsLogin(toLogin);
    setShowPassword(false);
    setApiError("");
    setErrors({});
    loginMutation.reset();
    registerMutation.reset();
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!loginUsername.trim()) errs.username = "Username or email is required";
    if (!loginPassword)        errs.password = "Password is required";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setApiError("");
    setErrors({});
    loginMutation.mutate({ data: { username: loginUsername.trim(), password: loginPassword } });
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!regEmail.trim())           errs.email    = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(regEmail.trim())) errs.email = "Enter a valid email address";
    if (regUsername.trim().length < 3) errs.username = "Username must be at least 3 characters";
    if (regPassword.length < 6)    errs.password = "Password must be at least 6 characters";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setApiError("");
    setErrors({});
    registerMutation.mutate({ data: { email: regEmail.trim(), username: regUsername.trim(), password: regPassword } });
  };

  const isLoading = loginMutation.isPending || registerMutation.isPending;

  if (welcomeName) {
    return (
      <WelcomeScreen
        name={welcomeName}
        onDone={() => { if (pendingData) onAuthSuccess(pendingData); }}
      />
    );
  }

  const inputClass = "w-full h-12 px-4 rounded-xl bg-secondary/60 text-foreground placeholder:text-muted-foreground text-[15px] outline-none focus:ring-2 focus:ring-primary/40 border-0";
  const errorClass = "text-destructive text-xs mt-1";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm flex flex-col items-center">

        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 text-primary shadow-lg">
          <MessageCircle size={32} />
        </div>

        <h1 className="text-3xl font-bold mb-1">Chatter</h1>
        <p className="text-muted-foreground mb-7 text-center text-sm">Real-time messaging app</p>

        {/* Tab switcher */}
        <div className="flex w-full bg-secondary rounded-full p-1 mb-6">
          {(["Sign In", "Sign Up"] as const).map((label) => {
            const active = (label === "Sign In") === isLogin;
            return (
              <button
                key={label}
                type="button"
                className={`flex-1 py-2 rounded-full text-sm font-medium transition-colors ${
                  active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                }`}
                onClick={() => switchTab(label === "Sign In")}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* ── SIGN IN ── */}
        {isLogin ? (
          <form onSubmit={handleLoginSubmit} className="w-full space-y-4" noValidate>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Username or Email</label>
              <input
                className={inputClass}
                placeholder="your username or email"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                autoComplete="username"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              {errors.username && <p className={errorClass}>{errors.username}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
              <div className="relative">
                <input
                  className={`${inputClass} pr-12`}
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <p className={errorClass}>{errors.password}</p>}
            </div>

            {apiError && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3">
                <p className="text-destructive text-sm text-center">{apiError}</p>
              </div>
            )}

            <Button type="submit" className="w-full mt-2 h-13 py-6 text-base font-semibold rounded-xl" disabled={isLoading}>
              {isLoading ? <Spinner /> : "Sign In"}
            </Button>
          </form>

        ) : (
          /* ── SIGN UP ── */
          <form onSubmit={handleRegisterSubmit} className="w-full space-y-4" noValidate>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Email Address</label>
              <input
                className={inputClass}
                type="text"
                inputMode="email"
                placeholder="you@example.com"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                autoComplete="email"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              {errors.email && <p className={errorClass}>{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Username</label>
              <input
                className={inputClass}
                type="text"
                placeholder="choose a username"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                autoComplete="username"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              {errors.username && <p className={errorClass}>{errors.username}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
              <div className="relative">
                <input
                  className={`${inputClass} pr-12`}
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••  (min 6 chars)"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <p className={errorClass}>{errors.password}</p>}
            </div>

            {apiError && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3">
                <p className="text-destructive text-sm text-center">{apiError}</p>
              </div>
            )}

            <Button type="submit" className="w-full mt-2 h-13 py-6 text-base font-semibold rounded-xl" disabled={isLoading}>
              {isLoading ? <Spinner /> : "Create Account"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span className="flex items-center gap-2">
      <div className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
      Please wait…
    </span>
  );
}
