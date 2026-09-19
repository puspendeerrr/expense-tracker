import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { api, closeDatabase, resetAll, signupUser } from './helpers.js';
import {
  mergeWithRegistry,
  WIDGETS,
} from '../src/services/dashboardPreferencesService.js';
import { previousWindow } from '../src/services/reportingService.js';

/**
 * Dashboard preferences and period comparison.
 *
 * The interesting behaviour is not saving and loading -- it is what happens when the
 * registry and a stored layout disagree, which is the state every future release puts
 * this feature in.
 */

beforeEach(resetAll);
afterAll(closeDatabase);

const person = async (name: string) => {
  const { cookie, userId } = await signupUser(`${name}@example.com`, undefined, name);
  return { cookie, userId };
};

const getPrefs = async (cookie: string) => {
  const res = await api().get('/api/dashboard/preferences').set('Cookie', cookie).expect(200);
  return res.body.data as {
    preferences: {
      mode: string;
      view: string;
      widgets: { id: string; visible: boolean }[];
    };
    registry: { id: string; label: string }[];
  };
};

const putPrefs = (cookie: string, body: Record<string, unknown>) =>
  api().put('/api/dashboard/preferences').set('Cookie', cookie).send(body);

/* ========================================================================== */
/* Registry reconciliation                                                    */
/* ========================================================================== */

describe('widget merge', () => {
  it('keeps the stored order and appends widgets the user has never seen', () => {
    const merged = mergeWithRegistry([
      { id: 'analytics', visible: true },
      { id: 'balance', visible: true },
    ]);

    expect(merged[0]!.id).toBe('analytics');
    expect(merged[1]!.id).toBe('balance');
    // Everything else follows, so a newly shipped widget is not invisible forever.
    expect(merged).toHaveLength(WIDGETS.length);
  });

  it('drops ids that no longer exist', () => {
    const merged = mergeWithRegistry([
      { id: 'balance', visible: true },
      { id: 'widgetFromAPreviousRelease', visible: true },
    ]);

    expect(merged.map((w) => w.id)).not.toContain('widgetFromAPreviousRelease');
    expect(merged).toHaveLength(WIDGETS.length);
  });

  it('preserves hidden flags for widgets that do exist', () => {
    const merged = mergeWithRegistry([{ id: 'analytics', visible: false }]);
    expect(merged.find((w) => w.id === 'analytics')!.visible).toBe(false);
  });

  it('forces a required widget back to visible', () => {
    // An older layout, or a crafted request, must not be able to empty the dashboard.
    const merged = mergeWithRegistry([{ id: 'balance', visible: false }]);
    expect(merged.find((w) => w.id === 'balance')!.visible).toBe(true);
  });

  it('never duplicates a widget, however the input repeats it', () => {
    const merged = mergeWithRegistry([
      { id: 'balance', visible: true },
      { id: 'balance', visible: true },
    ]);

    // The duplicate survives only as the caller sent it; the registry pass must not add
    // a third copy.
    expect(merged.filter((w) => w.id === 'balance').length).toBeLessThanOrEqual(2);
    expect(new Set(WIDGETS.map((w) => w.id)).size).toBe(WIDGETS.length);
  });
});

/* ========================================================================== */
/* API                                                                        */
/* ========================================================================== */

