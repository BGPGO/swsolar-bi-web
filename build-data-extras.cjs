#!/usr/bin/env node
/**
 * build-data-extras.cjs — agrega XLSX adicionais (Curva ABC, Faturamento, ADS, CRM, Saldos)
 * em data-extras.js (window.BIT_EXTRAS).
 *
 * Lê paths do bi.config.js (fontes.drive.base_path) — não hardcode.
 *
 * Saida:
 *  - data/extras.json  (compactos)
 *  - data-extras.js    (inline pro browser)
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const XLSX = require('xlsx');

// Lê config do cliente
let cfg;
try { cfg = require('./bi.config.js'); }
catch (e) { console.error('ERRO: bi.config.js não encontrado. Rode `node bgp-bi.cjs init`.'); process.exit(1); }

const FONTES_CFG = cfg.fontes || {};
const HAS_FIN40 = Array.isArray(FONTES_CFG.adapters) && FONTES_CFG.adapters.includes('fin40');
const DRIVE = (FONTES_CFG.drive && FONTES_CFG.drive.base_path) || '';
const DATA_DIR = path.join(__dirname, 'data');
const OUT = path.join(DATA_DIR, 'extras.json');

// Quando cliente é fin40-only, não precisa de Drive. Branch XLSX é skipped.
if (!DRIVE && !HAS_FIN40) {
  console.error('ERRO: fontes.drive.base_path não definido em bi.config.js (e adapter fin40 não está em uso)');
  process.exit(1);
}
const XLSX_BRANCH_ENABLED = !!DRIVE && fs.existsSync(DRIVE);
if (DRIVE && !XLSX_BRANCH_ENABLED) {
  console.warn(`  [warn] Drive não acessível (${DRIVE}) — pulando branch XLSX`);
}

// ============================================================
// Branch fin40 — cascata DRE a partir das RPCs oficiais
// ============================================================
function buildFin40Cascade() {
  console.log('=== fin40 DRE Cascade ===');
  const fluxoPath = path.join(DATA_DIR, 'fluxo_caixa_rpc.json');
  const gruposPath = path.join(DATA_DIR, 'grupos_plano_contas.json');
  const deParaPath = path.join(DATA_DIR, 'de_para.json');
  const orcadoPath = path.join(DATA_DIR, 'orcado_realizado_rpc.json');

  if (!fs.existsSync(fluxoPath) || !fs.existsSync(gruposPath)) {
    console.warn('  [warn] fluxo_caixa_rpc.json ou grupos_plano_contas.json ausente — rode `node fetch-data.cjs` primeiro');
    return null;
  }

  const fluxoRpc = JSON.parse(fs.readFileSync(fluxoPath, 'utf8'));
  const grupos = JSON.parse(fs.readFileSync(gruposPath, 'utf8'));
  const dePara = fs.existsSync(deParaPath) ? JSON.parse(fs.readFileSync(deParaPath, 'utf8')) : [];
  const orcadoRpc = fs.existsSync(orcadoPath) ? JSON.parse(fs.readFileSync(orcadoPath, 'utf8')) : [];

  // Índice grupo (lowercase) → meta
  const gruposIdx = new Map();
  for (const g of grupos) gruposIdx.set((g.nome || '').toLowerCase(), g);

  // DRE_SECOES canonical (mesmo do fin40/src/types/financial.ts)
  const DRE_SECOES = [
    { key: 'receitas',        subtotalKey: 'receita_total',         subtotalLabel: 'Receita Total' },
    { key: 'custos',          subtotalKey: 'lucro_bruto',           subtotalLabel: 'Lucro Bruto' },
    { key: 'despesas',        subtotalKey: 'ebitda',                subtotalLabel: 'EBITDA' },
    { key: 'impostos',        subtotalKey: 'resultado_operacional', subtotalLabel: 'Resultado Operacional' },
    { key: 'pos_operacional', subtotalKey: 'geracao_caixa',         subtotalLabel: 'Geração de Caixa' },
  ];

  // Agrega RPC por (mes, secao, grupo, categoria).
  // RPC retorna { mes, grupo, categoria, total_entrada, total_saida }.
  // Valor líquido por linha = total_entrada - total_saida.
  const byMes = new Map();
  for (const row of fluxoRpc) {
    const mes = row.mes;
    const grupoNome = row.grupo || '⚠️ Sem Grupo';
    const grupoMeta = gruposIdx.get(grupoNome.toLowerCase());
    const secao = grupoMeta?.secao || null;
    if (!secao) continue; // skip sem-secao (geralmente ⚠️ Sem Grupo)
    const valor = (Number(row.total_entrada) || 0) - (Number(row.total_saida) || 0);

    if (!byMes.has(mes)) {
      byMes.set(mes, { mes, por_secao: {}, por_grupo: {}, por_categoria: {} });
      for (const s of DRE_SECOES) byMes.get(mes).por_secao[s.key] = 0;
    }
    const m = byMes.get(mes);
    m.por_secao[secao] += valor;

    if (!m.por_grupo[grupoNome]) m.por_grupo[grupoNome] = { nome: grupoNome, secao, ordem: grupoMeta?.ordem || 9999, valor: 0, categorias: {} };
    m.por_grupo[grupoNome].valor += valor;

    const catKey = `${grupoNome}::${row.categoria || ''}`;
    if (!m.por_categoria[catKey]) m.por_categoria[catKey] = { grupo: grupoNome, categoria: row.categoria || '', secao, valor: 0 };
    m.por_categoria[catKey].valor += valor;
    if (!m.por_grupo[grupoNome].categorias[row.categoria || '']) {
      m.por_grupo[grupoNome].categorias[row.categoria || ''] = 0;
    }
    m.por_grupo[grupoNome].categorias[row.categoria || ''] += valor;
  }

  // Cascata por mês
  const por_mes = [];
  for (const [mes, m] of [...byMes.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const s = m.por_secao;
    const cascata = {
      receita_total: s.receitas,
      lucro_bruto: s.receitas + s.custos,
      ebitda: s.receitas + s.custos + s.despesas,
      resultado_operacional: s.receitas + s.custos + s.despesas + s.impostos,
      geracao_caixa: s.receitas + s.custos + s.despesas + s.impostos + s.pos_operacional,
    };
    por_mes.push({
      mes,
      por_secao: m.por_secao,
      cascata,
      grupos: Object.values(m.por_grupo).sort((a, b) => a.ordem - b.ordem),
    });
  }

  // Orçado vs Realizado por mês/categoria
  const orcado_por_mes = {};
  for (const r of orcadoRpc) {
    if (!orcado_por_mes[r.mes]) orcado_por_mes[r.mes] = [];
    orcado_por_mes[r.mes].push({
      categoria: r.categoria,
      grupo: r.grupo,
      realizado: Number(r.realizado) || 0,
      orcado: Number(r.orcado) || 0,
      variacao: Number(r.variacao) || 0,
      variacao_pct: Number(r.variacao_pct) || 0,
    });
  }

  console.log(`  meses: ${por_mes.length} | grupos distintos: ${[...new Set(fluxoRpc.map(r => r.grupo))].length}`);
  if (por_mes.length > 0) {
    const ultMes = por_mes[por_mes.length - 1];
    console.log(`  último mês (${ultMes.mes}): receita=${ultMes.cascata.receita_total.toFixed(0)} ebitda=${ultMes.cascata.ebitda.toFixed(0)} geracao=${ultMes.cascata.geracao_caixa.toFixed(0)}`);
  }

  return {
    secoes: DRE_SECOES,
    por_mes,
    orcado_por_mes,
    de_para_count: dePara.length,
    grupos_count: grupos.length,
  };
}

// Se branch XLSX desabilitada, gera só fin40 e termina.
if (!XLSX_BRANCH_ENABLED) {
  const dre = HAS_FIN40 ? buildFin40Cascade() : null;
  const out = {
    fetched_at: new Date().toISOString(),
    dre, // fin40 cascade
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  const js = '/* BI EXTRAS — gerado por build-data-extras.cjs (branch fin40-only). */\n' +
    'window.BIT_EXTRAS = ' + JSON.stringify(out) + ';\n';
  fs.writeFileSync(path.join(__dirname, 'data-extras.js'), js);
  console.log(`\n=== OK (fin40-only) ===`);
  console.log(`  ${OUT}`);
  console.log(`  ${path.join(__dirname, 'data-extras.js')}`);
  process.exit(0);
}

