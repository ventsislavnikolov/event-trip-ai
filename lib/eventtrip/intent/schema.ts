import { z } from "zod";

const optionalStringField = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, z.string().min(1).optional());

const optionalTravelersField = z.preprocess((value) => {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  return undefined;
}, z.number().int().positive().optional());

const optionalBudgetField = z.preprocess((value) => {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(",", ".").replace(/[^0-9.]/g, "");
    const parsed = Number.parseFloat(normalized);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  return undefined;
}, z.number().positive().optional());

export const eventTripIntentExtractionSchema = z.object({
  event: optionalStringField,
  originCity: optionalStringField,
  travelers: optionalTravelersField,
  maxBudgetPerPerson: optionalBudgetField,
});

export type EventTripIntent = z.infer<typeof eventTripIntentExtractionSchema>;

export type IntentField =
  | "event"
  | "originCity"
  | "travelers"
  | "maxBudgetPerPerson";

export type ParsedIntentResult = {
  intent: EventTripIntent;
  missingFields: IntentField[];
  followUpQuestion: string | null;
};

const REQUIRED_FIELDS: IntentField[] = [
  "event",
  "originCity",
  "travelers",
  "maxBudgetPerPerson",
];

export function getMissingIntentFields(intent: EventTripIntent): IntentField[] {
  return REQUIRED_FIELDS.filter((field) => {
    const value = intent[field];
    return value === undefined || value === null;
  });
}

export function getFollowUpQuestion(
  missingFields: IntentField[]
): string | null {
  const nextMissingField = missingFields[0];

  if (!nextMissingField) {
    return null;
  }

  switch (nextMissingField) {
    case "event":
      return "Which event are you planning to attend?";
    case "originCity":
      return "From which city are you traveling?";
    case "travelers":
      return "How many travelers should I plan for?";
    case "maxBudgetPerPerson":
      return "What is your max budget per person?";
    default:
      return "Could you share a bit more detail about your trip preferences?";
  }
}
