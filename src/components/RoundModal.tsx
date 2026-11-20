import React from 'react';
import { Eye } from 'lucide-react';
import { RoundResult, TotalRounds } from '../game/types';

interface RoundModalProps {
  isSimple?: boolean;
  result: RoundResult;
  totalRounds: TotalRounds;
  isGameOver: boolean;
  onInspectTable?: () => void;
  onNextRound: () => void;
  onRestartMatch: () => void;
  onReturnMenu: () => void;
}

export function RoundModal({
  isSimple = false,
  result,
  totalRounds,
  isGameOver,
  onInspectTable,
  onNextRound,
  onRestartMatch,
  onReturnMenu,
}: RoundModalProps) {
  const humanWonRound = result.winnerIndex === 0;

  // Overall champion at end of multi-round match: most rounds won, tiebreak lowest penalty points (or fewest cards remaining in Simple)
  const sortedFinal = [...result.standings].sort((a, b) => {
    if (b.roundsWon !== a.roundsWon) return b.roundsWon - a.roundsWon;
    if (isSimple) return a.cardsRemaining - b.cardsRemaining;
    return a.cumulativePenalty - b.cumulativePenalty;
  });
  const champion = sortedFinal[0];

  // In intermediate round summaries, rank by round result first; at game over, rank by overall champion
  const displayedStandings = isGameOver
    ? sortedFinal
    : [...result.standings].sort((a, b) => {
        if (a.isWinner !== b.isWinner) return a.isWinner ? -1 : 1;
        if (isSimple) return a.cardsRemaining - b.cardsRemaining;
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
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#040C09]/80 p-3 backdrop-blur-xs sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={isGameOver ? 'Classement final' : `Fin de la manche ${result.roundNumber}`}
    >
      <div className="w-full max-w-xl rounded-2xl border border-[#D4AF37]/30 bg-[#0D1E17] p-4 text-[#F5F2EB] shadow-[0_24px_60px_rgba(0,0,0,0.65)] sm:p-7">
        {/* Clean unboxed metadata */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#A3B5AD]">
          <span>
            Manche {result.roundNumber} sur {totalRounds}
          </span>
          {!isSimple && result.highestOpeningScore !== null && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                Plus haute ouverture : {result.highestOpeningScore} pts
              </span>
            </>
          )}
          {isSimple && (
            <>
              <span aria-hidden="true">·</span>
              <span>Mode Simple · Sans comptage</span>
            </>
          )}
        </div>

        <h2 className="mt-2 font-display text-2xl font-semibold text-[#FDFBF7] sm:text-3xl">
          {headline}
        </h2>

        <p className="mt-1.5 text-xs leading-relaxed text-[#B7C7C0] sm:text-sm">
          {isSimple
            ? isGameOver
              ? `Classement final après ${totalRounds} ${totalRounds > 1 ? 'manches' : 'manche'} (aucun comptage de points).`
              : 'Aucun comptage de points : seul le premier joueur à combiner toute sa main remporte la manche.'
            : isGameOver
            ? `Classement final après ${totalRounds} ${totalRounds > 1 ? 'manches' : 'manche'} (moins de points de pénalité départage les égalités).`
            : 'Les cartes restantes en main comptent comme points de pénalité.'}
        </p>

        {/* Standings table */}
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02] sm:mt-5">
          <table className="w-full text-xs sm:text-sm">
            <thead className="border-b border-white/10 bg-white/[0.03] text-[11px] text-[#9DB0A7] sm:text-xs">
              <tr>
                <th className="px-2.5 py-2.5 text-left font-medium sm:px-4">
                  Joueur
                </th>
                {!isSimple && (
                  <th className="px-2 py-2.5 text-right font-medium sm:px-3">
                    <span className="sm:hidden">Ouv.</span>
                    <span className="hidden sm:inline">Ouverture</span>
                  </th>
                )}
                <th className="px-2 py-2.5 text-right font-medium sm:px-3">
                  Reste
                </th>
                {!isSimple ? (
                  <>
                    <th className="px-2 py-2.5 text-right font-medium sm:px-3">
                      <span className="sm:hidden">Pts</span>
                      <span className="hidden sm:inline">Manche</span>
                    </th>
                    <th className="px-2.5 py-2.5 text-right font-medium text-[#E5C158] sm:px-4">
                      Total
                    </th>
                  </>
                ) : (
                  <th className="px-2.5 py-2.5 text-right font-medium text-[#E5C158] sm:px-4">
                    Victoires
                  </th>
                )}
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
                    <td className="px-2.5 py-2.5 font-sans sm:px-4 sm:py-3">
                      <span
                        className={`font-medium ${
                          row.isHuman ? 'text-[#E5C158]' : 'text-[#F5F2EB]'
                        }`}
                      >
                        {row.name}
                      </span>
                      {isHighlighted && (
                        <span className="ml-1.5 text-[11px] text-[#E5C158] sm:ml-2 sm:text-xs">
                          {badgeText}
                        </span>
                      )}
                      {!isSimple && totalRounds > 1 && (
                        <span className="block text-[11px] text-[#94A99F]">
                          {row.roundsWon}{' '}
                          {row.roundsWon > 1 ? 'manches gagnées' : 'manche gagnée'}
                        </span>
                      )}
                    </td>
                    {!isSimple && (
                      <td className="px-2 py-2.5 text-right text-[11px] text-[#C1CEC8] sm:px-3 sm:py-3 sm:text-xs">
                        {row.openedWith !== null ? (
                          `${row.openedWith} pts`
                        ) : (
                          <>
                            <span className="sm:hidden">—</span>
                            <span className="hidden sm:inline">Non ouvert</span>
                          </>
                        )}
                      </td>
                    )}
                    <td className="px-2 py-2.5 text-right text-[11px] text-[#C1CEC8] sm:px-3 sm:py-3 sm:text-xs">
                      {row.isWinner ? (
                        <span className="text-[#6EE7B7]">Étalé</span>
                      ) : (
                        <>
                          <span className="sm:hidden">{row.cardsRemaining}</span>
                          <span className="hidden sm:inline">
                            {row.cardsRemaining}{' '}
                            {row.cardsRemaining > 1 ? 'cartes' : 'carte'}
                          </span>
                        </>
                      )}
                    </td>
                    {!isSimple ? (
                      <>
                        <td className="px-2 py-2.5 text-right text-white sm:px-3 sm:py-3">
                          {row.penaltyPoints === 0 ? '0' : `+${row.penaltyPoints}`}
                        </td>
                        <td className="px-2.5 py-2.5 text-right font-semibold text-[#E5C158] sm:px-4 sm:py-3">
                          {row.cumulativePenalty} pts
                        </td>
                      </>
                    ) : (
                      <td className="px-2.5 py-2.5 text-right font-semibold text-[#E5C158] sm:px-4 sm:py-3">
                        {row.roundsWon}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2.5 sm:mt-7">
          {onInspectTable ? (
            <button
              type="button"
              onClick={onInspectTable}
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg border border-white/15 px-3.5 py-2 text-xs font-medium text-[#D4DDD9] whitespace-nowrap shrink-0 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5C158] sm:text-sm"
            >
              <Eye className="h-4 w-4" />
              Voir le tapis
            </button>
          ) : (
            <span />
          )}

          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onReturnMenu}
              className="min-h-[42px] rounded-lg border border-white/15 px-3.5 py-2 text-xs font-medium text-[#D4DDD9] whitespace-nowrap shrink-0 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5C158] sm:px-4 sm:text-sm"
            >
              Menu principal
            </button>

            {isGameOver ? (
              <button
                type="button"
                onClick={onRestartMatch}
                className="min-h-[42px] rounded-lg bg-[#D4AF37] px-4 py-2 text-xs font-semibold text-[#0B1712] whitespace-nowrap shrink-0 transition-colors hover:bg-[#E5C158] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDFBF7] sm:px-5 sm:text-sm"
              >
                Rejouer une partie
              </button>
            ) : (
              <button
                type="button"
                onClick={onNextRound}
                className="min-h-[42px] rounded-lg bg-[#D4AF37] px-4 py-2 text-xs font-semibold text-[#0B1712] whitespace-nowrap shrink-0 transition-colors hover:bg-[#E5C158] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDFBF7] sm:px-5 sm:text-sm"
              >
                Manche suivante
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
