import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { userDashboardPreferences } from '../db/schema.js';

/**
 * Dashboard layout preferences.
 *
 * The registry below -- not the database -- is the list of widgets that exist. A stored
 * preference only says what order this user likes them in and which they have hidden.
 * Keeping those two things apart is what makes the feature survive its own future: a
 * widget added next release appears for everybody, and a widget removed stops appearing
 * for everybody, without a migration touching anyone's saved layout.
 */

export type WidgetId =
  | 'balance'
  | 'quickActions'
  | 'insights'
  | 'balanceList'
  | 'periodStrip'
  | 'comparison'
  | 'recentExpenses'
  | 'relationships'
  | 'analytics';

export type WidgetDefinition = {
  id: WidgetId;
  label: string;
  description: string;
  /** Shown in summary mode. The rest appear only in detailed mode. */
  inSummary: boolean;
  /** Cannot be hidden: without it the dashboard answers no question at all. */
  required?: boolean;
};

export const WIDGETS: WidgetDefinition[] = [
  {
    id: 'balance',
    label: 'Balance',
    description: 'What you owe and are owed overall',
    inSummary: true,
    required: true,
  },
  {
    id: 'quickActions',
    label: 'Quick actions',
    description: 'Add an expense, settle up, jump to members',
    inSummary: true,
  },
  {
    id: 'insights',
    label: 'Insights',
    description: 'Notable changes worth knowing about',
    inSummary: true,
  },
  {
    id: 'balanceList',
    label: 'Balances by person',
    description: 'Who owes whom, and by how much',
    inSummary: true,
  },
  {
    id: 'periodStrip',
    label: 'Spending totals',
    description: 'Group spending, what you paid, your share',
    inSummary: true,
  },
  {
    id: 'comparison',
    label: 'Period comparison',
    description: 'This period against the one before it',
    inSummary: false,
  },
  {
    id: 'recentExpenses',
    label: 'Recent expenses',
    description: 'The latest expenses in this group',
    inSummary: false,
  },
  {
    id: 'relationships',
    label: 'Person-wise breakdown',
    description: 'Who paid for whom over the period',
    inSummary: false,
  },
  {
    id: 'analytics',
    label: 'Spending chart',
    description: 'Spending over time and by category',
    inSummary: false,
  },
];

const WIDGET_IDS = new Set<string>(WIDGETS.map((widget) => widget.id));

export type DashboardPreferences = {
  mode: 'summary' | 'detailed';
  view: 'group' | 'personal';
  widgets: { id: WidgetId; visible: boolean }[];
};

const DEFAULTS: DashboardPreferences = {
  mode: 'detailed',
  view: 'group',
  widgets: WIDGETS.map((widget) => ({ id: widget.id, visible: true })),
};

/**
 * Reconciles a stored layout with the widgets that currently exist.
 *
 * Stored ids that no longer exist are dropped; widgets the user has never seen are
 * appended in registry order and visible by default. A required widget is forced back
 * to visible even if an older layout hid it, because a dashboard with no balance on it
 * is not a customisation, it is a blank page.
 */
export const mergeWithRegistry = (
  stored: { id: string; visible: boolean }[],
): { id: WidgetId; visible: boolean }[] => {
  const known = stored.filter((entry) => WIDGET_IDS.has(entry.id));
  const seen = new Set(known.map((entry) => entry.id));

  const merged = known.map((entry) => ({
    id: entry.id as WidgetId,
    visible:
      WIDGETS.find((widget) => widget.id === entry.id)?.required === true
        ? true
        : entry.visible,
  }));

  for (const widget of WIDGETS) {
    if (!seen.has(widget.id)) merged.push({ id: widget.id, visible: true });
  }

  return merged;
};

/** This user's layout, or the default when they have never changed it. */
export const getPreferences = async (userId: string): Promise<DashboardPreferences> => {
  const rows = await db
    .select()
    .from(userDashboardPreferences)
    .where(eq(userDashboardPreferences.userId, userId))
    .limit(1);

  const row = rows[0];
  if (!row) return DEFAULTS;

  return {
    mode: row.mode,
    view: row.view,
    widgets: mergeWithRegistry(row.widgets),
  };
};

/**
 * Saves a layout.
 *
 * Upserted on the primary key so two tabs saving at once cannot produce a duplicate row
 * or a lost insert -- the later write simply wins, which is the right outcome for a
 * preference.
 */
export const savePreferences = async (
  userId: string,
  // Widget ids arrive loosely typed on purpose: a client on an older or newer build may
  // send ids this release does not know, and `mergeWithRegistry` drops them rather than
  // failing the whole save.
  input: {
    mode: DashboardPreferences['mode'];
    view: DashboardPreferences['view'];
    widgets: { id: string; visible: boolean }[];
  },
): Promise<DashboardPreferences> => {
  const widgets = mergeWithRegistry(input.widgets);

  await db
    .insert(userDashboardPreferences)
    .values({ userId, mode: input.mode, view: input.view, widgets })
    .onConflictDoUpdate({
      target: userDashboardPreferences.userId,
      set: { mode: input.mode, view: input.view, widgets, updatedAt: new Date() },
    });

  return { mode: input.mode, view: input.view, widgets };
};

/** Returns the layout to its defaults by removing the stored row. */
export const resetPreferences = async (userId: string): Promise<DashboardPreferences> => {
  await db
    .delete(userDashboardPreferences)
    .where(eq(userDashboardPreferences.userId, userId));

  return DEFAULTS;
};

export { DEFAULTS as DEFAULT_PREFERENCES };
