import {
  Card,
  Difficulty,
  MeldSlot,
  MeldType,
  Rank,
  SortMode,
  Suit,
  TableMeld,
} from './types';

export const ALL_SUITS: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];

export const ALL_RANKS: Rank[] = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'V',
  'D',
  'R',
];

const RANK_TO_LOW_VAL: Record<Rank, number> = {
  A: 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  V: 11,
  D: 12,
  R: 13,
};

const VAL_TO_RANK: Record<number, Rank> = {
  1: 'A',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'V',
  12: 'D',
  13: 'R',
  14: 'A',
};

let meldSeqCounter = 1;
export function nextMeldId(prefix = 'meld'): string {
  meldSeqCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${meldSeqCounter}`;
}

export function createDoubleDeck(): Card[] {
  const deck: Card[] = [];
  for (const deckIndex of [0, 1] as const) {
    for (const suit of ALL_SUITS) {
      for (const rank of ALL_RANKS) {
        deck.push({
          id: `d${deckIndex}-${rank}-${suit}`,
          deckIndex,
          isJoker: false,
          suit,
          rank,
        });
      }
    }
    // 2 Jokers per 54-card deck => 4 Jokers total (108 cards)
    deck.push({
      id: `d${deckIndex}-joker-a`,
      deckIndex,
      isJoker: true,
    });
    deck.push({
      id: `d${deckIndex}-joker-b`,
      deckIndex,
      isJoker: true,
    });
  }

  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function getSequenceValuePoints(seqVal: number): number {
  if (seqVal === 1) return 1; // Low Ace in A-2-3
  if (seqVal === 14) return 11; // High Ace in D-R-A
  if (seqVal >= 10) return 10; // 10, V, D, R
  return seqVal; // 2..9
}

export function getSetRankPoints(rank: Rank): number {
  if (rank === 'A') return 11;
  if (rank === '10' || rank === 'V' || rank === 'D' || rank === 'R') return 10;
  return parseInt(rank, 10);
}

export function getHandCardPenalty(card: Card): number {
  if (card.isJoker) return 25;
  if (!card.rank) return 0;
  return getSetRankPoints(card.rank);
}

export function computeHandPenalty(hand: Card[]): number {
  return hand.reduce((sum, card) => sum + getHandCardPenalty(card), 0);
}

export function sortHand(hand: Card[], mode: SortMode): Card[] {
  return [...hand].sort((a, b) => {
    if (a.isJoker && !b.isJoker) return 1;
    if (!a.isJoker && b.isJoker) return -1;
    if (a.isJoker && b.isJoker) return a.id.localeCompare(b.id);

    const suitA = ALL_SUITS.indexOf(a.suit!);
    const suitB = ALL_SUITS.indexOf(b.suit!);
    const valA = RANK_TO_LOW_VAL[a.rank!];
    const valB = RANK_TO_LOW_VAL[b.rank!];

    if (mode === 'suit') {
      if (suitA !== suitB) return suitA - suitB;
      if (valA !== valB) return valA - valB;
      return a.deckIndex - b.deckIndex;
    }

    // mode === 'rank'
    if (valA !== valB) return valA - valB;
    if (suitA !== suitB) return suitA - suitB;
    return a.deckIndex - b.deckIndex;
  });
}

function tryBuildSet(
  cards: Card[],
  ownerIndex: number,
  id?: string
): TableMeld | null {
  if (cards.length < 3 || cards.length > 4) return null;

  const realCards = cards.filter((c) => !c.isJoker);
  const jokers = cards.filter((c) => c.isJoker);

  // Require at least 2 real cards in a set so rank is unambiguous and balanced
  if (realCards.length < 2) return null;

  const targetRank = realCards[0].rank!;
  const seenSuits = new Set<Suit>();

  for (const c of realCards) {
    if (c.rank !== targetRank) return null;
    if (seenSuits.has(c.suit!)) return null; // Duplicate suit forbidden in Trio/Carré
    seenSuits.add(c.suit!);
  }

  const remainingSuits = ALL_SUITS.filter((s) => !seenSuits.has(s));
  if (jokers.length > remainingSuits.length) return null;

  const ptsPerCard = getSetRankPoints(targetRank);
  const seqVal = targetRank === 'A' ? 14 : RANK_TO_LOW_VAL[targetRank];

  const slots: MeldSlot[] = [
    ...realCards
      .sort((a, b) => ALL_SUITS.indexOf(a.suit!) - ALL_SUITS.indexOf(b.suit!))
      .map((c) => ({
        card: c,
        effectiveRank: targetRank,
        effectiveSuit: c.suit!,
        sequenceValue: seqVal,
        points: ptsPerCard,
      })),
    ...jokers.map((j, idx) => ({
      card: j,
      effectiveRank: targetRank,
      effectiveSuit: remainingSuits[idx],
      sequenceValue: seqVal,
      points: ptsPerCard,
    })),
  ];

  // Keep consistent suit visual ordering
  slots.sort(
    (a, b) =>
      ALL_SUITS.indexOf(a.effectiveSuit) - ALL_SUITS.indexOf(b.effectiveSuit)
  );

  return {
    id: id ?? nextMeldId('set'),
    type: 'set',
    ownerIndex,
    slots,
    points: slots.reduce((sum, s) => sum + s.points, 0),
  };
}

function tryBuildRunWithAceMode(
  cards: Card[],
  aceHigh: boolean,
  ownerIndex: number,
  id?: string
): TableMeld | null {
  if (cards.length < 3 || cards.length > 13) return null;

  const realCards = cards.filter((c) => !c.isJoker);
  const jokers = cards.filter((c) => c.isJoker);

  // Require at least 2 real cards (and never more jokers than real cards)
  if (realCards.length < 2 || jokers.length > realCards.length) return null;

  const suit = realCards[0].suit!;
  const valMap = new Map<number, Card>();

  for (const c of realCards) {
    if (c.suit !== suit) return null;
    const val = c.rank === 'A' ? (aceHigh ? 14 : 1) : RANK_TO_LOW_VAL[c.rank!];
    if (valMap.has(val)) return null; // Duplicate rank in same suit not allowed in a run
    valMap.set(val, c);
  }

  const realVals = Array.from(valMap.keys()).sort((a, b) => a - b);
  const minReal = realVals[0];
  const maxReal = realVals[realVals.length - 1];

  // Ensure sequence doesn't span both low Ace (1) and high Ace (14) simultaneously
  const span = maxReal - minReal + 1;
  if (span > 13) return null;

  const interiorGaps = span - realVals.length;
  if (jokers.length < interiorGaps) return null;

  let extraJokers = jokers.length - interiorGaps;

  // Prefer extending upwards first (maximizes point value, e.g. D-R-Joker => D-R-A = 31 pts)
  let endVal = maxReal;
  let startVal = minReal;
  const maxAllowed = startVal === 1 ? 13 : 14;

  while (extraJokers > 0 && endVal < maxAllowed) {
    endVal += 1;
    extraJokers -= 1;
  }
  const minAllowed = endVal === 14 ? 2 : 1;
  while (extraJokers > 0 && startVal > minAllowed) {
    startVal -= 1;
    extraJokers -= 1;
  }

  if (extraJokers > 0) return null;
  if (endVal - startVal + 1 !== cards.length) return null;

  const slots: MeldSlot[] = [];
  let jokerCursor = 0;

  for (let v = startVal; v <= endVal; v++) {
    const realCard = valMap.get(v);
    const effRank = VAL_TO_RANK[v];
    const pts = getSequenceValuePoints(v);
    if (realCard) {
      slots.push({
        card: realCard,
        effectiveRank: effRank,
        effectiveSuit: suit,
        sequenceValue: v,
        points: pts,
      });
    } else {
      slots.push({
        card: jokers[jokerCursor],
        effectiveRank: effRank,
        effectiveSuit: suit,
        sequenceValue: v,
        points: pts,
      });
      jokerCursor += 1;
    }
  }

  return {
    id: id ?? nextMeldId('run'),
    type: 'run',
    ownerIndex,
    slots,
    points: slots.reduce((sum, s) => sum + s.points, 0),
  };
}

export function validateMeld(
  cards: Card[],
  ownerIndex: number,
  forcedType?: MeldType,
  existingId?: string
): TableMeld | null {
  if (cards.length < 3) return null;

  const candidates: TableMeld[] = [];

  if (!forcedType || forcedType === 'set') {
    const asSet = tryBuildSet(cards, ownerIndex, existingId);
    if (asSet) candidates.push(asSet);
  }

  if (!forcedType || forcedType === 'run') {
    const runHigh = tryBuildRunWithAceMode(cards, true, ownerIndex, existingId);
    if (runHigh) candidates.push(runHigh);
    const runLow = tryBuildRunWithAceMode(cards, false, ownerIndex, existingId);
    if (runLow) candidates.push(runLow);
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.points - a.points);
  return candidates[0];
}

export function tryExtendTableMeld(
  meld: TableMeld,
  cardsToAdd: Card[]
): TableMeld | null {
  if (cardsToAdd.length === 0) return null;
  const combined = [...meld.slots.map((s) => s.card), ...cardsToAdd];
  return validateMeld(combined, meld.ownerIndex, meld.type, meld.id);
}

export function trySwapJokerInMeld(
  meld: TableMeld,
  card: Card
): { updatedMeld: TableMeld; retrievedJoker: Card } | null {
  if (card.isJoker || !card.rank || !card.suit) return null;

  if (meld.type === 'run') {
    const slotIdx = meld.slots.findIndex(
      (s) =>
        s.card.isJoker &&
        s.effectiveRank === card.rank &&
        s.effectiveSuit === card.suit
    );
    if (slotIdx === -1) return null;

    const retrievedJoker = meld.slots[slotIdx].card;
    const newSlots = meld.slots.map((s, idx) =>
      idx === slotIdx ? { ...s, card } : s
    );
    return {
      updatedMeld: { ...meld, slots: newSlots },
      retrievedJoker,
    };
  }

  // For a set (Trio/Carré): if a Joker is present, player can swap with ANY missing suit of the same rank
  const jokerIdx = meld.slots.findIndex((s) => s.card.isJoker);
  if (jokerIdx === -1) return null;

  const targetRank = meld.slots[0].effectiveRank;
  if (card.rank !== targetRank) return null;

  const realSuits = new Set(
    meld.slots.filter((s) => !s.card.isJoker).map((s) => s.effectiveSuit)
  );
  if (realSuits.has(card.suit)) return null;

  const retrievedJoker = meld.slots[jokerIdx].card;
  const updatedCards = meld.slots.map((s, idx) =>
    idx === jokerIdx ? card : s.card
  );
  const rebuilt = tryBuildSet(updatedCards, meld.ownerIndex, meld.id);
  if (!rebuilt) return null;

  return { updatedMeld: rebuilt, retrievedJoker };
}

// ============================================================================
// AI MELD OPTIMIZER & TACTICAL DECISION ENGINE
// ============================================================================

interface CanonicalCandidate {
  type: MeldType;
  realKeys: string[];
  jokerCount: number;
  points: number;
  signature: string;
}

function realCardKey(card: Card): string {
  return `${card.rank}-${card.suit}`;
}

function generateCanonicalCandidates(
  hand: Card[],
  ownerIndex: number
): { candidates: CanonicalCandidate[]; cardsByKey: Map<string, Card[]> } {
  const cardsByKey = new Map<string, Card[]>();
  const uniqueRealCards: Card[] = [];

  for (const c of hand) {
    const key = c.isJoker ? 'JOKER' : realCardKey(c);
    const list = cardsByKey.get(key) ?? [];
    if (!c.isJoker && list.length === 0) {
      uniqueRealCards.push(c);
    }
    list.push(c);
    cardsByKey.set(key, list);
  }

  const jokers = cardsByKey.get('JOKER') ?? [];
  const jokerCount = jokers.length;
  const seenSignatures = new Set<string>();
  const baseCandidates: CanonicalCandidate[] = [];

  const register = (realCards: Card[], usedJokers: number, type: MeldType) => {
    const sampleCards = [...realCards, ...jokers.slice(0, usedJokers)];
    const meld = validateMeld(sampleCards, ownerIndex, type);
    if (!meld) return;

    const signature = `${type}:${meld.slots
      .map(
        (s) =>
          `${s.effectiveRank}-${s.effectiveSuit}-${s.card.isJoker ? 'J' : 'R'}`
      )
      .join('|')}`;
    if (seenSignatures.has(signature)) return;
    seenSignatures.add(signature);

    baseCandidates.push({
      type,
      realKeys: realCards.map(realCardKey),
      jokerCount: usedJokers,
      points: meld.points,
      signature,
    });
  };

  // 1. Candidate Sets (by rank, distinct suits)
  const byRank = new Map<Rank, Card[]>();
  for (const c of uniqueRealCards) {
    const list = byRank.get(c.rank!) ?? [];
    list.push(c);
    byRank.set(c.rank!, list);
  }

  for (const [, group] of byRank.entries()) {
    // 4-card pure set
    if (group.length === 4) {
      register(group, 0, 'set');
    }
    // 3-card pure sets & 3-card + 1 joker sets
    if (group.length >= 3) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          for (let k = j + 1; k < group.length; k++) {
            const trio = [group[i], group[j], group[k]];
            register(trio, 0, 'set');
            if (jokerCount >= 1) {
              register(trio, 1, 'set');
            }
          }
        }
      }
    }
    // 2-card + 1 or 2 joker sets
    if (group.length >= 2 && jokerCount >= 1) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const pair = [group[i], group[j]];
          register(pair, 1, 'set');
          if (jokerCount >= 2) {
            register(pair, 2, 'set');
          }
        }
      }
    }
  }

  // 2. Candidate Runs (by suit, contiguous windows)
  const bySuit = new Map<Suit, Card[]>();
  for (const c of uniqueRealCards) {
    const list = bySuit.get(c.suit!) ?? [];
    list.push(c);
    bySuit.set(c.suit!, list);
  }

  for (const [, suitCards] of bySuit.entries()) {
    for (const aceHigh of [true, false]) {
      const valToCard = new Map<number, Card>();
      for (const c of suitCards) {
        const v = c.rank === 'A' ? (aceHigh ? 14 : 1) : RANK_TO_LOW_VAL[c.rank!];
        valToCard.set(v, c);
      }

      const vals = Array.from(valToCard.keys()).sort((a, b) => a - b);
      if (vals.length < 2) continue;

      for (let start = 0; start < vals.length; start++) {
        for (let end = start + 1; end < vals.length; end++) {
          const subset = vals.slice(start, end + 1);
          const span = subset[subset.length - 1] - subset[0] + 1;
          if (span > 13) break;

          const missing = span - subset.length;
          if (missing > jokerCount) continue;

          const baseCards = subset.map((v) => valToCard.get(v)!);
          const maxExtra = Math.min(
            jokerCount - missing,
            baseCards.length - missing,
            13 - span
          );
          for (let extra = 0; extra <= maxExtra; extra++) {
            if (span + extra >= 3) {
              register(baseCards, missing + extra, 'run');
            }
          }
        }
      }
    }
  }

  // Sort by points descending for rapid branch-and-bound pruning
  baseCandidates.sort((a, b) => b.points - a.points);
  const capped = baseCandidates.slice(0, 120);

  // Duplicate candidates when hand actually holds 2 copies of every needed card & enough jokers
  const expanded: CanonicalCandidate[] = [];
  for (const cand of capped) {
    expanded.push(cand);
    const canRepeat =
      cand.realKeys.every((k) => (cardsByKey.get(k)?.length ?? 0) >= 2) &&
      jokerCount >= cand.jokerCount * 2;
    if (canRepeat) {
      expanded.push(cand);
    }
  }

  return { candidates: expanded, cardsByKey };
}

export function findBestDisjointMelds(
  hand: Card[],
  ownerIndex: number
): { melds: TableMeld[]; totalPoints: number; usedCardIds: Set<string> } {
  const { candidates, cardsByKey } = generateCanonicalCandidates(hand, ownerIndex);
  if (candidates.length === 0) {
    return { melds: [], totalPoints: 0, usedCardIds: new Set() };
  }

  const remCounts = new Map<string, number>();
  for (const [k, list] of cardsByKey.entries()) {
    remCounts.set(k, list.length);
  }

  let bestScore = 0;
  let bestChoice: CanonicalCandidate[] = [];
  const current: CanonicalCandidate[] = [];
  let visitedNodes = 0;

  // Precompute suffix upper bound
  const suffixMax = new Array<number>(candidates.length + 1).fill(0);
  for (let i = candidates.length - 1; i >= 0; i--) {
    suffixMax[i] = suffixMax[i + 1] + candidates[i].points;
  }

  const dfs = (idx: number, currentScore: number) => {
    visitedNodes += 1;
    if (visitedNodes > 4000) return;

    if (currentScore > bestScore) {
      bestScore = currentScore;
      bestChoice = [...current];
    }
    if (idx >= candidates.length) return;
    if (currentScore + suffixMax[idx] <= bestScore) return;

    const cand = candidates[idx];
    const hasJokers = (remCounts.get('JOKER') ?? 0) >= cand.jokerCount;
    const hasReal =
      hasJokers && cand.realKeys.every((k) => (remCounts.get(k) ?? 0) >= 1);

    if (hasReal) {
      if (cand.jokerCount > 0) {
        remCounts.set('JOKER', remCounts.get('JOKER')! - cand.jokerCount);
      }
      for (const k of cand.realKeys) {
        remCounts.set(k, remCounts.get(k)! - 1);
      }
      current.push(cand);
      dfs(idx + 1, currentScore + cand.points);
      current.pop();
      for (const k of cand.realKeys) {
        remCounts.set(k, remCounts.get(k)! + 1);
      }
      if (cand.jokerCount > 0) {
        remCounts.set('JOKER', remCounts.get('JOKER')! + cand.jokerCount);
      }
    }

    dfs(idx + 1, currentScore);
  };

  dfs(0, 0);

  // Materialize canonical choices into concrete disjoint Card objects
  const pool = new Map<string, Card[]>();
  for (const [k, list] of cardsByKey.entries()) {
    pool.set(k, [...list]);
  }

  const melds: TableMeld[] = [];
  const usedCardIds = new Set<string>();

  for (const cand of bestChoice) {
    const chosenCards: Card[] = [];
    for (const k of cand.realKeys) {
      const card = pool.get(k)!.pop()!;
      chosenCards.push(card);
      usedCardIds.add(card.id);
    }
    for (let j = 0; j < cand.jokerCount; j++) {
      const joker = pool.get('JOKER')!.pop()!;
      chosenCards.push(joker);
      usedCardIds.add(joker.id);
    }
    const built = validateMeld(chosenCards, ownerIndex, cand.type);
    if (built) {
      melds.push(built);
    }
  }

  return {
    melds,
    totalPoints: bestScore,
    usedCardIds,
  };
}

export function decideAIDrawSource(params: {
  hand: Card[];
  topDiscard: Card | null;
  hasOpened: boolean;
  tableMelds: TableMeld[];
  playerIndex: number;
  requiredThreshold: number;
  difficulty: Difficulty;
}): 'discard' | 'stock' {
  const {
    hand,
    topDiscard,
    hasOpened,
    tableMelds,
    playerIndex,
    requiredThreshold,
    difficulty,
  } = params;

  if (!topDiscard) return 'stock';
  if (topDiscard.isJoker) return 'discard';

  // If already opened and topDiscard immediately extends a table meld -> great pickup!
  if (hasOpened) {
    const canAttachDirectly = tableMelds.some(
      (m) =>
        tryExtendTableMeld(m, [topDiscard]) !== null ||
        trySwapJokerInMeld(m, topDiscard) !== null
    );
    if (canAttachDirectly && difficulty !== 'detente') {
      return 'discard';
    }
  }

  const before = findBestDisjointMelds(hand, playerIndex);
  const after = findBestDisjointMelds([...hand, topDiscard], playerIndex);

  // If taking discard enables opening right now -> always take!
  if (!hasOpened && before.totalPoints < requiredThreshold && after.totalPoints >= requiredThreshold) {
    return 'discard';
  }

  // If discard meaningfully boosts meld points
  const minGain = difficulty === 'maitre' ? 10 : difficulty === 'salon' ? 14 : 20;
  if (after.totalPoints - before.totalPoints >= minGain && after.usedCardIds.has(topDiscard.id)) {
    return 'discard';
  }

  return 'stock';
}

export function chooseAIDiscard(params: {
  hand: Card[];
  forbiddenDiscardId: string | null;
  tableMelds: TableMeld[];
  difficulty: Difficulty;
  playerIndex: number;
}): Card {
  const { hand, forbiddenDiscardId, tableMelds, difficulty, playerIndex } = params;

  if (hand.length === 1) return hand[0];

  const candidates = hand.filter((c) => c.id !== forbiddenDiscardId);
  const pool = candidates.length > 0 ? candidates : hand;

  // Never discard a Joker unless it's the only card
  const nonJokers = pool.filter((c) => !c.isJoker);
  const validPool = nonJokers.length > 0 ? nonJokers : pool;

  const currentBest = findBestDisjointMelds(hand, playerIndex);

  let worstCard = validPool[0];
  let bestDiscardUtility = -Infinity;

  for (const card of validPool) {
    let utility = 0;

    // Strongly avoid breaking an already-formed meld
    if (currentBest.usedCardIds.has(card.id)) {
      utility -= 120;
    }

    // Check synergy with remaining hand (same rank or adjacent same suit)
    let synergy = 0;
    for (const other of hand) {
      if (other.id === card.id || other.isJoker) continue;
      if (other.rank === card.rank && other.suit !== card.suit) {
        synergy += 18;
      }
      if (other.suit === card.suit) {
        const diff = Math.abs(
          RANK_TO_LOW_VAL[other.rank!] - RANK_TO_LOW_VAL[card.rank!]
        );
        if (diff === 1) synergy += 16;
        else if (diff === 2) synergy += 6;
        // High Ace adjacency with R / D
        if (
          (card.rank === 'A' && (other.rank === 'R' || other.rank === 'D')) ||
          (other.rank === 'A' && (card.rank === 'R' || card.rank === 'D'))
        ) {
          synergy += 14;
        }
      }
    }
    utility -= synergy;

    // Prefer shedding high deadwood points when card has low synergy
    utility += getHandCardPenalty(card) * 1.4;

    // On Maître difficulty, avoid discarding a card that can be immediately played onto table melds
    if (difficulty === 'maitre') {
      const helpsTable = tableMelds.some(
        (m) => tryExtendTableMeld(m, [card]) !== null
      );
      if (helpsTable) utility -= 24;
    }

    // Slight randomness on Détente
    if (difficulty === 'detente') {
      utility += (Math.random() - 0.5) * 14;
    }

    if (utility > bestDiscardUtility) {
      bestDiscardUtility = utility;
      worstCard = card;
    }
  }

  return worstCard;
}
