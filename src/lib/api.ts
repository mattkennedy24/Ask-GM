import type { EngineLine } from "../engine/uci";
import type { MoveVerdict } from "./moveReview";
import type { ReviewedMove } from "./reviewSummary";

/** A failed API call, carrying the HTTP status (0 = never reached the server) and the server's error code. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

const CHAT_TIMEOUT_MS = 60_000;

async function parseError(response: Response): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => null);
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const message = typeof record.error === "string" ? record.error : `Request failed (${response.status}).`;
  const code = typeof record.code === "string" ? record.code : undefined;
  return new ApiError(message, response.status, code);
}

async function send(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(path, init);
  } catch (error) {
    if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new ApiError("The grandmaster took too long to answer. Please try again.", 0, "TIMEOUT");
    }
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0, "NETWORK");
  }
}

/** Whether the server wants an access code. */
export async function getAuthStatus(signal?: AbortSignal): Promise<{ betaRequired: boolean }> {
  const response = await send("/api/auth/status", { signal });
  if (!response.ok) throw await parseError(response);
  const body = (await response.json()) as { betaRequired?: unknown };
  return { betaRequired: body.betaRequired === true };
}

/** Resolves if `key` is accepted; throws an {@link ApiError} (401 = wrong code, 429 = too many tries) otherwise. */
export async function verifyBetaKey(key: string): Promise<void> {
  const response = await send("/api/auth/verify", { method: "POST", headers: { "X-Beta-Key": key.trim() } });
  if (!response.ok) throw await parseError(response);
}

export interface ChatRequest {
  selectedGM: string;
  currentFen: string;
  question: string;
  conversationHistory: { role: "user" | "assistant"; content: string }[];
  moveHistory: string[];
  topLines: EngineLine[];
  openingName?: string;
  /** The engine's verdict on the move just played; the server re-checks it against the move list. */
  moveReview?: MoveVerdict | null;
  /** The costliest mistakes of the game so far, as judged by the engine; the server re-checks them against the move list. */
  gameReview?: ReviewedMove[];
}

export interface ChatResponse {
  response: string;
  followUps: string[];
  offTopic?: boolean;
}

export async function askGM(request: ChatRequest, betaKey: string | null): Promise<ChatResponse> {
  const response = await send("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(betaKey ? { "X-Beta-Key": betaKey } : {}) },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout?.(CHAT_TIMEOUT_MS),
  });
  if (!response.ok) throw await parseError(response);

  const body = (await response.json()) as { response?: unknown; followUps?: unknown; offTopic?: unknown };
  if (typeof body.response !== "string" || body.response.trim() === "") {
    throw new ApiError("The grandmaster sent an empty reply. Please try again.", 502);
  }
  return {
    response: body.response,
    followUps: Array.isArray(body.followUps) ? body.followUps.filter((f): f is string => typeof f === "string") : [],
    offTopic: body.offTopic === true,
  };
}
