import type {
  AssistantModelMessage,
  ToolModelMessage,
  UIMessage,
  UIMessagePart,
} from 'ai';
import { type ClassValue, clsx } from 'clsx';
import { formatISO } from 'date-fns';
import { twMerge } from 'tailwind-merge';
import {
  getApiErrorDetailsFromPayload,
  unwrapApiSuccessEnvelope,
} from '@/lib/api/contracts';
import type { DBMessage, Document } from '@/lib/db/schema';
import { ChatSDKError, type ErrorCode } from './errors';
import type { ChatMessage, ChatTools, CustomUIDataTypes } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fetcher = async <TData = unknown>(url: string): Promise<TData> => {
  const response = await fetch(url);
  const payload = await getJsonPayload(response);

  if (!response.ok) {
    throw createChatSdkErrorFromResponse(response.status, payload);
  }

  return unwrapApiSuccessEnvelope<TData>(payload);
};

export async function fetchWithErrorHandlers(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  try {
    const response = await fetch(input, init);

    if (!response.ok) {
      const payload = await getJsonPayload(response);
      throw createChatSdkErrorFromResponse(response.status, payload);
    }

    return response;
  } catch (error: unknown) {
    if (error instanceof ChatSDKError) {
      throw error;
    }

    if (
      typeof navigator !== 'undefined' &&
      'onLine' in navigator &&
      navigator.onLine === false
    ) {
      throw new ChatSDKError('offline:chat');
    }

    throw error;
  }
}

async function getJsonPayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function createChatSdkErrorFromResponse(status: number, payload: unknown) {
  const { code, cause } = getApiErrorDetailsFromPayload(payload);
  const fallbackCode = getFallbackErrorCodeByStatus(status);

  return new ChatSDKError((code || fallbackCode) as ErrorCode, cause);
}

function getFallbackErrorCodeByStatus(status: number): ErrorCode {
  switch (status) {
    case 400:
      return 'bad_request:api';
    case 401:
      return 'unauthorized:chat';
    case 403:
      return 'forbidden:chat';
    case 404:
      return 'not_found:chat';
    case 429:
      return 'rate_limit:chat';
    default:
      return 'offline:chat';
  }
}

export function getLocalStorage(key: string) {
  if (typeof window !== 'undefined') {
    return JSON.parse(localStorage.getItem(key) || '[]');
  }
  return [];
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

type ResponseMessageWithoutId = ToolModelMessage | AssistantModelMessage;
type ResponseMessage = ResponseMessageWithoutId & { id: string };

export function getMostRecentUserMessage(messages: UIMessage[]) {
  const userMessages = messages.filter((message) => message.role === 'user');
  return userMessages.at(-1);
}

export function getDocumentTimestampByIndex(
  documents: Document[],
  index: number,
) {
  if (!documents) { return new Date(); }
  if (index > documents.length) { return new Date(); }

  return documents[index].createdAt;
}

export function getTrailingMessageId({
  messages,
}: {
  messages: ResponseMessage[];
}): string | null {
  const trailingMessage = messages.at(-1);

  if (!trailingMessage) { return null; }

  return trailingMessage.id;
}

export function sanitizeText(text: string) {
  return text.replace('<has_function_call>', '');
}

export function convertToUIMessages(messages: DBMessage[]): ChatMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role as 'user' | 'assistant' | 'system',
    parts: message.parts as UIMessagePart<CustomUIDataTypes, ChatTools>[],
    metadata: {
      createdAt: formatISO(message.createdAt),
    },
  }));
}

export function getTextFromMessage(message: ChatMessage | UIMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => (part as { type: 'text'; text: string}).text)
    .join('');
}
