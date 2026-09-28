import React, { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SMTextInput, type SMTextInputProps } from './SMTextInput';
import { Icon } from '../Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, typography } from '@/theme/tokens';

export type SMPasswordInputProps = Omit<SMTextInputProps, 'secureTextEntry' | 'rightAction'> & {
  showStrengthHint?: boolean;
};

export const SMPasswordInput = forwardRef<TextInput, SMPasswordInputProps>(function SMPasswordInput(
  { showStrengthHint = false, value, leftIcon = 'lock', ...props },
  ref,
) {
  const { colors } = useTheme();
  const [revealed, setRevealed] = useState(false);

  const lengthValid = (value?.length ?? 0) >= 8;

  const toggleAction = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
      accessibilityHint="Toggles password visibility"
      onPress={() => setRevealed((v) => !v)}
      hitSlop={12}
      style={styles.eyeBtn}
    >
      <Icon
        name={revealed ? 'eyeOff' : 'eye'}
        size={18}
        tone={revealed ? 'primary' : 'muted'}
      />
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <SMTextInput
        ref={ref}
        value={value}
        leftIcon={leftIcon}
        secureTextEntry={!revealed}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="password"
        rightAction={toggleAction}
        {...props}
      />

      {showStrengthHint && value && value.length > 0 ? (
        <View style={styles.hintRow}>
          <Icon
            name={lengthValid ? 'checkCircle' : 'alertCircle'}
            size={12}
            tone={lengthValid ? 'success' : 'muted'}
          />
          <Text
            style={[
              styles.hintText,
              { color: lengthValid ? colors.success : colors.muted },
            ]}
          >
            {lengthValid ? 'At least 8 characters' : 'Must be at least 8 characters'}
          </Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: spacing.xs,
  },
  eyeBtn: {
    padding: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  hintText: {
    fontSize: typography.xs,
    fontWeight: '500',
  },
});

