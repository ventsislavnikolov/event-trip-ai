import { generateObject, type LanguageModel } from "ai";
import {
  isOpenAIIntentModel,
  parseIntentWithOpenAIAdapter,
} from "./adapters/openai";
import type { GenerateObjectLike } from "./adapters/types";
import {
  type EventTripIntent,
  eventTripIntentExtractionSchema,
  getFollowUpQuestion,
  getMissingIntentFields,
  type ParsedIntentResult,
  validateEventTripIntent,
} from "./schema";

function extractSelectedCandidateId(text: string): string | undefined {
  const selectedCandidateIdMatch = text.match(
    /\bcandidate\s+id:\s*([a-z0-9_-]+:[a-z0-9_-]+)\b/i
  );

  return selectedCandidateIdMatch?.[1]?.trim();
}

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

  const selectedCandidateId = extractSelectedCandidateId(text);
  if (selectedCandidateId) {
    fallback.selectedEventCandidateId = selectedCandidateId;
  }

  const explicitEventMatch = text.match(
    /\bi\s+choose\s+this\s+event:\s*(.+?)(?=\.|$)/i
  );
  if (explicitEventMatch?.[1]) {
    fallback.event = explicitEventMatch[1].trim();
  }

  const fromMatch = text.match(
    /\bfrom\s+([a-zA-Z][a-zA-Z\s-]{1,40}?)(?=\s+(?:for|with|max|budget|under|up to)\b|[.,]|$)/i
  );
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
  if (normalized.length > 0 && !fallback.event) {
    fallback.event = normalized;
  }

  return fallback;
}

function buildIntentExtractionPrompt(text: string): string {
  return [
    "Extract EventTrip intent fields from this user request.",
    "Return only the structured fields using the provided schema.",
    "If the user selected a disambiguation candidate, map it to selectedEventCandidateId.",
    "If a field is unknown, leave it undefined.",
    "",
    `User request: ${text}`,
  ].join("\n");
}

export async function parseIntentFromText({
  text,
  model,
  modelId,
  fallbackModel,
  fallbackModelId,
  generateObjectFn = defaultGenerateObject,
}: {
  text: string;
  model: LanguageModel;
  modelId?: string;
  fallbackModel?: LanguageModel;
  fallbackModelId?: string;
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

  async function parseWithModel(
    activeModel: LanguageModel,
    activeModelId?: string
  ): Promise<EventTripIntent> {
    if (isOpenAIIntentModel(activeModelId)) {
      return parseIntentWithOpenAIAdapter({
        text: normalizedText,
        model: activeModel,
        generateObjectFn,
      });
    }

    const { object } = await generateObjectFn({
      model: activeModel,
      schema: eventTripIntentExtractionSchema,
      prompt: buildIntentExtractionPrompt(normalizedText),
    });

    const validatedIntent = validateEventTripIntent(object);

    if (!validatedIntent.success) {
      throw new Error("Invalid intent schema payload");
    }

    return validatedIntent.data;
  }

  let parsedIntent: EventTripIntent;

  try {
    parsedIntent = await parseWithModel(model, modelId);
  } catch (_primaryError) {
    if (fallbackModel) {
      try {
        parsedIntent = await parseWithModel(fallbackModel, fallbackModelId);
      } catch (_fallbackError) {
        parsedIntent = extractIntentWithFallback(normalizedText);
      }
    } else {
      parsedIntent = extractIntentWithFallback(normalizedText);
    }
  }

  if (!parsedIntent) {
    parsedIntent = extractIntentWithFallback(normalizedText);
  }

  if (!parsedIntent.selectedEventCandidateId) {
    const selectedCandidateId = extractSelectedCandidateId(normalizedText);
    if (selectedCandidateId) {
      parsedIntent = {
        ...parsedIntent,
        selectedEventCandidateId: selectedCandidateId,
      };
    }
  }

  const missingFields = getMissingIntentFields(parsedIntent);

  return {
    intent: parsedIntent,
    missingFields,
    followUpQuestion: getFollowUpQuestion(missingFields),
  };
}
