import { geolocation } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  stepCountIs,
  streamText,
} from "ai";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";
import { auth, type UserType } from "@/app/(auth)/auth";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import { type RequestHints, systemPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { createApiSuccessResponse } from "@/lib/api/contracts";
import { isProductionEnvironment } from "@/lib/constants";
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveEventTripPipelineResult,
  saveMessages,
  updateChatTitleById,
  updateMessage,
} from "@/lib/db/queries";
import type { DBMessage } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";
import { emitEventTripFunnelEvent } from "@/lib/eventtrip/analytics/funnel-events";
import { resolveIntentModelIds } from "@/lib/eventtrip/intent/model-routing";
import type { EventTripIntent } from "@/lib/eventtrip/intent/schema";
import {
  buildFallbackPackageOptions,
  buildPackages,
  toPackageCards,
} from "@/lib/eventtrip/packages/build-packages";
import {
  DeadlineExceededError,
  runWithDeadline,
} from "@/lib/eventtrip/pipeline/deadline";
import { runEventTripPipeline } from "@/lib/eventtrip/pipeline/run-eventtrip-pipeline";
import type { ChatMessage } from "@/lib/types";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { buildIntentGateResult } from "./intent";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 60;
const EVENTTRIP_PIPELINE_DEADLINE_MS = 15_000;

type EventTripPipelineResult = Awaited<ReturnType<typeof runEventTripPipeline>>;

function buildGracefulFallbackPipelineResult({
  intent,
  reason,
  elapsedMs,
}: {
  intent: EventTripIntent;
  reason: string;
  elapsedMs: number;
}): EventTripPipelineResult {
  const travelers = intent.travelers ?? 1;
  const ranked = buildPackages({
    options: buildFallbackPackageOptions({ travelers }),
    maxBudgetPerPerson: intent.maxBudgetPerPerson,
  });

  return {
    packages: toPackageCards(ranked.tiers),
    degraded: true,
    providerFailureSummary: [reason],
    observability: {
      totalDurationMs: elapsedMs,
      packageGenerationDurationMs: 0,
      providerLatencyMs: {
        ticketmaster: 0,
        seatgeek: 0,
        travelpayouts: 0,
      },
    },
    candidates: [],
    selectedEvent: null,
  };
}

function logEventTripObservability(
  event: string,
  payload: Record<string, unknown>
) {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  console.info(`[eventtrip.observability] ${event}`, payload);
}

function getStreamContext() {
  try {
    return createResumableStreamContext({ waitUntil: after });
  } catch (_) {
    return null;
  }
}

