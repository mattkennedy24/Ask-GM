import { useMemo, useState } from "react";
import { CATEGORIES, OPENINGS, type Opening } from "../data/openings";
import type { Lesson } from "../hooks/useLesson";
import { ChevronLeft, Search } from "./icons";

interface OpeningsPanelProps {
  lesson: Lesson;
  onSelect: (opening: Opening) => void;
}

/** Browse the opening library, or step through one opening as a lesson. */
export default function OpeningsPanel({ lesson, onSelect }: OpeningsPanelProps) {
  return lesson.opening ? <LessonView lesson={lesson} opening={lesson.opening} /> : <BrowseView onSelect={onSelect} />;
}

function BrowseView({ onSelect }: { onSelect: (opening: Opening) => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return OPENINGS.filter(
      (o) => (!category || o.category === category) && (!q || o.name.toLowerCase().includes(q) || o.eco.toLowerCase().includes(q)),
    );
  }, [query, category]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div>
        <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--f-serif)" }}>
          Opening lessons
        </h2>
        <p className="text-xs" style={{ color: "var(--c-text-muted)" }}>
          Pick an opening and step through it move by move, with coaching notes.
        </p>
      </div>

      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or ECO code"
          aria-label="Search openings"
          className="field !pl-9"
          style={{ minHeight: "2.5rem" }}
        />
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
        {[null, ...CATEGORIES].map((value) => (
          <button
            key={value ?? "all"}
            type="button"
            className={`chip ${category === value ? "chip-accent" : ""}`}
            aria-pressed={category === value}
            onClick={() => setCategory(value)}
          >
            {value ?? "All"}
          </button>
        ))}
      </div>

      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        {matches.map((opening) => {
          const variations = opening.variations?.length ?? 0;
          return (
            <li key={`${opening.eco}-${opening.name}`}>
              <button type="button" className="row-btn" onClick={() => onSelect(opening)}>
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{opening.name}</span>
                  <span className="shrink-0 text-xs" style={{ color: "var(--c-text-muted)", fontFamily: "var(--f-mono)" }}>
                    {opening.eco}
                  </span>
                </span>
                <span className="mt-0.5 flex items-center justify-between gap-2 text-xs" style={{ color: "var(--c-text-muted)" }}>
                  <span>{opening.category}</span>
                  {variations > 0 && (
                    <span style={{ color: "var(--c-gold)", fontFamily: "var(--f-mono)" }}>
                      {variations} variation{variations === 1 ? "" : "s"}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
        {matches.length === 0 && (
          <li className="py-6 text-center text-sm" style={{ color: "var(--c-text-muted)" }}>
            No openings match “{query}”.
          </li>
        )}
      </ul>
    </div>
  );
}

function LessonView({ lesson, opening }: { lesson: Lesson; opening: Opening }) {
  const { line, plies, index, variation } = lesson;
  const total = plies.length - 1;
  const variations = opening.variations ?? [];
  const description = variation >= 0 ? (variations[variation]?.description ?? opening.description) : opening.description;

  // Pair the line's SAN moves into numbered rows.
  const rows = useMemo(() => {
    const out: { number: number; white: string; black: string | null }[] = [];
    for (let i = 1; i < plies.length; i += 2) {
      out.push({ number: (i + 1) / 2, white: plies[i].san ?? "", black: plies[i + 1]?.san ?? null });
    }
    return out;
  }, [plies]);

  const stepButton = (san: string, plyIndex: number) => (
    <button
      type="button"
      onClick={() => lesson.navigate(plyIndex)}
      aria-current={index === plyIndex ? "true" : undefined}
      className="rounded border px-2 py-0.5 text-sm"
      style={{
        fontFamily: "var(--f-mono)",
        background: index === plyIndex ? "var(--c-gold-dim)" : "transparent",
        borderColor: index === plyIndex ? "var(--c-gold)" : "transparent",
        color: index === plyIndex ? "var(--c-gold-bright)" : "var(--c-text-soft)",
      }}
    >
      {san}
    </button>
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div className="flex shrink-0 items-center gap-2">
        <button type="button" className="btn" onClick={lesson.exit} aria-label="Back to all openings">
          <ChevronLeft size={16} /> All
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-xs" style={{ color: "var(--c-text-muted)", fontFamily: "var(--f-mono)" }}>
            {line && "eco" in line && line.eco ? line.eco : opening.eco}
          </div>
          <h2 className="truncate text-base font-semibold leading-tight" style={{ fontFamily: "var(--f-serif)" }}>
            {opening.name}
          </h2>
        </div>
        <span className="w-14 shrink-0 text-right text-xs tabular-nums" style={{ color: "var(--c-text-muted)", fontFamily: "var(--f-mono)" }}>
          {index}/{total}
        </span>
      </div>

      {variations.length > 0 && (
        <div className="flex shrink-0 gap-1.5 overflow-x-auto pb-0.5" role="group" aria-label="Variations" style={{ scrollbarWidth: "none" }}>
          {[-1, ...variations.keys()].map((value) => (
            <button
              key={value}
              type="button"
              className={`chip ${variation === value ? "chip-accent" : ""}`}
              aria-pressed={variation === value}
              onClick={() => lesson.selectVariation(value)}
            >
              {value === -1 ? "Main line" : variations[value].name}
            </button>
          ))}
        </div>
      )}

      <p className="shrink-0 text-xs leading-relaxed" style={{ color: "var(--c-text-soft)" }}>
        {description}
      </p>

      <ol className="min-h-0 flex-1 overflow-y-auto" aria-label="Moves">
        {rows.map((row) => (
          <li key={row.number} className="flex items-center gap-1 py-px">
            <span className="w-7 shrink-0 text-right text-xs tabular-nums" style={{ color: "var(--c-text-muted)", fontFamily: "var(--f-mono)" }}>
              {row.number}.
            </span>
            {stepButton(row.white, row.number * 2 - 1)}
            {row.black !== null && stepButton(row.black, row.number * 2)}
          </li>
        ))}
      </ol>
    </div>
  );
}
