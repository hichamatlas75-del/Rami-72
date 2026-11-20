import React from 'react';
import { Card, GamePhase, PlayerConfig } from '../game/types';
import { CardBack } from './PlayingCard';

interface OpponentStripProps {
  opponents: PlayerConfig[];
  phase: Exclude<GamePhase, 'TITLE_MENU'>;
  activePlayer: number;
  hands: Card[][];
  hasOpened: boolean[];
  openedWith: (number | null)[];
  speech: Record<number, string>;
  isSimple?: boolean;
}

export function OpponentStrip({
  opponents,
  phase,
  activePlayer,
  hands,
  hasOpened,
  openedWith,
  speech,
  isSimple = false,
}: OpponentStripProps) {
  return (
    <section
      aria-label="Adversaires"
      className="relative z-10 mx-auto flex w-full max-w-6xl flex-wrap items-start justify-center gap-2.5 px-4 pt-2.5 sm:gap-6 sm:px-6 sm:pt-4"
    >
      {opponents.map((opp) => {
        const isActive = phase === 'PLAYING' && activePlayer === opp.index;
        const oppCards = hands[opp.index];
        const oppOpened = hasOpened[opp.index];
        const oppOpenPts = openedWith[opp.index];
        const note = speech[opp.index];

        return (
          <div
            key={opp.index}
            className={`flex min-w-[140px] flex-1 max-w-[280px] flex-col rounded-xl border px-3 py-2 backdrop-blur-xs transition-colors sm:px-3.5 sm:py-2.5 ${
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

            <div className="mt-1.5 flex items-center justify-between gap-2">
              <div className="min-w-0 text-[11px] text-[#9FB3AA]">
                {isSimple ? (
                  <span>Combinaisons en main</span>
                ) : oppOpened ? (
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

              <div
                className="hidden items-center -space-x-7 sm:flex"
                aria-hidden="true"
              >
                {Array.from({ length: Math.min(oppCards.length, 6) }).map(
                  (_, i) => (
                    <CardBack
                      key={i}
                      size="xs"
                      className="scale-75 origin-right"
                    />
                  )
                )}
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
