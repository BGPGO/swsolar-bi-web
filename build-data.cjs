#!/usr/bin/env node
/**
 * build-data.cjs — gera data.js (window.BIT) a partir dos JSONs Omie em data/.
 *
 * Como funciona:
 *  1. Le todos os JSONs de data/ (com tolerancia a arquivos faltantes/vazios).
 *  2. Constroi mapas de resolucao (categoria, departamento, cliente).
 *  3. Para cada lancamento (contas_pagar, contas_receber):
 *      - Resolve nomes legiveis
 *      - Normaliza datas (dd/mm/aaaa -> Date)
 *      - Marca realizado (status_titulo === 'PAGO')
 *  4. Calcula 3 cortes (realizado / a_pagar_receber / tudo) com:
 *      - MONTH_DATA (12 meses do ano corrente)
 *      - RECEITA_CATEGORIAS / DESPESA_CATEGORIAS
 *      - RECEITA_CLIENTES / DESPESA_FORNECEDORES
 *      - EXTRATO (top 200 lancamentos por data desc)
 *      - Totais e KPIs
 *  5. Escreve data.js com `window.BIT = {...}` hardcoded (sem fetch async no boot).
 *
 * Tolerancia:
 *  - Se um arquivo nao existe ou esta vazio, usa array vazio e segue.
 *  - Console mostra warnings claros pra o operador.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = path.join(__dirname, 'data');
const OUT_FILE = path.join(__dirname, 'data.js');

// ---------- config aware ----------
// Permite que adapters não-Omie (fin40, conta-azul) ajustem filtros padrão
// que assumem comportamento Omie (TRANSFERENCIA_RE, Math.abs, lista de bancos).
let _cfg = {};
try { _cfg = require('./bi.config.js') || {}; } catch {}
const FONTES_CFG = _cfg.fontes || {};
const IS_FIN40 = Array.isArray(FONTES_CFG.adapters) && FONTES_CFG.adapters.includes('fin40');

const FILTRAR_TRANSFERENCIAS = (() => {
  const v = FONTES_CFG.fin40?.filtrar_transferencias;
  if (v === false) return false;
  if (v === true) return true;
  // default: filtra pra Omie/Radke, NÃO filtra pra fin40 (SOPRA quebrou com isso)
  return !IS_FIN40;
})();

const PRESERVE_SINAIS = (() => {
  const v = FONTES_CFG.fin40?.preserve_sinais;
  if (v === false) return false;
  if (v === true) return true;
  // default: preserva sinais pra fin40 (RET/refunds), Math.abs pra Omie (sinais não vem)
  return IS_FIN40;
})();

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTHS_FULL = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

// ---------- helpers ----------
function readJson(name, fallback) {
  const p = path.join(DATA_DIR, name + '.json');
  if (!fs.existsSync(p)) {
    console.warn(`  [warn] ${name}.json nao existe — usando fallback (${Array.isArray(fallback) ? 'array vazio' : 'null'})`);
    return fallback;
  }
  try {
    const raw = fs.readFileSync(p, 'utf8');
    if (!raw.trim()) {
      console.warn(`  [warn] ${name}.json vazio — usando fallback`);
      return fallback;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`  [warn] ${name}.json parse falhou: ${e.message} — usando fallback`);
    return fallback;
  }
}

// dd/mm/aaaa -> Date | null
function parseBR(d) {
  if (!d || typeof d !== 'string') return null;
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const dt = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  if (isNaN(dt.getTime())) return null;
  return dt;
}

function fmtBR(d) {
  if (!d) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function num(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  // Omie devolve numeros como number, mas vai com cinto e suspensorio
  const s = String(v).replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

// ---------- carregar dados ----------
console.log('=== Lendo data/*.json ===');
const empresa = readJson('empresa', null);
const categorias = readJson('categorias', []);
const departamentos = readJson('departamentos', []);
const clientes = readJson('clientes', []);
const contasPagar = readJson('contas_pagar', []);
const contasReceber = readJson('contas_receber', []);
const movimentos = readJson('movimentos', []);
const orcamento = readJson('orcamento', []);
const contasCorrentes = readJson('contas_correntes', []);
const summary = readJson('_summary', null);

// Bancos aceitos: 033 Santander, 748 Sicredi, 756 Sicoob.
// Movimentos em outras contas (CAIXA interno, adiantamentos de viagem etc)
// nao entram no BI - sao operacionais, nao representam fluxo de caixa real.
const BANCOS_OK = new Set(['033', '748', '756']);
const ccOk = new Set();
for (const c of contasCorrentes) {
  if (BANCOS_OK.has(String(c.codigo_banco))) ccOk.add(String(c.nCodCC));
}
console.log(`  contas correntes filtradas (Santander/Sicredi/Sicoob): ${ccOk.size}/${contasCorrentes.length}`);

console.log(`  empresa: ${empresa ? empresa.nome_fantasia : '(faltando)'}`);
console.log(`  categorias: ${categorias.length}`);
console.log(`  departamentos: ${departamentos.length}`);
console.log(`  clientes/fornecedores: ${clientes.length}`);
console.log(`  contas_pagar: ${contasPagar.length}`);
console.log(`  contas_receber: ${contasReceber.length}`);
console.log(`  movimentos: ${movimentos.length}`);

// ---------- montar mapas ----------
const catById = new Map();
for (const c of categorias) {
  // codigo (string) eh chave em ListarCategorias
  if (c.codigo) catById.set(String(c.codigo), c);
}
const depById = new Map();
for (const d of departamentos) {
  if (d.codigo) depById.set(String(d.codigo), d);
}
const cliById = new Map();
for (const c of clientes) {
  if (c.codigo_cliente_omie) cliById.set(String(c.codigo_cliente_omie), c);
}

function getCategoriaNome(codigo) {
  if (!codigo) return 'Sem categoria';
  const c = catById.get(String(codigo));
  if (!c) return `Cat ${codigo}`;
  return c.descricao || c.descricao_categoria || `Cat ${codigo}`;
}

function getCategoriaNatureza(codigo) {
  // Omie: natureza pode ser "R" (receita) | "D" (despesa) | "T" (transferencia)
  const c = catById.get(String(codigo));
  return (c && (c.natureza || c.tipo_categoria)) || null;
}

function getDepartamentoNome(codigo) {
  if (!codigo) return null;
  const d = depById.get(String(codigo));
  return d ? d.descricao : `CC ${codigo}`;
}

function getClienteNome(codigo) {
  if (!codigo) return 'Sem cliente';
  const c = cliById.get(String(codigo));
  if (!c) return `Cliente ${codigo}`;
  return c.nome_fantasia || c.razao_social || `Cliente ${codigo}`;
}

// ---------- normalizar lancamentos ----------
// Estrategia: prefere ListarMovimentos (fonte canonica do PBI do cliente) por
// trazer nValPago + dDtPagamento (caixa) E nValorTitulo + dDtVenc (competencia).
// Fallback: ListarContasPagar/Receber (so competencia, sem nValPago).
function normalize(t, kind) {
  const dataVenc = parseBR(t.data_vencimento) || parseBR(t.data_previsao) || parseBR(t.data_emissao) || parseBR(t.data_entrada);
  const dataPago = parseBR(t.data_pagamento) || (t.info && parseBR(t.info.dAlt)) || dataVenc;
  const status = (t.status_titulo || '').toUpperCase();
  const realizado = status === 'PAGO' || status === 'RECEBIDO';
  const cancelado = status === 'CANCELADO';
  const valor = num(t.valor_documento);
  return {
    id: t.codigo_lancamento_omie || t.codigo_lancamento_integracao || null,
    kind,
    cliente: getClienteNome(t.codigo_cliente_fornecedor || t.codigo_cliente),
    categoria: getCategoriaNome(t.codigo_categoria),
    centroCusto: getDepartamentoNome(t.codigo_departamento || (t.distribuicao && t.distribuicao[0] && t.distribuicao[0].cCodDep)),
    data_venc: dataVenc,
    data_efetiva: realizado ? dataPago : dataVenc,
    valor,
    status,
    realizado,
    cancelado,
    nf: t.numero_documento_fiscal || '',
    parcela: t.numero_parcela || '',
  };
}

// Normaliza UMA row de ListarMovimentos aplicando "estilo conta" DAX do PBI.
//
// CRITICO: a row do TITULO e a row da BAIXA aparecem AMBAS com mesmo cStatus.
// Sem o filtro de cGrupo, contamos duplicado:
//   27.244 P|PAGO|CONTA_CORRENTE_PAG (baixa real - efetivo no caixa)
//   14.416 P|PAGO|CONTA_A_PAGAR      (titulo - apenas marca que ta pago)
// O DAX so conta se cGrupo bater com a categoria esperada:
//   Realizado receita: R + RECEBIDO + CONTA_CORRENTE_REC
//   Previsto  receita: R + (A VENCER|ATRASADO|VENCE HOJE) + CONTA_A_RECEBER
//   Realizado despesa: P + PAGO + CONTA_CORRENTE_PAG
//   Previsto  despesa: P + (A VENCER|ATRASADO|VENCE HOJE) + CONTA_A_PAGAR
// Tudo o mais (CANCELADO, PREVISAO_*, etc) -> exclui.
//
// Tambem exclui transferencias (categoria Entrada/Saida de Transferencia)
// porque sao movimentacoes internas entre contas, nao receita/despesa real.
const TRANSFERENCIA_RE = /transfer[eê]ncia/i;

function normalizeMovimento(m) {
  const d = m.detalhes || {};
  const r = m.resumo || {};
  const status = (d.cStatus || '').toUpperCase();
  const natureza = d.cNatureza || '';
  const grupo = d.cGrupo || '';
  // Filtro DAX estilo conta — combinacao natureza × status × grupo precisa bater.
  let realizado = null;
  if (natureza === 'R' && status === 'RECEBIDO' && grupo === 'CONTA_CORRENTE_REC') realizado = true;
  else if (natureza === 'R' && (status === 'A VENCER' || status === 'ATRASADO' || status === 'VENCE HOJE') && grupo === 'CONTA_A_RECEBER') realizado = false;
  else if (natureza === 'P' && status === 'PAGO' && grupo === 'CONTA_CORRENTE_PAG') realizado = true;
  else if (natureza === 'P' && (status === 'A VENCER' || status === 'ATRASADO' || status === 'VENCE HOJE') && grupo === 'CONTA_A_PAGAR') realizado = false;
  else return null; // CANCELADO, PREVISAO, ou combinacao espuria - exclui

  // Filtro transferencias entre contas (nao sao receita/despesa real).
  // Parametrizado via bi.config.js > fontes.fin40.filtrar_transferencias.
  // Default: filtra pra Omie; NÃO filtra pra fin40 (SOPRA tem categorias
  // "Transferências entre contas" legítimas em pos_operacional).
  const categoria = getCategoriaNome(d.cCodCateg);
  if (FILTRAR_TRANSFERENCIAS && TRANSFERENCIA_RE.test(categoria)) return null;

  // Filtro contas correntes: apenas bancos formais (Santander/Sicredi/Sicoob).
  // Operacional interno (Caixa, adiantamentos de viagem, contas de socio) fica fora.
  // Pra fin40: cliente pode ter qualquer banco e ccOk pode estar vazio — pula filtro.
  if (!IS_FIN40 && ccOk.size && !ccOk.has(String(d.nCodCC))) return null;

  const dataPago = parseBR(d.dDtPagamento);
  const dataVenc = parseBR(d.dDtVenc) || parseBR(d.dDtPrevisao) || parseBR(d.dDtEmissao);
  const data_efetiva = realizado ? (dataPago || dataVenc) : dataVenc;
  if (!data_efetiva) return null;
  // Valor: realizado = nValPago (caixa). Previsto = nValAberto (saldo nao pago).
  let valor = realizado ? num(r.nValPago) : (num(r.nValAberto) || num(d.nValorTitulo));
  if (!valor && !realizado) valor = num(d.nValorTitulo);
  if (!valor) return null;
  const dept = (m.departamentos && m.departamentos[0] && m.departamentos[0].cCodDepartamento) || null;
  return {
    id: d.nCodTitulo || null,
    kind: natureza === 'R' ? 'receita' : 'despesa',
    cliente: getClienteNome(d.nCodCliente),
    categoria,
    centroCusto: getDepartamentoNome(dept),
    data_venc: dataVenc,
    data_efetiva,
    // PRESERVE_SINAIS: pra fin40 valor pode vir negativo (RET, refunds, redutores).
    // Math.abs aqui destruiria semântica fin40. Pra Omie comportamento original.
    valor: PRESERVE_SINAIS ? valor : Math.abs(valor),
    valor_signed: valor, // sempre preservado pra adapters que checarem
    status,
    realizado,
    cancelado: false,
    grupo,
    nf: d.cNumDocFiscal || '',
    parcela: d.cNumParcela || '',
  };
}

// Normaliza row de adapter canonical (manual-xlsx, pordosol-xlsx, etc).
// Campos: natureza, status, data_vencimento (ISO), data_pagamento (ISO), valor_total, categoria, cliente, regime.
function normalizeAdapter(m) {
  const parseDate = (d) => {
    if (!d) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(d)) return new Date(d + 'T00:00:00');
    return parseBR(d);
  };
  const dataVenc = parseDate(m.data_vencimento);
  const dataPago = parseDate(m.data_pagamento) || dataVenc;
  if (!dataVenc && !dataPago) return null;
  const realizado = m.realizado || ['PAGO', 'RECEBIDO'].includes((m.status || '').toUpperCase());
  const cancelado = (m.status || '').toUpperCase() === 'CANCELADO';
  if (cancelado) return null;
  const valor = Math.abs(num(m.valor_total) || num(m.valor_pago) || 0);
  if (!valor) return null;
  return {
    id: m.id,
    kind: (m.natureza || '').toUpperCase() === 'R' ? 'receita' : 'despesa',
    cliente: m.cliente || 'Sem cliente',
    categoria: m.categoria || 'Sem categoria',
    centroCusto: m.centro_custo || '',
    data_venc: dataVenc,
    data_efetiva: realizado ? (dataPago || dataVenc) : dataVenc,
    valor,
    status: m.status || '',
    realizado,
    cancelado: false,
    regime: m.regime || 'caixa',
  };
}

console.log('\n=== Normalizando lancamentos ===');
let recNorm, despNorm, dataSource;
// Adapter canonical: rows têm campo `fonte` (manual-xlsx, pordosol-xlsx, etc)
if (movimentos.length > 0 && movimentos[0].fonte) {
  dataSource = 'adapter';
  recNorm = []; despNorm = [];
  for (const m of movimentos) {
    const norm = normalizeAdapter(m);
    if (!norm) continue;
    if (norm.kind === 'receita') recNorm.push(norm);
    else despNorm.push(norm);
  }
  console.log(`  fonte: adapter canonical (${movimentos.length} rows brutos -> ${recNorm.length + despNorm.length} validos)`);
} else if (movimentos.length > 1000) {
  // Source canonica: ListarMovimentos. Bate 100% com PBI personalizado.
  dataSource = 'movimentos';
  const allMovs = movimentos.map(normalizeMovimento).filter(Boolean);
  recNorm = allMovs.filter((t) => t.kind === 'receita');
  despNorm = allMovs.filter((t) => t.kind === 'despesa');
  console.log(`  fonte: ListarMovimentos (${movimentos.length} rows brutos -> ${allMovs.length} validos)`);
} else {
  // Fallback: ListarContasPagar/Receber. So bate competencia.
  dataSource = 'contas_pagar_receber';
  recNorm = contasReceber.map((t) => normalize(t, 'receita')).filter((t) => !t.cancelado);
  despNorm = contasPagar.map((t) => normalize(t, 'despesa')).filter((t) => !t.cancelado);
  console.log(`  fonte: contas_pagar/receber (sem nValPago — pode divergir do PBI no caixa)`);
}
console.log(`  receitas validas: ${recNorm.length}`);
console.log(`  despesas validas: ${despNorm.length}`);

// ---------- decidir ano de referencia ----------
// Default: ANO CORRENTE (operador quer ver o que ta acontecendo agora).
// Tambem expomos lista de anos disponiveis pro selector no header.
const yearCount = {};
for (const t of [...recNorm, ...despNorm]) {
  if (!t.data_efetiva) continue;
  const y = t.data_efetiva.getFullYear();
  yearCount[y] = (yearCount[y] || 0) + 1;
}
const REF_YEAR = new Date().getFullYear();
const AVAILABLE_YEARS = Object.keys(yearCount).map(Number).sort((a, b) => b - a);
console.log(`  ano de referencia: ${REF_YEAR} | anos disponiveis: ${AVAILABLE_YEARS.join(', ')}`);

// ---------- segmentos por filtro ----------
function selectByFilter(items, filter) {
  // 'realizado'      => status PAGO/RECEBIDO
  // 'a_pagar_receber'=> status A VENCER, ATRASADO, VENCE HOJE (nao pago)
  // 'tudo'           => tudo (exceto CANCELADO, ja filtrado antes)
  if (filter === 'realizado') return items.filter((t) => t.realizado);
  if (filter === 'a_pagar_receber') return items.filter((t) => !t.realizado);
  return items;
}

// ---------- agregacoes ----------
function buildMonthData(rec, desp, year) {
  const data = MONTHS_FULL.map((m) => ({ m, receita: 0, despesa: 0 }));
  for (const t of rec) {
    const d = t.data_efetiva;
    if (!d || d.getFullYear() !== year) continue;
    data[d.getMonth()].receita += t.valor;
  }
  for (const t of desp) {
    const d = t.data_efetiva;
    if (!d || d.getFullYear() !== year) continue;
    data[d.getMonth()].despesa += t.valor;
  }
  return data;
}

function buildCategoriaAgg(items, year, kindLabel) {
  const map = new Map();
  for (const t of items) {
    const d = t.data_efetiva;
    if (year && d && d.getFullYear() !== year) continue;
    const k = t.categoria;
    if (!map.has(k)) map.set(k, { name: k, value: 0, count: 0, clientesSet: new Set() });
    const obj = map.get(k);
    obj.value += t.valor;
    obj.count += 1;
    obj.clientesSet.add(t.cliente);
  }
  const out = [];
  for (const v of map.values()) {
    const o = { name: v.name, value: v.value };
    if (kindLabel === 'receita') o.clientes = v.clientesSet.size;
    else o.fornecedores = v.clientesSet.size;
    out.push(o);
  }
  return out.sort((a, b) => b.value - a.value).slice(0, 12);
}

function buildClienteAgg(items, year) {
  const map = new Map();
  for (const t of items) {
    const d = t.data_efetiva;
    if (year && d && d.getFullYear() !== year) continue;
    const k = t.cliente;
    if (!map.has(k)) map.set(k, { name: k, value: 0 });
    map.get(k).value += t.valor;
  }
  return Array.from(map.values()).sort((a, b) => b.value - a.value).slice(0, 12);
}

function buildExtrato(rec, desp, limit = 200) {
  // tupla compativel com mock: [data, cc, categoria, cliente, valor, status]
  const all = [], recArr = [], despArr = [];
  for (const t of rec) {
    const r = [fmtBR(t.data_efetiva), t.centroCusto || 'Operações', t.categoria, t.cliente, t.valor, t.status];
    all.push(r); recArr.push(r);
  }
  for (const t of desp) {
    const r = [fmtBR(t.data_efetiva), t.centroCusto || 'Operações', t.categoria, t.cliente, -t.valor, t.status];
    all.push(r); despArr.push(r);
  }
  // sort por data desc
  const sortDesc = (a, b) => {
    const [da, ma, ya] = (a[0] || '01/01/1970').split('/').map(Number);
    const [db, mb, yb] = (b[0] || '01/01/1970').split('/').map(Number);
    return new Date(yb, mb - 1, db) - new Date(ya, ma - 1, da);
  };
  all.sort(sortDesc); recArr.sort(sortDesc); despArr.sort(sortDesc);
  return {
    EXTRATO: all.slice(0, limit),
    EXTRATO_RECEITAS: recArr.slice(0, limit),
    EXTRATO_DESPESAS: despArr.slice(0, limit),
  };
}

function buildKpis(monthData) {
  const TOTAL_RECEITA = monthData.reduce((s, x) => s + x.receita, 0);
  const TOTAL_DESPESA = monthData.reduce((s, x) => s + x.despesa, 0);
  const VALOR_LIQUIDO = TOTAL_RECEITA - TOTAL_DESPESA;
  const MARGEM_LIQUIDA = TOTAL_RECEITA > 0 ? (VALOR_LIQUIDO / TOTAL_RECEITA) * 100 : 0;
  // Heuristicas — sem dados reais de impostos/capex separados, estimamos via categorias
  const VALOR_LIQ_SERIES = monthData.map((m) => m.receita - m.despesa);
  return { TOTAL_RECEITA, TOTAL_DESPESA, VALOR_LIQUIDO, MARGEM_LIQUIDA, VALOR_LIQ_SERIES };
}

function buildSegment(rec, desp, year, label) {
  const r = selectByFilter(rec, label);
  const d = selectByFilter(desp, label);
  const MONTH_DATA = buildMonthData(r, d, year);
  const RECEITA_CATEGORIAS = buildCategoriaAgg(r, year, 'receita');
  const DESPESA_CATEGORIAS = buildCategoriaAgg(d, year, 'despesa');
  const RECEITA_CLIENTES = buildClienteAgg(r, year);
  const DESPESA_FORNECEDORES = buildClienteAgg(d, year);
  const extOut = buildExtrato(r, d, 200);
  const EXTRATO = extOut.EXTRATO;
  const EXTRATO_RECEITAS = extOut.EXTRATO_RECEITAS;
  const EXTRATO_DESPESAS = extOut.EXTRATO_DESPESAS;
  const KPIS = buildKpis(MONTH_DATA);
  // count de lancamentos por mes (pra DailyBars/RECEITA_DIA usar como proxy)
  const RECEITA_DIA = Array(31).fill(0);
  const DESPESA_DIA = Array(31).fill(0);
  for (const t of r) {
    const dt = t.data_efetiva;
    if (!dt || dt.getFullYear() !== year) continue;
    RECEITA_DIA[dt.getDate() - 1] += t.valor;
  }
  for (const t of d) {
    const dt = t.data_efetiva;
    if (!dt || dt.getFullYear() !== year) continue;
    DESPESA_DIA[dt.getDate() - 1] += t.valor;
  }
  // saldos cumulativos
  const SALDOS_MES = [];
  let saldo = 0;
  for (const m of MONTH_DATA) {
    saldo += m.receita - m.despesa;
    SALDOS_MES.push(saldo);
  }
  // FLUXO horizontal (top 5 categorias receita / top 5 despesa)
  const FLUXO_RECEITA = RECEITA_CATEGORIAS.slice(0, 5).map((cat) => ({
    cat: cat.name,
    values: MONTHS_FULL.map((mn, mi) => {
      let s = 0;
      for (const t of r) {
        const dt = t.data_efetiva;
        if (!dt || dt.getFullYear() !== year) continue;
        if (dt.getMonth() !== mi) continue;
        if (t.categoria !== cat.name) continue;
        s += t.valor;
      }
      return s;
    }),
  }));
  const FLUXO_DESPESA = DESPESA_CATEGORIAS.slice(0, 5).map((cat) => ({
    cat: cat.name,
    values: MONTHS_FULL.map((mn, mi) => {
      let s = 0;
      for (const t of d) {
        const dt = t.data_efetiva;
        if (!dt || dt.getFullYear() !== year) continue;
        if (dt.getMonth() !== mi) continue;
        if (t.categoria !== cat.name) continue;
        s -= t.valor;
      }
      return s;
    }),
  }));
  // Comparativo: trim1 vs trim2 do ano corrente
  const buildTrimAgg = (items, mStart, mEnd) => {
    const map = new Map();
    let total = 0;
    for (const t of items) {
      const dt = t.data_efetiva;
      if (!dt || dt.getFullYear() !== year) continue;
      if (dt.getMonth() < mStart || dt.getMonth() > mEnd) continue;
      const k = t.categoria;
      map.set(k, (map.get(k) || 0) + t.valor);
      total += t.valor;
    }
    return { map, total };
  };
  const recT1 = buildTrimAgg(r, 0, 2), recT2 = buildTrimAgg(r, 3, 5);
  const despT1 = buildTrimAgg(d, 0, 2), despT2 = buildTrimAgg(d, 3, 5);
  const COMP_DATA = [
    { tipo: 'Receita', isHeader: true, d1: recT1.total, d2: recT2.total },
  ];
  const allRecCats = new Set([...recT1.map.keys(), ...recT2.map.keys()]);
  for (const k of allRecCats) {
    COMP_DATA.push({ tipo: k, parent: 'Receita', d1: recT1.map.get(k) || 0, d2: recT2.map.get(k) || 0 });
  }
  COMP_DATA.push({ tipo: 'Despesa', isHeader: true, d1: -despT1.total, d2: -despT2.total });
  const allDespCats = new Set([...despT1.map.keys(), ...despT2.map.keys()]);
  for (const k of allDespCats) {
    COMP_DATA.push({ tipo: k, parent: 'Despesa', d1: -(despT1.map.get(k) || 0), d2: -(despT2.map.get(k) || 0) });
  }
  return {
    MONTH_DATA, RECEITA_CATEGORIAS, DESPESA_CATEGORIAS,
    RECEITA_CLIENTES, DESPESA_FORNECEDORES, EXTRATO,
    EXTRATO_RECEITAS, EXTRATO_DESPESAS,
    KPIS, RECEITA_DIA, DESPESA_DIA, SALDOS_MES,
    FLUXO_RECEITA, FLUXO_DESPESA, COMP_DATA,
  };
}

// Segmentos pre-computados usam só caixa (default) quando há dados dual-regime.
const hasDualRegime = recNorm.some(t => t.regime) || despNorm.some(t => t.regime);
const cxRec = hasDualRegime ? recNorm.filter(t => (t.regime || 'caixa') === 'caixa') : recNorm;
const cxDesp = hasDualRegime ? despNorm.filter(t => (t.regime || 'caixa') === 'caixa') : despNorm;
console.log('\n=== Construindo segmentos (realizado / a_pagar_receber / tudo) ===');
if (hasDualRegime) console.log(`  dual-regime: ${recNorm.length} rec total → ${cxRec.length} caixa, ${despNorm.length} desp total → ${cxDesp.length} caixa`);
const realizado = buildSegment(cxRec, cxDesp, REF_YEAR, 'realizado');
const a_pagar_receber = buildSegment(cxRec, cxDesp, REF_YEAR, 'a_pagar_receber');
const tudo = buildSegment(cxRec, cxDesp, REF_YEAR, 'tudo');

console.log(`  realizado: receita=${realizado.KPIS.TOTAL_RECEITA.toFixed(2)} despesa=${realizado.KPIS.TOTAL_DESPESA.toFixed(2)} liq=${realizado.KPIS.VALOR_LIQUIDO.toFixed(2)}`);
console.log(`  a_pagar:   receita=${a_pagar_receber.KPIS.TOTAL_RECEITA.toFixed(2)} despesa=${a_pagar_receber.KPIS.TOTAL_DESPESA.toFixed(2)}`);
console.log(`  tudo:      receita=${tudo.KPIS.TOTAL_RECEITA.toFixed(2)} despesa=${tudo.KPIS.TOTAL_DESPESA.toFixed(2)}`);

// ---------- meta + posicao caixa (placeholder) ----------
const meta = {
  empresa: empresa ? {
    nome_fantasia: empresa.nome_fantasia,
    razao_social: empresa.razao_social,
    cnpj: empresa.cnpj,
    cidade: empresa.cidade,
  } : null,
  fetched_at: summary ? summary.fetched_at : null,
  ref_year: REF_YEAR,
  counts: {
    contas_pagar: contasPagar.length,
    contas_receber: contasReceber.length,
    categorias: categorias.length,
    departamentos: departamentos.length,
    clientes: clientes.length,
  },
};

// Posicao caixa: nao temos dados de saldo bancario direto. Usamos saldo_acumulado do realizado.
const POSICAO_CAIXA = [
  { name: 'Saldo realizado YTD', value: realizado.KPIS.VALOR_LIQUIDO },
  { name: 'A receber (futuro)', value: a_pagar_receber.KPIS.TOTAL_RECEITA },
  { name: 'A pagar (futuro)', value: a_pagar_receber.KPIS.TOTAL_DESPESA },
];

const COMPOSICAO_DESPESA = realizado.DESPESA_CATEGORIAS.slice(0, 6).map((c, i) => ({
  name: c.name,
  value: c.value,
  color: ['#2dd4bf', '#22c55e', '#a78bfa', '#f59e0b', '#ef4444', '#6b7686'][i] || '#6b7686',
}));

// ---------- escrever data.js ----------
const DATA_JS = `/* BGP BI — gerado por build-data.cjs em ${new Date().toISOString()} */
/* Empresa: ${meta.empresa ? meta.empresa.nome_fantasia : '(faltando)'} | Ano ref: ${REF_YEAR} */
const MONTHS = ${JSON.stringify(MONTHS)};
const MONTHS_FULL = ${JSON.stringify(MONTHS_FULL)};

