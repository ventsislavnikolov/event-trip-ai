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

test("uses fallback model when primary model returns invalid strict-schema payload", async () => {
  const primaryModel = { id: "primary" } as never;
  const fallbackModel = { id: "fallback" } as never;
  const calledModels: unknown[] = [];

  const result = await parseIntentFromText({
    text: "Tomorrowland from Sofia for 2 travelers with max budget 1200",
    model: primaryModel,
    fallbackModel,
    generateObjectFn: (({ model }: { model: unknown }) => {
      calledModels.push(model);

      if (model === primaryModel) {
        return Promise.resolve({
          object: {
            event: "Tomorrowland",
            originCity: "Sofia",
            travelers: 2,
            maxBudgetPerPerson: 1200,
            currency: "EUR",
          },
        });
      }

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

  assert.equal(result.followUpQuestion, null);
  assert.deepEqual(result.missingFields, []);
  assert.deepEqual(calledModels, [primaryModel, fallbackModel]);
});
