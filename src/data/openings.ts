export interface Opening {
  eco: string;
  name: string;
  /** Moves in UCI format */
  moves: string[];
  description: string;
  category: "e4 Openings" | "d4 Openings" | "Flank Openings";
}

export const OPENINGS: Opening[] = [
  // ── e4 Openings ─────────────────────────────────────────────────
  {
    eco: "C50",
    name: "Italian Game",
    moves: ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4"],
    description:
      "One of the oldest openings, aiming to control the center and quickly develop pieces to attack the f7 pawn. White builds a classical center and develops naturally.",
    category: "e4 Openings",
  },
  {
    eco: "C51",
    name: "Evans Gambit",
    moves: ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "f8c5", "b2b4"],
    description:
      "An aggressive offshoot of the Italian Game. White sacrifices the b-pawn to gain a strong center and attacking chances. Loved by Kasparov for its sharp, tactical play.",
    category: "e4 Openings",
  },
  {
    eco: "C60",
    name: "Ruy Lopez (Spanish)",
    moves: ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5"],
    description:
      "One of the most respected openings in chess. White pins the knight to pressure e5 and eventually look for the bishop pair advantage. Leads to rich strategic battles.",
    category: "e4 Openings",
  },
  {
    eco: "C67",
    name: "Berlin Defense",
    moves: ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "g8f6", "e1g1", "f6e4", "d1e2"],
    description:
      "The Berlin is an extremely solid defense against the Ruy Lopez, leading to endgames that black can hold. Popularized by Vladimir Kramnik who used it to defeat Kasparov in 2000.",
    category: "e4 Openings",
  },
  {
    eco: "B20",
    name: "Sicilian Defense",
    moves: ["e2e4", "c7c5"],
    description:
      "The most popular response to 1.e4. Black fights for the center asymmetrically and aims for a complex, unbalanced game where both sides have chances. Extremely rich and varied.",
    category: "e4 Openings",
  },
  {
    eco: "B23",
    name: "Sicilian: Grand Prix Attack",
    moves: ["e2e4", "c7c5", "b1c3", "b8c6", "f2f4"],
    description:
      "White builds a powerful kingside attack with f4, aiming to overwhelm Black before the Sicilian's counterplay kicks in. Popular at club level for its attacking nature.",
    category: "e4 Openings",
  },
  {
    eco: "B60",
    name: "Sicilian: Najdorf",
    moves: ["e2e4", "c7c5", "g1f3", "d7d6", "d2d4", "c5d4", "f3d4", "g8f6", "b1c3", "a7a6"],
    description:
      "The most ambitious Sicilian system, popularized by Miguel Najdorf and played by Fischer, Kasparov, and Carlsen. Black prepares queenside counterplay while keeping options open.",
    category: "e4 Openings",
  },
  {
    eco: "B70",
    name: "Sicilian: Dragon",
    moves: ["e2e4", "c7c5", "g1f3", "d7d6", "d2d4", "c5d4", "f3d4", "g8f6", "b1c3", "g7g6"],
    description:
      "Black fianchettos the bishop on g7 creating a powerful diagonal. The Yugoslav Attack (Bc4, f3, Be3) leads to sharp battles where both sides race on opposite wings.",
    category: "e4 Openings",
  },
  {
    eco: "C00",
    name: "French Defense",
    moves: ["e2e4", "e7e6"],
    description:
      "A solid, strategic defense. Black allows White a space advantage in exchange for a very solid position. Black typically counterattacks in the center with ...d5 and ...c5.",
    category: "e4 Openings",
  },
  {
    eco: "C11",
    name: "French: Classical",
    moves: ["e2e4", "e7e6", "d2d4", "d7d5", "b1c3", "g8f6"],
    description:
      "Black develops the knight to f6 to pressure the e4 pawn. This leads to rich strategic battles around the locked center with White's space advantage balanced by Black's solid structure.",
    category: "e4 Openings",
  },
  {
    eco: "B10",
    name: "Caro-Kann Defense",
    moves: ["e2e4", "c7c6"],
    description:
      "A solid, principled defense that avoids the doubled pawn weakness of the French. Black prepares ...d5 with c6 and aims for a good endgame thanks to the unobstructed light-square bishop.",
    category: "e4 Openings",
  },
  {
    eco: "B12",
    name: "Caro-Kann: Advance",
    moves: ["e2e4", "c7c6", "d2d4", "d7d5", "e4e5"],
    description:
      "White gains space in the center with e5. Black typically counterattacks with ...c5 and ...Bf5. Leads to strategic positions with clear plans for both sides.",
    category: "e4 Openings",
  },
  {
    eco: "B01",
    name: "Scandinavian Defense",
    moves: ["e2e4", "d7d5"],
    description:
      "Black immediately challenges White's center. After exd5, ...Qxd5 or ...Nf6 follows. A reliable opening where Black gets quick development at the cost of tempo.",
    category: "e4 Openings",
  },
  {
    eco: "C30",
    name: "King's Gambit",
    moves: ["e2e4", "e7e5", "f2f4"],
    description:
      "One of the oldest and most romantic gambits. White sacrifices the f-pawn to open the f-file and build a massive center. Leads to sharp, unbalanced positions loved by attacking players.",
    category: "e4 Openings",
  },
  {
    eco: "C33",
    name: "King's Gambit Accepted",
    moves: ["e2e4", "e7e5", "f2f4", "e5f4", "f1c4"],
    description:
      "Black accepts the gambit pawn. White develops with Bc4 aiming for a powerful attack. This leads to the sharp positions Morphy and Fischer loved to play.",
    category: "e4 Openings",
  },
  {
    eco: "C40",
    name: "Petroff Defense",
    moves: ["e2e4", "e7e5", "g1f3", "g8f6"],
    description:
      "Ultra-solid but sometimes considered drawish at the top level. Black mirrors White's development and aims for symmetrical positions. Favorite of players who want a safe, equal game.",
    category: "e4 Openings",
  },
  {
    eco: "B07",
    name: "Pirc Defense",
    moves: ["e2e4", "d7d6", "d2d4", "g8f6", "b1c3", "g7g6"],
    description:
      "A hypermodern defense where Black allows White to build a large center then attacks it from the flanks. The fianchettoed bishop on g7 is Black's main weapon.",
    category: "e4 Openings",
  },

  // ── d4 Openings ─────────────────────────────────────────────────
  {
    eco: "D30",
    name: "Queen's Gambit Declined",
    moves: ["d2d4", "d7d5", "c2c4", "e7e6"],
    description:
      "Black declines the gambit pawn and maintains a solid pawn structure. One of the most classical openings, leading to rich strategic battles. The backbone of classical opening theory.",
    category: "d4 Openings",
  },
  {
    eco: "D20",
    name: "Queen's Gambit Accepted",
    moves: ["d2d4", "d7d5", "c2c4", "d5c4"],
    description:
      "Black accepts the pawn and must deal with White's pressure. By capturing, Black gives up the center temporarily but gets free development. Can transpose into sharp or solid lines.",
    category: "d4 Openings",
  },
  {
    eco: "D37",
    name: "QGD: Vienna Variation",
    moves: ["d2d4", "d7d5", "c2c4", "e7e6", "b1c3", "g8f6", "g1f3", "d5c4"],
    description:
      "Black takes the gambit pawn on move 4, hoping to keep it. White gets active piece play in compensation. A modern, ambitious way to play the QGD.",
    category: "d4 Openings",
  },
  {
    eco: "E60",
    name: "King's Indian Defense",
    moves: ["d2d4", "g8f6", "c2c4", "g7g6", "b1c3", "f8g7", "e2e4", "d7d6", "g1f3", "e8g8"],
    description:
      "A hyper-modern defense where Black allows White to build a large center then launches a fierce kingside attack. Favorites of Fischer, Kasparov, and many attacking players.",
    category: "d4 Openings",
  },
  {
    eco: "E20",
    name: "Nimzo-Indian Defense",
    moves: ["d2d4", "g8f6", "c2c4", "e7e6", "b1c3", "f8b4"],
    description:
      "Black pins the knight and pressures e4, preventing White from establishing a free pawn center. A strategically rich opening characterized by a fight for the dark squares.",
    category: "d4 Openings",
  },
  {
    eco: "E15",
    name: "Queen's Indian Defense",
    moves: ["d2d4", "g8f6", "c2c4", "e7e6", "g1f3", "b7b6"],
    description:
      "Black fianchettos on the queenside to control e4. A solid, hypermodern approach that avoids the Nimzo by not playing ...Bb4. Leads to subtle strategic battles.",
    category: "d4 Openings",
  },
  {
    eco: "D70",
    name: "Grünfeld Defense",
    moves: ["d2d4", "g8f6", "c2c4", "g7g6", "b1c3", "d7d5"],
    description:
      "Black allows White to build a large center then attacks it with pieces. White gets the powerful center pawn mass; Black targets it with ...c5, ...Bg7, and counterplay. Loved by Fischer and Kasparov.",
    category: "d4 Openings",
  },
  {
    eco: "D10",
    name: "Slav Defense",
    moves: ["d2d4", "d7d5", "c2c4", "c7c6"],
    description:
      "A solid defense that supports d5 without blocking the light-squared bishop. One of the most reliable defenses against the Queen's Gambit, favored at all levels.",
    category: "d4 Openings",
  },
  {
    eco: "D43",
    name: "Semi-Slav Defense",
    moves: ["d2d4", "d7d5", "c2c4", "c7c6", "b1c3", "g8f6", "g1f3", "e7e6"],
    description:
      "Black combines the Slav and QGD setups. Leads to extremely sharp positions in the Botvinnik and Moscow variations. One of the most deeply analyzed openings in chess.",
    category: "d4 Openings",
  },
  {
    eco: "A80",
    name: "Dutch Defense",
    moves: ["d2d4", "f7f5"],
    description:
      "Black fights for e4 at the cost of slightly weakening the kingside. Leads to three main systems: Classical (Stonewall), Leningrad (fianchetto), and Classical. Popular with attacking players.",
    category: "d4 Openings",
  },

  // ── Flank Openings ──────────────────────────────────────────────
  {
    eco: "A10",
    name: "English Opening",
    moves: ["c2c4"],
    description:
      "White controls d5 from the flank and delays committing the center pawns. Often transposes into 1.d4 structures. A flexible, solid choice favored by Karpov and Carlsen.",
    category: "Flank Openings",
  },
  {
    eco: "A20",
    name: "English: King's English",
    moves: ["c2c4", "e7e5"],
    description:
      "Black grabs the center immediately. White typically responds with Nc3 and g3, building a kingside fianchetto setup. Leads to rich positional battles on both wings.",
    category: "Flank Openings",
  },
  {
    eco: "A04",
    name: "Réti Opening",
    moves: ["g1f3"],
    description:
      "A hypermodern approach: White develops the knight and fianchettos to control the center from a distance. Highly flexible and can transpose into many different structures.",
    category: "Flank Openings",
  },
  {
    eco: "A07",
    name: "King's Indian Attack",
    moves: ["g1f3", "d7d5", "g2g3", "g8f6", "f1g2", "e7e6", "e1g1"],
    description:
      "White adopts the King's Indian setup as White: Nf3, g3, Bg2, castled. A flexible system that can be used against many Black setups. Fischer used it with great success against the French and Sicilian.",
    category: "Flank Openings",
  },
  {
    eco: "A00",
    name: "Bird's Opening",
    moves: ["f2f4"],
    description:
      "White advances the f-pawn to control e5 from the start. Leads to the From's Gambit (1...e5) or other unusual positions. A fighting choice that avoids the main lines.",
    category: "Flank Openings",
  },
  {
    eco: "A00",
    name: "Larsen's Opening",
    moves: ["b2b3"],
    description:
      "Bent Larsen's favorite: White prepares to fianchetto the queen's bishop on b2, where it controls the long diagonal. Highly creative and unpredictable, ideal for players who like original positions.",
    category: "Flank Openings",
  },
];

export const CATEGORIES = ["e4 Openings", "d4 Openings", "Flank Openings"] as const;
export type Category = typeof CATEGORIES[number];
