# Foundry VTT Assistant Module

Foundry-side module for the Foundry DM Assistant. It connects a running Foundry world to a local MCP bridge over an outbound WebSocket, then exposes a small GM-gated API adapter for scenes, journals, chat, notes, and search.

## Install in Foundry

Foundry installs modules from a **manifest URL**. The manifest (`module.json`) must contain a `download` URL pointing to a zip file for that release.

Use this manifest URL after the first GitHub release is published:

```text
https://github.com/IsThatABattery/foundry-vtt-assistant-module/releases/latest/download/module.json
```

Manual install:

1. Foundry Setup screen → **Add-on Modules** → **Install Module**.
2. Paste the manifest URL above.
3. Enable **Foundry VTT Assistant** in your world.
4. As a GM, set:
   - **API Bearer Token**: same value as `FOUNDRY_ASSISTANT_TOKEN` in the MCP server.
   - **Local MCP Bridge WebSocket URL**: `ws://127.0.0.1:31131/ws`.
   - **Auto-connect to local MCP bridge**: enabled.

> Private GitHub repos are not directly installable by Foundry's package installer unless the manifest and zip URLs are reachable without an interactive GitHub login. For private development, install from a local zip or temporarily host release assets somewhere Foundry can download.

## Release/download scheme

The release workflow uploads two GitHub release assets:

- `module.json` — version-specific manifest URL for Foundry.
- `module.zip` — zip containing `module.json`, `dist/`, `README.md`, and `LICENSE` at the zip root.

For tag `v0.1.0`, the versioned manifest and zip are:

```text
https://github.com/IsThatABattery/foundry-vtt-assistant-module/releases/download/v0.1.0/module.json
https://github.com/IsThatABattery/foundry-vtt-assistant-module/releases/download/v0.1.0/module.zip
```

The stable install URL uses GitHub's `latest/download` redirect:

```text
https://github.com/IsThatABattery/foundry-vtt-assistant-module/releases/latest/download/module.json
```

## Local development

```bash
npm ci
npm test
npm run build
npm run package
```

To test manually, symlink or copy this repo into Foundry's user data modules directory as `foundry-vtt-assistant`, build it, then enable the module in a world.

## Security model

- Only active GM users can trigger privileged Foundry actions.
- The local bridge must present the configured bearer token.
- Player-visible actions require explicit intent flags in the MCP tool input.
- The module initiates an outbound localhost WebSocket; the browser-hosted Foundry app does not open a raw HTTP listener.
