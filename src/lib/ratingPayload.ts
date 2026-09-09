import type { CreateRatingRequest } from "@/types/rating";

/**
 * The body sent to `POST /ratings/create-rating`, built one key at a time.
 *
 * ## Why this is its own module
 *
 * `lib/ratings.ts` imports the axios client, and a module that reaches the
 * network cannot be loaded by a `verify:*` script. This one imports nothing
 * but a type, so `verify:rating` **executes** it and asserts the exact key set
 * of what comes out.
 *
 * That difference matters more here than anywhere else in the app. The schema
 * is strict — one unrecognised key fails the whole request — and a guard that
 * greps for the *absence* of `ratingType`, `subRatings`, `sentiment` and the
 * rest only ever catches the spellings somebody thought of. Running the builder
 * and comparing its output against an allowlist catches every key, including
 * the ones nobody has invented yet. (Plan.md's standing lesson from the other
 * project: `bg-[#f9186b]` was swept, `bg-pink-600` was not — 151 places, 8
 * phases.)
 *
 * ## What it enforces
 *
 * - **Only the three documented keys can appear.** Nothing is spread in from a
 *   caller's object, so a field cannot travel here by accident.
 * - **An empty `productRatings` is dropped, never sent.** `[]` is not "no
 *   products submitted"; it is a body that fails the *provide at least one*
 *   rule, and the resulting error names a field the customer never saw.
 * - **Each product entry is rebuilt too**, so a `ProductRatingItem` that
 *   somehow carried an extra property does not smuggle it into the request.
 * - **Blank reviews are omitted rather than sent as `""`.** The server defaults
 *   them; sending an empty string is a value nobody typed.
 * - `tags` is accepted and passed through when present, but nothing supplies
 *   one today — the doc names no vocabulary and inventing one would be
 *   inventing product taxonomy (decision R-2).
 */
export function buildRatingPayload(request: CreateRatingRequest): CreateRatingRequest {
  const payload: CreateRatingRequest = { orderId: request.orderId };

  const productRatings = (request.productRatings ?? [])
    .filter((item) => item && item.productId && item.rating > 0)
    .map((item) => {
      const review = item.review?.trim();
      return {
        productId: item.productId,
        rating: item.rating,
        ...(review ? { review } : {}),
        ...(item.tags?.length ? { tags: item.tags } : {}),
      };
    });
  if (productRatings.length > 0) payload.productRatings = productRatings;

  const delivery = request.deliveryRating;
  if (delivery && delivery.rating > 0) {
    const review = delivery.review?.trim();
    payload.deliveryRating = {
      rating: delivery.rating,
      ...(review ? { review } : {}),
      ...(delivery.tags?.length ? { tags: delivery.tags } : {}),
    };
  }

  return payload;
}

/** Whether a built payload has anything in it to submit. The server says the
 *  same thing, but a round trip to be told the customer scored nothing is a
 *  round trip that can only produce an error nobody can act on. */
export function hasAnythingToSubmit(payload: CreateRatingRequest): boolean {
  return Boolean(payload.productRatings?.length || payload.deliveryRating);
}