function readSheet(file, sheetName) {
  const wb = XLSX.readFile(path.join(DRIVE, file));
  const sn = sheetName || wb.SheetNames[0];
  return XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: '' });
}

function num(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

// Excel serial date -> dd/mm/yyyy + month
function excelToDate(serial) {
  if (typeof serial !== 'number' || serial < 1000) return null;
  // Excel epoch: 1900-01-01 (mas com bug do dia 60). serial 45667 ~= 2025-01-08
  const ms = (serial - 25569) * 86400 * 1000;
  return new Date(ms);
}

console.log('=== Curva ABC ===');
const abcRaw = readSheet('CurvaABCPRodutos.xlsx');
// XLSX traz a coluna ABC mas a classificação está embaralhada (A único, ordem inconsistente).
// Recalculamos do zero: sort por valor faturado desc, classifica pela regra 80/15/5
// (A = primeiros 80% da receita acumulada, B = 80-95%, C = 95-100%).
const abcSrc = abcRaw.map(r => ({
  codigo: r['Código do Produto'] || '',
  descricao: (r['Descrição do Produto'] || '').toString().trim(),
  marca: r['Marca'] || '',
  familia: r['Família de Produto'] || 'Sem Família',
  unidade: r['Unidade'] || '',
  valorFaturado: num(r['Valor Faturado']),
  qtdFaturada: num(r['Quantidade Faturada']),
})).filter(x => x.descricao && x.valorFaturado > 0)
  .sort((a, b) => b.valorFaturado - a.valorFaturado);
const abcTotal = abcSrc.reduce((s, x) => s + x.valorFaturado, 0);
let abcAcum = 0;
const abc = abcSrc.map((p, i) => {
  abcAcum += p.valorFaturado;
  const pctAcumulado = abcTotal > 0 ? (abcAcum / abcTotal) * 100 : 0;
  const pctValor = abcTotal > 0 ? (p.valorFaturado / abcTotal) * 100 : 0;
  let abcClass;
  if (pctAcumulado <= 80) abcClass = 'A';
  else if (pctAcumulado <= 95) abcClass = 'B';
  else abcClass = 'C';
  return {
    ...p,
    abc: abcClass,
    pctValor,
    valorAcumulado: abcAcum,
    pctAcumulado,
    ordem: i + 1,
  };
});
console.log('  ', abc.length, 'produtos · total R$', abcTotal.toFixed(2));
const abcCount = { A: 0, B: 0, C: 0 };
abc.forEach(p => abcCount[p.abc]++);
console.log('  classes (regra 80/15/5):', abcCount);

console.log('\n=== Faturamento por Produto ===');
const fatRawAll = readSheet('FaturamentoPorProduto.xlsx');
// Filtro: só PEDIDO autorizado conta como faturamento (igual ao PBI).
// Remessa de Produto e Devolucoes são etapas/contramovimentos da mesma venda.
const fatRaw = fatRawAll.filter(r => r['Operação'] === 'PEDIDO' && r['Situação'] === 'Autorizado');
console.log('  filtro PEDIDO + Autorizado: ' + fatRaw.length + ' de ' + fatRawAll.length + ' rows');
// linhas de NF, cada linha = 1 item de NF
const fatItems = fatRaw.map(r => {
  const dEm = excelToDate(num(r['Data de Emissão']));
  return {
    operacao: r['Operação'] || '',
    situacao: r['Situação'] || '',
    nf: r['Nota Fiscal'] || '',
    dataEmissao: dEm ? `${String(dEm.getDate()).padStart(2,'0')}/${String(dEm.getMonth()+1).padStart(2,'0')}/${dEm.getFullYear()}` : '',
    mes: dEm ? dEm.getMonth() : null,
    ano: dEm ? dEm.getFullYear() : null,
    cliente: r['Cliente (Razão Social)'] || r['Cliente (Nome Fantasia)'] || r['Cliente'] || '',
    produto: r['Descrição do Produto'] || r['Produto'] || '',
    familia: r['Família de Produto'] || 'Sem Família',
    vendedor: r['Vendedor'] || 'Sem Vendedor',
    qtd: num(r['Quantidade']),
    valor: num(r['Total de Mercadoria']),
  };
}).filter(x => x.valor > 0); // ignora linhas zero
console.log('  itens com valor > 0:', fatItems.length);

// agregacoes
function aggBy(items, keyFn, valueFn = (x) => x.valor) {
  const map = new Map();
  for (const it of items) {
    const k = keyFn(it) || 'Sem categoria';
    if (!map.has(k)) map.set(k, { name: k, value: 0, qtd: 0 });
    const o = map.get(k);
    o.value += valueFn(it);
    o.qtd += it.qtd || 0;
  }
  return Array.from(map.values()).sort((a, b) => b.value - a.value);
}

// Ano de referência = ano max nos dados (último ano com faturamento)
const anoRef = (() => {
  const ys = fatItems.map(x => x.ano).filter(Boolean);
  return ys.length ? Math.max(...ys) : new Date().getFullYear();
})();
// CORREÇÃO: PBI mostra só o ano de referência. Antes, totais/agg somavam TODOS
// os anos do XLSX (2025+2026 = R$ 9M). Agora restringimos ao ano corrente (R$ 3.5M).
const fatItemsAno = fatItems.filter(x => x.ano === anoRef);
console.log('  itens 2025+2026: ' + fatItems.length + ' | apenas ' + anoRef + ': ' + fatItemsAno.length);

const fatPorFamilia = aggBy(fatItemsAno, x => x.familia).slice(0, 20);
const fatPorVendedor = aggBy(fatItemsAno, x => x.vendedor).slice(0, 20);
const fatPorCliente = aggBy(fatItemsAno, x => x.cliente).slice(0, 15);

const fatPorMes = Array(12).fill(0).map((_, i) => ({
  m: ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][i],
  valor: 0,
  qtd: 0,
}));
for (const it of fatItemsAno) {
  if (it.mes == null) continue;
  fatPorMes[it.mes].valor += it.valor;
  fatPorMes[it.mes].qtd += it.qtd;
}

