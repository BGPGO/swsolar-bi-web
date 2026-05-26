#!/usr/bin/env node
/**
 * Pre-compila JSX → JS minificado em UM unico bundle.
 * Antes: 3 .jsx files transformados em runtime pelo Babel-standalone (~5MB CDN
 * + parse + transform a cada page load → muito lento).
 * Agora: 1 app.bundle.js minificado (~50-100KB), zero runtime.
 *
 * Os .jsx originais usam variaveis globais cross-file (Icon, DATE_RANGES,
 * Sidebar, etc) — nao sao modulos. Estrategia: concatena ordem importa
 * (components.jsx → pages-1.jsx → pages-2.jsx → app.jsx do index.html)
 * e roda esbuild --transform pra resolver tudo em escopo unico.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');

const ROOT = __dirname;
const SOURCES = [
  'components.jsx',
  'pages-1.jsx',
  'pages-2.jsx',
  'pages-3.jsx',
  'pages-4.jsx',
  'page-orcamento.jsx',
  'page-dre.jsx',
  'upsell-pages.jsx',
];

// Lê bi.config.js (se existir) pra injetar BI_PAGE_MODE
let pageModes = {};
try {
  const cfg = require(path.join(ROOT, 'bi.config.js'));
  const flat = (obj) => {
    const out = {};
    for (const k of Object.keys(obj || {})) out[k] = obj[k];
    return out;
  };
  pageModes = { ...flat(cfg.pages?.geral), ...flat(cfg.pages?.outros) };
} catch (e) {
  // Sem config — todas as pages ativas (default)
}
const PAGE_MODE_INJECT = `\n// Injetado por build-jsx.cjs a partir de bi.config.js > pages\nwindow.BI_PAGE_MODE = ${JSON.stringify(pageModes)};\n`;

(async () => {
  // Cada .jsx redeclara `const { useState } = React;` no topo (era pra Babel-
  // standalone funcionar com escopo isolado por <script>). Concatenado vira
  // duplicate declaration. Strip e re-injeta uma vez no inicio do bundle.
  const HOIST_HEADER = `\nvar { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect, Fragment } = React;\n`;
  const stripReactHooks = (src) => src.replace(/^\s*const\s*\{[^}]*\}\s*=\s*React\s*;?\s*$/gm, '');

  const concat = HOIST_HEADER + SOURCES.map((f) => {
    const body = stripReactHooks(fs.readFileSync(path.join(ROOT, f), 'utf8'));
    return `\n/* ===== ${f} ===== */\n${body}`;
  }).join('\n');

  // O App.jsx original esta inline no index.html. Movemos pra ca pra ficar
  // bundlado tambem. SE o operador editar index.html, manter a IIFE de boot.
  const APP_BODY = `
