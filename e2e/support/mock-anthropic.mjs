// A stand-in for the Anthropic Messages API, so the end-to-end tests never need a key or a network.
//
// What it replies is steered by markers in the LAST user message, so a test can reach a specific branch:
//   [[ILLEGAL]]  a move that is legal nowhere (Qh8) the first time, a clean answer after the correction
//   [[TRAILING]] a FOLLOWUPS line with trailing whitespace
//   [[TRUNC]]    stop_reason = max_tokens with a half-written FOLLOWUPS line
//   [[MARKDOWN]] a reply full of markdown (the server must strip it)
//   [[EMOJI]]    a reply with emoji (the server must strip them)
//   [[NOTEXT]]   no text block at all
//   [[OVERLOADED]] an overloaded-upstream error (HTTP 529) for the first three attempts (the SDK tries three
//                times before giving up), a clean answer after
//   anything else: a short, clean, in-character reply with three follow-ups
//
// Every request body is kept so tests can inspect the system prompt: GET /__requests, DELETE /__requests.
import http from "node:http";

const PORT = Number(process.env.MOCK_PORT || 3199);
const requests = [];
const illegalServedFor = new Set();
const failures = new Map();

const lastUserText = (messages) => {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== "user") continue;
    const content = messages[i].content;
    return typeof content === "string" ? content : content.map((block) => block.text ?? "").join("");
  }
  return "";
};

const message = (text, stop_reason = "end_turn") => ({
  id: "msg_mock",
  type: "message",
  role: "assistant",
  model: "mock",
  content: text === null ? [] : [{ type: "text", text }],
  stop_reason,
  stop_sequence: null,
  usage: { input_tokens: 100, output_tokens: 50 },
});

const send = (res, status, body) => {
  const json = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(json) });
  res.end(json);
};

const CLEAN =
  "This is quite natural. Develop with Nf3 and keep an eye on the center.\nFOLLOWUPS: Why Nf3 and not Nc3? | What is Black's best reply? | When should I castle?";

http
  .createServer((req, res) => {
    if (req.url === "/__health") return send(res, 200, { ok: true });
    if (req.url === "/__requests" && req.method === "GET") return send(res, 200, requests);
    if (req.url === "/__requests" && req.method === "DELETE") {
      requests.length = 0;
      illegalServedFor.clear();
      failures.clear();
      return send(res, 200, { ok: true });
    }
    if (req.method !== "POST" || !req.url?.startsWith("/v1/messages")) return send(res, 404, { error: "not found" });

    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const body = JSON.parse(raw);
      requests.push(body);
      const user = lastUserText(body.messages);

      if (user.includes("[[OVERLOADED]]") && (failures.get(user) ?? 0) < 3) {
        failures.set(user, (failures.get(user) ?? 0) + 1);
        return send(res, 529, { type: "error", error: { type: "overloaded_error", message: "Overloaded" } });
      }
      if (user.includes("[[NOTEXT]]")) return send(res, 200, message(null, "refusal"));
      if (user.includes("[[TRUNC]]")) return send(res, 200, message("Develop your knight to f3 and castle.\nFOLLOWUPS: Why castle early | What about the", "max_tokens"));
      if (user.includes("[[TRAILING]]")) return send(res, 200, message("Nf3 is natural here.\nFOLLOWUPS: Why Nf3? | What does Black do next? | Should I castle?\n  \n"));
      if (user.includes("[[MARKDOWN]]")) return send(res, 200, message("## Plan\n**Play Nf3** and then _castle_.\n- develop\n- castle\nFOLLOWUPS: A idea | B idea | C idea"));
      if (user.includes("[[EMOJI]]")) return send(res, 200, message("Great move \u{1F525} Develop with Nf3 \u{1F44D}\nFOLLOWUPS: Why Nf3? \u{1F914} | What next? | Castle when?"));
      if (user.includes("[[ILLEGAL]]") && !illegalServedFor.has(user)) {
        illegalServedFor.add(user);
        return send(res, 200, message("You should play Qh8 right away.\nFOLLOWUPS: A idea | B idea | C idea"));
      }
      return send(res, 200, message(CLEAN));
    });
  })
  .listen(PORT, "127.0.0.1", () => console.log(`mock anthropic listening on ${PORT}`));
