import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const Engine = require('../engine.js');

export function validatePayload(payload, { allowEmpty = false } = {}) {
  if (allowEmpty && Array.isArray(payload?.races) && payload.races.length === 0) {
    if (Number(payload.schemaVersion) !== 1) throw new Error('schemaVersion must be 1');
    if (!payload.source || typeof payload.source !== 'object' || payload.source.mode !== 'unavailable') throw new Error('empty data must use source.mode=unavailable');
    if (typeof payload.source.datasetId !== 'string' || !payload.source.datasetId) throw new Error('empty data requires source.datasetId');
    if (payload.source.redistributable !== false || payload.source.automated !== false) throw new Error('empty unavailable data must not claim redistribution or automation');
    return true;
  }
  Engine.validateDataset(payload);
  if (!payload.source || typeof payload.source !== 'object') throw new Error('source metadata is required');
  if (payload.source.mode !== 'demo' && payload.source.redistributable !== true) {
    throw new Error('source.redistributable must be true before data can be committed to a public repository');
  }
  if (payload.source.mode !== 'demo' && payload.source.asOfFieldsGuaranteed !== true) {
    throw new Error('source.asOfFieldsGuaranteed must confirm that every feature is frozen at snapshot time');
  }
  const missingSnapshot = payload.races.find(race => ['dayBefore', 'final'].some(edition => {
    const snapshot = race.snapshots?.[edition];
    return !snapshot?.asOf || typeof snapshot.ready !== 'boolean';
  }));
  if (missingSnapshot) throw new Error(`${missingSnapshot.id}: dayBefore and final snapshots require asOf and a boolean ready state`);
  const incompleteFinal = payload.races.find(race => (race.status === 'final' || race.result?.status === 'final')
    && (race.snapshots.dayBefore.ready !== true || race.snapshots.final.ready !== true));
  if (incompleteFinal) throw new Error(`${incompleteFinal.id}: finalized races require both ready snapshots`);
  return true;
}

async function main() {
  const file = new URL('../data/races.json', import.meta.url);
  const payload = JSON.parse(await readFile(file, 'utf8'));
  validatePayload(payload, { allowEmpty: true });
  console.log(`Validated ${payload.races.length} race records (${payload.source?.mode || 'unknown'} mode).`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
