/**
 * Guards the Edit Profile form against becoming a live mirror of the server.
 *
 *   pnpm verify:profile-form
 *
 * No token, no network. Unlike the other verify scripts there is no pure
 * function here to exercise — the rule lives in a `useEffect` and a couple of
 * JSX props — so this reads the source and asserts the shape of it. That is a
 * blunt instrument, and it is used here because the alternative is nothing:
 * every failure below is invisible to `tsc`, `eslint` and the build, and each
 * one has already shipped once.
 *
 * ## The bug this exists to prevent
 *
 * `editProfileFormPage.tsx` used to seed its inputs from the cached profile on
 * **every** change to that profile, which made the form a mirror of the server
 * rather than something the customer owns: any refetch overwrote whatever was
 * on screen, unsaved.
 *
 * It bit hardest while verifying a phone number. That is the one point where
 * somebody sits on this form for minutes waiting for an SMS, and the
 * verification itself rewrites the profile — so the next refetch handed back a
 * new object and the effect fired. What disappeared was usually the first name,
 * and almost always on an email-login account: nothing in the sign-up flow
 * collects a name, so those accounts hold `name.firstName === ""` and the
 * overwrite wrote an empty string over the name that had just been typed.
 * Google accounts carry a name from the provider, so the same overwrite wrote
 * the same value back and nobody ever noticed. A typed-but-unverified phone
 * number was discarded the same way.
 *
 * Refetches are not rare: the profile goes stale after a minute, the navbar's
 * address picker invalidates it outright, and so does saving this very form.
 *
 * ## What the API allows, established by probing it live on 2026-08-20
 *
 * `PATCH /customers/:userId` **merges** — a payload of `name` and `NIF` alone
 * left `address`, `deliveryAddresses`, `email` and `contactNumber` untouched —
 * and it accepts `""` for both. So sending an emptied field is what clears it,
 * and omitting one leaves the old value in place. `PATCH
 * /profile/update-email-or-contact-number` takes strictly `{ otp, type }`;
 * adding anything else is refused with "Unrecognized key(s) in object". The
 * contact fields genuinely cannot travel with the save, which is why the form
 * warns about them instead.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

const FORM = readFileSync(
  join(here, "../src/components/profile/editProfileFormPage.tsx"),
  "utf8",
);
const EN = readFileSync(join(here, "../src/assets/translations/en.ts"), "utf8");
const PT = readFileSync(join(here, "../src/assets/translations/pt.ts"), "utf8");

let passed = 0;
let failed = 0;

function check(name, condition, detail) {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail === undefined ? "" : `  → ${detail}`}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

/** The body of the effect that seeds the editable inputs, or `null`. */
function seedEffectBody() {
  const start = FORM.indexOf("const hydratedRef = useRef(false)");
  if (start === -1) return null;
  const end = FORM.indexOf("}, [profile]);", start);
  if (end === -1) return null;
  return FORM.slice(start, end);
}

section("The form seeds itself once, and is the customer's after that");
{
  check("a hydration ref exists", FORM.includes("const hydratedRef = useRef(false)"));

  const body = seedEffectBody();
  check("the seed effect is found", body !== null);

  // The guard and the latch, both. A ref that is read but never set seeds on
  // every refetch exactly as before; one that is set but never read does
  // nothing at all.
  check(
    "the seed effect bails out when already hydrated",
    body !== null && /if \(!profile \|\| hydratedRef\.current\) return;/.test(body),
  );
  check(
    "the seed effect latches the ref",
    body !== null && /hydratedRef\.current = true;/.test(body),
  );

  // Every input the customer can type into has to be inside that guard. One
  // left outside is the whole bug again, for that field.
  for (const setter of [
    "setFirstName",
    "setLastName",
    "setEmail",
    "setOriginalEmail",
    "setMobileNumber",
    "setOriginalMobile",
    "setNif",
    "setImagePreview",
  ]) {
    const occurrencesInForm = FORM.split(`${setter}(`).length - 1;
    const occurrencesInSeed = body === null ? 0 : body.split(`${setter}(`).length - 1;
    check(
      `${setter} is seeded inside the guard`,
      occurrencesInSeed === 1,
      `found ${occurrencesInSeed} in the seed effect, ${occurrencesInForm} in the file`,
    );
  }

  // `profileData` is the one thing that should still track the cache live: it
  // drives no input, only `userId` for the save and the photo fallback.
  check(
    "setProfileData is NOT inside the guard",
    body !== null && !body.includes("setProfileData("),
  );
  check("setProfileData still exists", FORM.includes("setProfileData(profile)"));
}

