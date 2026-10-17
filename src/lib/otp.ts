/**
 * The login code's shape and the verified moment's timing — pure, so
 * `pnpm verify:otp-input` can run it with no browser.
 *
 * The code's length depends on how it was sent (6 Oct 2026): the **email**
 * code is four digits and the **SMS** code is six. The field used to allow
 * four for both, so a mobile customer's last two digits were cut off and the
 * code could never verify. Each length is a cap: typing, pasting and SMS
 * autofill keep at most that many digits.
 */
export const EMAIL_OTP_LENGTH = 4;
export const MOBILE_OTP_LENGTH = 6;

/**
 * How long "Resend OTP" stays locked after a code is sent (17 Oct 2026, the
 * owner's call: five minutes, for SMS and email alike). The lock is the
 * browser's only — the backend sets no limit of its own that we know of.
 */
export const OTP_RESEND_COOLDOWN_MS = 5 * 60 * 1000;

/** `m:ss` for the resend countdown; never negative. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** The email code's length, and the default where no method is known. */
export const OTP_LENGTH = EMAIL_OTP_LENGTH;

/** How many digits the code sent to this login method has. */
export function otpLengthFor(mode: "mobile" | "email"): number {
  return mode === "mobile" ? MOBILE_OTP_LENGTH : EMAIL_OTP_LENGTH;
}

/** Digits only, at most `length` of them — for typing, pasting and SMS autofill alike. */
export function sanitizeOtp(raw: string | null | undefined, length: number = OTP_LENGTH): string {
  return (raw ?? "").replace(/\D/g, "").slice(0, length);
}

/** `filled` — a tile gained or replaced its digit. `cleared` — it lost one. */
export type TileChange = "filled" | "cleared";

/**
 * Which tiles changed between two values.
 *
 * `null` for an untouched tile, and that is the point: an untouched tile must
 * not restart its animation, which is what keeps fast typing smooth — the
 * tile still tracing its border from the previous keystroke is left to finish.
 */
export function tileChanges(
  before: string,
  after: string,
  length: number = OTP_LENGTH,
): (TileChange | null)[] {
  return Array.from({ length }, (_, index) => {
    const was = before[index] ?? "";
    const now = after[index] ?? "";
    if (was === now) return null;
    return now ? "filled" : "cleared";
  });
}

// ─── Editing one tile (13 Oct 2026) ──────────────────────────────────────────
//
// A wrong digit used to mean backspacing from the end: the caret was pinned
// there. Now any tile can be picked and changed. The value stays the plain
// string of digits it always was; what the field adds is *where the gaps are*
// (`holes`): clearing the second of four digits shows `1 _ 3 4`, not `1 3 4 _`.
// A gap only exists while a digit sits after it, so a finished code has none.

/** The tiles as drawn: `value`'s digits in order, skipping each gap. */
export function otpTiles(value: string, holes: readonly number[], length: number = OTP_LENGTH): string[] {
  const tiles: string[] = [];
  let next = 0;
  for (let index = 0; index < length; index++) {
    const isHole = holes.includes(index) && next < value.length;
    tiles.push(isHole ? "" : (value[next++] ?? ""));
  }
  return tiles;
}

/** The tile after the last digit: where a digit typed "at the end" lands. */
export function otpEnd(tiles: readonly string[]): number {
  let end = 0;
  tiles.forEach((digit, index) => {
    if (digit) end = index + 1;
  });
  return end;
}

/** Where a tile sits in the string: the digits before it. */
export function otpStringIndex(tiles: readonly string[], tile: number): number {
  return tiles.slice(0, tile).filter(Boolean).length;
}

/** The gaps that are still gaps: inside the code, with a digit after them. */
export function otpHoles(tiles: readonly string[]): number[] {
  const end = otpEnd(tiles);
  return tiles.flatMap((digit, index) => (!digit && index < end ? [index] : []));
}

/** Which tiles changed between two drawings (see `tileChanges`). */
export function tileChangesBetween(before: readonly string[], after: readonly string[]): (TileChange | null)[] {
  return after.map((now, index) => {
    const was = before[index] ?? "";
    if (was === now) return null;
    return now ? "filled" : "cleared";
  });
}

/**
 * The gaps and the picked tile after the browser changed the string.
 *
 * The field keeps the browser's own selection on the picked tile (its digit
 * selected, or a caret in its gap), so typing, deleting, pasting and autofill
 * are the browser's as before; this only reads what happened:
 *
 * | picked tile | string      | meaning                                       |
 * |-------------|-------------|-----------------------------------------------|
 * | a digit     | same length | replaced: move to the next tile               |
 * | a digit     | one shorter | cleared: the tile becomes a gap, stay on it   |
 * | a gap       | one longer  | filled: move to the next tile                 |
 * | a gap       | one shorter | the digit before it cleared: move onto it     |
 * | none (end)  | ±1          | typed or deleted at the end, as always        |
 *
 * Anything else (a paste, an autofill, select-all then type) is a new code:
 * no gaps, nothing picked.
 */
export function otpAfterEdit(
  before: string,
  after: string,
  holes: readonly number[],
  cursor: number | null,
  length: number = OTP_LENGTH,
): { holes: number[]; cursor: number | null } {
  const fresh = { holes: [] as number[], cursor: null };
  const tiles = otpTiles(before, holes, length);
  const delta = after.length - before.length;
  const settle = (nextHoles: number[], pick: number | null) => {
    const drawn = otpTiles(after, nextHoles, length);
    const kept = otpHoles(drawn);
    // A pick at or past the end is just "the end".
    return { holes: kept, cursor: pick !== null && pick < Math.min(otpEnd(drawn), length) ? pick : null };
  };
  const without = (index: number) => before.slice(0, index) + before.slice(index + 1);

  if (cursor === null) {
    return Math.abs(delta) === 1 && (delta === 1 ? after.startsWith(before) : before.startsWith(after))
      ? settle([...holes], null)
      : fresh;
  }

  const at = otpStringIndex(tiles, cursor);
  if (tiles[cursor]) {
    if (delta === 0 && after.slice(0, at) === before.slice(0, at) && after.slice(at + 1) === before.slice(at + 1)) {
      return settle([...holes], cursor + 1);
    }
    if (delta === -1 && after === without(at)) return settle([...holes, cursor], cursor);
    return fresh;
  }

  if (delta === 1 && after.slice(0, at) === before.slice(0, at) && after.slice(at + 1) === before.slice(at)) {
    return settle(holes.filter((hole) => hole !== cursor), cursor + 1);
  }
  if (delta === -1 && at > 0 && after === without(at - 1)) {
    // The digit before the gap went: that tile is the gap now.
    let previous = cursor - 1;
    while (previous > 0 && !tiles[previous]) previous--;
    return settle([...holes, previous], previous);
  }
  return fresh;
}

/**
 * How long the verified sequence holds the page before it moves on.
 *
 * The sequence (`globals.css`, "the verified moment") runs: the tiles gather
 * into a square by ~0.55s, link up by ~0.95s, turn green at 1s, fold into one
 * tile by 1.8s, and the badge and its three lines of copy have settled by
 * ~2.37s. The page waits for that — **and not a moment longer**: this is time
 * added to every sign-in, and there is no button to skip it.
 *
 * With reduced motion there is no sequence, only the finished badge, so the
 * wait is just long enough to read "Verified successfully".
 */
export const VERIFIED_HOLD_MS = 2500;
export const VERIFIED_HOLD_REDUCED_MS = 1200;
