// Shared cuisine helpers — the single source of truth for matching and displaying
// a vendor's restaurantCuisineType. The API returns this field as an array of
// strings (sometimes a single string, sometimes absent), so every consumer
// (homepage filter, search, vendor cards) must go through these helpers to stay
// consistent and crash-safe. See Issue.md #11.

// Normalize a cuisine string for matching: decompose accents, strip the combining
// marks, trim, lowercase. The defensive String(value ?? "") coercion means a
// non-string / array / null value can never throw (e.g. value.toLowerCase()).
export const normalizeCuisine = (value: unknown): string =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

// Coerce a vendor cuisine field (array | string | undefined) into a clean list of
// non-empty strings.
export const toCuisineList = (value: unknown): string[] => {
  const list = Array.isArray(value) ? value : [value];
  return list
    .map((item) => String(item ?? "").trim())
    .filter((item) => item.length > 0);
};

// Human-readable cuisine label for display, e.g. "Portuguese Food, Sushi".
// An empty/absent value returns "" so callers can fall back (e.g. to businessType).
export const formatCuisine = (value: unknown): string =>
  toCuisineList(value).join(", ");

// True if the vendor's cuisine matches any of the selected cuisines, compared
// accent / case / whitespace-insensitively. An empty selection means "no filter".
export const cuisineMatches = (
  vendorCuisine: unknown,
  selected: string[],
): boolean => {
  if (selected.length === 0) return true;
  const normalizedSelected = selected.map(normalizeCuisine);
  return toCuisineList(vendorCuisine).some((type) =>
    normalizedSelected.includes(normalizeCuisine(type)),
  );
};
