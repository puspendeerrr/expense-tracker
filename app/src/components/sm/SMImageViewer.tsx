import React, { useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../Icon';
import { spacing, typography } from '@/theme/tokens';

export type SMImageViewerProps = {
  visible: boolean;
  uri: string | null;
  title: string;
  onClose: () => void;
};

/**
 * One image, full screen, on black.
 *
 * Always dark regardless of theme: a payment screenshot is itself usually a bright UI,
 * and reading its small print against a white frame is harder than against black.
 *
 * ZOOM WHERE THE PLATFORM PROVIDES IT. The image sits in a ScrollView with a zoom range,
 * which gives pinch-to-zoom and pan on iOS. React Native's ScrollView does not zoom on
 * Android, and pinch there needs react-native-gesture-handler, which this app does not
 * include; on Android the image is shown fitted to the screen at full resolution.
 *
 * Closes with the button, the Android back button, or a tap outside the image. A failed
 * load says so rather than leaving a black screen.
 */
export function SMImageViewer({ visible, uri, title, onClose }: SMImageViewerProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onShow={() => setState('loading')}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.backdrop}>
        <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]}>
          <Text numberOfLines={1} style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            hitSlop={12}
            style={({ pressed }) => [styles.close, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Icon name="close" size={22} color="#FFFFFF" />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.center}
          maximumZoomScale={4}
          minimumZoomScale={1}
          centerContent
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={onClose} accessible={false} style={StyleSheet.absoluteFill} />
          {uri ? (
            <Image
              source={{ uri }}
              style={{ width, height: height - insets.top - insets.bottom - 120 }}
              resizeMode="contain"
              onLoad={() => setState('ready')}
              onError={() => setState('failed')}
              accessibilityLabel={title}
              accessibilityIgnoresInvertColors
            />
          ) : null}

          {state === 'loading' && uri ? (
            <View style={styles.overlay} pointerEvents="none">
              <ActivityIndicator color="#FFFFFF" />
            </View>
          ) : null}

          {state === 'failed' || !uri ? (
            <View style={styles.overlay}>
              <Icon name="alertCircle" size={28} color="#FFFFFF" />
              <Text style={styles.failed}>This image could not be loaded.</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={{ height: insets.bottom + spacing.base }} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000' },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  title: { flex: 1, color: '#FFFFFF', fontSize: typography.body, fontWeight: '700' },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  scroll: { flex: 1 },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  failed: { color: '#FFFFFF', fontSize: typography.bodySm },
});
