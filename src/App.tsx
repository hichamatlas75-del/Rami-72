import React, { useState } from 'react';
import { TitleScreen } from './components/TitleScreen';
import { GameTable } from './components/GameTable';
import { Difficulty, PlayerCount, TotalRounds } from './game/types';
import { salonAudio } from './game/sound';

export default function App() {
  const [inGame, setInGame] = useState(false);
  const [playerCount, setPlayerCount] = useState<PlayerCount>(4);
  const [totalRounds, setTotalRounds] = useState<TotalRounds>(3);
  const [difficulty, setDifficulty] = useState<Difficulty>('salon');
  const [sessionId, setSessionId] = useState(1);

  const handleStartGame = () => {
    salonAudio.playDeal();
    setSessionId((prev) => prev + 1);
    setInGame(true);
  };

  const handleExitToMenu = () => {
    setInGame(false);
  };

  if (inGame) {
    return (
      <GameTable
        key={sessionId}
        playerCount={playerCount}
        totalRounds={totalRounds}
        difficulty={difficulty}
        onExitToMenu={handleExitToMenu}
      />
    );
  }

  return (
    <TitleScreen
      playerCount={playerCount}
      totalRounds={totalRounds}
      difficulty={difficulty}
      onChangePlayerCount={setPlayerCount}
      onChangeTotalRounds={setTotalRounds}
      onChangeDifficulty={setDifficulty}
      onStartGame={handleStartGame}
    />
  );
}
