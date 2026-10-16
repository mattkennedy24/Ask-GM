import { buildSystemPrompt } from "./prompt.js";
import { lengthHintFor } from "./classify.js";
import { collectAllowedMoveKeys, findIllegalMoveMentions } from "./moveValidation.js";
import { parseFollowUps } from "./followUps.js";
import { toPlainText } from "./plainText.js";
import { detectOffTopic, pickDismissal, REDIRECT_FOLLOW_UPS } from "./offTopic.js";

/** The model returned nothing usable (no text block, or only a follow-ups line). */
export class EmptyResponseError extends Error {
  constructor() {
    super("The model returned no text.");
    this.name = "EmptyResponseError";
  }
}

/**
 * The coaching pipeline for one question:
 *
 *   deterministic off-topic guard → prompt → model → plain text + follow-ups
 *   → move check (one corrective retry) → reply
 *
 * `anthropic` is anything with `messages.create`, so tests can inject a fake.
 */
export function createCoach({ anthropic, model, personalities, maxTokens = 700, logger = console, random = Math.random }) {
  const isKnownGM = (name) => Object.hasOwn(personalities, name);

  async function complete(system, messages) {
    const response = await anthropic.messages.create({ model, max_tokens: maxTokens, system, messages });
    const block = response.content?.find((part) => part.type === "text" && part.text?.trim());
    if (!block) throw new EmptyResponseError();
    return parseFollowUps(block.text, { truncated: response.stop_reason === "max_tokens" });
  }

  /**
   * @param {object} input already validated by validateChatPayload
   * @returns {Promise<{ response: string, followUps: string[], offTopic?: boolean }>}
   */
  async function ask({ selectedGM, fen, question, history, moveHistory, topLines, openingName }) {
    if (detectOffTopic(question)) {
      return { response: pickDismissal(selectedGM, random), followUps: REDIRECT_FOLLOW_UPS, offTopic: true };
    }

    const system = buildSystemPrompt({
      gm: personalities[selectedGM],
      fen,
      moveHistory,
      topLines,
      openingName,
      lengthHint: lengthHintFor(question),
    });
    const messages = [...history, { role: "user", content: question }];

    const first = await complete(system, messages);
    const firstText = toPlainText(first.text);
    if (!firstText) throw new EmptyResponseError();

    const allowed = collectAllowedMoveKeys({ fen, topLines, moveHistory });
    const firstIllegal = findIllegalMoveMentions(firstText, allowed);
    if (firstIllegal.length === 0) return { response: firstText, followUps: first.followUps };

    // The reply names a move that is playable nowhere in the analysis. Ask once for a correction.
    logger.warn?.(`[coach] unverifiable move(s) in reply: ${firstIllegal.join(", ")} — retrying once`);
    try {
      const second = await complete(system, [
        ...messages,
        { role: "assistant", content: firstText },
        {
          role: "user",
          content:
            `Your reply mentioned ${firstIllegal.join(", ")}, which is not a legal move here and is not in the engine lines. ` +
            "Answer again in the same voice using only moves from the engine lines, or no specific move if none fits. " +
            "Keep the plain-text format and the final FOLLOWUPS line.",
        },
      ]);
      const secondText = toPlainText(second.text);
      if (secondText && findIllegalMoveMentions(secondText, allowed).length <= firstIllegal.length) {
        return { response: secondText, followUps: second.followUps.length ? second.followUps : first.followUps };
      }
    } catch (error) {
      logger.warn?.(`[coach] correction retry failed, keeping the first reply: ${error.message}`);
    }
    return { response: firstText, followUps: first.followUps };
  }

  return { ask, isKnownGM };
}
