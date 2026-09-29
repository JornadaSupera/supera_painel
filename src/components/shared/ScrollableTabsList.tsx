import { useEffect, useRef, useState, type ComponentProps, type FocusEvent } from "react";

import { TabsList } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/**
 * A tab list that scrolls on its own instead of widening the page.
 *
 * The shadcn list is `w-fit` and never wraps. With many tabs it grows past the
 * content area, and everything below it — cards, tables — gets laid out at
 * that width, so the whole screen scrolls sideways and the active tab can sit
 * off-screen with nothing saying which section is open.
 *
 * Here the list keeps its natural width inside a strip that scrolls by
 * itself. The active tab is brought into view on mount and whenever a tab
 * takes focus — a click focuses it, and so does the arrow-key navigation
 * Radix provides. The side that still hides tabs fades out: a tab cut clean at
 * the edge read as the end of the list, and at 768px the settings tabs stopped
 * at "Motivos de si…" with nothing saying four more were there.
 *
 *   <Tabs defaultValue="a">
 *     <ScrollableTabsList>
 *       <TabsTrigger value="a">…</TabsTrigger>
 *     </ScrollableTabsList>
 *   </Tabs>
 */
export function ScrollableTabsList({ className, ...props }: ComponentProps<typeof TabsList>) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState({ start: false, end: false });

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return undefined;

    const measure = () => {
      // One pixel of slack: fractional widths leave the end a hair short.
      const start = strip.scrollLeft > 1;
      const end = strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 1;
      setHidden((atual) => (atual.start === start && atual.end === end ? atual : { start, end }));
    };

    const active = strip.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
    if (active) reveal(strip, active, "instant");
    measure();

    strip.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(strip);

    return () => {
      strip.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, []);

  const onFocus = (event: FocusEvent<HTMLDivElement>) => {
    const strip = stripRef.current;
    if (strip && event.target.getAttribute("role") === "tab") {
      reveal(strip, event.target, "smooth");
    }
  };

  return (
    <div
      ref={stripRef}
      onFocus={onFocus}
      // No visible scrollbar: the tab cut at the edge already says there is
      // more, and a bar under a tab list reads as a rendering glitch.
      className={cn(
        "max-w-full min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        hidden.start && hidden.end && FADE_BOTH,
        hidden.start && !hidden.end && FADE_START,
        !hidden.start && hidden.end && FADE_END,
      )}
    >
      {/* 44px tall on touch screens instead of 36: the triggers take the
          list height, and 29px tabs were hard to hit with a thumb. */}
      <TabsList className={cn("w-max max-md:h-11!", className)} {...props} />
    </div>
  );
}

/* A mask, not an overlay: it fades whatever sits under it — the list's own
   background included — so it works on any surface in either theme. */
const FADE_START = "[mask-image:linear-gradient(to_right,transparent,black_2.5rem)]";
const FADE_END = "[mask-image:linear-gradient(to_left,transparent,black_2.5rem)]";
const FADE_BOTH =
  "[mask-image:linear-gradient(to_right,transparent,black_2.5rem,black_calc(100%-2.5rem),transparent)]";

/**
 * Centres a tab in its strip, touching only the strip's horizontal scroll.
 *
 * `scrollIntoView` would also scroll the page vertically to reach the tab,
 * which jumps the screen on every click.
 */
function reveal(strip: HTMLElement, tab: HTMLElement, behavior: ScrollBehavior) {
  const stripBox = strip.getBoundingClientRect();
  const tabBox = tab.getBoundingClientRect();
  const offset = tabBox.left + tabBox.width / 2 - (stripBox.left + stripBox.width / 2);

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  strip.scrollBy({ left: offset, behavior: reduceMotion ? "instant" : behavior });
}

export default ScrollableTabsList;
