import { useEffect, useState } from "react";

/**
 * Where a link to one item stands on the screen it opens: still looking, found,
 * or not there.
 *
 * A notification can arrive before the reading that holds its item: the alert
 * was raised a second ago, the list was read a minute ago. So "not in the list"
 * is only concluded after reading once more. Until then the screen says it is
 * looking, never "nothing here".
 */
export type TargetLookup = "idle" | "searching" | "found" | "missing";

export function useTargetLookup({
  id,
  found,
  settled,
  refetch,
}: {
  /** The item the address asks for. `null` = no item asked for. */
  id: string | null;
  found: boolean;
  /** The reads that could hold it have answered and none is running. */
  settled: boolean;
  /** Reads them again. */
  refetch: () => Promise<unknown>;
}): TargetLookup {
  // The id already read again for, and whether that read has answered.
  const [retry, setRetry] = useState<{ id: string; done: boolean } | null>(null);

  useEffect(() => {
    if (!id || found || !settled || retry?.id === id) return;
    setRetry({ id, done: false });
    void refetch().finally(() => setRetry({ id, done: true }));
  }, [id, found, settled, retry, refetch]);

  if (!id) return "idle";
  if (found) return "found";
  if (!settled || retry?.id !== id || !retry.done) return "searching";
  return "missing";
}
