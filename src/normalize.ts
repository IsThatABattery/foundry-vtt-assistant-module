import type { CampaignEntry, Category, FoundryDocType, RawFoundryDocument, Visibility } from './types';

const TYPE_CATEGORIES: Partial<Record<FoundryDocType, Category>> = {
  actor: 'npc',
  item: 'item',
  scene: 'scene'
};

export function stripHtml(input = ''): string {
  return input.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function inferCategory(doc: RawFoundryDocument): Category {
  const tags = (doc.tags ?? []).map((t) => t.toLowerCase());
  const known = ['location', 'npc', 'quest', 'chapter', 'handout', 'lore', 'encounter', 'item', 'scene'] as const;
  const tagCategory = known.find((c) => tags.includes(c));
  return tagCategory ?? TYPE_CATEGORIES[doc.type] ?? 'unknown';
}

export function inferVisibility(doc: RawFoundryDocument): Visibility {
  if (doc.safeHandout) return 'safe_handout';
  if (doc.visibleToPlayers) return 'player_known';
  return 'gm_secret';
}

export function normalizeDocument(doc: RawFoundryDocument): CampaignEntry {
  const sourceParts = [doc.pack, doc.folder, doc.name].filter(Boolean);
  return {
    id: `${doc.type}:${doc.id}`,
    foundryType: doc.type,
    foundryId: doc.id,
    name: doc.name,
    aliases: [],
    category: inferCategory(doc),
    visibility: inferVisibility(doc),
    summary: stripHtml(doc.content).slice(0, 500),
    tags: doc.tags ?? [],
    sourcePath: sourceParts.length ? sourceParts.join('/') : undefined,
    updatedAt: doc.updatedAt ?? new Date(0).toISOString()
  };
}

export function matchesQuery(doc: RawFoundryDocument, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${doc.name} ${stripHtml(doc.content)}`.toLowerCase().includes(q);
}
