import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { useNotifications } from '@/notifications/NotificationProvider';
import { useSocket } from '@/realtime/SocketProvider';
import { AdBanner, AD_PLACEMENTS } from '@/features/ads';
import { useRequest } from '@/hooks/useRequest';
import { groups as groupsApi } from '@/api/endpoints';
import type { Group } from '@/api/types';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, shadows, spacing, typography } from '@/theme/tokens';
import { Icon } from '@/components/Icon';
import {
  SMNavbar,
  SMMobileDrawer,
  SMSearchInput,
  SMFilterTabs,
  SMGroupCard,
  SMGroupSkeletonList,
  SMEmptyState,
  SMErrorState,
  SMButton,
  type DrawerRoute,
  type GroupFilterType,
  type FilterOption,
} from '@/components/sm';

export default function HomeScreen() {
  const { colors, dark } = useTheme();
  const { user, signOut, can } = useAuth();
  const { unreadCount } = useNotifications();
  const { addListener } = useSocket();
  const router = useRouter();

  // Navigation drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<GroupFilterType>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'name'>('recent');

  // Groups data request
  const request = useRequest<{ groups: Group[] }>(
    useCallback((signal: AbortSignal) => groupsApi.list(signal), []),
    [],
  );

  const list = request.data?.groups ?? [];
  const firstName = user?.fullName?.trim().split(/\s+/)[0] ?? 'there';

  /*
   * Re-read the list whenever Home comes back into view. Realtime only reaches groups this
   * phone is subscribed to, so a group just deleted or left (no longer subscribed) or just
   * created (not yet subscribed) would otherwise linger or be missing until a restart. The
   * first focus is skipped because mounting already fetched.
   */
  const focusedOnce = useRef(false);
  const refreshList = useRef(request.refresh);
  refreshList.current = request.refresh;
  useFocusEffect(
    useCallback(() => {
      if (focusedOnce.current) void refreshList.current();
      focusedOnce.current = true;
    }, []),
  );

  // Realtime synchronization: invalidate and refetch on group events
  useEffect(() => {
    return addListener((msg) => {
      if (
        msg.event === 'group:updated' ||
        msg.event === 'group:member_joined' ||
        msg.event === 'group:member_left' ||
        msg.event === 'group:member_removed' ||
        msg.event === 'group:invite_regenerated'
      ) {
        void request.refresh();
      }
    });
  }, [addListener, request]);

  // Handle drawer destination selection
  const handleDrawerNavigate = (destination: DrawerRoute) => {
    switch (destination) {
      case 'groups':
        // Already on groups
        break;
      case 'notifications':
        router.push('/notifications');
        break;
      case 'ai':
        router.push('/ai');
        break;
      case 'profile':
        router.push('/profile');
        break;
      case 'settings':
        router.push('/settings');
        break;
      case 'admin':
        router.push('/admin' as never);
        break;
    }
  };

  // Compute category counts
  const createdCount = useMemo(
    () => list.filter((g) => g.role === 'creator').length,
    [list],
  );
  const memberCount = useMemo(
    () => list.filter((g) => g.role === 'member').length,
    [list],
  );

  const filterOptions: FilterOption[] = useMemo(
    () => [
      { id: 'all', label: 'All', count: list.length },
      { id: 'created', label: 'Created by me', count: createdCount },
      { id: 'member', label: 'Member', count: memberCount },
    ],
    [list.length, createdCount, memberCount],
  );

  // Filtered & sorted group list
  const filteredList = useMemo(() => {
    let result = list;

    // 1. Filter by tab
    if (selectedFilter === 'created') {
      result = result.filter((g) => g.role === 'creator');
    } else if (selectedFilter === 'member') {
      result = result.filter((g) => g.role === 'member');
    }

    // 2. Filter by search query
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          (g.description && g.description.toLowerCase().includes(q)),
      );
    }

    // 3. Sort
    if (sortBy === 'name') {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    } else {
      result = [...result].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }

    return result;
  }, [list, selectedFilter, searchQuery, sortBy]);

  const toggleSort = () => {
    setSortBy((prev) => (prev === 'recent' ? 'name' : 'recent'));
  };

  // Content body
  const renderBody = () => {
    if (request.loading && request.data === undefined) {
      return (
        <View style={styles.loadingContainer}>
          <SMGroupSkeletonList count={4} />
        </View>
      );
    }

    if (request.error && request.data === undefined) {
      return (
        <SMErrorState
          error={request.error}
          onRetry={() => void request.refresh()}
        />
      );
    }

    if (list.length === 0) {
      return (
        <SMEmptyState
          icon="group"
          title="No groups yet"
          description="Create a group for an apartment, trip, or night out — or join an existing one with an invite code."
          primaryAction={{
            label: 'Create a group',
            icon: 'add',
            onPress: () => router.push('/new-group'),
          }}
          secondaryAction={{
            label: 'Join with code',
            icon: 'group',
            onPress: () =>
              router.push({ pathname: '/new-group', params: { mode: 'join' } }),
          }}
        />
      );
    }

    return (
      <FlatList
        data={filteredList}
        keyExtractor={(group) => group.id}
        renderItem={({ item }) => (
          <SMGroupCard
            group={item}
            onPress={() => router.push(('/group/' + item.id) as never)}
          />
        )}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            {/* Quick Hero Banner */}
            <View
              style={[
                styles.heroBanner,
                {
                  backgroundColor: dark ? colors.surfaceElevated : colors.surface,
                  borderColor: dark ? colors.borderStrong : colors.border,
                },
                !dark ? shadows.sm : null,
              ]}
            >
              <View style={styles.heroRow}>
                <View style={styles.heroInfo}>
                  <Text
                    style={[
                      styles.heroGreeting,
                      { color: colors.text },
                    ]}
                  >
                    Welcome back, {firstName} 👋
                  </Text>
                  <Text
                    style={[
                      styles.heroSubtext,
                      { color: colors.muted },
                    ]}
                  >
                    {list.length === 1
                      ? '1 active group'
                      : `${list.length} active groups`}
                  </Text>
                </View>
              </View>

              <View style={styles.actionRow}>
                <SMButton
                  label="New Group"
                  icon="add"
                  variant="primary"
                  size="md"
                  onPress={() => router.push('/new-group')}
                  style={{ flex: 1 }}
                />
                <SMButton
                  label="Join"
                  icon="group"
                  variant="secondary"
                  size="md"
                  onPress={() =>
                    router.push({
                      pathname: '/new-group',
                      params: { mode: 'join' },
                    })
                  }
                  style={{ flex: 1 }}
                />
              </View>
            </View>

            {/* Search Input Bar */}
            <View style={styles.searchSection}>
              <SMSearchInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search groups by name…"
              />
            </View>

            {/* Filter Tabs & Sort Row */}
            <View style={styles.controlsRow}>
              <View style={{ flex: 1 }}>
                <SMFilterTabs
                  selected={selectedFilter}
                  onSelect={setSelectedFilter}
                  options={filterOptions}
                />
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Sort by ${sortBy === 'recent' ? 'recent' : 'alphabetical'}`}
                onPress={toggleSort}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.sortBtn,
                  {
                    backgroundColor: dark ? colors.surfaceElevated : colors.surface,
                    borderColor: dark ? colors.borderStrong : colors.border,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Icon name="filter" size={14} tone="muted" />
                <Text style={[styles.sortText, { color: colors.muted }]}>
                  {sortBy === 'recent' ? 'Recent' : 'A-Z'}
                </Text>
              </Pressable>
            </View>

            {/* List count summary */}
            <View style={styles.sectionHeader}>
              <Text
                style={[
                  styles.sectionHeaderText,
                  { color: colors.muted },
                ]}
              >
                {searchQuery.trim()
                  ? `SEARCH RESULTS (${filteredList.length})`
                  : selectedFilter === 'all'
                    ? `ALL GROUPS (${filteredList.length})`
                    : selectedFilter === 'created'
                      ? `CREATED BY ME (${filteredList.length})`
                      : `MEMBER (${filteredList.length})`}
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          searchQuery.trim() ? (
            <SMEmptyState
              icon="search"
              title="No groups found"
              description={`No groups match "${searchQuery.trim()}". Try checking your spelling or clear the search.`}
              primaryAction={{
                label: 'Clear Search',
                icon: 'close',
                onPress: () => setSearchQuery(''),
              }}
            />
          ) : selectedFilter !== 'all' ? (
            <SMEmptyState
              icon="filter"
              title="No groups here"
              description={`You have no groups under the "${selectedFilter === 'created' ? 'Created by me' : 'Member'}" filter.`}
              primaryAction={{
                label: 'View All Groups',
                onPress: () => setSelectedFilter('all'),
              }}
            />
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={request.refreshing}
            onRefresh={() => void request.refresh()}
            colors={[colors.primary]}
            tintColor={colors.primary}
            progressBackgroundColor={dark ? colors.surfaceElevated : colors.surface}
          />
        }
      />
    );
  };

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      {/* Top Mobile Navbar */}
      <SMNavbar
        subtitle={list.length === 1 ? '1 group' : `${list.length} groups`}
        userName={user?.fullName ?? firstName}
        unreadNotifications={unreadCount}
        onOpenDrawer={() => setDrawerOpen(true)}
        onOpenNotifications={() => router.push('/notifications')}
        onOpenSearch={() => router.push('/search')}
        onOpenProfile={() => router.push('/profile')}
      />

      {/* Cached Data Notice */}
      {request.error && request.data !== undefined ? (
        <View style={[styles.staleNotice, { backgroundColor: dark ? colors.surfaceElevated : colors.subtle }]}>
          <Icon name="alert" size={14} tone="muted" />
          <Text style={[styles.staleText, { color: colors.muted }]}>
            Showing cached data. Pull down to refresh.
          </Text>
        </View>
      ) : null}

      {/* Main Content */}
      {renderBody()}

      {/* Ad Banner placement */}
      <AdBanner placement={AD_PLACEMENTS.home} />

      {/* Mobile Navigation Drawer */}
      <SMMobileDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        currentRoute="groups"
        userName={user?.fullName ?? firstName}
        userEmail={user?.email}
        isAdmin={user?.role === 'admin'}
        showAdminConsole={can('admin.access')}
        unreadCount={unreadCount}
        onNavigate={handleDrawerNavigate}
        onSignOut={() => void signOut()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  list: {
    padding: spacing.base,
    gap: spacing.sm,
    flexGrow: 1,
  },
  loadingContainer: {
    padding: spacing.base,
  },
  headerBlock: {
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  heroBanner: {
    padding: spacing.base,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  heroInfo: {
    flex: 1,
    gap: 3,
  },
  heroGreeting: {
    fontSize: typography.body,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  heroSubtext: {
    fontSize: typography.caption,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchSection: {
    width: '100%',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  sortText: {
    fontSize: typography.caption,
    fontWeight: '700',
  },
  sectionHeader: {
    paddingHorizontal: spacing.xxs,
    paddingTop: spacing.xs,
  },
  sectionHeaderText: {
    fontSize: typography.xs,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  staleNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
  },
  staleText: {
    fontSize: typography.caption,
    fontWeight: '500',
  },
});
