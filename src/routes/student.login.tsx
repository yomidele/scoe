import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { TSUHeader } from "@/components/TSUHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { resolveMatricToEmail } from "@/lib/student-registration.functions";

export const Route = createFileRoute("/student/login")({
  head: () => ({ meta: [{ title: "Student Sign In — SCOE" }] }),
  component: StudentLoginPage,
});

function StudentLoginPage() {
  const navigate = useNavigate();
  const { session } = useAuthSession();
  const { isStudent, loading: roleLoading } = useRole();
  const [matric, setMatric] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const resolve = useServerFn(resolveMatricToEmail);

  useEffect(() => {
    if (!session || roleLoading) return;
    if (isStudent) navigate({ to: "/student/dashboard" });
  }, [session, roleLoading, isStudent, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { email } = await resolve({ data: { matric_number: matric.trim() } });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Welcome back");
      navigate({ to: "/student/dashboard" });
    } catch (e) {
      toast.error((e as Error).message);
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
            <CardTitle className="font-serif text-2xl">Student Sign In</CardTitle>
            <CardDescription>Enter your matric number and password.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="matric">Matric Number</Label>
                <Input id="matric" value={matric} onChange={(e) => setMatric(e.target.value)} placeholder="SOC/26/0001" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…</> : "Sign In"}
              </Button>
              <div className="flex justify-between text-xs text-muted-foreground">
                <Link to="/faculty/login" className="hover:underline">Faculty Admin →</Link>
                <Link to="/login" className="hover:underline">Super Admin →</Link>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Need an account? Use the registration link from your Faculty Admin.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
