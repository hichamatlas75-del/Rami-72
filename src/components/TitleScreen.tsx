import React, { useState } from 'react';
import {
  DIFFICULTY_META,
  Difficulty,
  PlayerCount,
  TotalRounds,
} from '../game/types';
import { SuitIcon } from './PlayingCard';

const HERO_IMAGE = '/src/assets/images/salon_hero_cards_1795129514322.jpg';

interface TitleScreenProps {
  playerCount: PlayerCount;
  totalRounds: TotalRounds;
  difficulty: Difficulty;
  onChangePlayerCount: (n: PlayerCount) => void;
  onChangeTotalRounds: (r: TotalRounds) => void;
  onChangeDifficulty: (d: Difficulty) => void;
  onStartGame: () => void;
}

const PLAYER_OPTIONS: PlayerCount[] = [2, 3, 4];

const ROUND_OPTIONS: { value: TotalRounds; label: string }[] = [
  { value: 1, label: '1 manche' },
  { value: 3, label: '3 manches' },
  { value: 5, label: '5 manches' },
];

const DIFFICULTY_LIST: Difficulty[] = ['detente', 'salon', 'maitre'];

const BAREME_ROWS = [
  { name: '2 à 10', meld: '2 à 10 pts', hand: '2 à 10 pts' },
  { name: 'Valet, Dame, Roi', meld: '10 pts', hand: '10 pts' },
  { name: 'As (en suite A-2-3)', meld: '1 pt', hand: '11 pts' },
  { name: 'As (en D-R-A ou Trio)', meld: '11 pts', hand: '11 pts' },
  { name: 'Joker (★)', meld: 'Carte remplacée', hand: '25 pts' },
];

