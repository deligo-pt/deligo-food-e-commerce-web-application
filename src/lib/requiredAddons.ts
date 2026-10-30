/**
 * Required add-ons on a cart line (29 Oct 2026).
 *
 * A group with `minSelectable > 0` ("Sauce — choose at least 1") cannot be
 * emptied from the checkout page. The backend refuses it anyway, with
 * `ADDON_MINIMUM_NOT_MET`; the point here is never to offer the customer a
 * delete that is going to bounce.
 *
 * ## What the backend counts
 *
 * The minimum is the **sum of quantities** in the group, not the number of
 * different options (Garlic × 2 satisfies "at least 2"), which is also how
 * `ProductDetailsModal` counts.
 *
 * It is checked against the add-ons **in the request**, not against the line
 * after the merge. So a request that leaves a required group out is refused
 * too, even when the line already has that group filled:
 *
 * | request (line has Garlic 1 + BBQ 1, group min 1) | result |
 * |---|---|
 * | `Garlic → 0`                                     | refused |
 * | `Garlic → 0, BBQ 1`                              | accepted |
 * | `Extra (optional) → 1`                           | refused |
 * | product quantity → 2, no add-ons                 | refused |
 *
 * That is why every write from the checkout page sends the line's whole add-on
 * set ({@link addonsPayload}), and not only the add-on that changed.
 *
 * ## Which group an add-on is in
 *
 * The cart line gives each add-on its group's `minSelectable` but not the
 * group itself, so two required add-ons cannot be told apart from two in the
 * same group. {@link useCartAddonGroups} looks the groups up; until it answers
 * (or if it fails), each required add-on is treated as its own group. That is
 * the safe side: at worst it holds back a removal the backend would allow.
 */

/** Where one add-on sku belongs. */
export interface AddonGroupRef {
  groupId: string;
  minSelectable: number;
}

/** sku → its group, for the add-ons of the products in the cart. */
export type AddonGroupsBySku = Record<string, AddonGroupRef>;

interface LineAddon {
  sku: string;
  quantity: number;
  minSelectable?: number;
}

/** The group the add-on is in, with how many the group must keep. */
function groupOf(addon: LineAddon, groups?: AddonGroupsBySku): AddonGroupRef {
  return (
    groups?.[addon.sku] ?? {
      // Unknown group: the add-on stands alone (see the module comment).
      groupId: `sku:${addon.sku}`,
      minSelectable: addon.minSelectable ?? 0,
    }
  );
}

/** The minimum this add-on's group asks for; 0 when it is optional. */
export function addonGroupMinimum(addon: LineAddon, groups?: AddonGroupsBySku): number {
  return groupOf(addon, groups).minSelectable;
}

/**
 * Whether taking one away from `addon` would leave its group below the
 * minimum. The − button is disabled when this is true.
 */
export function isAddonDecrementBlocked(
  addons: LineAddon[],
  addon: LineAddon,
  groups?: AddonGroupsBySku,
): boolean {
  const group = groupOf(addon, groups);
  if (group.minSelectable <= 0) return false;
  const inGroup = addons
    .filter((a) => groupOf(a, groups).groupId === group.groupId)
    .reduce((sum, a) => sum + a.quantity, 0);
  return inGroup - 1 < group.minSelectable;
}

/**
 * The `addons` of an add-to-cart request: every add-on on the line, with
 * `change` applied (0 removes it). See the module comment for why all of
 * them.
 */
export function addonsPayload(
  addons: LineAddon[] | null | undefined,
  change?: { sku: string; quantity: number },
): { optionSku: string; quantity: number }[] {
  const out = (addons ?? [])
    .filter((a) => a.sku !== change?.sku)
    .map((a) => ({ optionSku: a.sku, quantity: a.quantity }));
  if (change) out.push({ optionSku: change.sku, quantity: change.quantity });
  return out;
}
