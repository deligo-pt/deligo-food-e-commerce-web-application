import { apiClient } from "@/lib/apiClient";
import { buildRatingPayload, hasAnythingToSubmit } from "@/lib/ratingPayload";
import type { CreateRatingRequest, CreateRatingResponseData } from "@/types/rating";

/**
 * Submit an order's ratings. One request, whatever the customer scored.
 *
 * ## Why one call and not two
 *
 * The previous implementation posted separately for the product and the rider,
 * then reconciled the two outcomes by hand into `SUCCESS` / `ALREADY_RATED` /
 * `SKIPPED` — including a check that string-matched `"already rated"` against
 * the server's English prose, which stops working the moment the customer is
 * reading Portuguese. `/ratings/create-rating` takes both halves in one body
 * and answers once, so all of that goes away.
 *
 * ## Why the payload is built here
 *
 * The schema is **strict**: one unrecognised key fails the entire request, and
 * the server names them individually —
 * `Unrecognized key(s) in object: 'ratingType', 'rating', 'subRatings'` is
 * exactly what the old payload gets today. Assembling the body in one place is
 * what makes that impossible to reintroduce at a call site; `verify:rating`
 * asserts the same thing from the other direction.
 *
 * Empty collections are stripped rather than sent. `productRatings: []` is not
 * "no products submitted" — it is a body that fails the *provide at least one*
 * rule, and the resulting error names a field the customer never saw.
 *
 * ## It does not classify failures
 *
 * It throws, and the caller renders `getApiErrorMessage`, which already
 * prefers `errorSources[0]` when the top-level message is the generic
 * validation wrapper and already resolves a bilingual message. That matters
 * more than usual here: ratings are immutable with no delete endpoint, so the
 * success path could not be rehearsed against the live API without creating
 * one — the first real submission is the test, and a failure has to name its
 * field rather than say "something went wrong".
 */
export async function createRating(
  request: CreateRatingRequest,
): Promise<CreateRatingResponseData> {
  // Built key by key in `lib/ratingPayload`, which imports nothing and is
  // therefore executable by `verify:rating` — the guard asserts the exact key
  // set of what comes out, rather than grepping for the absence of the keys
  // somebody happened to think of.
  const payload = buildRatingPayload(request);
  if (!hasAnythingToSubmit(payload)) {
    throw new Error("Provide at least one product rating or a delivery rating.");
  }

  const response = await apiClient.post("/ratings/create-rating", payload);
  if (!response.data?.success) {
    throw new Error(response.data?.message || "Failed to submit rating");
  }

  const data = response.data?.data ?? {};
  // Normalized so a caller never has to distinguish "no products submitted"
  // from "the key was absent". The doc promises `[]` and `null`; this makes
  // that true regardless.
  return {
    productRatings: data.productRatings ?? [],
    deliveryRating: data.deliveryRating ?? null,
  };
}
