/* BI/Cliente — Pages 4: Hierarquia (tree), Detalhado (BarList+matrix), Profunda Cliente (overlay), CRM (funil) */
const { useState, useMemo } = React;

// ---------- helpers locais ----------
const _fmtBR4 = (n, dec = 2) => {
  if (n == null || isNaN(n)) return "0,00";
  const s = Math.abs(n).toFixed(dec);
  const [int, d] = s.split(".");
  const formatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (d ? "," + d : "");
  return (n < 0 ? "-" : "") + formatted;
};
const _fmtInt4 = (n) => _fmtBR4(n, 0);
const _fmtK4 = (n) => {
  const abs = Math.abs(n);
  const sgn = n < 0 ? "-" : "";
  if (abs >= 1e6) return `${sgn}${(abs / 1e6).toFixed(2).replace(".", ",")}M`;
  if (abs >= 1e3) return `${sgn}${(abs / 1e3).toFixed(1).replace(".", ",")}K`;
  return `${sgn}${abs.toFixed(0)}`;
};

// Mini KPI compativel
const _MiniKpi4 = ({ label, value, hint, tone, nonMonetary }) => (
  <div className={`kpi-tile ${tone || ""}`}>
    <div>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">
        {!nonMonetary && <span className="currency">R$</span>}
        {value}
      </div>
      {hint && <div className="kpi-delta" style={{ color: "var(--fg-3)" }}>{hint}</div>}
    </div>
  </div>
);