export { getStreamContext };

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  try {
    const { id, message, messages, selectedChatModel, selectedVisibilityType } =
      requestBody;

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const userType: UserType = session.user.type;

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError("rate_limit:chat").toResponse();
    }

    const isToolApprovalFlow = Boolean(messages);

    const chat = await getChatById({ id });
    let messagesFromDb: DBMessage[] = [];
    let titlePromise: Promise<string> | null = null;

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError("forbidden:chat").toResponse();
      }
      if (!isToolApprovalFlow) {
        messagesFromDb = await getMessagesByChatId({ id });
      }
    } else if (message?.role === "user") {
      await saveChat({
        id,
        userId: session.user.id,
        title: "New chat",
        visibility: selectedVisibilityType,
      });
      titlePromise = generateTitleFromUserMessage({ message });
    }

    const uiMessages = isToolApprovalFlow
      ? (messages as ChatMessage[])
      : [...convertToUIMessages(messagesFromDb), message as ChatMessage];

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    if (message?.role === "user") {
      await saveMessages({
        messages: [
          {
            chatId: id,
            id: message.id,
            role: "user",
            parts: message.parts,
            attachments: [],
            createdAt: new Date(),
          },
        ],
      });
    }

    if (!isToolApprovalFlow && message?.role === "user") {
      const { primaryModelId, fallbackModelId } = resolveIntentModelIds({
        selectedChatModel,
        env: process.env,
      });

      const intentParseStartedAt = Date.now();
      const intentGateResult = await buildIntentGateResult({
        message,
        model: getLanguageModel(primaryModelId),
        modelId: primaryModelId,
        fallbackModel: fallbackModelId
          ? getLanguageModel(fallbackModelId)
          : undefined,
        fallbackModelId: fallbackModelId ?? undefined,
      });
      const parseDurationMs = Date.now() - intentParseStartedAt;

      logEventTripObservability("parse", {
        chatId: id,
        durationMs: parseDurationMs,
        modelId: primaryModelId,
        fallbackModelId: fallbackModelId ?? null,
        shouldInterrupt: intentGateResult.shouldInterrupt,
        hasIntent: Boolean(intentGateResult.intent),
      });

      if (
        intentGateResult.shouldInterrupt &&
        intentGateResult.followUpQuestion
      ) {
        emitEventTripFunnelEvent("follow_up_requested", {
          chatId: id,
          modelId: primaryModelId,
          fallbackModelId: fallbackModelId ?? null,
        });
      } else if (intentGateResult.intent) {
        emitEventTripFunnelEvent("intent_detected", {
          chatId: id,
          modelId: primaryModelId,
          fallbackModelId: fallbackModelId ?? null,
        });
      }

      if (
        intentGateResult.shouldInterrupt &&
        intentGateResult.followUpQuestion
      ) {
        const followUpQuestion = intentGateResult.followUpQuestion;

        const followUpStream = createUIMessageStream<ChatMessage>({
          execute: ({ writer }) => {
            const textPartId = generateUUID();
            writer.write({ type: "text-start", id: textPartId });
            writer.write({
              type: "text-delta",
              id: textPartId,
              delta: followUpQuestion,
            });
            writer.write({ type: "text-end", id: textPartId });
          },
          onFinish: async ({ messages: finishedMessages }) => {
            if (titlePromise) {
              const title = await titlePromise;
              await updateChatTitleById({ chatId: id, title });
            }

            if (finishedMessages.length > 0) {
              await saveMessages({
                messages: finishedMessages.map((currentMessage) => ({
                  id: currentMessage.id,
                  role: currentMessage.role,
                  parts: currentMessage.parts,
                  createdAt: new Date(),
                  attachments: [],
                  chatId: id,
                })),
              });
            }
          },
          onError: () => "Oops, an error occurred!",
        });

        return createUIMessageStreamResponse({
          stream: followUpStream,
        });
      }

      if (intentGateResult.intent) {
        const resolvedIntent = intentGateResult.intent;
        const pipelineStartedAt = Date.now();
        let pipelineResult: EventTripPipelineResult;

        try {
          pipelineResult = await runWithDeadline(
            () =>
              runEventTripPipeline({
                intent: resolvedIntent,
              }),
            EVENTTRIP_PIPELINE_DEADLINE_MS
          );
        } catch (error) {
          const elapsedMs = Date.now() - pipelineStartedAt;
          const reason =
            error instanceof DeadlineExceededError
              ? `Request deadline exceeded (${EVENTTRIP_PIPELINE_DEADLINE_MS}ms)`
              : "EventTrip pipeline error";

          pipelineResult = buildGracefulFallbackPipelineResult({
            intent: resolvedIntent,
            reason,
            elapsedMs,
          });
        }

        logEventTripObservability("pipeline", {
          chatId: id,
          degraded: pipelineResult.degraded,
          providerFailureSummary: pipelineResult.providerFailureSummary,
          packageCount: pipelineResult.packages.length,
          candidateCount: pipelineResult.candidates.length,
          selectedEventProvider: pipelineResult.selectedEvent?.provider ?? null,
          ...pipelineResult.observability,
        });

        emitEventTripFunnelEvent(
          pipelineResult.degraded ? "packages_fallback" : "packages_generated",
          {
            chatId: id,
            packageCount: pipelineResult.packages.length,
            candidateCount: pipelineResult.candidates.length,
            providerFailureSummary: pipelineResult.providerFailureSummary,
          }
        );

        const summaryLine = pipelineResult.degraded
          ? `I generated your trip tiers with fallback pricing because some providers were unavailable (${pipelineResult.providerFailureSummary.join(
              "; "
            )}).`
          : "I generated your trip tiers with deterministic ranking across Budget, Best Value, and Premium.";

        const eventTripResultStream = createUIMessageStream<ChatMessage>({
          execute: ({ writer }) => {
            if (pipelineResult.selectedEvent) {
              writer.write({
                type: "data-eventtripSelectedEvent",
                data: pipelineResult.selectedEvent,
              });
            }

            writer.write({
              type: "data-eventtripPackages",
              data: pipelineResult.packages,
            });

            if (pipelineResult.candidates.length > 0) {
              writer.write({
                type: "data-eventtripCandidates",
                data: pipelineResult.candidates,
              });
            }

            const textPartId = generateUUID();
            writer.write({ type: "text-start", id: textPartId });
            writer.write({
              type: "text-delta",
              id: textPartId,
              delta: summaryLine,
            });
            writer.write({ type: "text-end", id: textPartId });
          },
          onFinish: async ({ messages: finishedMessages }) => {
            if (titlePromise) {
              const title = await titlePromise;
              await updateChatTitleById({ chatId: id, title });
            }

            if (finishedMessages.length > 0) {
              await saveMessages({
                messages: finishedMessages.map((currentMessage) => ({
                  id: currentMessage.id,
                  role: currentMessage.role,
                  parts: currentMessage.parts,
                  createdAt: new Date(),
                  attachments: [],
                  chatId: id,
                })),
              });
            }

            try {
              await saveEventTripPipelineResult({
                chatId: id,
                intent: resolvedIntent,
                packages: pipelineResult.packages,
                selectedEvent: pipelineResult.selectedEvent,
              });
            } catch (error) {
              console.warn(
                "Failed to persist EventTrip pipeline result",
                id,
                error
              );
            }
          },
          onError: () => "Oops, an error occurred!",
        });

        return createUIMessageStreamResponse({
          stream: eventTripResultStream,
        });
      }
    }

    const isReasoningModel =
      selectedChatModel.includes("reasoning") ||
      selectedChatModel.includes("thinking");

    const modelMessages = await convertToModelMessages(uiMessages);

    const stream = createUIMessageStream({
      originalMessages: isToolApprovalFlow ? uiMessages : undefined,
      execute: async ({ writer: dataStream }) => {
        const result = streamText({
          model: getLanguageModel(selectedChatModel),
          system: systemPrompt({ selectedChatModel, requestHints }),
          messages: modelMessages,
          stopWhen: stepCountIs(5),
          providerOptions: isReasoningModel
            ? {
                anthropic: {
                  thinking: { type: "enabled", budgetTokens: 10_000 },
                },
              }
            : undefined,
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: "stream-text",
          },
        });

        dataStream.merge(result.toUIMessageStream({ sendReasoning: true }));

        if (titlePromise) {
          const title = await titlePromise;
          dataStream.write({ type: "data-chat-title", data: title });
          updateChatTitleById({ chatId: id, title });
        }
      },
      generateId: generateUUID,
      onFinish: async ({ messages: finishedMessages }) => {
        if (isToolApprovalFlow) {
          for (const finishedMsg of finishedMessages) {
            const existingMsg = uiMessages.find((m) => m.id === finishedMsg.id);
            if (existingMsg) {
              await updateMessage({
                id: finishedMsg.id,
                parts: finishedMsg.parts,
              });
            } else {
              await saveMessages({
                messages: [
                  {
                    id: finishedMsg.id,
                    role: finishedMsg.role,
                    parts: finishedMsg.parts,
                    createdAt: new Date(),
                    attachments: [],
                    chatId: id,
                  },
                ],
              });
            }
          }
        } else if (finishedMessages.length > 0) {
          await saveMessages({
            messages: finishedMessages.map((currentMessage) => ({
              id: currentMessage.id,
              role: currentMessage.role,
              parts: currentMessage.parts,
              createdAt: new Date(),
              attachments: [],
              chatId: id,
            })),
          });
        }
      },
      onError: () => "Oops, an error occurred!",
    });

    return createUIMessageStreamResponse({
      stream,
      async consumeSseStream({ stream: sseStream }) {
        if (!process.env.REDIS_URL) {
          return;
        }
        try {
          const streamContext = getStreamContext();
          if (streamContext) {
            const streamId = generateId();
            await createStreamId({ streamId, chatId: id });
            await streamContext.createNewResumableStream(
              streamId,
              () => sseStream
            );
          }
        } catch (_) {
          // ignore redis errors
        }
      },
    });
  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    if (
      error instanceof Error &&
      error.message?.includes(
        "AI Gateway requires a valid credit card on file to service requests"
      )
    ) {
      return new ChatSDKError("bad_request:activate_gateway").toResponse();
    }

    console.error("Unhandled error in chat API:", error, { vercelId });
    return new ChatSDKError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return createApiSuccessResponse(deletedChat, { status: 200 });
}
