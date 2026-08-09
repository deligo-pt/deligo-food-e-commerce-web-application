"use client";

import { useEffect, useRef, useState } from "react";
import { GoogleMark } from "./BrandIcons";
import SocialButton from "./SocialButton";
import { loadGoogleIdentity } from "@/lib/googleIdentity";

/**
 * "Continue with Google", rendered by Google Identity Services itself.
 *
 * Why not our own styled button, matching the Facebook one? Because the backend
 * needs a Google **ID token**, and the only GIS surface that hands one to a
 * website is `google.accounts.id`. Its token is delivered either by One Tap —
 * which the browser can suppress silently, so it cannot be the only path — or
 * by a button GIS renders itself. A custom button has nothing to call.
 *
 * So GIS draws it, configured as close to our design as its options allow:
 * outline, pill, left-aligned mark, "Continue with Google".
 *
 * `size: "large"` is 40px and GIS exposes no height option, so the Facebook
 * button was brought down to 40px to match rather than leaving Google looking
 * stunted beside it. The social row is now a 40px secondary tier under the 56px
 * primary CTA, which is a reasonable hierarchy on its own terms — and the only
 * alternative was restyling the button Google injects, which breaks whenever
 * they change its internals and is against their branding rules besides.
 *
 * Until GIS answers (and if it never does) the slot holds a look-alike that
 * reports the option as unavailable rather than leaving a hole in the layout.
 */

/**
 * Google clamps rendered buttons to 400px and needs an integer, not a %.
 *
 * The social row in LoginPage is capped at the same 400px so Facebook cannot
 * out-grow this button on wide screens. If that cap is ever raised, Google will
 * quietly stay at 400 and the two will stop matching again.
 */
const MAX_BUTTON_WIDTH = 400;

export default function GoogleSignInButton({
  clientId,
  locale,
  theme,
  label,
  onCredential,
  onUnavailable,
}: {
  clientId: string;
  locale: string;
  /** App theme. GIS has no automatic dark mode — without this its button stays
   *  white on a dark page while every control around it is dark. */
  theme: "light" | "dark";
  /** Fallback label, used only when GIS is unavailable. */
  label: string;
  onCredential: (idToken: string) => void;
  onUnavailable: () => void;
}) {
  const slotRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  // The locale the button on screen was actually drawn in, not the one
  // requested. `rendered` is derived from the two matching, so a language
  // switch falls back to our own button for the reload rather than leaving the
  // previous language on screen — without a synchronous setState in the effect.
  const [renderedLocale, setRenderedLocale] = useState<string | null>(null);
  const rendered = renderedLocale === locale;

  // Held in refs so the render effect below does not list them as dependencies:
  // re-initialising GIS every time the parent re-renders (which it does on
  // every keystroke in the form) would tear the button down and rebuild it.
  const onCredentialRef = useRef(onCredential);
  const onUnavailableRef = useRef(onUnavailable);
  useEffect(() => {
    onCredentialRef.current = onCredential;
    onUnavailableRef.current = onUnavailable;
  }, [onCredential, onUnavailable]);

  // Google needs an explicit pixel width, so track the slot's own width.
  useEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;
    const measure = () =>
      setWidth(Math.min(Math.round(slot.getBoundingClientRect().width), MAX_BUTTON_WIDTH));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(slot);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!clientId || !width) return;
    let cancelled = false;

    // A language switch reloads the SDK, so drop the old button now rather than
    // at the end — otherwise the previous language sits there for the whole
    // round trip. Touching the DOM node directly, not state: this node is ours
    // to manage and React never renders into it.
    if (targetRef.current) targetRef.current.innerHTML = "";

    loadGoogleIdentity(locale)
      .then((api) => {
        if (cancelled || !targetRef.current) return;
        api.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response.credential) onCredentialRef.current(response.credential);
            else onUnavailableRef.current();
          },
          // One Tap is not used here; signing in is always an explicit press.
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        // Clear first: re-rendering into a populated node stacks two buttons.
        targetRef.current.innerHTML = "";
        api.renderButton(targetRef.current, {
          type: "standard",
          // GIS has no "follow the page" option, so the app theme is mapped by
          // hand. `outline` is the white button; `filled_black` is its dark
          // counterpart.
          theme: theme === "dark" ? "filled_black" : "outline",
          size: "large",
          text: "continue_with",
          shape: "pill",
          // Centred, not left: with `left` the mark is pinned to the far edge
          // and the label centres in what remains, which does not match the
          // Facebook button beside it. Centred puts mark and label together as
          // one group, the same arrangement on both.
          logo_alignment: "center",
          width,
          locale,
        });
        setRenderedLocale(locale);
      })
      .catch(() => {
        if (!cancelled) setRenderedLocale(null);
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, width, locale, theme]);

  return (
    <div ref={slotRef} className="flex h-10 w-full items-center justify-center">
      <div ref={targetRef} className={rendered ? "contents" : "hidden"} />
      {!rendered && (
        <SocialButton
          onClick={onUnavailable}
          label={label}
          icon={<GoogleMark size={18} />}
        />
      )}
    </div>
  );
}
