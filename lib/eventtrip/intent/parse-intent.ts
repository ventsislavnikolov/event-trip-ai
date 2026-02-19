import { generateObject, type LanguageModel } from "ai";
import {
  eventTripIntentExtractionSchema,
  getFollowUpQuestion,
  getMissingIntentFields,
  type EventTripIntent,
  type ParsedIntentResult,
} from "./schema";

type GenerateObjectLike = (options: {
  model: LanguageModel;
  schema: typeof eventTripIntentExtractionSchema;
  prompt: string;
}) => Promise<{ object: EventTripIntent }>;

async function defaultGenerateObject(options: {
  model: LanguageModel;
  schema: typeof eventTripIntentExtractionSchema;
  prompt: string;
}): Promise<{ object: EventTripIntent }> {
  const result = await generateObject(options);
  return { object: result.object as EventTripIntent };
}

function extractIntentWithFallback(text: string): EventTripIntent {
  const fallback: EventTripIntent = {};

  const fromMatch = text.match(/\bfrom\s+([a-zA-Z][a-zA-Z\s-]{1,40})/i);
  if (fromMatch) {
    fallback.originCity = fromMatch[1]?.trim();
  }

  const travelersMatch = text.match(
    /\b(\d+)\s*(traveler|travelers|people|persons|adults?)\b/i
  );
  if (travelersMatch) {
    const parsedTravelers = Number.parseInt(travelersMatch[1], 10);
    if (!Number.isNaN(parsedTravelers) && parsedTravelers > 0) {
      fallback.travelers = parsedTravelers;
    }
  }

  const budgetMatch = text.match(
    /\b(?:budget|max budget|under|up to)\D{0,12}(\d+(?:[.,]\d+)?)\b/i
  );
  if (budgetMatch) {
    const parsedBudget = Number.parseFloat(budgetMatch[1].replace(",", "."));
    if (!Number.isNaN(parsedBudget) && parsedBudget > 0) {
      fallback.maxBudgetPerPerson = parsedBudget;
    }
  }

  const normalized = text.trim();
  if (normalized.length > 0) {
    fallback.event = normalized;
  }

  return fallback;
}

function buildIntentExtractionPrompt(text: string): string {
  return [
    "Extract EventTrip intent fields from this user request.",
    "Return only the structured fields using the provided schema.",
    "If a field is unknown, leave it undefined.",
    "",
    `User request: ${text}`,
  ].join("\n");
}

export async function parseIntentFromText({
  text,
  model,
  generateObjectFn = defaultGenerateObject,
}: {
  text: string;
  model: LanguageModel;
  generateObjectFn?: GenerateObjectLike;
}): Promise<ParsedIntentResult> {
  const normalizedText = text.trim();

  if (!normalizedText) {
    const emptyIntent: EventTripIntent = {};
    const missingFields = getMissingIntentFields(emptyIntent);

    return {
      intent: emptyIntent,
      missingFields,
      followUpQuestion: getFollowUpQuestion(missingFields),
    };
  }

  let parsedIntent: EventTripIntent;

  try {
    const { object } = await generateObjectFn({
      model,
      schema: eventTripIntentExtractionSchema,
      prompt: buildIntentExtractionPrompt(normalizedText),
    });

    parsedIntent = eventTripIntentExtractionSchema.parse(object);
  } catch (_error) {
    parsedIntent = extractIntentWithFallback(normalizedText);
  }

  const missingFields = getMissingIntentFields(parsedIntent);

  return {
    intent: parsedIntent,
    missingFields,
    followUpQuestion: getFollowUpQuestion(missingFields),
  };
}
