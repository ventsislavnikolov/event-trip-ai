import type { LanguageModel } from "ai";
import { parseIntentFromText } from "@/lib/eventtrip/intent/parse-intent";
import {
  type EventTripIntent,
  getFollowUpQuestion,
  getMissingIntentFields,
  type IntentField,
} from "@/lib/eventtrip/intent/schema";

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
  messages?: UserMessageLike[];
  model: LanguageModel;
  modelId?: string;
  fallbackModel?: LanguageModel;
  fallbackModelId?: string;
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

function extractConversationUserText(
  messages: UserMessageLike[] | undefined
): string {
  if (!Array.isArray(messages) || messages.length === 0) {
    return "";
  }

  return messages
    .filter((message) => message.role === "user")
    .map((message) => extractUserText(message))
    .filter((value) => value.length > 0)
    .join("\n")
    .trim();
}

function normalizeAssistantText(message: UserMessageLike | undefined): string {
  if (
    !message ||
    message.role !== "assistant" ||
    !Array.isArray(message.parts)
  ) {
    return "";
  }

  return message.parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text?.trim() ?? "")
    .filter((value) => value.length > 0)
    .join("\n")
    .toLowerCase();
}

function getPendingFollowUpField(
  messages: UserMessageLike[] | undefined
): IntentField | null {
  if (!Array.isArray(messages) || messages.length === 0) {
    return null;
  }

  let latestUserIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") {
      latestUserIndex = index;
      break;
    }
  }

  if (latestUserIndex <= 0) {
    return null;
  }

  for (let index = latestUserIndex - 1; index >= 0; index -= 1) {
    const assistantText = normalizeAssistantText(messages[index]);
    if (!assistantText) {
      continue;
    }

    if (
      assistantText.includes("from which city are you traveling") ||
      assistantText.includes("which city are you flying from")
    ) {
      return "originCity";
    }

    if (assistantText.includes("how many travelers")) {
      return "travelers";
    }

    if (assistantText.includes("max budget per person")) {
      return "maxBudgetPerPerson";
    }

    if (assistantText.includes("which event")) {
      return "event";
    }

    return null;
  }

  return null;
}

function normalizeDirectOriginAnswer(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed) {
    return undefined;
  }

  const labeledMatch = trimmed.match(
    /\b(?:origin(?:\s+city)?|departure\s+city|from)\s*(?:is|:)?\s*([a-z][a-z\s,'-]{1,60})$/i
  );
  if (labeledMatch?.[1]) {
    return labeledMatch[1].trim();
  }

  const strippedPrefix = trimmed
    .replace(
      /^(?:from|origin(?:\s+city)?|departure\s+city)\s*(?:is|:)?\s*/i,
      ""
    )
    .trim();

  const candidate = strippedPrefix || trimmed;
  if (
    !candidate ||
    candidate.length > 64 ||
    /\d/.test(candidate) ||
    !/[a-z]/i.test(candidate)
  ) {
    return undefined;
  }

  return candidate;
}

function extractDirectFieldValue(
  field: IntentField,
  messageText: string
): string | number | undefined {
  const normalized = messageText.trim();
  if (!normalized) {
    return undefined;
  }

  switch (field) {
    case "event":
      return normalized;
    case "originCity":
      return normalizeDirectOriginAnswer(normalized);
    case "travelers": {
      const match = normalized.match(/\b(\d{1,2})\b/);
      if (!match) {
        return undefined;
      }

      const parsed = Number.parseInt(match[1], 10);
      return Number.isNaN(parsed) || parsed <= 0 ? undefined : parsed;
    }
    case "maxBudgetPerPerson": {
      const match = normalized.match(/(\d+(?:[.,]\d+)?)/);
      if (!match) {
        return undefined;
      }

      const parsed = Number.parseFloat(match[1].replace(",", "."));
      return Number.isNaN(parsed) || parsed <= 0 ? undefined : parsed;
    }
    default:
      return undefined;
  }
}

export async function buildIntentGateResult({
  message,
  messages,
  model,
  modelId,
  fallbackModel,
  fallbackModelId,
  generateObjectFn,
}: BuildIntentGateResultParams): Promise<{
  shouldInterrupt: boolean;
  followUpQuestion: string | null;
  intent: EventTripIntent | null;
}> {
  const directMessageText = extractUserText(message);
  const conversationText = extractConversationUserText(messages);
  const text = conversationText || directMessageText;

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
    modelId,
    fallbackModel,
    fallbackModelId,
    generateObjectFn,
  });

  const pendingFollowUpField = getPendingFollowUpField(messages);
  if (pendingFollowUpField && directMessageText) {
    const directAnswer = extractDirectFieldValue(
      pendingFollowUpField,
      directMessageText
    );

    if (
      directAnswer !== undefined &&
      parsed.intent[pendingFollowUpField] === undefined
    ) {
      parsed.intent = {
        ...parsed.intent,
        [pendingFollowUpField]: directAnswer,
      };
    }
  }

  const missingFields = getMissingIntentFields(parsed.intent);

  return {
    shouldInterrupt: missingFields.length > 0,
    followUpQuestion: getFollowUpQuestion(missingFields),
    intent: parsed.intent,
  };
}
