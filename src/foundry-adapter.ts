import type { AuditEntry, FoundryAdapter, FoundryDocType, RawFoundryDocument } from './types';

declare const game: any;
declare const canvas: any;
declare const ui: any;
declare const ChatMessage: any;
declare const JournalEntry: any;

const MODULE_ID = 'foundry-vtt-assistant';

function collectionValues(collection: any): any[] {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection;
  if (collection.contents) return collection.contents;
  if (collection instanceof Map) return Array.from(collection.values());
  if (typeof collection.values === 'function') return Array.from(collection.values());
  return [];
}

function textFromDoc(doc: any): string {
  const pages = collectionValues(doc.pages).map((p) => p.text?.content ?? p.system?.description?.value ?? '').join('\n');
  return pages || doc.system?.description?.value || doc.text?.content || doc.content || '';
}

function normalizeRaw(type: FoundryDocType, doc: any, pack?: string): RawFoundryDocument {
  return {
    type,
    id: doc.id,
    name: doc.name,
    content: textFromDoc(doc),
    updatedAt: doc.updatedTime ? new Date(doc.updatedTime).toISOString() : new Date().toISOString(),
    visibleToPlayers: Boolean(doc.ownership && Object.values(doc.ownership).some((v: any) => Number(v) >= 2)),
    tags: doc.getFlag?.(MODULE_ID, 'tags') ?? [],
    folder: doc.folder?.name,
    pack
  };
}

export function createFoundryAdapter(): FoundryAdapter {
  async function findScene(sceneId?: string, sceneName?: string) {
    return sceneId ? game.scenes?.get(sceneId) : collectionValues(game.scenes).find((s) => s.name === sceneName);
  }

  return {
    moduleVersion: game.modules?.get(MODULE_ID)?.version ?? '0.1.0',
    isReady: () => Boolean(game?.ready),
    isGm: () => Boolean(game.user?.isGM),
    async getContext() {
      return {
        currentScene: canvas?.scene ? { id: canvas.scene.id, name: canvas.scene.name } : null,
        combat: game.combat ? { id: game.combat.id, round: game.combat.round, turn: game.combat.turn, active: game.combat.started } : null,
        selectedTokens: collectionValues(canvas?.tokens?.controlled).map((t) => ({ id: t.id, name: t.name, actorId: t.actor?.id })),
        activeUsers: collectionValues(game.users).map((u) => ({ id: u.id, name: u.name, isGM: u.isGM, active: u.active }))
      };
    },
    async listDocuments(types) {
      const requested = types ?? ['journal', 'actor', 'item', 'scene'];
      const docs: RawFoundryDocument[] = [];
      if (requested.includes('journal')) docs.push(...collectionValues(game.journal).map((d) => normalizeRaw('journal', d)));
      if (requested.includes('actor')) docs.push(...collectionValues(game.actors).map((d) => normalizeRaw('actor', d)));
      if (requested.includes('item')) docs.push(...collectionValues(game.items).map((d) => normalizeRaw('item', d)));
      if (requested.includes('scene')) docs.push(...collectionValues(game.scenes).map((d) => normalizeRaw('scene', d)));
      if (requested.includes('compendium')) {
        for (const pack of collectionValues(game.packs)) {
          const index = await pack.getIndex();
          docs.push(...collectionValues(index).map((d) => ({ type: 'compendium' as const, id: d._id ?? d.id, name: d.name, content: '', updatedAt: new Date().toISOString(), pack: pack.collection })));
        }
      }
      return docs;
    },
    async getDocument({ type, id, name }) {
      const docs = await this.listDocuments([type]);
      return docs.find((d) => (id && d.id === id) || (name && d.name === name)) ?? null;
    },
    async showJournal({ journalId, pageId, users }) {
      const entry = game.journal?.get(journalId);
      if (!entry) throw new Error('Journal not found');
      const page = pageId ? entry.pages?.get(pageId) : undefined;
      await entry.sheet?.render(true, page ? { pageId } : undefined);
      if (entry.show) await entry.show(users ? { users } : undefined);
      return { shown: true, journalId, pageId, users };
    },
    async postChat({ message, mode, users }) {
      const whisper = mode === 'gm' ? ChatMessage.getWhisperRecipients('GM').map((u: any) => u.id) : mode === 'whisper' ? users : undefined;
      const msg = await ChatMessage.create({ content: message, speaker: ChatMessage.getSpeaker({ user: game.user }), whisper });
      return { messageId: msg.id };
    },
    async activateScene({ sceneId, sceneName, activateForPlayers }) {
      const scene = await findScene(sceneId, sceneName);
      if (!scene) throw new Error('Scene not found');
      await scene.activate();
      if (activateForPlayers && scene.view) await scene.view();
      return { sceneId: scene.id, activated: true, activateForPlayers: Boolean(activateForPlayers) };
    },
    async createNote({ title, content, folder, tags }) {
      let folderDoc = collectionValues(game.folders).find((f) => f.name === folder && f.type === 'JournalEntry');
      if (folder && !folderDoc) folderDoc = await (globalThis as any).Folder.create({ name: folder, type: 'JournalEntry' });
      const entry = await JournalEntry.create({ name: title, folder: folderDoc?.id, pages: [{ name: title, type: 'text', text: { content, format: 1 } }] });
      if (tags?.length) await entry.setFlag(MODULE_ID, 'tags', tags);
      return normalizeRaw('journal', entry);
    },
    async appendNote({ journalId, content }) {
      const entry = game.journal?.get(journalId);
      if (!entry) throw new Error('Journal not found');
      const page = collectionValues(entry.pages)[0];
      const current = page?.text?.content ?? '';
      if (page) await page.update({ 'text.content': `${current}\n\n${content}` });
      else await entry.createEmbeddedDocuments('JournalEntryPage', [{ name: 'Notes', type: 'text', text: { content, format: 1 } }]);
      return { id: journalId, appended: content.length };
    },
    async audit(entry: AuditEntry) {
      const audit = { ...entry, id: crypto.randomUUID(), at: new Date().toISOString() };
      console.info(`${MODULE_ID} audit`, audit);
      ui?.notifications?.info?.(`Hermes Assistant: ${entry.action}`);
      return audit;
    }
  };
}
