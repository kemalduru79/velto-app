import type { LookupAddress, LookupOptions } from "node:dns";
import type { LookupFunction } from "node:net";

export type PinnedDnsAddress = { address: string; family: 4 | 6 };

// Node may request either one address or an array (`all: true`). Returning the
// legacy scalar shape for an array lookup makes TLS fail before any request is
// sent, so preserve the caller's requested lookup contract.
export function createPinnedDnsLookup(selected: PinnedDnsAddress): LookupFunction {
  return (_hostname: string, options: LookupOptions, callback: (error: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void) => {
    if (options?.all) {
      callback(null, [selected]);
      return;
    }
    callback(null, selected.address, selected.family);
  };
}
