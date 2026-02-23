import assert from "node:assert/strict";
import test from "node:test";

import { buildIntentGateResult } from "../../app/(chat)/api/chat/intent";

test("buildIntentGateResult returns follow-up for incomplete user intent", async () => {
  const result = await buildIntentGateResult({
    message: {
      role: "user",
      parts: [{ type: "text", text: "Going to Tomorrowland from Sofia" }],
    },
    model: {} as never,
    generateObjectFn: (async () => ({
      object: {
        event: "Tomorrowland",
        originCity: "Sofia",
      },
    })) as never,
  });

  assert.equal(result.shouldInterrupt, true);
  assert.match(result.followUpQuestion ?? "", /(travelers|max budget)/i);
});

test("buildIntentGateResult does not interrupt when intent is complete", async () => {
  const result = await buildIntentGateResult({
    message: {
      role: "user",
      parts: [
        {
          type: "text",
          text: "Tomorrowland from Sofia for 2 travelers max budget 1200",
        },
      ],
    },
    model: {} as never,
    generateObjectFn: (async () => ({
      object: {
        event: "Tomorrowland",
        originCity: "Sofia",
        travelers: 2,
        maxBudgetPerPerson: 1200,
      },
    })) as never,
  });

  assert.equal(result.shouldInterrupt, false);
  assert.equal(result.followUpQuestion, null);
});

test("buildIntentGateResult retries with fallback model when primary parse fails", async () => {
  const primaryModel = { id: "primary" } as never;
  const fallbackModel = { id: "fallback" } as never;
  const calledModels: unknown[] = [];

  const result = await buildIntentGateResult({
    message: {
      role: "user",
      parts: [
        {
          type: "text",
          text: "Sziget from Berlin for 2 travelers max budget 900",
        },
      ],
    },
    model: primaryModel,
    modelId: "google/gemini-2.5-flash-lite",
    fallbackModel,
    fallbackModelId: "openai/gpt-4.1-mini",
    generateObjectFn: (({ model }: { model: unknown }) => {
      calledModels.push(model);

      if (model === primaryModel) {
        return Promise.reject(new Error("primary model unavailable"));
      }

      return Promise.resolve({
        object: {
          event: "Sziget",
          originCity: "Berlin",
          travelers: 2,
          maxBudgetPerPerson: 900,
        },
      });
    }) as never,
  });

  assert.equal(result.shouldInterrupt, false);
  assert.equal(result.followUpQuestion, null);
  assert.deepEqual(calledModels, [primaryModel, fallbackModel]);
});

test("buildIntentGateResult routes openai model ids through the OpenAI adapter", async () => {
  let capturedPrompt = "";

  const result = await buildIntentGateResult({
    message: {
      role: "user",
      parts: [
        {
          type: "text",
          text: "Tomorrowland from Sofia for 2 travelers max budget 1200",
        },
      ],
    },
    model: {} as never,
    modelId: "openai/gpt-4.1-mini",
    generateObjectFn: (({ prompt }: { prompt: string }) => {
      capturedPrompt = prompt;
      return Promise.resolve({
        object: {
          event: "Tomorrowland",
          originCity: "Sofia",
          travelers: 2,
          maxBudgetPerPerson: 1200,
        },
      });
    }) as never,
  });

  assert.equal(result.shouldInterrupt, false);
  assert.equal(result.followUpQuestion, null);
  assert.match(capturedPrompt, /OpenAI parseIntent adapter/i);
});

test("buildIntentGateResult resolves direct origin answer from prior follow-up context", async () => {
  const result = await buildIntentGateResult({
    message: {
      role: "user",
      parts: [{ type: "text", text: "Sofia" }],
    },
    messages: [
      {
        role: "user",
        parts: [{ type: "text", text: "f1 in italy" }],
      },
      {
        role: "assistant",
        parts: [{ type: "text", text: "From which city are you traveling?" }],
      },
      {
        role: "user",
        parts: [{ type: "text", text: "Sofia" }],
      },
    ],
    model: {} as never,
    generateObjectFn: (() => {
      throw new Error("force fallback parse");
    }) as never,
  });

  assert.equal(result.shouldInterrupt, true);
  assert.doesNotMatch(
    result.followUpQuestion ?? "",
    /which city are you traveling/i
  );
  assert.match(
    result.followUpQuestion ?? "",
    /(how many travelers|max budget)/i
  );
  assert.equal(result.intent?.originCity, "Sofia");
  assert.ok(result.intent?.event?.toLowerCase().includes("f1 in italy"));
});