function fmt(n, opts = {}) {
  const { dec = 2, prefix = "R$", showSign = false } = opts;
  const sign = n < 0 ? "-" : (showSign ? "+" : "");
  const abs = Math.abs(n);
  const parts = abs.toFixed(dec).split(".");
  parts[0] = parts[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g, ".");
  return \`\${sign}\${prefix}\${parts.join(",")}\`;
}
function fmtK(n) {
  return fmt(n, { dec: 0 });
}
function fmtPct(n, dec = 2) {
  const sign = n > 0 ? "+" : (n < 0 ? "-" : "");
  return \`\${sign}\${Math.abs(n).toFixed(dec).replace(".", ",")}%\`;
}

const META = ${JSON.stringify(meta, null, 2)};
const POSICAO_CAIXA = ${JSON.stringify(POSICAO_CAIXA, null, 2)};
const COMPOSICAO_DESPESA = ${JSON.stringify(COMPOSICAO_DESPESA, null, 2)};

const SEGMENTS = ${JSON.stringify({ realizado, a_pagar_receber, tudo }, null, 2)};

// ALL_TX: lista flat de TODAS as transacoes normalizadas (despesa + receita,
// realizadas + a pagar + canceladas excluidas). Usada pra cross-filter real
// — pagina recalcula KPIs/charts/tabelas em runtime via aggregateTx().
// Cada row eh tupla compacta pra reduzir tamanho do bundle:
// [kind, mes, dia, categoria, cliente, valor, realizado, fornecedor, centroCusto, regime]
// regime: 'c' = caixa, 'k' = competencia (compacto pra economizar bytes)
const ALL_TX = ${JSON.stringify([
  ...recNorm.map(t => [
    'r',
    t.data_efetiva ? t.data_efetiva.toISOString().slice(0,7) : '',
    t.data_efetiva ? t.data_efetiva.getDate() : 0,
    t.categoria,
    t.cliente,
    t.valor,
    t.realizado ? 1 : 0,
    '',
    t.centroCusto || '',
    (t.regime || 'caixa') === 'caixa' ? 'c' : 'k',
  ]),
  ...despNorm.map(t => [
    'd',
    t.data_efetiva ? t.data_efetiva.toISOString().slice(0,7) : '',
    t.data_efetiva ? t.data_efetiva.getDate() : 0,
    t.categoria,
    '',
    t.valor,
    t.realizado ? 1 : 0,
    t.cliente,
    t.centroCusto || '',
    (t.regime || 'caixa') === 'caixa' ? 'c' : 'k',
  ]),
])};

const REF_YEAR = ${REF_YEAR};
const AVAILABLE_YEARS = ${JSON.stringify(AVAILABLE_YEARS)};

// aggregateTx: recomputa MONTH_DATA, KPIS, top categorias/clientes/fornecedores
// e EXTRATO a partir de uma lista filtrada de transacoes. Chamada pelas Pages
// quando drilldown ou statusFilter estao ativos.
function aggregateTx(txList, year) {
  year = year || REF_YEAR;
  const months = ${JSON.stringify(MONTHS_FULL)};
  const MONTH_DATA = months.map(m => ({ m, receita: 0, despesa: 0 }));
  const RECEITA_DIA = Array(31).fill(0);
  const DESPESA_DIA = Array(31).fill(0);
  const recCat = new Map(), despCat = new Map();
  const recCli = new Map(), despForn = new Map();
  const extratoArr = [];
  const extratoRecArr = [], extratoDespArr = [];
  let totalReceita = 0, totalDespesa = 0;

  for (const row of txList) {
    const [kind, mes, dia, categoria, cliente, valor, realizado, fornecedor, cc] = row;
    if (!mes) continue;
    const ymonth = mes.slice(0,4);
    if (Number(ymonth) !== year) continue;
    const mIdx = parseInt(mes.slice(5,7), 10) - 1;
    if (mIdx < 0 || mIdx > 11) continue;
    if (kind === 'r') {
      MONTH_DATA[mIdx].receita += valor;
      totalReceita += valor;
      recCat.set(categoria, (recCat.get(categoria) || 0) + valor);
      if (cliente) recCli.set(cliente, (recCli.get(cliente) || 0) + valor);
      if (dia >= 1 && dia <= 31) RECEITA_DIA[dia - 1] += valor;
    } else {
      MONTH_DATA[mIdx].despesa += valor;
      totalDespesa += valor;
      despCat.set(categoria, (despCat.get(categoria) || 0) + valor);
      if (fornecedor) despForn.set(fornecedor, (despForn.get(fornecedor) || 0) + valor);
      if (dia >= 1 && dia <= 31) DESPESA_DIA[dia - 1] += valor;
    }
    // Extrato compacto pra tabela (renomeado pra extRow porque outer for já usa 'row')
    const dataStr = String(dia).padStart(2,'0') + '/' + mes.slice(5,7) + '/' + mes.slice(0,4);
    const extRow = [dataStr, cc || 'Operações', categoria, kind === 'r' ? cliente : fornecedor, kind === 'r' ? valor : -valor, realizado ? 'PAGO' : ''];
    extratoArr.push(extRow);
    if (kind === 'r') extratoRecArr.push(extRow); else extratoDespArr.push(extRow);
  }

  // sort por data desc (string DD/MM/YYYY → Date) — aplica nos 3 arrays
  const sortByDateDesc = (a, b) => {
    const [da,ma,ya] = a[0].split('/').map(Number);
    const [db,mb,yb] = b[0].split('/').map(Number);
    return new Date(yb,mb-1,db) - new Date(ya,ma-1,da);
  };
  extratoArr.sort(sortByDateDesc);
  extratoRecArr.sort(sortByDateDesc);
  extratoDespArr.sort(sortByDateDesc);

  const topN = (mp, n) => Array.from(mp.entries()).map(([name,value]) => ({name,value})).sort((a,b)=>b.value-a.value).slice(0,n);
  const VALOR_LIQUIDO = totalReceita - totalDespesa;
  const MARGEM_LIQUIDA = totalReceita > 0 ? (VALOR_LIQUIDO / totalReceita) * 100 : 0;

  // Saldos acumulados por mês
  const SALDOS_MES = [];
  var _saldo = 0;
  for (var _si = 0; _si < MONTH_DATA.length; _si++) {
    _saldo += MONTH_DATA[_si].receita - MONTH_DATA[_si].despesa;
    SALDOS_MES.push(_saldo);
  }

  return {
    MONTH_DATA,
    RECEITA_CATEGORIAS: topN(recCat, 12),
    DESPESA_CATEGORIAS: topN(despCat, 12),
    RECEITA_CLIENTES: topN(recCli, 12),
    DESPESA_FORNECEDORES: topN(despForn, 12),
    EXTRATO: extratoArr.slice(0, 200),
    EXTRATO_RECEITAS: extratoRecArr.slice(0, 200),
    EXTRATO_DESPESAS: extratoDespArr.slice(0, 200),
    RECEITA_DIA: RECEITA_DIA,
    DESPESA_DIA: DESPESA_DIA,
    SALDOS_MES: SALDOS_MES,
    KPIS: {
      TOTAL_RECEITA: totalReceita,
      TOTAL_DESPESA: totalDespesa,
      VALOR_LIQUIDO,
      MARGEM_LIQUIDA,
      VALOR_LIQ_SERIES: MONTH_DATA.map(m => m.receita - m.despesa),
    },
  };
}

// applyDrilldown: filtra ALL_TX baseado em statusFilter + drilldown + regime.
// statusFilter: 'realizado' | 'a_pagar_receber' | 'tudo'
// drilldown: null | { type: 'mes'|'categoria'|'cliente'|'fornecedor', value: ... }
// regime: 'caixa' | 'competencia' | null (null = caixa default)
function filterTx(allTx, statusFilter, drilldown, regime, extraFilters) {
  let out = allTx;
  // Filtro por regime (caixa/competencia) — index [9]: 'c' ou 'k'
  var rg = (regime === 'competencia') ? 'k' : 'c';
  out = out.filter(r => r[9] === rg);
  if (statusFilter === 'realizado') out = out.filter(r => r[6] === 1);
  else if (statusFilter === 'a_pagar_receber') out = out.filter(r => r[6] === 0);
  if (drilldown) {
    if (drilldown.type === 'mes') out = out.filter(r => r[1] === drilldown.value);
    else if (drilldown.type === 'categoria') out = out.filter(r => r[3] === drilldown.value);
    else if (drilldown.type === 'cliente') out = out.filter(r => r[0] === 'r' && r[4] === drilldown.value);
    else if (drilldown.type === 'fornecedor') out = out.filter(r => r[0] === 'd' && r[7] === drilldown.value);
    else if (drilldown.type === 'dia') out = out.filter(r => r[2] === drilldown.value + 1);
  }
  // Extra filters: dateFrom, dateTo, categoria
  if (extraFilters) {
    if (extraFilters.dateFrom) {
      // dateFrom format: "YYYY-MM-DD"
      var dfYm = extraFilters.dateFrom.slice(0, 7); // "YYYY-MM"
      var dfDay = parseInt(extraFilters.dateFrom.slice(8, 10), 10);
      out = out.filter(function(r) {
        if (r[1] > dfYm) return true;
        if (r[1] < dfYm) return false;
        return r[2] >= dfDay;
      });
    }
    if (extraFilters.dateTo) {
      var dtYm = extraFilters.dateTo.slice(0, 7);
      var dtDay = parseInt(extraFilters.dateTo.slice(8, 10), 10);
      out = out.filter(function(r) {
        if (r[1] < dtYm) return true;
        if (r[1] > dtYm) return false;
        return r[2] <= dtDay;
      });
    }
    if (extraFilters.categoria && extraFilters.categoria !== "Todas categorias") {
      out = out.filter(function(r) { return r[3] === extraFilters.categoria; });
    }
    if (extraFilters.diaFrom && extraFilters.diaFrom > 0) {
      out = out.filter(function(r) { return r[2] >= extraFilters.diaFrom; });
    }
    if (extraFilters.diaTo && extraFilters.diaTo > 0) {
      out = out.filter(function(r) { return r[2] <= extraFilters.diaTo; });
    }
  }
  return out;
}

// Sintetiza um BIT "flat" baseado no filtro escolhido (window.BIT_FILTER).
// Default: 'realizado' (PAGO).
function _makeBit(filter) {
  const seg = SEGMENTS[filter] || SEGMENTS.realizado;
  const K = seg.KPIS;
  const indicadores = {
    TOTAL_RECEITA: K.TOTAL_RECEITA,
    TOTAL_DESPESA: K.TOTAL_DESPESA,
    VALOR_LIQUIDO: K.VALOR_LIQUIDO,
    MARGEM_LIQUIDA: K.MARGEM_LIQUIDA,
    IMPOSTOS: 0,
    EBITDA: K.VALOR_LIQUIDO,
    RESULTADO_OPERACIONAL: K.VALOR_LIQUIDO,
    CAPEX: 0,
    MARGEM_CONTRIB: K.MARGEM_LIQUIDA,
    EBITDA_PCT: K.MARGEM_LIQUIDA,
    IMPOSTOS_PCT: 0,
  };
  return Object.assign({
    META, POSICAO_CAIXA, COMPOSICAO_DESPESA,
    MONTHS, MONTHS_FULL, fmt, fmtK, fmtPct,
    SEGMENTS,
    MONTH_DATA: seg.MONTH_DATA,
    RECEITA_CATEGORIAS: seg.RECEITA_CATEGORIAS,
    DESPESA_CATEGORIAS: seg.DESPESA_CATEGORIAS,
    RECEITA_CLIENTES: seg.RECEITA_CLIENTES,
    DESPESA_FORNECEDORES: seg.DESPESA_FORNECEDORES,
    EXTRATO: seg.EXTRATO,
    DIAS: Array.from({ length: 31 }, (_, i) => i + 1),
    RECEITA_DIA: seg.RECEITA_DIA,
    DESPESA_DIA: seg.DESPESA_DIA,
    SALDOS_MES: seg.SALDOS_MES,
    VALOR_LIQ_SERIES: K.VALOR_LIQ_SERIES,
    FLUXO_RECEITA: seg.FLUXO_RECEITA,
    FLUXO_DESPESA: seg.FLUXO_DESPESA,
    COMP_DATA: seg.COMP_DATA,
    RECDESP_AREA: seg.MONTH_DATA.map(m => ({ m: m.m.slice(0,3), receita: m.receita, despesa: m.despesa })),
  }, indicadores);
}

window.BIT = _makeBit(window.BIT_FILTER || 'realizado');
window._makeBit = _makeBit;
window.BIT_SEGMENTS = SEGMENTS;
window.BIT_META = META;
window.ALL_TX = ALL_TX;
window.REF_YEAR = REF_YEAR;
window.AVAILABLE_YEARS = AVAILABLE_YEARS;
window.aggregateTx = aggregateTx;
window.filterTx = filterTx;
// getBit: SEMPRE recomputa via recomputeBit (sem cache de window.BIT).
// Evita lag no toggle Previsto/Realizado e suporta year/month arbitrario.
// month: 0 = ano completo, 1-12 = mes especifico.
// regime: 'caixa' | 'competencia' (default 'caixa')
window.getBit = function (statusFilter, drilldown, year, month, regime, extraFilters) {
  const sf = statusFilter || window.BIT_FILTER || 'realizado';
  const y = year || window.REF_YEAR;
  let dd = drilldown;
  if (!dd && month && month >= 1 && month <= 12) {
    const mm = String(month).padStart(2, '0');
    const ym = y + '-' + mm;
    dd = { type: 'mes', value: ym, label: ym };
  }
  return window.recomputeBit(sf, dd, y, regime, extraFilters);
};
// Cross-filter helper: combina statusFilter + drilldown + regime e retorna BIT-like
// com KPIs/charts/extrato recalculados em ~10ms (17k rows).
window.recomputeBit = function (statusFilter, drilldown, year, regime, extraFilters) {
  const filtered = filterTx(ALL_TX, statusFilter, drilldown, regime || 'caixa', extraFilters);
  const agg = aggregateTx(filtered, year || REF_YEAR);
  // Mescla com BIT base pra preservar META, helpers (fmt, fmtK), MONTHS etc.
  const base = window.BIT || {};
  return Object.assign({}, base, agg, {
    TOTAL_RECEITA: agg.KPIS.TOTAL_RECEITA,
    TOTAL_DESPESA: agg.KPIS.TOTAL_DESPESA,
    VALOR_LIQUIDO: agg.KPIS.VALOR_LIQUIDO,
    MARGEM_LIQUIDA: agg.KPIS.MARGEM_LIQUIDA,
  });
};
window.BIT_ORCAMENTO = ${JSON.stringify(orcamento)};
`;

fs.writeFileSync(OUT_FILE, DATA_JS);
const stat = fs.statSync(OUT_FILE);
console.log(`\n=== OK ===`);
console.log(`  ${OUT_FILE} (${(stat.size / 1024).toFixed(1)} KB)`);
