import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowUpDown,
  BookOpen,
  Layers,
  RotateCcw,
  Undo2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  chooseAIDiscard,
  computeHandPenalty,
  createDoubleDeck,
  decideAIDrawSource,
  findBestDisjointMelds,
  sortHand,
  tryExtendTableMeld,
  trySwapJokerInMeld,
  validateMeld,
} from '../game/rami72Engine';
import { salonAudio } from '../game/sound';
import {
  Card,
  Difficulty,
  GamePhase,
  PlayerConfig,
  PlayerCount,
  PlayerRoundScore,
  RoundResult,
  SUIT_META,
  SortMode,
  TableMeld,
  TotalRounds,
  TurnStep,
  buildPlayersForCount,
} from '../game/types';
import { CardBack, PlayingCard } from './PlayingCard';
import { RoundModal } from './RoundModal';
import { RulesDrawer } from './RulesDrawer';

const FELT_TABLE_IMAGE = '/src/assets/images/belote_felt_table_1795129514441.jpg';
const INITIAL_THRESHOLD = 72;

interface TableState {
  phase: Exclude<GamePhase, 'TITLE_MENU'>;
  roundNumber: number;
  players: PlayerConfig[];
  hands: Card[][];
  stock: Card[];
  discard: Card[];
  tableMelds: TableMeld[];
  hasOpened: boolean[];
  openedWith: (number | null)[];
  /** Highest opening total laid down so far in this round; next opener must beat it (> highestOpeningScore) */
  highestOpeningScore: number | null;
  lastOpenerIndex: number | null;
  activePlayer: number;
  turnStep: TurnStep;
  /** True right after the deal while the initial 15th card sits untouched on the tapis */
  isInitialTapisCard: boolean;
  /** Prevents immediately discarding the exact card just picked from the discard pile */
  drawnFromDiscardId: string | null;
  speech: Record<number, string>;
  cumulativePenalty: number[];
  roundsWon: number[];
  roundResult: RoundResult | null;
}

function getRequiredThreshold(highestOpeningScore: number | null): number {
  return highestOpeningScore === null
    ? INITIAL_THRESHOLD
    : highestOpeningScore + 1;
}

function dealNewRound(params: {
  roundNumber: number;
  players: PlayerConfig[];
  cumulativePenalty: number[];
  roundsWon: number[];
  sortMode: SortMode;
}): TableState {
  const { roundNumber, players, cumulativePenalty, roundsWon, sortMode } = params;
  const deck = createDoubleDeck();
  const hands: Card[][] = [];
  let cursor = 0;

  for (let i = 0; i < players.length; i++) {
    const raw = deck.slice(cursor, cursor + 14);
    hands.push(i === 0 ? sortHand(raw, sortMode) : raw);
    cursor += 14;
  }

  const firstDiscard = deck[cursor];
  const stock = deck.slice(cursor + 1);
  const startingPlayer = (roundNumber - 1) % players.length;

  return {
    phase: 'PLAYING',
    roundNumber,
    players,
    hands,
    stock,
    discard: [firstDiscard],
    tableMelds: [],
    hasOpened: players.map(() => false),
    openedWith: players.map(() => null),
    highestOpeningScore: null,
    lastOpenerIndex: null,
    activePlayer: startingPlayer,
    turnStep: 'DRAW',
    isInitialTapisCard: true,
    drawnFromDiscardId: null,
    speech: {},
    cumulativePenalty,
    roundsWon,
    roundResult: null,
  };
}

function finishRoundState(
  prev: TableState,
  winnerIndex: number,
  finalHands: Card[][],
  totalRounds: TotalRounds
): TableState {
  const nextCumulative = [...prev.cumulativePenalty];
  const nextRoundsWon = [...prev.roundsWon];
  nextRoundsWon[winnerIndex] += 1;

  const standings: PlayerRoundScore[] = prev.players.map((p, idx) => {
    const isWinner = idx === winnerIndex;
    const penalty = isWinner ? 0 : computeHandPenalty(finalHands[idx]);
    nextCumulative[idx] += penalty;

    return {
      playerIndex: idx,
      name: p.name,
      isHuman: p.isHuman,
      isWinner,
      hasOpened: prev.hasOpened[idx],
      openedWith: prev.openedWith[idx],
      cardsRemaining: finalHands[idx].length,
      penaltyPoints: penalty,
      cumulativePenalty: nextCumulative[idx],
      roundsWon: nextRoundsWon[idx],
    };
  });

  const roundResult: RoundResult = {
    roundNumber: prev.roundNumber,
    winnerIndex,
    winnerName: prev.players[winnerIndex].name,
    highestOpeningScore: prev.highestOpeningScore,
    standings,
  };

  salonAudio.playRoundEnd(winnerIndex === 0);

  return {
    ...prev,
    hands: finalHands,
    phase: prev.roundNumber >= totalRounds ? 'GAME_OVER' : 'ROUND_SUMMARY',
    cumulativePenalty: nextCumulative,
    roundsWon: nextRoundsWon,
    roundResult,
  };
}

function refillStockIfEmpty(stock: Card[], discard: Card[]): {
  nextStock: Card[];
  nextDiscard: Card[];
} {
  if (stock.length > 0) {
    return { nextStock: stock, nextDiscard: discard };
  }
  if (discard.length <= 1) {
    return { nextStock: [], nextDiscard: discard };
  }
  const topDiscard = discard[discard.length - 1];
  const pool = [...discard.slice(0, -1)];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return { nextStock: pool, nextDiscard: [topDiscard] };
}

function formatCardShort(card: Card): string {
  if (card.isJoker) return 'Joker';
  return `${card.rank}${SUIT_META[card.suit!].symbol}`;
}

interface GameTableProps {
  playerCount: PlayerCount;
  totalRounds: TotalRounds;
  difficulty: Difficulty;
  onExitToMenu: () => void;
}

