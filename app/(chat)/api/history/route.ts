import type { NextRequest } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { createApiSuccessResponse } from "@/lib/api/contracts";
import {
  deleteAllChatsByUserId,
  getChatsByUserId,
  getLatestEventTripSummariesByChatIds,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const limit = Number.parseInt(searchParams.get("limit") || "10", 10);
  const startingAfter = searchParams.get("starting_after");
  const endingBefore = searchParams.get("ending_before");

  if (startingAfter && endingBefore) {
    return new ChatSDKError(
      "bad_request:api",
      "Only one of starting_after or ending_before can be provided."
    ).toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const chats = await getChatsByUserId({
    id: session.user.id,
    limit,
    startingAfter,
    endingBefore,
  });

  const eventTripSummariesByChatId = await getLatestEventTripSummariesByChatIds(
    {
      chatIds: chats.chats.map((chat) => chat.id),
    }
  );

  const chatsWithEventTripSummary = chats.chats.map((chat) => {
    const eventTripSummary = eventTripSummariesByChatId[chat.id];

    if (!eventTripSummary) {
      return chat;
    }

    return {
      ...chat,
      eventTripSummary,
    };
  });

  return createApiSuccessResponse({
    ...chats,
    chats: chatsWithEventTripSummary,
  });
}

export async function DELETE() {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const result = await deleteAllChatsByUserId({ userId: session.user.id });

  return createApiSuccessResponse(result, { status: 200 });
}
