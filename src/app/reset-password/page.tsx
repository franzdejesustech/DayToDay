"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, LockKeyhole, SunMedium } from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const configured = isSupabaseConfigured();
  const supabase = useMemo(() => (configured ? createClient() : null), [configured]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    if (!supabase) {
      setMessage({ type: "error", text: "Supabase is not connected yet." });
      return;
    }
    if (password.length < 6) {
      setMessage({ type: "error", text: "Use a password with at least 6 characters." });
      return;
    }
    if (password !== confirmPassword) {
      setMessage({ type: "error", text: "The passwords do not match." });
      return;
    }
    setIsBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsBusy(false);
    setMessage(error ? { type: "error", text: error.message } : { type: "success", text: "Your password has been updated. You can sign in now." });
  }

  return (
    <main className="auth-page auth-reset-page">
      <section className="auth-panel">
        <div className="auth-panel-inner">
          <div className="auth-mobile-brand"><span className="brand-mark"><SunMedium size={16} /></span><span>DayToDay</span></div>
          <div className="auth-heading"><span className="auth-icon"><LockKeyhole size={17} /></span><span className="eyebrow">ACCOUNT SECURITY</span><h2>Set a new password</h2><p>Choose something memorable and private.</p></div>
          <form className="auth-form reset-form" onSubmit={handleSubmit}>
            <label><span>New password</span><div className="auth-input"><LockKeyhole size={16} /><input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" required /></div></label>
            <label><span>Confirm password</span><div className="auth-input"><LockKeyhole size={16} /><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Type it again" required /></div></label>
            {message ? <div className={`auth-message message-${message.type}`} role="status">{message.type === "success" ? <CheckCircle2 size={15} /> : null}{message.text}</div> : null}
            <button className="auth-submit" type="submit" disabled={isBusy}>{isBusy ? "Updating…" : "Update password"}</button>
          </form>
          <Link className="back-link" href="/"><ArrowLeft size={15} /> Back to sign in</Link>
        </div>
      </section>
    </main>
  );
}
