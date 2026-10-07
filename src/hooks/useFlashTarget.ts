import { useEffect, useRef, useState } from "react";

/** How long the ring stays on before it fades. */
const FLASH_MS = 4_000;

/**
 * The ring on the item a link pointed to. The transition stays on the element
 * so the ring fades instead of blinking off; the colour is the brand's, never a
 * status colour, so it does not read as "critical" or "resolved".
 */
export function flashClass(active: boolean): string {
  return active
    ? "ring-primary ring-offset-background ring-2 ring-offset-2 transition-shadow duration-700 motion-reduce:transition-none"
    : "transition-shadow duration-700 motion-reduce:transition-none";
}

/**
 * Brings the item a link pointed to into view and marks it for a moment.
 *
 * Runs once per id: the screen rereading every minute does not scroll the
 * person back to it. The element is found by its DOM id, so the screen only
 * renders `id={elementId}` on it, and passes the id only once that element is
 * on screen. Returns the id while it is marked.
 */
export function useFlashTarget(elementId: string | null, ready: boolean): string | null {
  const [flashing, setFlashing] = useState<string | null>(null);
  const done = useRef<string | null>(null);

  useEffect(() => {
    if (!elementId || !ready || done.current === elementId) return;
    const element = document.getElementById(elementId);
    if (!element) return;

    done.current = elementId;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    setFlashing(elementId);
  }, [elementId, ready]);

  useEffect(() => {
    if (!flashing) return;
    const timer = window.setTimeout(() => setFlashing(null), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [flashing]);

  return flashing;
}
