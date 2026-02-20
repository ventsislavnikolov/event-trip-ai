import type { LanguageModel } from "ai";
import type {
  EventTripIntent,
  eventTripIntentExtractionSchema,
} from "../schema";

export type GenerateObjectLike = (options: {
  model: LanguageModel;
  schema: typeof eventTripIntentExtractionSchema;
  prompt: string;
}) => Promise<{ object: EventTripIntent }>;
