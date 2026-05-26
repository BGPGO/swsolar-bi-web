#!/usr/bin/env node
/**
 * generate-report.cjs — gera report.json com analises IA por secao do BI.
 *
 * Roda offline (parte do START.bat ou manualmente). Le data.js num sandbox
 * pra capturar window.BIT_SEGMENTS, monta payloads contextualizados pra cada
 * uma das 6 secoes do BI, dispara 6 chamadas em paralelo pra Anthropic API
 * (claude-opus-4-7), depois faz uma 7a chamada de conclusao.
 *
 * Saida: report.json no diretorio do projeto. Carregado pelo PageRelatorio.
 *
 * Idempotencia: se report.json existe e foi gerado < 1h atras, pula.
 * Use --force pra ignorar o cache.
 *
 * V1: gera apenas pro segmento 'realizado'. V2 deve gerar pros 3 (multi-filter).
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = __dirname;
const ENV_FILE = path.join(ROOT, '.env');
const DATA_FILE = path.join(ROOT, 'data.js');
const FORCE = process.argv.includes('--force');
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h

// CLI flags: --year=N e --month=N. Sem flags -> ano corrente YTD (report.json).
function parseFlag(name) {
  const a = process.argv.find(x => x.startsWith(`--${name}=`));
  return a ? parseInt(a.split('=')[1], 10) : null;
}
const ARG_YEAR = parseFlag('year');
const ARG_MONTH = parseFlag('month');

// ---------- env loader simples (sem dotenv) ----------
function loadEnv() {
  if (!fs.existsSync(ENV_FILE)) {
    console.error('ERR: .env nao encontrado em', ENV_FILE);
    process.exit(1);
  }
  const raw = fs.readFileSync(ENV_FILE, 'utf8');
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    // strip quotes se tiver
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[m[1]] = v;
  }
  return env;
}

const env = loadEnv();
const API_KEY = env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error('ERR: ANTHROPIC_API_KEY nao encontrada no .env');
  process.exit(1);
}

// ---------- carregar data.js num sandbox ----------
if (!fs.existsSync(DATA_FILE)) {
  console.error('ERR: data.js nao encontrado. Rode `node build-data.cjs` antes.');
  process.exit(1);
}
const dataCode = fs.readFileSync(DATA_FILE, 'utf8');
const sandbox = { window: {}, console };
sandbox.window.BIT_FILTER = 'realizado';
vm.createContext(sandbox);
vm.runInContext(dataCode, sandbox);

const SEG = sandbox.window.BIT_SEGMENTS;
const META = sandbox.window.BIT_META;
const ALL_TX = sandbox.window.ALL_TX || [];
const REF_YEAR = sandbox.window.REF_YEAR || new Date().getFullYear();
if (!SEG || !SEG.realizado) {
  console.error('ERR: window.BIT_SEGMENTS nao foi populado. data.js corrupto?');
  process.exit(1);
}

// Decide o periodo target
const targetYear = ARG_YEAR || REF_YEAR;
const targetMonth = ARG_MONTH; // pode ser null

// Build segments filtrados por (year, month) a partir de ALL_TX
function filterByPeriod(txList, statusFilter) {
  let out = sandbox.window.filterTx(txList, statusFilter, null);
  if (targetMonth) {
    const ym = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
    out = out.filter(r => r[1] === ym);
  } else {
    out = out.filter(r => r[1] && r[1].startsWith(`${targetYear}-`));
  }
  return sandbox.window.aggregateTx(out, targetYear);
}

const realizado = filterByPeriod(ALL_TX, 'realizado');
const aPagarReceber = filterByPeriod(ALL_TX, 'a_pagar_receber');
const tudo = filterByPeriod(ALL_TX, 'tudo');

const empresaNome = (META && META.empresa && META.empresa.nome_fantasia) || 'Cliente';
const refYear = targetYear;

// Periodo legivel + nome do arquivo de saida
const MONTH_NAMES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
let periodo, OUT_FILE;
if (targetMonth) {
  periodo = `${MONTH_NAMES_PT[targetMonth - 1]}/${targetYear}`;
  OUT_FILE = path.join(ROOT, `report-${targetYear}-${String(targetMonth).padStart(2,'0')}.json`);
} else if (targetYear === REF_YEAR && !ARG_YEAR) {
  // Sem flags -> YTD do ano corrente -> nome default report.json (compat)
  periodo = `Ano ${targetYear} (YTD)`;
  OUT_FILE = path.join(ROOT, 'report.json');
} else {
  periodo = `Ano ${targetYear}`;
  OUT_FILE = path.join(ROOT, `report-${targetYear}.json`);
}

// ---------- check cache (so se nao for --force) ----------
if (!FORCE && fs.existsSync(OUT_FILE)) {
  const stat = fs.statSync(OUT_FILE);
  const age = Date.now() - stat.mtimeMs;
  if (age < CACHE_TTL_MS) {
    const ageMin = Math.round(age / 60000);
    console.log(`${path.basename(OUT_FILE)} ja existe (gerado ha ${ageMin}min, < 1h). Pulando. Use --force pra regenerar.`);
    process.exit(0);
  }
}

// ---------- helpers de formatacao pros prompts ----------
function fmtBR(n) {
  if (n == null || isNaN(n)) return 'R$ 0,00';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return `${sign}R$ ${abs.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '.').replace('.', '#').replace(/\./g, ',').replace('#', ',')}`
    .replace(/,(\d{2})$/, ',$1'); // crude — basta pra LLM ler
}

// versao mais simples e segura
function fmt(n) {
  if (n == null || isNaN(n)) return 'R$ 0,00';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const parts = abs.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}R$ ${parts[0]},${parts[1]}`;
}

function pct(n) {
  if (n == null || isNaN(n)) return '0,00%';
  return `${n.toFixed(2).replace('.', ',')}%`;
}

// ---------- montar payloads por secao ----------
function payloadVisaoGeral() {
  const k = realizado.KPIS;
  const md = realizado.MONTH_DATA || [];
  const linhas = md.map(m => `${m.m}: receita=${fmt(m.receita)}, despesa=${fmt(m.despesa)}, liquido=${fmt(m.receita - m.despesa)}`).join('\n');
  return `## Visao Geral - ${empresaNome} - ${periodo} (Realizado)

KPIs principais:
- Receita total: ${fmt(k.TOTAL_RECEITA)}
- Despesa total: ${fmt(k.TOTAL_DESPESA)}
- Valor liquido: ${fmt(k.VALOR_LIQUIDO)}
- Margem liquida: ${pct(k.MARGEM_LIQUIDA)}

Pendencias (a pagar/receber):
- A receber: ${fmt(aPagarReceber.KPIS.TOTAL_RECEITA || 0)}
- A pagar: ${fmt(aPagarReceber.KPIS.TOTAL_DESPESA || 0)}

Movimentacao mes a mes (realizado):
${linhas}

Top 5 categorias de receita:
${(realizado.RECEITA_CATEGORIAS || []).slice(0, 5).map(c => `- ${c.name}: ${fmt(c.value)}`).join('\n')}

Top 5 categorias de despesa:
${(realizado.DESPESA_CATEGORIAS || []).slice(0, 5).map(c => `- ${c.name}: ${fmt(c.value)}`).join('\n')}`;
}

function payloadReceita() {
  const k = realizado.KPIS;
  const cats = realizado.RECEITA_CATEGORIAS || [];
  const clientes = realizado.RECEITA_CLIENTES || [];
  const md = realizado.MONTH_DATA || [];
  const totalCats = cats.reduce((s, c) => s + c.value, 0);
  return `## Receita - ${empresaNome} - ${periodo} (Realizado)

Receita total realizada: ${fmt(k.TOTAL_RECEITA)}
Receita ainda a receber: ${fmt(aPagarReceber.KPIS.TOTAL_RECEITA || 0)}

Receita mes a mes:
${md.map(m => `- ${m.m}: ${fmt(m.receita)}`).join('\n')}

Top 10 categorias de receita (pct sobre total das top categorias):
${cats.slice(0, 10).map(c => `- ${c.name}: ${fmt(c.value)} (${totalCats ? pct((c.value / totalCats) * 100) : '0%'})`).join('\n')}

Top 10 clientes:
${clientes.slice(0, 10).map(c => `- ${c.name}: ${fmt(c.value)}`).join('\n')}`;
}

function payloadDespesa() {
  const k = realizado.KPIS;
  const cats = realizado.DESPESA_CATEGORIAS || [];
  const fornec = realizado.DESPESA_FORNECEDORES || [];
  const md = realizado.MONTH_DATA || [];
  const totalCats = cats.reduce((s, c) => s + c.value, 0);
  return `## Despesa - ${empresaNome} - ${periodo} (Realizado)

Despesa total realizada: ${fmt(k.TOTAL_DESPESA)}
Despesa ainda a pagar: ${fmt(aPagarReceber.KPIS.TOTAL_DESPESA || 0)}

Despesa mes a mes:
${md.map(m => `- ${m.m}: ${fmt(m.despesa)}`).join('\n')}

Top 10 categorias de despesa:
${cats.slice(0, 10).map(c => `- ${c.name}: ${fmt(c.value)} (${totalCats ? pct((c.value / totalCats) * 100) : '0%'})`).join('\n')}

Top 10 fornecedores:
${fornec.slice(0, 10).map(c => `- ${c.name}: ${fmt(c.value)}`).join('\n')}`;
}

function payloadFluxoCaixa() {
  const k = realizado.KPIS;
  const saldos = realizado.SALDOS_MES || [];
  const md = realizado.MONTH_DATA || [];
  const liqSeries = (k.VALOR_LIQ_SERIES || []).slice(0, 12);
  return `## Fluxo de Caixa - ${empresaNome} - ${periodo} (Realizado)

Receita total: ${fmt(k.TOTAL_RECEITA)}
Despesa total: ${fmt(k.TOTAL_DESPESA)}
Valor liquido: ${fmt(k.VALOR_LIQUIDO)}
Margem liquida: ${pct(k.MARGEM_LIQUIDA)}

Valor liquido por mes:
${md.map((m, i) => `- ${m.m}: ${fmt(liqSeries[i] || 0)}`).join('\n')}

Saldo acumulado por mes:
${md.map((m, i) => `- ${m.m}: ${fmt(saldos[i] || 0)}`).join('\n')}`;
}

function payloadTesouraria() {
  const recebido = realizado.KPIS.TOTAL_RECEITA;
  const pago = realizado.KPIS.TOTAL_DESPESA;
  const aReceber = aPagarReceber.KPIS.TOTAL_RECEITA || 0;
  const aPagar = aPagarReceber.KPIS.TOTAL_DESPESA || 0;
  const saldosMes = (tudo.SALDOS_MES || realizado.SALDOS_MES || []);
  const sMax = saldosMes.length ? Math.max(...saldosMes) : 0;
  const sMin = saldosMes.length ? Math.min(...saldosMes) : 0;
  const sMed = saldosMes.length ? saldosMes.reduce((s, v) => s + v, 0) / saldosMes.length : 0;
  const md = realizado.MONTH_DATA || [];
  return `## Tesouraria - ${empresaNome} - ${periodo}

Posicao de caixa:
- Recebido (PAGO): ${fmt(recebido)}
- A receber: ${fmt(aReceber)}
- Pago: ${fmt(pago)}
- A pagar: ${fmt(aPagar)}

Saldos mensais (acumulado, considerando pagos+pendentes):
- Saldo maximo: ${fmt(sMax)}
- Saldo minimo: ${fmt(sMin)}
- Saldo medio: ${fmt(sMed)}

Saldo acumulado por mes:
${md.map((m, i) => `- ${m.m}: ${fmt(saldosMes[i] || 0)}`).join('\n')}

Diferenca entre a receber (${fmt(aReceber)}) e a pagar (${fmt(aPagar)}): ${fmt(aReceber - aPagar)}`;
}

function payloadComparativo() {
  const compData = realizado.COMP_DATA || [];
  const recHeader = compData.find(r => r.tipo === 'Receita') || { d1: 0, d2: 0 };
  const despHeader = compData.find(r => r.tipo === 'Despesa') || { d1: 0, d2: 0 };
  const liq1 = recHeader.d1 + despHeader.d1;
  const liq2 = recHeader.d2 + despHeader.d2;
  const diffRec = recHeader.d2 - recHeader.d1;
  const diffDesp = despHeader.d2 - despHeader.d1;
  const diffLiq = liq2 - liq1;
  const safePct = (a, b) => b !== 0 ? (a / b) * 100 : 0;
  return `## Comparativo - ${empresaNome} - ${periodo}

Trimestre 1 (jan-mar) vs Trimestre 2 (abr-jun) do ano ${refYear}:

Receita:
- Trim 1: ${fmt(recHeader.d1)}
- Trim 2: ${fmt(recHeader.d2)}
- Diferenca: ${fmt(diffRec)} (${pct(safePct(diffRec, recHeader.d1))})

Despesa (valores negativos sao saidas):
- Trim 1: ${fmt(despHeader.d1)}
- Trim 2: ${fmt(despHeader.d2)}
- Diferenca: ${fmt(diffDesp)} (${pct(safePct(diffDesp, Math.abs(despHeader.d1)))})

Valor liquido:
- Trim 1: ${fmt(liq1)}
- Trim 2: ${fmt(liq2)}
- Diferenca: ${fmt(diffLiq)} (${pct(safePct(diffLiq, Math.abs(liq1) || 1))})`;
}

// ---------- prompts ----------
const SYSTEM_SECAO = `Voce e um analista financeiro senior da BGP Consultoria Financeira. Cliente: ${empresaNome}. Sua tarefa e analisar dados financeiros e escrever uma analise executiva objetiva de UMA secao do relatorio.

Regras:
- Escreva 2 paragrafos bem estruturados separados por uma linha em branco
- Primeiro paragrafo: performance geral do periodo, principais movimentacoes, valores especificos
- Segundo paragrafo: pontos de atencao, riscos ou oportunidades identificados
- Linguagem profissional e direta. Sem markdown, sem bullets, sem **negrito** - so texto corrido
- Portugues brasileiro
- Seja especifico sobre os numeros mais relevantes (top categorias, evolucoes mes a mes)`;

const SYSTEM_CONCLUSAO = `Voce e um analista financeiro senior da BGP Consultoria Financeira. Cliente: ${empresaNome}. Voce recebeu analises individuais de cada secao do relatorio. Escreva uma conclusao executiva sintetizando a situacao geral mais 2-3 recomendacoes estrategicas breves.

Regras:
- 2 paragrafos separados por linha em branco
- Primeiro: sintese da situacao geral (pontos criticos positivos e negativos)
- Segundo: 2-3 recomendacoes estrategicas acionaveis
- Texto corrido, sem markdown
- Portugues brasileiro`;

// ---------- chamada Anthropic ----------
async function callAnthropic(systemPrompt, userMessage, label) {
  const body = {
    model: 'claude-opus-4-7',
    max_tokens: 1024,
    temperature: 0.2,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  };
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`  [${label}] HTTP ${resp.status}: ${errText.slice(0, 200)}`);
      return { ok: false, error: `HTTP ${resp.status}`, text: '' };
    }
    const json = await resp.json();
    const blocks = json.content || [];
    const textBlock = blocks.find(b => b.type === 'text');
    const text = textBlock ? textBlock.text.trim() : '';
    if (!text) {
      console.error(`  [${label}] resposta vazia`);
      return { ok: false, error: 'empty', text: '' };
    }
    console.log(`  [${label}] OK (${text.length} chars)`);
    return { ok: true, error: null, text };
  } catch (e) {
    console.error(`  [${label}] excecao: ${e.message}`);
    return { ok: false, error: e.message, text: '' };
  }
}

// ---------- pipeline ----------
const SECOES = [
  { id: 'visao_geral', title: 'Visão Geral', payload: payloadVisaoGeral },
  { id: 'receita', title: 'Receita', payload: payloadReceita },
  { id: 'despesa', title: 'Despesa', payload: payloadDespesa },
  { id: 'fluxo_caixa', title: 'Fluxo de Caixa', payload: payloadFluxoCaixa },
  { id: 'tesouraria', title: 'Tesouraria', payload: payloadTesouraria },
  { id: 'comparativo', title: 'Comparativo', payload: payloadComparativo },
];

(async () => {
  console.log(`=== Gerando relatorio IA para ${empresaNome} (${periodo}) ===`);
  console.log(`Disparando ${SECOES.length} chamadas em paralelo...`);

  // 6 chamadas paralelas
  const results = await Promise.all(SECOES.map(s => {
    const userMsg = `Analise os seguintes dados financeiros e escreva uma analise executiva da secao "${s.title}":\n\n${s.payload()}`;
    return callAnthropic(SYSTEM_SECAO, userMsg, s.id);
  }));

  const secoes = {};
  let textosConcatenados = '';
  SECOES.forEach((s, i) => {
    const r = results[i];
    secoes[s.id] = {
      title: s.title,
      analysis: r.ok ? r.text : '',
      error: r.ok ? null : r.error,
    };
    if (r.ok) {
      textosConcatenados += `\n\n## ${s.title}\n\n${r.text}`;
    }
  });

  // 7a chamada: conclusao
  console.log('Disparando conclusao final...');
  let conclusao = '';
  if (textosConcatenados.trim()) {
    const concResult = await callAnthropic(
      SYSTEM_CONCLUSAO,
      `Com base nas analises abaixo de cada secao do relatorio financeiro, escreva uma conclusao executiva e recomendacoes estrategicas:\n${textosConcatenados}`,
      'conclusao'
    );
    conclusao = concResult.ok ? concResult.text : '';
  } else {
    console.warn('  todas as secoes falharam - pulando conclusao');
  }

  // ---------- escrever output ----------
  const out = {
    generated_at: new Date().toISOString(),
    empresa: empresaNome,
    periodo,
    year: targetYear,
    month: targetMonth || null,
    filter: 'realizado',
    secoes,
    conclusao,
  };
  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2), 'utf8');
  console.log(`\n=== OK ===`);
  console.log(`  ${OUT_FILE} (${(fs.statSync(OUT_FILE).size / 1024).toFixed(1)} KB)`);
  const okCount = Object.values(secoes).filter(s => s.analysis).length;
  console.log(`  ${okCount}/${SECOES.length} secoes geradas + conclusao ${conclusao ? 'OK' : 'FALHOU'}`);
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
