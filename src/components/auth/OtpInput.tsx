"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  OTP_LENGTH,
  sanitizeOtp,
  tileChanges,
  type TileChange,
} from "@/lib/otp";

interface TileMotion {
  /** Bumped only when *this* tile changes, and used as its key. */
  version: number;
  change: TileChange | null;
  /**
   * Changed together with other tiles — a paste or an SMS autofill. Such
   * tiles animate one after another, on the stylesheet's 50ms step; a single
   * keystroke never waits for its position.
   */
  batch: boolean;
}

const REST: TileMotion = { version: 0, change: null, batch: false };

/** Where the eight sparks of the verified badge are thrown. Order is the CSS's. */
const SPARKS = 8;

/**
 * The login code as four tiles — and, once the server accepts it, the
 * verified moment.
 *
 * ## One input, four pictures of it
 *
 * There is exactly one real `<input>`, stretched invisibly over the tiles.
 * The tiles are `aria-hidden` drawings of its value. Four separate inputs need
 * hand-written focus jumping, which is where OTP fields break — fast typing
 * lands in the wrong box, a paste fills one box, SMS autofill fills nothing.
 * A single input keeps all of that exactly as the plain field had it. The
 * value is still the string `useLoginFlow` owns; nothing here copies it.
 *
 * ## Typing
 *
 * The tile waiting for a digit carries the ring and a blinking caret. When a
 * digit lands it fades in, and the ring the tile just lost is **erased around
 * its edge** — an SVG stroke unwinding — while the next tile lights up. Each
 * tile is keyed on its own `version`, which changes only when its digit does,
 * so a keystroke replays one tile and leaves the others alone: that is what
 * keeps fast typing from restarting an animation half-way.
 *
 * ## Verified (`verified`)
 *
 * Set by the page only after `/verify-otp` has answered yes — submission stays
 * manual. The same four tiles, never remounted, then run one CSS timeline
 * (`globals.css`, "the verified moment"): they tilt into a square, link up,
 * turn green, fold into a single tile, and that tile becomes the badge. The
 * page holds for the timeline and then moves on; see `VERIFIED_HOLD_MS`.
 */
