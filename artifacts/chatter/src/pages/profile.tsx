import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera, LogOut, UserPlus, Settings, AtSign, ShieldAlert } from "lucide-react";
import { useGetMe, useUpdateProfile, useLogout } from "@workspace/api-client-react/generated/api";
import { clearAuthToken, clearAuthUser, useAuth } from "../lib/auth";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";

const profileSchema = z.object({
  displayName: z.string().min(2, "Name must be at least 2 characters"),
  bio: z.string().max(160, "Bio must be less than 160 characters").optional(),
});

export function ProfilePage() {
  const [, setLocation] = useLocation();
  const { data: me } = useGetMe();
  const updateProfile = useUpdateProfile();
  const logoutMut = useLogout();
  const { toast } = useToast();
  const { user } = useAuth();

  const isAdmin = (me as any)?.isAdmin === true || user?.isAdmin === true;

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { displayName: "", bio: "" },
  });

  useEffect(() => {
    if (me) {
      form.reset({
        displayName: me.displayName || me.username,
        bio: me.bio || "",
      });
    }
  }, [me, form]);

  const onSubmit = (values: z.infer<typeof profileSchema>) => {
    updateProfile.mutate(
      { data: values },
      {
        onSuccess: () => {
          toast({ title: "Profile updated", description: "Saved successfully." });
        },
      }
    );
  };

  const handleLogout = () => {
    logoutMut.mutate(undefined, {
      onSuccess: () => { clearAuthToken(); clearAuthUser(); setLocation("/"); },
      onError: () => { clearAuthToken(); clearAuthUser(); setLocation("/"); },
    });
  };

  if (!me) return null;

  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto">
      <header className="px-6 py-4 flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur-md z-10">
        <h1 className="text-2xl font-bold text-foreground">Profile</h1>
        <Link href="/invite">
          <Button variant="ghost" size="icon" className="rounded-full text-primary hover:bg-primary/10">
            <UserPlus size={24} />
          </Button>
        </Link>
      </header>

      <div className="px-6 py-6 pb-24">
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4 group cursor-pointer">
            <Avatar className="h-28 w-28 border-4 border-background shadow-lg">
              <AvatarImage src={me.avatarUrl || undefined} />
              <AvatarFallback className="bg-primary/20 text-primary text-3xl">
                {(me.displayName?.[0] || me.username[0]).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="text-white" size={28} />
            </div>
          </div>
          <h2 className="text-xl font-bold">{me.displayName || me.username}</h2>
          <p className="text-muted-foreground flex items-center gap-1 mt-1">
            <AtSign size={14} /> {me.username}
          </p>

          {isAdmin && (
            <Link href="/admin">
              <Button
                className="mt-4 px-6 py-2 rounded-xl font-bold text-white text-base shadow-lg"
                style={{ backgroundColor: "#dc2626" }}
              >
                <ShieldAlert size={18} className="mr-2" />
                Admin
              </Button>
            </Link>
          )}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4 bg-card p-5 rounded-2xl border border-border">
              <div className="flex items-center gap-2 mb-2 text-sm font-medium text-muted-foreground">
                <Settings size={16} />
                <span>Settings</span>
              </div>

              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your name" {...field} className="bg-secondary border-0" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bio</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="A little about yourself..."
                        className="resize-none bg-secondary border-0 min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full rounded-xl py-6 mt-4 font-medium"
                disabled={updateProfile.isPending}
              >
                {updateProfile.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>

        <div className="mt-8">
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full py-6 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl"
            disabled={logoutMut.isPending}
          >
            <LogOut size={20} className="mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