export function GameTable({
  playerCount,
  totalRounds,
  difficulty,
  onExitToMenu,
}: GameTableProps) {
  const [sortMode, setSortMode] = useState<SortMode>('suit');
  const [state, setState] = useState<TableState>(() => {
    const players = buildPlayersForCount(playerCount);
    return dealNewRound({
      roundNumber: 1,
      players,
      cumulativePenalty: players.map(() => 0),
      roundsWon: players.map(() => 0),
      sortMode: 'suit',
    });
  });

  // Human local turn selection & pre-opening staging buffer
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [stagedMelds, setStagedMelds] = useState<TableMeld[]>([]);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feltFailed, setFeltFailed] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [rulesOpen, setRulesOpen] = useState(false);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    salonAudio.setEnabled(next);
  };

  const humanHand = state.hands[0];
  const isHumanTurn = state.phase === 'PLAYING' && state.activePlayer === 0;
  const isHumanDraw = isHumanTurn && state.turnStep === 'DRAW';
  const isHumanPlay = isHumanTurn && state.turnStep === 'PLAY_OR_DISCARD';
  const humanOpened = state.hasOpened[0];
  const requiredThreshold = getRequiredThreshold(state.highestOpeningScore);

  // Cards currently in stagedMelds are hidden from hand until committed or cancelled
  const stagedCardIds = useMemo(() => {
    const ids = new Set<string>();
    for (const m of stagedMelds) {
      for (const s of m.slots) ids.add(s.card.id);
    }
    return ids;
  }, [stagedMelds]);

  const visibleHumanHand = useMemo(
    () => humanHand.filter((c) => !stagedCardIds.has(c.id)),
    [humanHand, stagedCardIds]
  );

  const selectedCards = useMemo(
    () => visibleHumanHand.filter((c) => selectedIds.has(c.id)),
    [visibleHumanHand, selectedIds]
  );

  const selectedValidMeld = useMemo(() => {
    if (!isHumanPlay || selectedCards.length < 3) return null;
    return validateMeld(selectedCards, 0);
  }, [isHumanPlay, selectedCards]);

  const stagedTotalPoints = useMemo(
    () => stagedMelds.reduce((sum, m) => sum + m.points, 0),
    [stagedMelds]
  );

  // Table melds that can accept current selection (only when human has opened!)
  const extendableMeldIds = useMemo(() => {
    const ids = new Set<string>();
    if (!isHumanPlay || !humanOpened || selectedCards.length === 0) return ids;
    for (const meld of state.tableMelds) {
      if (tryExtendTableMeld(meld, selectedCards) !== null) {
        ids.add(meld.id);
      }
    }
    return ids;
  }, [isHumanPlay, humanOpened, selectedCards, state.tableMelds]);

  // Table melds where single selected card can swap out a Joker
  const swappableMeldIds = useMemo(() => {
    const ids = new Set<string>();
    if (!isHumanPlay || !humanOpened || selectedCards.length !== 1) return ids;
    const single = selectedCards[0];
    if (single.isJoker) return ids;
    for (const meld of state.tableMelds) {
      if (trySwapJokerInMeld(meld, single) !== null) {
        ids.add(meld.id);
      }
    }
    return ids;
  }, [isHumanPlay, humanOpened, selectedCards, state.tableMelds]);

  const handleChangeSortMode = (mode: SortMode) => {
    setSortMode(mode);
    setState((prev) => {
      const nextHands = [...prev.hands];
      nextHands[0] = sortHand(nextHands[0], mode);
      return { ...prev, hands: nextHands };
    });
  };

  const toggleSelectCard = (cardId: string) => {
    if (!isHumanPlay) return;
    setFeedbackMessage(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  // Human Draw from Stock or Discard
  const handleHumanDraw = useCallback(
    (source: 'stock' | 'discard') => {
      if (!isHumanDraw) return;
      setFeedbackMessage(null);
      setSelectedIds(new Set());
      setStagedMelds([]);

      setState((prev) => {
        if (prev.phase !== 'PLAYING' || prev.activePlayer !== 0 || prev.turnStep !== 'DRAW') {
          return prev;
        }

        if (source === 'discard') {
          if (prev.discard.length === 0) return prev;
          const drawn = prev.discard[prev.discard.length - 1];
          const nextDiscard = prev.discard.slice(0, -1);
          const nextHands = [...prev.hands];
          nextHands[0] = sortHand([...nextHands[0], drawn], sortMode);
          salonAudio.playCardSnap();
          return {
            ...prev,
            hands: nextHands,
            discard: nextDiscard,
            turnStep: 'PLAY_OR_DISCARD',
            isInitialTapisCard: false,
            drawnFromDiscardId: drawn.id,
            speech: { ...prev.speech, 0: `Prend ${formatCardShort(drawn)}` },
          };
        }

        // Draw from stock
        const { nextStock, nextDiscard } = refillStockIfEmpty(prev.stock, prev.discard);
        if (nextStock.length === 0) {
          // Extreme edge case: no cards left anywhere -> fewest penalty wins
          let bestIdx = 0;
          let bestPen = Infinity;
          prev.hands.forEach((h, i) => {
            const p = computeHandPenalty(h);
            if (p < bestPen) {
              bestPen = p;
              bestIdx = i;
            }
          });
          return finishRoundState(prev, bestIdx, prev.hands, totalRounds);
        }

        const drawn = nextStock[nextStock.length - 1];
        const remainingStock = nextStock.slice(0, -1);
        const nextHands = [...prev.hands];
        nextHands[0] = sortHand([...nextHands[0], drawn], sortMode);
        salonAudio.playCardSnap();
        return {
          ...prev,
          hands: nextHands,
          stock: remainingStock,
          discard: nextDiscard,
          turnStep: 'PLAY_OR_DISCARD',
          drawnFromDiscardId: null,
          speech: { ...prev.speech, 0: 'Pioche' },
        };
      });
    },
    [isHumanDraw, sortMode, totalRounds]
  );

  // Human stages a valid meld toward the 72+ threshold
  const handleStageSelectedMeld = () => {
    if (!selectedValidMeld) return;
    salonAudio.playCardSnap();
    setStagedMelds((prev) => [...prev, selectedValidMeld]);
    setSelectedIds(new Set());
    setFeedbackMessage(null);
  };

  const handleUnstageMeld = (meldId: string) => {
    setStagedMelds((prev) => prev.filter((m) => m.id !== meldId));
    setFeedbackMessage(null);
  };

  const handleClearStaging = () => {
    setStagedMelds([]);
    setSelectedIds(new Set());
    setFeedbackMessage(null);
  };

  // Human commits opening melds (meeting >= requiredThreshold!) OR single meld after opening
  const handleCommitMelds = (meldsToCommit: TableMeld[], isOpening: boolean) => {
    const totalPts = meldsToCommit.reduce((sum, m) => sum + m.points, 0);
    if (isOpening && totalPts < requiredThreshold) {
      setFeedbackMessage(
        `Il vous faut au moins ${requiredThreshold} points pour étaler (${totalPts} pts préparés).`
      );
      return;
    }

    const usedIds = new Set<string>();
    for (const m of meldsToCommit) {
      for (const s of m.slots) usedIds.add(s.card.id);
    }

    setStagedMelds([]);
    setSelectedIds(new Set());
    setFeedbackMessage(null);

    if (isOpening) {
      salonAudio.playBelote();
    } else {
      salonAudio.playBidTake();
    }

    setState((prev) => {
      const nextHands = [...prev.hands];
      nextHands[0] = nextHands[0].filter((c) => !usedIds.has(c.id));

      const nextHasOpened = [...prev.hasOpened];
      const nextOpenedWith = [...prev.openedWith];
      let nextHighest = prev.highestOpeningScore;
      let nextLastOpener = prev.lastOpenerIndex;

      if (isOpening) {
        nextHasOpened[0] = true;
        nextOpenedWith[0] = totalPts;
        nextHighest = totalPts;
        nextLastOpener = 0;
      }

      const nextTableMelds = [...prev.tableMelds, ...meldsToCommit];
      const updatedState: TableState = {
        ...prev,
        hands: nextHands,
        tableMelds: nextTableMelds,
        hasOpened: nextHasOpened,
        openedWith: nextOpenedWith,
        highestOpeningScore: nextHighest,
        lastOpenerIndex: nextLastOpener,
        speech: {
          ...prev.speech,
          0: isOpening ? `Étale ${totalPts} pts !` : `Pose +${totalPts} pts`,
        },
      };

      // Instant victory if hand is completely emptied!
      if (nextHands[0].length === 0) {
        return finishRoundState(updatedState, 0, nextHands, totalRounds);
      }
      return updatedState;
    });
  };

  // Human clicks a highlighted table meld to either swap a Joker or extend it
  const handleClickTableMeld = (meld: TableMeld) => {
    if (!isHumanPlay || !humanOpened || selectedCards.length === 0) return;

    // 1. Check Joker swap first if single real card selected and eligible
    if (selectedCards.length === 1 && swappableMeldIds.has(meld.id)) {
      const card = selectedCards[0];
      const swapRes = trySwapJokerInMeld(meld, card);
      if (swapRes) {
        salonAudio.playBelote();
        setSelectedIds(new Set());
        setFeedbackMessage('Joker récupéré dans votre main !');

        setState((prev) => {
          const nextHands = [...prev.hands];
          nextHands[0] = sortHand(
            [...nextHands[0].filter((c) => c.id !== card.id), swapRes.retrievedJoker],
            sortMode
          );
          const nextTableMelds = prev.tableMelds.map((m) =>
            m.id === meld.id ? swapRes.updatedMeld : m
          );
          return {
            ...prev,
            hands: nextHands,
            tableMelds: nextTableMelds,
            speech: { ...prev.speech, 0: 'Récupère un Joker' },
          };
        });
        return;
      }
    }

    // 2. Extend existing meld
    if (extendableMeldIds.has(meld.id)) {
      const extended = tryExtendTableMeld(meld, selectedCards);
      if (extended) {
        const usedIds = new Set(selectedCards.map((c) => c.id));
        salonAudio.playBidTake();
        setSelectedIds(new Set());
        setFeedbackMessage(null);

        setState((prev) => {
          const nextHands = [...prev.hands];
          nextHands[0] = nextHands[0].filter((c) => !usedIds.has(c.id));
          const nextTableMelds = prev.tableMelds.map((m) =>
            m.id === meld.id ? extended : m
          );
          const updated: TableState = {
            ...prev,
            hands: nextHands,
            tableMelds: nextTableMelds,
            speech: { ...prev.speech, 0: 'Complète le tapis' },
          };
          if (nextHands[0].length === 0) {
            return finishRoundState(updated, 0, nextHands, totalRounds);
          }
          return updated;
        });
      }
    }
  };

  // Human Discard to end turn
  const handleHumanDiscard = () => {
    if (!isHumanPlay) return;
    if (stagedMelds.length > 0) {
      setFeedbackMessage(
        'Étalez votre pose préparée ou cliquez sur « Annuler » avant de défausser.'
      );
      return;
    }
    if (selectedCards.length !== 1) return;

    const card = selectedCards[0];
    if (
      state.drawnFromDiscardId === card.id &&
      state.hands[0].length > 1
    ) {
      setFeedbackMessage(
        'Vous ne pouvez pas défausser immédiatement la carte prise dans la défausse.'
      );
      return;
    }

    salonAudio.playCardSnap();
    setSelectedIds(new Set());
    setFeedbackMessage(null);

    setState((prev) => {
      const nextHands = [...prev.hands];
      nextHands[0] = nextHands[0].filter((c) => c.id !== card.id);
      const nextDiscard = [...prev.discard, card];

      if (nextHands[0].length === 0) {
        return finishRoundState(
          { ...prev, discard: nextDiscard },
          0,
          nextHands,
          totalRounds
        );
      }

      return {
        ...prev,
        hands: nextHands,
        discard: nextDiscard,
        activePlayer: (prev.activePlayer + 1) % prev.players.length,
        turnStep: 'DRAW',
        isInitialTapisCard: false,
        drawnFromDiscardId: null,
        speech: { ...prev.speech, 0: `Défausse ${formatCardShort(card)}` },
      };
    });
  };

  // AI Effect 1: AI Draw step
  useEffect(() => {
    if (
      state.phase !== 'PLAYING' ||
      state.activePlayer === 0 ||
      state.turnStep !== 'DRAW'
    ) {
      return;
    }

    const aiIdx = state.activePlayer;
    const timer = window.setTimeout(() => {
      setState((prev) => {
        if (
          prev.phase !== 'PLAYING' ||
          prev.activePlayer !== aiIdx ||
          prev.turnStep !== 'DRAW'
        ) {
          return prev;
        }

        const topDiscard =
          prev.discard.length > 0 ? prev.discard[prev.discard.length - 1] : null;
        const req = getRequiredThreshold(prev.highestOpeningScore);

        const source = decideAIDrawSource({
          hand: prev.hands[aiIdx],
          topDiscard,
          hasOpened: prev.hasOpened[aiIdx],
          tableMelds: prev.tableMelds,
          playerIndex: aiIdx,
          requiredThreshold: req,
          difficulty,
        });

        if (source === 'discard' && topDiscard) {
          salonAudio.playCardSnap();
          const nextHands = [...prev.hands];
          nextHands[aiIdx] = [...nextHands[aiIdx], topDiscard];
          return {
            ...prev,
            hands: nextHands,
            discard: prev.discard.slice(0, -1),
            turnStep: 'PLAY_OR_DISCARD',
            isInitialTapisCard: false,
            drawnFromDiscardId: topDiscard.id,
            speech: {
              ...prev.speech,
              [aiIdx]: `Prend ${formatCardShort(topDiscard)}`,
            },
          };
        }

        const { nextStock, nextDiscard } = refillStockIfEmpty(prev.stock, prev.discard);
        if (nextStock.length === 0) {
          let bestIdx = 0;
          let bestPen = Infinity;
          prev.hands.forEach((h, i) => {
            const p = computeHandPenalty(h);
            if (p < bestPen) {
              bestPen = p;
              bestIdx = i;
            }
          });
          return finishRoundState(prev, bestIdx, prev.hands, totalRounds);
        }

        const drawn = nextStock[nextStock.length - 1];
        salonAudio.playCardSnap();
        const nextHands = [...prev.hands];
        nextHands[aiIdx] = [...nextHands[aiIdx], drawn];

        return {
          ...prev,
          hands: nextHands,
          stock: nextStock.slice(0, -1),
          discard: nextDiscard,
          turnStep: 'PLAY_OR_DISCARD',
          drawnFromDiscardId: null,
          speech: { ...prev.speech, [aiIdx]: 'Pioche' },
        };
      });
    }, 640);

    return () => window.clearTimeout(timer);
  }, [state.phase, state.activePlayer, state.turnStep, difficulty, totalRounds]);

  // AI Effect 2: AI Play Melds / Extend / Discard step
  useEffect(() => {
    if (
      state.phase !== 'PLAYING' ||
      state.activePlayer === 0 ||
      state.turnStep !== 'PLAY_OR_DISCARD'
    ) {
      return;
    }

    const aiIdx = state.activePlayer;
    const timer = window.setTimeout(() => {
      setState((prev) => {
        if (
          prev.phase !== 'PLAYING' ||
          prev.activePlayer !== aiIdx ||
          prev.turnStep !== 'PLAY_OR_DISCARD'
        ) {
          return prev;
        }

        let hand = [...prev.hands[aiIdx]];
        let tableMelds = [...prev.tableMelds];
        const nextHasOpened = [...prev.hasOpened];
        const nextOpenedWith = [...prev.openedWith];
        let nextHighest = prev.highestOpeningScore;
        let nextLastOpener = prev.lastOpenerIndex;
        let actionNote = '';

        // 1. If not opened yet -> check if AI can beat the current threshold!
        if (!nextHasOpened[aiIdx]) {
          const req = getRequiredThreshold(nextHighest);
          const best = findBestDisjointMelds(hand, aiIdx);
          if (best.totalPoints >= req && best.melds.length > 0) {
            hand = hand.filter((c) => !best.usedCardIds.has(c.id));
            tableMelds = [...tableMelds, ...best.melds];
            nextHasOpened[aiIdx] = true;
            nextOpenedWith[aiIdx] = best.totalPoints;
            nextHighest = best.totalPoints;
            nextLastOpener = aiIdx;
            actionNote = `Étale ${best.totalPoints} pts !`;
            salonAudio.playBelote();
          }
        }

        // 2. If opened -> swap jokers (Maître/Salon), lay down new melds, extend existing table melds
        if (nextHasOpened[aiIdx] && hand.length > 0) {
          // 2a. Swap jokers if holding exact match
          if (difficulty !== 'detente') {
            for (let mIdx = 0; mIdx < tableMelds.length; mIdx++) {
              for (let cIdx = 0; cIdx < hand.length; cIdx++) {
                const res = trySwapJokerInMeld(tableMelds[mIdx], hand[cIdx]);
                if (res) {
                  tableMelds[mIdx] = res.updatedMeld;
                  hand.splice(cIdx, 1, res.retrievedJoker);
                  if (!actionNote) actionNote = 'Récupère un Joker';
                  break;
                }
              }
            }
          }

          // 2b. Lay down any new valid melds from remaining hand
          const extra = findBestDisjointMelds(hand, aiIdx);
          if (extra.melds.length > 0) {
            hand = hand.filter((c) => !extra.usedCardIds.has(c.id));
            tableMelds = [...tableMelds, ...extra.melds];
            if (!actionNote) actionNote = `Pose +${extra.totalPoints} pts`;
            salonAudio.playBidTake();
          }

          // 2c. Append compatible cards onto any table meld (loop until fixed point)
          let extendedAny = true;
          while (extendedAny && hand.length > 0) {
            extendedAny = false;
            for (let cIdx = 0; cIdx < hand.length; cIdx++) {
              const card = hand[cIdx];
              // Avoid unnecessarily giving away a Joker if hand still has > 2 cards
              if (card.isJoker && hand.length > 2) continue;

              for (let mIdx = 0; mIdx < tableMelds.length; mIdx++) {
                const extended = tryExtendTableMeld(tableMelds[mIdx], [card]);
                if (extended) {
                  tableMelds[mIdx] = extended;
                  hand.splice(cIdx, 1);
                  extendedAny = true;
                  if (!actionNote) actionNote = 'Complète le tapis';
                  break;
                }
              }
              if (extendedAny) break;
            }
          }
        }

        const nextHands = [...prev.hands];
        nextHands[aiIdx] = hand;

        const baseUpdated: TableState = {
          ...prev,
          hands: nextHands,
          tableMelds,
          hasOpened: nextHasOpened,
          openedWith: nextOpenedWith,
          highestOpeningScore: nextHighest,
          lastOpenerIndex: nextLastOpener,
        };

        // Did AI empty its entire hand on melds/extensions?
        if (hand.length === 0) {
          return finishRoundState(baseUpdated, aiIdx, nextHands, totalRounds);
        }

        // 3. Discard 1 card
        const discardCard = chooseAIDiscard({
          hand,
          forbiddenDiscardId: prev.drawnFromDiscardId,
          tableMelds,
          difficulty,
          playerIndex: aiIdx,
        });

        const remainingAfterDiscard = hand.filter((c) => c.id !== discardCard.id);
        nextHands[aiIdx] = remainingAfterDiscard;
        const nextDiscard = [...prev.discard, discardCard];
        salonAudio.playCardSnap();

        if (remainingAfterDiscard.length === 0) {
          return finishRoundState(
            { ...baseUpdated, discard: nextDiscard },
            aiIdx,
            nextHands,
            totalRounds
          );
        }

        return {
          ...baseUpdated,
          hands: nextHands,
          discard: nextDiscard,
          activePlayer: (aiIdx + 1) % prev.players.length,
          turnStep: 'DRAW',
          isInitialTapisCard: false,
          drawnFromDiscardId: null,
          speech: {
            ...prev.speech,
            [aiIdx]: actionNote
              ? `${actionNote} · Jette ${formatCardShort(discardCard)}`
              : `Défausse ${formatCardShort(discardCard)}`,
          },
        };
      });
    }, 780);

    return () => window.clearTimeout(timer);
  }, [state.phase, state.activePlayer, state.turnStep, difficulty, totalRounds]);

  // Keyboard shortcuts (Escape clears selection / closes rules, R opens rules)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (rulesOpen) setRulesOpen(false);
        else setSelectedIds(new Set());
      } else if (e.key === 'r' || e.key === 'R') {
        setRulesOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [rulesOpen]);

  const handleNextRound = () => {
    salonAudio.playDeal();
    setSelectedIds(new Set());
    setStagedMelds([]);
    setFeedbackMessage(null);
    setState((prev) =>
      dealNewRound({
        roundNumber: prev.roundNumber + 1,
        players: prev.players,
        cumulativePenalty: prev.cumulativePenalty,
        roundsWon: prev.roundsWon,
        sortMode,
      })
    );
  };

  const handleRestartMatch = () => {
    salonAudio.playDeal();
    setSelectedIds(new Set());
    setStagedMelds([]);
    setFeedbackMessage(null);
    const players = buildPlayersForCount(playerCount);
    setState(
      dealNewRound({
        roundNumber: 1,
        players,
        cumulativePenalty: players.map(() => 0),
        roundsWon: players.map(() => 0),
        sortMode,
      })
    );
  };

  const opponents = state.players.slice(1);
  const topDiscard =
    state.discard.length > 0 ? state.discard[state.discard.length - 1] : null;

  const canDirectOpenWithSelection =
    isHumanPlay &&
    !humanOpened &&
    stagedMelds.length === 0 &&
    selectedValidMeld !== null &&
    selectedValidMeld.points >= requiredThreshold;

  const canCommitStagedOpening =
    isHumanPlay &&
    !humanOpened &&
    stagedMelds.length > 0 &&
    stagedTotalPoints >= requiredThreshold;

  const canDiscardSelected =
    isHumanPlay &&
    stagedMelds.length === 0 &&
    selectedCards.length === 1 &&
    !(
      state.drawnFromDiscardId === selectedCards[0].id &&
      state.hands[0].length > 1
    );

  // Dynamic card overlap for player's hand so 15 cards fit comfortably without scrolling
  const handOverlapClass =
    visibleHumanHand.length >= 13
      ? '-space-x-5 sm:-space-x-4 md:-space-x-3 lg:-space-x-2'
      : visibleHumanHand.length >= 10
      ? '-space-x-4 sm:-space-x-2 md:-space-x-1'
      : '-space-x-2 sm:space-x-1';

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[#07130E] text-[#F5F2EB]">
      {/* Strict 3-Zone Top Bar */}
      <header className="z-30 flex items-center justify-between gap-4 border-b border-white/10 bg-[#081510]/95 px-4 py-2.5 sm:px-6">
        <button
          type="button"
          onClick={onExitToMenu}
          className="font-display text-lg font-semibold tracking-tight text-[#FDFBF7] whitespace-nowrap shrink-0 transition-colors hover:text-[#E5C158] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5C158] rounded"
        >
          Rami 72
        </button>

        {/* Clean unboxed tabular status */}
        <div
          aria-live="polite"
          className="hidden items-center gap-3 text-sm md:flex whitespace-nowrap"
        >
          <span className="text-[#B8C7C0]">
            Manche{' '}
            <strong className="font-mono tabular-nums text-white">
              {state.roundNumber}/{totalRounds}
            </strong>
          </span>
          <span aria-hidden="true" className="text-white/25">
            ·
          </span>
          {state.highestOpeningScore === null ? (
            <span className="text-[#E5C158] font-medium">
              Seuil d’ouverture :{' '}
              <strong className="font-mono font-semibold tabular-nums text-white">
                72 pts
              </strong>
            </span>
          ) : (
            <span className="text-[#E5C158] font-medium">
              Seuil à battre :{' '}
              <strong className="font-mono font-semibold tabular-nums text-white">
                {requiredThreshold}+ pts
              </strong>{' '}
              <span className="text-xs text-[#A8BBB2]">
                ({state.players[state.lastOpenerIndex!]?.name} :{' '}
                {state.highestOpeningScore} pts)
              </span>
            </span>
          )}
          <span aria-hidden="true" className="text-white/25">
            ·
          </span>
          <span className="text-xs text-[#9BB0A7] font-mono tabular-nums">
            {playerCount} joueurs
          </span>
        </div>

        {/* Utility buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setRulesOpen(true)}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#D4DDD9] whitespace-nowrap shrink-0 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5C158]"
            title="Règles du Rami 72 (R)"
          >
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Règles</span>
          </button>

          <button
            type="button"
            onClick={toggleSound}
            aria-label={soundEnabled ? 'Couper le son' : 'Activer le son'}
            className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-lg text-[#D4DDD9] shrink-0 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5C158]"
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4 text-[#8DA198]" />
            )}
          </button>

          <button
            type="button"
            onClick={handleRestartMatch}
            aria-label="Recommencer la partie"
            title="Recommencer la partie"
            className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-lg text-[#D4DDD9] shrink-0 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5C158]"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Felt Card Table */}
      <main className="relative flex flex-1 flex-col justify-between overflow-hidden felt-surface">
        {!feltFailed && (
          <img
            src={FELT_TABLE_IMAGE}
            alt=""
            aria-hidden="true"
            referrerPolicy="no-referrer"
            onError={() => setFeltFailed(true)}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-80"
          />
        )}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(12,68,45,0.18)_0%,rgba(6,22,15,0.58)_74%,rgba(4,14,10,0.86)_100%)]"
        />

        {/* TOP ZONE: Opponents Strip (1, 2, or 3 opponents cleanly aligned) */}
        <section
          aria-label="Adversaires"
          className="relative z-10 mx-auto flex w-full max-w-6xl flex-wrap items-start justify-center gap-3 px-4 pt-3 sm:gap-6 sm:px-6 sm:pt-4"
        >
          {opponents.map((opp) => {
            const isActive = state.phase === 'PLAYING' && state.activePlayer === opp.index;
            const oppCards = state.hands[opp.index];
            const oppOpened = state.hasOpened[opp.index];
            const oppOpenPts = state.openedWith[opp.index];
            const note = state.speech[opp.index];

            return (
              <div
                key={opp.index}
                className={`flex min-w-[165px] flex-1 max-w-[280px] flex-col rounded-xl border px-3.5 py-2.5 backdrop-blur-xs transition-colors ${
                  isActive
                    ? 'border-[#E5C158]/60 bg-[#0A2218]/90'
                    : 'border-white/10 bg-[#071610]/75'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`truncate font-semibold ${
                        isActive ? 'text-[#E5C158]' : 'text-[#F5F2EB]'
                      }`}
                    >
                      {opp.name}
                    </span>
                    {isActive && (
                      <span className="text-[11px] font-medium text-[#E5C158] whitespace-nowrap">
                        · Son tour
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[11px] tabular-nums text-[#C8D4CE] whitespace-nowrap">
                    {oppCards.length} {oppCards.length > 1 ? 'cartes' : 'carte'}
                  </span>
                </div>

                {/* Unboxed status + mini card fan */}
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <div className="min-w-0 text-[11px] text-[#9FB3AA]">
                    {oppOpened ? (
                      <span className="text-[#D4AF37]">
                        Ouvert ({oppOpenPts} pts)
                      </span>
                    ) : (
                      <span>Non ouvert</span>
                    )}
                    {note && (
                      <span className="block truncate text-[#D4DDD9]">{note}</span>
                    )}
                  </div>

                  {/* Mini visual deck count indicator */}
                  <div className="hidden items-center -space-x-7 sm:flex" aria-hidden="true">
                    {Array.from({ length: Math.min(oppCards.length, 6) }).map((_, i) => (
                      <CardBack key={i} size="xs" className="scale-75 origin-right" />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* MIDDLE ZONE: Pioche & Défausse (Left) + Tapis des Combinaisons (Right) */}
        <section className="relative z-10 mx-auto my-2 flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-3 px-4 sm:flex-row sm:gap-5 sm:px-6">
          {/* Left Column: Seuil 72 Card + Pioche & Défausse */}
          <aside
            aria-label="Pioche, défausse et seuil du 72"
            className="flex shrink-0 flex-row items-center justify-between gap-3 rounded-2xl border border-[#D4AF37]/20 bg-[#071610]/78 p-3.5 backdrop-blur-xs sm:w-56 sm:flex-col sm:justify-center sm:gap-4 sm:p-4"
          >
            {/* Live Threshold Plaque */}
            <div className="text-left sm:w-full sm:border-b sm:border-white/10 sm:pb-3 sm:text-center">
              <p className="text-[11px] font-medium text-[#A3B6AD]">
                {humanOpened
                  ? 'Votre statut'
                  : state.highestOpeningScore === null
                  ? 'Seuil initial'
                  : 'Seuil à dépasser'}
              </p>
              {humanOpened ? (
                <p className="mt-0.5 font-display text-lg font-semibold text-[#E5C158]">
                  Ouvert ({state.openedWith[0]} pts)
                </p>
              ) : (
                <p className="mt-0.5 font-mono text-2xl font-semibold tabular-nums text-[#E5C158]">
                  {requiredThreshold} pts
                </p>
              )}
              <p className="mt-0.5 text-[11px] text-[#B8C7C0]">
                {humanOpened
                  ? 'Posez et complétez librement'
                  : state.highestOpeningScore === null
                  ? 'Premier à étaler ≥ 72 pts'
                  : `> ${state.highestOpeningScore} pts (${state.players[state.lastOpenerIndex!]?.name})`}
              </p>
            </div>

            {/* Pioche & Défausse Interactive Slots */}
            <div className="flex items-center gap-4 sm:gap-5">
              {/* Pioche */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => handleHumanDraw('stock')}
                  disabled={!isHumanDraw}
                  aria-label={`Piocher une carte (${state.stock.length} restantes)`}
                  className={`group relative rounded-lg transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5C158] ${
                    isHumanDraw
                      ? 'cursor-pointer hover:-translate-y-1 ring-2 ring-[#E5C158]/80 ring-offset-2 ring-offset-[#071610]'
                      : 'cursor-default opacity-90'
                  }`}
                >
                  <CardBack size="sm" className="translate-x-1 translate-y-1 opacity-70" />
                  <CardBack size="sm" className="absolute inset-0" />
                </button>
                <span className="mt-1.5 font-mono text-[11px] tabular-nums text-[#D4DDD9]">
                  Pioche ({state.stock.length})
                </span>
              </div>

              {/* Défausse */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => {
                    if (isHumanDraw && topDiscard) {
                      handleHumanDraw('discard');
                    } else if (canDiscardSelected) {
                      handleHumanDiscard();
                    }
                  }}
                  disabled={!(isHumanDraw && topDiscard) && !canDiscardSelected}
                  aria-label={
                    isHumanDraw && topDiscard
                      ? `Prendre la carte de la défausse : ${formatCardShort(topDiscard)}`
                      : canDiscardSelected
                      ? 'Défausser la carte sélectionnée'
                      : 'Défausse'
                  }
                  className={`relative rounded-lg transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5C158] ${
                    (isHumanDraw && topDiscard) || canDiscardSelected
                      ? 'cursor-pointer hover:-translate-y-1 ring-2 ring-[#E5C158]/80 ring-offset-2 ring-offset-[#071610]'
                      : 'cursor-default'
                  }`}
                >
                  {topDiscard ? (
                    <PlayingCard card={topDiscard} size="sm" />
                  ) : (
                    <div className="flex h-20 w-14 items-center justify-center rounded-lg border border-dashed border-white/25 text-[10px] text-[#98ABA3] sm:h-23 sm:w-16">
                      Vide
                    </div>
                  )}
                </button>
                <span className="mt-1.5 text-[11px] text-[#D4DDD9] whitespace-nowrap">
                  {canDiscardSelected
                    ? 'Défausser ici'
                    : state.isInitialTapisCard && topDiscard
                    ? '15e au tapis'
                    : 'Tapis'}
                </span>
              </div>
            </div>
          </aside>

          {/* Right Column: Felt Meld Canvas */}
          <section
            aria-label="Combinaisons étalées sur le tapis"
            className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#D4AF37]/18 bg-[#061810]/38 p-3.5 backdrop-blur-[1px] sm:p-4"
          >
            <div className="mb-2.5 flex items-center justify-between gap-2 text-xs text-[#B8C7C0]">
              <span className="font-medium text-[#E4ECE8]">
                Tapis des combinaisons ({state.tableMelds.length})
              </span>
              {humanOpened && extendableMeldIds.size > 0 && (
                <span className="font-medium text-[#E5C158]">
                  Cliquez sur une combinaison dorée pour compléter
                </span>
              )}
              {humanOpened &&
                extendableMeldIds.size === 0 &&
                swappableMeldIds.size > 0 && (
                  <span className="font-medium text-[#E5C158]">
                    Cliquez sur la combinaison pour récupérer le Joker
                  </span>
                )}
            </div>

            {state.tableMelds.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-white/12 px-6 py-6 text-center">
                <p className="font-display text-lg text-[#E4ECE8]">
                  Le tapis attend la première ouverture à 72 points
                </p>
                <p className="mt-1 max-w-md text-xs leading-relaxed text-[#9BB0A7]">
                  Préparez vos suites (même couleur) et vos trios ou carrés (couleurs
                  différentes) jusqu’à atteindre au moins 72 points pour étaler.
                </p>
              </div>
            ) : (
              <div className="flex flex-1 flex-wrap content-start gap-3 overflow-y-auto pr-1">
                <AnimatePresence>
                  {state.tableMelds.map((meld) => {
                    const canExtend = extendableMeldIds.has(meld.id);
                    const canSwap = swappableMeldIds.has(meld.id);
                    const isTarget = canExtend || canSwap;
                    const ownerName = state.players[meld.ownerIndex]?.name ?? '';

                    return (
                      <motion.div
                        key={meld.id}
                        initial={{ opacity: 0, scale: 0.94, y: 6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <button
                          type="button"
                          onClick={() => isTarget && handleClickTableMeld(meld)}
                          disabled={!isTarget}
                          className={`group flex flex-col items-start rounded-xl border p-2 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5C158] ${
                            isTarget
                              ? 'cursor-pointer border-[#E5C158] bg-[#163C2B]/90 shadow-[0_0_20px_rgba(212,175,55,0.28)] hover:bg-[#1C4A35]'
                              : 'cursor-default border-white/10 bg-[#081A13]/75'
                          }`}
                        >
                          <div className="mb-1.5 flex w-full items-center justify-between gap-2 text-[11px]">
                            <span className="text-[#B8C7C0]">
                              {ownerName} ·{' '}
                              <span className="font-mono tabular-nums text-[#E5C158]">
                                {meld.points} pts
                              </span>
                            </span>
                            {canSwap ? (
                              <span className="font-semibold text-[#E5C158]">
                                Échanger Joker
                              </span>
                            ) : canExtend ? (
                              <span className="font-semibold text-[#E5C158]">
                                + Compléter
                              </span>
                            ) : null}
                          </div>

                          <div className="flex items-center -space-x-2.5">
                            {meld.slots.map((slot) => (
                              <PlayingCard
                                key={slot.card.id}
                                card={slot.card}
                                size="table"
                                represents={
                                  slot.card.isJoker
                                    ? {
                                        rank: slot.effectiveRank,
                                        suit: slot.effectiveSuit,
                                      }
                                    : undefined
                                }
                              />
                            ))}
                          </div>
                        </button>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </section>
        </section>

        {/* BOTTOM ZONE: Staging Strip (when preparing 72+ opening) + Action Bar + Player Hand */}
        <section
          aria-label="Votre main et vos actions"
          className="relative z-20 mx-auto flex w-full max-w-6xl flex-col items-center px-3 pb-3 pt-1 sm:px-6 sm:pb-4"
        >
          {/* Pre-opening Staging Strip */}
          {stagedMelds.length > 0 && (
            <div className="mb-2 flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-[#D4AF37]/40 bg-[#081B13]/92 px-3.5 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-[#E5C158]">
                  Pose préparée :{' '}
                  <strong className="font-mono tabular-nums text-white">
                    {stagedTotalPoints} / {requiredThreshold} pts
                  </strong>
                </span>
                {stagedMelds.map((m) => (
                  <div
                    key={m.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-2.5 py-1 text-xs"
                  >
                    <span className="font-mono text-[#FDFBF7]">
                      {m.slots.map((s) => formatCardShort(s.card)).join(' ')}
                    </span>
                    <span className="font-mono text-[11px] text-[#E5C158]">
                      ({m.points})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUnstageMeld(m.id)}
                      aria-label="Retirer cette combinaison de la préparation"
                      className="ml-0.5 rounded p-0.5 text-[#A8BBB2] hover:bg-white/10 hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClearStaging}
                  className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1 text-xs font-medium text-[#D4DDD9] whitespace-nowrap shrink-0 hover:bg-white/10"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  Annuler
                </button>
                {canCommitStagedOpening && (
                  <button
                    type="button"
                    onClick={() => handleCommitMelds(stagedMelds, true)}
                    className="min-h-[36px] rounded-lg bg-[#D4AF37] px-3.5 py-1 text-xs font-semibold text-[#081510] whitespace-nowrap shrink-0 transition-colors hover:bg-[#E5C158]"
                  >
                    Étaler sur le tapis ({stagedTotalPoints} pts)
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Action & Guidance Bar */}
          <div className="mb-2.5 flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#071610]/85 px-3.5 py-2 backdrop-blur-xs">
            {/* Left: Status / Turn Prompt + Live Hand Count */}
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs sm:text-sm">
              <span className="font-mono text-xs tabular-nums text-[#A8BBB2] whitespace-nowrap">
                Main : <strong className="text-white">{visibleHumanHand.length}</strong>{' '}
                {visibleHumanHand.length > 1 ? 'cartes' : 'carte'}
              </span>
              <span aria-hidden="true" className="text-white/25">
                ·
              </span>
              {feedbackMessage ? (
                <span className="font-medium text-[#FBBF24]">{feedbackMessage}</span>
              ) : isHumanDraw ? (
                <span className="font-medium text-[#E5C158]">
                  {state.isInitialTapisCard
                    ? 'À vous · Prenez la 15e carte au tapis ou piochez'
                    : 'À vous · Prenez la carte du tapis ou piochez'}
                </span>
              ) : isHumanPlay ? (
                <span className="font-medium text-[#E4ECE8]">
                  {selectedValidMeld
                    ? `Combinaison valide (${selectedValidMeld.type === 'run' ? 'Suite' : 'Trio/Carré'} · ${selectedValidMeld.points} pts)`
                    : selectedCards.length > 0
                    ? `${selectedCards.length} ${selectedCards.length > 1 ? 'cartes sélectionnées' : 'carte sélectionnée'}`
                    : humanOpened
                    ? 'Sélectionnez des cartes pour poser, compléter ou défausser'
                    : `Sélectionnez des cartes pour préparer ${requiredThreshold}+ pts ou défaussez 1 carte`}
                </span>
              ) : (
                <span className="text-[#B8C7C0]">
                  Tour de {state.players[state.activePlayer]?.name}…
                </span>
              )}
            </div>

            {/* Middle/Right: Context Action Buttons + Sort Toggle */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Pre-opening actions */}
              {isHumanPlay && !humanOpened && selectedValidMeld && (
                canDirectOpenWithSelection ? (
                  <button
                    type="button"
                    onClick={() => handleCommitMelds([selectedValidMeld], true)}
                    className="min-h-[38px] rounded-lg bg-[#D4AF37] px-3.5 py-1.5 text-xs font-semibold text-[#081510] whitespace-nowrap shrink-0 transition-colors hover:bg-[#E5C158]"
                  >
                    Étaler sur le tapis ({selectedValidMeld.points} pts)
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStageSelectedMeld}
                    className="min-h-[38px] rounded-lg bg-[#D4AF37] px-3.5 py-1.5 text-xs font-semibold text-[#081510] whitespace-nowrap shrink-0 transition-colors hover:bg-[#E5C158]"
                  >
                    Ajouter à ma pose (+{selectedValidMeld.points} pts)
                  </button>
                )
              )}

              {/* Post-opening direct meld */}
              {isHumanPlay && humanOpened && selectedValidMeld && (
                <button
                  type="button"
                  onClick={() => handleCommitMelds([selectedValidMeld], false)}
                  className="min-h-[38px] rounded-lg bg-[#D4AF37] px-3.5 py-1.5 text-xs font-semibold text-[#081510] whitespace-nowrap shrink-0 transition-colors hover:bg-[#E5C158]"
                >
                  Poser ({selectedValidMeld.points} pts)
                </button>
              )}

              {/* Discard button */}
              {isHumanPlay && selectedCards.length === 1 && stagedMelds.length === 0 && (
                <button
                  type="button"
                  onClick={handleHumanDiscard}
                  disabled={!canDiscardSelected}
                  className="min-h-[38px] rounded-lg border border-[#D4AF37]/50 bg-[#143527] px-3.5 py-1.5 text-xs font-semibold text-[#FDFBF7] whitespace-nowrap shrink-0 transition-colors hover:bg-[#1B4634] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Défausser {formatCardShort(selectedCards[0])}
                </button>
              )}

              {/* Sort Mode Segmented Control */}
              <div
                role="group"
                aria-label="Trier la main"
                className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.04] p-0.5"
              >
                <button
                  type="button"
                  onClick={() => handleChangeSortMode('suit')}
                  className={`inline-flex min-h-[34px] items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                    sortMode === 'suit'
                      ? 'bg-[#173A2A] text-[#FDFBF7]'
                      : 'text-[#A6B7AF] hover:text-white'
                  }`}
                  title="Trier par couleur pour voir les suites"
                >
                  <Layers className="h-3.5 w-3.5" />
                  Suites
                </button>
                <button
                  type="button"
                  onClick={() => handleChangeSortMode('rank')}
                  className={`inline-flex min-h-[34px] items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                    sortMode === 'rank'
                      ? 'bg-[#173A2A] text-[#FDFBF7]'
                      : 'text-[#A6B7AF] hover:text-white'
                  }`}
                  title="Trier par valeur pour voir les trios et carrés"
                >
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  Trios
                </button>
              </div>
            </div>
          </div>

          {/* Player's Interactive 14-Card Hand */}
          <div className={`flex max-w-full items-end justify-center pt-3 ${handOverlapClass}`}>
            {visibleHumanHand.map((card, index) => {
              const isSelected = selectedIds.has(card.id);
              return (
                <div
                  key={card.id}
                  style={{ zIndex: isSelected ? 40 + index : index + 1 }}
                  className="hover:z-50 focus-within:z-50"
                >
                  <PlayingCard
                    card={card}
                    size="md"
                    interactive
                    selected={isSelected}
                    disabled={!isHumanPlay}
                    onClick={() => toggleSelectCard(card.id)}
                  />
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Round Summary / Game Over Modal */}
      {(state.phase === 'ROUND_SUMMARY' || state.phase === 'GAME_OVER') &&
        state.roundResult && (
          <RoundModal
            result={state.roundResult}
            totalRounds={totalRounds}
            isGameOver={state.phase === 'GAME_OVER'}
            onNextRound={handleNextRound}
            onRestartMatch={handleRestartMatch}
            onReturnMenu={onExitToMenu}
          />
        )}

      {/* Rules Slide-Over Drawer */}
      <RulesDrawer open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  );
}
