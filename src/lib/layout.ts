/**
 * Which layout is active: the two-column "desktop" layout (board beside the chat) or the
 * single-column phone layout with a bottom navigation bar.
 *
 * Wide windows get the desktop layout, and so do phones turned sideways: a portrait-shaped
 * board would be taller than the screen. The same condition is declared for CSS as the `desk`
 * and `handheld` variants in index.css — keep the two in step.
 */
export const DESKTOP_QUERY = "(min-width: 1024px), (orientation: landscape) and (min-width: 700px)";
