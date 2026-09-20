import React from 'react';
import { cn } from '@/lib/utils';

export interface BrandLogoProps {
  /**
   * 'full' renders the complete brand mark with text ('SplitMoney Logo With Text.svg').
   * 'icon' renders only the icon emblem ('SplitMoney only logo.svg').
   * @default 'full'
   */
  variant?: 'full' | 'icon';
  /**
   * Predefined proportional scale or pass custom className.
   * @default 'md'
   */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'custom';
  className?: string;
  alt?: string;
  priority?: boolean;
}

const sizeClasses: Record<NonNullable<BrandLogoProps['variant']>, Record<string, string>> = {
  full: {
    xs: 'h-10 w-auto',
    sm: 'h-12 w-auto',
    md: 'h-14 w-auto',
    lg: 'h-16 w-auto',
    xl: 'h-20 w-auto',
    '2xl': 'h-24 w-auto',
    custom: 'w-auto',
  },
  icon: {
    xs: 'h-8 w-8',
    sm: 'h-10 w-10',
    md: 'h-12 w-12',
    lg: 'h-14 w-14',
    xl: 'h-16 w-16',
    '2xl': 'h-20 w-20',
    custom: '',
  },
};

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'full',
  size = 'md',
  className,
  alt = 'SplitMoney',
  priority = false,
}) => {
  const isFull = variant === 'full';
  const src = isFull ? '/SplitMoney Logo With Text.svg' : '/SplitMoney only logo.svg';
  const baseSize = size !== 'custom' ? sizeClasses[variant][size] : 'w-auto';

  return (
    <img
      src={src}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      className={cn(
        'select-none object-contain transition-transform duration-150 shrink-0 w-auto',
        baseSize,
        className,
      )}
    />
  );
};
