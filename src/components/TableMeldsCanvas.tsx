import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PlayerConfig, TableMeld } from '../game/types';
import { PlayingCard } from './PlayingCard';

interface TableMeldsCanvasProps {
  tableMelds: TableMeld[];
  players: PlayerConfig[];
  humanOpened: boolean;
  extendableMeldIds: Set<string>;
  swappableMeldIds: Set<string>;
  revealMeldIds?: Set<string>;
  onClickTableMeld: (meld: TableMeld) => void;
}

export function TableMeldsCanvas({
  tableMelds,
  players,
  humanOpened,
  extendableMeldIds,
  swappableMeldIds,
  revealMeldIds,
  onClickTableMeld,
}: TableMeldsCanvasProps) {
  return (
    <section
      aria-label="Combinaisons étalées sur le tapis"
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#D4AF37]/18 bg-[#061810]/38 p-3.5 backdrop-blur-[1px] sm:p-4"
    >
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[#B8C7C0]">
        <span className="font-medium text-[#E4ECE8]">
          Tapis des combinaisons ({tableMelds.length})
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

      {tableMelds.length === 0 ? (
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
            {tableMelds.map((meld) => {
              const canExtend = extendableMeldIds.has(meld.id);
              const canSwap = swappableMeldIds.has(meld.id);
              const isTarget = canExtend || canSwap;
              const isRevealedWin = revealMeldIds?.has(meld.id) ?? false;
              const ownerName = players[meld.ownerIndex]?.name ?? '';

              return (
                <motion.div
                  key={meld.id}
                  initial={{ opacity: 0, scale: 0.94, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="max-w-full"
                >
                  <button
                    type="button"
                    onClick={() => isTarget && onClickTableMeld(meld)}
                    disabled={!isTarget}
                    className={`group flex max-w-full flex-col items-start rounded-xl border p-2 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5C158] ${
                      isTarget
                        ? 'cursor-pointer border-[#E5C158] bg-[#163C2B]/90 shadow-[0_0_20px_rgba(212,175,55,0.28)] hover:bg-[#1C4A35]'
                        : isRevealedWin
                        ? 'cursor-default border-[#E5C158]/80 bg-[#143728]/90 shadow-[0_0_22px_rgba(212,175,55,0.26)]'
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
                      ) : isRevealedWin ? (
                        <span className="font-semibold text-[#E5C158]">
                          Étalé
                        </span>
                      ) : null}
                    </div>

                    <div className="flex max-w-full items-center -space-x-2.5 overflow-x-auto pb-0.5">
                      {meld.slots.map((slot) => (
                        <PlayingCard
                          key={slot.card.id}
                          card={slot.card}
                          size="table"
                          className="shrink-0"
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
  );
}
