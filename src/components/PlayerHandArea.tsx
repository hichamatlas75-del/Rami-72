import React, { useState } from 'react';
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  MoveHorizontal,
  Undo2,
  X,
} from 'lucide-react';
import {
  INITIAL_OPENING_PURE_MIN,
  OpeningValidationResult,
  isPureMeld,
} from '../game/rami72Engine';
import { Card, PlayerConfig, SortMode, TableMeld } from '../game/types';
import { formatCardShort } from '../game/useRami72Game';
import { PlayingCard } from './PlayingCard';

interface PlayerHandAreaProps {
  visibleHumanHand: Card[];
  selectedIds: Set<string>;
  selectedCards: Card[];
  selectedMeldBundle: { melds: TableMeld[]; totalPoints: number } | null;
  autoCompleteBundle: {
    melds: TableMeld[];
    totalPoints: number;
    remainingCount: number;
  } | null;
  stagedMelds: TableMeld[];
  stagedTotalPoints: number;
  stagedOpeningCheck: OpeningValidationResult;
  directOpeningCheck: OpeningValidationResult;
  lastDrawnCardId: string | null;
  lastDrawnCard: Card | null;
  requiredThreshold: number;
  humanOpened: boolean;
  isHumanDraw: boolean;
  isHumanPlay: boolean;
  isInitialTapisCard: boolean;
  activePlayerConfig: PlayerConfig | undefined;
  feedbackMessage: string | null;
  canDirectOpenWithSelection: boolean;
  canCommitStagedOpening: boolean;
  canDiscardSelected: boolean;
  sortMode: SortMode;
  onToggleSelectCard: (cardId: string) => void;
  onReorderHandCard: (fromCardId: string, toCardId: string) => void;
  onNudgeHandCard: (cardId: string, delta: -1 | 1) => void;
  onStageSelectedMeld: () => void;
  onUnstageMeld: (meldId: string) => void;
  onClearStaging: () => void;
  onCommitMelds: (melds: TableMeld[], isOpening: boolean) => void;
  onDiscardSelected: () => void;
  onChangeSortMode: (mode: SortMode) => void;
}

