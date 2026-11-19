import React from 'react';
import { ArrowUpDown, Layers, Undo2, X } from 'lucide-react';
import { Card, PlayerConfig, SortMode, TableMeld } from '../game/types';
import { formatCardShort } from '../game/useRami72Game';
import { PlayingCard } from './PlayingCard';

interface PlayerHandAreaProps {
  visibleHumanHand: Card[];
  selectedIds: Set<string>;
  selectedCards: Card[];
  selectedValidMeld: TableMeld | null;
  stagedMelds: TableMeld[];
  stagedTotalPoints: number;
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
  selectedValidMeld,
  stagedMelds,
  stagedTotalPoints,
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
  onStageSelectedMeld,
  onUnstageMeld,
  onClearStaging,
  onCommitMelds,
  onDiscardSelected,
  onChangeSortMode,
}: PlayerHandAreaProps) {
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
                  onClick={() => onUnstageMeld(m.id)}
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
              onClick={onClearStaging}
              className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1 text-xs font-medium text-[#D4DDD9] whitespace-nowrap shrink-0 hover:bg-white/10"
            >
              <Undo2 className="h-3.5 w-3.5" />
              Annuler
            </button>
            {canCommitStagedOpening && (
              <button
                type="button"
                onClick={() => onCommitMelds(stagedMelds, true)}
                className="min-h-[36px] rounded-lg bg-[#D4AF37] px-3.5 py-1 text-xs font-semibold text-[#081510] whitespace-nowrap shrink-0 transition-colors hover:bg-[#E5C158]"
              >
                Étaler sur le tapis ({stagedTotalPoints} pts)
              </button>
            )}
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
          <span aria-hidden="true" className="text-white/25">
            ·
          </span>
          {feedbackMessage ? (
            <span className="font-medium text-[#FBBF24]">{feedbackMessage}</span>
          ) : isHumanDraw ? (
            <span className="font-medium text-[#E5C158]">
              {isInitialTapisCard
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
              Tour de {activePlayerConfig?.name}…
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isHumanPlay &&
            !humanOpened &&
            selectedValidMeld &&
            (canDirectOpenWithSelection ? (
              <button
                type="button"
                onClick={() => onCommitMelds([selectedValidMeld], true)}
                className="min-h-[38px] rounded-lg bg-[#D4AF37] px-3.5 py-1.5 text-xs font-semibold text-[#081510] whitespace-nowrap shrink-0 transition-colors hover:bg-[#E5C158]"
              >
                Étaler sur le tapis ({selectedValidMeld.points} pts)
              </button>
            ) : (
              <button
                type="button"
                onClick={onStageSelectedMeld}
                className="min-h-[38px] rounded-lg bg-[#D4AF37] px-3.5 py-1.5 text-xs font-semibold text-[#081510] whitespace-nowrap shrink-0 transition-colors hover:bg-[#E5C158]"
              >
                Ajouter à ma pose (+{selectedValidMeld.points} pts)
              </button>
            ))}

          {isHumanPlay && humanOpened && selectedValidMeld && (
            <button
              type="button"
              onClick={() => onCommitMelds([selectedValidMeld], false)}
              className="min-h-[38px] rounded-lg bg-[#D4AF37] px-3.5 py-1.5 text-xs font-semibold text-[#081510] whitespace-nowrap shrink-0 transition-colors hover:bg-[#E5C158]"
            >
              Poser ({selectedValidMeld.points} pts)
            </button>
          )}

          {isHumanPlay &&
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
            aria-label="Trier la main"
            className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.04] p-0.5"
          >
            <button
              type="button"
              onClick={() => onChangeSortMode('suit')}
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
              onClick={() => onChangeSortMode('rank')}
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

      {/* Player's Interactive Hand (horizontally scrollable on narrow mobile screens) */}
      <div className="w-full overflow-x-auto pb-1">
        <div
          className={`mx-auto flex w-max min-w-full items-end justify-center px-2 pt-5 ${handOverlapClass}`}
        >
          {visibleHumanHand.map((card, index) => {
            const isSelected = selectedIds.has(card.id);
            return (
              <div
                key={card.id}
                style={{ zIndex: isSelected ? 40 + index : index + 1 }}
                className="shrink-0 hover:z-50 focus-within:z-50"
              >
                <PlayingCard
                  card={card}
                  size="md"
                  interactive
                  selected={isSelected}
                  disabled={!isHumanPlay}
                  onClick={() => onToggleSelectCard(card.id)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
