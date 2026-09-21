import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { PrimaryButton } from './PrimaryButton';
import { Sheet } from './Sheet';
import { uploadImage, UploadError, type PickedImage } from '@/lib/upload';
import { runtime } from '@/constants/environment';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, shadows, spacing, typography } from '@/theme/tokens';

export function ReceiptField({
  label = 'Receipt',
  url,
  onChange,
  folder,
}: {
  label?: string;
  url: string | null;
  onChange: (url: string | null) => void;
  folder?: string;
}) {
  const { colors, dark } = useTheme();

  const [sheet, setSheet] = useState(false);
  const [pending, setPending] = useState<PickedImage | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  const configured = runtime.cloudinary.isConfigured;

  const send = async (image: PickedImage): Promise<void> => {
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      const result = await uploadImage(image, {
        ...(folder ? { folder } : {}),
        onProgress: setProgress,
      });
      onChange(result.url);
      setPending(null);
    } catch (caught: unknown) {
      setError(caught instanceof UploadError ? caught.message : 'The upload failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const pick = async (source: 'camera' | 'library'): Promise<void> => {
    setSheet(false);

    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        source === 'camera' ? 'Camera access needed' : 'Photo access needed',
        'You can turn this on in Settings if you change your mind.',
      );
      return;
    }

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: false,
    };

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const image: PickedImage = {
      uri: asset.uri,
      mimeType: asset.mimeType ?? null,
      fileName: asset.fileName ?? null,
    };
    setPending(image);
    await send(image);
  };

  return (
    <View style={styles.field}>
      <Text
        style={{
          color: colors.muted,
          fontSize: typography.xs,
          fontWeight: '700',
          letterSpacing: 0.8,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>

      {url ? (
        <View
          style={[
            styles.card,
            { borderColor: colors.border, backgroundColor: colors.surface },
            !dark ? shadows.sm : null,
          ]}
        >
          <Pressable
            accessibilityRole="imagebutton"
            accessibilityLabel={'View ' + label.toLowerCase()}
            onPress={() => setPreview(true)}
          >
            <Image source={{ uri: url }} style={styles.thumb} accessibilityIgnoresInvertColors />
          </Pressable>
          <View style={styles.cardBody}>
            <Text style={{ color: colors.text, fontSize: typography.bodySm, fontWeight: '700' }}>
              Attached
            </Text>
            <Text style={{ color: colors.muted, fontSize: typography.caption }}>Tap image to expand</Text>
          </View>
          <View style={styles.cardActions}>
            <PrimaryButton
              label="Replace"
              variant="secondary"
              onPress={() => setSheet(true)}
              style={styles.small}
            />
            <PrimaryButton
              label="Remove"
              variant="danger"
              onPress={() => {
                onChange(null);
                setPending(null);
                setError(null);
              }}
              style={styles.small}
            />
          </View>
        </View>
      ) : (
        <PrimaryButton
          label={busy ? 'Uploading ' + Math.round(progress * 100) + '%' : 'Attach ' + label.toLowerCase()}
          icon="receipt"
          variant="secondary"
          loading={busy}
          disabled={!configured}
          onPress={() => setSheet(true)}
        />
      )}

      {!configured ? (
        <Text style={{ color: colors.warning, fontSize: typography.caption }}>
          Image uploads are not configured in this build.
        </Text>
      ) : null}

      {error ? (
        <View style={[styles.error, { backgroundColor: colors.subtle, borderColor: colors.border }]}>
          <Text
            accessibilityLiveRegion="polite"
            style={{ color: colors.destructive, fontSize: typography.caption }}
          >
            {error}
          </Text>
          {pending ? (
            <PrimaryButton
              label="Retry upload"
              icon="refresh"
              variant="secondary"
              loading={busy}
              onPress={() => void send(pending)}
              style={styles.small}
            />
          ) : null}
        </View>
      ) : null}

      <Sheet visible={sheet} onClose={() => setSheet(false)} title={'Add ' + label.toLowerCase()}>
        <View style={{ gap: spacing.sm, paddingVertical: spacing.xs }}>
          <PrimaryButton label="Take a photo" icon="camera" onPress={() => void pick('camera')} />
          <PrimaryButton
            label="Choose from library"
            icon="receipt"
            variant="secondary"
            onPress={() => void pick('library')}
          />
        </View>
      </Sheet>

      <Sheet visible={preview} onClose={() => setPreview(false)} title={label}>
        {url ? (
          <Image
            source={{ uri: url }}
            style={styles.full}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
            accessibilityLabel={label}
          />
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs + 2 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  thumb: { width: 56, height: 56, borderRadius: radius.sm },
  cardBody: { flex: 1, gap: 2 },
  cardActions: { gap: spacing.xs },
  small: { minHeight: 34, paddingVertical: spacing.xxs, paddingHorizontal: spacing.sm + 2 },
  error: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, gap: spacing.sm },
  full: { width: '100%', height: 420, borderRadius: radius.md },
});
