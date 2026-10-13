"use client";

import { useLayoutEffect, useRef, useState, type ChangeEvent, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import {
  OTP_LENGTH,
  otpAfterEdit,
  otpEnd,
  otpHoles,
  otpStringIndex,
  otpTiles,
  sanitizeOtp,
  tileChangesBetween,
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
 * The links drawn between tiles once they have gathered, for a code of
 * `length` digits. The tiles form a block two rows high and `length / 2`
 * columns wide: four digits make a 2×2 square, six a 2×3 block. Links join
 * neighbours along the top row, down each column, and along the bottom row.
 * `lx` is the link's offset from the block's centre, in tile steps; the CSS
 * turns it into a position.
 */
function linksFor(length: number): { edge: "top" | "side" | "bottom"; lx: number }[] {
  const cols = Math.max(1, Math.floor(length / 2));
  const mid = (cols - 1) / 2;
  const across = Array.from({ length: cols - 1 }, (_, c) => c + 0.5 - mid);
  const down = Array.from({ length: cols }, (_, c) => c - mid);
  return [
    ...across.map((lx) => ({ edge: "top" as const, lx })),
    ...down.map((lx) => ({ edge: "side" as const, lx })),
    ...across.map((lx) => ({ edge: "bottom" as const, lx })),
  ];
}

/**
 * The login code as tiles (four for an email code, six for an SMS one; see
 * `otpLengthFor`) and, once the server accepts it, the verified moment.
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
 * ## Changing one digit (13 Oct 2026)
 *
 * Any tile can be picked — a click or tap, or the arrow keys — and changed on
 * its own; a wrong digit used to mean backspacing from the end. Still one
 * input: the browser's selection is kept on the picked tile (its digit
 * selected, or a caret in its gap), so a typed digit replaces exactly that
 * one, and paste and SMS autofill are untouched. Clearing a tile leaves a gap
 * (`1 _ 3 4`) rather than closing up; the gaps live here, the value stays the
 * plain digits. The rules are `otpAfterEdit` in `lib/otp.ts`.
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
  length = OTP_LENGTH,
}: {
  /** How many digits the code has: 4 by email, 6 by SMS. */
  length?: number;
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
    Array.from({ length }, () => REST),
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const tilesRef = useRef<HTMLDivElement>(null);
  // Where the gaps are, and the tile picked for editing (`null`: the end).
  // Both are read through the value, so a code the page replaces or empties
  // (a resend, a failed attempt) drops them without an effect.
  const [edit, setEdit] = useState<{ holes: number[]; cursor: number | null }>({ holes: [], cursor: null });
  // Bumped to put the selection back when nothing else changed.
  const [reselect, setReselect] = useState(0);

  const tiles = otpTiles(value, edit.holes, length);
  const end = otpEnd(tiles);
  const complete = value.length === length;
  const cursor = edit.cursor !== null && edit.cursor < end ? edit.cursor : null;

  /** The browser selection that stands for the picked tile. */
  function selectionFor(): [number, number] {
    if (cursor === null) return [value.length, value.length];
    const at = otpStringIndex(tiles, cursor);
    return tiles[cursor] ? [at, at + 1] : [at, at];
  }

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input || !focused) return;
    const [start, stop] = selectionFor();
    if (input.selectionStart !== start || input.selectionEnd !== stop) input.setSelectionRange(start, stop);
    // `selectionFor` reads only what is listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, edit, focused, reselect]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const native = event.nativeEvent as InputEvent;
    // A letter typed over a picked digit would otherwise read as that digit
    // being deleted: the browser has already swapped it in.
    if (native.inputType === "insertText" && native.data && /\D/.test(native.data)) {
      setReselect((n) => n + 1);
      return;
    }
    const next = sanitizeOtp(event.target.value, length);
    // A non-digit keystroke leaves the value as it was: nothing to animate.
    if (next === value) return;

    const after = otpAfterEdit(value, next, otpHoles(tiles), cursor, length);
    const changes = tileChangesBetween(tiles, otpTiles(next, after.holes, length));
    const batch = changes.filter(Boolean).length > 1;
    setMotion((current) =>
      current.map((tile, index) => {
        const change = changes[index];
        if (!change) return tile;
        return { version: tile.version + 1, change, batch };
      }),
    );
    setEdit(after);
    onChange(next);
  }

  /** Picks the tile under a click or tap; past the last digit is "the end". */
  function pickTileAt(clientX: number) {
    const frames = Array.from(tilesRef.current?.children ?? []);
    let picked: number | null = null;
    let nearest = Infinity;
    frames.forEach((frame, index) => {
      const box = frame.getBoundingClientRect();
      const distance = Math.abs(clientX - (box.left + box.width / 2));
      if (distance < nearest) {
        nearest = distance;
        picked = index;
      }
    });
    setEdit({ holes: otpHoles(tiles), cursor: picked !== null && picked < end ? picked : null });
    setReselect((n) => n + 1);
  }

  /** Left and right move between the tiles that hold the code. */
  function moveCursor(step: -1 | 1) {
    const from = cursor ?? end;
    const to = Math.max(0, from + step);
    setEdit({ holes: otpHoles(tiles), cursor: to < end ? to : null });
  }

  // The tile the next digit will land in — shown as the caret would be.
  const activeIndex = cursor ?? Math.min(end, length - 1);
  const showActive = cursor !== null || !complete;

  return (
    <div
      data-verified={verified ? "true" : undefined}
      // The CSS sizes the tiles and shapes the verified block from this.
      data-length={length}
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
        ref={inputRef}
        onChange={handleChange}
        onClick={(event) => pickTileAt(event.clientX)}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          moveCursor(event.key === "ArrowLeft" ? -1 : 1);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        // Keeps the (invisible) selection on the picked tile, or the caret at
        // the end, so what is typed always lands in the highlighted tile — a
        // caret left anywhere else in an invisible string would put the next
        // digit where the tiles do not show. A *whole* selection is left
        // alone: select-all then type, delete or paste replaced the code in
        // the plain field this replaced, and still has to. Only acts when it
        // changes something, so it cannot loop on its own `select` event.
        onSelect={(event) => {
          const input = event.currentTarget;
          const size = input.value.length;
          const [start, stop] = selectionFor();
          const wholeSelected = input.selectionStart === 0 && input.selectionEnd === size && size > 0;
          if (!wholeSelected && (input.selectionStart !== start || input.selectionEnd !== stop)) {
            input.setSelectionRange(start, stop);
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
        ref={tilesRef}
        aria-hidden="true"
        className="flex items-center justify-center gap-[var(--otp-g)]"
      >
        {Array.from({ length }, (_, index) => {
          const digit = tiles[index] ?? "";
          const tile = motion[index] ?? REST;
          const isActive = !verified && focused && showActive && index === activeIndex;
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

      {verified ? <VerifiedArt length={length} /> : null}
    </div>
  );
}

/**
 * Everything the verified moment adds to the tiles: the links of the block,
 * and the badge the block folds into, with its rings and its sparks.
 * Mounted only on success, so none of it costs a thing on a normal sign-in
 * that has not got there yet. Positions and timings are all in `globals.css`.
 */
function VerifiedArt({ length }: { length: number }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className="otp-links absolute inset-0 text-primary dark:text-pink-400">
        {linksFor(length).map(({ edge, lx }) => (
          <span
            key={`${edge}${lx}`}
            style={{ "--otp-lx": lx } as CSSProperties}
            className={cn(
              "otp-link absolute left-1/2 top-0 rounded-full bg-current",
              edge === "side"
                ? "otp-link-side h-[var(--otp-gap)] w-0.5"
                : cn(`otp-link-${edge}`, "h-0.5 w-[var(--otp-gap)]"),
            )}
          />
        ))}
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
