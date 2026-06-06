import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { MessageCircle, Eye, EyeOff, CheckCircle2, Sparkles } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin, useRegister } from "@workspace/api-client-react/generated/api";
import { setAuthToken, setAuthUser, getAuthToken } from "../lib/auth";
import { initWebSocket } from "../lib/websocket";
import type { AuthUser } from "../lib/auth";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const loginSchema = z.object({
  username: z.string().min(1, "Username or email is required"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z.object({
  email:    z.string().min(1, "Email is required").email("Enter a valid email address"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginValues    = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

function stripHttpPrefix(message: string) {
  return message.replace(/^HTTP \d{3}[^:]*:\s*/, "");
}

// Welcome screen shown briefly after signup
function WelcomeScreen({ name, onDone }: { name: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="flex flex-col items-center gap-5 animate-in fade-in-0 zoom-in-95 duration-500">
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
  const [isLogin, setIsLogin]             = useState(true);
  const [showPassword, setShowPassword]   = useState(false);
  const [apiError, setApiError]           = useState("");
  const [welcomeName, setWelcomeName]     = useState<string | null>(null);
  const [pendingData, setPendingData]     = useState<{ token: string; user: unknown } | null>(null);

  useEffect(() => {
    if (getAuthToken()) setLocation("/chats");
  }, []);

  function onAuthSuccess(data: { token: string; user: unknown }) {
    setAuthToken(data.token);
    setAuthUser(data.user as AuthUser);
    initWebSocket();
    setLocation("/chats");
  }

  function onRegisterSuccess(data: { token: string; user: unknown }) {
    const u = data.user as any;
    setPendingData(data);
    setWelcomeName(u?.username || "you");
  }

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => onAuthSuccess(data as { token: string; user: unknown }),
      onError:   (err)  => setApiError(stripHttpPrefix((err as Error).message ?? "Login failed")),
    },
  });

  const registerMutation = useRegister({
    mutation: {
      onSuccess: (data) => onRegisterSuccess(data as { token: string; user: unknown }),
      onError:   (err)  => setApiError(stripHttpPrefix((err as Error).message ?? "Registration failed")),
    },
  });

  const loginForm = useForm<LoginValues>({
    resolver:      zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const registerForm = useForm<RegisterValues>({
    resolver:      zodResolver(registerSchema),
    defaultValues: { email: "", username: "", password: "" },
  });

  const switchTab = (toLogin: boolean) => {
    setIsLogin(toLogin);
    setShowPassword(false);
    setApiError("");
    loginForm.clearErrors();
    registerForm.clearErrors();
    loginMutation.reset();
    registerMutation.reset();
  };

  const onLoginSubmit = (v: LoginValues) => {
    setApiError("");
    loginMutation.mutate({ data: { username: v.username, password: v.password } });
  };

  const onRegisterSubmit = (v: RegisterValues) => {
    setApiError("");
    registerMutation.mutate({ data: { email: v.email, username: v.username, password: v.password } });
  };

  const isLoading = loginMutation.isPending || registerMutation.isPending;

  // Show welcome screen after signup
  if (welcomeName) {
    return (
      <WelcomeScreen
        name={welcomeName}
        onDone={() => {
          if (pendingData) onAuthSuccess(pendingData);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm flex flex-col items-center">

        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 text-primary shadow-lg">
          <MessageCircle size={32} />
        </div>

        <h1 className="text-3xl font-bold mb-1">Chatter</h1>
        <p className="text-muted-foreground mb-7 text-center text-sm">
          Real-time messaging app
        </p>

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

        {isLogin ? (
          <Form {...loginForm}>
            <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="w-full space-y-4">
              <FormField control={loginForm.control} name="username" render={({ field }) => (
                <FormItem>
                  <FormLabel>Username or Email</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="your username or email"
                      autoComplete="username"
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      {...field}
                      className="bg-secondary/50 border-0 h-12"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={loginForm.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        {...field}
                        className="bg-secondary/50 border-0 h-12 pr-11"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {apiError && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3">
                  <p className="text-destructive text-sm text-center">{apiError}</p>
                </div>
              )}

              <Button type="submit" className="w-full mt-2 py-6 text-base font-semibold rounded-xl" disabled={isLoading}>
                {isLoading ? <Spinner /> : "Sign In"}
              </Button>
            </form>
          </Form>

        ) : (
          <Form {...registerForm}>
            <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="w-full space-y-4">

              <FormField control={registerForm.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      inputMode="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      {...field}
                      className="bg-secondary/50 border-0 h-12"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={registerForm.control} name="username" render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="choose a username"
                      autoComplete="username"
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      {...field}
                      className="bg-secondary/50 border-0 h-12"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={registerForm.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••  (min 6 chars)"
                        autoComplete="new-password"
                        {...field}
                        className="bg-secondary/50 border-0 h-12 pr-11"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {apiError && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3">
                  <p className="text-destructive text-sm text-center">{apiError}</p>
                </div>
              )}

              <Button type="submit" className="w-full mt-2 py-6 text-base font-semibold rounded-xl" disabled={isLoading}>
                {isLoading ? <Spinner /> : "Create Account"}
              </Button>
            </form>
          </Form>
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
