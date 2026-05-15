import { createWriteStream } from 'node:fs';
import { mkdirSync, cpSync, rmSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import yazl from 'yazl';

rmSync('package', { recursive: true, force: true });
mkdirSync('package', { recursive: true });
for (const path of ['module.json', 'README.md', 'LICENSE']) cpSync(path, join('package', path));
cpSync('dist', 'package/dist', { recursive: true });
rmSync('module.zip', { force: true });

const zipfile = new yazl.ZipFile();
function addDirectory(dir) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const archivePath = relative('package', fullPath).replaceAll('\\', '/');
    const stat = statSync(fullPath);
    if (stat.isDirectory()) addDirectory(fullPath);
    else zipfile.addFile(fullPath, archivePath);
  }
}
addDirectory('package');
zipfile.end();
await new Promise((resolve, reject) => {
  zipfile.outputStream
    .pipe(createWriteStream('module.zip'))
    .on('close', resolve)
    .on('error', reject);
});
console.log('Created module.zip');
