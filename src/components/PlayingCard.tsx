import React, { useState } from 'react';
import { Card, RANK_LABEL, Rank, SUIT_META, Suit } from '../game/types';
import cardBackImage from '../assets/images/card_back_pattern.jpg';

export function SuitIcon({
  suit,
  className = 'w-4 h-4',
}: {
  suit: Suit;
  className?: string;
}) {
  switch (suit) {
    case 'hearts':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      );
    case 'diamonds':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M12 2L4.5 12 12 22l7.5-10L12 2z" />
        </svg>
      );
    case 'spades':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M12 2C9 6.5 4 9.8 4 14c0 2.6 2 4.5 4.4 4.5 1.3 0 2.4-.6 3.1-1.5-.1 1.7-.7 3.1-2 4h5c-1.3-.9-1.9-2.3-2-4 .7.9 1.8 1.5 3.1 1.5 2.4 0 4.4-1.9 4.4-4.5 0-4.2-5-7.5-8-12z" />
        </svg>
      );
    case 'clubs':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M12 3a3.6 3.6 0 0 0-3.6 3.6c0 1.2.6 2.2 1.5 2.9-.5-.1-1-.2-1.5-.2A3.6 3.6 0 0 0 4.8 13a3.6 3.6 0 0 0 3.6 3.6c1.2 0 2.2-.6 2.9-1.4-.1 2.2-.7 3.8-2.1 5.3h5.6c-1.4-1.5-2-3.1-2.1-5.3.7.8 1.7 1.4 2.9 1.4a3.6 3.6 0 0 0 3.6-3.6 3.6 3.6 0 0 0-3.6-3.6c-.5 0-1 .1-1.5.2.9-.7 1.5-1.7 1.5-2.9A3.6 3.6 0 0 0 12 3z" />
        </svg>
      );
  }
}

export type CardSize = 'table' | 'xs' | 'sm' | 'md';

const SIZE_CLASSES: Record<CardSize, string> = {
  table: 'w-11 h-16 sm:w-12 sm:h-[68px] rounded-md',
  xs: 'w-9 h-13 rounded-md',
  sm: 'w-14 h-20 sm:w-16 sm:h-23 rounded-lg',
  md: 'w-[60px] h-[88px] sm:w-[70px] sm:h-[102px] lg:w-[76px] lg:h-[112px] rounded-xl',
};

interface CardBackProps {
  size?: CardSize;
  className?: string;
}

export function CardBack({ size = 'sm', className = '' }: CardBackProps) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div
      className={`relative overflow-hidden border border-[#E9E2D0]/90 bg-[#FDFBF7] p-[2px] shadow-[0_5px_14px_rgba(0,0,0,0.42)] select-none ${SIZE_CLASSES[size]} ${className}`}
      aria-hidden="true"
    >
      <div className="relative h-full w-full overflow-hidden rounded-[inherit] card-back-fallback">
        {!imgFailed ? (
          <img
            src={cardBackImage}
            alt="Dos de carte Rami 72"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center border border-[#D4AF37]/40">
            <span className="font-display text-[10px] font-semibold text-[#D4AF37]">72</span>
          </div>
        )}
      </div>
    </div>
  );
}

interface PlayingCardProps {
  card: Card;
  size?: CardSize;
  interactive?: boolean;
  selected?: boolean;
  disabled?: boolean;
  highlighted?: boolean;
  /** Shown on a Joker placed inside a table meld to indicate which card it replaces */
  represents?: { rank: Rank; suit: Suit };
  onClick?: () => void;
  className?: string;
}