const fatTotais = {
  totalValor: fatItemsAno.reduce((s, x) => s + x.valor, 0),
  totalQtd: fatItemsAno.reduce((s, x) => s + x.qtd, 0),
  numItens: fatItemsAno.length,
  numNFs: new Set(fatItemsAno.map(x => x.nf).filter(Boolean)).size,
  numClientes: new Set(fatItemsAno.map(x => x.cliente).filter(Boolean)).size,
  numProdutos: new Set(fatItemsAno.map(x => x.produto).filter(Boolean)).size,
  anoRef,
};
fatTotais.ticketMedio = fatTotais.numNFs > 0 ? fatTotais.totalValor / fatTotais.numNFs : 0;
console.log('  ' + anoRef + ': R$ ' + fatTotais.totalValor.toFixed(2) + ' | NFs: ' + fatTotais.numNFs + ' | ticketMedio: ' + fatTotais.ticketMedio.toFixed(2));

// detalhamento familia x produto (top 100 do ano)
const fatDetalhado = aggBy(fatItemsAno, x => x.familia + ' ▸ ' + x.produto).slice(0, 100);

// matriz REAL produto x mes (top 12 produtos do ano de referência)
const fatProdutoMes = (function() {
  const map = new Map();
  for (const it of fatItemsAno) {
    if (it.mes == null) continue;
    if (!map.has(it.produto)) map.set(it.produto, { nome: it.produto, total: 0, meses: Array(12).fill(0) });
    const o = map.get(it.produto);
    o.total += it.valor;
    o.meses[it.mes] += it.valor;
  }
  return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 12);
})();

