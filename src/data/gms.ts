/** The grandmasters you can talk to. The server has a matching persona for each name. */
export const GM_NAMES = ["Magnus", "Hikaru", "Bobby"] as const;
export type GMName = (typeof GM_NAMES)[number];

export interface GMProfile {
  name: GMName;
  fullName: string;
  initials: string;
  subtitle: string;
  /** CSS custom property holding the grandmaster's accent colour. */
  color: string;
  welcome: string;
}

export const GMS: Record<GMName, GMProfile> = {
  Magnus: {
    name: "Magnus",
    fullName: "Magnus Carlsen",
    initials: "MC",
    subtitle: "World Champion · Highest Elo in History",
    color: "var(--c-gm-magnus)",
    welcome: "Make a move, then ask me what I think. I'll tell you if it makes sense.",
  },
  Hikaru: {
    name: "Hikaru",
    fullName: "Hikaru Nakamura",
    initials: "HN",
    subtitle: "Super-GM · Speed Chess Legend",
    color: "var(--c-gm-hikaru)",
    welcome: "Alright, let's go. Make a move, ask me anything, and we'll figure it out together.",
  },
  Bobby: {
    name: "Bobby",
    fullName: "Bobby Fischer",
    initials: "BF",
    subtitle: "11th World Champion · The Purist",
    color: "var(--c-gm-bobby)",
    welcome: "Show me the position. Make your move, then ask me what you got wrong.",
  },
};

export const isGMName = (value: string): value is GMName => (GM_NAMES as readonly string[]).includes(value);
