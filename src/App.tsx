import React, { useState } from 'react';
import { TitleScreen } from './components/TitleScreen';
import { GameTable } from './components/GameTable';
import { Difficulty, GameMode, PlayerCount, TotalRounds } from './game/types';
import { ramiAudio } from './game/sound';

export default function App() {
  const [inGame, setInGame] = useState(false);
  const [gameMode, setGameMode] = useState<GameMode>('rami72');
  const [playerCount, setPlayerCount] = useState<PlayerCount>(4);
  const [totalRounds, setTotalRounds] = useState<TotalRounds>(3);
  const [difficulty, setDifficulty] = useState<Difficulty>('salon');
  const [sessionId, setSessionId] = useState(1);

  const handleStartGame = () => {
    ramiAudio.playDeal();
    setSessionId((prev) => prev + 1);
    setInGame(true);
  };

  const handleSwitchGameModeInTable = (nextMode: GameMode) => {
    if (nextMode === gameMode) return;
    ramiAudio.playDeal();
    setGameMode(nextMode);
    setSessionId((prev) => prev + 1);
  };

  const handleExitToMenu = () => {
    setInGame(false);
  };

  if (inGame) {
    return (
      <GameTable
        key={`${gameMode}-${sessionId}`}
        gameMode={gameMode}
        playerCount={playerCount}
        totalRounds={totalRounds}
        difficulty={difficulty}
        onChangeGameMode={handleSwitchGameModeInTable}
        onExitToMenu={handleExitToMenu}
      />
    );
  }

  return (
    <TitleScreen
      gameMode={gameMode}
      playerCount={playerCount}
      totalRounds={totalRounds}
      difficulty={difficulty}
      onChangeGameMode={setGameMode}
      onChangePlayerCount={setPlayerCount}
      onChangeTotalRounds={setTotalRounds}
      onChangeDifficulty={setDifficulty}
      onStartGame={handleStartGame}
    />
  );
}
