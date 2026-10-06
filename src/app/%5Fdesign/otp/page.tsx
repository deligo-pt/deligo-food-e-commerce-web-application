"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import OtpInput from "@/components/auth/OtpInput";
import { Button } from "@/components/ui/button";
import { EMAIL_OTP_LENGTH, MOBILE_OTP_LENGTH } from "@/lib/otp";

/**
 * `/_design/otp`: the login code's verified moment, for sign-off (6 Oct 2026).
 *
 * The SMS code is six digits and the email code four, so the tiles now gather
 * into a 2×3 block or a 2×2 square. This page plays both side by side with
 * the real `OtpInput` and the real stylesheet, without a login, an SMS or a
 * request. "Play" types the code in, then marks it verified, as the login page
 * does when `/verify-otp` answers yes. Nothing here talks to the backend.
 */
export default function OtpPreviewPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Login code: verified animation</h1>
        <p className="text-sm text-muted-foreground">
          Preview only. Press Play to type a code and run the success animation; resize the
          window below 640px to see the phone sizes.
        </p>
      </header>
      <Demo title="Mobile (SMS): 6 digits" length={MOBILE_OTP_LENGTH} code="482913" />
      <Demo title="Email: 4 digits (unchanged)" length={EMAIL_OTP_LENGTH} code="8402" />
    </main>
  );
}

function Demo({ title, length, code }: { title: string; length: number; code: string }) {
  const [value, setValue] = useState("");
  const [verified, setVerified] = useState(false);
  // Remounts the field so each run starts from empty tiles.
  const [run, setRun] = useState(0);
  const [playing, setPlaying] = useState(false);

  async function play() {
    setPlaying(true);
    setVerified(false);
    setValue("");
    setRun((r) => r + 1);
    for (let i = 1; i <= length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 220));
      setValue(code.slice(0, i));
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    setVerified(true);
    await new Promise((resolve) => setTimeout(resolve, 2600));
    setPlaying(false);
  }

  return (
    <section className="space-y-3 rounded-3xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <Button type="button" size="sm" onClick={play} disabled={playing}>
          {playing ? "Playing…" : "Play"}
        </Button>
      </div>
      {/* The login page's own frame around the field. */}
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
        <KeyRound size={18} className="shrink-0 text-muted-foreground" />
        <OtpInput
          key={run}
          length={length}
          value={value}
          onChange={setValue}
          label={title}
          verified={verified}
        />
      </div>
      {verified ? (
        <p className="text-center text-sm font-semibold text-[var(--success,#10b981)]">
          Verified successfully
        </p>
      ) : null}
    </section>
  );
}
