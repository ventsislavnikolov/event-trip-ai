import assert from "node:assert/strict";
import test from "node:test";
import {
  getApiErrorDetailsFromPayload,
  unwrapApiSuccessEnvelope,
} from "../../lib/api/contracts";
import { ChatSDKError } from "../../lib/errors";
import { fetcher, fetchWithErrorHandlers } from "../../lib/utils";

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("unwrapApiSuccessEnvelope returns data from success envelopes", () => {
  const payload = unwrapApiSuccessEnvelope<{ value: number }>({
    ok: true,
    data: { value: 42 },
  });

  assert.deepEqual(payload, { value: 42 });
});

test("getApiErrorDetailsFromPayload supports envelope and legacy payloads", () => {
  const envelopeDetails = getApiErrorDetailsFromPayload({
    ok: false,
    error: {
      code: "forbidden:chat",
      message: "Forbidden",
      cause: "Chat belongs to another user",
    },
  });

  assert.deepEqual(envelopeDetails, {
    code: "forbidden:chat",
    cause: "Chat belongs to another user",
  });

  const legacyDetails = getApiErrorDetailsFromPayload({
    code: "bad_request:api",
    cause: "Missing field",
  });

  assert.deepEqual(legacyDetails, {
    code: "bad_request:api",
    cause: "Missing field",
  });
});

test("ChatSDKError.toResponse emits the error envelope contract", async () => {
  const response = new ChatSDKError(
    "bad_request:api",
    "Only one of starting_after or ending_before can be provided."
  ).toResponse();

  assert.equal(response.status, 400);

  const payload = await response.json();

  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, "bad_request:api");
  assert.equal(
    payload.error.cause,
    "Only one of starting_after or ending_before can be provided."
  );
});

test("fetcher unwraps success envelopes for data endpoints", async () => {
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        ok: true,
        data: {
          chats: [],
          hasMore: false,
        },
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }
    )) as typeof fetch;

  const payload = await fetcher("/api/history?limit=20");

  assert.deepEqual(payload, {
    chats: [],
    hasMore: false,
  });
});

test("fetchWithErrorHandlers throws ChatSDKError from envelope payloads", async () => {
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        ok: false,
        error: {
          code: "unauthorized:chat",
          message: "You need to sign in before continuing.",
        },
      }),
      {
        status: 401,
        headers: {
          "content-type": "application/json",
        },
      }
    )) as typeof fetch;

  await assert.rejects(
    () => fetchWithErrorHandlers("/api/chat"),
    (error) => {
      assert.ok(error instanceof ChatSDKError);
      assert.equal(error.type, "unauthorized");
      assert.equal(error.surface, "chat");
      return true;
    }
  );
});

test("fetchWithErrorHandlers supports legacy API errors during migration", async () => {
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        code: "forbidden:chat",
        cause: "Chat belongs to another user",
      }),
      {
        status: 403,
        headers: {
          "content-type": "application/json",
        },
      }
    )) as typeof fetch;

  await assert.rejects(
    () => fetchWithErrorHandlers("/api/chat"),
    (error) => {
      assert.ok(error instanceof ChatSDKError);
      assert.equal(error.type, "forbidden");
      assert.equal(error.surface, "chat");
      assert.equal(error.cause, "Chat belongs to another user");
      return true;
    }
  );
});
