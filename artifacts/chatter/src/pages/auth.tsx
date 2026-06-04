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

// Separate schemas for login vs register — avoids empty-string email failing login silently
const loginSchema = z.object({
  username: z.string().min(1, "Username or email is required"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

function getApiErrorMessage(error: unknown): string {
  if (!error) return "";
  if (error instanceof Error) {
    // Strip "HTTP 4xx StatusText: " prefix added by custom-fetch
    return error.message.replace(/^HTTP \d{3}[^:]*:\s*/, "");
  }
  return "Something went wrong. Please try again.";
}

export function AuthPage() {
  const [, setLocation] = useLocation();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (getAuthToken()) setLocation("/chats");
  }, []);

  const loginMutation = useLogin();
  const registerMutation = useRegister();

  const loginForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const registerForm = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", username: "", password: "" },
  });

  const handleSuccess = (data: { token: string; user: unknown }) => {
    setAuthToken(data.token);
    setAuthUser(data.user as AuthUser);
    initWebSocket();
    setLocation("/chats");
  };

  const onLoginSubmit = (values: LoginValues) => {
    loginMutation.mutate(
      { data: { username: values.username, password: values.password } },
      { onSuccess: handleSuccess }
    );
  };

  const onRegisterSubmit = (values: RegisterValues) => {
    registerMutation.mutate(
      { data: { username: values.username, password: values.password, email: values.email } },
      { onSuccess: handleSuccess }
    );
  };

  const switchTab = (toLogin: boolean) => {
    setIsLogin(toLogin);
    setShowPassword(false);
    loginForm.clearErrors();
    registerForm.clearErrors();
    loginMutation.reset();
    registerMutation.reset();
  };

  const loginError = getApiErrorMessage(loginMutation.error);
  const registerError = getApiErrorMessage(registerMutation.error);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-8 text-primary">
          <MessageCircle size={32} />
        </div>

        <h1 className="text-3xl font-bold mb-2">Welcome to Chatter</h1>
        <p className="text-muted-foreground mb-8 text-center text-sm">
          Private, secure, and intimate messaging.
        </p>

        {/* Tab switcher */}
        <div className="flex w-full bg-secondary rounded-full p-1 mb-8">
          <button
            type="button"
            className={`flex-1 py-2 rounded-full text-sm font-medium transition-colors ${
              isLogin ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
            onClick={() => switchTab(true)}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`flex-1 py-2 rounded-full text-sm font-medium transition-colors ${
              !isLogin ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
            onClick={() => switchTab(false)}
          >
            Sign Up
          </button>
        </div>

        {/* Sign In Form */}
        {isLogin ? (
          <Form {...loginForm}>
            <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="w-full space-y-4">
              <FormField
                control={loginForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username or Email</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="username or email"
                        autoComplete="username"
                        {...field}
                        className="bg-secondary/50 border-0 h-12"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={loginForm.control}
                name="password"
                render={({ field }) => (
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
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {loginError && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3">
                  <p className="text-destructive text-sm text-center">{loginError}</p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full mt-4 py-6 text-base font-semibold rounded-xl"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                    Signing in…
                  </span>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </Form>
        ) : (
          /* Sign Up Form */
          <Form {...registerForm}>
            <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="w-full space-y-4">
              <FormField
                control={registerForm.control}
                name="email"
                render={({ field }) => (
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
                )}
              />

              <FormField
                control={registerForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="choose a username"
                        autoComplete="username"
                        {...field}
                        className="bg-secondary/50 border-0 h-12"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={registerForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          autoComplete="new-password"
                          {...field}
                          className="bg-secondary/50 border-0 h-12 pr-11"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {registerError && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3">
                  <p className="text-destructive text-sm text-center">{registerError}</p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full mt-4 py-6 text-base font-semibold rounded-xl"
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                    Creating account…
                  </span>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>
          </Form>
        )}
      </div>
    </div>
  );
}
