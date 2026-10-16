import type { ReactNode } from "react";
import { Board, Book, Message } from "./icons";

export type MobileDestination = "board" | "chat" | "learn";

interface BottomNavProps {
  active: MobileDestination;
  onChange: (destination: MobileDestination) => void;
  /** A grandmaster replied while another tab was showing. */
  chatUnread: boolean;
}

const ITEMS: { id: MobileDestination; label: string; icon: ReactNode }[] = [
  { id: "board", label: "Board", icon: <Board size={22} /> },
  { id: "chat", label: "Chat", icon: <Message size={22} /> },
  { id: "learn", label: "Learn", icon: <Book size={22} /> },
];

/** Thumb-reach navigation for phones; desktop shows everything at once and does not use it. */
export default function BottomNav({ active, onChange, chatUnread }: BottomNavProps) {
  return (
    <nav
      aria-label="Sections"
      className="flex shrink-0 desk:hidden"
      style={{
        background: "var(--c-surface)",
        borderTop: "1px solid var(--c-border)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {ITEMS.map(({ id, label, icon }) => (
        <button
          key={id}
          type="button"
          className="nav-item relative"
          aria-current={active === id ? "page" : undefined}
          onClick={() => onChange(id)}
        >
          {icon}
          <span>{label}</span>
          {id === "chat" && chatUnread && active !== "chat" && (
            <span
              aria-label="New reply"
              className="absolute right-[calc(50%-1.5rem)] top-2 h-2 w-2 rounded-full"
              style={{ background: "var(--gm)" }}
            />
          )}
        </button>
      ))}
    </nav>
  );
}
