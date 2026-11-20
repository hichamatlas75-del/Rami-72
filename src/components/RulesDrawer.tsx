import React from 'react';
import { X } from 'lucide-react';

interface RulesDrawerProps {
  open: boolean;
  onClose: () => void;
}

const VALUE_ROWS = [
  { card: '2 à 10', meldPts: 'Valeur faciale (2 à 10 pts)', handPenalty: '2 à 10 pts' },
  { card: 'Valet, Dame, Roi', meldPts: '10 pts chacun', handPenalty: '10 pts' },
  { card: 'As (suite basse A-2-3)', meldPts: '1 pt', handPenalty: '11 pts' },
  { card: 'As (suite haute D-R-A ou Trio)', meldPts: '11 pts', handPenalty: '11 pts' },
  { card: 'Joker', meldPts: 'Valeur de la carte remplacée', handPenalty: '25 pts' },
];

export function RulesDrawer({ open, onClose }: RulesDrawerProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#040B08]/75 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Règles du Rami 72"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-md flex-col border-l border-[#D4AF37]/20 bg-[#0D1C16] text-[#F5F2EB] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 className="font-display text-xl font-semibold text-[#FDFBF7]">
            Règles du Rami 72
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer les règles"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[#C9D2CE] transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5C158]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5 text-sm leading-relaxed text-[#D4DDD9]">
          <section className="space-y-2">
            <h3 className="font-display text-base font-semibold text-[#E5C158]">
              01. Distribution et règle du 72
            </h3>
            <p className="text-[#C8D4CE]">
              Chaque joueur reçoit <strong className="text-white">14 cartes</strong> en main
              et la <strong className="text-white">15e carte</strong> est posée face visible
              au tapis pour ouvrir la manche (double jeu de 108 cartes avec 4 Jokers). Pour
              étaler ses cartes la première fois :
            </p>
            <ul className="list-disc space-y-1.5 pl-5 text-[#C1CEC8]">
              <li>
                Le <strong className="text-white">premier joueur qui ouvre</strong> doit
                étaler une ou plusieurs combinaisons totalisant au moins{' '}
                <strong className="font-mono text-[#E5C158]">72 points</strong>.
              </li>
              <li>
                Chaque <strong className="text-white">adversaire qui ouvre ensuite</strong>{' '}
                doit obligatoirement poser{' '}
                <strong className="text-[#E5C158]">strictement plus</strong> que la dernière
                ouverture (ex. si Youssef ouvre à 76 pts, il faut au moins 77 pts pour ouvrir).
              </li>
            </ul>
          </section>

          <section className="space-y-2 border-t border-white/10 pt-5">
            <h3 className="font-display text-base font-semibold text-[#E5C158]">
              02. Combinaisons autorisées
            </h3>
            <ul className="list-disc space-y-1.5 pl-5 text-[#C1CEC8]">
              <li>
                <strong className="text-white">Suite :</strong> au moins 3 cartes qui se
                suivent dans la <strong className="text-white">même couleur</strong> (ex.
                5♥ 6♥ 7♥ ou D♠ R♠ A♠).
              </li>
              <li>
                <strong className="text-white">Trio ou Carré :</strong> 3 ou 4 cartes de{' '}
                <strong className="text-white">même valeur</strong> et de{' '}
                <strong className="text-white">couleurs différentes</strong> (ex. 9♠ 9♥ 9♦).
              </li>
              <li>
                Les <strong className="text-white">Jokers</strong> remplacent n’importe
                quelle carte manquante (au moins 2 cartes réelles par combinaison).
              </li>
            </ul>
          </section>

          <section className="space-y-2 border-t border-white/10 pt-5">
            <h3 className="font-display text-base font-semibold text-[#E5C158]">
              03. Déroulement d’un tour et victoire
            </h3>
            <ul className="list-disc space-y-1.5 pl-5 text-[#C1CEC8]">
              <li>
                <strong className="text-white">1. Piocher :</strong> seule la{' '}
                <strong className="text-white">première carte dévoilée</strong> (15e carte
                au tapis en début de manche) peut être prise ; ensuite, tous les joueurs
                piochent uniquement les <strong className="text-white">cartes cachées</strong>.
              </li>
              <li>
                <strong className="text-white">2. Poser / Compléter :</strong> préparez vos
                combinaisons pour atteindre le seuil, ou une fois ouvert, posez librement,
                complétez n’importe quelle combinaison du tapis ou récupérez un Joker en le
                remplaçant par la carte exacte.
              </li>
              <li>
                <strong className="text-white">3. Défausser :</strong> terminez votre tour
                en défaussant une carte. Le premier joueur à vider entièrement sa main gagne
                la manche !
              </li>
            </ul>
          </section>

          <section className="space-y-3 border-t border-white/10 pt-5">
            <h3 className="font-display text-base font-semibold text-[#E5C158]">
              04. Valeur des cartes
            </h3>
            <div className="overflow-hidden rounded-lg border border-white/10">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/10 bg-white/[0.04] text-[#A8B8B1]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Carte</th>
                    <th className="px-3 py-2 font-medium text-[#E5C158]">En pose</th>
                    <th className="px-3 py-2 text-right font-medium">En main</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {VALUE_ROWS.map((row) => (
                    <tr key={row.card}>
                      <td className="px-3 py-2 font-medium text-[#F5F2EB]">{row.card}</td>
                      <td className="px-3 py-2 text-[#D4DDD9]">{row.meldPts}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-[#C1CEC8]">
                        {row.handPenalty}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
