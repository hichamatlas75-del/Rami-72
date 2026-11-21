import React from 'react';
import { Card, PlayerConfig } from '../game/types';
import { formatCardShort } from '../game/useRami72Game';
import { CardBack, PlayingCard } from './PlayingCard';

interface StockAndThresholdPanelProps {
  isSimple?: boolean;
  humanOpened: boolean;
  humanOpenedWith: number | null;
  highestOpeningScore: number | null;
  lastOpenerIndex: number | null;
  players: PlayerConfig[];
  requiredThreshold: number;
  stockCount: number;
  discardCount: number;
  topDiscard: Card | null;
  isInitialTapisCard: boolean;
  isHumanDraw: boolean;
  canDrawDiscard: boolean;
  canOpenWithSecondaryDiscard?: boolean;
  canDiscardSelected: boolean;
  onDrawStock: () => void;
  onDrawDiscard: () => void;
  onDiscardSelected: () => void;
}

export function StockAndThresholdPanel({
  isSimple = false,
  humanOpened,
  humanOpenedWith,
  highestOpeningScore,
  lastOpenerIndex,
  players,
  requiredThreshold,
  stockCount,
  discardCount,
  topDiscard,
  isInitialTapisCard,
  isHumanDraw,
  canDrawDiscard,
  canOpenWithSecondaryDiscard = false,
  canDiscardSelected,
  onDrawStock,
  onDrawDiscard,
  onDiscardSelected,
}: StockAndThresholdPanelProps) {
  const canRecycleDiscard = stockCount === 0 && discardCount > 1;
  const hasDrawableStock = stockCount > 0 || canRecycleDiscard;

  return (
    <aside
      aria-label={isSimple ? 'Pioche et défausse du tapis' : 'Pioche, défausse et seuil du 72'}
      className="flex shrink-0 flex-row items-center justify-between gap-3 rounded-2xl border border-[#D4AF37]/20 bg-[#071610]/78 p-3.5 backdrop-blur-xs sm:w-56 sm:flex-col sm:justify-center sm:gap-4 sm:p-4"
    >
      {/* Live Threshold / Mode Plaque */}
      <div className="min-w-0 text-left sm:w-full sm:border-b sm:border-white/10 sm:pb-3 sm:text-center">
        {isSimple ? (
          <>
            <p className="text-[11px] font-medium text-[#A3B6AD]">Mode Simple</p>
            <p className="mt-0.5 font-display text-lg font-semibold text-[#E5C158]">
              Sans comptage
            </p>
            <p className="mt-0.5 truncate text-[11px] text-[#B8C7C0]">
              Pioche tapis ou caché · 13 cartes
            </p>
          </>
        ) : (
          <>
            <p className="text-[11px] font-medium text-[#A3B6AD]">
              {humanOpened
                ? 'Votre statut'
                : highestOpeningScore === null
                ? 'Seuil initial'
                : 'Seuil à dépasser'}
            </p>
            {humanOpened ? (
              <p className="mt-0.5 font-display text-lg font-semibold text-[#E5C158]">
                Ouvert ({humanOpenedWith} pts)
              </p>
            ) : (
              <p className="mt-0.5 font-mono text-2xl font-semibold tabular-nums text-[#E5C158]">
                {requiredThreshold} pts
              </p>
            )}
            <p className="mt-0.5 truncate text-[11px] text-[#B8C7C0]">
              {humanOpened
                ? 'Posez et complétez librement'
                : highestOpeningScore === null
                ? 'Premier à étaler ≥ 72 pts'
                : `> ${highestOpeningScore} pts (${players[lastOpenerIndex!]?.name})`}
            </p>
          </>
        )}
      </div>

      {/* Pioche & Défausse Interactive Slots */}
      <div className="flex items-center gap-4 sm:gap-5 shrink-0">
        {/* Pioche (cartes cachées) */}
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={onDrawStock}
            disabled={!isHumanDraw || !hasDrawableStock}
            aria-label={
              canRecycleDiscard
                ? 'Remélanger la défausse et piocher une carte cachée'
                : `Piocher une carte cachée (${stockCount} restantes)`
            }
            className={`group relative rounded-lg transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5C158] ${
              isHumanDraw && hasDrawableStock
                ? 'cursor-pointer hover:-translate-y-1 ring-2 ring-[#E5C158]/80 ring-offset-2 ring-offset-[#071610]'
                : 'cursor-default opacity-90'
            }`}
          >
            {stockCount > 0 ? (
              <>
                <CardBack
                  size="sm"
                  className="translate-x-1 translate-y-1 opacity-70"
                />
                <CardBack size="sm" className="absolute inset-0" />
              </>
            ) : (
              <div className="flex h-20 w-14 flex-col items-center justify-center rounded-lg border border-dashed border-[#D4AF37]/40 bg-[#0C241A]/70 text-center text-[10px] text-[#C8D4CE] sm:h-23 sm:w-16">
                {canRecycleDiscard ? (
                  <span className="px-1 font-medium text-[#E5C158]">
                    Mélanger ({discardCount - 1})
                  </span>
                ) : (
                  <span className="text-[#98ABA3]">Vide</span>
                )}
              </div>
            )}
          </button>
          <span className="mt-1.5 font-mono text-[11px] tabular-nums text-[#D4DDD9]">
            {canRecycleDiscard ? 'Recyclage' : `Pioche (${stockCount})`}
          </span>
        </div>

        {/* Défausse */}
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={() => {
              if (canDrawDiscard) {
                onDrawDiscard();
              } else if (canDiscardSelected) {
                onDiscardSelected();
              }
            }}
            disabled={!canDrawDiscard && !canDiscardSelected}
            aria-label={
              canDrawDiscard && topDiscard
                ? !isSimple && isInitialTapisCard
                  ? `Prendre la 15e carte dévoilée : ${formatCardShort(topDiscard)}`
                  : canOpenWithSecondaryDiscard
                  ? `Prendre la dernière carte jetée pour étaler (2e trio/suite) : ${formatCardShort(topDiscard)}`
                  : `Prendre la dernière carte jetée : ${formatCardShort(topDiscard)}`
                : canDiscardSelected
                ? 'Défausser la carte sélectionnée'
                : 'Défausse'
            }
            className={`relative rounded-lg transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5C158] ${
              canDrawDiscard || canDiscardSelected
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
              : canDrawDiscard && topDiscard
              ? !isSimple && isInitialTapisCard
                ? '15e dévoilée'
                : canOpenWithSecondaryDiscard
                ? 'Prendre pour étaler'
                : 'Prendre du tapis'
              : isInitialTapisCard && topDiscard
              ? '15e dévoilée'
              : 'Défausse'}
          </span>
        </div>
      </div>
    </aside>
  );
}
