import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TSUHeader } from "@/components/TSUHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/lecturer/login")({
  head: () => ({ meta: [{ title: "Lecturer Sign In — SCOE" }] }),
  component: LecturerLogin,
});

function LecturerLogin() {
  const navigate = useNavigate();
  const { session } = useAuthSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (session) navigate({ to: "/lecturer/dashboard" }); }, [session, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { toast.error(error.message); return; }
      toast.success("Welcome");
      navigate({ to: "/lecturer/dashboard" });
    } finally { setSubmitting(false); }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TSUHeader />
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md tsu-shadow">
          <CardHeader>
            <CardTitle className="font-serif text-2xl">Lecturer Sign In</CardTitle>
            <CardDescription>Accounts are created by your Department Admin.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
              <div className="space-y-1.5"><Label htmlFor="password">Password</Label><Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
              <Button type="submit" className="w-full" disabled={submitting}>{submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…</> : "Sign In"}</Button>
              <div className="flex justify-between text-xs text-muted-foreground">
                <Link to="/dept-admin/login" className="hover:underline">Department Admin →</Link>
                <Link to="/student/login" className="hover:underline">Student →</Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
