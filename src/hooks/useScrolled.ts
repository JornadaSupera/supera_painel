import { useEffect, useState } from "react";

/**
 * True once the page has scrolled past `offset` px.
 *
 * Only the boundary crossing re-renders: setting the same boolean again bails
 * out, so a scroll listener does not turn into a render per frame.
 */
export function useScrolled(offset = 4): boolean {
  const [scrolled, setScrolled] = useState(() => window.scrollY > offset);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > offset);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [offset]);

  return scrolled;
}
