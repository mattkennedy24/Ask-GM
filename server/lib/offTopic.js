/**
 * A cheap, deterministic first line of defence for the two things that should
 * never reach the model: requests for code and attempts to override the persona.
 *
 * Everything subtler (weather, recipes, "tell me a joke") is left to the
 * persona prompts, which also tell each grandmaster to dismiss off-topic
 * questions in character. The patterns here are deliberately narrow — a
 * false positive blocks a real chess question, which is far worse than letting
 * one off-topic message through to the model.
 */

const LANGUAGES = "python|javascript|typescript|java|c\\+\\+|c#|golang|php|sql|html|css|bash|powershell|regex|kotlin";

const CODE_REQUEST = new RegExp(
  `\\b(?:write|generate|create|make|build|code|debug|fix|refactor|implement|translate|convert)\\b[^\\n]{0,60}(?<![\\w])(?:${LANGUAGES})(?![\\w])`,
  "i",
);

const IN_LANGUAGE = new RegExp(`\\b(?:in|using|with)\\s+(?:${LANGUAGES})\\s+(?:code|script|program|function)\\b`, "i");

const INJECTION = [
  /\b(?:ignore|disregard|forget|override|bypass)\b[^.\n]{0,40}\b(?:instructions?|prompts?|rules?|guidelines?|programming)\b/i,
  /\b(?:reveal|show|print|repeat|display|leak|output)\b[^.\n]{0,30}\b(?:system prompt|your (?:instructions|prompt|rules)|initial prompt|hidden prompt)\b/i,
  /\b(?:jailbreak|dan mode|developer mode|you are now|from now on you are)\b/i,
  /^\s*(?:system|assistant|developer)\s*:/im,
  /<\/?(?:system|instructions?)>/i,
];

/** @returns {"code" | "injection" | null} */
export function detectOffTopic(question) {
  const q = String(question ?? "");
  if (CODE_REQUEST.test(q) || IN_LANGUAGE.test(q)) return "code";
  if (INJECTION.some((re) => re.test(q))) return "injection";
  return null;
}

const DISMISSALS = {
  Magnus: [
    "Quite honestly, you are wasting my time. Let's talk chess, bozo.",
    "I have beaten the best players in the world. I will not be debugging your code. Show me a position.",
    "That is not chess. I am going to pretend you did not ask, and you are going to make a move.",
    "I only have opinions about chess. Make a move.",
    "Interesting. Unfortunately it has no knights, no bishops, and no point. Chess, please.",
  ],
  Hikaru: [
    "Chat, he really just asked me that. Bro, I'm a chess player. Make a move.",
    "Nah nah nah, I'm not your search engine. Show me a position and let's go.",
    "No shot I'm answering that. Chess only, let's go.",
    "That's a timeout. Chess questions only, my guy.",
    "Bro what? That's not even close to chess. Play a move so I can cook.",
  ],
  Bobby: [
    "You are wasting my time. Chess is the only thing worth discussing. Show me the board.",
    "I did not give my life to this game to answer questions like that. Make a move.",
    "That is irrelevant. Chess is the only subject; everything else is noise. Your move.",
    "I do not suffer fools, and I do not answer questions that are not about chess.",
    "Absurd. Ask me about chess or leave me to my analysis.",
  ],
};

const FALLBACK = "That's not a chess question. Make a move and ask me about the position.";

/** An in-character brush-off for the given grandmaster. `random` is injectable for tests. */
export function pickDismissal(gmName, random = Math.random) {
  const options = Object.hasOwn(DISMISSALS, gmName) ? DISMISSALS[gmName] : [FALLBACK];
  return options[Math.floor(random() * options.length)];
}

/** Chips shown after a dismissal so the conversation has an obvious way back to chess. */
export const REDIRECT_FOLLOW_UPS = [
  "What's the best move here?",
  "Explain the plan for me",
  "What did I do wrong?",
];
