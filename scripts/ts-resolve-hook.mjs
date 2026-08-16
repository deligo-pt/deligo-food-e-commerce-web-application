/**
 * Lets a `verify:*` script load a `.ts` module that imports another one.
 *
 * Node can strip types (22.6+, on by default in 23), but its ESM resolver is
 * still the plain one: `import { x } from "./orderStatus"` has no extension, so
 * it looks for a file literally named `orderStatus` and fails. TypeScript and
 * the Next build both infer the `.ts`; Node does not.
 *
 * That is why `verify:model` could only ever test `pickupTime.ts` — a module
 * that deliberately imports nothing. This hook removes that ceiling: register
 * it and any dependency-free *chain* of lib modules becomes testable, without a
 * bundler, a loader framework or a test runner.
 *
 * Deliberately narrow. It only retries a specifier that is relative and has no
 * extension, and only after normal resolution has already failed — so a genuine
 * missing module still reports as one, and nothing about how the app itself
 * resolves imports is changed.
 *
 *   import { register } from "node:module";
 *   register("./ts-resolve-hook.mjs", import.meta.url);
 */

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
    const hasExtension = /\.[A-Za-z0-9]+$/.test(specifier);
    if (isRelative && !hasExtension) {
      return nextResolve(`${specifier}.ts`, context);
    }
    throw error;
  }
}
