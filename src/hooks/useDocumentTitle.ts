import { useEffect } from "react";

import { getBaseTitle, setBaseTitle } from "@/lib/documentTitle";

/**
 * Sets the browser tab title while the calling screen is mounted. The bell's
 * "(N)" in front of it is kept apart — see `lib/documentTitle`.
 */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const previous = getBaseTitle();
    setBaseTitle(title);
    return () => {
      // Only undo our own title. When one layout hands over to another the
      // cleanups do not always run before the next title is set, and
      // restoring blindly put the previous screen's name back on the tab.
      if (getBaseTitle() === title) setBaseTitle(previous);
    };
  }, [title]);
}
