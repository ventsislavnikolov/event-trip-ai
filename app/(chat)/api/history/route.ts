import type { NextRequest } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { createApiSuccessResponse } from "@/lib/api/contracts";
import {
  deleteAllChatsByUserId,
  getChatsByUserId,
  getLatestEventTripResultByChatId,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import type { EventTripHistorySummary } from "@/lib/eventtrip/persistence/history-summary";

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

  const chatsWithEventTripSummary = await Promise.all(
    chats.chats.map(async (chat) => {
      const latestEventTrip = await getLatestEventTripResultByChatId({
        chatId: chat.id,
      });

      if (!latestEventTrip) {
        return chat;
      }

      const summary: EventTripHistorySummary = {
        eventQuery: latestEventTrip.eventQuery,
        originCity: latestEventTrip.originCity,
        travelers: latestEventTrip.travelers,
        maxBudgetPerPerson: latestEventTrip.maxBudgetPerPerson,
        event: latestEventTrip.event
          ? {
              name: latestEventTrip.event.name,
              city: latestEventTrip.event.city,
              country: latestEventTrip.event.country,
              startsAt: latestEventTrip.event.startsAt,
            }
          : null,
      };

      return {
        ...chat,
        eventTripSummary: summary,
      };
    })
  );

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
