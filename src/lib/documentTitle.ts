/**
 * The browser tab title, in two parts that never overwrite each other: the
 * screen's own name, set by `useDocumentTitle`, and a count of what waits for
 * the person, set by the bell — "(3) Fila de alertas · Jornada Supera".
 *
 * Each part has its own setter, so a screen changing its name keeps the count,
 * and the count going up keeps the name. Nothing about patients goes here: the
 * tab title shows in the taskbar, in window lists and in screen shares.
 */

let base = typeof document === "undefined" ? "" : document.title;
let count = 0;

function apply(): void {
  document.title = count > 0 ? `(${count > 99 ? "99+" : count}) ${base}` : base;
}

/** The screen's name, without the count. */
export function getBaseTitle(): string {
  return base;
}

export function setBaseTitle(title: string): void {
  base = title;
  apply();
}

/** How many things wait for the signed-in person. Zero takes the prefix off. */
export function setTitleCount(total: number): void {
  count = Math.max(0, total);
  apply();
}
