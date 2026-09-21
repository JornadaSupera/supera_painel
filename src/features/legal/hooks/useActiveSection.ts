import { useEffect, useState } from "react";

/**
 * Id of the section currently being read, for the table of contents.
 *
 * "Being read" is the last section whose heading crossed the upper third of
 * the viewport — reading position, not whichever block happens to be largest
 * on screen.
 */
export function useActiveSection(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);

  useEffect(() => {
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);

    if (elements.length === 0) return;

    const visible = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const first = ids.find((id) => visible.has(id));
        if (first) setActive(first);
      },
      // A band across the upper part of the screen: a section counts once its
      // top reaches it, and stops counting when it leaves the top.
      { rootMargin: "-15% 0px -65% 0px" },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [ids]);

  return active;
}
