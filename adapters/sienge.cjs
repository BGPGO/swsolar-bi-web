/**
 * Adapter: Sienge API (SW Solar)
 *
 * Substitui o adapter swsolar-xlsx — em vez de ler 2 xlsx do Drive local,
 * chama a Sienge Bulk Data API diretamente. Pensado pra rodar no
 * bi-refresh-worker (Coolify), sem depender de sync de Google Drive.
 *
 * Endpoints chamados (2 calls/dia da quota Sienge de 10/dia):
 *   1. bulk-data/v1/income  ?selectionType=D&startDate=...&endDate=END_FUTURE
 *   2. bulk-data/v1/outcome ?selectionType=D&startDate=...&endDate=END_FUTURE
 *                          &correctionIndexerId=0&correctionDate=HOJE
 *
 * Output: mesma shape canonical que o swsolar-xlsx produz (movimentos.json,
 * empresa.json, categorias.json, clientes.json, +empty auxiliary).
 *
 * Env vars:
 *   SIENGE_AUTH_TOKEN  → "Basic c3dzb2xhcmVuZXJnaWEtYmdwOm5q..." (incluir "Basic ")
 *
 * Config (bi.config.js > fontes.sienge):
 *   subdomain:           "swsolarenergia"      (default)
 *   start_date:          "2025-01-01"          (default)
 *   future_offset_days:  730                   (default = +2 anos)
 *   excluir_tipo_op:     regex string (opcional)
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const BASE_HOST = 'https://api.sienge.com.br';

// ── utils de data ────────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function offsetDateStr(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function parseDate(s) {
  if (!s) return null;
  const m = String(s).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(m) ? m : null;
}

// ── chamada API ──────────────────────────────────────────────────────────────
async function siengeGet(subdomain, endpoint, params, authHeader) {
  const qs = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const url = `${BASE_HOST}/${subdomain}/public/api/${endpoint}${qs ? '?' + qs : ''}`;
  console.log(`  GET ${endpoint}?${qs}`);

  const ctl = new AbortController();
  const timeout = setTimeout(() => ctl.abort(), 600000); // 10 min
  let resp;
  try {
    resp = await fetch(url, {
      method: 'GET',
      headers: { Authorization: authHeader, Accept: 'application/json' },
      signal: ctl.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  const remaining = resp.headers.get('x-ratelimit-remaining-day') || '?';
  if (resp.status === 429) {
    const reset = resp.headers.get('ratelimit-reset') || '?';
    throw new Error(`Sienge 429 daily limit: remaining=${remaining}, reset=${reset}s`);
  }
  if (!resp.ok) {
    const body = (await resp.text()).slice(0, 500);
    throw new Error(`Sienge ${resp.status}: ${body}`);
  }
  const data = await resp.json();
  const records = data && (data.data || data.results || data);
  const arr = Array.isArray(records) ? records : [];
  console.log(`    -> ${resp.status} OK, ${arr.length} records (remaining today: ${remaining})`);
  return arr;
}

// ── helpers de consolidação (mirror de consolidar_financeiro.py) ────────────
function firstOrNone(lst, key) {
  if (!lst || !lst.length) return null;
  const v = lst[0][key];
  return typeof v === 'string' ? (v.trim() || null) : (v == null ? null : v);
}
function lastPaymentDate(payments) {
  if (!payments || !payments.length) return null;
  const dates = payments.map(p => parseDate(p.paymentDate)).filter(Boolean);
  return dates.length ? dates.sort().slice(-1)[0] : null;
}
function lastOperationName(payments) {
  if (!payments || !payments.length) return null;
  const name = payments[payments.length - 1].operationTypeName;
  return typeof name === 'string' ? (name.trim() || null) : null;
}
function sumPaymentAcresc(payments, recv) {
  let total = 0;
  for (const p of payments || []) {
    total += (p.monetaryCorrectionAmount || 0);
    total += (p.interestAmount || 0);
    total += (p.fineAmount || 0);
    total += (p.taxAmount || 0);
    if (recv) {
      total += (p.additionAmount || 0);
      total += (p.insuranceAmount || 0);
      total += (p.dueAdmAmount || 0);
    }
  }
  return Math.round(total * 100) / 100;
}
function sumPaymentLiquido(payments) {
  let total = 0;
  for (const p of payments || []) total += (p.netAmount || 0);
  return Math.round(total * 100) / 100;
}

// ── mapeamento por linha → movimento canonical ──────────────────────────────
function makeMovimentoOutcome(r, idSeq) {
  const payments = r.payments || [];
  const tipoOp = lastOperationName(payments) || '';

  // Mesma exclusão do swsolar-xlsx
  if (/^(Abatimento de Adiantamento|Distrato|Substituição|Cancelamento|Por Bens)$/i.test(tipoOp)) {
    return null;
  }

  // Regra (definida pelo cliente): existência de data de baixa = título pago.
  // Sem data de baixa = ainda em aberto, mesmo que tenha payments sem paymentDate.
  const dtBaixa = lastPaymentDate(payments);
  const pago = dtBaixa !== null;

  const valorBruto = r.originalAmount || 0;
  const valorLiquido = pago ? sumPaymentLiquido(payments) : valorBruto;
  const valor = Math.abs(valorLiquido || valorBruto);
  if (valor === 0) return null;

  const dtVenc = parseDate(r.dueDate);
  const dtEmissao = parseDate(r.issueDate);
  if (!dtVenc && !dtBaixa && !dtEmissao) return null;

  const cat = r.paymentsCategories || [];
  return {
    id: `sw-${idSeq}`,
    fonte: 'sienge',
    natureza: 'P',
    status: pago ? 'PAGO' : 'EM ABERTO',
    realizado: pago,
    data_emissao: dtEmissao || dtVenc || dtBaixa,
    data_vencimento: dtVenc || dtBaixa || dtEmissao,
    // Data efetiva (regime de caixa): baixa quando existe, senão vencimento
    data_pagamento: dtBaixa || dtVenc || dtEmissao,
    valor_total: valor,
    valor_pago: pago ? valor : 0,
    valor_aberto: pago ? 0 : valor,
    categoria: (firstOrNone(cat, 'financialCategoryName') || 'Sem categoria').toString().trim(),
    centro_custo: (firstOrNone(cat, 'costCenterName') || '').toString().trim(),
    cliente: (r.creditorName || '').trim(),
    conta_corrente: `${r.companyId} - ${(r.companyName || '').trim()}`,
    codigo_banco: '',
    observacao: (r.documentIdentificationName || '').trim(),
    area_negocio: (r.businessAreaName || '').trim(),
    tags: [],
  };
}

function makeMovimentoIncome(r, idSeq) {
  const receipts = r.receipts || [];
  const tipoOp = lastOperationName(receipts) || '';

  if (/^(Abatimento de Adiantamento|Distrato|Substituição|Cancelamento|Por Bens)$/i.test(tipoOp)) {
    return null;
  }

  // Mesma regra do outcome: data de baixa define se foi recebido.
  const dtBaixa = lastPaymentDate(receipts);
  const recebido = dtBaixa !== null;

  const valorBruto = r.originalAmount || 0;
  const valorLiquido = recebido ? sumPaymentLiquido(receipts) : valorBruto;
  const valor = Math.abs(valorLiquido || valorBruto);
  if (valor === 0) return null;

  const dtVenc = parseDate(r.dueDate);
  const dtEmissao = parseDate(r.issueDate);
  if (!dtVenc && !dtBaixa && !dtEmissao) return null;

  const cat = r.receiptsCategories || [];
  return {
    id: `sw-${idSeq}`,
    fonte: 'sienge',
    natureza: 'R',
    status: recebido ? 'PAGO' : 'EM ABERTO',
    realizado: recebido,
    data_emissao: dtEmissao || dtVenc || dtBaixa,
    data_vencimento: dtVenc || dtBaixa || dtEmissao,
    // receita usa Data Baixa como data efetiva (caixa) — igual swsolar-xlsx
    data_pagamento: dtBaixa || dtVenc || dtEmissao,
    valor_total: valor,
    valor_pago: recebido ? valor : 0,
    valor_aberto: recebido ? 0 : valor,
    categoria: (firstOrNone(cat, 'financialCategoryName') || 'Sem categoria').toString().trim(),
    centro_custo: (firstOrNone(cat, 'costCenterName') || '').toString().trim(),
    cliente: (r.clientName || '').trim(),
    conta_corrente: `${r.companyId} - ${(r.companyName || '').trim()}`,
    codigo_banco: '',
    observacao: (r.documentIdentificationName || '').trim(),
    area_negocio: (r.businessAreaName || '').trim(),
    tags: [],
  };
}

// ── adapter pública ──────────────────────────────────────────────────────────
module.exports = {
  id: 'sienge',
  label: 'Sienge API (SW Solar)',
  required_env: ['SIENGE_AUTH_TOKEN'],

  validate(config) {
    const errors = [];
    if (!process.env.SIENGE_AUTH_TOKEN) {
      errors.push('SIENGE_AUTH_TOKEN ausente no env (formato: "Basic <base64>")');
    }
    const cfg = config.fontes && config.fontes.sienge;
    if (!cfg) errors.push('config.fontes.sienge não definido em bi.config.js');
    else if (!cfg.subdomain) errors.push('config.fontes.sienge.subdomain não definido');
    return { ok: errors.length === 0, errors };
  },

  async pull(config, dataDir) {
    fs.mkdirSync(dataDir, { recursive: true });
    const cfg = config.fontes.sienge;
    const auth = process.env.SIENGE_AUTH_TOKEN;
    const subdomain = cfg.subdomain;
    const startDate = cfg.start_date || '2025-01-01';
    const offsetDays = (cfg.future_offset_days != null) ? cfg.future_offset_days : 730;
    const endDate = todayStr();
    const endFuture = offsetDateStr(offsetDays);

    console.log('=== Sienge API pull ===');
    console.log(`Subdomain: ${subdomain}`);
    console.log(`Period:   ${startDate} → ${endFuture}  (correctionDate=${endDate})`);

    // 1) Income por vencimento
    const income = await siengeGet(subdomain, 'bulk-data/v1/income', {
      startDate,
      endDate: endFuture,
      selectionType: 'D',
    }, auth);

    // 2) Outcome por vencimento (correctionDate = HOJE, evita inflar juros futuros)
    const outcome = await siengeGet(subdomain, 'bulk-data/v1/outcome', {
      startDate,
      endDate: endFuture,
      selectionType: 'D',
      correctionIndexerId: 0,
      correctionDate: endDate,
    }, auth);

    // 3) Consolida em movimentos canonical
    let idSeq = 1;
    const movimentos = [];
    for (const r of outcome) {
      const m = makeMovimentoOutcome(r, idSeq);
      if (m) { movimentos.push(m); idSeq++; }
    }
    for (const r of income) {
      const m = makeMovimentoIncome(r, idSeq);
      if (m) { movimentos.push(m); idSeq++; }
    }

    const nRec = movimentos.filter(m => m.natureza === 'R').length;
    const nDesp = movimentos.filter(m => m.natureza === 'P').length;
    const nReal = movimentos.filter(m => m.realizado).length;
    const nAberto = movimentos.length - nReal;
    console.log(`  movimentos: ${movimentos.length} (${nRec} receitas, ${nDesp} despesas)`);
    console.log(`  realizados: ${nReal} | em aberto: ${nAberto}`);

    // Escreve canonical files
    fs.writeFileSync(path.join(dataDir, 'movimentos.json'), JSON.stringify(movimentos, null, 2));

    fs.writeFileSync(path.join(dataDir, 'empresa.json'), JSON.stringify({
      nome_fantasia: (config.cliente && config.cliente.nome) || 'SW Solar',
      fonte: 'sienge',
    }));

    const allCats = [...new Set(movimentos.map(m => m.categoria).filter(Boolean))];
    fs.writeFileSync(path.join(dataDir, 'categorias.json'), JSON.stringify(
      allCats.map(name => ({ codigo: name, descricao: name, tipo: 'mista' })), null, 2
    ));

    const allClientes = [...new Set(movimentos.map(m => m.cliente).filter(Boolean))];
    fs.writeFileSync(path.join(dataDir, 'clientes.json'), JSON.stringify(
      allClientes.map(name => ({ codigo: name, nome_fantasia: name, razao_social: name })), null, 2
    ));

    fs.writeFileSync(path.join(dataDir, 'departamentos.json'), JSON.stringify([]));
    fs.writeFileSync(path.join(dataDir, 'contas_correntes.json'), JSON.stringify([]));
    fs.writeFileSync(path.join(dataDir, 'contas_pagar.json'), JSON.stringify([]));
    fs.writeFileSync(path.join(dataDir, 'contas_receber.json'), JSON.stringify([]));
    fs.writeFileSync(path.join(dataDir, 'orcamento.json'), JSON.stringify([]));

    fs.writeFileSync(path.join(dataDir, '_summary.json'), JSON.stringify({
      adapter: 'sienge',
      fetched_at: new Date().toISOString(),
      records: movimentos.length,
      empresas: [...new Set(movimentos.map(m => m.conta_corrente).filter(Boolean))],
      raw: { income: income.length, outcome: outcome.length },
    }, null, 2));

    console.log(`=== Sienge OK: ${movimentos.length} movimentos ===`);
    return { fetched: movimentos.length, summary: { adapter: 'sienge', records: movimentos.length } };
  },
};
