import { useEffect } from "react";

/** Sets the browser tab title while the calling screen is mounted. */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      // Only undo our own title. When one layout hands over to another the
      // cleanups do not always run before the next title is set, and
      // restoring blindly put the previous screen's name back on the tab.
      if (document.title === title) document.title = previous;
    };
  }, [title]);
}
