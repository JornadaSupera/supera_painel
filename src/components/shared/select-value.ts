/**
 * Radix <Select> does not accept an item with an empty value — empty is how it
 * marks "nothing selected". This sentinel stands for "no value" in the
 * interface; stores and the data layer keep speaking in empty strings.
 *
 * Internal to `FilterSelect` and `FormSelect`; not exported from the index.
 */
export const EMPTY_SENTINEL = "__vazio__";

export function toSelectValue(value: string): string {
  return value || EMPTY_SENTINEL;
}

export function fromSelectValue(value: string): string {
  return value === EMPTY_SENTINEL ? "" : value;
}
