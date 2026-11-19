# Ask GM — brag plan

**What it is:** a chess coach. You play on a board, Stockfish judges every move in your browser, and you ask an AI grandmaster *why*.
**For:** improving players who know a move was bad but not why.
**What sets it apart:** answers are grounded in the engine's actual lines and the server's computed facts, so the coach can't invent moves; every move is judged (best → blunder).
**Visual hook:** a "brilliant" bishop sacrifice that the app immediately stamps **Blunder ??**.
**Real flow shown:** 1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.Bxf7+?? → verdict → ask "Why was Bxf7+ a blunder?" → answer with the clickable move d3 → Stockfish lines.
**Tone:** polished: paper-and-ink newspaper look, long holds, soft fades through the paper.
**Share caption:** "It looked brilliant. Ask GM said blunder, then told me why."

## Notes for the video
- **Persona names hidden (per the owner).** Real players' names are swapped for "AI Grandmaster" / "Ask a GM" in the live DOM before each capture. The persona picker row is hidden.
- **Scripted coach reply.** It comes from a local stand-in API, so no API key or real call is needed. Its advice (d3, then castle) matches what the engine shows on screen (4.d3 preferred; 5.d3 is the top line).
- All other UI is real: production build, real Stockfish and the real move verdict, captured at 400×760 CSS px, 2×.

## Identity
Paper `#faf8f2`, ink `#1a1915`, rule `#d9d4c5`, marker yellow `#ffd90f`, engine blue `#2f78c4`, danger red `#b8372a`. Newsreader (serif, voice and headlines) + Libre Franklin (labels). Flat: no shadows or gradients.

## Music
96 BPM (beat 0.625 s), D major, D–Bm–G–A. Soft keys, round bass, a felt kick from scene 3, brushed hats; the effects are pitched to the key and sit on the grid.

## Storyboard (1080×1920, 30 fps, 22.5 s = 36 beats)
| # | Beats | Time | On screen | Sound |
|---|---|---|---|---|
| 1 Hook | 0–6 | 0–3.75 | Serif headline "It looked brilliant." Real board (Italian Game); on beat 1 the bishop takes f7 (check). On beat 2 the real verdict strip rises: "?? Blunder. 4.Bxf7+ gave up about 1.8 pawns." | Keys enter; wood tick on beat 1; low D on beat 2 |
| 2 Reveal | 6–11 | 3.75–6.875 | Dip through paper. Wordmark **Ask *GM***, rule, "Ask an AI grandmaster why." | Bell motif; bass enters |
| 3 Ask | 11–25 | 6.875–15.625 | "Ask why. Get a straight answer." Real chat: the question is typed (beats 12–15) and sent (beat 15); the answer lands on beat 16 with **d3** marked; held 5.6 s | Kick and hats; soft send tick; chime on the answer |
| 4 Grounded | 25–31 | 15.625–19.375 | "Grounded in Stockfish, live in your browser." The move list with Bxf7+?? in red, then the three real engine lines, one per beat | A soft tick per line |
| 5 Outro | 31–36 | 19.375–22.5 | Ask *GM* / "Chess coaching from AI grandmasters." / PRIVATE BETA | Final D chord, fades out |
