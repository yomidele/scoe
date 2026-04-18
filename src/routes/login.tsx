import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TSUHeader } from "@/components/TSUHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { ensureDemoAdmin } from "@/server/seed-admin";
import { useAuthSession } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — TSU Result Portal" }] }),
  component: LoginPage,
});

const DEMO_EMAIL = "admin@tsu.demo";
const DEMO_PASSWORD = "demo1234";

function LoginPage() {
  const navigate = useNavigate();
  const { session } = useAuthSession();
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (session) navigate({ to: "/dashboard" });
  }, [session, navigate]);

  // Ensure demo admin exists on page load
  useEffect(() => {
    ensureDemoAdmin().catch((e) => console.error("seed admin failed", e));
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Attempt to seed (idempotent) before signing in to handle first-ever load
      await ensureDemoAdmin();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Welcome back, Admin");
      navigate({ to: "/dashboard" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TSUHeader />
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md tsu-shadow">
          <CardHeader>
            <CardTitle className="font-serif text-2xl">Administrator Sign In</CardTitle>
            <CardDescription>Demo credentials are pre-filled. Click sign in to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…</> : "Sign In"}
              </Button>
              <p className="rounded-md bg-secondary p-3 text-xs text-secondary-foreground">
                <strong>Demo account:</strong> {DEMO_EMAIL} / {DEMO_PASSWORD}
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
