import React from 'react';
import { RoundResult, TotalRounds } from '../game/types';

interface RoundModalProps {
  result: RoundResult;
  totalRounds: TotalRounds;
  isGameOver: boolean;
  onNextRound: () => void;
  onRestartMatch: () => void;
  onReturnMenu: () => void;
}

export function RoundModal({
  result,
  totalRounds,
  isGameOver,
  onNextRound,
  onRestartMatch,
  onReturnMenu,
}: RoundModalProps) {
  const humanWonRound = result.winnerIndex === 0;

  // Overall champion at end of multi-round match: most rounds won, tiebreak lowest penalty points
  const sortedFinal = [...result.standings].sort((a, b) => {
    if (b.roundsWon !== a.roundsWon) return b.roundsWon - a.roundsWon;
    return a.cumulativePenalty - b.cumulativePenalty;
  });
  const champion = sortedFinal[0];

  // In intermediate round summaries, rank by round result first; at game over, rank by overall champion
  const displayedStandings = isGameOver
    ? sortedFinal
    : [...result.standings].sort((a, b) => {
        if (a.isWinner !== b.isWinner) return a.isWinner ? -1 : 1;
        if (a.penaltyPoints !== b.penaltyPoints) {
          return a.penaltyPoints - b.penaltyPoints;
        }
        return a.cumulativePenalty - b.cumulativePenalty;
      });

  const headline = isGameOver
    ? champion.isHuman
      ? 'Vous remportez la partie'
      : `${champion.name} remporte la partie`
    : humanWonRound
    ? 'Vous avez complété votre main'
    : `${result.winnerName} remporte la manche`;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#040C09]/80 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label={isGameOver ? 'Classement final' : `Fin de la manche ${result.roundNumber}`}
    >
      <div className="w-full max-w-xl rounded-2xl border border-[#D4AF37]/30 bg-[#0D1E17] p-5 text-[#F5F2EB] shadow-[0_24px_60px_rgba(0,0,0,0.65)] sm:p-7">
        {/* Clean unboxed metadata */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#A3B5AD]">
          <span>
            Manche {result.roundNumber} sur {totalRounds}
          </span>
          {result.highestOpeningScore !== null && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                Plus haute ouverture : {result.highestOpeningScore} pts
              </span>
            </>
          )}
        </div>

        <h2 className="mt-2 font-display text-2xl font-semibold text-[#FDFBF7] sm:text-3xl">
          {headline}
        </h2>

        <p className="mt-1.5 text-sm text-[#B7C7C0]">
          {isGameOver
            ? `Classement final après ${totalRounds} ${totalRounds > 1 ? 'manches' : 'manche'} (moins de points de pénalité départage les égalités).`
            : 'Les cartes restantes en main comptent comme points de pénalité.'}
        </p>

        {/* Standings table */}
        <div className="mt-5 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02]">
          <table className="w-full min-w-[440px] text-sm">
            <thead className="border-b border-white/10 bg-white/[0.03] text-xs text-[#9DB0A7]">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Joueur</th>
                <th className="px-3 py-2.5 text-right font-medium">Ouverture</th>
                <th className="px-3 py-2.5 text-right font-medium">Reste</th>
                <th className="px-3 py-2.5 text-right font-medium">Manche</th>
                <th className="px-4 py-2.5 text-right font-medium text-[#E5C158]">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono tabular-nums">
              {displayedStandings.map((row) => {
                const isHighlighted = isGameOver
                  ? row.playerIndex === champion.playerIndex
                  : row.isWinner;
                const badgeText = isGameOver
                  ? totalRounds > 1
                    ? '· Champion'
                    : '· Gagnant'
                  : '· Gagnant';

                return (
                  <tr
                    key={row.playerIndex}
                    className={isHighlighted ? 'bg-[#D4AF37]/10' : ''}
                  >
                    <td className="px-4 py-3 font-sans">
                      <span
                        className={`font-medium ${
                          row.isHuman ? 'text-[#E5C158]' : 'text-[#F5F2EB]'
                        }`}
                      >
                        {row.name}
                      </span>
                      {isHighlighted && (
                        <span className="ml-2 text-xs text-[#E5C158]">
                          {badgeText}
                        </span>
                      )}
                      {totalRounds > 1 && (
                        <span className="block text-[11px] text-[#94A99F]">
                          {row.roundsWon}{' '}
                          {row.roundsWon > 1 ? 'manches gagnées' : 'manche gagnée'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right text-xs text-[#C1CEC8]">
                      {row.openedWith !== null ? `${row.openedWith} pts` : 'Non ouvert'}
                    </td>
                    <td className="px-3 py-3 text-right text-xs text-[#C1CEC8]">
                      {row.cardsRemaining} {row.cardsRemaining > 1 ? 'cartes' : 'carte'}
                    </td>
                    <td className="px-3 py-3 text-right text-white">
                      {row.penaltyPoints === 0 ? '0' : `+${row.penaltyPoints}`}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[#E5C158]">
                      {row.cumulativePenalty} pts
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Actions */}
        <div className="mt-7 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={onReturnMenu}
            className="min-h-[42px] rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-[#D4DDD9] whitespace-nowrap shrink-0 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5C158]"
          >
            Menu principal
          </button>

          {isGameOver ? (
            <button
              type="button"
              onClick={onRestartMatch}
              className="min-h-[42px] rounded-lg bg-[#D4AF37] px-5 py-2 text-sm font-semibold text-[#0B1712] whitespace-nowrap shrink-0 transition-colors hover:bg-[#E5C158] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDFBF7]"
            >
              Rejouer une partie
            </button>
          ) : (
            <button
              type="button"
              onClick={onNextRound}
              className="min-h-[42px] rounded-lg bg-[#D4AF37] px-5 py-2 text-sm font-semibold text-[#0B1712] whitespace-nowrap shrink-0 transition-colors hover:bg-[#E5C158] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDFBF7]"
            >
              Manche suivante
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
