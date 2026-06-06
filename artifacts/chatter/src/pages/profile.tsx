import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera, LogOut, UserPlus, ShieldAlert, AtSign, Save } from "lucide-react";
import { useGetMe, useUpdateProfile, useLogout } from "@workspace/api-client-react/generated/api";
import { clearAuthToken, clearAuthUser, useAuth } from "../lib/auth";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { getAuthToken } from "../lib/auth";

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
  const [avatarUploading, setAvatarUploading] = useState(false);

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
          toast({ title: "Profile updated ✓", description: "Saved successfully." });
        },
      }
    );
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = getAuthToken();
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      updateProfile.mutate(
        { data: { displayName: form.getValues("displayName"), avatarUrl: data.url } },
        {
          onSuccess: () => {
            toast({ title: "Avatar updated ✓" });
          },
        }
      );
    } catch {
      toast({ title: "Upload failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setAvatarUploading(false);
    }
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
      {/* Header */}
      <header className="px-5 py-4 flex items-center justify-between sticky top-0 bg-background/90 backdrop-blur-md z-10 border-b border-border">
        <h1 className="text-xl font-bold text-foreground">Profile Settings</h1>
        <div className="flex items-center gap-2">
          <Link href="/invite">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full text-xs h-8 px-3 border-primary text-primary hover:bg-primary/10"
            >
              <UserPlus size={13} className="mr-1" />
              Invite Friend
            </Button>
          </Link>
          {isAdmin && (
            <Link href="/admin">
              <Button
                size="sm"
                className="rounded-full text-xs h-8 px-3 font-bold text-white"
                style={{ backgroundColor: "#dc2626" }}
              >
                <ShieldAlert size={13} className="mr-1" />
                Admin Panel
              </Button>
            </Link>
          )}
        </div>
      </header>

      <div className="px-5 py-5 pb-28">
        {/* Avatar + name card */}
        <div className="bg-card rounded-2xl border border-border p-5 mb-4">
          <div className="flex items-center gap-4">
            <label className="relative cursor-pointer group flex-shrink-0">
              <Avatar className="h-20 w-20 border-2 border-border shadow-md">
                <AvatarImage src={me.avatarUrl || undefined} />
                <AvatarFallback className="bg-primary/20 text-primary text-2xl font-bold">
                  {(me.displayName?.[0] || me.username[0]).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {avatarUploading ? (
                  <div className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                ) : (
                  <Camera className="text-white" size={20} />
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </label>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-foreground truncate">{me.displayName || me.username}</h2>
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                <AtSign size={13} /> {me.username}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{me.email}</p>
            </div>
          </div>
        </div>

        {/* Personal Information */}
        <div className="bg-card rounded-2xl border border-border p-5 mb-4">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <div className="h-5 w-5 rounded-md bg-primary/10 flex items-center justify-center">
              <AtSign size={12} className="text-primary" />
            </div>
            Personal Information
          </h3>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Display Name
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Your name"
                        {...field}
                        className="bg-secondary/50 border-0 h-11 rounded-xl"
                      />
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
                    <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Bio
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Apne baare mein kuch batao..."
                        className="resize-none bg-secondary/50 border-0 min-h-[80px] rounded-xl"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full rounded-xl py-5 font-semibold flex items-center gap-2"
                disabled={updateProfile.isPending}
              >
                {updateProfile.isPending ? (
                  <>
                    <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Save Changes
                  </>
                )}
              </Button>
            </form>
          </Form>
        </div>

        {/* Logout */}
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full py-5 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl border border-destructive/30 font-semibold"
          disabled={logoutMut.isPending}
        >
          <LogOut size={18} className="mr-2" />
          {logoutMut.isPending ? "Signing out…" : "Log Out"}
        </Button>
      </div>
    </div>
  );
}
