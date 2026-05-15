import { createHandlers } from './handlers';
import { dispatchRequest } from './router';
import { createFoundryAdapter } from './foundry-adapter';

declare const game: any;
declare const Hooks: any;

const MODULE_ID = 'foundry-vtt-assistant';

Hooks.once('init', () => {
  game.settings.register(MODULE_ID, 'apiToken', {
    name: 'API Bearer Token',
    hint: 'Shared token required by the local MCP bridge when forwarding requests to this Foundry world.',
    scope: 'world',
    config: true,
    type: String,
    default: ''
  });

  game.settings.register(MODULE_ID, 'bridgeUrl', {
    name: 'Local MCP Bridge WebSocket URL',
    hint: 'WebSocket URL for the local Node MCP bridge, usually ws://127.0.0.1:31131/ws.',
    scope: 'world',
    config: true,
    type: String,
    default: 'ws://127.0.0.1:31131/ws'
  });

  game.settings.register(MODULE_ID, 'autoConnectBridge', {
    name: 'Auto-connect to local MCP bridge',
    hint: 'Connect this Foundry world to the local Node MCP bridge when the GM opens the world.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });
});

Hooks.once('ready', () => {
  const adapter = createFoundryAdapter();
  const handlers = createHandlers(adapter);

  const assistantApi = {
    async handleHttpLikeRequest(request: { method: string; path: string; headers?: Record<string, string>; body?: unknown }) {
      const token = game.settings.get(MODULE_ID, 'apiToken');
      return dispatchRequest(request, { token, handlers });
    },

    connectBridge() {
      const token = game.settings.get(MODULE_ID, 'apiToken');
      const bridgeUrl = game.settings.get(MODULE_ID, 'bridgeUrl');
      if (!token) {
        console.warn(`${MODULE_ID}: API token is empty; refusing to connect local MCP bridge.`);
        return undefined;
      }
      const url = new URL(bridgeUrl);
      url.searchParams.set('token', token);
      const socket = new WebSocket(url.toString());
      socket.addEventListener('open', () => console.info(`${MODULE_ID}: connected to local MCP bridge at ${bridgeUrl}`));
      socket.addEventListener('close', (event) => console.warn(`${MODULE_ID}: MCP bridge connection closed`, event.code, event.reason));
      socket.addEventListener('error', (event) => console.error(`${MODULE_ID}: MCP bridge websocket error`, event));
      socket.addEventListener('message', async (event) => {
        let request: { type?: string; id?: string; method?: string; path?: string; headers?: Record<string, string>; body?: unknown };
        try {
          request = JSON.parse(event.data);
        } catch (error) {
          console.warn(`${MODULE_ID}: ignoring invalid bridge message`, error);
          return;
        }
        if (request.type !== 'request' || !request.id || !request.method || !request.path) return;
        try {
          const response = await assistantApi.handleHttpLikeRequest({
            method: request.method,
            path: request.path,
            headers: request.headers,
            body: request.body
          });
          socket.send(JSON.stringify({ type: 'response', id: request.id, status: response.status, body: response.body }));
        } catch (error) {
          socket.send(JSON.stringify({ type: 'response', id: request.id, status: 500, error: (error as Error).message }));
        }
      });
      return socket;
    }
  };

  (globalThis as any).FoundryVttAssistant = assistantApi;

  if (game.user?.isGM && game.settings.get(MODULE_ID, 'autoConnectBridge')) {
    assistantApi.connectBridge();
  }

  console.info(`${MODULE_ID} ready: HTTP-like router registered; bridge auto-connect configured.`);
});
