import { describe, expect, it } from 'vitest';
import {
  canGoOut,
  canOpen,
  chooseAIDiscard,
  chooseSimpleAIDiscard,
  computeHandPenalty,
  createDoubleDeck,
  decideAIDrawSource,
  decideSimpleAIDrawSource,
  findBestCoverageMelds,
  findBestDisjointMelds,
  findBestOpeningMelds,
  findSimpleWinSolution,
  isPureMeld,
  mulberry32,
  planLayoffs,
  sortHand,
  tryExtendTableMeld,
  trySwapJokerInMeld,
  validateMeld,
  validateOpeningMelds,
} from './rami72Engine';
import { Card, Rank, Suit } from './types';

function card(rank: Rank, suit: Suit, deckIndex: 0 | 1 = 0): Card {
  return {
    id: `d${deckIndex}-${rank}-${suit}`,
    deckIndex,
    isJoker: false,
    rank,
    suit,
  };
}

function joker(idx: number, deckIndex: 0 | 1 = 0): Card {
  return {
    id: `d${deckIndex}-joker-${idx}`,
    deckIndex,
    isJoker: true,
  };
}

describe('rami72Engine', () => {
  describe('createDoubleDeck', () => {
    it('creates 108 unique cards including 4 Jokers', () => {
      const deck = createDoubleDeck();
      expect(deck).toHaveLength(108);
      expect(deck.filter((c) => c.isJoker)).toHaveLength(4);
      expect(new Set(deck.map((c) => c.id)).size).toBe(108);
    });
  });

  describe('validateMeld', () => {
    it('validates pure trios and carrés and rejects duplicate suits', () => {
      const trio = validateMeld(
        [card('A', 'spades'), card('A', 'hearts'), card('A', 'clubs')],
        0
      );
      expect(trio?.type).toBe('set');
      expect(trio?.points).toBe(33);

      const carre = validateMeld(
        [
          card('R', 'spades'),
          card('R', 'hearts'),
          card('R', 'clubs'),
          card('R', 'diamonds'),
        ],
        0
      );
      expect(carre?.type).toBe('set');
      expect(carre?.points).toBe(40);

      const dupSuit = validateMeld(
        [card('9', 'spades', 0), card('9', 'spades', 1), card('9', 'hearts')],
        0
      );
      expect(dupSuit).toBeNull();
    });

    it('scores low Ace runs as 1 pt and high Ace runs as 11 pts, and rejects wrap-around', () => {
      const lowRun = validateMeld(
        [card('A', 'hearts'), card('2', 'hearts'), card('3', 'hearts')],
        0
      );
      expect(lowRun?.type).toBe('run');
      expect(lowRun?.points).toBe(6);

      const highRun = validateMeld(
        [card('D', 'spades'), card('R', 'spades'), card('A', 'spades')],
        0
      );
      expect(highRun?.type).toBe('run');
      expect(highRun?.points).toBe(31);

      const wrap = validateMeld(
        [card('R', 'clubs'), card('A', 'clubs'), card('2', 'clubs')],
        0
      );
      expect(wrap).toBeNull();
    });

    it('places Jokers optimally in runs and enforces at least 2 real cards', () => {
      const highWithJoker = validateMeld(
        [card('R', 'diamonds'), card('A', 'diamonds'), joker(1)],
        0
      );
      expect(highWithJoker?.type).toBe('run');
      expect(highWithJoker?.points).toBe(31);
      expect(highWithJoker?.slots[0].effectiveRank).toBe('D');

      const gapJoker = validateMeld(
        [card('5', 'clubs'), joker(1), card('7', 'clubs')],
        0
      );
      expect(gapJoker?.points).toBe(18);
      expect(gapJoker?.slots[1].effectiveRank).toBe('6');

      const tooFewReal = validateMeld(
        [card('10', 'hearts'), joker(1), joker(2)],
        0
      );
      expect(tooFewReal).toBeNull();
    });
  });

  describe('tryExtendTableMeld and trySwapJokerInMeld', () => {
    it('extends runs and sets validly and rejects invalid additions', () => {
      const run = validateMeld(
        [card('6', 'hearts'), card('7', 'hearts'), card('8', 'hearts')],
        0
      )!;
      const extended = tryExtendTableMeld(run, [
        card('5', 'hearts'),
        card('9', 'hearts'),
      ]);
      expect(extended?.slots).toHaveLength(5);
      expect(extended?.points).toBe(35);

      const set = validateMeld(
        [card('V', 'spades'), card('V', 'hearts'), card('V', 'clubs')],
        0
      )!;
      const carre = tryExtendTableMeld(set, [card('V', 'diamonds')]);
      expect(carre?.slots).toHaveLength(4);
      expect(tryExtendTableMeld(carre!, [card('V', 'spades', 1)])).toBeNull();
    });

    it('swaps a Joker out of a run or set with the matching real card', () => {
      const j = joker(1);
      const runWithJoker = validateMeld(
        [card('8', 'spades'), j, card('10', 'spades')],
        0
      )!;
      const wrong = trySwapJokerInMeld(runWithJoker, card('9', 'hearts'));
      expect(wrong).toBeNull();

      const swappedRun = trySwapJokerInMeld(runWithJoker, card('9', 'spades'));
      expect(swappedRun?.retrievedJoker.id).toBe(j.id);
      expect(swappedRun?.updatedMeld.slots.every((s) => !s.card.isJoker)).toBe(
        true
      );

      const j2 = joker(2);
      const setWithJoker = validateMeld(
        [card('D', 'spades'), card('D', 'hearts'), j2],
        0
      )!;
      const swappedSet = trySwapJokerInMeld(setWithJoker, card('D', 'diamonds'));
      expect(swappedSet?.retrievedJoker.id).toBe(j2.id);
      expect(swappedSet?.updatedMeld.points).toBe(30);
    });
  });

  describe('findBestDisjointMelds (duplicates & multiple Jokers)', () => {
    it('uses duplicate cards from the double deck across disjoint melds', () => {
      const hand = [
        // Two 10 of hearts: one needed in Trio, one needed in Run
        card('10', 'hearts', 0),
        card('10', 'hearts', 1),
        card('10', 'spades'),
        card('10', 'clubs'),
        card('8', 'hearts'),
        card('9', 'hearts'),
        // Plus D-R-A spades (31 pts) -> total 30 + 27 + 31 = 88 pts (>= 72)
        card('D', 'spades'),
        card('R', 'spades'),
        card('A', 'spades'),
      ];

      const res = findBestDisjointMelds(hand, 1);
      expect(res.totalPoints).toBe(88);
      expect(res.melds).toHaveLength(3);
      expect(res.usedCardIds.size).toBe(9);
    });

    it('supports two identical melds when holding full duplicate copies', () => {
      const hand = [
        card('V', 'clubs', 0),
        card('D', 'clubs', 0),
        card('R', 'clubs', 0),
        card('V', 'clubs', 1),
        card('D', 'clubs', 1),
        card('R', 'clubs', 1),
        card('5', 'hearts', 0),
        card('5', 'spades', 0),
        card('5', 'diamonds', 0),
      ];

      const res = findBestDisjointMelds(hand, 1);
      expect(res.totalPoints).toBe(75);
      expect(res.melds).toHaveLength(3);
      expect(res.usedCardIds.size).toBe(9);
    });

    it('allocates multiple Jokers across separate melds simultaneously', () => {
      const hand = [
        card('R', 'spades'),
        card('A', 'spades'),
        joker(1, 0), // makes D(J)-R-A = 31 pts
        card('10', 'hearts'),
        card('10', 'diamonds'),
        joker(2, 1), // makes 10-10-10(J) = 30 pts
        card('4', 'clubs'),
        card('5', 'clubs'),
        card('6', 'clubs'), // 15 pts
      ];

      const res = findBestDisjointMelds(hand, 1);
      expect(res.totalPoints).toBe(76);
      expect(res.melds).toHaveLength(3);
      expect(res.usedCardIds.size).toBe(9);
    });

    it('can form a 4-card set using 2 real cards and 2 Jokers when optimal', () => {
      const hand = [
        card('R', 'hearts'),
        card('R', 'clubs'),
        joker(1, 0),
        joker(2, 1),
      ];
      const res = findBestDisjointMelds(hand, 1);
      expect(res.totalPoints).toBe(40);
      expect(res.melds).toHaveLength(1);
      expect(res.melds[0].slots).toHaveLength(4);
    });

    it('never reuses a single Ace across both low and high runs', () => {
      const hand = [
        card('A', 'spades', 0),
        card('2', 'spades'),
        card('3', 'spades'),
        card('D', 'spades'),
        card('R', 'spades'),
      ];
      const res = findBestDisjointMelds(hand, 1);
      expect(res.totalPoints).toBe(31);
      expect(res.melds).toHaveLength(1);
    });
  });

  describe('computeHandPenalty, sortHand, and AI heuristics', () => {
    it('computes hand penalty correctly including Jokers at 25 pts', () => {
      const hand = [
        card('A', 'spades'), // 11
        card('R', 'hearts'), // 10
        card('4', 'clubs'), // 4
        joker(1), // 25
      ];
      expect(computeHandPenalty(hand)).toBe(50);
    });

    it('keeps Jokers at the end when sorting by suit or rank', () => {
      const hand = [
        joker(1),
        card('9', 'diamonds'),
        card('2', 'spades'),
        card('9', 'spades'),
      ];
      const bySuit = sortHand(hand, 'suit');
      expect(bySuit[bySuit.length - 1].isJoker).toBe(true);
      expect(bySuit[0].suit).toBe('spades');

      const byRank = sortHand(hand, 'rank');
      expect(byRank[byRank.length - 1].isJoker).toBe(true);
      expect(byRank[0].rank).toBe('2');
    });

    it('takes discard when it unlocks >= 72 opening and avoids discarding Jokers', () => {
      const hand = [
        card('V', 'hearts'),
        card('D', 'hearts'),
        card('R', 'hearts'), // 30
        card('10', 'clubs'),
        card('10', 'diamonds'),
        card('10', 'spades'), // 30 -> 60 total
        card('5', 'spades'),
        card('6', 'spades'), // needs 7♠ -> +18 = 78 total!
      ];
      const drawChoice = decideAIDrawSource({
        hand,
        topDiscard: card('7', 'spades'),
        hasOpened: false,
        tableMelds: [],
        playerIndex: 1,
        requiredThreshold: 72,
        difficulty: 'salon',
      });
      expect(drawChoice).toBe('discard');

      const tableMeld = validateMeld(
        [card('3', 'hearts'), card('4', 'hearts'), card('5', 'hearts')],
        0
      )!;
      const attachChoice = decideAIDrawSource({
        hand: [card('9', 'clubs')],
        topDiscard: card('6', 'hearts'),
        hasOpened: true,
        tableMelds: [tableMeld],
        playerIndex: 1,
        requiredThreshold: 72,
        difficulty: 'salon',
      });
      expect(attachChoice).toBe('discard');

      const discardChoice = chooseAIDiscard({
        hand: [joker(1), card('9', 'clubs'), card('2', 'diamonds')],
        forbiddenDiscardId: 'd0-9-clubs',
        tableMelds: [],
        difficulty: 'maitre',
        playerIndex: 1,
      });
      expect(discardChoice.id).toBe('d0-2-diamonds');
    });

    it('produces deterministic decks with mulberry32', () => {
      const a = createDoubleDeck(mulberry32(42));
      const b = createDoubleDeck(mulberry32(42));
      const c = createDoubleDeck(mulberry32(43));
      expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
      expect(a.map((x) => x.id)).not.toEqual(c.map((x) => x.id));
    });

    it('conserves Jokers on equal meld points and enforces Trio+Suite opening in canOpen/canGoOut', () => {
      const setsOnlyHand = [
        card('A', 'hearts'),
        card('A', 'diamonds'),
        card('A', 'clubs'),
        card('A', 'spades'), // 44 pts
        card('7', 'hearts'),
        card('7', 'diamonds'),
        card('7', 'clubs'),
        card('7', 'spades'), // 28 pts -> 72 total, no run
        joker(1), // 1 card left to discard -> canGoOut = true once opened
      ];
      const best = findBestDisjointMelds(setsOnlyHand, 0);
      expect(best.totalPoints).toBe(72);
      expect(best.usedCardIds.has(joker(1).id)).toBe(false);
      // Deux carrés sans suite ne permettent pas d'ouvrir au Rami 72
      expect(canOpen(setsOnlyHand, 0, 72)).toBe(false);
      expect(canGoOut(setsOnlyHand, 0)).toBe(true);

      const legalOpeningHand = [
        card('A', 'hearts'),
        card('A', 'diamonds'),
        card('A', 'clubs'),
        card('A', 'spades'), // 44 pts pure set
        card('9', 'spades'),
        card('10', 'spades'),
        card('V', 'spades'), // 29 pts pure run -> 73 pure pts
        joker(1), // 1 card left to discard
      ];
      expect(canOpen(legalOpeningHand, 0, 72)).toBe(true);
      expect(canOpen(legalOpeningHand, 0, 73)).toBe(true);
      expect(canOpen(legalOpeningHand, 0, 74)).toBe(false);
      expect(canGoOut(legalOpeningHand, 0, false, 72)).toBe(true);
    });

    it('executes Joker swaps before extensions in planLayoffs and respects keepAtLeast', () => {
      const j = joker(1);
      const runWithJoker = validateMeld(
        [card('6', 'hearts'), j, card('8', 'hearts')],
        0
      )!;
      const plan = planLayoffs(
        [card('7', 'hearts'), card('9', 'hearts'), card('2', 'clubs')],
        [runWithJoker],
        1
      );
      expect(plan.actions.some((a) => a.kind === 'swap')).toBe(true);
      expect(plan.actions.some((a) => a.kind === 'extend')).toBe(true);
      // Kept Joker + 2♣ in hand (2 cards >= keepAtLeast 1, Joker never laid off)
      expect(plan.hand.some((c) => c.id === j.id)).toBe(true);
      expect(plan.melds[0].slots).toHaveLength(4);
    });

    it('uses seen card counting and opponent hand size in chooseAIDiscard', () => {
      // 4♣+6♣ needs 5♣; if both 5♣ are already in discardPile, 4♣/6♣ is dead vs live 8♥+9♥
      const discardPile = [card('5', 'clubs', 0), card('5', 'clubs', 1)];
      const chosen = chooseAIDiscard({
        hand: [
          card('6', 'clubs'),
          card('4', 'clubs'),
          card('6', 'hearts'),
          card('7', 'hearts'),
        ],
        forbiddenDiscardId: null,
        tableMelds: [],
        difficulty: 'maitre',
        playerIndex: 1,
        discardPile,
      });
      expect(chosen.suit).toBe('clubs');

      // When an opponent is down to <= 3 cards, AI sheds high-penalty deadwood
      const shed = chooseAIDiscard({
        hand: [card('R', 'spades'), card('3', 'hearts')],
        forbiddenDiscardId: null,
        tableMelds: [],
        difficulty: 'maitre',
        playerIndex: 1,
        opponentMinHandSize: 2,
      });
      expect(shed.rank).toBe('R');
    });

    it('preserves hand order in manual sortMode and forbids discard draw when canDrawDiscard is false', () => {
      const customOrder = [
        joker(1),
        card('R', 'diamonds'),
        card('2', 'clubs'),
        card('A', 'spades'),
      ];
      const kept = sortHand(customOrder, 'manual');
      expect(kept.map((c) => c.id)).toEqual(customOrder.map((c) => c.id));

      const blockedDraw = decideAIDrawSource({
        hand: [card('5', 'hearts'), card('6', 'hearts')],
        topDiscard: joker(2),
        hasOpened: true,
        tableMelds: [],
        playerIndex: 1,
        requiredThreshold: 72,
        difficulty: 'maitre',
        canDrawDiscard: false,
      });
      expect(blockedDraw).toBe('stock');
    });
  });

  describe('Rami 72 opening rules (Trio + Suite + 72 pure pts)', () => {
    it('validateOpeningMelds enforces pure set, pure run, and 72 pure points minimum', () => {
      const pureSetKings = validateMeld(
        [card('R', 'hearts'), card('R', 'diamonds'), card('R', 'clubs')],
        0
      )!; // 30 pts
      const pureSetAces = validateMeld(
        [card('A', 'hearts'), card('A', 'diamonds'), card('A', 'clubs'), card('A', 'spades')],
        0
      )!; // 44 pts
      const pureRunTenToKing = validateMeld(
        [card('10', 'spades'), card('V', 'spades'), card('D', 'spades'), card('R', 'spades')],
        0
      )!; // 40 pts
      const pureRunSmall = validateMeld(
        [card('9', 'hearts'), card('10', 'hearts'), card('V', 'hearts')],
        0
      )!; // 29 pts
      const jokerSetEights = validateMeld(
        [card('8', 'clubs'), card('8', 'spades'), joker(1)],
        0
      )!; // 24 pts (impure)

      // 1. Two pure sets without a pure run -> rejected even >= 72
      const setsOnly = validateOpeningMelds([pureSetAces, pureSetKings], 72);
      expect(setsOnly.valid).toBe(false);
      expect(setsOnly.hasPureSet).toBe(true);
      expect(setsOnly.hasPureRun).toBe(false);

      // 2. Two pure runs without a pure set -> rejected even >= 72
      const runsOnly = validateOpeningMelds([pureRunTenToKing, pureRunTenToKing], 72);
      expect(runsOnly.valid).toBe(false);
      expect(runsOnly.hasPureSet).toBe(false);
      expect(runsOnly.hasPureRun).toBe(true);

      // 3. Pure set + pure run < 72 pts plus Joker meld bringing total >= 72 -> rejected
      const jokerUsedFor72 = validateOpeningMelds(
        [pureSetKings, pureRunSmall, jokerSetEights],
        72
      ); // 30 + 29 = 59 pure, 83 total
      expect(jokerUsedFor72.valid).toBe(false);
      expect(jokerUsedFor72.purePoints).toBe(59);
      expect(jokerUsedFor72.totalPoints).toBe(83);
      expect(jokerUsedFor72.meetsPureMin).toBe(false);

      // 4. Only set has a Joker + pure run >= 72 total -> rejected
      const impureSetOnly = validateOpeningMelds(
        [
          validateMeld([card('R', 'hearts'), card('R', 'diamonds'), joker(2)], 0)!,
          validateMeld(
            [card('8', 'clubs'), card('9', 'clubs'), card('10', 'clubs'), card('V', 'clubs'), card('D', 'clubs')],
            0
          )!,
        ],
        72
      ); // 30 impure + 47 pure = 77 total
      expect(impureSetOnly.valid).toBe(false);
      expect(impureSetOnly.hasPureSet).toBe(false);

      // 5. Valid pure set + pure run >= 72 + extra Joker meld (also overbidding another opener)
      const pureBase74 = validateOpeningMelds([pureSetAces, pureRunSmall], 72);
      expect(pureBase74.valid).toBe(true);
      expect(pureBase74.purePoints).toBe(73);

      const withExtraJoker = validateOpeningMelds(
        [pureSetAces, pureRunSmall, jokerSetEights],
        90
      ); // 73 pure, 97 total >= 90
      expect(withExtraJoker.valid).toBe(true);
      expect(withExtraJoker.purePoints).toBe(73);
      expect(withExtraJoker.totalPoints).toBe(97);

      const failHigherThreshold = validateOpeningMelds(
        [pureSetAces, pureRunSmall, jokerSetEights],
        98
      );
      expect(failHigherThreshold.valid).toBe(false);
      expect(failHigherThreshold.meetsThreshold).toBe(false);
    });

    it('findBestOpeningMelds rejects <72 pure points even with Jokers, and finds Trio+Suite+72 pure base before adding Jokers', () => {
      // Only 59 pure pts (30 + 29) + Joker meld (30) = 89 unconstrained, must NOT open
      const insufficientPureHand = [
        card('R', 'hearts'),
        card('R', 'diamonds'),
        card('R', 'clubs'), // 30 pure
        card('9', 'spades'),
        card('10', 'spades'),
        card('V', 'spades'), // 29 pure
        card('D', 'hearts'),
        card('D', 'diamonds'),
        joker(1), // would add 30 with Joker
      ];
      expect(findBestDisjointMelds(insufficientPureHand, 0).totalPoints).toBeGreaterThanOrEqual(72);
      expect(findBestOpeningMelds(insufficientPureHand, 0, 72).melds).toHaveLength(0);

      // Pure base = 76 pts (30 + 40 + 6) + extra Joker meld (24) = 100 pts total
      const validWithExtraJokerHand = [
        card('R', 'hearts'),
        card('R', 'diamonds'),
        card('R', 'clubs'), // 30 pure set
        card('10', 'spades'),
        card('V', 'spades'),
        card('D', 'spades'),
        card('R', 'spades'), // 40 pure run
        card('2', 'hearts'),
        card('2', 'diamonds'),
        card('2', 'clubs'), // 6 pure set -> 76 pure
        card('8', 'clubs'),
        card('8', 'diamonds'),
        joker(1), // 24 impure -> 100 total
      ];
      const sol = findBestOpeningMelds(validWithExtraJokerHand, 0, 72);
      expect(sol.melds.length).toBe(4);
      expect(sol.totalPoints).toBe(100);
      expect(validateOpeningMelds(sol.melds, 72).valid).toBe(true);
      expect(validateOpeningMelds(sol.melds, 95).valid).toBe(true);
    });

    it('findBestOpeningMelds avoids greedily breaking a pure Trio/Suite when a Joker could attach to it', () => {
      // Pure 72: [R♥,R♦,R♣] (30) + [V♠,D♠,R♠] (30) + [4♠,4♥,4♣] (12) = 72.
      // Unrestricted findBestDisjointMelds puts Joker into R-carré (40, impure), leaving only 42 pure pts!
      const trapHand = [
        card('R', 'hearts'),
        card('R', 'diamonds'),
        card('R', 'clubs'),
        card('V', 'spades'),
        card('D', 'spades'),
        card('R', 'spades'),
        card('4', 'spades'),
        card('4', 'hearts'),
        card('4', 'clubs'),
        joker(1),
      ];
      const unrestricted = findBestDisjointMelds(trapHand, 0);
      expect(validateOpeningMelds(unrestricted.melds, 72).valid).toBe(false);

      const opening = findBestOpeningMelds(trapHand, 0, 72);
      expect(opening.melds).toHaveLength(3);
      expect(opening.totalPoints).toBe(72);
      expect(opening.melds.every(isPureMeld)).toBe(true);
      expect(validateOpeningMelds(opening.melds, 72).valid).toBe(true);
    });

    it('findBestOpeningMelds supports duplicate copies inside the minimal pure base and AI discard draw picks opening card', () => {
      const duplicateBaseHand = [
        card('10', 'spades', 0),
        card('V', 'spades', 0),
        card('D', 'spades', 0), // 30 pure run
        card('10', 'spades', 1),
        card('V', 'spades', 1),
        card('D', 'spades', 1), // 30 pure run
        card('4', 'hearts'),
        card('4', 'diamonds'),
        card('4', 'clubs'), // 12 pure set -> 72 pure
      ];
      const dupSol = findBestOpeningMelds(duplicateBaseHand, 1, 72);
      expect(dupSol.totalPoints).toBe(72);
      expect(validateOpeningMelds(dupSol.melds, 72).valid).toBe(true);

      // AI unopened holding [R♥,R♦,R♣] (30) + [10♠,V♠] + [4♥,4♦,4♣] (12) -> D♠ on tapis completes 72 pure Trio+Suite!
      const drawChoice = decideAIDrawSource({
        hand: [
          card('R', 'hearts'),
          card('R', 'diamonds'),
          card('R', 'clubs'),
          card('10', 'spades'),
          card('V', 'spades'),
          card('4', 'hearts'),
          card('4', 'diamonds'),
          card('4', 'clubs'),
        ],
        topDiscard: card('D', 'spades'),
        hasOpened: false,
        tableMelds: [],
        playerIndex: 1,
        requiredThreshold: 72,
        difficulty: 'salon',
      });
      expect(drawChoice).toBe('discard');
    });
  });

  describe('Rami Simple mode (13 cards, no scoring, free discard draw)', () => {
    it('findBestCoverageMelds maximizes covered cards rather than raw points', () => {
      // [A♥,A♦,A♣,A♠] scores 44 pts for 4 cards vs [A♥,A♦,A♣] + [A♠,2♠,3♠] scoring 39 pts for 6 cards
      const hand = [
        card('A', 'hearts'),
        card('A', 'diamonds'),
        card('A', 'clubs'),
        card('A', 'spades'),
        card('2', 'spades'),
        card('3', 'spades'),
        card('5', 'clubs'),
        card('6', 'clubs'),
        card('7', 'clubs'),
        card('8', 'diamonds'),
        card('9', 'diamonds'),
        card('10', 'diamonds'),
        card('V', 'diamonds'),
      ];

      const pointsOpt = findBestDisjointMelds(hand, 0);
      expect(pointsOpt.usedCardIds.size).toBe(11);

      const covOpt = findBestCoverageMelds(hand, 0);
      expect(covOpt.usedCardIds.size).toBe(13);
      expect(covOpt.melds).toHaveLength(4);
    });

    it('findSimpleWinSolution detects 14-card full cover, 13-card + discard wins, and respects forbiddenDiscardId', () => {
      const base13 = [
        card('2', 'hearts'),
        card('3', 'hearts'),
        card('4', 'hearts'),
        card('5', 'spades'),
        card('5', 'clubs'),
        card('5', 'diamonds'),
        card('6', 'clubs'),
        card('7', 'clubs'),
        card('8', 'clubs'),
        card('9', 'spades'),
        card('10', 'spades'),
        card('V', 'spades'),
        card('D', 'spades'),
      ];

      // 13 combined + 1 dead card -> win discarding the dead card
      const dead = card('R', 'diamonds');
      const win13Plus1 = findSimpleWinSolution([...base13, dead], 0);
      expect(win13Plus1.canWin).toBe(true);
      expect(win13Plus1.discardCard?.id).toBe(dead.id);
      expect(win13Plus1.melds).toHaveLength(4);

      // If that single dead card was just drawn from discard pile, cannot immediately re-discard it
      const blockedWin = findSimpleWinSolution([...base13, dead], 0, dead.id);
      expect(blockedWin.canWin).toBe(false);

      // 14 combined cards (adding R♠ onto 9..D♠) -> immediate win with no discard needed
      const win14 = findSimpleWinSolution([...base13, card('R', 'spades')], 0);
      expect(win14.canWin).toBe(true);
      expect(win14.discardCard).toBeNull();

      // Alternate discard swap: 4 Kings + duplicate King where one King is forbiddenDiscardId
      const altHand = [
        ...base13.slice(0, 9), // 3 melds = 9 cards
        card('R', 'hearts', 0),
        card('R', 'diamonds', 0),
        card('R', 'clubs', 0),
        card('R', 'spades', 0),
        card('R', 'spades', 1), // if R♠(1) was just drawn from discard, can discard R♠(0) instead
      ];
      const altWin = findSimpleWinSolution(altHand, 0, card('R', 'spades', 1).id);
      expect(altWin.canWin).toBe(true);
      expect(altWin.discardCard).not.toBeNull();
      expect(altWin.discardCard?.id).not.toBe(card('R', 'spades', 1).id);
    });

    it('decideSimpleAIDrawSource picks discard for immediate win (no 72 minimum) or meld improvement, and chooseSimpleAIDiscard ignores points', () => {
      // Even with very low point cards (2..5), taking topDiscard completes 13-card win -> must draw discard
      const nearWinHand = [
        card('2', 'hearts'),
        card('3', 'hearts'),
        card('4', 'hearts'),
        card('2', 'spades'),
        card('2', 'clubs'),
        card('2', 'diamonds'),
        card('3', 'clubs'),
        card('4', 'clubs'),
        card('5', 'clubs'),
        card('6', 'spades'),
        card('7', 'spades'),
        card('8', 'spades'),
        card('9', 'diamonds'),
      ];
      const winDraw = decideSimpleAIDrawSource({
        hand: nearWinHand,
        topDiscard: card('5', 'hearts'), // extends 2-3-4-5♥ so 13 cards + drop 9♦!
        playerIndex: 1,
        difficulty: 'salon',
      });
      expect(winDraw).toBe('discard');

      // Useless card on discard -> draws from stock
      const stockDraw = decideSimpleAIDrawSource({
        hand: [card('4', 'hearts'), card('5', 'hearts'), card('9', 'clubs')],
        topDiscard: card('R', 'diamonds'),
        playerIndex: 1,
        difficulty: 'maitre',
      });
      expect(stockDraw).toBe('stock');

      // In Simple mode without points counting, keeps live high-rank pair [R♠, R♦] and sheds isolated 2♣
      const discard = chooseSimpleAIDiscard({
        hand: [
          card('6', 'hearts'),
          card('7', 'hearts'),
          card('8', 'hearts'),
          card('R', 'spades'),
          card('R', 'diamonds'),
          card('2', 'clubs'),
        ],
        forbiddenDiscardId: null,
        difficulty: 'maitre',
        playerIndex: 1,
      });
      expect(discard.id).toBe('d0-2-clubs');
    });
  });
});
