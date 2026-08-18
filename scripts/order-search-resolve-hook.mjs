/**
 * Module resolution for `verify:order-search`, so it can load the hook it
 * tests.
 *
 * `ts-resolve-hook.mjs` handles the general case — a relative, extensionless
 * import of a `.ts` file — and every other `verify:*` script gets by on that
 * alone, because they all test modules that import nothing but each other.
 *
 * `useOrderSearch.ts` is the first one that does not. It needs two more things:
 *
 *   `@/lib/orderSearch`  → the tsconfig path alias, which Node knows nothing
 *                          about (only the bundler and TypeScript do).
 *   `react`              → `react-memo-stub.mjs`, so the hook's memoization can
 *                          be measured outside a renderer. See that file for
 *                          why measuring beats reading the source.
 *
 * Kept separate from `ts-resolve-hook.mjs` on purpose: redirecting `react` is a
 * blunt instrument, and it must not be in force for the seven verify scripts
 * that have no business seeing a stubbed React.
 *
 *   import { register } from "node:module";
 *   register("./order-search-resolve-hook.mjs", import.meta.url);
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const REACT_STUB = pathToFileURL(
  join(dirname(fileURLToPath(import.meta.url)), "react-memo-stub.mjs"),
).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "react") {
    return { url: REACT_STUB, shortCircuit: true };
  }

  if (specifier.startsWith("@/")) {
    // The alias points at a directory of `.ts` files; nothing under it that
    // this script reaches is `.tsx`, so the extension is unambiguous.
    return {
      url: pathToFileURL(join(SRC, `${specifier.slice(2)}.ts`)).href,
      shortCircuit: true,
    };
  }

  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
    const hasExtension = /\.[A-Za-z0-9]+$/.test(specifier);
    if (isRelative && !hasExtension) return nextResolve(`${specifier}.ts`, context);
    throw error;
  }
}
