type UnknownRecord = Record<string, unknown>;

export interface ApiSuccessEnvelope<TData> {
  ok: true;
  data: TData;
}

export interface ApiErrorDetails {
  code: string;
  message: string;
  cause?: string;
}

export interface ApiErrorEnvelope {
  ok: false;
  error: ApiErrorDetails;
}

export type ApiEnvelope<TData> = ApiSuccessEnvelope<TData> | ApiErrorEnvelope;

export function createApiSuccessResponse<TData>(
  data: TData,
  init?: ResponseInit
) {
  return Response.json(
    { ok: true, data } satisfies ApiSuccessEnvelope<TData>,
    init
  );
}

export function unwrapApiSuccessEnvelope<TData>(payload: unknown): TData {
  if (!payload || typeof payload !== "object") {
    return payload as TData;
  }

  const candidate = payload as UnknownRecord;

  if (candidate.ok === true && "data" in candidate) {
    return candidate.data as TData;
  }

  return payload as TData;
}

export function getApiErrorDetailsFromPayload(payload: unknown): {
  code?: string;
  cause?: string;
} {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const candidate = payload as UnknownRecord;

  if (typeof candidate.code === "string") {
    return {
      code: candidate.code,
      cause: typeof candidate.cause === "string" ? candidate.cause : undefined,
    };
  }

  const error = candidate.error;

  if (!error || typeof error !== "object") {
    return {};
  }

  const errorCandidate = error as UnknownRecord;

  return {
    code:
      typeof errorCandidate.code === "string" ? errorCandidate.code : undefined,
    cause:
      typeof errorCandidate.cause === "string"
        ? errorCandidate.cause
        : undefined,
  };
}
