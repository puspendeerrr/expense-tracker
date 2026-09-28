import React from 'react';
import { StyleSheet, Text, type TextStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { typography } from '@/theme/tokens';

export type SMAmountSize = 'compact' | 'default' | 'large';
export type SMAmountTone = 'default' | 'positive' | 'negative' | 'muted';

export type SMAmountProps = {
  /**
   * The formatted figure, exactly as it should read.
   *
   * A STRING, DELIBERATELY. This component is given text, never paise, so there is no way
   * for it to round, scale or otherwise reinterpret money on its way to the screen. All
   * formatting happens once, in `formatPaise`, against the server's integer paise.
   */
  value: string;
  size?: SMAmountSize;
  tone?: SMAmountTone;
  style?: TextStyle;
};

/**
 * A money figure, set consistently wherever it appears.
 *
 * Exists so every amount in the ledger shares one type ramp. Before this, each row set its
 * own size and weight inline, and a column of amounts drifted by a point or two between
 * screens — which in a finance product reads as carelessness about the number itself.
 *
 * TABULAR FIGURES. The digits are locked to one width so a vertical run of amounts lines
 * up on the decimal, and a scrolling list does not shimmer as glyph widths change. Without
 * it, "₹1,111" and "₹8,888" occupy visibly different widths in most proportional fonts.
 *
 * Capped at two lines' worth of shrinking rather than wrapping: an amount that wraps has
 * stopped being a number and become a paragraph.
 */
export function SMAmount({ value, size = 'default', tone = 'default', style }: SMAmountProps) {
  const { colors } = useTheme();

  const sizing: Record<SMAmountSize, TextStyle> = {
    compact: { fontSize: typography.bodySm, fontWeight: '700', letterSpacing: -0.2 },
    default: { fontSize: typography.body, fontWeight: '800', letterSpacing: -0.3 },
    large: { fontSize: typography.title, fontWeight: '800', letterSpacing: -0.6 },
  };

  const tinting: Record<SMAmountTone, string> = {
    default: colors.text,
    positive: colors.success,
    negative: colors.destructive,
    muted: colors.muted,
  };

  return (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.85}
      style={[styles.base, sizing[size], { color: tinting[tone] }, style]}
    >
      {value}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: { fontVariant: ['tabular-nums'] },
});