/* ===== App (raiz) ===== */
(function () {
  var useState = React.useState;
  var useEffect = React.useEffect;
  var PAGE_LABELS = {
    overview: '01 Visão geral',
    indicators: '02 Indicadores',
    receita: '03 Receita',
    despesa: '04 Despesa',
    fluxo: '05 Fluxo de caixa',
    tesouraria: '06 Tesouraria',
    comparativo: '07 Comparativo',
    relatorio: '08 Relatório IA',
    faturamento_produto: '09 Faturamento por Produto',
    curva_abc: '10 Curva ABC',
    marketing: '11 Marketing ADS',
    valuation: '12 Valuation',
    hierarquia: '13 Hierarquia ADS',
    detalhado: '14 Detalhado',
    profunda_cliente: '15 Profunda Cliente',
    crm: '16 CRM',
    orcamento: '17 Orçamento',
    dre: '18 DRE',
  };
  function App() {
    var p = useState('overview'); var page = p[0], setPage = p[1];
    var f = useState(Object.assign({}, DEFAULT_FILTERS)); var filters = f[0], setFilters = f[1];
    var fo = useState(false); var filtersOpen = fo[0], setFiltersOpen = fo[1];
    var so = useState(false); var sidebarOpen = so[0], setSidebarOpen = so[1];
    var sf = useState(function () {
      try { return localStorage.getItem('bi.statusFilter') || 'realizado'; } catch (e) { return 'realizado'; }
    });
    var statusFilter = sf[0], setStatusFilter = sf[1];
    // Drilldown global: setado quando o usuario clica numa barra/linha de grafico.
    var dd = useState(null);
    var drilldown = dd[0], setDrilldown = dd[1];
    // Year selector: padrao = ano corrente (window.REF_YEAR)
    var ys = useState(function () {
      try { var y = parseInt(localStorage.getItem('bi.year'), 10); return y > 1900 ? y : (window.REF_YEAR || new Date().getFullYear()); } catch (e) { return window.REF_YEAR || new Date().getFullYear(); }
    });
    var year = ys[0], setYear = ys[1];
    var ms = useState(function () {
      try { var m = parseInt(localStorage.getItem('bi.month'), 10); return (m >= 0 && m <= 12) ? m : 0; } catch (e) { return 0; }
    });
    var month = ms[0], setMonth = ms[1];

    // BI export multi-tela: array de page-ids ou null. Quando setado, renderiza
    // todas as telas em sequencia + chama window.print() depois do layout pintar.
    var pp = useState(null); var printPages = pp[0], setPrintPages = pp[1];
    useEffect(function () {
      window.startBiExport = function (pages) {
        document.body.classList.add('bi-print-mode');
        setPrintPages(pages);
      };
      window.startBiExcelExport = function (pages, sf, dd, yr, mo, regime, filters) {
        if (typeof XLSX === 'undefined') { alert('Biblioteca XLSX não carregada.'); return; }
        var B = window.getBit(sf, dd, yr, mo, regime, filters);
        var BFull = window.getBit(sf, null, yr, 0, regime, filters);
        var wb = XLSX.utils.book_new();
        var fmt = function (v) { return typeof v === 'number' ? Math.round(v * 100) / 100 : (v || ''); };
        var pctF = function (v) { return typeof v === 'number' ? (Math.round(v * 10000) / 100) + '%' : ''; };
        var meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

        pages.forEach(function (pid) {
          if (pid === 'overview') {
            var rows = [['Indicador', 'Valor']];
            rows.push(['Receita Total', fmt(B.TOTAL_RECEITA)]);
            rows.push(['Despesa Total', fmt(B.TOTAL_DESPESA)]);
            rows.push(['Valor Líquido', fmt(B.VALOR_LIQUIDO)]);
            rows.push(['Margem Líquida', pctF(B.MARGEM_LIQUIDA)]);
            rows.push([]);
            rows.push(['Mês', 'Receita', 'Despesa', 'Líquido']);
            (B.MONTH_DATA || []).forEach(function (m) {
              rows.push([m.m, fmt(m.receita), fmt(m.despesa), fmt(m.receita - m.despesa)]);
            });
            var ws = XLSX.utils.aoa_to_sheet(rows);
            ws['!cols'] = [{wch:18},{wch:16},{wch:16},{wch:16}];
            XLSX.utils.book_append_sheet(wb, ws, '01 Visao Geral');
          }
          if (pid === 'receita') {
            var rows = [['Mês', 'Receita']];
            (B.MONTH_DATA || []).forEach(function (m) { rows.push([m.m, fmt(m.receita)]); });
            rows.push([]); rows.push(['Categoria', 'Valor']);
            (BFull.RECEITA_CATEGORIAS || []).forEach(function (c) { rows.push([c.name, fmt(c.value)]); });
            rows.push([]); rows.push(['Cliente', 'Valor']);
            (BFull.RECEITA_CLIENTES || []).forEach(function (c) { rows.push([c.name, fmt(c.value)]); });
            rows.push([]); rows.push(['Data', 'Categoria', 'Cliente', 'Valor']);
            var ext = (B.EXTRATO || []).filter(function (e) { return e[4] > 0; });
            ext.forEach(function (e) { rows.push([e[0], e[2], e[3], fmt(e[4])]); });
            var ws = XLSX.utils.aoa_to_sheet(rows);
            ws['!cols'] = [{wch:14},{wch:30},{wch:30},{wch:16}];
            XLSX.utils.book_append_sheet(wb, ws, '02 Receita');
          }
          if (pid === 'despesa') {
            var rows = [['Mês', 'Despesa']];
            (B.MONTH_DATA || []).forEach(function (m) { rows.push([m.m, fmt(m.despesa)]); });
            rows.push([]); rows.push(['Categoria', 'Valor']);
            (BFull.DESPESA_CATEGORIAS || []).forEach(function (c) { rows.push([c.name, fmt(c.value)]); });
            rows.push([]); rows.push(['Fornecedor', 'Valor']);
            (BFull.DESPESA_FORNECEDORES || []).forEach(function (c) { rows.push([c.name, fmt(c.value)]); });
            rows.push([]); rows.push(['Data', 'Categoria', 'Fornecedor', 'Valor']);
            var ext = (B.EXTRATO || []).filter(function (e) { return e[4] < 0; });
            ext.forEach(function (e) { rows.push([e[0], e[2], e[3], fmt(Math.abs(e[4]))]); });
            var ws = XLSX.utils.aoa_to_sheet(rows);
            ws['!cols'] = [{wch:14},{wch:30},{wch:30},{wch:16}];
            XLSX.utils.book_append_sheet(wb, ws, '03 Despesa');
          }
          if (pid === 'fluxo') {
            var tx = window.ALL_TX || [];
            var rg = (regime === 'competencia') ? 'k' : 'c';
            var filtered = tx.filter(function(r) { return r[9] === rg; });
            if (sf === 'realizado') filtered = filtered.filter(function(r) { return r[6] === 1; });
            else if (sf === 'a_pagar_receber') filtered = filtered.filter(function(r) { return r[6] === 0; });
            if (filters) filtered = window.filterTx(tx, sf, dd, regime || 'caixa', filters);
            var y = yr || window.REF_YEAR;
            filtered = filtered.filter(function(r) { return r[1] && r[1].slice(0,4) === String(y); });
            var recCats = {}; var despCats = {};
            filtered.forEach(function(r) {
              var cat = r[3] || 'Sem categoria';
              var mesIdx = parseInt(r[1].slice(5,7), 10) - 1;
              if (mesIdx < 0 || mesIdx > 11) return;
              if (r[0] === 'r') {
                if (!recCats[cat]) recCats[cat] = [0,0,0,0,0,0,0,0,0,0,0,0];
                recCats[cat][mesIdx] += r[5];
              } else {
                if (!despCats[cat]) despCats[cat] = [0,0,0,0,0,0,0,0,0,0,0,0];
                despCats[cat][mesIdx] += Math.abs(r[5]);
              }
            });
            var header = ['Categoria'].concat(meses).concat(['Total']);
            var rows = [header];
            rows.push(['=== RECEITAS ===']);
            var recTotal = [0,0,0,0,0,0,0,0,0,0,0,0];
            Object.keys(recCats).sort().forEach(function(cat) {
              var v = recCats[cat]; var t = v.reduce(function(a,b){return a+b;},0);
              var row = [cat]; v.forEach(function(x,i){ row.push(fmt(x)); recTotal[i]+=x; }); row.push(fmt(t));
              rows.push(row);
            });
            var rt = recTotal.reduce(function(a,b){return a+b;},0);
            rows.push(['Total Receita'].concat(recTotal.map(fmt)).concat([fmt(rt)]));
            rows.push([]);
            rows.push(['=== DESPESAS ===']);
            var despTotal = [0,0,0,0,0,0,0,0,0,0,0,0];
            Object.keys(despCats).sort().forEach(function(cat) {
              var v = despCats[cat]; var t = v.reduce(function(a,b){return a+b;},0);
              var row = [cat]; v.forEach(function(x,i){ row.push(fmt(x)); despTotal[i]+=x; }); row.push(fmt(t));
              rows.push(row);
            });
            var dt = despTotal.reduce(function(a,b){return a+b;},0);
            rows.push(['Total Despesa'].concat(despTotal.map(fmt)).concat([fmt(dt)]));
            rows.push([]);
            var liqRow = ['Líquido'];
            for (var i=0;i<12;i++) liqRow.push(fmt(recTotal[i]-despTotal[i]));
            liqRow.push(fmt(rt-dt));
            rows.push(liqRow);
            var ws = XLSX.utils.aoa_to_sheet(rows);
            ws['!cols'] = [{wch:35}];
            for(var j=1;j<=13;j++) ws['!cols'].push({wch:14});
            XLSX.utils.book_append_sheet(wb, ws, '04 Fluxo de Caixa');
          }
          if (pid === 'tesouraria') {
            var BReal = window.getBit('realizado', dd, yr, mo, regime, filters);
            var BPend = window.getBit('a_pagar_receber', dd, yr, mo, regime, filters);
            var rows = [['Indicador', 'Valor']];
            rows.push(['Recebido', fmt(BReal.TOTAL_RECEITA)]);
            rows.push(['A Receber', fmt(BPend.TOTAL_RECEITA)]);
            rows.push(['Pago', fmt(BReal.TOTAL_DESPESA)]);
            rows.push(['A Pagar', fmt(BPend.TOTAL_DESPESA)]);
            rows.push([]);
            rows.push(['Dia', 'Receita', 'Despesa']);
            var recDia = BReal.RECEITA_DIA || [];
            var despDia = BReal.DESPESA_DIA || [];
            for (var i = 0; i < 31; i++) {
              if ((recDia[i] || 0) > 0 || (despDia[i] || 0) > 0)
                rows.push([i + 1, fmt(recDia[i] || 0), fmt(despDia[i] || 0)]);
            }
            rows.push([]);
            rows.push(['Mês', 'Saldo']);
            (BReal.SALDOS_MES || []).forEach(function (s, i) { rows.push([meses[i], fmt(s)]); });
            var ws = XLSX.utils.aoa_to_sheet(rows);
            ws['!cols'] = [{wch:14},{wch:16},{wch:16}];
            XLSX.utils.book_append_sheet(wb, ws, '05 Tesouraria');
          }
          if (pid === 'comparativo') {
            var rows = [['Comparativo']];
            rows.push(['Indicador', 'Valor']);
            rows.push(['Receita', fmt(B.TOTAL_RECEITA)]);
            rows.push(['Despesa', fmt(B.TOTAL_DESPESA)]);
            rows.push(['Líquido', fmt(B.VALOR_LIQUIDO)]);
            rows.push([]);
            rows.push(['Mês', 'Receita', 'Despesa', 'Líquido']);
            (B.MONTH_DATA || []).forEach(function (m) {
              rows.push([m.m, fmt(m.receita), fmt(m.despesa), fmt(m.receita - m.despesa)]);
            });
            var ws = XLSX.utils.aoa_to_sheet(rows);
            ws['!cols'] = [{wch:18},{wch:16},{wch:16},{wch:16}];
            XLSX.utils.book_append_sheet(wb, ws, '06 Comparativo');
          }
          if (pid === 'dre') {
            var tx = window.ALL_TX || [];
            var rg = (regime === 'competencia') ? 'k' : 'c';
            var filtered = filters ? window.filterTx(tx, sf, dd, regime || 'caixa', filters) : tx.filter(function(r){return r[9]===rg;});
            var y = yr || window.REF_YEAR;
            filtered = filtered.filter(function(r) { return r[1] && r[1].slice(0,4) === String(y); });
            var catMonth = {};
            filtered.forEach(function(r) {
              var cat = r[3] || 'Sem categoria';
              var mi = parseInt(r[1].slice(5,7),10)-1;
              if (mi<0||mi>11) return;
              if (!catMonth[cat]) catMonth[cat] = [0,0,0,0,0,0,0,0,0,0,0,0];
              catMonth[cat][mi] += r[5];
            });
            var header = ['Conta'].concat(meses).concat(['Total']);
            var rows = [header];
            Object.keys(catMonth).sort().forEach(function(cat) {
              var v = catMonth[cat]; var t = v.reduce(function(a,b){return a+b;},0);
              rows.push([cat].concat(v.map(fmt)).concat([fmt(t)]));
            });
            var ws = XLSX.utils.aoa_to_sheet(rows);
            ws['!cols'] = [{wch:35}];
            for(var j=1;j<=13;j++) ws['!cols'].push({wch:14});
            XLSX.utils.book_append_sheet(wb, ws, '18 DRE');
          }
          if (pid === 'orcamento' && window.BIT_ORCAMENTO) {
            var rows = [['Categoria', 'Orçado', 'Realizado', 'Saldo', '% Consumido']];
            var catMap = {};
            window.BIT_ORCAMENTO.forEach(function(r) {
              var cat = r.conta || 'Sem conta';
              if (!catMap[cat]) catMap[cat] = { orcado: 0, realizado: 0 };
              catMap[cat].orcado += r.orcamento || 0;
              catMap[cat].realizado += r.realizado || 0;
            });
            Object.keys(catMap).sort().forEach(function(cat) {
              var c = catMap[cat]; var saldo = c.orcado - c.realizado;
              var pct = c.orcado ? (c.realizado / c.orcado) : 0;
              rows.push([cat, fmt(c.orcado), fmt(c.realizado), fmt(saldo), pctF(pct)]);
            });
            var ws = XLSX.utils.aoa_to_sheet(rows);
            ws['!cols'] = [{wch:35},{wch:16},{wch:16},{wch:16},{wch:14}];
            XLSX.utils.book_append_sheet(wb, ws, '17 Orcamento');
          }
        });

        if (wb.SheetNames.length === 0) {
          var ws = XLSX.utils.aoa_to_sheet([['Nenhuma tela selecionada com dados disponíveis']]);
          XLSX.utils.book_append_sheet(wb, ws, 'Vazio');
        }
        var nome = (window.BIT && window.BIT.META && window.BIT.META.EMPRESA) || 'BI';
        XLSX.writeFile(wb, nome + '_BI_Export.xlsx');
      };
      return function () { window.startBiExport = null; window.startBiExcelExport = null; };
    }, []);
    useEffect(function () {
      if (!printPages) return;
      var cancelled = false;
      var waitReady = function () {
        // 1) fonts
        var fontsP = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
        // 2) imagens (todas as <img> do bi-print-root tem que ter terminado)
        var imgsP = new Promise(function (resolve) {
          var imgs = Array.prototype.slice.call(document.querySelectorAll('.bi-print-root img'));
          var pending = imgs.filter(function (i) { return !i.complete; });
          if (pending.length === 0) return resolve();
          var done = 0;
          pending.forEach(function (i) {
            var fin = function () { done++; if (done >= pending.length) resolve(); };
            i.addEventListener('load', fin, { once: true });
            i.addEventListener('error', fin, { once: true });
          });
          // safety net
          setTimeout(resolve, 5000);
        });
        // 3) PageRelatorio: se foi incluído no export, esperar até ele renderizar conteudo
        //    (carrega async via fetch). Damos até 30s, polling a cada 200ms.
        var hasRelatorio = printPages.indexOf('relatorio') !== -1;
        var relatorioP = !hasRelatorio ? Promise.resolve() : new Promise(function (resolve) {
          var deadline = Date.now() + 30000;
          var poll = function () {
            if (cancelled) return resolve();
            // Sinal: PageRelatorio renderizou .report-cover OU mensagem de erro/help
            var rendered = document.querySelector('.bi-print-root .report-cover')
              || document.querySelector('.bi-print-root .report');
            if (rendered) return resolve();
            if (Date.now() > deadline) return resolve();
            setTimeout(poll, 200);
          };
          poll();
        });
        Promise.all([fontsP, imgsP, relatorioP]).then(function () {
          if (cancelled) return;
          // 2 frames pra garantir reflow final + 400ms pra layout estabilizar
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              setTimeout(function () {
                if (cancelled) return;
                window.print();
                setTimeout(function () {
                  document.body.classList.remove('bi-print-mode');
                  setPrintPages(null);
                }, 800);
              }, 400);
            });
          });
        });
      };
      waitReady();
      return function () { cancelled = true; };
    }, [printPages]);

    useEffect(function () {
      try { localStorage.setItem('bi.statusFilter', statusFilter); } catch (e) {}
      if (typeof window._makeBit === 'function') {
        window.BIT = window._makeBit(statusFilter);
      }
      setDrilldown(null);
    }, [statusFilter]);

    useEffect(function () {
      try { localStorage.setItem('bi.year', String(year)); } catch (e) {}
      setDrilldown(null);
    }, [year]);

    useEffect(function () {
      try { localStorage.setItem('bi.month', String(month)); } catch (e) {}
      setDrilldown(null);
    }, [month]);

    var handleSetPage = function (newPage) {
      setPage(newPage);
      setSidebarOpen(false);
      setDrilldown(null);
    };

    var PAGE_COMPS = {
      overview: PageOverview,
      indicators: PageIndicators,
      receita: PageReceita,
      despesa: PageDespesa,
      fluxo: PageFluxo,
      tesouraria: PageTesouraria,
      comparativo: PageComparativo,
      relatorio: PageRelatorio,
      faturamento_produto: PageFaturamentoProduto,
      curva_abc: PageCurvaABC,
      marketing: PageMarketing,
      valuation: PageValuation,
      hierarquia: PageHierarquia,
      detalhado: PageDetalhado,
      profunda_cliente: PageProfundaCliente,
      crm: PageCRM,
      orcamento: PageOrcamento,
      dre: PageDRE,
    };
    // Modo da page atual: 'active' (default), 'upsell' (mostra UpsellPage), 'hidden' (não renderiza)
    var pageMode = (window.BI_PAGE_MODE && window.BI_PAGE_MODE[page]) || 'active';
    var PageComp = (pageMode === 'upsell' && window.UpsellPage)
      ? function (props) { return React.createElement(window.UpsellPage, { pageId: page }); }
      : PAGE_COMPS[page];

    var commonProps = {
      filters: filters,
      setFilters: setFilters,
      onOpenFilters: function () { setFiltersOpen(true); },
      statusFilter: statusFilter,
      year: year,
      setYear: setYear,
      month: month,
      setMonth: setMonth,
      drilldown: drilldown,
      setDrilldown: setDrilldown,
    };

    // Modo print multi-tela: renderiza todas as paginas selecionadas em sequencia
    if (printPages && printPages.length > 0) {
      return (
        <div className="app bi-print-root">
          {printPages.map(function (id, i) {
            var Comp = PAGE_COMPS[id];
            if (!Comp) return null;
            return (
              <div key={id + '-' + i} className="bi-print-page">
                <div className="bi-print-header">
                  <img src="assets/bgp-logo-white.png" alt="BGP" className="bi-print-logo" />
                  <div className="bi-print-title">
                    <div className="bi-print-pagenum">{PAGE_LABELS[id] || id}</div>
                    <div className="bi-print-brand">BI Financeiro</div>
                  </div>
                </div>
                <Comp {...commonProps} />
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <div className={'app ' + (sidebarOpen ? 'sidebar-open' : '')} data-screen-label={PAGE_LABELS[page]}>
        <Sidebar active={page} onSelect={handleSetPage} open={sidebarOpen} />
        <div className="sidebar-backdrop" onClick={function () { setSidebarOpen(false); }} />
        <div className="main">
          <Header
            page={page}
            onToggleSidebar={function () { setSidebarOpen(function (o) { return !o; }); }}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            year={year}
            setYear={setYear}
            month={month}
            setMonth={setMonth}
            filters={filters}
            setFilters={setFilters}
          />
          <PageComp {...commonProps} />
        </div>
        <FiltersDrawer open={filtersOpen} onClose={function () { setFiltersOpen(false); }} filters={filters} setFilters={setFilters} />
      </div>
    );
  }
  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
})();
`;

  const finalSource = PAGE_MODE_INJECT + concat + '\n' + APP_BODY;

  const result = await esbuild.transform(finalSource, {
    loader: 'jsx',
    jsx: 'transform',
    minify: true,
    target: ['es2017'],
  });

  const out = path.join(ROOT, 'app.bundle.js');
  fs.writeFileSync(out, result.code);
  const sizeKB = (result.code.length / 1024).toFixed(1);
  console.log(`OK app.bundle.js (${sizeKB} KB) — concat de ${SOURCES.length} .jsx + App raiz`);
})().catch((e) => { console.error('ERR:', e.message); process.exit(1); });
