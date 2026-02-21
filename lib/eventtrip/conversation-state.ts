type EventTripMessagePart = {
  type?: string;
  text?: string;
};

type EventTripMessageLike = {
  role?: string;
  parts?: EventTripMessagePart[];
};

export type EventTripConversationPhase =
  | "idle"
  | "collecting-requirements"
  | "event-selection"
  | "packages-ready";

export type EventTripConversationState = {
  phase: EventTripConversationPhase;
  label: string;
  hint: string;
  suggestedPrompts: string[];
};

function getLatestAssistantText(messages: EventTripMessageLike[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "assistant") {
      continue;
    }

    const textParts = (message.parts ?? [])
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text?.trim() ?? "")
      .filter(Boolean);

    if (textParts.length > 0) {
      return textParts.join("\n");
    }
  }

  return "";
}

function hasPartType(messages: EventTripMessageLike[], partType: string): boolean {
  return messages.some((message) =>
    (message.parts ?? []).some((part) => part.type === partType)
  );
}

export function deriveEventTripConversationState(
  messages: EventTripMessageLike[]
): EventTripConversationState {
  if (messages.length === 0) {
    return {
      phase: "idle",
      label: "Start Planning",
      hint: "Include event, origin city, travelers, and max budget per person.",
      suggestedPrompts: [
        "Tomorrowland from Sofia for 2 travelers with max budget 1200 EUR per person",
        "F1 Monaco from Berlin for 1 traveler with max budget 1800 EUR",
        "Sziget from London for 3 travelers with max budget 900 EUR per person",
      ],
    };
  }

  const hasPackages = hasPartType(messages, "data-eventtripPackages");
  const hasCandidates = hasPartType(messages, "data-eventtripCandidates");
  const hasSelectedEvent = hasPartType(messages, "data-eventtripSelectedEvent");
  const latestAssistantText = getLatestAssistantText(messages).toLowerCase();

  if (hasPackages) {
    return {
      phase: "packages-ready",
      label: "Packages Ready",
      hint: "Refine with stricter constraints or choose a different event.",
      suggestedPrompts: [
        "Can you optimize this for lower budget?",
        "Increase comfort but keep total below 1500 EUR per person",
        "Show alternatives for the same event next weekend",
      ],
    };
  }

  if (hasCandidates && !hasSelectedEvent) {
    return {
      phase: "event-selection",
      label: "Choose Event",
      hint: "Select one candidate so pricing can be generated.",
      suggestedPrompts: [
        "I choose this event: Candidate ID: ticketmaster:tm-1",
        "I choose this event: Candidate ID: seatgeek:sg-1",
      ],
    };
  }

  const requestingDetails =
    latestAssistantText.includes("max budget per person") ||
    latestAssistantText.includes("how many travelers") ||
    latestAssistantText.includes("which city are you flying from") ||
    latestAssistantText.includes("which event");

  if (requestingDetails) {
    return {
      phase: "collecting-requirements",
      label: "Need More Details",
      hint: "Answer the latest follow-up to continue with package generation.",
      suggestedPrompts: [
        "From Sofia, 2 travelers, max budget 1200 EUR per person",
        "From Berlin, 1 traveler, max budget 1500 EUR",
      ],
    };
  }

  return {
    phase: "collecting-requirements",
    label: "Planning In Progress",
    hint: "Add missing trip constraints to improve the generated packages.",
    suggestedPrompts: [
      "Origin city is Sofia",
      "Travelers are 2 adults",
      "Max budget is 1000 EUR per person",
    ],
  };
}
