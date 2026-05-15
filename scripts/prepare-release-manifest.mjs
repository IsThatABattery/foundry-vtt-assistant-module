import { readFileSync, writeFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync('module.json', 'utf8'));
const repo = process.env.GITHUB_REPOSITORY || 'IsThatABattery/foundry-vtt-assistant-module';
const tag = process.env.GITHUB_REF_NAME || `v${manifest.version}`;
manifest.url = `https://github.com/${repo}`;
manifest.manifest = `https://github.com/${repo}/releases/download/${tag}/module.json`;
manifest.download = `https://github.com/${repo}/releases/download/${tag}/module.zip`;
writeFileSync('module.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(`Prepared release manifest for ${repo}@${tag}`);
