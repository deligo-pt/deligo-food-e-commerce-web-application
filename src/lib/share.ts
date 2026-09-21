/**
 * Sharing a dish: the link it travels as, and the one way it is handed over.
 *
 * No React, so `pnpm verify:share` can run every rule here with a stubbed
 * `navigator` and no browser.
 *
 * ## The link needs nothing new
 *
 * The store page already reads `?product=`: `/vendors/<userId>?product=<id>`
 * opens the store with that dish's details already up — the same deep link a
 * search result navigates to. It is public, so a friend without an account
 * lands on the dish too. The ids are the ones that route takes: the store's
 * `V-…` userId (not its Mongo `_id`, which 404s) and the dish's business
 * `productId` (`PROD-…`, which `/products/:id` resolves).
 *
 * ## One behaviour, everywhere
 *
 * A phone opens its own share sheet (WhatsApp, Messages, Messenger…). A
 * browser without one — most desktops — copies the link instead. Dismissing
 * the sheet is a choice, not an error, and says nothing.
 */

export interface ShareData {
  title: string;
  text: string;
  url: string;
}

/** What happened, so the caller can say the right thing — or nothing. */
export type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

/** The deep link to one dish, on this site. */
export function productShareUrl(
  origin: string,
  vendorUserId: string,
  productId: string,
): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}/vendors/${encodeURIComponent(vendorUserId)}?product=${encodeURIComponent(productId)}`;
}

/**
 * The line that travels with the link: `Found this on DeliGo: Beef Tehari —
 * Tasca do Bairro`. The intro arrives translated because `t()` lives in the
 * component and takes no placeholders. A missing store name drops its dash
 * rather than leaving one hanging.
 */
export function productShareText(
  intro: string,
  productName: string,
  storeName?: string | null,
): string {
  const dish = productName.trim();
  const store = storeName?.trim();
  const subject = store ? `${dish} — ${store}` : dish;
  return [intro.trim(), subject].filter(Boolean).join(" ");
}

/**
 * The dish id out of a `?product=` value — the first word of it, or `null`.
 *
 * A shared link does not always arrive alone. The macOS share menu's **Copy**
 * copies the link and the message as one string, and pasted into an address
 * bar that became `?product=PROD-7H7GMP Found this on DeliGo: Morog Polao — …`
 * — "Product not found" for a link that was right (owner's screenshot,
 * 21 Sep 2026). A product id never contains whitespace, so everything after
 * the first space is the message, not the id.
 */
export function productIdFromParam(raw: string | null | undefined): string | null {
  const id = raw?.trim().split(/\s+/)[0];
  return id ? id : null;
}

/** The slice of `navigator` this needs — a parameter so it can be tested. */
export interface ShareNavigator {
  share?: (data: ShareData) => Promise<void>;
  clipboard?: { writeText: (text: string) => Promise<void> };
}

function errorName(error: unknown): string {
  return typeof error === "object" && error !== null && "name" in error
    ? String((error as { name: unknown }).name)
    : "";
}

/**
 * The share sheet on a phone, the clipboard everywhere else.
 *
 * `sheet` is the caller's answer to "is this a touch device?". On a computer
 * the system share menu is the wrong tool: its Copy joins the link and the
 * message into one string, which is how a pasted link came to 404. A computer
 * copies the bare link and says so. A phone gets its share sheet, where the
 * apps people actually share to keep the two apart.
 *
 * - `AbortError` is the customer closing the sheet: `cancelled`, and no toast.
 *   (The referral page reports it as a failure, which is the mistake this
 *   avoids.)
 * - Any other refusal — `NotAllowedError` when the tap's permission has lapsed,
 *   which Safari does after a slow lookup — falls back to copying, so a tap
 *   still ends with a link the customer can paste.
 * - What is copied is the **link alone**: pasted anywhere, it is the thing
 *   that works.
 */
export async function shareOrCopy(
  data: ShareData,
  options: { sheet: boolean },
  nav: ShareNavigator | undefined = typeof navigator === "undefined"
    ? undefined
    : (navigator as ShareNavigator),
): Promise<ShareOutcome> {
  if (options.sheet && nav?.share) {
    try {
      await nav.share(data);
      return "shared";
    } catch (error) {
      if (errorName(error) === "AbortError") return "cancelled";
      // Otherwise fall through to the clipboard.
    }
  }

  if (nav?.clipboard?.writeText) {
    try {
      await nav.clipboard.writeText(data.url);
      return "copied";
    } catch {
      return "failed";
    }
  }

  return "failed";
}