export function PlayerHandArea({
  visibleHumanHand,
  selectedIds,
  selectedCards,
  selectedMeldBundle,
  autoCompleteBundle,
  stagedMelds,
  stagedTotalPoints,
  stagedOpeningCheck,
  directOpeningCheck,
  lastDrawnCardId,
  lastDrawnCard,
  requiredThreshold,
  humanOpened,
  isHumanDraw,
  isHumanPlay,
  isInitialTapisCard,
  activePlayerConfig,
  feedbackMessage,
  canDirectOpenWithSelection,
  canCommitStagedOpening,
  canDiscardSelected,
  sortMode,
  onToggleSelectCard,
  onReorderHandCard,
  onNudgeHandCard,
  onStageSelectedMeld,
  onUnstageMeld,
  onClearStaging,
  onCommitMelds,
  onDiscardSelected,
  onChangeSortMode,
}: PlayerHandAreaProps) {
  const [reorderMode, setReorderMode] = useState(false);
  const [movingCardId, setMovingCardId] = useState<string | null>(null);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);

  const activeMovingCard =
    reorderMode && movingCardId
      ? visibleHumanHand.find((c) => c.id === movingCardId) ?? null
      : null;

  const nudgeTargetCard =
    activeMovingCard ??
    (!reorderMode && isHumanPlay && selectedCards.length === 1
      ? selectedCards[0]
      : null);

  const nudgeTargetIdx = nudgeTargetCard
    ? visibleHumanHand.findIndex((c) => c.id === nudgeTargetCard.id)
    : -1;

  const handleToggleReorderMode = () => {
    setReorderMode((prev) => {
      const next = !prev;
      setMovingCardId(null);
      return next;
    });
  };

  const handleCardClick = (cardId: string) => {
    if (reorderMode) {
      if (!activeMovingCard) {
        setMovingCardId(cardId);
      } else if (activeMovingCard.id === cardId) {
        setMovingCardId(null);
      } else {
        onReorderHandCard(activeMovingCard.id, cardId);
        setMovingCardId(null);
      }
      return;
    }
    onToggleSelectCard(cardId);
  };

  const handleSelectSort = (mode: 'suit' | 'rank') => {
    setReorderMode(false);
    setMovingCardId(null);
    onChangeSortMode(mode);
  };

  const handOverlapClass =
    visibleHumanHand.length >= 13
      ? '-space-x-5 sm:-space-x-4 md:-space-x-3 lg:-space-x-2'
      : visibleHumanHand.length >= 10
      ? '-space-x-4 sm:-space-x-2 md:-space-x-1'
      : '-space-x-2 sm:space-x-1';

  return (
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
            <span
              className={`inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-medium whitespace-nowrap ${
                stagedOpeningCheck.hasPureSet
                  ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                  : 'border-amber-400/35 bg-amber-500/10 text-amber-200'
              }`}
            >
              {stagedOpeningCheck.hasPureSet ? '✓' : '✕'} Trio sans joker
            </span>
            <span
              className={`inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-medium whitespace-nowrap ${
                stagedOpeningCheck.hasPureRun
                  ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                  : 'border-amber-400/35 bg-amber-500/10 text-amber-200'
              }`}
            >
              {stagedOpeningCheck.hasPureRun ? '✓' : '✕'} Suite sans joker
            </span>
            <span
              className={`inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-medium tabular-nums whitespace-nowrap ${
                stagedOpeningCheck.meetsPureMin
                  ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                  : 'border-amber-400/35 bg-amber-500/10 text-amber-200'
              }`}
            >
              {stagedOpeningCheck.meetsPureMin ? '✓ ' : ''}Sans joker{' '}
              {stagedOpeningCheck.purePoints}/{INITIAL_OPENING_PURE_MIN} pts
            </span>
            {stagedMelds.map((m) => {
              const pure = isPureMeld(m);
              return (
                <div
                  key={m.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-2.5 py-1 text-xs"
                >
                  <span className="font-mono text-[#FDFBF7]">
                    {m.slots.map((s) => formatCardShort(s.card)).join(' ')}
                  </span>
                  <span
                    className={`font-mono text-[11px] ${
                      pure ? 'text-[#E5C158]' : 'text-amber-300'
                    }`}
                  >
                    ({m.points}
                    {pure ? '' : ' · Joker'})
                  </span>
                  <button
                    type="button"
                    onClick={() => onUnstageMeld(m.id)}
                    aria-label="Retirer cette combinaison de la préparation"
                    className="ml-0.5 rounded p-0.5 text-[#A8BBB2] hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClearStaging}
              className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1 text-xs font-medium text-[#D4DDD9] whitespace-nowrap shrink-0 hover:bg-white/10"
            >
              <Undo2 className="h-3.5 w-3.5" />
              Annuler
            </button>
            <button
              type="button"
              disabled={!canCommitStagedOpening}
              onClick={() => onCommitMelds(stagedMelds, true)}
              title={stagedOpeningCheck.reason}
              className={`min-h-[36px] rounded-lg px-3.5 py-1 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                canCommitStagedOpening
                  ? 'bg-[#D4AF37] text-[#081510] hover:bg-[#E5C158]'
                  : 'cursor-not-allowed border border-white/15 bg-white/[0.06] text-[#9BB0A7]'
              }`}
            >
              {canCommitStagedOpening
                ? `Étaler sur le tapis (${stagedTotalPoints} pts)`
                : !stagedOpeningCheck.hasPureSet
                ? 'Manque 1 trio sans joker'
                : !stagedOpeningCheck.hasPureRun
                ? 'Manque 1 suite sans joker'
                : !stagedOpeningCheck.meetsPureMin
                ? `Sans joker : ${stagedOpeningCheck.purePoints}/${INITIAL_OPENING_PURE_MIN} pts`
                : `Étaler (${stagedTotalPoints}/${requiredThreshold} pts)`}
            </button>
          </div>
        </div>
      )}

      {/* Action & Guidance Bar */}
      <div className="mb-2 flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#071610]/85 px-3.5 py-2 backdrop-blur-xs">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs sm:text-sm">
          <span className="font-mono text-xs tabular-nums text-[#A8BBB2] whitespace-nowrap">
            Main : <strong className="text-white">{visibleHumanHand.length}</strong>{' '}
            {visibleHumanHand.length > 1 ? 'cartes' : 'carte'}
          </span>
          {lastDrawnCard && (
            <>
              <span aria-hidden="true" className="text-white/25">
                ·
              </span>
              <span className="inline-flex items-center rounded-md border border-[#34D399]/40 bg-[#10B981]/15 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#6EE7B7] whitespace-nowrap">
                Piochée : {formatCardShort(lastDrawnCard)}
              </span>
            </>
          )}
          <span aria-hidden="true" className="text-white/25">
            ·
          </span>
          {reorderMode ? (
            <span className="font-medium text-[#38BDF8]">
              {activeMovingCard
                ? `Touchez où placer « ${formatCardShort(activeMovingCard)} » (ou ◀ ▶)`
                : 'Mode déplacement · Touchez la carte à déplacer'}
            </span>
          ) : feedbackMessage ? (
            <span className="font-medium text-[#FBBF24]">{feedbackMessage}</span>
          ) : isHumanDraw ? (
            <span className="font-medium text-[#E5C158]">
              {isInitialTapisCard
                ? 'À vous · Prenez la 15e carte dévoilée ou piochez caché'
                : 'À vous · Piochez d’abord une carte cachée'}
            </span>
          ) : isHumanPlay ? (
            <span className="font-medium text-[#E4ECE8]">
              {selectedMeldBundle
                ? !humanOpened &&
                  !canDirectOpenWithSelection &&
                  directOpeningCheck.totalPoints >= requiredThreshold &&
                  directOpeningCheck.reason
                  ? directOpeningCheck.reason
                  : selectedMeldBundle.melds.length > 1
                  ? `${selectedMeldBundle.melds.length} combinaisons valides (${selectedMeldBundle.totalPoints} pts)`
                  : `Combinaison valide (${selectedMeldBundle.melds[0].type === 'run' ? 'Suite' : 'Trio/Carré'} · ${selectedMeldBundle.totalPoints} pts)`
                : selectedCards.length >= 3
                ? humanOpened
                  ? `${selectedCards.length} cartes · Sélection invalide (ou touchez le tapis)`
                  : `${selectedCards.length} cartes · Formez une suite ou un trio/carré valide`
                : selectedCards.length > 0
                ? `${selectedCards.length} ${selectedCards.length > 1 ? 'cartes sélectionnées' : 'carte sélectionnée'}`
                : autoCompleteBundle
                ? autoCompleteBundle.remainingCount === 0
                  ? 'Toute votre main est prête à être étalée !'
                  : 'Main prête : étalez puis défaussez votre dernière carte !'
                : humanOpened
                ? 'Sélectionnez des cartes pour étaler, compléter ou défausser'
                : `Préparez 1 trio + 1 suite + 72 pts sans joker (${requiredThreshold}+ pts total)`}
            </span>
          ) : (
            <span className="text-[#B8C7C0]">
              Tour de {activePlayerConfig?.name}…
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick left/right nudge controls for single selected or picked card */}
          {nudgeTargetCard && (
            <div
              role="group"
              aria-label="Déplacer la carte dans la main"
              className="flex items-center gap-0.5 rounded-lg border border-white/15 bg-white/[0.04] p-0.5"
            >
              <button
                type="button"
                onClick={() => onNudgeHandCard(nudgeTargetCard.id, -1)}
                disabled={nudgeTargetIdx <= 0}
                aria-label="Déplacer la carte vers la gauche"
                title="Déplacer à gauche"
                className="inline-flex h-[32px] w-[32px] items-center justify-center rounded-md text-[#E4ECE8] transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onNudgeHandCard(nudgeTargetCard.id, 1)}
                disabled={
                  nudgeTargetIdx === -1 ||
                  nudgeTargetIdx >= visibleHumanHand.length - 1
                }
                aria-label="Déplacer la carte vers la droite"
                title="Déplacer à droite"
                className="inline-flex h-[32px] w-[32px] items-center justify-center rounded-md text-[#E4ECE8] transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* One-click full hand laydown when entire hand (<= 1 card left) is ready */}
          {!reorderMode &&
            isHumanPlay &&
            selectedCards.length === 0 &&
            autoCompleteBundle && (
              <button
                type="button"
                onClick={() =>
                  onCommitMelds(autoCompleteBundle.melds, !humanOpened)
                }
                className="min-h-[38px] rounded-lg bg-[#D4AF37] px-3.5 py-1.5 text-xs font-semibold text-[#081510] whitespace-nowrap shrink-0 shadow-[0_6px_18px_rgba(212,175,55,0.28)] transition-colors hover:bg-[#E5C158]"
              >
                Étaler toute ma main ({autoCompleteBundle.totalPoints} pts)
              </button>
            )}

          {!reorderMode &&
            isHumanPlay &&
            !humanOpened &&
            selectedMeldBundle &&
            (canDirectOpenWithSelection ? (
              <button
                type="button"
                onClick={() =>
                  onCommitMelds(
                    [...stagedMelds, ...selectedMeldBundle.melds],
                    true
                  )
                }
                className="min-h-[38px] rounded-lg bg-[#D4AF37] px-3.5 py-1.5 text-xs font-semibold text-[#081510] whitespace-nowrap shrink-0 transition-colors hover:bg-[#E5C158]"
              >
                Étaler sur le tapis (
                {stagedTotalPoints + selectedMeldBundle.totalPoints} pts)
              </button>
            ) : (
              <button
                type="button"
                onClick={onStageSelectedMeld}
                className="min-h-[38px] rounded-lg bg-[#D4AF37] px-3.5 py-1.5 text-xs font-semibold text-[#081510] whitespace-nowrap shrink-0 transition-colors hover:bg-[#E5C158]"
              >
                Ajouter à ma pose (+{selectedMeldBundle.totalPoints} pts)
              </button>
            ))}

          {!reorderMode && isHumanPlay && humanOpened && selectedMeldBundle && (
            <button
              type="button"
              onClick={() => onCommitMelds(selectedMeldBundle.melds, false)}
              className="min-h-[38px] rounded-lg bg-[#D4AF37] px-3.5 py-1.5 text-xs font-semibold text-[#081510] whitespace-nowrap shrink-0 transition-colors hover:bg-[#E5C158]"
            >
              Étaler ({selectedMeldBundle.totalPoints} pts)
            </button>
          )}

          {!reorderMode &&
            isHumanPlay &&
            selectedCards.length === 1 &&
            stagedMelds.length === 0 && (
              <button
                type="button"
                onClick={onDiscardSelected}
                disabled={!canDiscardSelected}
                className="min-h-[38px] rounded-lg border border-[#D4AF37]/50 bg-[#143527] px-3.5 py-1.5 text-xs font-semibold text-[#FDFBF7] whitespace-nowrap shrink-0 transition-colors hover:bg-[#1B4634] disabled:cursor-not-allowed disabled:opacity-45"
              >
                Défausser {formatCardShort(selectedCards[0])}
              </button>
            )}

          <div
            role="group"
            aria-label="Organiser la main"
            className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.04] p-0.5"
          >
            <button
              type="button"
              onClick={() => handleSelectSort('suit')}
              className={`inline-flex min-h-[34px] items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                !reorderMode && sortMode === 'suit'
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
              onClick={() => handleSelectSort('rank')}
              className={`inline-flex min-h-[34px] items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                !reorderMode && sortMode === 'rank'
                  ? 'bg-[#173A2A] text-[#FDFBF7]'
                  : 'text-[#A6B7AF] hover:text-white'
              }`}
              title="Trier par valeur pour voir les trios et carrés"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              Trios
            </button>
            <button
              type="button"
              onClick={handleToggleReorderMode}
              aria-pressed={reorderMode}
              className={`inline-flex min-h-[34px] items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                reorderMode
                  ? 'bg-[#0E3A4D] text-[#7DD3FC] ring-1 ring-[#38BDF8]/50'
                  : 'text-[#A6B7AF] hover:text-white'
              }`}
              title="Déplacer manuellement les cartes de votre main"
            >
              <MoveHorizontal className="h-3.5 w-3.5" />
              {reorderMode ? 'Terminer' : 'Déplacer'}
            </button>
          </div>
        </div>
      </div>

      {/* Player's Interactive Hand (supports mouse drag & drop + tap-to-move + mobile horizontal scroll) */}
      <div className="w-full overflow-x-auto pb-1">
        <div
          className={`mx-auto flex w-max min-w-full items-end justify-center px-2 pt-8 ${handOverlapClass}`}
        >
          {visibleHumanHand.map((card, index) => {
            const isSelected = !reorderMode && selectedIds.has(card.id);
            const isMoving = activeMovingCard?.id === card.id;
            const isDropTarget =
              dragOverCardId === card.id && draggingCardId !== card.id;
            const isNewlyDrawn = card.id === lastDrawnCardId;

            return (
              <div
                key={card.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', card.id);
                  e.dataTransfer.effectAllowed = 'move';
                  setDraggingCardId(card.id);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverCardId !== card.id) {
                    setDragOverCardId(card.id);
                  }
                }}
                onDragLeave={() => {
                  if (dragOverCardId === card.id) {
                    setDragOverCardId(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const fromId =
                    draggingCardId || e.dataTransfer.getData('text/plain');
                  if (fromId && fromId !== card.id) {
                    onReorderHandCard(fromId, card.id);
                  }
                  setDraggingCardId(null);
                  setDragOverCardId(null);
                }}
                onDragEnd={() => {
                  setDraggingCardId(null);
                  setDragOverCardId(null);
                }}
                style={{
                  zIndex:
                    isSelected || isMoving
                      ? 40 + index
                      : isNewlyDrawn
                      ? 25 + index
                      : index + 1,
                }}
                className={`shrink-0 hover:z-50 focus-within:z-50 ${
                  draggingCardId === card.id ? 'opacity-50' : ''
                } ${!isHumanPlay && !reorderMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
              >
                <PlayingCard
                  card={card}
                  size="md"
                  interactive
                  selected={isSelected}
                  moving={isMoving}
                  dropTarget={isDropTarget}
                  newlyDrawn={isNewlyDrawn}
                  disabled={!isHumanPlay && !reorderMode}
                  onClick={() => handleCardClick(card.id)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
