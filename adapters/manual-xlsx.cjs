/**
 * Adapter: Manual XLSX
 *
 * Pra clientes sem ERP integrável. Lê XLSX padronizado do Drive.
 *
 * Esperado:
 *   <DRIVE>/movimentos.xlsx — 1 sheet com colunas:
 *     id | natureza (R/P) | status | data_emissao | data_vencimento | data_pagamento
 *     | valor_total | valor_pago | valor_aberto | categoria | centro_custo
 *     | cliente | conta_corrente | codigo_banco | observacao
 *
 *   <DRIVE>/clientes.xlsx     — opcional, lista de clientes
 *   <DRIVE>/categorias.xlsx   — opcional, classificação receita/despesa
 *
 * Configuração mínima:
 *   fontes: {
 *     adapters: ["manual-xlsx"],
 *     manual_xlsx: {
 *       movimentos_file: "movimentos.xlsx",   // relativo ao drive.base_path
 *     },
 *     drive: { base_path: "G:/Meu Drive/.../<cliente>/BASES" }
 *   }
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const XLSX = require('xlsx');

function readSheet(file, sheetName) {
  const wb = XLSX.readFile(file);
  const sn = sheetName || wb.SheetNames[0];
  return XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: '' });
}

function num(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

function isoDate(v) {
  if (!v) return null;
  if (typeof v === 'number' && v > 1000) {
    // Excel serial
    const ms = (v - 25569) * 86400 * 1000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  if (typeof v === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
    const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  }
  return null;
}

module.exports = {
  id: 'manual-xlsx',
  label: 'XLSX manual (Drive)',
  required_env: [],

  validate(config) {
    const errors = [];
    const drive = config.fontes && config.fontes.drive && config.fontes.drive.base_path;
    if (!drive) errors.push('config.fontes.drive.base_path não definido');
    else if (!fs.existsSync(drive)) errors.push(`drive base_path não existe: ${drive}`);
    const mx = config.fontes && config.fontes['manual_xlsx'];
    if (!mx) errors.push('config.fontes.manual_xlsx não definido');
    else {
      const fileName = mx.movimentos_file || 'movimentos.xlsx';
      const fullPath = path.join(drive || '', fileName);
      if (drive && !fs.existsSync(fullPath)) errors.push(`movimentos file não existe: ${fullPath}`);
    }
    return { ok: errors.length === 0, errors };
  },

  async pull(config, dataDir) {
    fs.mkdirSync(dataDir, { recursive: true });
    const drive = config.fontes.drive.base_path;
    const mx = config.fontes['manual_xlsx'];
    const movFile = path.join(drive, mx.movimentos_file || 'movimentos.xlsx');

    console.log('=== Manual XLSX pull ===');
    console.log('Lendo:', movFile);
    const rows = readSheet(movFile);
    console.log(`  ${rows.length} linhas`);

    const movimentos = rows.map(r => ({
      id: String(r.id || ''),
      fonte: 'manual-xlsx',
      natureza: (r.natureza || '').toUpperCase() === 'R' ? 'R' : 'P',
      status: (r.status || '').toUpperCase(),
      realizado: ['PAGO', 'RECEBIDO'].includes((r.status || '').toUpperCase()),
      data_emissao: isoDate(r.data_emissao),
      data_vencimento: isoDate(r.data_vencimento),
      data_pagamento: isoDate(r.data_pagamento),
      valor_total: num(r.valor_total),
      valor_pago: num(r.valor_pago),
      valor_aberto: num(r.valor_aberto),
      categoria: String(r.categoria || ''),
      centro_custo: String(r.centro_custo || ''),
      cliente: String(r.cliente || ''),
      conta_corrente: String(r.conta_corrente || ''),
      codigo_banco: String(r.codigo_banco || ''),
      observacao: String(r.observacao || ''),
      tags: [],
    })).filter(m => m.id || m.valor_total > 0);

    fs.writeFileSync(path.join(dataDir, 'movimentos.json'), JSON.stringify(movimentos, null, 2));

    // Empresa, categorias, clientes — minimal
    fs.writeFileSync(path.join(dataDir, 'empresa.json'), JSON.stringify({ nome_fantasia: config.cliente?.nome || '', fonte: 'manual' }));
    const categorias = [...new Set(movimentos.map(m => m.categoria).filter(Boolean))]
      .map(name => ({ codigo: name, descricao: name, tipo: 'mista' }));
    fs.writeFileSync(path.join(dataDir, 'categorias.json'), JSON.stringify(categorias, null, 2));
    const clientes = [...new Set(movimentos.map(m => m.cliente).filter(Boolean))]
      .map(name => ({ codigo: name, nome_fantasia: name, razao_social: name }));
    fs.writeFileSync(path.join(dataDir, 'clientes.json'), JSON.stringify(clientes, null, 2));
    fs.writeFileSync(path.join(dataDir, 'departamentos.json'), JSON.stringify([]));
    fs.writeFileSync(path.join(dataDir, 'contas_correntes.json'), JSON.stringify([]));

    fs.writeFileSync(path.join(dataDir, '_summary.json'), JSON.stringify({
      adapter: 'manual-xlsx',
      timestamp: new Date().toISOString(),
      file: movFile,
      records: movimentos.length,
    }, null, 2));

    console.log(`=== Manual XLSX OK: ${movimentos.length} movimentos canonical ===`);
    return { fetched: movimentos.length, summary: { adapter: 'manual-xlsx', records: movimentos.length } };
  },
};
