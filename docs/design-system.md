# Ask GM design system

The look of the app in one page, and the reasoning behind it. The rules here are not advice: `src/styles/design-system.test.ts` reads the source and fails the build when a component steps outside them.

## The idea

Ask GM is set like a page of a newspaper's games section: warm paper, black ink, one serif for what a person says, one sans for what you press, thin rules instead of boxes, and almost no colour. The board is the only thing that is allowed to be big. Colour is used for *meaning* and never for decoration:

| Colour | Means | Where |
| --- | --- | --- |
| Yellow (`--color-marker`) | **where we are** | the last move, the selected piece, the current move in a list, the move a coach suggests |
| Blue (`--color-engine`) | **what the engine suggests** | the engine's arrow, a selected engine line |
| Red (`--color-danger`) | **danger** | check, a blunder, an error |
| Ink | **action** | primary buttons, the toast, strong rules |

Each grandmaster has a printing ink of their own (`--color-magnus`, `--color-hikaru`, `--color-bobby`). Only the active one is ever on screen, as a rule beside their words and a ring around their monogram.

There is deliberately no dark theme, no gradients, no shadows, no glows, no blur and no emoji. Depth comes from rules (borders) and a second paper tone.

## Tokens

All tokens live in `src/styles/tokens.css`. Tailwind's default palette, type scale, shadows and weights are switched off there, so an off-system utility simply does not exist.

- **Paper:** `paper` (the page), `paper-2` (tiles, your own messages, hover), `paper-3` (pressed, tracks), `surface` (fields, dialogs).
- **Ink:** `ink`, `ink-2` (secondary text), `ink-3` (captions, 4.5:1 on paper and paper-2 only), `rule` (hairlines).
- **Shape:** a tile (8px), a small chip (4px) and a pill. Nothing else.
- **Motion:** `--dur-fast` 90ms, `--dur-base` 160ms, `--dur-slow` 260ms; `--ease-out` for everything, `--ease-spring` for things that pop. Everything is switched off for `prefers-reduced-motion`.
- **Board:** `--board-light`, `--board-dark` and three overlays. `src/lib/boardTheme.ts` mirrors them for the board library, and a test keeps the two in step.

## Typography

Two typefaces, both self-hosted variable fonts (no third-party requests):

- **Newsreader**, a news serif: the voice of the coaches, headlines, and numbers that deserve attention (the evaluation).
- **Libre Franklin**, a Franklin Gothic: everything you press, scan or read as interface.

Seven sizes, each with a named role. Use the role, never a size:

| Role | Size | Face | Used for |
| --- | --- | --- | --- |
| `type-display` | 32px | serif 700 | dialog titles, the result headline |
| `type-title` | 22px | serif 600 | panel titles, names, the evaluation |
| `type-lead` | 18px | serif 400 | what a coach says, lesson notes |
| `type-body` | 16px | sans 400 | what you type and read in the interface |
| `type-ui` | 14px | sans 600 | buttons, tabs, chips |
| `type-small` | 14px | sans 400 | secondary text |
| `type-label` | 12px | sans 700, capitals | section labels, the phone navigation |

Digits that must line up (scores, move numbers, counters) add `num` (tabular figures). A move inside a coach's sentence is set in the sans at 0.875em, because Franklin runs larger than the serif around it.

## Writing styles

- Put layout in Tailwind utilities (`flex`, `gap-3`, `desk:block`) and appearance in a named class in `src/styles/` (`.btn`, `.chip`, `.msg-gm`). A component does not carry fonts, colours or sizes in a `style` attribute: inline `style` is only for a CSS custom property that changes at runtime (`--share`, `--done`) or an animation delay.
- A new colour is a new token, and it needs a reason. A new size is almost certainly a mistake: use a role.
- Components never write `#hex`, `rgb()` or a stock palette class (`text-gray-500`).
- Keep the three layout queries in step. `DESKTOP_QUERY` in `src/lib/layout.ts`, the `desk` variant in `src/index.css`, and every raw `@media` in `src/styles/` must be the same string. (Raw queries are used inside the stylesheets because Tailwind's `@variant desk` keeps only the first condition of a query list when used inside a rule.)

## Layout

- **Laptop** (wide windows, and phones turned sideways): the board on the left, framed in ink and sized to the window height; the engine, the move list and the chat on the right, separated by a firm rule.
- **Phone:** the board runs edge to edge between two rules. A bottom bar switches between Board, Chat and Learn; inputs are 16px so iOS never zooms, safe areas are respected, targets are 44px.

## Contrast

`design-system.test.ts` computes the contrast of every text/background pair the interface uses: body text at 7:1 or better, captions and the coaches' inks at 4.5:1 or better.

## Attribution

Piece artwork (the board and the captured-piece figurines) is the "cburnett" set by Colin M. L. Burnett, CC BY-SA 3.0 (also GFDL and BSD), as shipped by react-chessboard. Fonts: Newsreader (Production Type) and Libre Franklin (Impallari Type, Rodrigo Fuenzalida, Nicolas Massi), both OFL-1.1.
