export type Delay = (milliseconds: number) => Promise<void>;

const defaultDelay: Delay = (milliseconds) =>
  new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));

export function isLockAcquireTimeout(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "isAcquireTimeout" in error &&
      error.isAcquireTimeout === true,
  );
}

export async function retryLockAcquireOnce<T>(
  operation: () => Promise<T>,
  retryDelayMs = 50,
  delay: Delay = defaultDelay,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isLockAcquireTimeout(error)) throw error;
  }

  await delay(retryDelayMs);
  return operation();
}

export function createSingleFlight<T>(operation: () => Promise<T>) {
  let inFlight: Promise<T> | null = null;

  return () => {
    if (inFlight) return inFlight;

    const current = operation().finally(() => {
      if (inFlight === current) inFlight = null;
    });
    inFlight = current;
    return current;
  };
}

export function createTrailingSingleFlight<T>(
  operation: () => Promise<T>,
  canRunTrailing: () => boolean = () => true,
) {
  let inFlight: Promise<T> | null = null;
  let trailingRequested = false;

  const run = (requestTrailing = false): Promise<T> => {
    if (inFlight) {
      if (requestTrailing) trailingRequested = true;
      return inFlight;
    }

    const current = operation().finally(() => {
      if (inFlight !== current) return;

      inFlight = null;
      if (trailingRequested) {
        trailingRequested = false;
        if (canRunTrailing()) void run();
      }
    });
    inFlight = current;
    return current;
  };

  return run;
}
