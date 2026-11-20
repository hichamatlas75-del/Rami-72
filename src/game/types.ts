export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

export type Rank =
  | 'A'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'V'
  | 'D'
  | 'R';

export interface Card {
  id: string;
  deckIndex: 0 | 1;
  isJoker: boolean;
  suit?: Suit;
  rank?: Rank;
}

export type PlayerCount = 2 | 3 | 4;

export type TotalRounds = 1 | 3 | 5;

export type Difficulty = 'detente' | 'salon' | 'maitre';

export type SortMode = 'suit' | 'rank' | 'manual';

export type GamePhase =
  | 'TITLE_MENU'
  | 'PLAYING'
  | 'ROUND_REVEAL'
  | 'ROUND_SUMMARY'
  | 'GAME_OVER';

export type TurnStep = 'DRAW' | 'PLAY_OR_DISCARD';

export type MeldType = 'run' | 'set';

export interface MeldSlot {
  card: Card;
  /** Effective rank/suit represented on the table (especially for Jokers) */
  effectiveRank: Rank;
  effectiveSuit: Suit;
  /** Numeric sequence value (1 for low Ace, 2..13, 14 for high Ace) */
  sequenceValue: number;
  points: number;
}

export interface TableMeld {
  id: string;
  type: MeldType;
  ownerIndex: number;
  slots: MeldSlot[];
  points: number;
}

export interface PlayerConfig {
  index: number;
  name: string;
  isHuman: boolean;
  position: 'south' | 'west' | 'north' | 'east';
}

export interface PlayerRoundScore {
  playerIndex: number;
  name: string;
  isHuman: boolean;
  isWinner: boolean;
  hasOpened: boolean;
  openedWith: number | null;
  cardsRemaining: number;
  penaltyPoints: number;
  cumulativePenalty: number;
  roundsWon: number;
}

export interface RoundResult {
  roundNumber: number;
  winnerIndex: number;
  winnerName: string;
  highestOpeningScore: number | null;
  standings: PlayerRoundScore[];
}

export const SUIT_META: Record<
  Suit,
  { symbol: string; label: string; isRed: boolean }
> = {
  spades: { symbol: '♠', label: 'Pique', isRed: false },
  hearts: { symbol: '♥', label: 'Cœur', isRed: true },
  clubs: { symbol: '♣', label: 'Trèfle', isRed: false },
  diamonds: { symbol: '♦', label: 'Carreau', isRed: true },
};

export const RANK_LABEL: Record<Rank, string> = {
  A: 'As',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  V: 'Valet',
  D: 'Dame',
  R: 'Roi',
};

export const DIFFICULTY_META: Record<
  Difficulty,
  { label: string; description: string }
> = {
  detente: {
    label: 'Détente',
    description: 'Adversaires souples pour découvrir le 72 tranquillement.',
  },
  salon: {
    label: 'Salon',
    description: 'Gestion équilibrée des combinaisons, pioche et défausse.',
  },
  maitre: {
    label: 'Maître',
    description: 'Ouvertures optimisées, récupération de Jokers et jeu serré.',
  },
};

export function buildPlayersForCount(count: PlayerCount): PlayerConfig[] {
  if (count === 2) {
    return [
      { index: 0, name: 'Vous', isHuman: true, position: 'south' },
      { index: 1, name: 'Youssef', isHuman: false, position: 'north' },
    ];
  }
  if (count === 3) {
    return [
      { index: 0, name: 'Vous', isHuman: true, position: 'south' },
      { index: 1, name: 'Salma', isHuman: false, position: 'west' },
      { index: 2, name: 'Youssef', isHuman: false, position: 'east' },
    ];
  }
  return [
    { index: 0, name: 'Vous', isHuman: true, position: 'south' },
    { index: 1, name: 'Salma', isHuman: false, position: 'west' },
    { index: 2, name: 'Youssef', isHuman: false, position: 'north' },
    { index: 3, name: 'Karim', isHuman: false, position: 'east' },
  ];
}
