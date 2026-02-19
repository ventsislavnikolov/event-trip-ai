export type ProviderFailureKind = "timeout" | "error";

export type ProviderFailure = {
  kind: ProviderFailureKind;
  message: string;
};

type ProviderName = "ticketmaster" | "seatgeek" | "travelpayouts";

type ProviderMap<TTicketmaster, TSeatGeek, TTravelPayouts> = {
  ticketmaster: () => Promise<TTicketmaster>;
  seatgeek: () => Promise<TSeatGeek>;
  travelpayouts: () => Promise<TTravelPayouts>;
};

type CollectProviderDataParams<TTicketmaster, TSeatGeek, TTravelPayouts> = {
  timeoutMs: number;
  retries: number;
  providers: ProviderMap<TTicketmaster, TSeatGeek, TTravelPayouts>;
};

type CollectProviderDataResult<TTicketmaster, TSeatGeek, TTravelPayouts> = {
  degraded: boolean;
  results: {
    ticketmaster: TTicketmaster | null;
    seatgeek: TSeatGeek | null;
    travelpayouts: TTravelPayouts | null;
  };
  failures: {
    ticketmaster: ProviderFailure | null;
    seatgeek: ProviderFailure | null;
    travelpayouts: ProviderFailure | null;
  };
};

class ProviderTimeoutError extends Error {
  constructor(provider: ProviderName, timeoutMs: number) {
    super(`${provider} timed out after ${timeoutMs}ms`);
    this.name = "ProviderTimeoutError";
  }
}

function withTimeout<T>(
  providerName: ProviderName,
  timeoutMs: number,
  call: () => Promise<T>
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new ProviderTimeoutError(providerName, timeoutMs));
    }, timeoutMs);

    call()
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function runWithRetries<T>({
  providerName,
  providerCall,
  retries,
  timeoutMs,
}: {
  providerName: ProviderName;
  providerCall: () => Promise<T>;
  retries: number;
  timeoutMs: number;
}): Promise<T> {
  let attempts = 0;

  while (attempts <= retries) {
    try {
      return await withTimeout(providerName, timeoutMs, providerCall);
    } catch (error) {
      if (attempts === retries) {
        throw error;
      }
      attempts += 1;
    }
  }

  throw new Error(`${providerName} failed after retries`);
}

function toProviderFailure(error: unknown): ProviderFailure {
  if (error instanceof ProviderTimeoutError) {
    return {
      kind: "timeout",
      message: error.message,
    };
  }

  if (error instanceof Error) {
    return {
      kind: "error",
      message: error.message,
    };
  }

  return {
    kind: "error",
    message: "Unknown provider error",
  };
}

export async function collectProviderData<
  TTicketmaster,
  TSeatGeek,
  TTravelPayouts,
>({
  timeoutMs,
  retries,
  providers,
}: CollectProviderDataParams<
  TTicketmaster,
  TSeatGeek,
  TTravelPayouts
>): Promise<
  CollectProviderDataResult<TTicketmaster, TSeatGeek, TTravelPayouts>
> {
  const providerEntries = Object.entries(providers) as [
    ProviderName,
    () => Promise<unknown>,
  ][];

  const settledEntries = await Promise.all(
    providerEntries.map(async ([providerName, providerCall]) => {
      try {
        const value = await runWithRetries({
          providerName,
          providerCall,
          retries,
          timeoutMs,
        });

        return {
          providerName,
          value,
          failure: null,
        };
      } catch (error) {
        return {
          providerName,
          value: null,
          failure: toProviderFailure(error),
        };
      }
    })
  );

  const results = {
    ticketmaster: null,
    seatgeek: null,
    travelpayouts: null,
  } as CollectProviderDataResult<TTicketmaster, TSeatGeek, TTravelPayouts>["results"];

  const failures = {
    ticketmaster: null,
    seatgeek: null,
    travelpayouts: null,
  } as CollectProviderDataResult<TTicketmaster, TSeatGeek, TTravelPayouts>["failures"];

  for (const entry of settledEntries) {
    results[entry.providerName] = entry.value as never;
    failures[entry.providerName] = entry.failure;
  }

  const degraded = Object.values(failures).some((failure) => failure !== null);

  return {
    degraded,
    results,
    failures,
  };
}
