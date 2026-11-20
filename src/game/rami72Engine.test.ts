import { describe, expect, it } from 'vitest';
import {
  canGoOut,
  canOpen,
  chooseAIDiscard,
  computeHandPenalty,
  createDoubleDeck,
  decideAIDrawSource,
  findBestDisjointMelds,
  mulberry32,
  planLayoffs,
  sortHand,
  tryExtendTableMeld,
  trySwapJokerInMeld,
  validateMeld,
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

    it('conserves Jokers on equal meld points and supports canOpen/canGoOut', () => {
      const hand = [
        card('A', 'hearts'),
        card('A', 'diamonds'),
        card('A', 'clubs'),
        card('A', 'spades'), // 44 pts
        card('7', 'hearts'),
        card('7', 'diamonds'),
        card('7', 'clubs'),
        card('7', 'spades'), // 28 pts -> 72 total, no run possible with 1 joker
        joker(1), // 1 card left to discard -> canGoOut = true
      ];
      const best = findBestDisjointMelds(hand, 0);
      expect(best.totalPoints).toBe(72);
      expect(best.usedCardIds.has(joker(1).id)).toBe(false);
      expect(canOpen(hand, 0, 72)).toBe(true);
      expect(canOpen(hand, 0, 73)).toBe(false);
      expect(canGoOut(hand, 0)).toBe(true);
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
  });
});
