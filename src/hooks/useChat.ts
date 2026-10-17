import { useCallback, useEffect, useRef, useState } from "react";
import type { EngineLine } from "../engine/uci";
import { GM_NAMES, GMS, type GMName } from "../data/gms";
import { ApiError, askGM } from "../lib/api";
import type { MoveVerdict } from "../lib/moveReview";

export interface ChatMessage {
  id: string;
  role: "user" | "gm";
  text: string;
  /** The position the message was written for; a grandmaster's move suggestions are only playable there. */
  fen: string;
  /** Plies played when the message was written. */
  ply: number;
  /** Which game or lesson it belongs to. A new game starts a new scope, so old answers never leak into it. */
  scope: string;
  followUps?: string[];
  /**
   * welcome – the opening greeting
   * note    – a local announcement (e.g. "Let's study the Ruy Lopez"); never sent to the model
   * error   – a failed request, with `retry` holding the question to resend
   */
  kind?: "welcome" | "note" | "error";
  retry?: string;
}

export interface SendContext {
  fen: string;
  ply: number;
  /** See ChatMessage.scope. */
  scope: string;
  moveHistory: string[];
  topLines: EngineLine[];
  openingName?: string;
  /** How the move that led to this position was judged, when the engine has looked deeply enough to say. */
  moveReview?: MoveVerdict | null;
  /** Prepended to the question the model sees, but not shown in the chat (e.g. lesson context). */
  contextPrefix?: string;
}

const MAX_HISTORY_TURNS = 6;
const MAX_PLY_DISTANCE = 8;

/**
 * The turns worth sending back to the model: real exchanges (no greetings, notes or
 * errors) from the same game or lesson, about a position near the current one. Answers
 * about a position the board left long ago, or about another game, would only confuse the model.
 */
export function buildHistory(messages: readonly ChatMessage[], ply: number, scope: string) {
  return messages
    .filter((m) => !m.kind && m.scope === scope && Math.abs(m.ply - ply) <= MAX_PLY_DISTANCE)
    .slice(-MAX_HISTORY_TURNS)
    .map((m) => ({ role: m.role === "user" ? ("user" as const) : ("assistant" as const), content: m.text }));
}

type Threads = Record<GMName, ChatMessage[]>;

let idCounter = 0;
const nextId = () => `m${++idCounter}`;

function initialThreads(): Threads {
  const threads = {} as Threads;
  for (const name of GM_NAMES) {
    threads[name] = [{ id: `welcome-${name}`, role: "gm", text: GMS[name].welcome, fen: "", ply: 0, scope: "", kind: "welcome" }];
  }
  return threads;
}

/**
 * One conversation per grandmaster, like contacts in a messaging app. Switching
 * grandmaster switches thread, so Hikaru never sees Magnus's replies as his own
 * (which made the model imitate the wrong voice) and each thread keeps its colour.
 *
 * Only one question is in flight at a time, across all threads.
 */
export function useChat(options: { betaKey: string | null; onUnauthorized: () => void }) {
  const [threads, setThreads] = useState<Threads>(initialThreads);
  const [pendingGM, setPendingGM] = useState<GMName | null>(null);

  // Refs keep `send` stable and let it read the latest state synchronously.
  const threadsRef = useRef(threads);
  const pendingRef = useRef<GMName | null>(null);
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const update = useCallback((gm: GMName, change: (messages: ChatMessage[]) => ChatMessage[]) => {
    const next = { ...threadsRef.current, [gm]: change(threadsRef.current[gm]) };
    threadsRef.current = next;
    setThreads(next);
  }, []);

  const send = useCallback(
    async (gm: GMName, question: string, context: SendContext): Promise<void> => {
      const text = question.trim();
      if (!text || pendingRef.current) return;
      pendingRef.current = gm;
      setPendingGM(gm);

      const base = { fen: context.fen, ply: context.ply, scope: context.scope };
      const conversationHistory = buildHistory(threadsRef.current[gm], context.ply, context.scope);
      update(gm, (messages) => [...messages, { id: nextId(), role: "user", text, ...base }]);

      try {
        const reply = await askGM(
          {
            selectedGM: gm,
            currentFen: context.fen,
            question: `${context.contextPrefix ?? ""}${text}`,
            conversationHistory,
            moveHistory: context.moveHistory,
            topLines: context.topLines,
            openingName: context.openingName,
            moveReview: context.moveReview ?? null,
          },
          optionsRef.current.betaKey,
        );
        update(gm, (messages) => [
          ...messages,
          { id: nextId(), role: "gm", text: reply.response, followUps: reply.followUps, ...base },
        ]);
      } catch (error) {
        // The server rejected our access code (rotated or revoked): bring the gate back.
        if (error instanceof ApiError && error.status === 401) optionsRef.current.onUnauthorized();
        const message = error instanceof ApiError ? error.message : "Something went wrong. Please try again.";
        update(gm, (messages) => [
          ...messages,
          { id: nextId(), role: "gm", kind: "error", text: message, retry: text, ...base },
        ]);
      } finally {
        pendingRef.current = null;
        setPendingGM(null);
      }
    },
    [update],
  );

  /** Remove a failed message and ask the question again, for the position on screen now. */
  const retry = useCallback(
    (gm: GMName, messageId: string, context: SendContext) => {
      const failed = threadsRef.current[gm].find((m) => m.id === messageId);
      if (!failed?.retry) return;
      update(gm, (messages) => messages.filter((m) => m.id !== messageId));
      void send(gm, failed.retry, context);
    },
    [send, update],
  );

  /** Add a local announcement to a thread (not sent to the model). */
  const addNote = useCallback(
    (gm: GMName, text: string, position: { fen: string; ply: number; scope: string }) => {
      update(gm, (messages) => [...messages, { id: nextId(), role: "gm", kind: "note", text, ...position }]);
    },
    [update],
  );

  return { threads, pendingGM, send, retry, addNote };
}
