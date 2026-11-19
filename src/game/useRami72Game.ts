import { useCallback, useEffect, useMemo, useState } from 'react';
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
} from './rami72Engine';
import { ramiAudio } from './sound';
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
} from './types';

export const INITIAL_THRESHOLD = 72;

type SoundCueKind =
  | 'snap'
  | 'deal'
  | 'meld'
  | 'open72'
  | 'round_win'
  | 'round_lose';

interface SoundCue {
  seq: number;
  kind: SoundCueKind;
}

export interface TableState {
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
  soundCue: SoundCue | null;
}

function nextSoundCue(prev: TableState | null, kind: SoundCueKind): SoundCue {
  return {
    seq: (prev?.soundCue?.seq ?? 0) + 1,
    kind,
  };
}

export function getRequiredThreshold(highestOpeningScore: number | null): number {
  return highestOpeningScore === null
    ? INITIAL_THRESHOLD
    : highestOpeningScore + 1;
}

export function formatCardShort(card: Card): string {
  if (card.isJoker) return 'Joker';
  return `${card.rank}${SUIT_META[card.suit!].symbol}`;
}

function dealNewRound(params: {
  roundNumber: number;
  players: PlayerConfig[];
  cumulativePenalty: number[];
  roundsWon: number[];
  sortMode: SortMode;
  soundCue?: SoundCue | null;
}): TableState {
  const {
    roundNumber,
    players,
    cumulativePenalty,
    roundsWon,
    sortMode,
    soundCue = null,
  } = params;
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
    soundCue,
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

  return {
    ...prev,
    hands: finalHands,
    phase: prev.roundNumber >= totalRounds ? 'GAME_OVER' : 'ROUND_SUMMARY',
    cumulativePenalty: nextCumulative,
    roundsWon: nextRoundsWon,
    roundResult,
    soundCue: nextSoundCue(prev, winnerIndex === 0 ? 'round_win' : 'round_lose'),
  };
}

