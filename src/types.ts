export type FoundryDocType = 'journal' | 'actor' | 'item' | 'scene' | 'compendium';
export type Visibility = 'gm_secret' | 'player_known' | 'safe_handout';
export type Category = 'location' | 'npc' | 'quest' | 'chapter' | 'handout' | 'lore' | 'encounter' | 'item' | 'scene' | 'unknown';

export interface RawFoundryDocument {
  type: FoundryDocType;
  id: string;
  name: string;
  content?: string;
  updatedAt?: string;
  visibleToPlayers?: boolean;
  safeHandout?: boolean;
  tags?: string[];
  folder?: string;
  pack?: string;
}

export interface CampaignEntry {
  id: string;
  foundryType: FoundryDocType;
  foundryId: string;
  name: string;
  aliases: string[];
  category: Category;
  visibility: Visibility;
  summary: string;
  tags: string[];
  sourcePath?: string;
  updatedAt: string;
}

export interface AuditEntry {
  id?: string;
  at?: string;
  action: string;
  targetId?: string;
  targetName?: string;
  visibleToPlayers: boolean;
  users?: string[];
  request: Record<string, unknown>;
}

export interface FoundryAdapter {
  moduleVersion: string;
  isReady(): boolean;
  isGm(): boolean;
  getContext(): Promise<unknown>;
  listDocuments(types?: FoundryDocType[]): Promise<RawFoundryDocument[]>;
  getDocument(input: { type: FoundryDocType; id?: string; name?: string }): Promise<RawFoundryDocument | null>;
  showJournal(input: { journalId: string; pageId?: string; users?: string[] }): Promise<unknown>;
  postChat(input: { message: string; mode: 'public' | 'gm' | 'whisper'; users?: string[] }): Promise<unknown>;
  activateScene(input: { sceneId?: string; sceneName?: string; activateForPlayers?: boolean }): Promise<unknown>;
  createNote(input: { title: string; content: string; folder?: string; tags?: string[] }): Promise<RawFoundryDocument>;
  appendNote(input: { journalId: string; content: string }): Promise<unknown>;
  audit(entry: AuditEntry): Promise<AuditEntry>;
}

export interface ApiRequest {
  method: string;
  path: string;
  headers?: Record<string, string | undefined>;
  body?: unknown;
}

export interface ApiResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

export type Handler = (request: ApiRequest) => Promise<ApiResponse>;
export type HandlerMap = Record<string, Handler>;
