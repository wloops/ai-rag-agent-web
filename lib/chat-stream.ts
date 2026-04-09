import { chatApi } from "@/lib/api";
import type { AskChatRequest, AskChatResponse } from "@/lib/types";

export type ManagedChatStreamStatus = "streaming" | "complete" | "error";

export interface ManagedChatStreamSnapshot {
  conversationId: number;
  answer: string;
  question: string;
  knowledgeBaseId: number;
  status: ManagedChatStreamStatus;
  error: string | null;
  finalResponse: AskChatResponse | null;
  updatedAt: string;
}

type ManagedChatStreamListener = (snapshot: ManagedChatStreamSnapshot) => void;

interface ManagedChatStreamEntry {
  snapshot: ManagedChatStreamSnapshot | null;
  listeners: Set<ManagedChatStreamListener>;
}

interface StartManagedChatStreamParams {
  token: string;
  payload: AskChatRequest;
  onStart?: (conversationId: number) => void;
  onError?: (message: string) => void;
}

export interface ManagedChatStreamHandle {
  promise: Promise<void>;
  abort: () => void;
}

const managedStreams = new Map<number, ManagedChatStreamEntry>();

export function startManagedChatStream(
  params: StartManagedChatStreamParams,
): ManagedChatStreamHandle {
  let startedConversationId: number | null = null;
  let aborted = false;
  const abortController = new AbortController();

  const promise = chatApi
    .askStream(
      params.token,
      params.payload,
      {
        onStart: (payload) => {
          startedConversationId = payload.conversation_id;
          const existingListeners =
            managedStreams.get(payload.conversation_id)?.listeners ??
            new Set<ManagedChatStreamListener>();
          managedStreams.set(payload.conversation_id, {
            listeners: existingListeners,
            snapshot: {
              conversationId: payload.conversation_id,
              answer: "",
              question: params.payload.question,
              knowledgeBaseId: params.payload.knowledge_base_id,
              status: "streaming",
              error: null,
              finalResponse: null,
              updatedAt: new Date().toISOString(),
            },
          });
          notifyManagedChatStream(payload.conversation_id);
          params.onStart?.(payload.conversation_id);
        },
        onDelta: (payload) => {
          if (!startedConversationId) {
            return;
          }

          updateManagedChatStream(startedConversationId, (snapshot) => ({
            ...snapshot,
            answer: snapshot.answer + payload.content,
            updatedAt: new Date().toISOString(),
          }));
        },
        onFinal: (payload) => {
          const conversationId = payload.conversation_id;
          const existingEntry = managedStreams.get(conversationId);
          const existingSnapshot = existingEntry?.snapshot;
          managedStreams.set(conversationId, {
            listeners: existingEntry?.listeners ?? new Set<ManagedChatStreamListener>(),
            snapshot: {
              conversationId,
              answer: payload.answer,
              question: existingSnapshot?.question ?? params.payload.question,
              knowledgeBaseId:
                existingSnapshot?.knowledgeBaseId ?? params.payload.knowledge_base_id,
              status: "complete",
              error: null,
              finalResponse: payload,
              updatedAt: new Date().toISOString(),
            },
          });
          notifyManagedChatStream(conversationId);
        },
        onError: (payload) => {
          if (startedConversationId) {
            updateManagedChatStream(startedConversationId, (snapshot) => ({
              ...snapshot,
              status: "error",
              error: payload.detail,
              updatedAt: new Date().toISOString(),
            }));
          }
          params.onError?.(payload.detail);
        },
      },
      {
        signal: abortController.signal,
      },
    )
    .catch((error: unknown) => {
      if (
        aborted &&
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        (error as { name?: string }).name === "AbortError"
      ) {
        return;
      }

      throw error;
    });

  return {
    promise,
    abort: () => {
      aborted = true;
      abortController.abort();
    },
  };
}

export function getManagedChatStreamSnapshot(
  conversationId: number,
): ManagedChatStreamSnapshot | null {
  return managedStreams.get(conversationId)?.snapshot ?? null;
}

export function subscribeManagedChatStream(
  conversationId: number,
  listener: ManagedChatStreamListener,
): () => void {
  const existingEntry = managedStreams.get(conversationId) ?? {
    snapshot: null,
    listeners: new Set<ManagedChatStreamListener>(),
  };

  if (!managedStreams.has(conversationId)) {
    managedStreams.set(conversationId, existingEntry);
  }

  existingEntry.listeners.add(listener);
  if (existingEntry.snapshot) {
    listener(existingEntry.snapshot);
  }
  return () => {
    existingEntry.listeners.delete(listener);
  };
}

export function clearManagedChatStream(conversationId: number): void {
  managedStreams.delete(conversationId);
}

function updateManagedChatStream(
  conversationId: number,
  updater: (snapshot: ManagedChatStreamSnapshot) => ManagedChatStreamSnapshot,
): void {
  const entry = managedStreams.get(conversationId);
  if (!entry?.snapshot) {
    return;
  }

  entry.snapshot = updater(entry.snapshot);
  notifyManagedChatStream(conversationId);
}

function notifyManagedChatStream(conversationId: number): void {
  const entry = managedStreams.get(conversationId);
  if (!entry?.snapshot) {
    return;
  }

  const snapshot = entry.snapshot;
  entry.listeners.forEach((listener) => listener(snapshot));
}
