"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthLoadingScreen, LoginScreen } from "./auth-screen";
import { DayToDayWorkspace } from "./daytoday-workspace";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export default function Home() {
  const configured = isSupabaseConfigured();
  const supabase = useMemo(() => (configured ? createClient() : null), [configured]);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!configured);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSignOut() {
    if (session && supabase) {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) return;
    }
    setPreview(false);
    setSession(null);
  }

  if (!authReady) return <AuthLoadingScreen />;
  if (!session && !preview) return <LoginScreen configured={configured} onPreview={() => setPreview(true)} />;
  return <DayToDayWorkspace session={session} preview={preview} onSignOut={handleSignOut} />;
}
