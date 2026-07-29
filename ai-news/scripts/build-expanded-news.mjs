import { readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runPatched(sourceName, replacements) {
  const sourcePath = path.join(__dirname, sourceName);
  let code = await readFile(sourcePath, 'utf8');

  for (const [from, to] of replacements) {
    if (!code.includes(from)) throw new Error(`${sourceName}: replacement target not found: ${from}`);
    code = code.replace(from, to);
  }

  const tempPath = path.join(__dirname, `.__expanded-${Date.now()}-${sourceName}`);
  await writeFile(tempPath, code, 'utf8');
  try {
    await import(`${pathToFileURL(tempPath).href}?v=${Date.now()}`);
  } finally {
    await unlink(tempPath).catch(() => {});
  }
}

await runPatched('update-news.mjs', [
  ['const MAX_OUTPUT_ITEMS = 80;', 'const MAX_OUTPUT_ITEMS = 150;'],
  ['const MAX_AGE_HOURS = 24 * 7;', 'const MAX_AGE_HOURS = 24 * 10;']
]);

await runPatched('refine-news.mjs', [
  ['const MAX_ITEMS = 60;', 'const MAX_ITEMS = 110;'],
  ['const MAX_PER_CATEGORY = 16;', 'const MAX_PER_CATEGORY = 28;'],
  ['const MAX_SINGLE_SOURCE_ITEMS = 14;', 'const MAX_SINGLE_SOURCE_ITEMS = 24;']
]);

console.log('ONE NEWS expanded build completed.');