export default function OtpInput({
  value,
  onChange,
  label,
  disabled,
  verified = false,
}: {
  value: string;
  onChange: (next: string) => void;
  /** The field's accessible name — the tiles replace the visible placeholder. */
  label: string;
  disabled?: boolean;
  /** The server accepted the code: play the verified moment. */
  verified?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [motion, setMotion] = useState<TileMotion[]>(() =>
    Array.from({ length: OTP_LENGTH }, () => REST),
  );

  function handleChange(raw: string) {
    const next = sanitizeOtp(raw);
    // A non-digit keystroke leaves the value as it was: nothing to animate.
    if (next === value) return;

    const changes = tileChanges(value, next);
    const batch = changes.filter(Boolean).length > 1;
    setMotion((current) =>
      current.map((tile, index) => {
        const change = changes[index];
        if (!change) return tile;
        return { version: tile.version + 1, change, batch };
      }),
    );
    onChange(next);
  }

  // The tile the next digit will land in — shown as the caret would be.
  const activeIndex = Math.min(value.length, OTP_LENGTH - 1);
  const complete = value.length === OTP_LENGTH;

  return (
    <div
      data-verified={verified ? "true" : undefined}
      className={cn(
        "otp-stage relative flex-1",
        // The square needs a second row of room, and it is taken in one step
        // when the code is accepted: the buttons below are swapped for the
        // verified copy at the same moment, so nothing jumps twice.
        verified
          ? "h-[calc(var(--otp-s)_*_2_+_var(--otp-gap))]"
          : "h-[var(--otp-s)]",
      )}
    >
      <input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        // No `maxLength`: the browser would cut a pasted "98-76" to "98-7"
        // before `sanitizeOtp` ever saw it, and the code would arrive as 987.
        // The cap is applied to the digits, not to what was pasted.
        value={value}
        disabled={disabled || verified}
        aria-label={label}
        onChange={(event) => handleChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        // Keeps the (invisible) caret at the end, so what is typed always
        // lands in the highlighted tile — a caret left in the middle of an
        // invisible string would put the next digit somewhere the tiles do
        // not show. A *whole* selection is left alone: select-all then type,
        // delete or paste replaced the code in the plain field this replaced,
        // and still has to. Only acts when it changes something, so it cannot
        // loop on its own `select` event.
        onSelect={(event) => {
          const input = event.currentTarget;
          const end = input.value.length;
          const start = input.selectionStart ?? end;
          const stop = input.selectionEnd ?? end;
          const wholeSelected = start === 0 && stop === end && end > 0;
          if (!wholeSelected && (start !== end || stop !== end)) {
            input.setSelectionRange(end, end);
          }
        }}
        // Transparent rather than `opacity-0`: some mobile browsers will not
        // offer SMS autofill on a field they consider hidden. 16px text stops
        // iOS zooming the page on focus.
        className={cn(
          "absolute inset-0 z-10 h-full w-full cursor-text bg-transparent text-base text-transparent caret-transparent outline-none selection:bg-transparent disabled:cursor-not-allowed",
          verified && "pointer-events-none",
        )}
      />

      <div
        aria-hidden="true"
        className="flex items-center justify-center gap-[var(--otp-g)]"
      >
        {Array.from({ length: OTP_LENGTH }, (_, index) => {
          const digit = value[index] ?? "";
          const tile = motion[index] ?? REST;
          const isActive = !verified && focused && !complete && index === activeIndex;
          const justFilled = !verified && tile.change === "filled" && digit;
          return (
            <div
              key={index}
              className="otp-tile-frame size-[var(--otp-s)] shrink-0"
            >
              <div
                key={`${index}-${tile.version}`}
                data-batch={tile.batch ? "true" : undefined}
                className={cn(
                  "otp-tile relative flex size-full items-center justify-center rounded-xl border text-xl font-semibold text-foreground transition-colors duration-200 dark:text-neutral-50",
                  isActive
                    ? "border-primary bg-card ring-4 ring-primary/15 dark:border-pink-400 dark:bg-neutral-900 dark:ring-pink-400/15"
                    : digit
                      ? "border-primary/40 bg-card dark:border-pink-400/40 dark:bg-neutral-900"
                      : // Not `border-border`: that token is #edeeef, about
                        // 1.1:1 on the white card, and an empty tile drawn in
                        // it simply is not there (owner's screenshot, 21 Sep).
                        // A real grey edge and a faint fill make four boxes
                        // read as four boxes before anything is typed.
                        "border-gray-300 bg-gray-50 dark:border-neutral-700 dark:bg-neutral-900",
                )}
              >
                {digit ? (
                  <span className={cn(justFilled && "otp-digit-in")}>{digit}</span>
                ) : isActive ? (
                  <span className="otp-caret h-5 w-0.5 rounded-full bg-primary dark:bg-pink-400" />
                ) : null}

                {/* The ring this tile just handed on, erased around its edge. */}
                {justFilled ? (
                  <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    className="otp-trace pointer-events-none absolute -inset-px size-[calc(100%_+_2px)] text-primary dark:text-pink-400"
                  >
                    <rect
                      x="1"
                      y="1"
                      width="98"
                      height="98"
                      rx="24"
                      pathLength={100}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {verified ? <VerifiedArt /> : null}
    </div>
  );
}

/**
 * Everything the verified moment adds to the tiles: the four links of the
 * square, and the badge the square folds into — its rings and its sparks.
 * Mounted only on success, so none of it costs a thing on a normal sign-in
 * that has not got there yet. Positions and timings are all in `globals.css`.
 */
function VerifiedArt() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className="otp-links absolute inset-0 text-primary dark:text-pink-400">
        <span className="otp-link otp-link-top absolute left-1/2 top-0 h-0.5 w-[var(--otp-gap)] rounded-full bg-current" />
        <span className="otp-link otp-link-left absolute left-1/2 top-0 h-[var(--otp-gap)] w-0.5 rounded-full bg-current" />
        <span className="otp-link otp-link-right absolute left-1/2 top-0 h-[var(--otp-gap)] w-0.5 rounded-full bg-current" />
        <span className="otp-link otp-link-bottom absolute left-1/2 top-0 h-0.5 w-[var(--otp-gap)] rounded-full bg-current" />
      </div>

      <div className="otp-burst absolute left-1/2 top-0">
        <span className="otp-ring otp-ring-outer absolute left-0 top-0 size-[calc(var(--otp-s)_*_2.2)] rounded-[28px] border border-[var(--otp-ok)]" />
        <span className="otp-ring otp-ring-inner absolute left-0 top-0 size-[calc(var(--otp-s)_*_1.6)] rounded-[22px] border border-[var(--otp-ok)]" />
        <span className="otp-sparks absolute left-0 top-0">
          {Array.from({ length: SPARKS }, (_, index) => (
            <span
              key={index}
              className="otp-spark absolute left-0 top-0 size-1.5 rounded-full bg-[var(--otp-ok)]"
            />
          ))}
        </span>
        <span className="otp-badge absolute left-0 top-0 flex size-[var(--otp-s)] items-center justify-center rounded-xl border-2 border-[var(--otp-ok)] bg-[var(--otp-ok-soft)] text-[var(--otp-ok)]">
          <svg viewBox="0 0 24 24" className="size-6" fill="none">
            <path
              className="otp-badge-check"
              d="M6 12.5 10.2 16.5 18 8"
              pathLength={1}
              stroke="currentColor"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </div>
  );
}
