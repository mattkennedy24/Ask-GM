import { useMemo, useState } from "react";
import { CATEGORIES, OPENINGS, type Opening } from "../data/openings";
import type { Lesson } from "../hooks/useLesson";
import { ChevronLeft, Search } from "./icons";

interface OpeningsPanelProps {
  lesson: Lesson;
  onSelect: (opening: Opening) => void;
  /** Show the note for the current move here (on a laptop); on a phone it sits under the board instead. */
  showNote: boolean;
}

/** Browse the opening library, or step through one opening as a lesson. */
export default function OpeningsPanel({ lesson, onSelect, showNote }: OpeningsPanelProps) {
  return lesson.opening ? <LessonView lesson={lesson} opening={lesson.opening} showNote={showNote} /> : <BrowseView onSelect={onSelect} />;
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
    <div className="learn">
      <header className="learn-head">
        <h2 className="type-title">Opening lessons</h2>
        <p className="type-small muted">Pick an opening and step through it move by move, with coaching notes.</p>
      </header>

      <div className="search">
        <Search size={18} className="search-icon" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or ECO code"
          aria-label="Search openings"
          className="field search-field"
        />
      </div>

      <div className="chips" role="group" aria-label="Filter by category">
        {[null, ...CATEGORIES].map((value) => (
          <button key={value ?? "all"} type="button" className="chip" aria-pressed={category === value} onClick={() => setCategory(value)}>
            {value ?? "All"}
          </button>
        ))}
      </div>

      <ul className="lesson-list">
        {matches.map((opening) => {
          const variations = opening.variations?.length ?? 0;
          return (
            <li key={`${opening.eco}-${opening.name}`}>
              <button type="button" className="row" onClick={() => onSelect(opening)}>
                <span className="row-main">
                  <span className="type-ui">{opening.name}</span>
                  <span className="type-small num muted">{opening.eco}</span>
                </span>
                <span className="row-sub type-small muted">
                  <span>{opening.category}</span>
                  {variations > 0 && (
                    <span>
                      {variations} variation{variations === 1 ? "" : "s"}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
        {matches.length === 0 && <li className="type-small muted lesson-empty">No openings match \u201c{query}\u201d.</li>}
      </ul>
    </div>
  );
}

function LessonView({ lesson, opening, showNote }: { lesson: Lesson; opening: Opening; showNote: boolean }) {
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
    <button type="button" onClick={() => lesson.navigate(plyIndex)} aria-current={index === plyIndex ? "true" : undefined} className="move-chip num">
      {san}
    </button>
  );

  return (
    <div className="learn">
      <div className="lesson-bar">
        <button type="button" className="btn" onClick={lesson.exit} aria-label="Back to all openings">
          <ChevronLeft size={18} /> All
        </button>
        <div className="lesson-title">
          <p className="type-label muted num">{line && "eco" in line && line.eco ? line.eco : opening.eco}</p>
          <h2 className="type-title">{opening.name}</h2>
        </div>
        <p className="type-small num muted lesson-count">
          {index}/{total}
        </p>
      </div>

      {variations.length > 0 && (
        <div className="chips chips-scroll" role="group" aria-label="Variations">
          {[-1, ...variations.keys()].map((value) => (
            <button key={value} type="button" className="chip" aria-pressed={variation === value} onClick={() => lesson.selectVariation(value)}>
              {value === -1 ? "Main line" : variations[value].name}
            </button>
          ))}
        </div>
      )}

      <p className="type-body soft lesson-description">{description}</p>

      {showNote && (
        <p className="lesson-note type-lead" role="status">
          {lesson.annotation ?? (index === 0 ? "Step through the moves to see coaching notes." : "No note for this move.")}
        </p>
      )}

      <ol className="lesson-moves" aria-label="Moves">
        {rows.map((row) => (
          <li key={row.number}>
            <span className="move-number type-small num muted" aria-hidden="true">
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
