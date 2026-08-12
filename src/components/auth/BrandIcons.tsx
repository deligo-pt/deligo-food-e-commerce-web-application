/**
 * Brand marks for the login page.
 *
 * These are inlined rather than imported because `lucide-react` v1 ships no
 * brand icons at all — there is no `google` or `facebook` in the package. Every
 * other icon on this page still comes from lucide.
 *
 * Both marks are the official ones and must stay that way: each provider
 * publishes branding guidelines that mandate the exact artwork and colours, and
 * Facebook checks compliance during App Review. Do not recolour them to match
 * the DeliGo pink, and do not swap in a lookalike.
 *
 * Both are sized by the `size` prop and carry `aria-hidden`, because the
 * buttons they sit in already have a visible text label.
 */

type MarkProps = {
  size?: number;
  className?: string;
};

export function GoogleMark({ size = 20, className }: MarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}

export function FacebookMark({ size = 20, className }: MarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#1877F2"
        d="M48 24C48 10.75 37.25 0 24 0S0 10.75 0 24c0 11.98 8.78 21.91 20.25 23.71V30.94h-6.09V24h6.09v-5.29c0-6.02 3.58-9.34 9.07-9.34 2.63 0 5.37.47 5.37.47v5.91h-3.03c-2.98 0-3.91 1.85-3.91 3.75V24h6.66l-1.06 6.94h-5.6v16.77C39.22 45.91 48 35.98 48 24z"
      />
      <path
        fill="#fff"
        d="M33.35 30.94 34.41 24h-6.66v-4.5c0-1.9.93-3.75 3.91-3.75h3.03V9.84s-2.74-.47-5.37-.47c-5.49 0-9.07 3.32-9.07 9.34V24h-6.09v6.94h6.09v16.77a24.2 24.2 0 0 0 7.5 0V30.94h5.6z"
      />
    </svg>
  );
}
