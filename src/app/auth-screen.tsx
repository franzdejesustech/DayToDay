"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Grid2X2,
  LockKeyhole,
  Mail,
  Settings2,
  SunMedium,
  UserRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "sign-in" | "sign-up";
type Message = { type: "error" | "success" | "info"; text: string };

export function AuthLoadingScreen() {
  return (
    <main className="auth-loading">
      <span className="brand-mark"><SunMedium size={18} /></span>
      <span>Preparing your day...</span>
    </main>
  );
}

export function LoginScreen({ configured, onPreview }: { configured: boolean; onPreview: () => void }) {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const supabase = useMemo(() => (configured ? createClient() : null), [configured]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorCode = params.get("error_code") || params.get("error");
    if (!errorCode) return;
    const timeout = window.setTimeout(() => {
      setMessage({
        type: "error",
        text: errorCode === "otp_expired"
          ? "That email link has expired. Request a new link and try again."
          : params.get("error_description") || "We could not complete that account action.",
      });
    }, 0);
    window.history.replaceState({}, document.title, window.location.pathname);
    return () => window.clearTimeout(timeout);
  }, []);

  function switchMode(next: AuthMode) {
    setMode(next);
    setMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    if (!supabase) {
      setMessage({ type: "info", text: "Supabase is not configured yet." });
      return;
    }
    if (password.length < 6) {
      setMessage({ type: "error", text: "Use a password with at least 6 characters." });
      return;
    }
    setIsBusy(true);
    const result = mode === "sign-in"
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: window.location.origin,
          },
        });
    setIsBusy(false);
    if (result.error) {
      setMessage({ type: "error", text: result.error.message });
      return;
    }
    if (mode === "sign-up" && !result.data.session) {
      setMessage({ type: "success", text: "Account created. Check your email to confirm it, then sign in." });
      setMode("sign-in");
      return;
    }
    setMessage({ type: "success", text: "You are signed in. Welcome back." });
  }

  async function handleForgotPassword() {
    if (!supabase) {
      setMessage({ type: "info", text: "Supabase is not configured yet." });
      return;
    }
    if (!email.trim()) {
      setMessage({ type: "info", text: "Enter your email first, then choose Forgot password." });
      return;
    }
    setIsBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setIsBusy(false);
    setMessage(error
      ? { type: "error", text: error.message }
      : { type: "success", text: "If an account exists for that email, a reset link is on its way." });
  }

  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="auth-story-top">
          <div className="brand-lockup auth-brand-lockup">
            <span className="brand-mark"><SunMedium size={18} /></span>
            <div><span className="brand-name">DayToDay</span><span className="brand-tagline">Everything you need, daily.</span></div>
          </div>
          <span className="story-kicker">A calmer way to keep up</span>
        </div>
        <div className="story-copy">
          <h1>Make space for the day you want.</h1>
          <p>Tasks, time, notes, habits, and focus sessions in one flexible daily workspace.</p>
          <div className="story-points">
            <span><Check size={14} /> Plan every task your way</span>
            <span><Check size={14} /> See work from every useful angle</span>
            <span><Check size={14} /> Protect time for what matters</span>
          </div>
        </div>
        <div className="story-bottom"><span>Made for real, full days.</span></div>
      </section>

      <section className="auth-panel">
        <div className="auth-panel-inner">
          <div className="auth-mobile-brand"><span className="brand-mark"><SunMedium size={16} /></span><span>DayToDay</span></div>
          <div className="auth-heading">
            <span className="auth-icon"><LockKeyhole size={17} /></span>
            <span className="eyebrow">YOUR PRIVATE SPACE</span>
            <h2>{mode === "sign-in" ? "Welcome back" : "Create your space"}</h2>
            <p>{mode === "sign-in" ? "Sign in to pick up where you left off." : "A few details and your day is ready."}</p>
          </div>
          <div className="auth-tabs" role="tablist" aria-label="Account access">
            <button className={mode === "sign-in" ? "active" : ""} type="button" role="tab" aria-selected={mode === "sign-in"} onClick={() => switchMode("sign-in")}>Sign in</button>
            <button className={mode === "sign-up" ? "active" : ""} type="button" role="tab" aria-selected={mode === "sign-up"} onClick={() => switchMode("sign-up")}>Create account</button>
          </div>
          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === "sign-up" ? (
              <label><span>Your name</span><div className="auth-input"><UserRound size={16} /><input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" required /></div></label>
            ) : null}
            <label><span>Email address</span><div className="auth-input"><Mail size={16} /><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /></div></label>
            <label><span>Password</span><div className="auth-input"><LockKeyhole size={16} /><input type={showPassword ? "text" : "password"} autoComplete={mode === "sign-in" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" required /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
            {mode === "sign-in" ? <button className="forgot-button" type="button" onClick={handleForgotPassword} disabled={isBusy}>Forgot password?</button> : null}
            {message ? <div className={`auth-message message-${message.type}`} role="status">{message.text}</div> : null}
            <button className="auth-submit" type="submit" disabled={isBusy}>{isBusy ? "Working..." : mode === "sign-in" ? "Sign in to DayToDay" : "Create my DayToDay"}<ArrowRight size={16} /></button>
          </form>
          {!configured ? <div className="auth-setup-note"><span className="setup-note-icon"><Settings2 size={15} /></span><p><strong>Supabase is not connected yet.</strong><br />Add the project keys to activate real accounts.</p></div> : null}
          <div className="auth-divider"><span>or</span></div>
          <button className="preview-button" type="button" onClick={onPreview}><Grid2X2 size={16} /> Preview the empty workspace</button>
          <p className="auth-footnote">Signed-in data is protected by per-user database access rules.</p>
        </div>
      </section>
    </main>
  );
}
