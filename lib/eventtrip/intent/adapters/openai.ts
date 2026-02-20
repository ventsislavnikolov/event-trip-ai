import type { LanguageModel } from "ai";
import {
  type EventTripIntent,
  eventTripIntentExtractionSchema,
} from "../schema";
import type { GenerateObjectLike } from "./types";

function buildOpenAIIntentExtractionPrompt(text: string): string {
  return [
    "OpenAI parseIntent adapter: extract EventTrip intent fields.",
    "Return only fields present in the user input and leave unknown fields undefined.",
    "Do not infer missing values.",
    "",
    `User request: ${text}`,
  ].join("\n");
}

export function isOpenAIIntentModel(modelId: string | undefined): boolean {
  return Boolean(modelId?.startsWith("openai/"));
}

export async function parseIntentWithOpenAIAdapter({
  text,
  model,
  generateObjectFn,
}: {
  text: string;
  model: LanguageModel;
  generateObjectFn: GenerateObjectLike;
}): Promise<EventTripIntent> {
  const { object } = await generateObjectFn({
    model,
    schema: eventTripIntentExtractionSchema,
    prompt: buildOpenAIIntentExtractionPrompt(text),
  });

  return eventTripIntentExtractionSchema.parse(object);
}
