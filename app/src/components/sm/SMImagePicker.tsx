import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Icon, type IconName } from '../Icon';
import { SMActionSheet } from './SMActionSheet';
import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius, spacing, typography } from '@/theme/tokens';
import { uploadImage, UploadError, type PickedImage, type UploadResult } from '@/lib/upload';
import { runtime } from '@/constants/environment';

export type SMImagePickerVariant = 'receipt' | 'avatar' | 'cover';

export type SMImagePickerProps = {
  variant: SMImagePickerVariant;
  label: string;
  /** The image currently saved, if any. */
  url: string | null;
  /**
   * Called with the uploaded image, or null when the person removes it.
   *
   * The whole `{ url, publicId }` pair is handed back, because the group media endpoint
   * needs the public id to delete the image it replaces. A receipt only stores the URL and
   * the caller simply ignores the id.
   */
  onChange: (image: UploadResult | null) => void | Promise<void>;
  /** Hides the remove action, for a slot that must always hold something. */
  removable?: boolean;
  helperText?: string;
  disabled?: boolean;
  /**
   * Cloudinary folder, passed through to `uploadImage` unchanged. Receipts must keep
   * using the folder they always have, so storage stays exactly where it was.
   */
  folder?: string;
};

type Phase =
  | { kind: 'idle' }
  | { kind: 'uploading'; progress: number; local: string }
  | { kind: 'failed'; message: string; image: PickedImage };

/** Crop shape per slot. A receipt is left uncropped: trimming it could cut off a total. */
const CROP: Record<SMImagePickerVariant, [number, number] | null> = {
  receipt: null,
  avatar: [1, 1],
  cover: [16, 7],
};

/** 'Payment QR' -> 'payment QR': lowercases the first letter only, so acronyms survive. */
const lowerFirst = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);

const ICON: Record<SMImagePickerVariant, IconName> = {
  receipt: 'receipt',
  avatar: 'camera',
  cover: 'camera',
};

/**
 * Choose, preview, upload and replace one image.
 *
 * ONE COMPONENT, ONE PIPELINE. Receipts, the group photo and the group cover all go
 * through `uploadImage`, the existing unsigned direct-to-Cloudinary upload. There is no
 * second upload path to keep in step, and no secret anywhere on the phone.
 *
 * THE LOCAL IMAGE SHOWS IMMEDIATELY. While an upload is in flight the preview is the file
 * the person just picked, dimmed under a progress bar — so they see their choice at once
 * instead of an empty box for however long a mobile connection takes. On failure the
 * picked file is KEPT, and Retry re-sends it: making someone find the same photo again
 * because the network blinked is the worst part of most upload flows.
 *
 * NOTHING HERE BLOCKS WITH A SYSTEM ALERT. A denied permission is explained inline, where
 * the person was looking, rather than in a dialog that has to be dismissed first.
 */
