import 'expo-dev-client';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/auth/AuthProvider';
import { BootGate } from '@/components/BootGate';
import { SocketProvider } from '@/realtime/SocketProvider';
import { NotificationProvider } from '@/notifications/NotificationProvider';
import { AiChatProvider } from '@/ai/AiChatProvider';
import { AdProvider } from '@/features/ads';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

/**
 * Root layout.
 *
 * The stack stays mounted at all times; `BootGate` paints over it while the session is
 * being restored or the server cannot be reached. Route guards live in the two group
 * layouts, so the rule about where a signed-in person belongs is written once on each
 * side of the fence rather than repeated in every screen.
 */
function Navigation() {
  const { colors, dark, hydrated } = useTheme();
  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
      />
      <BootGate themeReady={hydrated} />
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        {/* Inside AuthProvider: it connects only once there is a session to connect with. */}
        <SocketProvider>
          {/*
            * Inside the router, because a notification tap navigates. Inside auth,
            * because it must not act until the session is known.
            */}
          <NotificationProvider>
            {/*
              * Above the router on purpose: the conversation must survive closing the
              * chat and navigating around the app, and die with the process.
              */}
            <AiChatProvider>
              {/*
                * Innermost, and non-blocking: it renders its children immediately and
                * resolves consent and SDK initialisation in the background. Nothing in
                * the app waits on an advertisement.
                */}
              <AdProvider>
                <Navigation />
              </AdProvider>
            </AiChatProvider>
          </NotificationProvider>
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
