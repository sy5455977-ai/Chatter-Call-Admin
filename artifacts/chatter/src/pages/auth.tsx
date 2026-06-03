import { useState } from "react";
import { useLocation } from "wouter";
import { MessageCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin, useRegister } from "@workspace/api-client-react/generated/api";
import { setAuthToken, setAuthUser } from "../lib/auth";
import type { AuthUser } from "../lib/auth";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const authSchema = z.object({
  username: z.string().min(1, "Required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  email: z.string().email("Invalid email").optional(),
});

export function AuthPage() {
  const [, setLocation] = useLocation();
  const [isLogin, setIsLogin] = useState(true);

  const loginMutation = useLogin();
  const registerMutation = useRegister();

  const form = useForm<z.infer<typeof authSchema>>({
    resolver: zodResolver(authSchema),
    defaultValues: { username: "", password: "", email: "" },
  });

  const onSubmit = (values: z.infer<typeof authSchema>) => {
    if (isLogin) {
      loginMutation.mutate(
        { data: { username: values.username, password: values.password } },
        {
          onSuccess: (data) => {
            setAuthToken(data.token);
            setAuthUser(data.user as unknown as AuthUser);
            setLocation("/chats");
          },
        }
      );
    } else {
      if (!values.email) {
        form.setError("email", { message: "Email is required for sign up" });
        return;
      }
      registerMutation.mutate(
        { data: { username: values.username, password: values.password, email: values.email } },
        {
          onSuccess: (data) => {
            setAuthToken(data.token);
            setAuthUser(data.user as unknown as AuthUser);
            setLocation("/chats");
          },
        }
      );
    }
  };

  const error = loginMutation.error?.message || registerMutation.error?.message;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-8 text-primary">
          <MessageCircle size={32} />
        </div>

        <h1 className="text-3xl font-bold mb-2">Welcome to Chatter</h1>
        <p className="text-muted-foreground mb-8 text-center">Private, secure, and intimate messaging.</p>

        <div className="flex w-full bg-secondary rounded-full p-1 mb-8">
          <button
            className={`flex-1 py-2 rounded-full text-sm font-medium transition-colors ${isLogin ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            onClick={() => setIsLogin(true)}
          >
            Sign In
          </button>
          <button
            className={`flex-1 py-2 rounded-full text-sm font-medium transition-colors ${!isLogin ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            onClick={() => setIsLogin(false)}
          >
            Sign Up
          </button>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-4">
            {!isLogin && (
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="you@example.com" {...field} className="bg-secondary/50 border-0" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{isLogin ? "Username or Email" : "Username"}</FormLabel>
                  <FormControl>
                    <Input placeholder={isLogin ? "username or email" : "username"} {...field} className="bg-secondary/50 border-0" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} className="bg-secondary/50 border-0" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {error && (
              <p className="text-destructive text-sm text-center">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full mt-6 py-6 text-lg font-medium rounded-xl"
              disabled={loginMutation.isPending || registerMutation.isPending}
            >
              {loginMutation.isPending || registerMutation.isPending
                ? "Please wait..."
                : isLogin
                ? "Sign In"
                : "Create Account"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
