import assert from "node:assert/strict";
import test from "node:test";

import { parseIntentFromText } from "../../lib/eventtrip/intent/parse-intent";

function createMockGenerateObject(object: Record<string, unknown>) {
  return async () => ({ object });
}

test("returns parsed intent and no follow-up when all required fields are present", async () => {
  const result = await parseIntentFromText({
    text: "Tomorrowland from Sofia for 2 travelers with max budget 1200 EUR per person",
    model: {} as never,
    generateObjectFn: createMockGenerateObject({
      event: "Tomorrowland",
      originCity: "Sofia",
      travelers: 2,
      maxBudgetPerPerson: 1200,
    }) as never,
  });

  assert.equal(result.intent.event, "Tomorrowland");
  assert.equal(result.intent.originCity, "Sofia");
  assert.equal(result.intent.travelers, 2);
  assert.equal(result.intent.maxBudgetPerPerson, 1200);
  assert.deepEqual(result.missingFields, []);
  assert.equal(result.followUpQuestion, null);
});

test("returns targeted follow-up when budget is missing", async () => {
  const result = await parseIntentFromText({
    text: "Sziget from Berlin for 2 travelers",
    model: {} as never,
    generateObjectFn: createMockGenerateObject({
      event: "Sziget",
      originCity: "Berlin",
      travelers: 2,
    }) as never,
  });

  assert.deepEqual(result.missingFields, ["maxBudgetPerPerson"]);
  assert.match(result.followUpQuestion ?? "", /max budget per person/i);
});

test("uses OpenAI adapter prompt for openai model ids", async () => {
  let usedPrompt = "";

  await parseIntentFromText({
    text: "Tomorrowland from Sofia for 2 travelers with max budget 1200",
    model: {} as never,
    modelId: "openai/gpt-4.1-mini",
    generateObjectFn: (({ prompt }: { prompt: string }) => {
      usedPrompt = prompt;
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

  assert.match(usedPrompt, /OpenAI parseIntent adapter/i);
});

test("uses default prompt for non-openai model ids", async () => {
  let usedPrompt = "";

  await parseIntentFromText({
    text: "Tomorrowland from Sofia for 2 travelers with max budget 1200",
    model: {} as never,
    modelId: "google/gemini-2.5-flash-lite",
    generateObjectFn: (({ prompt }: { prompt: string }) => {
      usedPrompt = prompt;
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

  assert.match(usedPrompt, /Extract EventTrip intent fields/i);
  assert.doesNotMatch(usedPrompt, /OpenAI parseIntent adapter/i);
});
