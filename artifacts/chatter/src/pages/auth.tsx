import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { MessageCircle, Eye, EyeOff } from "lucide-react";
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

// ──────────────────────────────────────────────────────────────────────────────
// Schemas — separate for login vs register to avoid silent email validation block
// ──────────────────────────────────────────────────────────────────────────────
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
  // Custom-fetch prepends "HTTP 4xx StatusText: " — strip it so user sees clean message
  return message.replace(/^HTTP \d{3}[^:]*:\s*/, "");
}

// ──────────────────────────────────────────────────────────────────────────────
export function AuthPage() {
  const [, setLocation] = useLocation();
  const [isLogin, setIsLogin]           = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError]         = useState("");

  // Redirect if already authenticated
  useEffect(() => {
    if (getAuthToken()) setLocation("/chats");
  }, []);

  // ── Success handler ──────────────────────────────────────────────────────
  function onAuthSuccess(data: { token: string; user: unknown }) {
    setAuthToken(data.token);
    setAuthUser(data.user as AuthUser);
    initWebSocket();
    setLocation("/chats");
  }

  // ── Mutations with onSuccess / onError in hook options ───────────────────
  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => onAuthSuccess(data as { token: string; user: unknown }),
      onError:   (err)  => setApiError(stripHttpPrefix((err as Error).message ?? "Login failed")),
    },
  });

  const registerMutation = useRegister({
    mutation: {
      onSuccess: (data) => onAuthSuccess(data as { token: string; user: unknown }),
      onError:   (err)  => setApiError(stripHttpPrefix((err as Error).message ?? "Registration failed")),
    },
  });

  // ── Forms ────────────────────────────────────────────────────────────────
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

  // ── UI ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm flex flex-col items-center">

        {/* Logo */}
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-8 text-primary shadow-lg">
          <MessageCircle size={32} />
        </div>

        <h1 className="text-3xl font-bold mb-1">Welcome to Chatter</h1>
        <p className="text-muted-foreground mb-8 text-center text-sm">
          Private, secure, real-time messaging.
        </p>

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

        {/* ── SIGN IN FORM ─────────────────────────────────────────────── */}
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
          /* ── SIGN UP FORM ─────────────────────────────────────────────── */
          <Form {...registerForm}>
            <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="w-full space-y-4">

              <FormField control={registerForm.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
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
                      placeholder="choose a username (min 3 chars)"
                      autoComplete="username"
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