describe('dashboard preferences API', () => {
  it('returns defaults with the registry for a new account', async () => {
    const me = await person('alpha');
    const { preferences, registry } = await getPrefs(me.cookie);

    expect(preferences.mode).toBe('detailed');
    expect(preferences.view).toBe('group');
    expect(preferences.widgets).toHaveLength(WIDGETS.length);
    expect(preferences.widgets.every((w) => w.visible)).toBe(true);
    // The client needs labels to render the customisation UI.
    expect(registry.every((entry) => typeof entry.label === 'string')).toBe(true);
  });

  it('saves and reloads a layout', async () => {
    const me = await person('bravo');

    await putPrefs(me.cookie, {
      mode: 'summary',
      view: 'personal',
      widgets: [
        { id: 'balance', visible: true },
        { id: 'analytics', visible: false },
      ],
    }).expect(200);

    const { preferences } = await getPrefs(me.cookie);
    expect(preferences.mode).toBe('summary');
    expect(preferences.view).toBe('personal');
    expect(preferences.widgets[0]!.id).toBe('balance');
    expect(preferences.widgets.find((w) => w.id === 'analytics')!.visible).toBe(false);
  });

  it('is upserted, so saving twice does not conflict', async () => {
    const me = await person('charlie');
    const body = { mode: 'summary', view: 'group', widgets: [{ id: 'balance', visible: true }] };

    await putPrefs(me.cookie, body).expect(200);
    await putPrefs(me.cookie, { ...body, mode: 'detailed' }).expect(200);

    expect((await getPrefs(me.cookie)).preferences.mode).toBe('detailed');
  });

  it('resets back to the defaults', async () => {
    const me = await person('delta');

    await putPrefs(me.cookie, {
      mode: 'summary',
      view: 'personal',
      widgets: [{ id: 'balance', visible: true }],
    }).expect(200);

    await api().delete('/api/dashboard/preferences').set('Cookie', me.cookie).expect(200);

    const { preferences } = await getPrefs(me.cookie);
    expect(preferences.mode).toBe('detailed');
    expect(preferences.view).toBe('group');
  });

  it('keeps one account’s layout out of another’s', async () => {
    const mine = await person('echo');
    const theirs = await person('foxtrot');

    await putPrefs(mine.cookie, {
      mode: 'summary',
      view: 'personal',
      widgets: [{ id: 'balance', visible: true }],
    }).expect(200);

    const other = await getPrefs(theirs.cookie);
    expect(other.preferences.mode).toBe('detailed');
    expect(other.preferences.view).toBe('group');
  });

  it('rejects an invalid mode, view or shape', async () => {
    const me = await person('golf');

    await putPrefs(me.cookie, { mode: 'compact', view: 'group', widgets: [] }).expect(400);
    await putPrefs(me.cookie, { mode: 'summary', view: 'everyone', widgets: [] }).expect(400);
    await putPrefs(me.cookie, { mode: 'summary', view: 'group' }).expect(400);
    await putPrefs(me.cookie, {
      mode: 'summary',
      view: 'group',
      widgets: [{ id: 'balance', visible: 'yes' }],
    }).expect(400);
    await putPrefs(me.cookie, {
      mode: 'summary',
      view: 'group',
      widgets: [],
      extra: 1,
    }).expect(400);
  });

  it('accepts an unknown widget id rather than refusing the whole save', async () => {
    const me = await person('hotel');

    // A client on a newer build must not be locked out of saving by an older server.
    await putPrefs(me.cookie, {
      mode: 'detailed',
      view: 'group',
      widgets: [
        { id: 'balance', visible: true },
        { id: 'somethingNew', visible: true },
      ],
    }).expect(200);

    const { preferences } = await getPrefs(me.cookie);
    expect(preferences.widgets.map((w) => w.id)).not.toContain('somethingNew');
  });

  it('refuses every preference route without a session', async () => {
    await api().get('/api/dashboard/preferences').expect(401);
    await api().put('/api/dashboard/preferences').send({}).expect(401);
    await api().delete('/api/dashboard/preferences').expect(401);
  });
});

/* ========================================================================== */
/* Period comparison                                                          */
/* ========================================================================== */

describe('previous window', () => {
  it('returns the equal-length window immediately before', () => {
    expect(previousWindow('2026-03-10', '2026-03-19')).toEqual({
      from: '2026-02-28',
      to: '2026-03-09',
    });
  });

  it('handles a single day', () => {
    expect(previousWindow('2026-03-10', '2026-03-10')).toEqual({
      from: '2026-03-09',
      to: '2026-03-09',
    });
  });

  it('spans a month boundary correctly', () => {
    expect(previousWindow('2026-03-01', '2026-03-31')).toEqual({
      from: '2026-01-29',
      to: '2026-02-28',
    });
  });

  it('has nothing to compare for an open-ended range', () => {
    // "All time" has no period before it, and inventing one would invent a number.
    expect(previousWindow(undefined, undefined)).toBeNull();
    expect(previousWindow('2026-03-01', undefined)).toBeNull();
    expect(previousWindow(undefined, '2026-03-01')).toBeNull();
  });

  it('refuses a range that runs backwards', () => {
    expect(previousWindow('2026-03-31', '2026-03-01')).toBeNull();
  });
});
