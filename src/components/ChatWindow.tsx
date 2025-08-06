import React, { useState, useEffect, useRef } from "react";


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
    <div className="flex flex-col border-4 border-gray-600 rounded-xl p-4 bg-gray-800 h-full">
      <div className="flex-1 overflow-y-auto mb-4 space-y-2">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`px-3 py-2 rounded max-w-[90%] ${msg.sender === "You" ? "bg-blue-700 self-end text-right" : "bg-gray-700 self-start"
              }`}
          >
            <span className="block text-sm">{msg.text}</span>
          </div>
        ))}
        {/* Bottom reference so that we can auto-scroll to bottom */}
        <div ref={bottomRef} />
        {/* Thinking indicator */}
        {thinking && (
          <div className="px-3 py-2 rounded max-w-[90%] bg-gray-700 self-start animate-pulse text-sm text-gray-300">
            Thinking...
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          className="flex-1 bg-gray-700 text-white p-2 rounded"
          placeholder="Ask a question..."
        />
        <button onClick={handleSend} className="btn">
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatWindow;