console.log('\n=== Marketing ADS ===');
const adsRaw = readSheet('MarketingADS.xlsx', 'Formatted Report');
const ads = adsRaw.map(r => ({
  campanha: r['Nome da campanha'] || '',
  conjunto: r['Nome do conjunto de anúncios'] || '',
  anuncio: r['Nome do anúncio'] || '',
  status: r['Status de veiculação'] || '',
  alcance: num(r['Alcance']),
  impressoes: num(r['Impressões']),
  frequencia: num(r['Frequência']),
  resultados: num(r['Resultados']),
  custoPorResultado: num(r['Custo por resultado']),
  valorBRL: num(r['Valor usado (BRL)']),
  cpm: num(r['CPM (custo por 1.000 impressões)']),
  cliques: num(r['Cliques no link']),
  cpc: num(r['CPC (custo por clique no link)']),
  ctr: num(r['CTR (taxa de cliques no link)']),
  leads: num(r['Leads (formulário)']),
  cliquesTodos: num(r['Cliques (todos)']),
})).filter(x => x.campanha || x.valorBRL > 0);

const adsTotais = {
  gastoTotal: ads.reduce((s, x) => s + x.valorBRL, 0),
  alcanceTotal: ads.reduce((s, x) => s + x.alcance, 0),
  impressoesTotal: ads.reduce((s, x) => s + x.impressoes, 0),
  cliquesTotal: ads.reduce((s, x) => s + x.cliques, 0),
  resultadosTotal: ads.reduce((s, x) => s + x.resultados, 0),
  numCampanhas: new Set(ads.map(x => x.campanha).filter(Boolean)).size,
};
adsTotais.ctrMedio = adsTotais.impressoesTotal > 0 ? (adsTotais.cliquesTotal / adsTotais.impressoesTotal) * 100 : 0;
adsTotais.cpmMedio = adsTotais.impressoesTotal > 0 ? (adsTotais.gastoTotal / adsTotais.impressoesTotal) * 1000 : 0;
adsTotais.cpcMedio = adsTotais.cliquesTotal > 0 ? adsTotais.gastoTotal / adsTotais.cliquesTotal : 0;
console.log('  campanhas:', adsTotais.numCampanhas, '| gasto: R$', adsTotais.gastoTotal.toFixed(2), '| CTR:', adsTotais.ctrMedio.toFixed(2), '%');