export function SMImagePicker({
  variant,
  label,
  url,
  onChange,
  removable = true,
  helperText,
  disabled = false,
  folder,
}: SMImagePickerProps) {
  const { colors, dark } = useTheme();

  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [sourceSheet, setSourceSheet] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);

  const controller = useRef<AbortController | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  // A new saved URL is a new image; forget that the previous one failed to load.
  useEffect(() => setBroken(false), [url]);

  // Never leave an upload running for a screen that has gone.
  useEffect(() => () => controller.current?.abort(), []);

  const configured = runtime.cloudinary.isConfigured;
  const busy = phase.kind === 'uploading';

  const send = async (image: PickedImage): Promise<void> => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;

    setNotice(null);
    progressAnim.setValue(0);
    setPhase({ kind: 'uploading', progress: 0, local: image.uri });

    try {
      const result = await uploadImage(image, {
        signal: current.signal,
        ...(folder ? { folder } : {}),
        onProgress: (fraction) => {
          Animated.timing(progressAnim, {
            toValue: fraction,
            duration: motion.duration.fast,
            useNativeDriver: false,
          }).start();
        },
      });
      await onChange(result);
      setPhase({ kind: 'idle' });
    } catch (caught: unknown) {
      if (current.signal.aborted) return;
      setPhase({
        kind: 'failed',
        // `uploadImage` already turns Cloudinary's wording into something a person can
        // act on; anything else gets the generic line rather than a raw error.
        message:
          caught instanceof UploadError
            ? caught.message
            : 'The image could not be saved. Please try again.',
        image,
      });
    }
  };

  const pick = async (source: 'camera' | 'library'): Promise<void> => {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setNotice(
        source === 'camera'
          ? 'Camera access is off for SplitMoney. You can turn it on in your phone’s Settings.'
          : 'Photo access is off for SplitMoney. You can turn it on in your phone’s Settings.',
      );
      return;
    }

    const crop = CROP[variant];
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: variant === 'receipt' ? 0.8 : 0.75,
      allowsEditing: crop !== null,
      ...(crop ? { aspect: crop } : {}),
    };

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    await send({ uri: asset.uri, mimeType: asset.mimeType ?? null, fileName: asset.fileName ?? null });
  };

  const remove = async (): Promise<void> => {
    setNotice(null);
    setPhase({ kind: 'idle' });
    try {
      await onChange(null);
    } catch {
      setNotice('The image could not be removed. Please try again.');
    }
  };

  /* ---- What to show in the frame ---- */

  const shown = phase.kind === 'uploading' ? phase.local : url && !broken ? url : null;
  const empty = shown === null;

  const frameShape =
    variant === 'avatar'
      ? styles.avatarFrame
      : variant === 'cover'
        ? styles.coverFrame
        : styles.receiptFrame;

  const actionLabel = empty ? 'Add ' + lowerFirst(label) : 'Change ' + lowerFirst(label);

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>

      <View style={variant === 'avatar' ? styles.avatarRow : null}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            busy
              ? label + ', uploading'
              : empty
                ? actionLabel
                : label + ' is set. ' + actionLabel + '.'
          }
          accessibilityState={{ disabled: disabled || !configured || busy, busy }}
          disabled={disabled || !configured || busy}
          onPress={() => setSourceSheet(true)}
          style={({ pressed }) => [
            frameShape,
            styles.frame,
            {
              borderColor: phase.kind === 'failed' ? colors.destructive : dark ? colors.borderStrong : colors.border,
              backgroundColor: dark ? colors.surface : colors.subtle,
              borderStyle: empty ? 'dashed' : 'solid',
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          {shown ? (
            <Image
              source={{ uri: shown }}
              style={[StyleSheet.absoluteFill, busy ? styles.dimmed : null]}
              resizeMode={variant === 'receipt' ? 'contain' : 'cover'}
              onError={() => {
                if (phase.kind !== 'uploading') setBroken(true);
              }}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={styles.placeholder}>
              <View
                style={[
                  styles.placeholderIcon,
                  { backgroundColor: colors.primarySubtle ?? colors.subtle },
                ]}
              >
                <Icon name={ICON[variant]} size={variant === 'avatar' ? 20 : 18} tone="primary" />
              </View>
              {variant !== 'avatar' ? (
                <Text style={[styles.placeholderText, { color: colors.muted }]}>
                  {configured ? actionLabel : 'Uploads unavailable'}
                </Text>
              ) : null}
            </View>
          )}

          {busy ? (
            <View style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: colors.primary,
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
          ) : null}

          {/* A small badge says "this is editable" without covering the image. */}
          {!empty && !busy && !disabled ? (
            <View style={[styles.editBadge, { backgroundColor: colors.primary }]}>
              <Icon name="camera" size={12} color={colors.onPrimary ?? '#FFFFFF'} />
            </View>
          ) : null}
        </Pressable>

        {variant === 'avatar' ? (
          <View style={styles.avatarCopy}>
            <Text style={[styles.avatarHint, { color: colors.muted }]}>
              {helperText ?? 'A square photo works best.'}
            </Text>
          </View>
        ) : null}
      </View>

      {/* ---- Status line: progress, failure with retry, or a notice ---- */}

      {busy ? (
        <Text style={[styles.status, { color: colors.muted }]} accessibilityLiveRegion="polite">
          Uploading…
        </Text>
      ) : phase.kind === 'failed' ? (
        <View style={styles.statusRow}>
          <Icon name="alertCircle" size={14} tone="destructive" />
          <Text
            style={[styles.status, styles.statusFlex, { color: colors.destructive }]}
            accessibilityLiveRegion="polite"
          >
            {phase.message}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry upload"
            onPress={() => void send(phase.image)}
            hitSlop={10}
          >
            <Text style={[styles.statusAction, { color: colors.primary }]}>Retry</Text>
          </Pressable>
        </View>
      ) : notice ? (
        <Text style={[styles.status, { color: colors.muted }]} accessibilityLiveRegion="polite">
          {notice}
        </Text>
      ) : helperText && variant !== 'avatar' ? (
        <Text style={[styles.status, { color: colors.muted }]}>{helperText}</Text>
      ) : null}

      <SMActionSheet
        visible={sourceSheet}
        onClose={() => setSourceSheet(false)}
        title={empty ? actionLabel : label}
        actions={[
          {
            id: 'library',
            label: 'Choose from photos',
            icon: 'image',
            onPress: () => void pick('library'),
          },
          {
            id: 'camera',
            label: 'Take a photo',
            icon: 'camera',
            onPress: () => void pick('camera'),
          },
          ...(!empty && removable
            ? [
                {
                  id: 'remove',
                  label: 'Remove ' + lowerFirst(label),
                  icon: 'trash' as const,
                  destructive: true,
                  onPress: () => void remove(),
                },
              ]
            : []),
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  label: { fontSize: typography.bodySm, fontWeight: '600' },
  frame: {
    borderWidth: 1.5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptFrame: { height: 132, borderRadius: radius.lg },
  coverFrame: { aspectRatio: 16 / 7, borderRadius: radius.lg },
  avatarFrame: { width: 84, height: 84, borderRadius: radius.xl },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.base },
  avatarCopy: { flex: 1 },
  avatarHint: { fontSize: typography.caption, lineHeight: 18 },
  dimmed: { opacity: 0.45 },
  placeholder: { alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  placeholderIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { fontSize: typography.caption, fontWeight: '600' },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  progressFill: { height: 4 },
  editBadge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: { fontSize: typography.caption, lineHeight: 18 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  statusFlex: { flex: 1 },
  statusAction: { fontSize: typography.caption, fontWeight: '700' },
});
