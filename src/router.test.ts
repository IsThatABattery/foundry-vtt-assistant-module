import { describe, expect, it } from 'vitest';
import { dispatchRequest } from '../src/router';
import { createHandlers } from '../src/handlers';
import type { FoundryAdapter } from '../src/types';

function adapter(): FoundryAdapter {
  const docs = [
    { type: 'journal' as const, id: 'j1', name: 'Vallaki Rumors', content: '<p>Secret burgomaster notes</p>', updatedAt: '2026-01-02T00:00:00.000Z', visibleToPlayers: false, tags: ['location'] },
    { type: 'actor' as const, id: 'a1', name: 'Ireena', content: 'NPC ally', updatedAt: '2026-01-03T00:00:00.000Z', visibleToPlayers: true, tags: ['npc'] },
    { type: 'scene' as const, id: 's1', name: 'Town Square', content: '', updatedAt: '2026-01-04T00:00:00.000Z', visibleToPlayers: false }
  ];
  return {
    moduleVersion: '0.1.0',
    isReady: () => true,
    isGm: () => true,
    getContext: async () => ({ currentScene: { id: 's1', name: 'Town Square' }, combat: null, selectedTokens: [], activeUsers: [{ id: 'u1', name: 'GM', isGM: true, active: true }] }),
    listDocuments: async (types) => docs.filter((d) => !types?.length || types.includes(d.type)),
    getDocument: async ({ type, id, name }) => docs.find((d) => d.type === type && (d.id === id || d.name === name)) ?? null,
    showJournal: async () => ({ shown: true }),
    postChat: async () => ({ messageId: 'm1' }),
    activateScene: async () => ({ sceneId: 's1', activated: true }),
    createNote: async ({ title, content, folder, tags }) => ({ id: 'n1', name: title, content, folder, tags, type: 'journal', updatedAt: '2026-01-05T00:00:00.000Z' }),
    appendNote: async ({ journalId, content }) => ({ id: journalId, appended: content.length }),
    audit: async (entry) => ({ ...entry, id: 'audit-1', at: '2026-01-06T00:00:00.000Z' })
  };
}

const token = 'secret-token';
const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

async function request(method: string, path: string, body?: unknown, headers = auth) {
  return dispatchRequest({ method, path, headers, body }, { token, handlers: createHandlers(adapter()) });
}

describe('router auth and dispatch', () => {
  it('rejects missing or wrong bearer tokens before dispatch', async () => {
    const res = await request('GET', '/health', undefined, {});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('routes GET /health with valid auth', async () => {
    const res = await request('GET', '/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, ready: true, version: '0.1.0' });
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request('GET', '/nope');
    expect(res.status).toBe(404);
  });
});

describe('explicit intent gating and audit', () => {
  it('rejects player-visible journal/show without explicit user intent', async () => {
    const res = await request('POST', '/api/journal/show', { journalId: 'j1' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('EXPLICIT_INTENT_REQUIRED');
  });

  it('allows journal/show with explicit intent and returns audit metadata', async () => {
    const res = await request('POST', '/api/journal/show', { journalId: 'j1', users: ['u2'], requireExplicitUserIntent: true });
    expect(res.status).toBe(200);
    expect(res.body.audit).toMatchObject({ id: 'audit-1', action: 'journal.show' });
  });

  it('requires explicit intent for public chat but not GM-private chat', async () => {
    const denied = await request('POST', '/api/chat/post', { message: 'hello', mode: 'public' });
    expect(denied.status).toBe(403);
    const gm = await request('POST', '/api/chat/post', { message: 'secret', mode: 'gm' });
    expect(gm.status).toBe(200);
  });

  it('requires explicit intent when activating a scene for players', async () => {
    const denied = await request('POST', '/api/scene/activate', { sceneId: 's1', activateForPlayers: true });
    expect(denied.status).toBe(403);
  });
});

describe('search and document normalization', () => {
  it('normalizes and filters search results by type, query, and limit', async () => {
    const res = await request('POST', '/api/search', { query: 'vallaki', types: ['journal'], limit: 1 });
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0]).toMatchObject({ id: 'journal:j1', foundryType: 'journal', foundryId: 'j1', name: 'Vallaki Rumors', visibility: 'gm_secret' });
    expect(res.body.results[0].summary).not.toContain('<p>');
  });

  it('normalizes document/get payloads and supports fallback by name', async () => {
    const res = await request('POST', '/api/document/get', { type: 'actor', name: 'Ireena' });
    expect(res.status).toBe(200);
    expect(res.body.document).toMatchObject({ id: 'actor:a1', category: 'npc', visibility: 'player_known' });
  });
});
