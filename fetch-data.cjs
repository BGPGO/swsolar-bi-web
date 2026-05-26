#!/usr/bin/env node
/**
 * fetch-data.cjs — orquestrador de adapters.
 *
 * Lê bi.config.js > fontes.adapters[], invoca cada adapter, merge dos outputs
 * canonical em data/.
 *
 * Substitui o antigo fetch-omie.cjs (que era hardcode Omie). Agora multi-fonte.
 *
 * Uso:
 *   node fetch-data.cjs
 *
 * Output: data/empresa.json, categorias.json, departamentos.json, clientes.json,
 *         contas_correntes.json, movimentos.json (canonical), _summary.json
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Carrega .env
try { require('dotenv').config({ path: path.join(__dirname, '.env') }); } catch (e) {}

let cfg;
try { cfg = require('./bi.config.js'); }
catch (e) { console.error('ERRO: bi.config.js não encontrado. Rode `node bgp-bi.cjs init`.'); process.exit(1); }

// Node 24+ não auto-resolve `.cjs` de diretório — apontar arquivo explícito.
const REGISTRY = require('./adapters/index.cjs');

const adapters = (cfg.fontes && cfg.fontes.adapters) || [];
if (adapters.length === 0) {
  console.error('ERRO: bi.config.js > fontes.adapters está vazio. Configure ao menos um adapter.');
  process.exit(1);
}

const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

(async () => {
  console.log(`\nFetch multi-fonte: ${adapters.length} adapter(s) — ${adapters.join(', ')}\n`);

  const allMovimentos = [];
  const summaries = [];

  for (const adapterId of adapters) {
    const adapter = REGISTRY[adapterId];
    if (!adapter) {
      console.error(`✖ Adapter '${adapterId}' não existe no registry. Veja adapters/index.cjs`);
      continue;
    }

    console.log(`\n━━━ ${adapter.label} (${adapterId}) ━━━`);
    const v = adapter.validate(cfg);
    if (!v.ok) {
      console.error(`✖ Validação falhou: ${v.errors.join(', ')}`);
      continue;
    }

    // Pull pra subdir do adapter (preserva isolamento), depois merge
    const subDir = adapters.length === 1 ? DATA_DIR : path.join(DATA_DIR, adapterId);
    fs.mkdirSync(subDir, { recursive: true });
    try {
      const r = await adapter.pull(cfg, subDir);
      summaries.push(r.summary);

      // Se múltiplos adapters, merge movimentos no DATA_DIR final
      if (adapters.length > 1) {
        const movs = JSON.parse(fs.readFileSync(path.join(subDir, 'movimentos.json'), 'utf8'));
        allMovimentos.push(...movs);
      }
    } catch (e) {
      console.error(`✖ Pull falhou: ${e.message}`);
    }
  }

  if (adapters.length > 1) {
    // Dedup por (fonte, id)
    const seen = new Set();
    const dedup = [];
    for (const m of allMovimentos) {
      const k = `${m.fonte}:${m.id}`;
      if (seen.has(k)) continue;
      seen.add(k);
      dedup.push(m);
    }
    fs.writeFileSync(path.join(DATA_DIR, 'movimentos.json'), JSON.stringify(dedup, null, 2));
    console.log(`\n=== Merge: ${dedup.length} movimentos únicos de ${adapters.length} fontes ===`);
  }

  fs.writeFileSync(path.join(DATA_DIR, '_summary.json'), JSON.stringify({
    fetched_at: new Date().toISOString(),
    adapters,
    summaries,
  }, null, 2));

  console.log('\n=== fetch-data OK ===');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
