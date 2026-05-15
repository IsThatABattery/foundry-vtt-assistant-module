import { ApiError, asRecord, json, optionalStringArray, requireExplicitIntent, requireString } from './http';
import { matchesQuery, normalizeDocument } from './normalize';
import type { FoundryAdapter, FoundryDocType, HandlerMap } from './types';

const DOC_TYPES = new Set(['journal', 'actor', 'item', 'scene', 'compendium']);
const CHAT_MODES = new Set(['public', 'gm', 'whisper']);

function parseTypes(value: unknown): FoundryDocType[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string' || !DOC_TYPES.has(v))) {
    throw new ApiError(400, 'BAD_REQUEST', 'types must contain valid Foundry document types');
  }
  return value as FoundryDocType[];
}

function parseDocType(value: unknown): FoundryDocType {
  if (typeof value !== 'string' || !DOC_TYPES.has(value)) throw new ApiError(400, 'BAD_REQUEST', 'type is invalid');
  return value as FoundryDocType;
}

function ensureGm(adapter: FoundryAdapter): void {
  if (!adapter.isGm()) throw new ApiError(403, 'GM_REQUIRED', 'API writes require an active GM user');
}

export function createHandlers(adapter: FoundryAdapter): HandlerMap {
  return {
    'GET /health': async () => json(200, { ok: true, ready: adapter.isReady(), version: adapter.moduleVersion }),
    'GET /api/context': async () => json(200, { context: await adapter.getContext() }),
    'POST /api/search': async (req) => {
      const body = asRecord(req.body);
      const query = typeof body.query === 'string' ? body.query : '';
      const types = parseTypes(body.types);
      const limit = Math.min(Math.max(Number(body.limit ?? 10) || 10, 1), 50);
      const results = (await adapter.listDocuments(types)).filter((d) => matchesQuery(d, query)).slice(0, limit).map(normalizeDocument);
      return json(200, { results });
    },
    'POST /api/document/get': async (req) => {
      const body = asRecord(req.body);
      const type = parseDocType(body.type);
      const id = typeof body.id === 'string' ? body.id : undefined;
      const name = typeof body.name === 'string' ? body.name : undefined;
      if (!id && !name) throw new ApiError(400, 'BAD_REQUEST', 'id or name is required');
      const doc = await adapter.getDocument({ type, id, name });
      if (!doc) throw new ApiError(404, 'NOT_FOUND', 'Document not found');
      return json(200, { document: normalizeDocument(doc) });
    },
    'POST /api/journal/show': async (req) => {
      ensureGm(adapter);
      const body = asRecord(req.body);
      requireExplicitIntent(body, 'journal.show');
      const journalId = requireString(body.journalId, 'journalId');
      const pageId = typeof body.pageId === 'string' ? body.pageId : undefined;
      const users = optionalStringArray(body.users, 'users');
      const result = await adapter.showJournal({ journalId, pageId, users });
      const audit = await adapter.audit({ action: 'journal.show', targetId: journalId, visibleToPlayers: true, users, request: { pageId } });
      return json(200, { result, audit });
    },
    'POST /api/chat/post': async (req) => {
      ensureGm(adapter);
      const body = asRecord(req.body);
      const message = requireString(body.message, 'message');
      const mode = typeof body.mode === 'string' && CHAT_MODES.has(body.mode) ? body.mode as 'public' | 'gm' | 'whisper' : 'gm';
      const users = optionalStringArray(body.users, 'users');
      const playerVisible = mode === 'public' || mode === 'whisper';
      if (playerVisible) requireExplicitIntent(body, 'chat.post');
      const result = await adapter.postChat({ message, mode, users });
      const audit = await adapter.audit({ action: 'chat.post', visibleToPlayers: playerVisible, users, request: { mode, messageLength: message.length } });
      return json(200, { result, audit });
    },
    'POST /api/scene/activate': async (req) => {
      ensureGm(adapter);
      const body = asRecord(req.body);
      const sceneId = typeof body.sceneId === 'string' ? body.sceneId : undefined;
      const sceneName = typeof body.sceneName === 'string' ? body.sceneName : undefined;
      if (!sceneId && !sceneName) throw new ApiError(400, 'BAD_REQUEST', 'sceneId or sceneName is required');
      const activateForPlayers = body.activateForPlayers === true;
      if (activateForPlayers) requireExplicitIntent(body, 'scene.activate');
      const result = await adapter.activateScene({ sceneId, sceneName, activateForPlayers });
      const audit = await adapter.audit({ action: 'scene.activate', targetId: sceneId, targetName: sceneName, visibleToPlayers: activateForPlayers, request: { activateForPlayers } });
      return json(200, { result, audit });
    },
    'POST /api/note/create': async (req) => {
      ensureGm(adapter);
      const body = asRecord(req.body);
      const title = requireString(body.title, 'title');
      const content = requireString(body.content, 'content');
      const folder = typeof body.folder === 'string' ? body.folder : undefined;
      const tags = optionalStringArray(body.tags, 'tags');
      const note = await adapter.createNote({ title, content, folder, tags });
      const audit = await adapter.audit({ action: 'note.create', targetId: note.id, targetName: note.name, visibleToPlayers: false, request: { title, folder, tags } });
      return json(200, { document: normalizeDocument(note), audit });
    },
    'POST /api/note/append': async (req) => {
      ensureGm(adapter);
      const body = asRecord(req.body);
      const journalId = requireString(body.journalId, 'journalId');
      const content = requireString(body.content, 'content');
      const result = await adapter.appendNote({ journalId, content });
      const audit = await adapter.audit({ action: 'note.append', targetId: journalId, visibleToPlayers: false, request: { contentLength: content.length } });
      return json(200, { result, audit });
    },
    'GET /api/index/export': async () => {
      const entries = (await adapter.listDocuments()).map(normalizeDocument);
      return json(200, { entries });
    }
  };
}
