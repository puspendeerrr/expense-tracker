import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/api';

/**
 * Dashboard layout preferences.
 *
 * Saves optimistically: rearranging a dashboard is a direct-manipulation gesture, and
 * waiting for a round trip before the card moves makes the whole thing feel broken. The
 * local state leads, the request follows, and a failure rolls back to what the server
 * last confirmed rather than leaving the screen showing a layout that was not stored.
 *
 * The widget registry comes from the server with the preferences, so labels and the
 * list of what exists have exactly one definition.
 */

export type WidgetId = string;

export interface WidgetDefinition {
  id: WidgetId;
  label: string;
  description: string;
  inSummary: boolean;
  required?: boolean;
}

export interface DashboardPreferences {
  mode: 'summary' | 'detailed';
  view: 'group' | 'personal';
  widgets: { id: WidgetId; visible: boolean }[];
}

interface Payload {
  preferences: DashboardPreferences;
  registry: WidgetDefinition[];
}

export const useDashboardPreferences = () => {
  const [preferences, setPreferences] = useState<DashboardPreferences | null>(null);
  const [registry, setRegistry] = useState<WidgetDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** The last layout the server confirmed, for rolling back a failed save. */
  const confirmed = useRef<DashboardPreferences | null>(null);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    void apiRequest<Payload>('/api/dashboard/preferences', { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setPreferences(data.preferences);
        setRegistry(data.registry);
        confirmed.current = data.preferences;
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Could not load your layout.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, []);

  /**
   * Applies a change locally, then persists it.
   *
   * Debounced, because dragging a card emits a change per position it passes through and
   * each one is a whole layout; the last one is the only one worth storing.
   */
  const update = useCallback((next: DashboardPreferences) => {
    setPreferences(next);
    setError(null);

    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);

    saveTimer.current = window.setTimeout(() => {
      void apiRequest<Payload>('/api/dashboard/preferences', {
        method: 'PUT',
        body: JSON.stringify(next),
      })
        .then((data) => {
          // The server reconciles against its own registry, so its answer -- not what we
          // sent -- is the layout that now exists.
          setPreferences(data.preferences);
          setRegistry(data.registry);
          confirmed.current = data.preferences;
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'Could not save your layout.');
          if (confirmed.current) setPreferences(confirmed.current);
        });
    }, 400);
  }, []);

  const reset = useCallback(async () => {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    const data = await apiRequest<Payload>('/api/dashboard/preferences', {
      method: 'DELETE',
    });
    setPreferences(data.preferences);
    setRegistry(data.registry);
    confirmed.current = data.preferences;
  }, []);

  useEffect(
    () => () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    },
    [],
  );

  /* ---- Operations the customiser uses ---- */

  const move = useCallback(
    (id: WidgetId, direction: -1 | 1) => {
      if (!preferences) return;
      const widgets = [...preferences.widgets];
      const index = widgets.findIndex((widget) => widget.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= widgets.length) return;

      [widgets[index], widgets[target]] = [widgets[target]!, widgets[index]!];
      update({ ...preferences, widgets });
    },
    [preferences, update],
  );

  const moveTo = useCallback(
    (id: WidgetId, toIndex: number) => {
      if (!preferences) return;
      const widgets = [...preferences.widgets];
      const from = widgets.findIndex((widget) => widget.id === id);
      if (from < 0 || toIndex < 0 || toIndex >= widgets.length || from === toIndex) return;

      const [moved] = widgets.splice(from, 1);
      widgets.splice(toIndex, 0, moved!);
      update({ ...preferences, widgets });
    },
    [preferences, update],
  );

  const toggle = useCallback(
    (id: WidgetId) => {
      if (!preferences) return;
      const definition = registry.find((widget) => widget.id === id);
      if (definition?.required) return;

      update({
        ...preferences,
        widgets: preferences.widgets.map((widget) =>
          widget.id === id ? { ...widget, visible: !widget.visible } : widget,
        ),
      });
    },
    [preferences, registry, update],
  );

  const setMode = useCallback(
    (mode: DashboardPreferences['mode']) => {
      if (preferences) update({ ...preferences, mode });
    },
    [preferences, update],
  );

  const setView = useCallback(
    (view: DashboardPreferences['view']) => {
      if (preferences) update({ ...preferences, view });
    },
    [preferences, update],
  );

  return {
    preferences,
    registry,
    isLoading,
    error,
    move,
    moveTo,
    toggle,
    setMode,
    setView,
    reset,
  };
};

/**
 * Which widgets to render, in order.
 *
 * Summary mode is a filter over the same layout rather than a second stored layout, so
 * switching back and forth cannot lose someone's arrangement.
 */
export const visibleWidgets = (
  preferences: DashboardPreferences | null,
  registry: WidgetDefinition[],
): WidgetId[] => {
  if (!preferences) return [];

  return preferences.widgets
    .filter((widget) => {
      if (!widget.visible) return false;
      if (preferences.mode === 'detailed') return true;
      return registry.find((entry) => entry.id === widget.id)?.inSummary ?? false;
    })
    .map((widget) => widget.id);
};
