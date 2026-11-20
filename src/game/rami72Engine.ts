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

// ============================================================================
// CONSTANTES
// ============================================================================

export const ALL_SUITS: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];

export const ALL_RANKS: Rank[] = [
  'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'V', 'D', 'R',
];

const RANK_TO_LOW_VAL: Record<Rank, number> = {
  A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, V: 11, D: 12, R: 13,
};

const VAL_TO_RANK: Record<number, Rank> = {
  1: 'A', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7',
  8: '8', 9: '9', 10: '10', 11: 'V', 12: 'D', 13: 'R', 14: 'A',
};

const SUIT_INDEX: Record<Suit, number> = {
  spades: 0,
  hearts: 1,
  clubs: 2,
  diamonds: 3,
};

/** Index 0..51 d'une carte réelle (couleur * 13 + valeur basse - 1). */
function cardKeyIndex(card: Card): number {
  return SUIT_INDEX[card.suit!] * 13 + RANK_TO_LOW_VAL[card.rank!] - 1;
}

// ============================================================================
// IDS, RNG, PAQUET
// ============================================================================

let meldSeqCounter = 1;
export function nextMeldId(prefix = 'meld'): string {
  meldSeqCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${meldSeqCounter}`;
}

export type Rng = () => number;

/** RNG déterministe (tests, replays, parties "seed" partageables). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleInPlace<T>(arr: T[], rng: Rng = Math.random): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function createDoubleDeck(rng: Rng = Math.random): Card[] {
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
    // 2 jokers par paquet de 54 => 4 jokers au total (108 cartes)
    deck.push({ id: `d${deckIndex}-joker-a`, deckIndex, isJoker: true });
    deck.push({ id: `d${deckIndex}-joker-b`, deckIndex, isJoker: true });
  }
  return shuffleInPlace(deck, rng);
}

// ============================================================================
// POINTS
// ============================================================================

export function getSequenceValuePoints(seqVal: number): number {
  if (seqVal === 1) return 1; // As bas (A-2-3)
  if (seqVal === 14) return 11; // As haut (D-R-A)
  if (seqVal >= 10) return 10; // 10, V, D, R
  return seqVal;
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
  if (mode === 'manual') return [...hand];
  return [...hand].sort((a, b) => {
    if (a.isJoker && !b.isJoker) return 1;
    if (!a.isJoker && b.isJoker) return -1;
    if (a.isJoker && b.isJoker) return a.id.localeCompare(b.id);

    const suitA = SUIT_INDEX[a.suit!];
    const suitB = SUIT_INDEX[b.suit!];
    const valA = RANK_TO_LOW_VAL[a.rank!];
    const valB = RANK_TO_LOW_VAL[b.rank!];

    if (mode === 'suit') {
      if (suitA !== suitB) return suitA - suitB;
      if (valA !== valB) return valA - valB;
      return a.deckIndex - b.deckIndex;
    }
    if (valA !== valB) return valA - valB;
    if (suitA !== suitB) return suitA - suitB;
    return a.deckIndex - b.deckIndex;
  });
}

// ============================================================================
// VALIDATION DES COMBINAISONS
// ============================================================================

function tryBuildSet(
  cards: Card[],
  ownerIndex: number,
  id?: string
): TableMeld | null {
  if (cards.length < 3 || cards.length > 4) return null;

  const realCards = cards.filter((c) => !c.isJoker);
  const jokers = cards.filter((c) => c.isJoker);

  // Au moins 2 vraies cartes : le rang reste non ambigu
  if (realCards.length < 2) return null;

  const targetRank = realCards[0].rank!;
  const seenSuits = new Set<Suit>();

  for (const c of realCards) {
    if (c.rank !== targetRank) return null;
    if (seenSuits.has(c.suit!)) return null; // couleur en double interdite
    seenSuits.add(c.suit!);
  }

  const remainingSuits = ALL_SUITS.filter((s) => !seenSuits.has(s));
  if (jokers.length > remainingSuits.length) return null;

  const ptsPerCard = getSetRankPoints(targetRank);
  const seqVal = targetRank === 'A' ? 14 : RANK_TO_LOW_VAL[targetRank];

  const slots: MeldSlot[] = [
    ...realCards.map((c) => ({
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

  slots.sort(
    (a, b) => SUIT_INDEX[a.effectiveSuit] - SUIT_INDEX[b.effectiveSuit]
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

  // Au moins 2 vraies cartes, jamais plus de jokers que de vraies cartes
  if (realCards.length < 2 || jokers.length > realCards.length) return null;

  const suit = realCards[0].suit!;
  const valMap = new Map<number, Card>();

  for (const c of realCards) {
    if (c.suit !== suit) return null;
    const val = c.rank === 'A' ? (aceHigh ? 14 : 1) : RANK_TO_LOW_VAL[c.rank!];
    if (valMap.has(val)) return null; // même rang deux fois dans une suite
    valMap.set(val, c);
  }

  const realVals = Array.from(valMap.keys()).sort((a, b) => a - b);
  const minReal = realVals[0];
  const maxReal = realVals[realVals.length - 1];

  const span = maxReal - minReal + 1;
  const interiorGaps = span - realVals.length;
  if (jokers.length < interiorGaps) return null;

  let extraJokers = jokers.length - interiorGaps;

  // Les jokers en trop prolongent d'abord vers le haut (maximise les points :
  // D-R-Joker => D-R-A = 31 pts), puis vers le bas.
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
    slots.push({
      card: realCard ?? jokers[jokerCursor++],
      effectiveRank: VAL_TO_RANK[v],
      effectiveSuit: suit,
      sequenceValue: v,
      points: getSequenceValuePoints(v),
    });
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
    return { updatedMeld: { ...meld, slots: newSlots }, retrievedJoker };
  }

  // Trio/Carré : on peut remplacer un joker par n'importe quelle couleur manquante
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
// OPTIMISEUR DE COMBINAISONS (exact, mémoïsé)
// ============================================================================

interface Candidate {
  type: MeldType;
  keys: number[]; // index de vraies cartes (0..51), chacun une seule fois
  jokerCount: number;
  points: number;
  value: number; // points*10 - jokers : à points égaux on garde les jokers
}

interface HandAnalysis {
  candidates: Candidate[];
  counts: number[]; // 52 cases
  jokers: Card[];
  pool: Map<number, Card[]>;
}

function analyzeHand(hand: Card[], ownerIndex: number): HandAnalysis {
  const counts = new Array<number>(52).fill(0);
  const reps = new Map<number, Card>();
  const pool = new Map<number, Card[]>();
  const jokers: Card[] = [];

  for (const c of hand) {
    if (c.isJoker) {
      jokers.push(c);
      continue;
    }
    const k = cardKeyIndex(c);
    counts[k] += 1;
    if (!reps.has(k)) reps.set(k, c);
    const list = pool.get(k) ?? [];
    list.push(c);
    pool.set(k, list);
  }

  const jokerCount = jokers.length;
  const seen = new Set<string>();
  const out: Candidate[] = [];

  const register = (realCards: Card[], usedJokers: number, type: MeldType) => {
    const meld = validateMeld(
      [...realCards, ...jokers.slice(0, usedJokers)],
      ownerIndex,
      type
    );
    if (!meld) return;
    const signature = `${type}:${meld.slots
      .map((s) => `${s.effectiveRank}-${s.effectiveSuit}-${s.card.isJoker ? 'J' : 'R'}`)
      .join('|')}`;
    if (seen.has(signature)) return;
    seen.add(signature);
    out.push({
      type,
      keys: realCards.map(cardKeyIndex),
      jokerCount: usedJokers,
      points: meld.points,
      value: meld.points * 10 - usedJokers,
    });
  };

  const uniqueReal = Array.from(reps.values());

  // --- Sets (même rang, couleurs distinctes)
  const byRank = new Map<Rank, Card[]>();
  for (const c of uniqueReal) {
    const l = byRank.get(c.rank!) ?? [];
    l.push(c);
    byRank.set(c.rank!, l);
  }
  for (const group of byRank.values()) {
    if (group.length === 4) register(group, 0, 'set');
    if (group.length >= 3) {
      for (let i = 0; i < group.length; i++)
        for (let j = i + 1; j < group.length; j++)
          for (let k = j + 1; k < group.length; k++) {
            const trio = [group[i], group[j], group[k]];
            register(trio, 0, 'set');
            if (jokerCount >= 1) register(trio, 1, 'set');
          }
    }
    if (group.length >= 2 && jokerCount >= 1) {
      for (let i = 0; i < group.length; i++)
        for (let j = i + 1; j < group.length; j++) {
          const pair = [group[i], group[j]];
          register(pair, 1, 'set');
          if (jokerCount >= 2) register(pair, 2, 'set');
        }
    }
  }

  // --- Suites (même couleur, fenêtres contiguës, As haut/bas)
  const bySuit = new Map<Suit, Card[]>();
  for (const c of uniqueReal) {
    const l = bySuit.get(c.suit!) ?? [];
    l.push(c);
    bySuit.set(c.suit!, l);
  }
  for (const suitCards of bySuit.values()) {
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
            if (span + extra >= 3) register(baseCards, missing + extra, 'run');
          }
        }
      }
    }
  }

  out.sort((a, b) => b.value - a.value);
  return { candidates: out.slice(0, 500), counts, jokers, pool };
}

export interface MeldSolution {
  melds: TableMeld[];
  totalPoints: number;
  usedCardIds: Set<string>;
}

const SOLVER_NODE_LIMIT = 60000;
const MELD_CACHE_MAX = 256;
const meldCache = new Map<string, MeldSolution>();

function cloneSolution(s: MeldSolution): MeldSolution {
  return {
    melds: [...s.melds],
    totalPoints: s.totalPoints,
    usedCardIds: new Set(s.usedCardIds),
  };
}

/**
 * Meilleur ensemble de combinaisons disjointes d'une main.
 * Recherche exacte : on prend la plus petite carte restante ("pivot") et on
 * décide soit de la laisser en main, soit de la placer dans l'une des
 * combinaisons qui la contiennent. Mémoïsé sur l'état (cartes restantes), donc
 * aucune limite arbitraire de candidats ni de branches comme avant.
 */
export function findBestDisjointMelds(
  hand: Card[],
  ownerIndex: number
): MeldSolution {
  const cacheKey = `${ownerIndex}:${hand.map((c) => c.id).sort().join(',')}`;
  const cached = meldCache.get(cacheKey);
  if (cached) return cloneSolution(cached);

  const { candidates, counts, jokers, pool } = analyzeHand(hand, ownerIndex);
  const empty: MeldSolution = { melds: [], totalPoints: 0, usedCardIds: new Set() };
  if (candidates.length === 0) return empty;

  const byKey = new Map<number, Candidate[]>();
  for (const cand of candidates) {
    for (const k of cand.keys) {
      const l = byKey.get(k) ?? [];
      l.push(cand);
      byKey.set(k, l);
    }
  }

  const cnt = counts.slice();
  let jk = jokers.length;
  const memo = new Map<string, { v: number; c: Candidate | null }>();
  let nodes = 0;

  const stateKey = () => `${cnt.join('')}|${jk}`;
  const firstPivot = () => {
    for (let i = 0; i < 52; i++) if (cnt[i] > 0) return i;
    return -1;
  };

  const solve = (): number => {
    const sk = stateKey();
    const hit = memo.get(sk);
    if (hit) return hit.v;

    const pivot = firstPivot();
    if (pivot < 0) {
      memo.set(sk, { v: 0, c: null });
      return 0;
    }
    if (++nodes > SOLVER_NODE_LIMIT) return 0; // garde-fou

    // Option 1 : le pivot reste en main
    cnt[pivot] -= 1;
    let best = solve();
    let bestCand: Candidate | null = null;
    cnt[pivot] += 1;

    // Option 2 : le pivot rejoint une combinaison
    for (const cand of byKey.get(pivot) ?? []) {
      if (jk < cand.jokerCount) continue;
      if (!cand.keys.every((k) => cnt[k] > 0)) continue;
      for (const k of cand.keys) cnt[k] -= 1;
      jk -= cand.jokerCount;
      const v = cand.value + solve();
      jk += cand.jokerCount;
      for (const k of cand.keys) cnt[k] += 1;
      if (v > best) {
        best = v;
        bestCand = cand;
      }
    }

    memo.set(sk, { v: best, c: bestCand });
    return best;
  };

  solve();

  // Reconstruction du choix optimal
  const chosen: Candidate[] = [];
  for (;;) {
    const entry = memo.get(stateKey());
    const pivot = firstPivot();
    if (!entry || pivot < 0) break;
    if (!entry.c) {
      cnt[pivot] -= 1;
      continue;
    }
    for (const k of entry.c.keys) cnt[k] -= 1;
    jk -= entry.c.jokerCount;
    chosen.push(entry.c);
  }

  // Matérialisation en vraies cartes (on dépile par la fin : l'ordre de la
  // main décide quelle copie est utilisée)
  const poolCopy = new Map<number, Card[]>();
  for (const [k, l] of pool.entries()) poolCopy.set(k, [...l]);
  const jokerPool = [...jokers];

  const melds: TableMeld[] = [];
  const usedCardIds = new Set<string>();
  let totalPoints = 0;

  for (const cand of chosen) {
    const cards: Card[] = [];
    for (const k of cand.keys) {
      const card = poolCopy.get(k)!.pop()!;
      cards.push(card);
      usedCardIds.add(card.id);
    }
    for (let j = 0; j < cand.jokerCount; j++) {
      const joker = jokerPool.pop()!;
      cards.push(joker);
      usedCardIds.add(joker.id);
    }
    const built = validateMeld(cards, ownerIndex, cand.type);
    if (built) {
      melds.push(built);
      totalPoints += built.points;
    }
  }

  const result: MeldSolution = { melds, totalPoints, usedCardIds };
  if (meldCache.size >= MELD_CACHE_MAX) {
    const oldest = meldCache.keys().next().value;
    if (oldest !== undefined) meldCache.delete(oldest);
  }
  meldCache.set(cacheKey, result);
  return cloneSolution(result);
}

/** Peut-on ouvrir avec cette main (seuil de points atteint) ? */
export function canOpen(
  hand: Card[],
  ownerIndex: number,
  requiredThreshold: number
): boolean {
  return findBestDisjointMelds(hand, ownerIndex).totalPoints >= requiredThreshold;
}

/** Peut-on "fermer" : tout est posable, hormis la carte à défausser ? */
export function canGoOut(hand: Card[], ownerIndex: number): boolean {
  const best = findBestDisjointMelds(hand, ownerIndex);
  return hand.length - best.usedCardIds.size <= 1;
}

// ============================================================================
// POSE SUR LA TABLE (extensions + échanges de jokers)
// ============================================================================

export interface LayoffAction {
  kind: 'extend' | 'swap';
  meldId: string;
  card: Card;
  retrievedJoker?: Card;
}

export interface LayoffPlan {
  actions: LayoffAction[];
  melds: TableMeld[];
  hand: Card[];
}

/**
 * Enchaîne les poses possibles sur les combinaisons de la table :
 * échange de jokers d'abord (récupère un joker), puis extensions les plus
 * rentables. `keepAtLeast` garde des cartes en main (ex. 1 pour pouvoir défausser).
 * Les jokers de la main ne sont jamais posés en extension.
 */
export function planLayoffs(
  hand: Card[],
  tableMelds: TableMeld[],
  keepAtLeast = 0
): LayoffPlan {
  let h = [...hand];
  const melds = [...tableMelds];
  const actions: LayoffAction[] = [];

  for (let guard = 0; guard < 80; guard++) {
    let progressed = false;

    // 1) Échanges de jokers (ne consomme pas de carte nette : +1 joker -1 carte)
    swapSearch: for (const card of h) {
      if (card.isJoker) continue;
      for (let mi = 0; mi < melds.length; mi++) {
        const r = trySwapJokerInMeld(melds[mi], card);
        if (!r) continue;
        melds[mi] = r.updatedMeld;
        h = h.filter((c) => c.id !== card.id);
        h.push(r.retrievedJoker);
        actions.push({
          kind: 'swap',
          meldId: r.updatedMeld.id,
          card,
          retrievedJoker: r.retrievedJoker,
        });
        progressed = true;
        break swapSearch;
      }
    }
    if (progressed) continue;

    // 2) Meilleure extension
    if (h.length <= keepAtLeast) break;
    let bestGain = -1;
    let bestCard: Card | null = null;
    let bestIdx = -1;
    let bestMeld: TableMeld | null = null;

    for (const card of h) {
      if (card.isJoker) continue;
      for (let mi = 0; mi < melds.length; mi++) {
        const ext = tryExtendTableMeld(melds[mi], [card]);
        if (!ext) continue;
        const gain = ext.points - melds[mi].points;
        if (gain > bestGain) {
          bestGain = gain;
          bestCard = card;
          bestIdx = mi;
          bestMeld = ext;
        }
      }
    }
    if (bestCard && bestMeld) {
      melds[bestIdx] = bestMeld;
      h = h.filter((c) => c.id !== bestCard!.id);
      actions.push({ kind: 'extend', meldId: bestMeld.id, card: bestCard });
      progressed = true;
    }
    if (!progressed) break;
  }

  return { actions, melds, hand: h };
}

// ============================================================================
// IA : PIOCHE
// ============================================================================

export function decideAIDrawSource(params: {
  hand: Card[];
  topDiscard: Card | null;
  hasOpened: boolean;
  tableMelds: TableMeld[];
  playerIndex: number;
  requiredThreshold: number;
  difficulty: Difficulty;
  canDrawDiscard?: boolean;
}): 'discard' | 'stock' {
  const {
    hand,
    topDiscard,
    hasOpened,
    tableMelds,
    playerIndex,
    requiredThreshold,
    difficulty,
    canDrawDiscard = true,
  } = params;

  if (!canDrawDiscard || !topDiscard) return 'stock';
  if (topDiscard.isJoker) return 'discard';

  if (hasOpened && difficulty !== 'detente') {
    const canAttach = tableMelds.some(
      (m) =>
        tryExtendTableMeld(m, [topDiscard]) !== null ||
        trySwapJokerInMeld(m, topDiscard) !== null
    );
    if (canAttach) return 'discard';
  }

  const before = findBestDisjointMelds(hand, playerIndex);
  // La carte ramassée est placée en dernier : elle est utilisée en priorité
  const after = findBestDisjointMelds([...hand, topDiscard], playerIndex);

  if (
    !hasOpened &&
    before.totalPoints < requiredThreshold &&
    after.totalPoints >= requiredThreshold
  ) {
    return 'discard';
  }

  // Un gain strictement positif implique que la carte ramassée est utilisée
  const minGain = difficulty === 'maitre' ? 10 : difficulty === 'salon' ? 14 : 20;
  if (after.totalPoints - before.totalPoints >= minGain) return 'discard';

  return 'stock';
}

// ============================================================================
// IA : DÉFAUSSE (avec comptage des cartes déjà vues)
// ============================================================================

function buildSeenCounts(
  hand: Card[],
  tableMelds: TableMeld[],
  discardPile: Card[]
): number[] {
  const seen = new Array<number>(52).fill(0);
  const add = (c: Card) => {
    if (!c.isJoker && c.rank && c.suit) seen[cardKeyIndex(c)] += 1;
  };
  hand.forEach(add);
  discardPile.forEach(add);
  for (const m of tableMelds) for (const s of m.slots) add(s.card);
  return seen;
}

function runLink(
  card: Card,
  other: Card,
  unseen: (rank: Rank, suit: Suit) => number
): { d: number; outs: number } {
  let va = RANK_TO_LOW_VAL[card.rank!];
  let vb = RANK_TO_LOW_VAL[other.rank!];
  if (card.rank === 'A' && vb >= 12) va = 14;
  else if (other.rank === 'A' && va >= 12) vb = 14;

  const lo = Math.min(va, vb);
  const hi = Math.max(va, vb);
  const d = hi - lo;
  const suit = card.suit!;
  const out = (v: number) => (v >= 1 && v <= 14 ? unseen(VAL_TO_RANK[v], suit) : 0);

  if (d === 1) return { d, outs: out(lo - 1) + out(hi + 1) };
  if (d === 2) return { d, outs: out(lo + 1) };
  return { d, outs: 0 };
}

/** Valeur de "garder" une carte : potentiel de set/suite pondéré par les cartes restantes. */
function keepValue(
  card: Card,
  hand: Card[],
  unseen: (rank: Rank, suit: Suit) => number
): number {
  let value = 0;
  const partnerSuits = new Set<Suit>();

  for (const o of hand) {
    if (o.id === card.id || o.isJoker) continue;

    if (o.rank === card.rank) {
      if (o.suit !== card.suit) partnerSuits.add(o.suit!);
      else value -= 4; // doublon exact : inutile pour former une combinaison
      continue;
    }
    if (o.suit === card.suit) {
      const { d, outs } = runLink(card, o, unseen);
      if (d === 1) value += (outs > 0 ? 16 : 5) + 4 * Math.min(3, outs);
      else if (d === 2) value += (outs > 0 ? 7 : 2) + 3 * Math.min(3, outs);
    }
  }

  if (partnerSuits.size > 0) {
    const held = new Set<Suit>([card.suit!, ...partnerSuits]);
    let setOuts = 0;
    for (const s of ALL_SUITS) {
      if (!held.has(s)) setOuts += unseen(card.rank!, s);
    }
    value += (setOuts > 0 ? 18 : 5) * partnerSuits.size + 4 * Math.min(3, setOuts);
  }
  return value;
}

export function chooseAIDiscard(params: {
  hand: Card[];
  forbiddenDiscardId: string | null;
  tableMelds: TableMeld[];
  difficulty: Difficulty;
  playerIndex: number;
  /** Défausse visible (améliore l'estimation des cartes restantes). */
  discardPile?: Card[];
  /** Plus petite main parmi les adversaires : si faible, on se débarrasse des grosses cartes. */
  opponentMinHandSize?: number;
}): Card {
  const {
    hand,
    forbiddenDiscardId,
    tableMelds,
    difficulty,
    playerIndex,
    discardPile = [],
    opponentMinHandSize,
  } = params;

  if (hand.length === 1) return hand[0];

  const candidates = hand.filter((c) => c.id !== forbiddenDiscardId);
  const pool = candidates.length > 0 ? candidates : hand;

  // Ne jamais défausser un joker sauf s'il ne reste que ça
  const nonJokers = pool.filter((c) => !c.isJoker);
  const validPool = nonJokers.length > 0 ? nonJokers : pool;

  const currentBest = findBestDisjointMelds(hand, playerIndex);

  // En mode détente l'IA ne suit pas les cartes vues
  const seen =
    difficulty === 'detente'
      ? buildSeenCounts(hand, [], [])
      : buildSeenCounts(hand, tableMelds, discardPile);
  const unseen = (rank: Rank, suit: Suit) =>
    Math.max(0, 2 - seen[SUIT_INDEX[suit] * 13 + RANK_TO_LOW_VAL[rank] - 1]);

  const penaltyWeight =
    opponentMinHandSize !== undefined && opponentMinHandSize <= 3 ? 2.2 : 1.4;

  let worstCard = validPool[0];
  let bestUtility = -Infinity;

  for (const card of validPool) {
    let utility = 0;

    if (currentBest.usedCardIds.has(card.id)) utility -= 120;

    utility -= keepValue(card, hand, unseen);
    utility += getHandCardPenalty(card) * penaltyWeight;

    if (difficulty === 'maitre' || difficulty === 'salon') {
      const helpsTable = tableMelds.some(
        (m) => tryExtendTableMeld(m, [card]) !== null
      );
      if (helpsTable) utility -= difficulty === 'maitre' ? 24 : 10;
    }

    if (difficulty === 'detente') {
      utility += (Math.random() - 0.5) * 14;
    }

    if (utility > bestUtility) {
      bestUtility = utility;
      worstCard = card;
    }
  }

  return worstCard;
}
