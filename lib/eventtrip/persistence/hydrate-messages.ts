import type { ChatMessage, CustomUIDataTypes } from "@/lib/types";

export function injectPersistedEventTripPackagesMessage({
  messages,
  packages,
  messageId,
}: {
  messages: ChatMessage[];
  packages: CustomUIDataTypes["eventtripPackages"];
  messageId: string;
}): ChatMessage[] {
  if (!Array.isArray(packages) || packages.length === 0) {
    return messages;
  }

  const alreadyHasPackages = messages.some((message) =>
    message.parts.some((part) => part.type === "data-eventtripPackages")
  );

  if (alreadyHasPackages) {
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
      parts: [
        {
          type: "data-eventtripPackages",
          data: packages,
        },
      ],
    } satisfies ChatMessage,
  ];
}
