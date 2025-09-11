import { extractEntities } from '../services/nerProxy.js';

async function run() {
  try {
    const res = await extractEntities('Alice and Bob went to Paris. Contact: alice@example.com');
    console.log('NER result:', JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('NER smoke failed:', err);
    process.exit(1);
  }
}

run();
