import type { LanguageModel } from "ai";
import { parseIntentFromText } from "@/lib/eventtrip/intent/parse-intent";
import type { EventTripIntent } from "@/lib/eventtrip/intent/schema";

type UserMessagePart = {
  type: string;
  text?: string;
};

type UserMessageLike = {
  role?: string;
  parts?: UserMessagePart[];
};

type BuildIntentGateResultParams = {
  message: UserMessageLike | undefined;
  model: LanguageModel;
  fallbackModel?: LanguageModel;
  generateObjectFn?: Parameters<
    typeof parseIntentFromText
  >[0]["generateObjectFn"];
};

function extractUserText(message: UserMessageLike | undefined): string {
  if (!message || message.role !== "user" || !Array.isArray(message.parts)) {
    return "";
  }

  return message.parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text?.trim() ?? "")
    .filter((value) => value.length > 0)
    .join("\n")
    .trim();
}

export async function buildIntentGateResult({
  message,
  model,
  fallbackModel,
  generateObjectFn,
}: BuildIntentGateResultParams): Promise<{
  shouldInterrupt: boolean;
  followUpQuestion: string | null;
  intent: EventTripIntent | null;
}> {
  const text = extractUserText(message);

  if (!text) {
    return {
      shouldInterrupt: false,
      followUpQuestion: null,
      intent: null,
    };
  }

  const parsed = await parseIntentFromText({
    text,
    model,
    fallbackModel,
    generateObjectFn,
  });

  return {
    shouldInterrupt: parsed.missingFields.length > 0,
    followUpQuestion: parsed.followUpQuestion,
    intent: parsed.intent,
  };
}