section("A successful verification refreshes everything else");
{
  // Without this the navbar and the profile page keep showing the address or
  // number the customer just replaced. It is only safe because of the guard
  // above — before that, this refetch reached back and wiped the form.
  const emailVerify = FORM.slice(
    FORM.indexOf("const handleVerifyEmailOtp"),
    FORM.indexOf("const handleSendMobileOtp"),
  );
  const mobileVerify = FORM.slice(
    FORM.indexOf("const handleVerifyMobileOtp"),
    FORM.indexOf("const handleOtpKeyDown"),
  );

  check("email verification invalidates the profile", emailVerify.includes("invalidateProfile()"));
  check("mobile verification invalidates the profile", mobileVerify.includes("invalidateProfile()"));
}

section("Enter inside an OTP box verifies instead of saving");
{
  // Both boxes sit inside a form that has a submit button, so without this
  // Enter triggers implicit submission — Save Changes — at the exact moment
  // the customer finished typing a code and meant the button beside it.
  check("a shared Enter handler exists", FORM.includes("const handleOtpKeyDown ="));
  check(
    "it swallows the implicit submit",
    /if \(e\.key !== "Enter"\) return;\s*e\.preventDefault\(\);/.test(FORM),
  );
  check(
    "the email OTP box uses it",
    FORM.includes("onKeyDown={handleOtpKeyDown(handleVerifyEmailOtp)}"),
  );
  check(
    "the mobile OTP box uses it",
    FORM.includes("onKeyDown={handleOtpKeyDown(handleVerifyMobileOtp)}"),
  );
}

section("The save can clear a field, not just fill one");
{
  // 🔴 Omitting a falsy field made it unclearable: emptying the last name sent
  // nothing, the save reported success, and the old surname was still there on
  // reload. The API merges and takes `""`, so the emptied field has to travel.
  const submit = FORM.slice(FORM.indexOf("const handleSubmit"));

  check(
    "the name object is sent unconditionally",
    /payload\.name = \{\s*firstName: firstName\.trim\(\),\s*lastName: lastName\.trim\(\),\s*\};/.test(
      submit,
    ),
  );
  check("the NIF is sent unconditionally", submit.includes("payload.NIF = nif.trim();"));
  check(
    "no field is gated on being truthy any more",
    !/if \(firstName \|\| lastName\)/.test(submit) && !/if \(nif\)/.test(submit),
  );

  // The contact fields are the exception, and deliberately so — the API
  // refuses them outright, they only move through the OTP flow.
  check("the save never sends contactNumber", !submit.includes("payload.contactNumber"));
  check("the save never sends email", !submit.includes("payload.email"));
}

section("First Name is required in fact, not just in the label");
{
  // The label has carried an asterisk all along and nothing enforced it. It
  // matters most here: sign-up never asks for a name, so these accounts arrive
  // with an empty one and this is the screen where it gets filled in.
  check("the label claims it is required", FORM.includes('{t("firstName")} *'));
  check("blank first name blocks the save", /if \(!firstName\.trim\(\)\) \{/.test(FORM));
  check("it reports why", FORM.includes('t("firstNameRequired")'));

  check("firstNameRequired exists in en", /firstNameRequired: "/.test(EN));
  check("firstNameRequired exists in pt", /firstNameRequired: "/.test(PT));
  check(
    "the pt copy is not the en copy",
    (PT.match(/firstNameRequired: "([^"]*)"/) ?? [])[1] !==
      (EN.match(/firstNameRequired: "([^"]*)"/) ?? [])[1],
  );
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
