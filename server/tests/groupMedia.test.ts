import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { api, closeDatabase, resetAll, signupUser } from './helpers.js';
import { joinGroupByInvite } from '../src/services/groupService.js';

/**
 * Group avatar and cover.
 *
 * The bytes never reach this server -- the browser uploads to Cloudinary directly -- so
 * everything worth testing here is about what the server accepts and who may send it.
 * An unchecked URL would let any member point every other member's dashboard at a host
 * of their choosing, so the host restriction is treated as a security control rather
 * than a formatting nicety.
 */

beforeEach(resetAll);
afterAll(closeDatabase);

const CDN = 'https://res.cloudinary.com/demo/image/upload/v1/splitmoney';
const AVATAR = { url: `${CDN}/avatar.jpg`, publicId: 'splitmoney/avatar' };
const COVER = { url: `${CDN}/cover.jpg`, publicId: 'splitmoney/cover' };

const member = async (name: string) => {
  const { cookie, userId } = await signupUser(`${name}@example.com`, undefined, name);
  return { cookie, userId };
};

const setup = async () => {
  const creator = await member('creator');
  const second = await member('second');

  const res = await api()
    .post('/api/groups')
    .set('Cookie', creator.cookie)
    .send({ name: 'Flat 402' })
    .expect(201);

  const group = res.body.data.group as { id: string; inviteCode: string };
  await joinGroupByInvite(group.inviteCode, second.userId);

  return { creator, second, groupId: group.id };
};

const setMedia = (cookie: string, groupId: string, body: Record<string, unknown>) =>
  api().patch(`/api/groups/${groupId}/media`).set('Cookie', cookie).send(body);

const readGroup = async (cookie: string, groupId: string) => {
  const res = await api().get(`/api/groups/${groupId}`).set('Cookie', cookie).expect(200);
  return res.body.data.group as { avatarUrl: string | null; coverUrl: string | null };
};

/* ========================================================================== */
/* Happy path                                                                 */
/* ========================================================================== */

describe('group media', () => {
  it('sets an avatar and a cover, and shows them to every member', async () => {
    const { creator, second, groupId } = await setup();

    await setMedia(creator.cookie, groupId, { avatar: AVATAR, cover: COVER }).expect(200);

    const asCreator = await readGroup(creator.cookie, groupId);
    expect(asCreator.avatarUrl).toBe(AVATAR.url);
    expect(asCreator.coverUrl).toBe(COVER.url);

    // A member who did not set it still sees it.
    const asMember = await readGroup(second.cookie, groupId);
    expect(asMember.avatarUrl).toBe(AVATAR.url);
    expect(asMember.coverUrl).toBe(COVER.url);
  });

  it('replaces one image without disturbing the other', async () => {
    const { creator, groupId } = await setup();

    await setMedia(creator.cookie, groupId, { avatar: AVATAR, cover: COVER }).expect(200);

    const nextCover = { url: `${CDN}/cover-2.jpg`, publicId: 'splitmoney/cover-2' };
    await setMedia(creator.cookie, groupId, { cover: nextCover }).expect(200);

    const group = await readGroup(creator.cookie, groupId);
    expect(group.coverUrl).toBe(nextCover.url);
    expect(group.avatarUrl).toBe(AVATAR.url);
  });

  it('removes an image when both fields are null', async () => {
    const { creator, groupId } = await setup();

    await setMedia(creator.cookie, groupId, { avatar: AVATAR, cover: COVER }).expect(200);
    await setMedia(creator.cookie, groupId, {
      avatar: { url: null, publicId: null },
    }).expect(200);

    const group = await readGroup(creator.cookie, groupId);
    expect(group.avatarUrl).toBeNull();
    // Removing the avatar must not remove the cover.
    expect(group.coverUrl).toBe(COVER.url);
  });
});

/* ========================================================================== */
/* Authorisation                                                              */
/* ========================================================================== */

describe('group media authorisation', () => {
  it('refuses an ordinary member', async () => {
    const { second, groupId } = await setup();
    await setMedia(second.cookie, groupId, { avatar: AVATAR }).expect(403);
  });

  it('refuses someone outside the group entirely', async () => {
    const { groupId } = await setup();
    const outsider = await member('outsider');

    // 404, not 403: membership does not confirm the group exists to a non-member.
    await setMedia(outsider.cookie, groupId, { avatar: AVATAR }).expect(404);
  });

  it('refuses an unauthenticated request', async () => {
    const { groupId } = await setup();
    await api().patch(`/api/groups/${groupId}/media`).send({ avatar: AVATAR }).expect(401);
  });

  it('leaves the image untouched after a refused attempt', async () => {
    const { creator, second, groupId } = await setup();

    await setMedia(creator.cookie, groupId, { avatar: AVATAR }).expect(200);
    await setMedia(second.cookie, groupId, {
      avatar: { url: `${CDN}/evil.jpg`, publicId: 'evil' },
    }).expect(403);

    expect((await readGroup(creator.cookie, groupId)).avatarUrl).toBe(AVATAR.url);
  });
});

/* ========================================================================== */
/* Validation                                                                 */
/* ========================================================================== */

describe('group media validation', () => {
  it('rejects a URL that is not on Cloudinary', async () => {
    const { creator, groupId } = await setup();

    for (const url of [
      'https://evil.example.com/a.jpg',
      'http://res.cloudinary.com/demo/a.jpg',
      'javascript:alert(1)',
      'https://res.cloudinary.com.evil.example.com/a.jpg',
    ]) {
      await setMedia(creator.cookie, groupId, {
        avatar: { url, publicId: 'x' },
      }).expect(400);
    }

    expect((await readGroup(creator.cookie, groupId)).avatarUrl).toBeNull();
  });

  it('rejects a URL without its public id, and the reverse', async () => {
    const { creator, groupId } = await setup();

    await setMedia(creator.cookie, groupId, {
      avatar: { url: AVATAR.url, publicId: null },
    }).expect(400);

    await setMedia(creator.cookie, groupId, {
      avatar: { url: null, publicId: AVATAR.publicId },
    }).expect(400);
  });

  it('rejects a public id containing path traversal', async () => {
    const { creator, groupId } = await setup();
    await setMedia(creator.cookie, groupId, {
      avatar: { url: AVATAR.url, publicId: '../../secret id' },
    }).expect(400);
  });

  it('rejects an empty body and unknown fields', async () => {
    const { creator, groupId } = await setup();

    await setMedia(creator.cookie, groupId, {}).expect(400);
    await setMedia(creator.cookie, groupId, { banner: AVATAR }).expect(400);
    await setMedia(creator.cookie, groupId, {
      avatar: { ...AVATAR, extra: 'x' },
    }).expect(400);
  });

  it('ignores a groupId smuggled into the body', async () => {
    const { creator, groupId } = await setup();

    const other = await api()
      .post('/api/groups')
      .set('Cookie', creator.cookie)
      .send({ name: 'Other' })
      .expect(201);

    const otherId = other.body.data.group.id as string;

    // `.strict()` rejects the unknown key outright, which is the strongest possible
    // outcome: the request cannot even be expressed.
    await setMedia(creator.cookie, groupId, {
      avatar: AVATAR,
      groupId: otherId,
    }).expect(400);

    expect((await readGroup(creator.cookie, otherId)).avatarUrl).toBeNull();
  });
});
