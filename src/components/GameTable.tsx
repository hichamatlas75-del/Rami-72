import React, { useMemo, useState } from 'react';
import { BookOpen, Home, RotateCcw, Trophy, Volume2, VolumeX } from 'lucide-react';
import feltTableImage from '../assets/images/rami_felt_table.jpg';
import { Difficulty, GameMode, PlayerCount, TotalRounds } from '../game/types';
import { useRami72Game } from '../game/useRami72Game';
import { OpponentStrip } from './OpponentStrip';
import { PlayerHandArea } from './PlayerHandArea';
import { RoundModal } from './RoundModal';
import { RulesDrawer } from './RulesDrawer';
import { StockAndThresholdPanel } from './StockAndThresholdPanel';
import { TableMeldsCanvas } from './TableMeldsCanvas';

interface GameTableProps {
  gameMode: GameMode;
  playerCount: PlayerCount;
  totalRounds: TotalRounds;
  difficulty: Difficulty;
  onChangeGameMode: (mode: GameMode) => void;
  onExitToMenu: () => void;
}

export function GameTable({
  gameMode,
  playerCount,
  totalRounds,
  difficulty,
  onChangeGameMode,
  onExitToMenu,
}: GameTableProps) {
  const [feltFailed, setFeltFailed] = useState(false);
  const [inspectingTable, setInspectingTable] = useState(false);

  const {
    state,
    isSimple,
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
    selectedMeldBundle,
    autoCompleteBundle,
    lastDrawnCardId,
    lastDrawnCard,
    stagedTotalPoints,
    stagedOpeningCheck,
    directOpeningCheck,
    extendableMeldIds,
    swappableMeldIds,
    topDiscard,
    canDrawDiscard,
    canDirectOpenWithSelection,
    canCommitStagedOpening,
    canCommitSimpleStagedWin,
    simpleStagedDiscardCard,
    directSimpleWin,
    canDiscardSelected,
    handleChangeSortMode,
    reorderHandCard,
    nudgeHandCard,
    toggleSelectCard,
    handleHumanDraw,
    handleStageSelectedMeld,
    handleUnstageMeld,
    handleClearStaging,
    handleCommitMelds,
    handleSimpleWin,
    handleClickTableMeld,
    handleHumanDiscard,
    proceedFromReveal,
    handleNextRound,
    handleRestartMatch,
  } = useRami72Game({ mode: gameMode, playerCount, totalRounds, difficulty });

  const opponents = state.players.slice(1);
  const revealMeldSet = useMemo(
    () => new Set(state.revealMeldIds),
    [state.revealMeldIds]
  );
  const isSummaryPhase =
    state.phase === 'ROUND_SUMMARY' || state.phase === 'GAME_OVER';
  const revealWinner =
    state.phase === 'ROUND_REVEAL' && state.revealWinnerIndex !== null
      ? state.players[state.revealWinnerIndex]
      : null;

  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-[#07130E] text-[#F5F2EB] lg:h-screen lg:overflow-hidden">
      {/* Strict 3-Zone Top Bar */}
      <header className="z-30 flex items-center justify-between gap-2 border-b border-white/10 bg-[#081510]/95 px-3 py-2 sm:gap-3 sm:px-6 sm:py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onExitToMenu}
            aria-label="Retour au menu principal"
            title="Menu principal"
            className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-[#D4DDD9] shrink-0 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5C158]"
          >
            <Home className="h-4 w-4" />
          </button>

          <div
            role="tablist"
            aria-label="Onglets de jeu"
            className="inline-flex items-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.04] p-0.5 shrink-0"
          >
            <button
              type="button"
              role="tab"
              aria-selected={!isSimple}
              onClick={() => onChangeGameMode('rami72')}
              className={`min-h-[30px] rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5C158] ${
                !isSimple
                  ? 'bg-[#173A2A] text-[#E5C158] ring-1 ring-[#D4AF37]/50'
                  : 'text-[#A6B7AF] hover:text-white'
              }`}
            >
              Rami 72
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isSimple}
              onClick={() => onChangeGameMode('simple')}
              className={`min-h-[30px] rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5C158] ${
                isSimple
                  ? 'bg-[#173A2A] text-[#E5C158] ring-1 ring-[#D4AF37]/50'
                  : 'text-[#A6B7AF] hover:text-white'
              }`}
            >
              Simple
            </button>
          </div>

          <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] tabular-nums text-[#C8D4CE] md:hidden whitespace-nowrap">
            M {state.roundNumber}/{totalRounds}
          </span>
        </div>

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
          {isSimple ? (
            <span className="text-[#E5C158] font-medium">
              Mode Simple · Sans comptage · 13 cartes
            </span>
          ) : state.highestOpeningScore === null ? (
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
            title={isSimple ? 'Règles du Rami Simple (R)' : 'Règles du Rami 72 (R)'}
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
            onClick={() => {
              setInspectingTable(false);
              handleRestartMatch();
            }}
            aria-label="Recommencer la partie"
            title="Recommencer la partie"
            className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-lg text-[#D4DDD9] shrink-0 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5C158]"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Felt Card Table */}
      <main className="relative flex flex-1 flex-col justify-between overflow-x-hidden lg:overflow-hidden felt-surface">
        {!feltFailed && (
          <img
            src={feltTableImage}
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

        <OpponentStrip
          isSimple={isSimple}
          opponents={opponents}
          phase={state.phase}
          activePlayer={state.activePlayer}
          hands={state.hands}
          hasOpened={state.hasOpened}
          openedWith={state.openedWith}
          speech={state.speech}
        />

        {/* MIDDLE ZONE: Pioche & Défausse (Left) + Tapis des Combinaisons (Right) */}
        <section className="relative z-10 mx-auto my-2 flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-3 px-4 sm:flex-row sm:gap-5 sm:px-6">
          <StockAndThresholdPanel
            isSimple={isSimple}
            humanOpened={humanOpened}
            humanOpenedWith={state.openedWith[0]}
            highestOpeningScore={state.highestOpeningScore}
            lastOpenerIndex={state.lastOpenerIndex}
            players={state.players}
            requiredThreshold={requiredThreshold}
            stockCount={state.stock.length}
            discardCount={state.discard.length}
            topDiscard={topDiscard}
            isInitialTapisCard={state.isInitialTapisCard}
            isHumanDraw={isHumanDraw}
            canDrawDiscard={canDrawDiscard}
            canDiscardSelected={canDiscardSelected}
            onDrawStock={() => handleHumanDraw('stock')}
            onDrawDiscard={() => handleHumanDraw('discard')}
            onDiscardSelected={handleHumanDiscard}
          />

          <TableMeldsCanvas
            isSimple={isSimple}
            tableMelds={state.tableMelds}
            players={state.players}
            humanOpened={humanOpened}
            extendableMeldIds={extendableMeldIds}
            swappableMeldIds={swappableMeldIds}
            revealMeldIds={
              state.phase === 'ROUND_REVEAL' || inspectingTable
                ? revealMeldSet
                : undefined
            }
            onClickTableMeld={handleClickTableMeld}
          />
        </section>

        {revealWinner && (
          <div
            role="status"
            aria-live="polite"
            className="relative z-20 mx-auto mb-1 flex w-[calc(100%-2rem)] max-w-2xl flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E5C158]/60 bg-[#0B241A]/95 px-4 py-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
          >
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <Trophy className="h-4 w-4 shrink-0 text-[#E5C158]" />
              <span className="font-medium text-[#FDFBF7]">
                {revealWinner.isHuman
                  ? 'Vous étalez toute votre main sur le tapis !'
                  : `${revealWinner.name} étale sa main sur le tapis !`}
              </span>
            </div>
            <button
              type="button"
              onClick={proceedFromReveal}
              className="min-h-[34px] rounded-lg bg-[#D4AF37] px-3.5 py-1 text-xs font-semibold text-[#081510] whitespace-nowrap shrink-0 transition-colors hover:bg-[#E5C158]"
            >
              Voir le classement
            </button>
          </div>
        )}

        {isSummaryPhase && inspectingTable && (
          <div className="relative z-20 mx-auto mb-1 flex w-[calc(100%-2rem)] max-w-xl flex-wrap items-center justify-between gap-3 rounded-xl border border-[#D4AF37]/50 bg-[#0B241A]/95 px-4 py-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.45)]">
            <span className="text-xs font-medium text-[#E4ECE8] sm:text-sm">
              Inspection du tapis final
            </span>
            <button
              type="button"
              onClick={() => setInspectingTable(false)}
              className="min-h-[34px] rounded-lg bg-[#D4AF37] px-3.5 py-1 text-xs font-semibold text-[#081510] whitespace-nowrap shrink-0 transition-colors hover:bg-[#E5C158]"
            >
              Afficher le classement
            </button>
          </div>
        )}

        <PlayerHandArea
          isSimple={isSimple}
          visibleHumanHand={visibleHumanHand}
          selectedIds={selectedIds}
          selectedCards={selectedCards}
          selectedMeldBundle={selectedMeldBundle}
          autoCompleteBundle={autoCompleteBundle}
          stagedMelds={stagedMelds}
          stagedTotalPoints={stagedTotalPoints}
          stagedOpeningCheck={stagedOpeningCheck}
          directOpeningCheck={directOpeningCheck}
          lastDrawnCardId={lastDrawnCardId}
          lastDrawnCard={lastDrawnCard}
          requiredThreshold={requiredThreshold}
          humanOpened={humanOpened}
          isHumanDraw={isHumanDraw}
          isHumanPlay={isHumanPlay}
          isInitialTapisCard={state.isInitialTapisCard}
          activePlayerConfig={state.players[state.activePlayer]}
          feedbackMessage={feedbackMessage}
          canDirectOpenWithSelection={canDirectOpenWithSelection}
          canCommitStagedOpening={canCommitStagedOpening}
          canCommitSimpleStagedWin={canCommitSimpleStagedWin}
          simpleStagedDiscardCard={simpleStagedDiscardCard}
          directSimpleWin={directSimpleWin}
          canDiscardSelected={canDiscardSelected}
          sortMode={sortMode}
          onToggleSelectCard={toggleSelectCard}
          onReorderHandCard={reorderHandCard}
          onNudgeHandCard={nudgeHandCard}
          onStageSelectedMeld={handleStageSelectedMeld}
          onUnstageMeld={handleUnstageMeld}
          onClearStaging={handleClearStaging}
          onCommitMelds={handleCommitMelds}
          onSimpleWin={handleSimpleWin}
          onDiscardSelected={handleHumanDiscard}
          onChangeSortMode={handleChangeSortMode}
        />
      </main>

      {isSummaryPhase && !inspectingTable && state.roundResult && (
        <RoundModal
          isSimple={isSimple}
          result={state.roundResult}
          totalRounds={totalRounds}
          isGameOver={state.phase === 'GAME_OVER'}
          onInspectTable={() => setInspectingTable(true)}
          onNextRound={() => {
            setInspectingTable(false);
            handleNextRound();
          }}
          onRestartMatch={() => {
            setInspectingTable(false);
            handleRestartMatch();
          }}
          onReturnMenu={onExitToMenu}
        />
      )}

      <RulesDrawer
        open={rulesOpen}
        mode={gameMode}
        onClose={() => setRulesOpen(false)}
      />
    </div>
  );
}