export function TitleScreen({
  playerCount,
  totalRounds,
  difficulty,
  onChangePlayerCount,
  onChangeTotalRounds,
  onChangeDifficulty,
  onStartGame,
}: TitleScreenProps) {
  const [heroFailed, setHeroFailed] = useState(false);

  return (
    <div className="min-h-screen bg-[#081510] text-[#F5F2EB]">
      {/* Strict 3-zone Top Bar Contract */}
      <header className="border-b border-white/10 bg-[#081510]/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-6 py-4">
          <a
            href="#top"
            className="font-display text-xl font-semibold tracking-tight text-[#FDFBF7] whitespace-nowrap shrink-0"
          >
            Rami 72
          </a>

          <nav
            aria-label="Navigation principale"
            className="hidden items-center gap-7 text-sm font-medium text-[#B8C7C0] md:flex"
          >
            <a
              href="#table"
              className="whitespace-nowrap shrink-0 transition-colors hover:text-[#FDFBF7]"
            >
              Configurer
            </a>
            <a
              href="#regles"
              className="whitespace-nowrap shrink-0 transition-colors hover:text-[#FDFBF7]"
            >
              La règle du 72
            </a>
            <a
              href="#combinaisons"
              className="whitespace-nowrap shrink-0 transition-colors hover:text-[#FDFBF7]"
            >
              Combinaisons
            </a>
            <a
              href="#bareme"
              className="whitespace-nowrap shrink-0 transition-colors hover:text-[#FDFBF7]"
            >
              Barème
            </a>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={onStartGame}
              className="min-h-[40px] rounded-lg bg-[#D4AF37] px-4 py-2 text-sm font-semibold text-[#091611] whitespace-nowrap shrink-0 transition-colors hover:bg-[#E5C158] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDFBF7]"
            >
              Nouvelle partie
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="mx-auto max-w-6xl px-6 py-10 lg:py-14">
        {/* 2-Column Balanced Hero Split */}
        <section
          id="table"
          className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12 lg:gap-10"
        >
          {/* Left Column: Editorial Headline + Table Setup */}
          <div className="flex flex-col justify-between lg:col-span-6">
            <div>
              <p className="text-xs font-medium text-[#D4AF37]">
                Rami marocain · 2 à 4 joueurs · Ouverture à 72 points et surenchère
              </p>

              <h1 className="mt-3 max-w-xl font-display text-4xl font-semibold leading-[1.08] tracking-tight text-[#FDFBF7] sm:text-5xl">
                Le 72, la règle du tapis marocain.
              </h1>

              <p className="mt-4 max-w-lg text-base leading-relaxed text-[#BAC8C2]">
                Formez des suites de même couleur et des trios de couleurs différentes.
                Réunissez 72 points pour étaler le premier : chaque adversaire devra
                ensuite dépasser votre total pour ouvrir à son tour.
              </p>
            </div>

            {/* Interactive Configuration Controls */}
            <div className="mt-8 space-y-5 border-t border-white/10 pt-6">
              {/* Player count selector */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <span className="mb-2 block text-sm font-medium text-[#E4ECE8]">
                    Nombre de joueurs
                  </span>
                  <div
                    role="group"
                    aria-label="Nombre de joueurs"
                    className="grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1"
                  >
                    {PLAYER_OPTIONS.map((count) => {
                      const active = playerCount === count;
                      return (
                        <button
                          key={count}
                          type="button"
                          onClick={() => onChangePlayerCount(count)}
                          className={`min-h-[40px] rounded-lg px-2 py-1.5 font-mono text-sm font-medium tabular-nums whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5C158] ${
                            active
                              ? 'bg-[#173A2A] text-[#FDFBF7] ring-1 ring-[#D4AF37]/60'
                              : 'text-[#A6B7AF] hover:bg-white/[0.05] hover:text-white'
                          }`}
                        >
                          {count} J
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <span className="mb-2 block text-sm font-medium text-[#E4ECE8]">
                    Format
                  </span>
                  <div
                    role="group"
                    aria-label="Nombre de manches"
                    className="grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1"
                  >
                    {ROUND_OPTIONS.map((opt) => {
                      const active = totalRounds === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => onChangeTotalRounds(opt.value)}
                          className={`min-h-[40px] rounded-lg px-2 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5C158] ${
                            active
                              ? 'bg-[#173A2A] text-[#FDFBF7] ring-1 ring-[#D4AF37]/60'
                              : 'text-[#A6B7AF] hover:bg-white/[0.05] hover:text-white'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Difficulty selector */}
              <div>
                <div className="mb-2 flex items-baseline justify-between gap-4">
                  <span className="text-sm font-medium text-[#E4ECE8]">
                    Niveau des adversaires
                  </span>
                  <span className="text-xs text-[#98ABA3]">
                    {DIFFICULTY_META[difficulty].description}
                  </span>
                </div>
                <div
                  role="group"
                  aria-label="Niveau de difficulté"
                  className="grid grid-cols-3 gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] p-1"
                >
                  {DIFFICULTY_LIST.map((lvl) => {
                    const active = difficulty === lvl;
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => onChangeDifficulty(lvl)}
                        className={`min-h-[42px] rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5C158] ${
                          active
                            ? 'bg-[#173A2A] text-[#FDFBF7] ring-1 ring-[#D4AF37]/60'
                            : 'text-[#A6B7AF] hover:bg-white/[0.05] hover:text-white'
                        }`}
                      >
                        {DIFFICULTY_META[lvl].label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Primary CTA */}
              <div className="flex flex-wrap items-center gap-4 pt-1">
                <button
                  type="button"
                  onClick={onStartGame}
                  className="min-h-[48px] rounded-xl bg-[#D4AF37] px-7 py-3 text-base font-semibold text-[#081510] whitespace-nowrap shrink-0 shadow-[0_10px_28px_rgba(212,175,55,0.25)] transition-colors hover:bg-[#E5C158] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDFBF7]"
                >
                  Distribuer les cartes
                </button>
                <span className="text-xs text-[#9BB0A7]">
                  14 cartes par main · 15e carte au tapis · 108 cartes avec Jokers
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Editorial Salon Photography */}
          <div className="relative overflow-hidden rounded-2xl border border-white/12 bg-[#0E281D] lg:col-span-6">
            {!heroFailed ? (
              <img
                src={HERO_IMAGE}
                alt="Cartes de Rami disposées sur un tapis de feutre vert émeraude"
                referrerPolicy="no-referrer"
                onError={() => setHeroFailed(true)}
                className="h-72 w-full object-cover sm:h-96 lg:h-full"
              />
            ) : (
              <div className="felt-surface flex h-72 w-full flex-col items-center justify-center p-8 lg:h-full">
                <div className="flex items-center gap-5 text-[#D4AF37]">
                  <SuitIcon suit="spades" className="h-9 w-9" />
                  <SuitIcon suit="hearts" className="h-9 w-9 text-[#DC2626]" />
                  <SuitIcon suit="clubs" className="h-9 w-9" />
                  <SuitIcon suit="diamonds" className="h-9 w-9 text-[#DC2626]" />
                </div>
                <p className="mt-4 font-display text-xl text-[#FDFBF7]">Rami 72</p>
              </div>
            )}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#050E0A]/90 via-[#050E0A]/45 to-transparent px-6 pb-5 pt-16">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#E4ECE8]">
                <span>Seuil initial 72 pts</span>
                <span aria-hidden="true">·</span>
                <span>Surenchère obligatoire à chaque ouverture</span>
                <span aria-hidden="true">·</span>
                <span>Complétion &amp; échange de Jokers</span>
              </div>
            </div>
          </div>
        </section>

        {/* Below-the-fold Rules & Scoring Reference */}
        <section
          id="regles"
          className="mt-16 grid grid-cols-1 gap-10 border-t border-white/10 pt-12 lg:grid-cols-12"
        >
          <div id="combinaisons" className="space-y-6 lg:col-span-7">
            <div>
              <h2 className="font-display text-2xl font-semibold text-[#FDFBF7]">
                Comment fonctionne le 72
              </h2>
              <p className="mt-2 text-sm text-[#A6B7AF]">
                Une tension stratégique unique : plus vous attendez pour étaler après un
                adversaire, plus la barre à franchir monte.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="space-y-1.5 border-t border-white/10 pt-4">
                <h3 className="font-display text-base font-semibold text-[#E5C158]">
                  01. Suites de même couleur
                </h3>
                <p className="text-sm leading-relaxed text-[#BAC8C2]">
                  Alignez au moins 3 numéros consécutifs dans la même couleur (ex. 6♥ 7♥ 8♥
                  ou V♠ D♠ R♠ A♠). Les Jokers peuvent combler un trou.
                </p>
              </div>

              <div className="space-y-1.5 border-t border-white/10 pt-4">
                <h3 className="font-display text-base font-semibold text-[#E5C158]">
                  02. Trios et carrés
                </h3>
                <p className="text-sm leading-relaxed text-[#BAC8C2]">
                  Réunissez 3 ou 4 cartes de même valeur mais de couleurs différentes (ex.
                  10♠ 10♥ 10♦), sans jamais répéter deux fois la même couleur.
                </p>
              </div>

              <div className="space-y-1.5 border-t border-white/10 pt-4">
                <h3 className="font-display text-base font-semibold text-[#E5C158]">
                  03. Ouverture à 72 puis surenchère
                </h3>
                <p className="text-sm leading-relaxed text-[#BAC8C2]">
                  Le premier joueur à étaler doit atteindre au moins 72 points. S’il pose
                  78 points, le joueur suivant devra réunir au moins 79 points pour ouvrir.
                </p>
              </div>

              <div className="space-y-1.5 border-t border-white/10 pt-4">
                <h3 className="font-display text-base font-semibold text-[#E5C158]">
                  04. Compléter et gagner
                </h3>
                <p className="text-sm leading-relaxed text-[#BAC8C2]">
                  Une fois ouvert, vous pouvez ajouter vos cartes sur toutes les combinaisons
                  du tapis et récupérer un Joker. Videz votre main le premier pour gagner !
                </p>
              </div>
            </div>
          </div>

          <div id="bareme" className="lg:col-span-5">
            <h2 className="font-display text-2xl font-semibold text-[#FDFBF7]">
              Barème des points
            </h2>
            <p className="mt-2 text-sm text-[#A6B7AF]">
              Points comptés lors de l’ouverture sur le tapis et pénalités des cartes
              restantes en fin de manche.
            </p>

            <div className="mt-5 overflow-hidden rounded-xl border border-white/10 bg-[#0C1D16]">
              <table className="w-full text-sm">
                <thead className="border-b border-white/10 bg-white/[0.03] text-xs text-[#9DB0A7]">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Carte</th>
                    <th className="px-3 py-3 text-right font-medium text-[#E5C158]">
                      En pose
                    </th>
                    <th className="px-4 py-3 text-right font-medium">Pénalité</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono tabular-nums">
                  {BAREME_ROWS.map((row) => (
                    <tr key={row.name}>
                      <td className="px-4 py-2.5 font-sans font-medium text-[#F5F2EB]">
                        {row.name}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs text-[#E5C158]">
                        {row.meld}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-[#C8D4CE]">
                        {row.hand}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