// ============================================================
// PageHierarquia — Arvore visual com SVG conectores (estilo PBIX)
// ============================================================
const PageHierarquia = ({ statusFilter, year, month, drilldown, setDrilldown }) => {
  const E = (typeof window !== "undefined" && window.BIT_EXTRAS) || null;
  if (!E || !E.ads || !E.ads.rows || E.ads.rows.length === 0) {
    return (
      <div className="page">
        <div className="page-title"><div><h1>Hierarquia ADS</h1></div></div>
        <div className="card">
          <h2 className="card-title">Sem dados</h2>
          <p>Rode <code>node build-data-extras.cjs</code> pra gerar os dados das campanhas Facebook ADS.</p>
        </div>
      </div>
    );
  }
  const rows = E.ads.rows;
  const T = E.ads.totais;

  // Filtros decorativos
  const [tipoResultado, setTipoResultado] = useState("todos");
  const [campanhaFiltro, setCampanhaFiltro] = useState("todas");
  const [anuncioFiltro, setAnuncioFiltro] = useState("todos");
  const [dataInicio, setDataInicio] = useState("");

  const campanhasUniq = useMemo(() => {
    const s = new Set();
    rows.forEach(r => { if (r.campanha) s.add(r.campanha); });
    return Array.from(s);
  }, [rows]);
  const anunciosUniq = useMemo(() => {
    const s = new Set();
    rows.forEach(r => { if (r.anuncio) s.add(r.anuncio); });
    return Array.from(s);
  }, [rows]);

  const rowsFiltered = useMemo(() => rows.filter(r => {
    if (campanhaFiltro !== "todas" && r.campanha !== campanhaFiltro) return false;
    if (anuncioFiltro !== "todos" && r.anuncio !== anuncioFiltro) return false;
    return true;
  }), [rows, campanhaFiltro, anuncioFiltro]);

  // Construir arvore: Campanha -> Conjuntos -> Anuncios
  const tree = useMemo(() => {
    const map = new Map();
    for (const r of rowsFiltered) {
      const camp = r.campanha || "(sem campanha)";
      if (!map.has(camp)) map.set(camp, {
        campanha: camp, valorBRL: 0, alcance: 0, impressoes: 0, leads: 0, resultados: 0,
        adsets: new Map(),
      });
      const c = map.get(camp);
      c.valorBRL += r.valorBRL || 0;
      c.alcance = Math.max(c.alcance, r.alcance || 0);
      c.impressoes += r.impressoes || 0;
      c.leads += r.leads || 0;
      c.resultados += r.resultados || 0;

      const adset = r.conjunto || "(sem conjunto)";
      if (!c.adsets.has(adset)) c.adsets.set(adset, {
        conjunto: adset, valorBRL: 0, alcance: 0, impressoes: 0, anuncios: [],
      });
      const a = c.adsets.get(adset);
      a.valorBRL += r.valorBRL || 0;
      a.alcance = Math.max(a.alcance, r.alcance || 0);
      a.impressoes += r.impressoes || 0;
      a.anuncios.push({
        anuncio: r.anuncio || "(sem anuncio)",
        valorBRL: r.valorBRL || 0, alcance: r.alcance || 0,
        impressoes: r.impressoes || 0, leads: r.leads || 0,
      });
    }
    const arr = Array.from(map.values()).sort((a, b) => b.valorBRL - a.valorBRL);
    arr.forEach(c => { c.adsetsArr = Array.from(c.adsets.values()).sort((a, b) => b.valorBRL - a.valorBRL); });
    return arr;
  }, [rowsFiltered]);

  const totalLeadsFiltered = rowsFiltered.reduce((s, r) => s + (r.leads || 0), 0);
  const totalAlcanceFiltered = rowsFiltered.reduce((s, r) => s + (r.alcance || 0), 0);
  const totalValorFiltered = rowsFiltered.reduce((s, r) => s + (r.valorBRL || 0), 0);
  const totalImpressoesFiltered = rowsFiltered.reduce((s, r) => s + (r.impressoes || 0), 0);

  // Render: 5 colunas (Leads -> Campanhas -> Conjuntos -> Anuncios -> Metricas)
  // Cada nó é uma "card" laranja com label + barra horizontal embaixo
  // Conexões via SVG absolute por trás
  const NODE_W = 180;
  const NODE_H = 38;
  const COL_GAP = 64;
  const ROW_GAP = 8;
  const PAD_TOP = 14;

  // Dados achatados por nível com posições calculadas
  const layout = useMemo(() => {
    const colCamp = []; // [{ x, y, label, value }]
    const colAdset = [];
    const colAd = [];
    const colMet = [];

    let yPos = PAD_TOP;
    tree.forEach((c) => {
      const adsetCount = c.adsetsArr.length || 1;
      const adCount = c.adsetsArr.reduce((s, a) => s + Math.max(1, a.anuncios.length), 0);
      const blockH = Math.max(adsetCount, adCount) * (NODE_H + ROW_GAP);
      const cyMid = yPos + blockH / 2 - NODE_H / 2;

      // Nó campanha
      const campIdx = colCamp.length;
      colCamp.push({
        x: 0, y: cyMid, w: NODE_W, h: NODE_H,
        label: c.campanha,
        value: c.adsetsArr.length,
        valorBRL: c.valorBRL,
      });

      let ySub = yPos;
      c.adsetsArr.forEach((a) => {
        const anuncioCount = Math.max(1, a.anuncios.length);
        const aBlockH = anuncioCount * (NODE_H + ROW_GAP);
        const aMid = ySub + aBlockH / 2 - NODE_H / 2;

        const adsetIdx = colAdset.length;
        colAdset.push({
          x: NODE_W + COL_GAP, y: aMid, w: NODE_W, h: NODE_H,
          label: a.conjunto,
          value: a.anuncios.length,
          valorBRL: a.valorBRL,
          parentIdx: campIdx,
        });

        let yAd = ySub;
        a.anuncios.forEach((ad) => {
          colAd.push({
            x: 2 * (NODE_W + COL_GAP), y: yAd, w: NODE_W, h: NODE_H,
            label: ad.anuncio,
            value: ad.alcance,
            parentIdx: adsetIdx,
          });
          colMet.push({
            x: 3 * (NODE_W + COL_GAP), y: yAd, w: NODE_W, h: NODE_H,
            alcance: ad.alcance,
            impressoes: ad.impressoes,
            valor: ad.valorBRL,
          });
          yAd += NODE_H + ROW_GAP;
        });
        ySub += aBlockH;
      });
      yPos += blockH;
    });

    const totalH = Math.max(yPos + 12, 360);
    const totalW = 4 * NODE_W + 3 * COL_GAP + 24;
    return { colCamp, colAdset, colAd, colMet, totalH, totalW };
  }, [tree]);

  // Max valor pra escala da barra
  const maxNodeVal = Math.max(
    ...layout.colCamp.map(n => n.valorBRL || 0),
    ...layout.colAdset.map(n => n.valorBRL || 0),
    1
  );

  // Função pra renderizar cada nó como SVG group
  const renderNode = (n, kind) => {
    const barW = kind === "met" ? 0 : Math.max(8, ((n.valorBRL ?? n.value ?? 0) / maxNodeVal) * (NODE_W - 16));
    return (
      <g key={`${kind}-${n.x}-${n.y}`} transform={`translate(${n.x}, ${n.y})`}>
        <rect x="0" y="0" width={n.w} height={n.h} rx="3"
          fill="#171a1f" stroke="rgba(245,158,11,0.30)" strokeWidth="1" />
        {kind === "met" ? (
          <>
            <text x="8" y="14" fill="#a3a3a3" fontSize="9" fontFamily="JetBrains Mono">ALC</text>
            <text x={n.w / 3} y="14" fill="#a3a3a3" fontSize="9" fontFamily="JetBrains Mono">IMP</text>
            <text x={(2 * n.w) / 3} y="14" fill="#a3a3a3" fontSize="9" fontFamily="JetBrains Mono">R$</text>
            <text x="8" y="29" fill="#fbbf24" fontSize="11" fontWeight="700" fontFamily="JetBrains Mono">{_fmtK4(n.alcance)}</text>
            <text x={n.w / 3} y="29" fill="#22d3ee" fontSize="11" fontWeight="700" fontFamily="JetBrains Mono">{_fmtK4(n.impressoes)}</text>
            <text x={(2 * n.w) / 3} y="29" fill="#10b981" fontSize="11" fontWeight="700" fontFamily="JetBrains Mono">{_fmtK4(n.valor)}</text>
          </>
        ) : (
          <>
            <text x="8" y="14" fill="#e5e5e5" fontSize="10" fontWeight="600">
              {(n.label || "").length > 26 ? (n.label || "").slice(0, 26) + "…" : n.label}
            </text>
            <text x={n.w - 8} y="14" textAnchor="end" fill="#fbbf24" fontSize="11" fontWeight="700" fontFamily="JetBrains Mono">
              {n.value != null ? n.value : ""}
            </text>
            {/* Barra horizontal embaixo */}
            <rect x="8" y={n.h - 8} width={n.w - 16} height="3" rx="1" fill="rgba(255,255,255,0.06)" />
            <rect x="8" y={n.h - 8} width={barW} height="3" rx="1" fill="#f59e0b" />
          </>
        )}
      </g>
    );
  };

  // Render conexões: linha pai.right -> filho.left, com curva sutil
  const renderConnections = () => {
    const lines = [];
    layout.colAdset.forEach((a, i) => {
      const parent = layout.colCamp[a.parentIdx];
      if (!parent) return;
      const x1 = parent.x + parent.w;
      const y1 = parent.y + parent.h / 2;
      const x2 = a.x;
      const y2 = a.y + a.h / 2;
      const cx1 = x1 + (x2 - x1) * 0.5;
      lines.push(
        <path key={`c1-${i}`} d={`M${x1},${y1} C${cx1},${y1} ${cx1},${y2} ${x2},${y2}`}
          stroke="rgba(245,158,11,0.45)" strokeWidth="1.2" fill="none" />
      );
    });
    layout.colAd.forEach((ad, i) => {
      const parent = layout.colAdset[ad.parentIdx];
      if (!parent) return;
      const x1 = parent.x + parent.w;
      const y1 = parent.y + parent.h / 2;
      const x2 = ad.x;
      const y2 = ad.y + ad.h / 2;
      const cx1 = x1 + (x2 - x1) * 0.5;
      lines.push(
        <path key={`c2-${i}`} d={`M${x1},${y1} C${cx1},${y1} ${cx1},${y2} ${x2},${y2}`}
          stroke="rgba(245,158,11,0.30)" strokeWidth="1" fill="none" />
      );
    });
    // Conexão Met -> Ad (mesma altura, linha curta)
    layout.colAd.forEach((ad, i) => {
      const met = layout.colMet[i];
      if (!met) return;
      const x1 = ad.x + ad.w;
      const y1 = ad.y + ad.h / 2;
      const x2 = met.x;
      const y2 = met.y + met.h / 2;
      lines.push(
        <line key={`c3-${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke="rgba(245,158,11,0.20)" strokeWidth="1" />
      );
    });
    return lines;
  };

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Hierarquia — Campanhas</h1>
          <div className="status-line">
            {tree.length} campanhas · {rowsFiltered.length} linhas
          </div>
        </div>
        <div className="actions">
        </div>
      </div>

      {/* Filtros funcionais (Campanha + Anúncio aplicam de fato no rowsFiltered) */}
      <div className="hier-filters">
        <div className="hf-item">
          <label>Campanhas</label>
          <select className="filter-select" value={campanhaFiltro} onChange={(e) => setCampanhaFiltro(e.target.value)}>
            <option value="todas">Todas</option>
            {campanhasUniq.map(c => <option key={c} value={c}>{c.length > 40 ? c.slice(0, 40) + "…" : c}</option>)}
          </select>
        </div>
        <div className="hf-item">
          <label>Anuncio</label>
          <select className="filter-select" value={anuncioFiltro} onChange={(e) => setAnuncioFiltro(e.target.value)}>
            <option value="todos">Todos</option>
            {anunciosUniq.map(a => <option key={a} value={a}>{a.length > 30 ? a.slice(0, 30) + "…" : a}</option>)}
          </select>
        </div>
        {(campanhaFiltro !== "todas" || anuncioFiltro !== "todos") && (
          <button className="btn-ghost" onClick={() => { setCampanhaFiltro("todas"); setAnuncioFiltro("todos"); }}>Limpar</button>
        )}
      </div>

      {/* KPIs no topo (compactos) */}
      <div className="kpi-row">
        <_MiniKpi4 tone="amber" label="Leads Totais" value={_fmtInt4(totalLeadsFiltered)} nonMonetary
          hint={`${rowsFiltered.length} linhas`} />
        <_MiniKpi4 tone="cyan" label="Alcance" value={_fmtInt4(totalAlcanceFiltered)} nonMonetary
          hint={`${_fmtInt4(totalImpressoesFiltered)} impressoes`} />
        <_MiniKpi4 tone="green" label="Valor Usado (BRL)" value={_fmtBR4(totalValorFiltered)}
          hint={`${tree.length} campanhas`} />
      </div>

      {/* Card escuro com a árvore */}
      <div className="hier-stage">
        <div className="hier-spotlight" />
        <div className="hier-title">ÁRVORE HIERÁRQUICA</div>

        {/* Header de colunas */}
        <div className="hier-cols-header">
          <div>Campanha</div>
          <div>Conjunto de Anúncios</div>
          <div>Nome do anúncio</div>
          <div>Alcance · Impressões · Valor (BRL)</div>
        </div>

        <div className="hier-tree-wrap">
          <svg viewBox={`0 0 ${layout.totalW} ${layout.totalH}`} width={layout.totalW} height={layout.totalH}
            style={{ minWidth: layout.totalW, display: "block" }}>
            {/* connections behind nodes */}
            {renderConnections()}
            {/* nodes */}
            {layout.colCamp.map(n => renderNode(n, "camp"))}
            {layout.colAdset.map(n => renderNode(n, "adset"))}
            {layout.colAd.map(n => renderNode(n, "ad"))}
            {layout.colMet.map(n => renderNode(n, "met"))}
          </svg>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// PageDetalhado — 2 BarLists topo + matrix qtd × faturado
// ============================================================
const PageDetalhado = ({ statusFilter, year, month, drilldown, setDrilldown }) => {
  const E = (typeof window !== "undefined" && window.BIT_EXTRAS) || null;
  if (!E || !E.faturamento || !E.abc) {
    return (
      <div className="page">
        <div className="page-title"><div><h1>Detalhado</h1></div></div>
        <div className="card">
          <h2 className="card-title">Sem dados</h2>
          <p>Rode <code>node build-data-extras.cjs</code>.</p>
        </div>
      </div>
    );
  }
  const F = E.faturamento;
  const A = E.abc;
  const items = F.items || [];

  // Filtro reativo por mês do header (year fixo no anoRef do faturamento)
  const monthIdxFiltered = (month && month > 0) ? (month - 1) : null;
  const monthsAbbr = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

  const itemsFiltered = useMemo(() => {
    return items.filter(it => {
      if (monthIdxFiltered != null && it.mes !== monthIdxFiltered) return false;
      return true;
    });
  }, [items, monthIdxFiltered]);

  // Recomputa familia x valor e cliente x valor a partir dos items filtrados
  const aggBy = (arr, keyFn) => {
    const m = new Map();
    for (const it of arr) {
      const k = keyFn(it) || 'Sem categoria';
      m.set(k, (m.get(k) || 0) + it.valor);
    }
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  };

  const familias = useMemo(() => aggBy(itemsFiltered, x => x.familia).slice(0, 10), [itemsFiltered]);
  const totalFamilias = familias.reduce((s, x) => s + x.value, 0);
  const clientes = useMemo(() => aggBy(itemsFiltered, x => x.cliente).slice(0, 14), [itemsFiltered]);
  const totalClientes = clientes.reduce((s, x) => s + x.value, 0);

  // Meses pra mostrar = só os com dados nos items filtrados
  const monthsToShowIdx = useMemo(() => {
    const set = new Set();
    itemsFiltered.forEach(it => { if (it.mes != null) set.add(it.mes); });
    return [...set].sort((a, b) => a - b);
  }, [itemsFiltered]);
  const monthsToShow = monthsToShowIdx.map(i => monthsAbbr[i]);

  // Top 30 produtos por valor (com ABC class do extras + qtd e meses REAIS)
  const produtos = useMemo(() => {
    const byProduct = new Map();
    for (const it of itemsFiltered) {
      const k = it.produto;
      if (!k) continue;
      if (!byProduct.has(k)) byProduct.set(k, { descricao: k, familia: it.familia, qtd: 0, faturamento: 0, meses: Array(12).fill(0) });
      const o = byProduct.get(k);
      o.qtd += it.qtd || 0;
      o.faturamento += it.valor;
      if (it.mes != null) o.meses[it.mes] += it.qtd || 0;
    }
    // Mapeia ABC class de A.rows pelo nome do produto
    const abcByName = new Map(A.rows.map(p => [p.descricao, p.abc]));
    return [...byProduct.values()]
      .map(p => ({
        ...p,
        valorUnit: p.qtd > 0 ? p.faturamento / p.qtd : 0,
        abc: (abcByName.get(p.descricao) || "").charAt(0).toUpperCase(),
      }))
      .sort((a, b) => b.faturamento - a.faturamento)
      .slice(0, 30);
  }, [itemsFiltered, A.rows]);

  const maxFamilia = Math.max(...familias.map(x => x.value), 1);
  const maxCliente = Math.max(...clientes.map(x => x.value), 1);

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Detalhamento</h1>
          <div className="status-line">
            {familias.length} familias · {clientes.length} clientes · {produtos.length} produtos
          </div>
        </div>
        <div className="actions">
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-row">
        <_MiniKpi4 tone="amber" label="Faturamento Total" value={_fmtBR4(F.totais.totalValor)}
          hint={`${F.totais.numItens} itens · ${F.totais.numNFs} NFs`} />
        <_MiniKpi4 tone="cyan" label="Famílias Top 10" value={_fmtBR4(totalFamilias)}
          hint={`${familias.length} de ${F.porFamilia.length}`} />
        <_MiniKpi4 tone="green" label="Clientes Top 14" value={_fmtBR4(totalClientes)}
          hint={`${clientes.length} clientes`} />
      </div>

      {/* 2 Bar lists topo: FAMÍLIA × CLIENTE */}
      <div className="row" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}>
        <div className="card bars-card">
          <h2 className="card-title">VALOR ACUMULADO POR FAMÍLIA DE PRODUTO</h2>
          <div className="rd-barlist">
            {familias.map((f, i) => {
              const w = (f.value / maxFamilia) * 100;
              return (
                <div key={i} className="rd-barrow">
                  <div className="rd-bar">
                    <div className="rd-bar-fill" style={{ width: `${w}%` }} />
                    <span className="rd-bar-label" title={f.name}>
                      {f.name.length > 32 ? f.name.slice(0, 32) + "…" : f.name}
                    </span>
                  </div>
                  <span className="rd-bar-value">R$ {_fmtBR4(f.value)}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card bars-card">
          <h2 className="card-title">VALOR ACUMULADO POR CLIENTE</h2>
          <div className="rd-barlist">
            {clientes.map((c, i) => {
              const w = (c.value / maxCliente) * 100;
              return (
                <div key={i} className="rd-barrow">
                  <div className="rd-bar">
                    <div className="rd-bar-fill" style={{ width: `${w}%` }} />
                    <span className="rd-bar-label" title={c.name}>
                      {c.name.length > 32 ? c.name.slice(0, 32) + "…" : c.name}
                    </span>
                  </div>
                  <span className="rd-bar-value">R$ {_fmtBR4(c.value)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Matriz inferior */}
      <div className="card">
        <div className="card-title-row">
          <h2 className="card-title">QUANTIDADE ACUMULADA × VALOR FATURADO</h2>
          <span className="status-line">{produtos.length} produtos · meses até {monthsToShow[monthsToShow.length - 1] || "—"}</span>
        </div>
        <div className="t-scroll" style={{ maxHeight: 480 }}>
          <table className="t rd-matrix">
            <thead>
              <tr>
                <th style={{ width: 26 }}>ABC</th>
                <th>Produto</th>
                <th className="num">Vendido</th>
                <th className="num">Valor unit.</th>
                <th className="num rd-fat-col">Faturamento</th>
                {monthsToShow.map((m, i) => (
                  <th key={i} className="num">{m}</th>
                ))}
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {produtos.map((p, i) => {
                const qtdMonths = monthsToShowIdx.map(idx => p.meses[idx] || 0);
                const totalMeses = qtdMonths.reduce((s, x) => s + x, 0);
                return (
                  <tr key={i}>
                    <td>
                      <span style={{
                        color: p.abc === "A" ? "var(--green)" : p.abc === "B" ? "var(--cyan)" : "var(--red)",
                        fontWeight: 700,
                      }}>{p.abc}</span>
                    </td>
                    <td title={p.descricao}>{p.descricao.length > 36 ? p.descricao.slice(0, 36) + "…" : p.descricao}</td>
                    <td className="num">{_fmtInt4(p.qtd)}</td>
                    <td className="num">R$ {_fmtBR4(p.valorUnit)}</td>
                    <td className="num rd-fat-col">R$ {_fmtBR4(p.faturamento)}</td>
                    {qtdMonths.map((q, mi) => (
                      <td key={mi} className="num">{_fmtInt4(q)}</td>
                    ))}
                    <td className="num">{_fmtInt4(totalMeses)}</td>
                  </tr>
                );
              })}
              <tr className="total">
                <td colSpan={2}>Total</td>
                <td className="num">{_fmtInt4(produtos.reduce((s, p) => s + p.qtd, 0))}</td>
                <td className="num">—</td>
                <td className="num rd-fat-col">R$ {_fmtBR4(produtos.reduce((s, p) => s + p.faturamento, 0))}</td>
                {monthsToShowIdx.map((idx, mi) => (
                  <td key={mi} className="num">{_fmtInt4(produtos.reduce((s, p) => s + (p.meses[idx] || 0), 0))}</td>
                ))}
                <td className="num">{_fmtInt4(produtos.reduce((s, p) => s + monthsToShowIdx.reduce((a, idx) => a + (p.meses[idx] || 0), 0), 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// PageProfundaCliente — Tabela com bar overlay por linha
// ============================================================
const PageProfundaCliente = ({ statusFilter, year, month, drilldown, setDrilldown }) => {
  const ALL_TX = (typeof window !== "undefined" && window.ALL_TX) || [];
  const REF_YEAR = (typeof window !== "undefined" && window.REF_YEAR) || new Date().getFullYear();

  const [clienteFiltro, setClienteFiltro] = useState("todos");
  const [mesIni, setMesIni] = useState(0);
  const [mesFim, setMesFim] = useState(11);

  const clientesAgg = useMemo(() => {
    const map = new Map();
    const yearTarget = year || REF_YEAR;
    for (const row of ALL_TX) {
      const [kind, mes, dia, categoria, cliente, valor, realizado] = row;
      if (kind !== "r") continue;
      if (!cliente) continue;
      if (!mes) continue;
      const yr = parseInt(mes.slice(0, 4), 10);
      if (yr !== yearTarget) continue;
      const mIdx = parseInt(mes.slice(5, 7), 10) - 1;
      if (mIdx < mesIni || mIdx > mesFim) continue;
      if (statusFilter === "realizado" && realizado !== 1) continue;
      if (statusFilter === "a_pagar_receber" && realizado !== 0) continue;
      if (clienteFiltro !== "todos" && cliente !== clienteFiltro) continue;

      map.set(cliente, (map.get(cliente) || 0) + valor);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [ALL_TX, year, mesIni, mesFim, statusFilter, clienteFiltro, REF_YEAR]);

  const totalGeral = clientesAgg.reduce((s, x) => s + x.value, 0);
  const maxVal = Math.max(...clientesAgg.map(x => x.value), 1);

  const clientesUniq = useMemo(() => {
    const s = new Set();
    for (const row of ALL_TX) { if (row[0] === "r" && row[4]) s.add(row[4]); }
    return Array.from(s).sort();
  }, [ALL_TX]);

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Profunda Cliente</h1>
          <div className="status-line">
            {clientesAgg.length} clientes · {year || REF_YEAR} · meses {mesIni + 1}-{mesFim + 1}
          </div>
        </div>
        <div className="actions">
        </div>
      </div>

      {/* Filtros */}
      <div className="hier-filters">
        <div className="hf-item">
          <label>Cliente</label>
          <select className="filter-select" value={clienteFiltro} onChange={(e) => setClienteFiltro(e.target.value)}>
            <option value="todos">Todos</option>
            {clientesUniq.map(c => <option key={c} value={c}>{c.length > 50 ? c.slice(0, 50) + "…" : c}</option>)}
          </select>
        </div>
        <div className="hf-item">
          <label>Mês inicial</label>
          <select className="filter-select" value={mesIni} onChange={(e) => setMesIni(parseInt(e.target.value, 10))}>
            {["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"].map((m, i) => (
              <option key={i} value={i}>{m}</option>
            ))}
          </select>
        </div>
        <div className="hf-item">
          <label>Mês final</label>
          <select className="filter-select" value={mesFim} onChange={(e) => setMesFim(parseInt(e.target.value, 10))}>
            {["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"].map((m, i) => (
              <option key={i} value={i}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabela com bar overlay por linha */}
      <div className="card pc-card">
        <div className="pc-header">
          <span className="pc-h-conta">Conta</span>
          <span className="pc-h-valor">Valor venda</span>
        </div>
        <div className="pc-list">
          {clientesAgg.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--fg-3)" }}>Nenhum cliente no período.</div>
          ) : (
            clientesAgg.map((c, i) => {
              const w = (c.value / maxVal) * 100;
              return (
                <div key={i} className="pc-row" style={{ "--rowBg": i % 2 === 0 ? "rgba(245,158,11,0.025)" : "transparent" }}>
                  <div className="pc-row-bar" style={{ width: `${w}%` }} />
                  <div className="pc-row-content">
                    <span className="pc-dot" />
                    <span className="pc-name" title={c.name}>
                      {c.name.length > 70 ? c.name.slice(0, 70) + "…" : c.name}
                    </span>
                    <span className="pc-val">R$ {_fmtBR4(c.value)}</span>
                  </div>
                </div>
              );
            })
          )}
          {clientesAgg.length > 0 && (
            <div className="pc-row pc-total">
              <div className="pc-row-content">
                <span className="pc-name" style={{ fontWeight: 700 }}>TOTAL</span>
                <span className="pc-val" style={{ fontWeight: 700, color: "var(--amber)" }}>R$ {_fmtBR4(totalGeral)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// PageCRM — KPIs + 4 boxes meta + FUNIL central + projeção (mock)
// ============================================================

// Helper: SVG funil (5 trapezoides decrescentes)
const _Funnel = ({ levels }) => {
  const w = 420, h = 320;
  const segH = h / levels.length;
  const ks = [0, 0.18, 0.34, 0.5, 0.66, 0.78]; // afunilando

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxWidth: w, display: "block" }}>
      <defs>
        <linearGradient id="fnGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.95" />
          <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.92" />
          <stop offset="100%" stopColor="#b45309" stopOpacity="0.95" />
        </linearGradient>
      </defs>
      {levels.map((lv, i) => {
        const t1 = ks[i] || 0;
        const t2 = ks[i + 1] || 0.85;
        const wTop = w * (1 - t1);
        const wBot = w * (1 - t2);
        const xTop = (w - wTop) / 2;
        const xBot = (w - wBot) / 2;
        const y = i * segH;
        return (
          <g key={i}>
            <polygon
              points={`${xTop},${y} ${xTop + wTop},${y} ${xBot + wBot},${y + segH - 2} ${xBot},${y + segH - 2}`}
              fill="url(#fnGrad)"
              stroke="rgba(255,255,255,0.10)"
              strokeWidth="1"
            />
            <text x={w / 2} y={y + segH / 2 - 4} textAnchor="middle"
              fill="white" fontSize="13" fontWeight="700" letterSpacing="0.04em">
              {lv.label.toUpperCase()}
            </text>
            <text x={w / 2} y={y + segH / 2 + 14} textAnchor="middle"
              fill="white" fontSize="16" fontWeight="800" fontFamily="JetBrains Mono">
              {lv.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

const PageCRM = ({ statusFilter, year, month, drilldown, setDrilldown }) => {
  const E = (typeof window !== "undefined" && window.BIT_EXTRAS) || null;
  const C0 = E && E.crm;
  const hasData = C0 && Array.isArray(C0.rows) && C0.rows.length > 0;

  if (!hasData) {
    return (
      <div className="page">
        <div className="page-title"><div><h1>CRM</h1></div></div>
        <div className="card">
          <h2 className="card-title">Sem dados de CRM</h2>
          <p>Rode <code>node build-data-extras.cjs</code> pra extrair <code>consolidado (33).xlsx</code>.</p>
        </div>
      </div>
    );
  }

  const refYearCRM = (C0.totais && C0.totais.anoCRM) || (window.REF_YEAR || new Date().getFullYear());
  const yearActive = year || refYearCRM;
  const monthIdxFiltered = (month && month > 0) ? (month - 1) : null; // 0-based; null = ano completo

  // Aplica filtro reativo (year + month) no escopo da PageCRM apenas — não toca no build,
  // pra não estragar nada das outras telas. Recomputa totais, funil, aggregates client-side.
  const C = useMemo(() => {
    const FASES_ORDER = ['03 Proposta', '04 Negociação', '05 Aguardando Pedido', '06 Conclusão'];
    const faseRank = (f) => FASES_ORDER.indexOf(f);
    const rows = C0.rows.filter(r => {
      if (r.ano !== yearActive) return false;
      if (monthIdxFiltered != null && r.mes !== monthIdxFiltered) return false;
      return true;
    });
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
    const funil = FASES_ORDER.map(f => ({
      fase: f.replace(/^0\d /, ''), chave: f,
      atual: rows.filter(r => r.fase === f).length,
      cumulativo: rows.filter(r => faseRank(r.fase) >= faseRank(f)).length,
    }));
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
      for (const o of m.values()) o.conversao = o.qtd > 0 ? (o.ganhos / o.qtd) * 100 : 0;
      return [...m.values()].sort((a, b) => b.ticket - a.ticket);
    };
    const porVendedor = aggOpp(r => r.vendedor);
    const porOrigem = aggOpp(r => r.origem);
    const porMotivo = aggOpp(r => r.motivo).filter(x => x.name && x.name !== 'Sem categoria');
    const porTipo = aggOpp(r => r.tipo).filter(x => x.name);
    const porProduto = aggOpp(r => r.produto).filter(x => x.name).slice(0, 15);
    const porMes = Array(12).fill(0).map((_, i) => ({
      m: ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][i],
      leads: 0, ganhos: 0, perdidos: 0, ticket: 0, ticketGanho: 0,
    }));
    // Pra projeção mês a mês, sempre usa o ano inteiro (ignora o filtro de mês)
    const rowsAno = C0.rows.filter(r => r.ano === yearActive);
    for (const r of rowsAno) {
      if (r.mes == null) continue;
      const o = porMes[r.mes];
      o.leads++;
      if (r.ganho) { o.ganhos++; o.ticketGanho += r.ticket; }
      else if (r.perdido) o.perdidos++;
      o.ticket += r.ticket;
    }
    return {
      rows, funil, porVendedor, porOrigem, porMotivo, porTipo, porProduto, porMes,
      totais: {
        totalLeads, totalGanhos, totalPerdidos, totalAbertos,
        taxaConversao, totalTicket, totalGanhoTicket, totalAbertoTicket, totalPerdidoTicket,
        ticketMedio, anoCRM: yearActive,
      },
    };
  }, [C0, yearActive, monthIdxFiltered]);

  const T = C.totais;

  // Funil cumulativo (filtrado: só fases com >0)
  const funil = (C.funil || []).filter(f => f.cumulativo > 0).map(f => ({
    label: f.fase, value: f.cumulativo, atual: f.atual,
  }));
  funil.push({ label: "Conquistadas", value: T.totalGanhos });

  // Top 4 boxes
  const meta = [
    { lbl: "TICKET GANHO", val: T.totalGanhoTicket, tone: "green", pct: Math.min(100, (T.totalGanhoTicket / Math.max(T.totalTicket, 1)) * 100) },
    { lbl: "TICKET PIPELINE (ABERTAS)", val: T.totalAbertoTicket, tone: "amber", pct: Math.min(100, (T.totalAbertoTicket / Math.max(T.totalTicket, 1)) * 100) },
    { lbl: "TICKET PERDIDO", val: T.totalPerdidoTicket, tone: "red", pct: Math.min(100, (T.totalPerdidoTicket / Math.max(T.totalTicket, 1)) * 100) },
    { lbl: "TICKET MÉDIO", val: T.ticketMedio, tone: "green", pct: 100 },
  ];

  // Projeção (ano inteiro, ignora filtro de mês — sempre 12 colunas)
  const projData = (C.porMes || []).slice(0, 12);

  // Metas comerciais
  const META_MES = 1_000_000;
  const META_ANO = 12_000_000;
  const mesAtualIdx = (function() {
    if (monthIdxFiltered != null) return monthIdxFiltered;
    const now = new Date();
    if (now.getFullYear() !== yearActive) return 11;
    return now.getMonth();
  })();
  const ganhoMesAtual = (projData[mesAtualIdx] && projData[mesAtualIdx].ticketGanho) || 0;
  const ganhosMesQtd = (projData[mesAtualIdx] && projData[mesAtualIdx].ganhos) || 0;
  const ganhoAcum = projData.reduce((s, m) => s + m.ticketGanho, 0);
  const ganhosAcumQtd = projData.reduce((s, m) => s + m.ganhos, 0);
  const pctMes = Math.min(100, (ganhoMesAtual / META_MES) * 100);
  const pctAno = Math.min(100, (ganhoAcum / META_ANO) * 100);
  const MESES_NOMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>CRM — Pipeline de Oportunidades</h1>
          <div className="status-line">
            {C.rows.length} leads · ganhos {T.totalGanhos} · perdidos {T.totalPerdidos} · abertos {T.totalAbertos} · {monthIdxFiltered != null ? `${MESES_NOMES[monthIdxFiltered]}/${T.anoCRM}` : `ano ${T.anoCRM}`}
          </div>
        </div>
        <div className="actions">
        </div>
      </div>

      {/* KPIs topo (5: Leads, Conversão, Vendas no mês, Pipeline, Ganho) */}
      <div className="kpi-row">
        <_MiniKpi4 tone="cyan" label="Leads" value={_fmtInt4(T.totalLeads)} nonMonetary hint="oportunidades" />
        <_MiniKpi4 tone="green" label="Conversão" value={T.taxaConversao.toFixed(1).replace(".", ",") + "%"} nonMonetary hint={`${T.totalGanhos} de ${T.totalLeads}`} />
        <_MiniKpi4 tone="amber" label={`Vendas em ${MESES_NOMES[mesAtualIdx].slice(0,3)}`} value={_fmtInt4(ganhosMesQtd)} nonMonetary hint={`R$ ${_fmtBR4(ganhoMesAtual, 0)}`} />
        <_MiniKpi4 tone="amber" label="Pipeline" value={_fmtBR4(T.totalTicket, 0)} hint="ticket somado" />
        <_MiniKpi4 tone="green" label="Ganho" value={_fmtBR4(T.totalGanhoTicket, 0)} hint={`${ganhosAcumQtd} vendas no ano`} />
      </div>

      {/* Metas comerciais — barras horizontais (mês 1M · acumulado 12M) */}
      <div className="card crm-metas-card" style={{ marginTop: 14 }}>
        <h2 className="card-title">METAS COMERCIAIS · {T.anoCRM}</h2>
        <div className="crm-metas-grid">
          <div className="crm-meta-row">
            <div className="crm-meta-row-head">
              <div>
                <div className="crm-meta-row-label">Meta do mês ({MESES_NOMES[mesAtualIdx]})</div>
                <div className="crm-meta-row-sub">R$ {_fmtBR4(ganhoMesAtual, 0)} de R$ {_fmtBR4(META_MES, 0)}</div>
              </div>
              <div className={`crm-meta-pct ${pctMes >= 100 ? 'green' : pctMes >= 70 ? 'cyan' : pctMes >= 40 ? 'amber' : 'red'}`}>
                {pctMes.toFixed(1).replace(".", ",")}%
              </div>
            </div>
            <div className="crm-meta-track">
              <div className={`crm-meta-fill ${pctMes >= 100 ? 'green' : pctMes >= 70 ? 'cyan' : pctMes >= 40 ? 'amber' : 'red'}`} style={{ width: `${pctMes}%` }} />
              {pctMes < 100 && <div className="crm-meta-target" style={{ left: '100%' }} />}
            </div>
          </div>
          <div className="crm-meta-row">
            <div className="crm-meta-row-head">
              <div>
                <div className="crm-meta-row-label">Meta acumulada do ano</div>
                <div className="crm-meta-row-sub">R$ {_fmtBR4(ganhoAcum, 0)} de R$ {_fmtBR4(META_ANO, 0)}</div>
              </div>
              <div className={`crm-meta-pct ${pctAno >= 100 ? 'green' : pctAno >= 70 ? 'cyan' : pctAno >= 40 ? 'amber' : 'red'}`}>
                {pctAno.toFixed(1).replace(".", ",")}%
              </div>
            </div>
            <div className="crm-meta-track">
              <div className={`crm-meta-fill ${pctAno >= 100 ? 'green' : pctAno >= 70 ? 'cyan' : pctAno >= 40 ? 'amber' : 'red'}`} style={{ width: `${pctAno}%` }} />
              {pctAno < 100 && <div className="crm-meta-target" style={{ left: '100%' }} />}
            </div>
          </div>
        </div>
      </div>

      {/* Layout: 4 boxes meta + Funil central + chart projeção */}
      <div className="crm-layout">
        <div className="crm-meta">
          {meta.map((m, i) => (
            <div key={i} className={`crm-meta-box ${m.tone}`}>
              <div className="cmb-label">{m.lbl}</div>
              <div className="cmb-value">R$ {_fmtBR4(m.val, 0)}</div>
              <div className="cmb-bar"><div style={{ width: `${m.pct.toFixed(1)}%` }} /></div>
            </div>
          ))}
        </div>

        <div className="card crm-funnel-card">
          <h2 className="card-title">FUNIL DE VENDAS</h2>
          <_Funnel levels={funil} />
          <div className="crm-funnel-foot">
            <div className="cff-stat">
              <span className="cff-lbl">Conversão Funil</span>
              <span className="cff-val">{T.taxaConversao.toFixed(1).replace(".", ",")}%</span>
            </div>
            <div className="cff-stat">
              <span className="cff-lbl">Conquistadas</span>
              <span className="cff-val">{T.totalGanhos}</span>
            </div>
          </div>
        </div>

        <div className="card crm-proj-card">
          <h2 className="card-title">LEADS × GANHOS POR MÊS ({T.anoCRM})</h2>
          {(() => {
            const maxLeads = Math.max(...projData.map(p => p.leads), 1);
            const W = 380, H = 240, pad = 32;
            const stepX = (W - pad * 2) / Math.max(1, projData.length - 1);
            const yScale = (v) => H - 30 - (v / maxLeads) * (H - pad - 50);
            const linePoints = (vals) => vals.map((v, i) => `${pad + i * stepX},${yScale(v)}`).join(" ");
            return (
              <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
                {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
                  <line key={i} x1={pad} y1={yScale(maxLeads * t)} x2={W - 10} y2={yScale(maxLeads * t)}
                    stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                ))}
                {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
                  <text key={i} x={pad - 6} y={yScale(maxLeads * t) + 3} textAnchor="end" fill="#6b7680" fontSize="9">
                    {Math.round(maxLeads * t)}
                  </text>
                ))}
                {projData.map((p, i) => (
                  <text key={i} x={pad + i * stepX} y={H - 8} textAnchor="middle" fill="#6b7680" fontSize="10">{p.m}</text>
                ))}
                <polyline points={linePoints(projData.map(p => p.leads))} fill="none" stroke="#22d3ee" strokeWidth="2.5" />
                <polyline points={linePoints(projData.map(p => p.ganhos))} fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="5 4" />
                {projData.map((p, i) => (
                  <g key={i}>
                    <circle cx={pad + i * stepX} cy={yScale(p.leads)} r="3" fill="#22d3ee" />
                    {p.ganhos > 0 && <circle cx={pad + i * stepX} cy={yScale(p.ganhos)} r="2.5" fill="#10b981" />}
                  </g>
                ))}
              </svg>
            );
          })()}
          <div className="crm-proj-legend">
            <span><span className="lg-dot" style={{ background: "#22d3ee" }} /> Leads</span>
            <span><span className="lg-dot" style={{ background: "#10b981" }} /> Ganhos</span>
          </div>
        </div>
      </div>

      {/* Linha 2: Vendedor + Origem (lists) */}
      <div className="row" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 16 }}>
        <div className="card">
          <h2 className="card-title">POR VENDEDOR</h2>
          <div className="bar-list with-bars">
            {(C.porVendedor || []).slice(0, 8).map((v, i) => {
              const max = (C.porVendedor[0] && C.porVendedor[0].ticket) || 1;
              const w = (v.ticket / max) * 100;
              return (
                <div key={i} className="bar-row">
                  <div className="row-meta">
                    <span className="label">{v.name} · {v.qtd} opp · {v.conversao.toFixed(0)}% conv</span>
                    <span className="val">R$ {_fmtBR4(v.ticket, 0)}</span>
                  </div>
                  <div className="track"><div className="fill amber" style={{ width: `${w}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="card">
          <h2 className="card-title">POR ORIGEM</h2>
          <div className="bar-list with-bars">
            {(C.porOrigem || []).slice(0, 8).map((o, i) => {
              const max = (C.porOrigem[0] && C.porOrigem[0].ticket) || 1;
              const w = (o.ticket / max) * 100;
              return (
                <div key={i} className="bar-row">
                  <div className="row-meta">
                    <span className="label">{o.name} · {o.qtd} opp</span>
                    <span className="val">R$ {_fmtBR4(o.ticket, 0)}</span>
                  </div>
                  <div className="track"><div className="fill cyan" style={{ width: `${w}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Linha 3: Motivo de perda */}
      {C.porMotivo && C.porMotivo.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2 className="card-title">MOTIVO DE CONCLUSÃO (perdas)</h2>
          <div className="bar-list with-bars">
            {C.porMotivo.slice(0, 8).map((m, i) => {
              const max = (C.porMotivo[0] && C.porMotivo[0].qtd) || 1;
              const w = (m.qtd / max) * 100;
              return (
                <div key={i} className="bar-row">
                  <div className="row-meta">
                    <span className="label">{m.name}</span>
                    <span className="val">{m.qtd} opp · R$ {_fmtBR4(m.ticket, 0)}</span>
                  </div>
                  <div className="track"><div className="fill red" style={{ width: `${w}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="status-line" style={{ marginTop: 12, fontSize: 11, color: "var(--fg-3)" }}>
        Fonte: <code>consolidado (33).xlsx</code> · {C.rows.length} oportunidades extraídas. Atualize via <code>node build-data-extras.cjs</code>.
      </div>
    </div>
  );
};

Object.assign(window, { PageHierarquia, PageDetalhado, PageProfundaCliente, PageCRM });
