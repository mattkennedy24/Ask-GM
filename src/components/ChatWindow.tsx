import { useState, useEffect, useRef } from "react";


type Message = { sender: string; text: string };

type ChatWindowProps = {
  messages: Message[];
  onSubmit: (question: string) => void;
  thinking?: boolean;
};

const ChatWindow = ({ messages, onSubmit, thinking }: ChatWindowProps) => {
  const [input, setInput] = useState("");

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (input.trim()) {
      onSubmit(input.trim());
      setInput("");
    }
  };

  return (
    <div className="flex flex-col border-4 border-zinc-600 rounded-xl p-4 bg-zinc-800 h-full min-h-0">
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-2">Chat with GM</h2>
      <div className="flex-1 overflow-y-auto min-h-0 mb-3 space-y-2 pr-1">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.sender === "You" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`px-3 py-2 rounded-lg max-w-[85%] text-sm leading-relaxed ${
                msg.sender === "You"
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-700 text-zinc-100"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {/* Thinking indicator */}
        {thinking && (
          <div className="flex justify-start">
            <div className="px-3 py-2 rounded-lg bg-zinc-700 text-zinc-400 text-sm animate-pulse">
              Thinking...
            </div>
          </div>
        )}
        {/* Bottom anchor for auto-scroll */}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2 mt-auto">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          className="flex-1 bg-zinc-900 text-white p-2 rounded-lg border border-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
          placeholder="Ask a question..."
        />
        <button onClick={handleSend} className="btn text-sm px-4">
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatWindow;
