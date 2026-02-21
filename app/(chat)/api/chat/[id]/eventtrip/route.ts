import { auth } from "@/app/(auth)/auth";
import { createApiSuccessResponse } from "@/lib/api/contracts";
import {
  getChatById,
  getLatestEventTripResultByChatId,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return new ChatSDKError(
        "bad_request:api",
        "Parameter id is required."
      ).toResponse();
    }

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const chat = await getChatById({ id });

    if (!chat) {
      return new ChatSDKError("not_found:chat").toResponse();
    }

    if (chat.userId !== session.user.id) {
      return new ChatSDKError("forbidden:chat").toResponse();
    }

    const result = await getLatestEventTripResultByChatId({ chatId: id });

    if (!result) {
      return createApiSuccessResponse(null, { status: 200 });
    }

    return createApiSuccessResponse(
      {
        ...result,
        selectedEvent: result.event,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    return new ChatSDKError("offline:chat").toResponse();
  }
}