export function PlayingCard({
  card,
  size = 'md',
  interactive = false,
  selected = false,
  disabled = false,
  highlighted = false,
  represents,
  onClick,
  className = '',
}: PlayingCardProps) {
  const isCompact = size === 'table' || size === 'xs';

  const cardInner = card.isJoker ? (
    <div
      className={`relative flex h-full w-full flex-col items-center justify-between overflow-hidden rounded-[inherit] card-paper select-none border-[1.5px] ${
        selected
          ? 'border-[#D4AF37] ring-2 ring-[#E5C158] shadow-[0_12px_24px_rgba(212,175,55,0.42)]'
          : 'border-[#C9A033] shadow-[0_6px_14px_rgba(0,0,0,0.38)]'
      }`}
    >
      <div className="pointer-events-none absolute inset-[2px] rounded-[inherit] border border-[#D4AF37]/50" />
      <div className="relative z-10 flex w-full items-center justify-between px-1.5 pt-1 text-[#8F1D24]">
        <span className={`font-display font-bold leading-none ${isCompact ? 'text-[10px]' : 'text-xs'}`}>
          ★
        </span>
        {!isCompact && (
          <span className="font-display text-[9px] font-semibold tracking-wider text-[#9A7418]">
            JOKER
          </span>
        )}
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-1 text-center">
        {represents ? (
          <div
            className={`flex flex-col items-center leading-none ${
              SUIT_META[represents.suit].isRed ? 'text-[#B91C1C]' : 'text-[#141820]'
            }`}
          >
            <span className="font-display text-xs font-bold">{represents.rank}</span>
            <SuitIcon suit={represents.suit} className="mt-0.5 h-3 w-3" />
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className={`${isCompact ? 'h-4 w-4' : 'h-6 w-6'} text-[#B58922]`}
              aria-hidden="true"
            >
              <path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4L12 2z" />
            </svg>
            {!isCompact && (
              <span className="mt-1 font-display text-[10px] font-semibold tracking-wide text-[#8F1D24]">
                Joker
              </span>
            )}
          </div>
        )}
      </div>

      <div className="relative z-10 flex w-full items-center justify-end px-1.5 pb-1 text-[#8F1D24]">
        <span className={`font-display font-bold leading-none ${isCompact ? 'text-[10px]' : 'text-xs'}`}>
          ★
        </span>
      </div>
    </div>
  ) : (
    (() => {
      const suit = card.suit!;
      const rank = card.rank!;
      const meta = SUIT_META[suit];
      const colorClass = meta.isRed ? 'text-[#B91C1C]' : 'text-[#141820]';
      const isCourt = rank === 'V' || rank === 'D' || rank === 'R';

      return (
        <div
          className={`relative flex h-full w-full flex-col justify-between overflow-hidden rounded-[inherit] card-paper select-none border ${
            selected
              ? 'border-[#D4AF37] ring-2 ring-[#E5C158] shadow-[0_12px_24px_rgba(212,175,55,0.4)]'
              : highlighted
              ? 'border-[#D4AF37] ring-1 ring-[#D4AF37]/80 shadow-[0_8px_18px_rgba(212,175,55,0.28)]'
              : 'border-[#D7D0C0] shadow-[0_5px_14px_rgba(0,0,0,0.36)]'
          }`}
        >
          <div className="pointer-events-none absolute inset-[2px] rounded-[inherit] border border-[#E9E2D2]" />

          {/* Top-left rank + suit */}
          <div className={`relative z-10 flex items-start justify-between ${isCompact ? 'px-1 pt-0.5' : 'px-1.5 pt-1'} ${colorClass}`}>
            <div className="flex flex-col items-center leading-none">
              <span
                className={`font-display font-bold tracking-tight ${
                  size === 'table'
                    ? 'text-[13px]'
                    : size === 'sm'
                    ? 'text-sm'
                    : 'text-base sm:text-lg'
                }`}
              >
                {rank}
              </span>
              <SuitIcon
                suit={suit}
                className={
                  size === 'table'
                    ? 'mt-0.5 h-2.5 w-2.5'
                    : size === 'sm'
                    ? 'mt-0.5 h-3 w-3'
                    : 'mt-0.5 h-3.5 w-3.5'
                }
              />
            </div>
          </div>

          {/* Center symbol */}
          <div className={`relative z-10 flex flex-1 items-center justify-center ${colorClass}`}>
            {isCourt && !isCompact ? (
              <div className="flex flex-col items-center rounded border border-[#E5DEC9] bg-[#F5F0E4]/80 px-1.5 py-0.5">
                <SuitIcon suit={suit} className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="font-display text-[9px] font-semibold uppercase tracking-wider opacity-80">
                  {RANK_LABEL[rank]}
                </span>
              </div>
            ) : (
              <SuitIcon
                suit={suit}
                className={
                  size === 'table'
                    ? 'h-4 w-4 opacity-90'
                    : size === 'sm'
                    ? 'h-5 w-5 opacity-90'
                    : rank === 'A'
                    ? 'h-8 w-8'
                    : 'h-6 w-6 opacity-90'
                }
              />
            )}
          </div>

          {/* Bottom-right index (hidden on ultra-compact table slots to maximize clarity) */}
          {!isCompact && (
            <div className={`relative z-10 flex items-end justify-end px-1.5 pb-1 ${colorClass}`}>
              <div className="flex rotate-180 flex-col items-center leading-none">
                <span className="font-display text-sm font-bold tracking-tight">
                  {rank}
                </span>
                <SuitIcon suit={suit} className="mt-0.5 h-2.5 w-2.5" />
              </div>
            </div>
          )}
        </div>
      );
    })()
  );

  const label = card.isJoker
    ? represents
      ? `Joker remplaçant ${RANK_LABEL[represents.rank]} de ${SUIT_META[represents.suit].label}`
      : 'Joker'
    : `${RANK_LABEL[card.rank!]} de ${SUIT_META[card.suit!].label}`;

  if (interactive) {
    return (
      <button
        type="button"
        onClick={!disabled ? onClick : undefined}
        disabled={disabled}
        aria-pressed={selected}
        aria-label={label}
        className={`relative block text-left transition-transform duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5C158] focus-visible:ring-offset-1 focus-visible:ring-offset-[#0C3F2A] ${SIZE_CLASSES[size]} ${
          selected
            ? '-translate-y-4 cursor-pointer'
            : disabled
            ? 'cursor-default opacity-80'
            : 'cursor-pointer hover:-translate-y-2'
        } ${className}`}
      >
        {cardInner}
      </button>
    );
  }

  return (
    <div aria-label={label} className={`relative block ${SIZE_CLASSES[size]} ${className}`}>
      {cardInner}
    </div>
  );
}
