import type {
  ChatMessage,
  CustomUIDataTypes,
  EventTripSelectedEventData,
} from "@/lib/types";

export function injectPersistedEventTripPackagesMessage({
  messages,
  packages,
  selectedEvent,
  messageId,
}: {
  messages: ChatMessage[];
  packages: CustomUIDataTypes["eventtripPackages"];
  selectedEvent?: EventTripSelectedEventData | null;
  messageId: string;
}): ChatMessage[] {
  const hasPackages = Array.isArray(packages) && packages.length > 0;
  const hasSelectedEvent = Boolean(selectedEvent);

  if (!hasPackages && !hasSelectedEvent) {
    return messages;
  }

  const alreadyHasPackages = messages.some((message) =>
    message.parts.some((part) => part.type === "data-eventtripPackages")
  );
  const alreadyHasSelectedEvent = messages.some((message) =>
    message.parts.some((part) => part.type === "data-eventtripSelectedEvent")
  );

  const nextParts: ChatMessage["parts"] = [];

  if (selectedEvent && !alreadyHasSelectedEvent) {
    nextParts.push({
      type: "data-eventtripSelectedEvent",
      data: selectedEvent,
    });
  }

  if (hasPackages && !alreadyHasPackages) {
    nextParts.push({
      type: "data-eventtripPackages",
      data: packages,
    });
  }

  if (nextParts.length === 0) {
    return messages;
  }

  return [
    ...messages,
    {
      id: messageId,
      role: "assistant",
      metadata: {
        createdAt: new Date().toISOString(),
      },
      parts: nextParts,
    } satisfies ChatMessage,
  ];
}
