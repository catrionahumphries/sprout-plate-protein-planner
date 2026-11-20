import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const qc = useQueryClient();
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); qc.invalidateQueries(); });
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    return () => data.subscription.unsubscribe();
  }, [qc]);
  return { session, ready };
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { session, ready } = useSession();
  if (!ready) return <p className="p-8 text-center text-muted-foreground">Loading…</p>;
  if (!session) return <SignIn />;
  return <>{children}</>;
}

function SignIn() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = mode === "in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    if (mode === "up") toast.success("Check your email to confirm your account.");
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold">{mode === "in" ? "Sign in" : "Create account"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Your recipes are private to your account.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="pw">Password</Label><Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "…" : mode === "in" ? "Sign in" : "Sign up"}</Button>
      </form>
      <button className="mt-4 text-sm text-primary underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
        {mode === "in" ? "No account? Sign up" : "Have an account? Sign in"}
      </button>
    </div>
  );
}