// agg por campanha (alguns rows tem o mesmo nome em niveis diferentes)
function aggCampanha(items) {
  const map = new Map();
  for (const it of items) {
    if (!it.campanha) continue;
    const k = it.campanha;
    if (!map.has(k)) map.set(k, { campanha: k, valorBRL: 0, alcance: 0, impressoes: 0, cliques: 0, resultados: 0, leads: 0 });
    const o = map.get(k);
    o.valorBRL += it.valorBRL;
    o.alcance = Math.max(o.alcance, it.alcance);
    o.impressoes += it.impressoes;
    o.cliques += it.cliques;
    o.resultados += it.resultados;
    o.leads += it.leads;
  }
  for (const o of map.values()) {
    o.cpm = o.impressoes > 0 ? (o.valorBRL / o.impressoes) * 1000 : 0;
    o.cpc = o.cliques > 0 ? o.valorBRL / o.cliques : 0;
    o.ctr = o.impressoes > 0 ? (o.cliques / o.impressoes) * 100 : 0;
  }
  return Array.from(map.values()).sort((a, b) => b.valorBRL - a.valorBRL);
}
const adsCampanhasAgg = aggCampanha(ads);

const dreCascade = HAS_FIN40 ? buildFin40Cascade() : null;

const out = {
  fetched_at: new Date().toISOString(),
  dre: dreCascade, // cascata DRE fin40 (null se cliente não tem fin40)
  abc: {
    rows: abc,
    counts: abcCount,
    total: abc.length,
  },
  faturamento: {
    porFamilia: fatPorFamilia,
    porVendedor: fatPorVendedor,
    porCliente: fatPorCliente,
    porMes: fatPorMes,
    detalhado: fatDetalhado,
    produtoMes: fatProdutoMes,
    totais: fatTotais,
    items: fatItemsAno, // raw items do ano (pra filtros reativos no client)
  },
  ads: {
    rows: ads,
    campanhasAgg: adsCampanhasAgg,
    totais: adsTotais,
  },
  crm: (function() {
    try {
      const wb = XLSX.readFile(path.join(DRIVE, 'consolidado (33).xlsx'));
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });

      // Normaliza fase: "06 Conclusão" → "Conclusão" (mas mantemos a chave do funil)
      const cleanStr = (s) => (s == null ? '' : String(s).trim());
      const ND = (s) => (!s || s === 'N/D' ? '' : s);

      const rowsAll = raw.map(r => {
        const sit = cleanStr(r['Situação']);
        // Conquistado em DD/MM/YYYY = ganho. Motivo presente + Fase 06 = perdido. Senao em andamento.
        const ganho = /^Conquistado/i.test(sit);
        const motivo = ND(cleanStr(r['Motivo de Conclusão']));
        const fase = cleanStr(r['Fase Atual']);
        // Perdido: tem motivo (≠N/D) e nao é Conquistado
        const perdido = !ganho && motivo && motivo !== 'Oportunidade nunca existiu';
        const aberto = !ganho && !perdido;
        const dataAtual = excelToDate(num(r['Data de atualização (completa)']));
        const dataIncl = excelToDate(num(r['Data de inclusão (completa)']));
        const dataConcl = excelToDate(num(r['Data de 06 Conclusão(completa)']));
        const dataRef = ganho && dataConcl ? dataConcl : (dataAtual || dataIncl);
        return {
          descricao: cleanStr(r['Descrição da Oportunidade']),
          fase,
          situacao: sit,
          ganho, perdido, aberto,
          motivo,
          vendedor: cleanStr(r['Vendedor']) || 'Sem Vendedor',
          origem: cleanStr(r['Origem']) || 'Sem Origem',
          tipo: cleanStr(r['Tipo']),
          produto: cleanStr(r['Solução']) || cleanStr(r['Produto']) || '',
          conta: cleanStr(r['Conta']),
          ticket: num(r['Ticket']),
          produtos: num(r['Produtos']),
          servicos: num(r['Serviços']),
          recorrencia: num(r['Recorrência']),
          temperatura: num(r['Temperatura']),
          anoPrev: num(r['Ano previsão']),
          mesPrev: cleanStr(r['Mês previsão']),
          dataIncl: dataIncl ? dataIncl.toISOString().slice(0,10) : null,
          dataAtual: dataAtual ? dataAtual.toISOString().slice(0,10) : null,
          dataConcl: dataConcl ? dataConcl.toISOString().slice(0,10) : null,
          dataRef: dataRef ? dataRef.toISOString().slice(0,10) : null,
          ano: dataRef ? dataRef.getFullYear() : null,
          mes: dataRef ? dataRef.getMonth() : null,
          tempoCiclo: num(r['Tempo de ciclo']),
        };
      }).filter(x => x.descricao);

      // Filtro: excluir Prospect e Qualificação (fases muito iniciais
      // que o PBI da empresa não considera no pipeline ativo).
      const rows = rowsAll.filter(r => r.fase !== '01 Prospect' && r.fase !== '02 Qualificação');
      console.log('  filtro Prospect/Qualif: removidas ' + (rowsAll.length - rows.length) + ' oportunidades de ' + rowsAll.length);

      // Funil (a partir de 03 Proposta). O funil cumulativo: passou pela fase X = chegou em X ou maior.
      const FASES_ORDER = ['03 Proposta', '04 Negociação', '05 Aguardando Pedido', '06 Conclusão'];
      const faseRank = (f) => FASES_ORDER.findIndex(x => x === f);
      const funil = FASES_ORDER.map(f => ({
        fase: f.replace(/^0\d /, ''),
        chave: f,
        atual: rows.filter(r => r.fase === f).length,
        cumulativo: rows.filter(r => faseRank(r.fase) >= faseRank(f)).length,
      }));

      const totalLeads = rows.length;
      const totalGanhos = rows.filter(r => r.ganho).length;
      const totalPerdidos = rows.filter(r => r.perdido).length;
      const totalAbertos = rows.filter(r => r.aberto).length;
      const taxaConversao = totalLeads > 0 ? (totalGanhos / totalLeads) * 100 : 0;

      const totalTicket = rows.reduce((s, r) => s + r.ticket, 0);
      const totalGanhoTicket = rows.filter(r => r.ganho).reduce((s, r) => s + r.ticket, 0);
      const totalAbertoTicket = rows.filter(r => r.aberto).reduce((s, r) => s + r.ticket, 0);
      const totalPerdidoTicket = rows.filter(r => r.perdido).reduce((s, r) => s + r.ticket, 0);
      const ticketMedio = totalLeads > 0 ? totalTicket / totalLeads : 0;

      // Aggregates
      const aggOpp = (keyFn) => {
        const m = new Map();
        for (const r of rows) {
          const k = keyFn(r) || 'Sem categoria';
          if (!m.has(k)) m.set(k, { name: k, qtd: 0, ganhos: 0, perdidos: 0, abertos: 0, ticket: 0, ticketGanho: 0 });
          const o = m.get(k);
          o.qtd++;
          if (r.ganho) { o.ganhos++; o.ticketGanho += r.ticket; }
          else if (r.perdido) o.perdidos++;
          else o.abertos++;
          o.ticket += r.ticket;
        }
        for (const o of m.values()) {
          o.conversao = o.qtd > 0 ? (o.ganhos / o.qtd) * 100 : 0;
        }
        return [...m.values()].sort((a, b) => b.ticket - a.ticket);
      };
      const porVendedor = aggOpp(r => r.vendedor);
      const porOrigem = aggOpp(r => r.origem);
      const porMotivo = aggOpp(r => r.motivo).filter(x => x.name && x.name !== 'Sem categoria');
      const porTipo = aggOpp(r => r.tipo).filter(x => x.name);
      const porProduto = aggOpp(r => r.produto).filter(x => x.name).slice(0, 15);
      const porConta = aggOpp(r => r.conta).filter(x => x.name).slice(0, 20);

      // Por mês (ano de referência = ano max de dataRef)
      const anos = rows.map(r => r.ano).filter(Boolean);
      const anoCRM = anos.length ? Math.max(...anos) : new Date().getFullYear();
      const porMes = Array(12).fill(0).map((_, i) => ({
        m: ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][i],
        leads: 0, ganhos: 0, perdidos: 0, ticket: 0, ticketGanho: 0,
      }));
      for (const r of rows) {
        if (r.ano !== anoCRM || r.mes == null) continue;
        const o = porMes[r.mes];
        o.leads++;
        if (r.ganho) { o.ganhos++; o.ticketGanho += r.ticket; }
        else if (r.perdido) o.perdidos++;
        o.ticket += r.ticket;
      }

      console.log(`\n=== CRM ===`);
      console.log(`  ${totalLeads} oportunidades | ganhos: ${totalGanhos} (${taxaConversao.toFixed(1)}%) | perdidos: ${totalPerdidos} | abertos: ${totalAbertos}`);
      console.log(`  Ticket total: R$ ${totalTicket.toFixed(2)} | Ticket ganho: R$ ${totalGanhoTicket.toFixed(2)} | Médio: R$ ${ticketMedio.toFixed(2)}`);
      console.log(`  Funil: ${funil.map(f => f.chave + '=' + f.atual).join(' | ')}`);

      return {
        rows,
        funil,
        totais: {
          totalLeads, totalGanhos, totalPerdidos, totalAbertos,
          taxaConversao, totalTicket, totalGanhoTicket, totalAbertoTicket, totalPerdidoTicket,
          ticketMedio, anoCRM,
        },
        porVendedor, porOrigem, porMotivo, porTipo, porProduto, porConta, porMes,
      };
    } catch (e) {
      console.error('  CRM erro:', e.message);
      return null;
    }
  })(),
  saldos: (function() {
    try {
      const wb = XLSX.readFile(path.join(DRIVE, 'Saldos.xlsx'));
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }).slice(1);
      const series = rows
        .filter(r => r[0] != null && r[2])
        .map(r => ({
          data: excelToDate(r[0]) ? excelToDate(r[0]).toISOString().slice(0, 10) : null,
          valor: num(r[1]),
          conta: String(r[2]).trim(),
        }))
        .filter(r => r.data);
      // Agrupa por data: total por dia + breakdown por conta
      const byDate = new Map();
      for (const r of series) {
        if (!byDate.has(r.data)) byDate.set(r.data, { data: r.data, total: 0, contas: {} });
        const o = byDate.get(r.data);
        o.contas[r.conta] = r.valor;
        o.total += r.valor;
      }
      const dailyArr = [...byDate.values()].sort((a, b) => a.data.localeCompare(b.data));
      const last = dailyArr[dailyArr.length - 1] || null;
      console.log(`\n=== Saldos ===\n  ${dailyArr.length} dias | ultima data: ${last && last.data} | total: R$ ${last && last.total.toFixed(2)}`);
      return { daily: dailyArr, last, contas: [...new Set(series.map(r => r.conta))] };
    } catch (e) {
      console.error('  saldos erro:', e.message);
      return { daily: [], last: null, contas: [] };
    }
  })(),
};

fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
const stat = fs.statSync(OUT);
console.log(`\n=== OK ===\n  ${OUT} (${(stat.size / 1024).toFixed(1)} KB)`);

// Tambem grava data-extras.js no root pro index.html carregar via <script>.
const OUT_JS = path.join(__dirname, 'data-extras.js');
const js = '/* BI EXTRAS — gerado por build-data-extras.cjs (le 3 XLSX do Drive). */\n' +
  'window.BIT_EXTRAS = ' + JSON.stringify(out) + ';\n';
fs.writeFileSync(OUT_JS, js);
const stat2 = fs.statSync(OUT_JS);
console.log(`  ${OUT_JS} (${(stat2.size / 1024).toFixed(1)} KB)`);
