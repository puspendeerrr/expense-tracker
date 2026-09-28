import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../Icon';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, shadows, spacing, typography } from '@/theme/tokens';

export type SMGroupHeroProps = {
  name: string;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  description?: string | null;
  memberCount?: number;
  currency?: string;
  role?: 'creator' | 'member';
  onPressMembers?: () => void;
  /**
   * Present only for someone allowed to change the group's images. When absent, no edit
   * affordance is drawn at all — not a disabled one.
   */
  onEditAppearance?: () => void;
};

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('') || '?';

/**
 * Who this group is.
 *
 * COVER TREATMENT, NOT A HERO IMAGE. The cover is a 104dp band, not a half-screen
 * photograph. A big hero looks impressive in a screenshot and pushes the one thing people
 * came to do — add an expense — below the fold on a 360dp phone. The avatar overlaps its
 * lower edge, which anchors the identity without spending more vertical space.
 *
 * A group with no cover is not a group with a hole in it: the band becomes a soft tint of
 * the brand colour, so the layout is identical whether or not an image exists. The same
 * goes for a cover that fails to load — `onError` drops back to the tint rather than
 * leaving a grey rectangle.
 *
 * TYPOGRAPHY DOES THE RANKING. The name is the only heavy thing here. Metadata is one
 * quiet line, and the description is quieter still and clamped to three lines, so a
 * paragraph somebody pasted cannot push the primary action off the screen.
 */
export function SMGroupHero({
  name,
  avatarUrl,
  coverUrl,
  description,
  memberCount,
  currency,
  role,
  onPressMembers,
  onEditAppearance,
}: SMGroupHeroProps) {
  const { colors, dark } = useTheme();

  const [coverFailed, setCoverFailed] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const coverFade = useRef(new Animated.Value(0)).current;

  /*
   * A new URL is a new image. Without this, a cover that once failed to load would stay
   * hidden after the creator uploads a replacement, and the replacement would pop in at
   * full opacity instead of fading like the first one did.
   */
  useEffect(() => {
    setCoverFailed(false);
    coverFade.setValue(0);
  }, [coverUrl, coverFade]);

  useEffect(() => {
    setAvatarFailed(false);
  }, [avatarUrl]);

  const showCover = Boolean(coverUrl) && !coverFailed;
  const showAvatar = Boolean(avatarUrl) && !avatarFailed;

  const meta = [
    memberCount === undefined
      ? null
      : memberCount + (memberCount === 1 ? ' member' : ' members'),
    currency,
    role === 'creator' ? 'Owner' : null,
  ].filter(Boolean) as string[];

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.cover,
          { backgroundColor: dark ? colors.surfaceElevated ?? colors.surface : colors.primarySubtle ?? colors.subtle },
        ]}
      >
        {showCover ? (
          <Animated.Image
            source={{ uri: coverUrl as string }}
            style={[StyleSheet.absoluteFill, { opacity: coverFade }]}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
            // Faded in rather than popped in, so a slow image does not flash the layout.
            onLoad={() =>
              Animated.timing(coverFade, {
                toValue: 1,
                duration: motion.duration.emphasis,
                useNativeDriver: true,
              }).start()
            }
            onError={() => setCoverFailed(true)}
          />
        ) : null}

        {/* Keeps the avatar edge legible against a busy photograph. */}
        {showCover ? (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: dark ? 'rgba(0,0,0,0.35)' : 'rgba(15,23,42,0.18)' },
            ]}
          />
        ) : null}

        {onEditAppearance ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={showCover ? 'Change cover image' : 'Add a cover image'}
            onPress={onEditAppearance}
            hitSlop={8}
            style={({ pressed }) => [
              styles.coverEdit,
              { backgroundColor: 'rgba(15,23,42,0.55)', opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <Icon name="camera" size={13} color="#FFFFFF" />
            <Text style={styles.coverEditText}>{showCover ? 'Edit cover' : 'Add cover'}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.identity}>
        <View
          style={[
            styles.avatarRing,
            { backgroundColor: colors.background, borderColor: colors.background },
            !dark ? shadows.md : null,
          ]}
        >
          {showAvatar ? (
            <Image
              source={{ uri: avatarUrl as string }}
              style={styles.avatar}
              accessibilityIgnoresInvertColors
              accessibilityLabel={name + ' group picture'}
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            <View
              style={[
                styles.avatar,
                styles.avatarFallback,
                {
                  backgroundColor: colors.primarySubtle ?? colors.subtle,
                  borderColor: dark ? colors.borderStrong : colors.border,
                },
              ]}
            >
              <Text style={[styles.avatarInitials, { color: colors.primary }]}>
                {initials(name)}
              </Text>
            </View>
          )}

          {onEditAppearance ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change group photo"
              onPress={onEditAppearance}
              hitSlop={10}
              style={({ pressed }) => [
                styles.avatarEdit,
                {
                  backgroundColor: colors.primary,
                  borderColor: colors.background,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Icon name="camera" size={12} color={colors.onPrimary ?? '#FFFFFF'} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.text}>
          <Text
            accessibilityRole="header"
            numberOfLines={2}
            style={[styles.name, { color: colors.text }]}
          >
            {name}
          </Text>

          {meta.length > 0 ? (
            <Pressable
              accessibilityRole={onPressMembers ? 'button' : undefined}
              accessibilityLabel={meta.join(', ') + (onPressMembers ? '. View members.' : '')}
              onPress={onPressMembers}
              disabled={!onPressMembers}
              style={({ pressed }) => [styles.metaRow, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Icon name="users" size={13} tone="muted" />
              <Text style={[styles.meta, { color: colors.muted }]} numberOfLines={1}>
                {meta.join('  ·  ')}
              </Text>
            </Pressable>
          ) : null}

          {description?.trim() ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={expanded ? 'Collapse description' : 'Expand description'}
              onPress={() => setExpanded((value) => !value)}
            >
              <Text
                numberOfLines={expanded ? undefined : 3}
                style={[styles.description, { color: colors.muted }]}
              >
                {description.trim()}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  coverEdit: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm + 2,
    minHeight: 32,
    borderRadius: radius.pill,
  },
  coverEditText: { color: '#FFFFFF', fontSize: typography.xs, fontWeight: '700' },
  avatarEdit: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrap: { width: '100%' },
  cover: {
    height: 104,
    width: '100%',
    overflow: 'hidden',
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.base,
    paddingHorizontal: spacing.base,
    // Pulls the avatar up over the cover's lower edge.
    marginTop: -32,
  },
  avatarRing: {
    padding: 3,
    borderRadius: radius.lg + 3,
    borderWidth: 1,
  },
  avatar: { width: 64, height: 64, borderRadius: radius.lg },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  avatarInitials: { fontSize: typography.title, fontWeight: '800' },
  // Pushed down so the name baseline clears the cover rather than sitting on it.
  text: { flex: 1, paddingTop: 38, gap: spacing.xxs },
  name: {
    fontSize: typography.title,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: 2 },
  meta: { fontSize: typography.caption, fontWeight: '500', flexShrink: 1 },
  description: { fontSize: typography.caption, lineHeight: 19, paddingTop: spacing.xxs },
});