function refillStockIfEmpty(
  stock: Card[],
  discard: Card[]
): {
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

export function useRami72Game(params: {
  playerCount: PlayerCount;
  totalRounds: TotalRounds;
  difficulty: Difficulty;
}) {
  const { playerCount, totalRounds, difficulty } = params;

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

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [stagedMelds, setStagedMelds] = useState<TableMeld[]>([]);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() =>
    ramiAudio.isEnabled()
  );
  const [rulesOpen, setRulesOpen] = useState(false);

  // Trigger audio cues outside React state updater functions
  useEffect(() => {
    const cue = state.soundCue;
    if (!cue) return;
    switch (cue.kind) {
      case 'snap':
        ramiAudio.playCardSnap();
        break;
      case 'deal':
        ramiAudio.playDeal();
        break;
      case 'meld':
        ramiAudio.playMeld();
        break;
      case 'open72':
        ramiAudio.playOpen72();
        break;
      case 'round_win':
        ramiAudio.playRoundEnd(true);
        break;
      case 'round_lose':
        ramiAudio.playRoundEnd(false);
        break;
    }
  }, [state.soundCue]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      ramiAudio.setEnabled(next);
      return next;
    });
  }, []);

  const humanHand = state.hands[0];
  const isHumanTurn = state.phase === 'PLAYING' && state.activePlayer === 0;
  const isHumanDraw = isHumanTurn && state.turnStep === 'DRAW';
  const isHumanPlay = isHumanTurn && state.turnStep === 'PLAY_OR_DISCARD';
  const humanOpened = state.hasOpened[0];
  const requiredThreshold = getRequiredThreshold(state.highestOpeningScore);

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

  const handleChangeSortMode = useCallback((mode: SortMode) => {
    setSortMode(mode);
    setState((prev) => {
      const nextHands = [...prev.hands];
      nextHands[0] = sortHand(nextHands[0], mode);
      return { ...prev, hands: nextHands };
    });
  }, []);

  const toggleSelectCard = useCallback(
    (cardId: string) => {
      if (!isHumanPlay) return;
      setFeedbackMessage(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(cardId)) next.delete(cardId);
        else next.add(cardId);
        return next;
      });
    },
    [isHumanPlay]
  );

  const handleHumanDraw = useCallback(
    (source: 'stock' | 'discard') => {
      if (!isHumanDraw) return;
      setFeedbackMessage(null);
      setSelectedIds(new Set());
      setStagedMelds([]);

      setState((prev) => {
        if (
          prev.phase !== 'PLAYING' ||
          prev.activePlayer !== 0 ||
          prev.turnStep !== 'DRAW'
        ) {
          return prev;
        }

        if (source === 'discard') {
          if (prev.discard.length === 0) return prev;
          const drawn = prev.discard[prev.discard.length - 1];
          const nextDiscard = prev.discard.slice(0, -1);
          const nextHands = [...prev.hands];
          nextHands[0] = sortHand([...nextHands[0], drawn], sortMode);
          return {
            ...prev,
            hands: nextHands,
            discard: nextDiscard,
            turnStep: 'PLAY_OR_DISCARD',
            isInitialTapisCard: false,
            drawnFromDiscardId: drawn.id,
            speech: { ...prev.speech, 0: `Prend ${formatCardShort(drawn)}` },
            soundCue: nextSoundCue(prev, 'snap'),
          };
        }

        const { nextStock, nextDiscard } = refillStockIfEmpty(
          prev.stock,
          prev.discard
        );
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
        const remainingStock = nextStock.slice(0, -1);
        const nextHands = [...prev.hands];
        nextHands[0] = sortHand([...nextHands[0], drawn], sortMode);
        return {
          ...prev,
          hands: nextHands,
          stock: remainingStock,
          discard: nextDiscard,
          turnStep: 'PLAY_OR_DISCARD',
          drawnFromDiscardId: null,
          speech: { ...prev.speech, 0: 'Pioche' },
          soundCue: nextSoundCue(prev, 'snap'),
        };
      });
    },
    [isHumanDraw, sortMode, totalRounds]
  );

  const handleStageSelectedMeld = useCallback(() => {
    if (!selectedValidMeld) return;
    ramiAudio.playCardSnap();
    setStagedMelds((prev) => [...prev, selectedValidMeld]);
    setSelectedIds(new Set());
    setFeedbackMessage(null);
  }, [selectedValidMeld]);

  const handleUnstageMeld = useCallback((meldId: string) => {
    setStagedMelds((prev) => prev.filter((m) => m.id !== meldId));
    setFeedbackMessage(null);
  }, []);

  const handleClearStaging = useCallback(() => {
    setStagedMelds([]);
    setSelectedIds(new Set());
    setFeedbackMessage(null);
  }, []);

  const handleCommitMelds = useCallback(
    (meldsToCommit: TableMeld[], isOpening: boolean) => {
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
          soundCue: nextSoundCue(prev, isOpening ? 'open72' : 'meld'),
        };

        if (nextHands[0].length === 0) {
          return finishRoundState(updatedState, 0, nextHands, totalRounds);
        }
        return updatedState;
      });
    },
    [requiredThreshold, totalRounds]
  );

  const handleClickTableMeld = useCallback(
    (meld: TableMeld) => {
      if (!isHumanPlay || !humanOpened || selectedCards.length === 0) return;

      if (selectedCards.length === 1 && swappableMeldIds.has(meld.id)) {
        const card = selectedCards[0];
        const swapRes = trySwapJokerInMeld(meld, card);
        if (swapRes) {
          setSelectedIds(new Set());
          setFeedbackMessage('Joker récupéré dans votre main !');

          setState((prev) => {
            const nextHands = [...prev.hands];
            nextHands[0] = sortHand(
              [
                ...nextHands[0].filter((c) => c.id !== card.id),
                swapRes.retrievedJoker,
              ],
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
              soundCue: nextSoundCue(prev, 'open72'),
            };
          });
          return;
        }
      }

      if (extendableMeldIds.has(meld.id)) {
        const extended = tryExtendTableMeld(meld, selectedCards);
        if (extended) {
          const usedIds = new Set(selectedCards.map((c) => c.id));
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
              soundCue: nextSoundCue(prev, 'meld'),
            };
            if (nextHands[0].length === 0) {
              return finishRoundState(updated, 0, nextHands, totalRounds);
            }
            return updated;
          });
        }
      }
    },
    [
      isHumanPlay,
      humanOpened,
      selectedCards,
      swappableMeldIds,
      extendableMeldIds,
      sortMode,
      totalRounds,
    ]
  );

  const handleHumanDiscard = useCallback(() => {
    if (!isHumanPlay) return;
    if (stagedMelds.length > 0) {
      setFeedbackMessage(
        'Étalez votre pose préparée ou cliquez sur « Annuler » avant de défausser.'
      );
      return;
    }
    if (selectedCards.length !== 1) return;

    const card = selectedCards[0];
    if (state.drawnFromDiscardId === card.id && state.hands[0].length > 1) {
      setFeedbackMessage(
        'Vous ne pouvez pas défausser immédiatement la carte prise dans la défausse.'
      );
      return;
    }

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
        soundCue: nextSoundCue(prev, 'snap'),
      };
    });
  }, [
    isHumanPlay,
    stagedMelds.length,
    selectedCards,
    state.drawnFromDiscardId,
    state.hands,
    totalRounds,
  ]);

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
            soundCue: nextSoundCue(prev, 'snap'),
          };
        }

        const { nextStock, nextDiscard } = refillStockIfEmpty(
          prev.stock,
          prev.discard
        );
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
          soundCue: nextSoundCue(prev, 'snap'),
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
        let cueKind: SoundCueKind = 'snap';

        // 1. If not opened yet -> check if AI can beat the current threshold
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
            cueKind = 'open72';
          }
        }

        // 2. If opened -> swap jokers (Maître/Salon), lay down new melds, extend existing table melds
        if (nextHasOpened[aiIdx] && hand.length > 0) {
          if (difficulty !== 'detente') {
            let swappedAny = true;
            while (swappedAny && hand.length > 0) {
              swappedAny = false;
              for (let mIdx = 0; mIdx < tableMelds.length; mIdx++) {
                for (let cIdx = 0; cIdx < hand.length; cIdx++) {
                  const res = trySwapJokerInMeld(tableMelds[mIdx], hand[cIdx]);
                  if (res) {
                    tableMelds[mIdx] = res.updatedMeld;
                    hand.splice(cIdx, 1, res.retrievedJoker);
                    if (!actionNote) actionNote = 'Récupère un Joker';
                    if (cueKind === 'snap') cueKind = 'open72';
                    swappedAny = true;
                    break;
                  }
                }
                if (swappedAny) break;
              }
            }
          }

          const extra = findBestDisjointMelds(hand, aiIdx);
          if (extra.melds.length > 0) {
            hand = hand.filter((c) => !extra.usedCardIds.has(c.id));
            tableMelds = [...tableMelds, ...extra.melds];
            if (!actionNote) actionNote = `Pose +${extra.totalPoints} pts`;
            if (cueKind === 'snap') cueKind = 'meld';
          }

          let extendedAny = true;
          while (extendedAny && hand.length > 0) {
            extendedAny = false;
            for (let cIdx = 0; cIdx < hand.length; cIdx++) {
              const card = hand[cIdx];
              if (card.isJoker && hand.length > 2) continue;

              for (let mIdx = 0; mIdx < tableMelds.length; mIdx++) {
                const extended = tryExtendTableMeld(tableMelds[mIdx], [card]);
                if (extended) {
                  tableMelds[mIdx] = extended;
                  hand.splice(cIdx, 1);
                  extendedAny = true;
                  if (!actionNote) actionNote = 'Complète le tapis';
                  if (cueKind === 'snap') cueKind = 'meld';
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

        if (hand.length === 0) {
          return finishRoundState(baseUpdated, aiIdx, nextHands, totalRounds);
        }

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
          soundCue: nextSoundCue(prev, cueKind),
        };
      });
    }, 780);

    return () => window.clearTimeout(timer);
  }, [state.phase, state.activePlayer, state.turnStep, difficulty, totalRounds]);

  // Keyboard shortcuts (Escape clears selection / closes rules, bare R toggles rules)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'Escape') {
        if (rulesOpen) setRulesOpen(false);
        else setSelectedIds(new Set());
      } else if (
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        (e.key === 'r' || e.key === 'R')
      ) {
        setRulesOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [rulesOpen]);

  const handleNextRound = useCallback(() => {
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
        soundCue: nextSoundCue(prev, 'deal'),
      })
    );
  }, [sortMode]);

  const handleRestartMatch = useCallback(() => {
    setSelectedIds(new Set());
    setStagedMelds([]);
    setFeedbackMessage(null);
    const players = buildPlayersForCount(playerCount);
    setState((prev) =>
      dealNewRound({
        roundNumber: 1,
        players,
        cumulativePenalty: players.map(() => 0),
        roundsWon: players.map(() => 0),
        sortMode,
        soundCue: nextSoundCue(prev, 'deal'),
      })
    );
  }, [playerCount, sortMode]);

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

  return {
    state,
    sortMode,
    selectedIds,
    stagedMelds,
    feedbackMessage,
    soundEnabled,
    rulesOpen,
    setRulesOpen,
    toggleSound,
    isHumanDraw,
    isHumanPlay,
    humanOpened,
    requiredThreshold,
    visibleHumanHand,
    selectedCards,
    selectedValidMeld,
    stagedTotalPoints,
    extendableMeldIds,
    swappableMeldIds,
    topDiscard,
    canDirectOpenWithSelection,
    canCommitStagedOpening,
    canDiscardSelected,
    handleChangeSortMode,
    toggleSelectCard,
    handleHumanDraw,
    handleStageSelectedMeld,
    handleUnstageMeld,
    handleClearStaging,
    handleCommitMelds,
    handleClickTableMeld,
    handleHumanDiscard,
    handleNextRound,
    handleRestartMatch,
  };
}
