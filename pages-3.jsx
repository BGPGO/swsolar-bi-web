/* BI/Cliente — Pages 3: telas extras do PBIX Personalizado (Faturamento por Produto, Curva ABC, Marketing ADS) */
const { useState, useMemo } = React;

// ---------- helpers ----------
const formatBR = (n, dec = 2) => {
  if (n == null || isNaN(n)) return "0,00";
  const s = Math.abs(n).toFixed(dec);
  const [int, d] = s.split(".");
  const formatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (d ? "," + d : "");
  return (n < 0 ? "-" : "") + formatted;
};
const formatInt = (n) => formatBR(n, 0);

// Mini-card compativel com .kpi-tile do molde
const MiniKpi = ({ label, value, hint, tone, nonMonetary }) => (
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
// PageFaturamentoProduto — replica "FaturamentoPorProduto" do PBIX
// (laranja primario #ff6b18, layout fiel ao print)
// ============================================================
const ORANGE = "#ff6b18";
const ORANGE_DIM = "rgba(255, 107, 24, 0.18)";

// Bar list horizontal laranja simples (label esquerda, valor direita, fill animado)
const FatBarList = ({ items, color = ORANGE, formatter = (v) => "R$ " + formatBR(v) }) => {
  if (!items.length) return <div className="status-line">Sem dados.</div>;
  const max = Math.max(...items.map(it => it.value)) || 1;
  return (
    <div className="fat-barlist">
      {items.map((it, i) => {
        const w = (it.value / max) * 100;
        return (
          <div key={i} className="fat-barrow">
            <div className="fat-barrow-label" title={it.name}>{it.name}</div>
            <div className="fat-barrow-track">
              <div className="fat-barrow-fill" style={{ width: `${w}%`, background: color }} />
              <div className="fat-barrow-val">{formatter(it.value)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Vertical bars laranja (igual SingleBars mas com cor laranja explícita e label embaixo)
const FatVerticalBars = ({ items, height = 240, formatter = (v) => "R$ " + formatBR(v, 0) }) => {
  if (!items.length) return <div className="status-line">Sem dados.</div>;
  const max = Math.max(...items.map(it => it.value)) || 1;
  return (
    <div className="fat-vbars" style={{ height }}>
      {items.map((it, i) => {
        const h = (it.value / max) * 100;
        return (
          <div key={i} className="fat-vbar-col" title={`${it.name}: ${formatter(it.value)}`}>
            <div className="fat-vbar-stack">
              <span className="fat-vbar-val">{formatter(it.value)}</span>
              <div className="fat-vbar-bar" style={{ height: `${h}%`, background: ORANGE }} />
            </div>
            <span className="fat-vbar-x" title={it.name}>{it.name.length > 14 ? it.name.slice(0, 14) + "…" : it.name}</span>
          </div>
        );
      })}
    </div>
  );
};

const PageFaturamentoProduto = ({ drilldown, setDrilldown }) => {
  const E = (typeof window !== "undefined" && window.BIT_EXTRAS) || null;
  if (!E || !E.faturamento || !E.faturamento.items) {
    return (
      <div className="page">
        <div className="page-title"><div><h1>Faturamento por Produto</h1></div></div>
        <div className="card"><h2 className="card-title">Sem dados</h2><p>Rode <code>node build-data-extras.cjs</code> pra gerar data-extras.js.</p></div>
      </div>
    );
  }

  // Filtros reativos
  const [fMes, setFMes] = useState("Todos");
  const [fVendedor, setFVendedor] = useState("Todos");
  const [fFamilia, setFFamilia] = useState("Todos");

  const MESES_ABBR = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  const items = E.faturamento.items;

  // Aplica todos os filtros nos items raw e recomputa todos os agregados
  const filtered = useMemo(() => {
    return items.filter(it => {
      if (fMes !== "Todos" && MESES_ABBR[it.mes] !== fMes) return false;
      if (fVendedor !== "Todos" && it.vendedor !== fVendedor) return false;
      if (fFamilia !== "Todos" && it.familia !== fFamilia) return false;
      return true;
    });
  }, [items, fMes, fVendedor, fFamilia]);

  // Recomputa agregados a partir de filtered
  const aggBy = (arr, keyFn) => {
    const m = new Map();
    for (const it of arr) {
      const k = keyFn(it) || 'Sem categoria';
      if (!m.has(k)) m.set(k, { name: k, value: 0, qtd: 0 });
      const o = m.get(k);
      o.value += it.valor;
      o.qtd += it.qtd || 0;
    }
    return [...m.values()].sort((a, b) => b.value - a.value);
  };

  const T = useMemo(() => {
    const totalValor = filtered.reduce((s, it) => s + it.valor, 0);
    const totalQtd = filtered.reduce((s, it) => s + it.qtd, 0);
    const numNFs = new Set(filtered.map(it => it.nf).filter(Boolean)).size;
    const numClientes = new Set(filtered.map(it => it.cliente).filter(Boolean)).size;
    const numProdutos = new Set(filtered.map(it => it.produto).filter(Boolean)).size;
    const ticketMedio = numNFs > 0 ? totalValor / numNFs : 0;
    return { totalValor, totalQtd, numNFs, numClientes, numProdutos, ticketMedio, anoRef: E.faturamento.totais.anoRef };
  }, [filtered, E.faturamento.totais.anoRef]);

  const porFamilia = useMemo(() => aggBy(filtered, x => x.familia).slice(0, 20), [filtered]);
  const porVendedor = useMemo(() => aggBy(filtered, x => x.vendedor).slice(0, 20), [filtered]);

  // Vendas por Anúncio = vendas por família (real, do XLSX)
  const vendasPorAnuncio = useMemo(() => porFamilia.slice(0, 8), [porFamilia]);

  // Top produtos individuais
  const topProdutos = useMemo(() => {
    return aggBy(filtered, x => x.produto).slice(0, 6).map(d => ({
      name: d.name.length > 40 ? d.name.slice(0, 40) + '…' : d.name, value: d.value,
    }));
  }, [filtered]);

  // Top vendedores (filtra "Sem Vendedor"/"N/D")
  const topVendedores = useMemo(() => {
    return porVendedor.filter(v => v.name && v.name !== "N/D" && v.name !== "Sem Vendedor").slice(0, 6);
  }, [porVendedor]);

  // Matriz produto × mês (de filtered)
  const matrizProdutosFull = useMemo(() => {
    const map = new Map();
    for (const it of filtered) {
      if (it.mes == null) continue;
      if (!map.has(it.produto)) map.set(it.produto, { nome: it.produto, total: 0, meses: Array(12).fill(0) });
      const o = map.get(it.produto);
      o.total += it.valor;
      o.meses[it.mes] += it.valor;
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [filtered]);

  const matrizMesesIdx = useMemo(() => {
    const set = new Set();
    matrizProdutosFull.forEach(p => p.meses.forEach((v, i) => { if (v > 0) set.add(i); }));
    return [...set].sort((a, b) => a - b);
  }, [matrizProdutosFull]);
  const matrizMeses = useMemo(() => matrizMesesIdx.map(i => MESES_ABBR[i]), [matrizMesesIdx]);
  const matrizProdutos = useMemo(() => {
    return matrizProdutosFull.slice(0, 10).map(p => {
      const cleanName = p.nome.includes("▸") ? p.nome.split("▸").pop().trim() : p.nome;
      return { nome: cleanName, total: p.total, meses: matrizMesesIdx.map(i => p.meses[i] || 0) };
    });
  }, [matrizProdutosFull, matrizMesesIdx]);

  // Opções dos dropdowns (sempre todas, calculadas dos items raw)
  const mesOpts = useMemo(() => ["Todos", ...[...new Set(items.map(it => MESES_ABBR[it.mes]).filter(Boolean))]], [items]);
  const familiaOpts = useMemo(() => ["Todos", ...[...new Set(items.map(it => it.familia).filter(f => f && f !== 'Sem Família'))].sort()], [items]);
  const vendedorOpts = useMemo(() => ["Todos", ...[...new Set(items.map(it => it.vendedor).filter(v => v && v !== 'N/D' && v !== 'Sem Vendedor'))].sort()], [items]);

  const filtroAtivo = fMes !== "Todos" || fVendedor !== "Todos" || fFamilia !== "Todos";
  const limparFiltros = () => { setFMes("Todos"); setFVendedor("Todos"); setFFamilia("Todos"); };

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Faturamento por Produto</h1>
          <div className="status-line">
            {T.numNFs} NFs · {T.numProdutos} produtos · {T.numClientes} clientes · ano {T.anoRef}
            {filtroAtivo && <> · <b style={{ color: "var(--cyan)" }}>filtrado</b></>}
          </div>
        </div>
        <div className="actions">
          {filtroAtivo && <button className="btn-ghost" onClick={limparFiltros}>Limpar filtros</button>}
        </div>
      </div>

      {/* ===== Header de filtros funcionais ===== */}
      <div className="fat-filters">
        <label className="fat-filter">
          <span>Mês</span>
          <select className="filter-select" value={fMes} onChange={e => setFMes(e.target.value)}>
            {mesOpts.map(o => <option key={o}>{o}</option>)}
          </select>
        </label>
        <label className="fat-filter">
          <span>Vendedor</span>
          <select className="filter-select" value={fVendedor} onChange={e => setFVendedor(e.target.value)}>
            {vendedorOpts.map(o => <option key={o}>{o}</option>)}
          </select>
        </label>
        <label className="fat-filter">
          <span>Família</span>
          <select className="filter-select" value={fFamilia} onChange={e => setFFamilia(e.target.value)}>
            {familiaOpts.map(o => <option key={o}>{o}</option>)}
          </select>
        </label>
      </div>

      {/* ===== Linha 1: Métricas Gerais (esquerda) + Vendas por Anúncio (direita) ===== */}
      <div className="row fat-row-1">
        <div className="card fat-metricas">
          <div className="fat-metricas-title">MÉTRICAS GERAIS</div>
          <div className="fat-metricas-grid">
            <div className="fat-metric">
              <div className="fat-metric-label">Vendas</div>
              <div className="fat-metric-value">R$ {formatBR(T.totalValor)}</div>
            </div>
            <div className="fat-metric">
              <div className="fat-metric-label">Quantidade vendida</div>
              <div className="fat-metric-value">{formatBR(T.totalQtd)}</div>
            </div>
            <div className="fat-metric">
              <div className="fat-metric-label">Ticket médio</div>
              <div className="fat-metric-value">R$ {formatBR(T.ticketMedio)}</div>
            </div>
          </div>
        </div>
        <div className="card fat-vendas-anuncio">
          <h2 className="card-title">VENDAS POR ANÚNCIO</h2>
          <FatVerticalBars items={vendasPorAnuncio} height={260} />
        </div>
      </div>

      {/* ===== Linha 2: Ranking Produto + Ranking Vendedor (esquerda 2 cards) | Matriz (direita) ===== */}
      <div className="row fat-row-2">
        <div className="fat-col-rankings">
          <div className="card">
            <h2 className="card-title">RANKING POR PRODUTO</h2>
            <FatBarList items={topProdutos} />
          </div>
          <div className="card">
            <h2 className="card-title">RANKING POR VENDEDOR</h2>
            <FatBarList items={topVendedores} />
          </div>
        </div>
        <div className="card fat-matriz">
          <h2 className="card-title">ANÁLISE DE PRODUTOS POR ANÚNCIO</h2>
          <div className="t-scroll" style={{ maxHeight: 420 }}>
            <table className="t fat-matriz-tbl">
              <thead>
                <tr>
                  <th>Produto</th>
                  {matrizMeses.map(m => <th key={m} className="num">{m}</th>)}
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {matrizProdutos.map((p, i) => (
                  <tr key={i}>
                    <td title={p.nome}>{p.nome.length > 28 ? p.nome.slice(0, 28) + "…" : p.nome}</td>
                    {p.meses.map((v, j) => (
                      <td key={j} className="num" style={{ color: v > 0 ? ORANGE : "var(--fg-3)" }}>
                        {v > 0 ? formatBR(v, 0) : "—"}
                      </td>
                    ))}
                    <td className="num" style={{ color: "var(--text)", fontWeight: 700 }}>{formatBR(p.total, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// PageCurvaABC — replica "Detalhado" (Curva ABC de Produtos) do PBIX
// ============================================================
const PageCurvaABC = ({ drilldown, setDrilldown }) => {
  const E = (typeof window !== "undefined" && window.BIT_EXTRAS) || null;
  if (!E || !E.abc) {
    return (
      <div className="page">
        <div className="page-title"><div><h1>Curva ABC</h1></div></div>
        <div className="card"><h2 className="card-title">Sem dados</h2><p>Rode <code>node build-data-extras.cjs</code>.</p></div>
      </div>
    );
  }
  const A = E.abc;
  const [classFilter, setClassFilter] = useState("todas"); // todas | A | B | C

  const filtered = useMemo(() => {
    if (classFilter === "todas") return A.rows;
    return A.rows.filter(r => (r.abc || "").charAt(0).toUpperCase() === classFilter);
  }, [classFilter, A.rows]);

  // top 20 por valor
  const top20 = useMemo(() => filtered.slice().sort((a, b) => b.valorFaturado - a.valorFaturado).slice(0, 20), [filtered]);

  // Curva acumulada (ordem original do XLSX, ja sortada)
  const curvaPts = A.rows.map((r, i) => ({
    x: i + 1,
    pct: r.pctAcumulado || 0,
  }));
  const curvaValues = A.rows.map(r => r.pctAcumulado || 0);
  const curvaLabels = A.rows.map((_, i) => i % 30 === 0 ? String(i + 1) : "");

  // Totais por classe
  const totaisPorClasse = ["A", "B", "C"].map(k => {
    const items = A.rows.filter(r => (r.abc || "").charAt(0).toUpperCase() === k);
    return {
      classe: k,
      qtd: items.length,
      valor: items.reduce((s, x) => s + x.valorFaturado, 0),
    };
  });
  const totalGeral = totaisPorClasse.reduce((s, x) => s + x.valor, 0);

  // colorir top20 por classe
  const colorByABC = (abc) => {
    const k = (abc || "").charAt(0).toUpperCase();
    if (k === "A") return "green";
    if (k === "B") return "cyan";
    return "red";
  };

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Curva ABC de Produtos</h1>
          <div className="status-line">{A.total} produtos · A: {A.counts.A} · B: {A.counts.B} · C: {A.counts.C}</div>
        </div>
        <div className="actions">
          <div className="seg">
            <button className={classFilter === "todas" ? "active" : ""} onClick={() => setClassFilter("todas")}>Todas</button>
            <button className={classFilter === "A" ? "active" : ""} onClick={() => setClassFilter("A")}>A (top)</button>
            <button className={classFilter === "B" ? "active" : ""} onClick={() => setClassFilter("B")}>B</button>
            <button className={classFilter === "C" ? "active" : ""} onClick={() => setClassFilter("C")}>C</button>
          </div>
        </div>
      </div>

      <div className="kpi-row">
        {totaisPorClasse.map(t => (
          <MiniKpi
            key={t.classe}
            tone={t.classe === "A" ? "green" : (t.classe === "B" ? "cyan" : "red")}
            label={`Classe ${t.classe}`}
            value={formatBR(t.valor)}
            hint={`${t.qtd} produtos · ${totalGeral > 0 ? ((t.valor / totalGeral) * 100).toFixed(1).replace(".", ",") : "0"}% do total`}
          />
        ))}
        <MiniKpi tone="amber" label="Faturamento Total" value={formatBR(totalGeral)} hint={`${A.total} produtos`} />
      </div>

      <div className="row" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}>
        <div className="card">
          <h2 className="card-title">Top 20 produtos {classFilter !== "todas" ? `(classe ${classFilter})` : ""}</h2>
          <div className="bar-list with-bars">
            {top20.map((p, i) => {
              const max = top20[0]?.valorFaturado || 1;
              const w = (p.valorFaturado / max) * 100;
              const color = colorByABC(p.abc);
              return (
                <div key={i} className="bar-row">
                  <div className="row-meta">
                    <span className="label" title={p.descricao}>
                      <span className={`badge`} style={{ background: color === "green" ? "var(--green)" : color === "cyan" ? "var(--cyan)" : "var(--red)", color: "#0b0f14", marginRight: 6, padding: "1px 5px", borderRadius: 3, fontSize: 10 }}>{(p.abc || "").charAt(0)}</span>
                      {p.descricao.length > 50 ? p.descricao.slice(0, 50) + "…" : p.descricao}
                    </span>
                    <span className="val">R$ {formatBR(p.valorFaturado)}</span>
                  </div>
                  <div className="track"><div className={`fill ${color}`} style={{ width: `${w}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Curva acumulada (% do faturamento)</h2>
          <TrendChart
            values={curvaValues}
            labels={curvaLabels}
            color="var(--cyan)"
            height={260}
            showPoints={false}
            showLabels={false}
            gradientId="curve-abc"
          />
          <div className="status-line" style={{ marginTop: 8 }}>
            Eixo X = ranking do produto (1 a {A.total}). Eixo Y = % acumulado do faturamento. Curva tipica 80/20.
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title-row">
          <h2 className="card-title">Tabela completa</h2>
          <span className="status-line">{filtered.length} produtos</span>
        </div>
        <div className="t-scroll" style={{ maxHeight: 420 }}>
          <table className="t">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Classe</th>
                <th>Familia</th>
                <th>Produto</th>
                <th className="num">Qtd</th>
                <th className="num">Valor</th>
                <th className="num">% Acum</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((p, i) => (
                <tr key={i}>
                  <td>{p.ordem || i + 1}</td>
                  <td><span style={{ color: colorByABC(p.abc) === "green" ? "var(--green)" : colorByABC(p.abc) === "cyan" ? "var(--cyan)" : "var(--red)", fontWeight: 700 }}>{(p.abc || "").charAt(0)}</span></td>
                  <td>{p.familia || "—"}</td>
                  <td title={p.descricao}>{p.descricao.length > 60 ? p.descricao.slice(0, 60) + "…" : p.descricao}</td>
                  <td className="num">{formatInt(p.qtdFaturada)}</td>
                  <td className="num green">R$ {formatBR(p.valorFaturado)}</td>
                  <td className="num">{(p.pctAcumulado || 0).toFixed(2).replace(".", ",")}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// PageMarketing — replica "Analise Profunda" (Facebook ADS) do PBIX
// (laranja primario #ff6b18, layout fiel ao print)
// ============================================================

// Bar list horizontal laranja para campanhas (cliques)
const MktBarList = ({ items, color = ORANGE, formatter = (v) => formatInt(v) }) => {
  if (!items.length) return <div className="status-line">Sem dados.</div>;
  const max = Math.max(...items.map(it => it.value)) || 1;
  return (
    <div className="mkt-barlist">
      {items.map((it, i) => {
        const w = (it.value / max) * 100;
        return (
          <div key={i} className="mkt-barrow">
            <div className="mkt-barrow-label" title={it.name}>{it.name}</div>
            <div className="mkt-barrow-track">
              <div className="mkt-barrow-fill" style={{ width: `${w}%`, background: color }} />
              <div className="mkt-barrow-val">{formatter(it.value)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Vertical bars (leads por anuncio) — coluna laranja, label vertical embaixo, valor acima
const MktVerticalBars = ({ items, height = 240, formatter = (v) => formatInt(v) }) => {
  if (!items.length) return <div className="status-line">Sem dados.</div>;
  const max = Math.max(...items.map(it => it.value)) || 1;
  return (
    <div className="mkt-vbars" style={{ height }}>
      {items.map((it, i) => {
        const h = Math.max((it.value / max) * 100, 1);
        return (
          <div key={i} className="mkt-vbar-col" title={`${it.name}: ${formatter(it.value)}`}>
            <span className="mkt-vbar-val">{formatter(it.value)}</span>
            <div className="mkt-vbar-bar" style={{ height: `${h}%` }} />
            <span className="mkt-vbar-x" title={it.name}>{it.name.length > 12 ? it.name.slice(0, 12) + "…" : it.name}</span>
          </div>
        );
      })}
    </div>
  );
};

// CPM × Valor Investido — line + dashed area chart (sem date column real, plota por campanha)
const MktCpmChart = ({ campanhas, height = 260 }) => {
  if (!campanhas.length) return <div className="status-line">Sem dados.</div>;
  const w = 1000, h = height;
  const padX = 50, padTop = 26, padBottom = 50;
  const cpmVals = campanhas.map(c => c.cpm || 0);
  const valVals = campanhas.map(c => c.valorBRL || 0);
  const cpmMax = Math.max(...cpmVals) * 1.1 || 1;
  const valMax = Math.max(...valVals) * 1.1 || 1;
  const stepX = (w - padX * 2) / Math.max(1, campanhas.length - 1);

  const cpmPts = cpmVals.map((v, i) => [
    padX + i * stepX,
    padTop + (1 - v / cpmMax) * (h - padTop - padBottom),
  ]);
  const valPts = valVals.map((v, i) => [
    padX + i * stepX,
    padTop + (1 - v / valMax) * (h - padTop - padBottom),
  ]);

  const lineCpm = cpmPts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const lineVal = valPts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const baseY = h - padBottom;
  const areaCpm = lineCpm + ` L ${cpmPts[cpmPts.length - 1][0]} ${baseY} L ${cpmPts[0][0]} ${baseY} Z`;

  // y axis ticks (lado esquerdo = CPM)
  const ticks = 5;
  const tickVals = Array.from({ length: ticks }, (_, i) => (cpmMax / (ticks - 1)) * i);

  return (
    <svg className="mkt-cpm-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ height, width: "100%" }}>
      <defs>
        <linearGradient id="mkt-cpm-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ORANGE} stopOpacity="0.30" />
          <stop offset="100%" stopColor={ORANGE} stopOpacity="0" />
        </linearGradient>
      </defs>
      {tickVals.map((tv, i) => {
        const y = padTop + (1 - tv / cpmMax) * (h - padTop - padBottom);
        return (
          <g key={i}>
            <line x1={padX} y1={y} x2={w - 10} y2={y} stroke="rgba(255,255,255,0.04)" strokeDasharray="3 4" />
            <text x={padX - 8} y={y + 3} textAnchor="end" fontSize="10" fill="var(--mute)">
              {tv.toFixed(1).replace(".", ",")}
            </text>
          </g>
        );
      })}
      {/* área de CPM (cyan-ish base translúcida) */}
      <path d={areaCpm} fill="url(#mkt-cpm-area)" />
      <path d={lineCpm} fill="none" stroke={ORANGE} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      {/* linha tracejada VALOR INVESTIDO */}
      <path d={lineVal} fill="none" stroke="var(--cyan)" strokeWidth="2" strokeDasharray="6 4" strokeLinejoin="round" strokeLinecap="round" />
      {/* pontos CPM */}
      {cpmPts.map((p, i) => (
        <circle key={"c" + i} cx={p[0]} cy={p[1]} r="3.5" fill={ORANGE} stroke="#0b0f14" strokeWidth="1.5" />
      ))}
      {/* labels eixo X (campanhas) */}
      {campanhas.map((c, i) => {
        const x = padX + i * stepX;
        const label = c.campanha.length > 14 ? c.campanha.slice(0, 14) + "…" : c.campanha;
        return (
          <text key={"x" + i} x={x} y={h - 16} textAnchor="middle" fontSize="9" fill="var(--mute)">
            {label}
          </text>
        );
      })}
      {/* legenda */}
      <g transform={`translate(${padX}, 12)`}>
        <line x1="0" y1="0" x2="18" y2="0" stroke={ORANGE} strokeWidth="2.2" />
        <text x="24" y="3" fontSize="10" fill="var(--text-2)">CPM</text>
        <line x1="80" y1="0" x2="98" y2="0" stroke="var(--cyan)" strokeWidth="2" strokeDasharray="6 4" />
        <text x="104" y="3" fontSize="10" fill="var(--text-2)">Valor Investido</text>
      </g>
    </svg>
  );
};

const PageMarketing = ({ drilldown, setDrilldown }) => {
  const E = (typeof window !== "undefined" && window.BIT_EXTRAS) || null;
  if (!E || !E.ads) {
    return (
      <div className="page">
        <div className="page-title"><div><h1>Marketing ADS</h1></div></div>
        <div className="card"><h2 className="card-title">Sem dados</h2><p>Rode <code>node build-data-extras.cjs</code>.</p></div>
      </div>
    );
  }
  const M = E.ads;

  // Filtros reativos
  const [fCamp, setFCamp] = useState("Todos");
  const [fAnuncio, setFAnuncio] = useState("Todos");

  const campanhasOpts = useMemo(() => ["Todos", ...[...new Set(M.rows.map(r => r.campanha).filter(Boolean))].sort()], [M.rows]);
  const anuncioOpts = useMemo(() => {
    const set = new Set(M.rows.map(r => r.anuncio).filter(a => a && a !== "All"));
    return ["Todos", ...[...set].sort()];
  }, [M.rows]);

  // Filtra rows raw e recomputa tudo
  const rowsFiltered = useMemo(() => {
    return M.rows.filter(r => {
      if (fCamp !== "Todos" && r.campanha !== fCamp) return false;
      if (fAnuncio !== "Todos" && r.anuncio !== fAnuncio) return false;
      return true;
    });
  }, [M.rows, fCamp, fAnuncio]);

  const T = useMemo(() => {
    const gastoTotal = rowsFiltered.reduce((s, r) => s + r.valorBRL, 0);
    const alcanceTotal = rowsFiltered.reduce((s, r) => s + r.alcance, 0);
    const impressoesTotal = rowsFiltered.reduce((s, r) => s + r.impressoes, 0);
    const cliquesTotal = rowsFiltered.reduce((s, r) => s + r.cliques, 0);
    const resultadosTotal = rowsFiltered.reduce((s, r) => s + r.resultados, 0);
    const numCampanhas = new Set(rowsFiltered.map(r => r.campanha).filter(Boolean)).size;
    return {
      gastoTotal, alcanceTotal, impressoesTotal, cliquesTotal, resultadosTotal, numCampanhas,
      cpmMedio: impressoesTotal > 0 ? (gastoTotal / impressoesTotal) * 1000 : 0,
      cpcMedio: cliquesTotal > 0 ? gastoTotal / cliquesTotal : 0,
    };
  }, [rowsFiltered]);

  // CampanhasAgg (filtered) — usado no chart CPM × Valor
  const campanhasAgg = useMemo(() => {
    const map = new Map();
    for (const it of rowsFiltered) {
      if (!it.campanha) continue;
      if (!map.has(it.campanha)) map.set(it.campanha, { campanha: it.campanha, valorBRL: 0, alcance: 0, impressoes: 0, cliques: 0, resultados: 0, leads: 0 });
      const o = map.get(it.campanha);
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
    }
    return [...map.values()].sort((a, b) => b.valorBRL - a.valorBRL);
  }, [rowsFiltered]);

  const cpmGlobal = T.cpmMedio || 0;
  const cpcGlobal = T.cpcMedio || 0;
  const freqGlobal = T.alcanceTotal > 0 ? T.impressoesTotal / T.alcanceTotal : 0;
  const impactoVal = T.resultadosTotal || 0;

  const topCampCliques = useMemo(() => {
    return campanhasAgg.slice().sort((a, b) => b.cliques - a.cliques).slice(0, 6).map(c => ({ name: c.campanha, value: c.cliques }));
  }, [campanhasAgg]);

  const leadsPorAnuncio = useMemo(() => {
    const byAd = new Map();
    for (const r of rowsFiltered) {
      if (!r.anuncio || r.anuncio === "All") continue;
      if (!byAd.has(r.anuncio)) byAd.set(r.anuncio, { name: r.anuncio, leads: 0, cliques: 0 });
      const o = byAd.get(r.anuncio);
      o.leads += r.leads || 0;
      o.cliques += r.cliques || 0;
    }
    const arr = [...byAd.values()];
    const useLeads = arr.some(x => x.leads > 0);
    return arr.map(x => ({ name: x.name, value: useLeads ? x.leads : x.cliques })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [rowsFiltered]);

  const filtroAtivo = fCamp !== "Todos" || fAnuncio !== "Todos";
  const limparFiltros = () => { setFCamp("Todos"); setFAnuncio("Todos"); };

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Análise Profunda — Marketing ADS</h1>
          <div className="status-line">
            {T.numCampanhas} campanhas · gasto total R$ {formatBR(T.gastoTotal)}
            {filtroAtivo && <> · <b style={{ color: "var(--cyan)" }}>filtrado</b></>}
          </div>
        </div>
        <div className="actions">
          {filtroAtivo && <button className="btn-ghost" onClick={limparFiltros}>Limpar filtros</button>}
        </div>
      </div>

      {/* ===== Header de filtros funcionais ===== */}
      <div className="mkt-filters">
        <label className="mkt-filter">
          <span>Campanha</span>
          <select className="filter-select" value={fCamp} onChange={e => setFCamp(e.target.value)}>
            {campanhasOpts.map(o => <option key={o}>{o}</option>)}
          </select>
        </label>
        <label className="mkt-filter">
          <span>Anúncio</span>
          <select className="filter-select" value={fAnuncio} onChange={e => setFAnuncio(e.target.value)}>
            {anuncioOpts.map(o => <option key={o}>{o}</option>)}
          </select>
        </label>
      </div>

      {/* ===== 4 KPI tiles (igual print: CUSTOS/IMPRESSOES, CLIQUES, IMPRESSOES, IMPACTO) ===== */}
      <div className="mkt-kpis">
        <div className="mkt-kpi">
          <div className="mkt-kpi-label">CUSTOS / IMPRESSÕES</div>
          <div className="mkt-kpi-value mkt-kpi-orange">R$ {formatBR(T.gastoTotal)}</div>
          <div className="mkt-kpi-sub">CPM <b>R$ {formatBR(cpmGlobal)}</b></div>
        </div>
        <div className="mkt-kpi">
          <div className="mkt-kpi-label">CLIQUES ADS</div>
          <div className="mkt-kpi-value mkt-kpi-orange">{formatInt(T.cliquesTotal)}</div>
          <div className="mkt-kpi-sub">Cliques ADS · CPC <b>R$ {formatBR(cpcGlobal)}</b></div>
        </div>
        <div className="mkt-kpi">
          <div className="mkt-kpi-label">IMPRESSÕES ADS</div>
          <div className="mkt-kpi-value mkt-kpi-orange">{formatInt(T.impressoesTotal)}</div>
          <div className="mkt-kpi-sub">Impacto <b>{formatBR(impactoVal)}</b> · Frequência <b>{freqGlobal.toFixed(2).replace(".", ",")}</b></div>
        </div>
        <div className="mkt-kpi">
          <div className="mkt-kpi-label">IMPACTO ADS</div>
          <div className="mkt-kpi-value mkt-kpi-orange">{formatInt(T.alcanceTotal)}</div>
          <div className="mkt-kpi-sub">Alcance · {T.numCampanhas} campanhas</div>
        </div>
      </div>

      {/* ===== Linha 2: CPM × Valor Investido (esquerda) | Cliques por Campanha (direita) ===== */}
      <div className="row mkt-row-1">
        <div className="card mkt-cpm-card">
          <h2 className="card-title">CPM × VALOR INVESTIDO</h2>
          <MktCpmChart campanhas={campanhasAgg} height={260} />
        </div>
        <div className="card mkt-cliques-card">
          <h2 className="card-title">CLIQUES POR CAMPANHA</h2>
          <MktBarList items={topCampCliques} />
        </div>
      </div>

      {/* ===== Linha 3: Leads por Anúncio (full width) ===== */}
      <div className="card mkt-leads-card">
        <h2 className="card-title">LEADS POR ANÚNCIO</h2>
        <MktVerticalBars items={leadsPorAnuncio} height={260} />
      </div>
    </div>
  );
};

// ============================================================
// PageValuation — replica ValuationTab do fin40 (DCF de 5 anos)
// Premissas default = do cliente (valuation_premissas.json):
//   growth_year2: 20, growth_year3: 20, ipca: 4.5, wacc: 25,
//   perpetuity_growth: 10, use_simulated_margin: false, simulated_margin: 15
// Persistencia local em localStorage.bi.valuation
// ============================================================
const VALUATION_LS_KEY = "bi.valuation";
const VALUATION_DEFAULTS = {
  growth_year2: 20,
  growth_year3: 20,
  ipca: 4.5,
  wacc: 25,
  perpetuity_growth: 10,
  use_simulated_margin: false,
  simulated_margin: 15,
};

function loadValuationPremissas() {
  try {
    const raw = localStorage.getItem(VALUATION_LS_KEY);
    if (!raw) return { ...VALUATION_DEFAULTS };
    const parsed = JSON.parse(raw);
    return { ...VALUATION_DEFAULTS, ...parsed };
  } catch (e) {
    return { ...VALUATION_DEFAULTS };
  }
}

function saveValuationPremissas(p) {
  try { localStorage.setItem(VALUATION_LS_KEY, JSON.stringify(p)); } catch (e) {}
}

// Slider + input numerico com label e sufixo (%)
const PctSlider = ({ label, value, onChange, min = 0, max = 100, step = 0.5 }) => {
  return (
    <div className="val-pct">
      <div className="val-pct-head">
        <span className="val-pct-label">{label}</span>
        <span className="val-pct-value">{(value || 0).toFixed(1).replace(".", ",")}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: "var(--cyan)" }}
      />
      <input
        type="number"
        className="filter-select"
        style={{ marginTop: 6, height: 28, fontSize: 12, padding: "2px 8px" }}
        value={value}
        step={step}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
      />
    </div>
  );
};

const PageValuation = () => {
  const B = window.BIT || {};
  const REF_YEAR = window.REF_YEAR || new Date().getFullYear();
  const fmt = B.fmt || ((n) => "R$ " + formatBR(n || 0));

  // ----- Estado: premissas editaveis (localStorage) -----
  const [premissas, setPremissasState] = useState(() => loadValuationPremissas());

  const updatePremissa = (patch) => {
    setPremissasState((prev) => {
      const next = { ...prev, ...patch };
      saveValuationPremissas(next);
      return next;
    });
  };

  const resetPremissas = () => {
    setPremissasState({ ...VALUATION_DEFAULTS });
    saveValuationPremissas({ ...VALUATION_DEFAULTS });
  };

  // ----- Inputs derivados de window.BIT -----
  // MONTH_DATA tem 12 meses do ano REF_YEAR ja. Receita YTD = soma dos meses
  // que tem receita > 0 (i.e., os meses com dados realizados/orcados).
  const MD = Array.isArray(B.MONTH_DATA) ? B.MONTH_DATA : [];
  const monthsWithData = MD.filter(m => (m.receita || 0) > 0 || (m.despesa || 0) > 0);
  const monthCount = Math.max(1, monthsWithData.length);
  const totalRecYTD = MD.reduce((s, m) => s + (m.receita || 0), 0);
  const totalDespYTD = MD.reduce((s, m) => s + (m.despesa || 0), 0);
  const resultadoYTD = totalRecYTD - totalDespYTD;
  const margemEfetiva = totalRecYTD > 0 ? (resultadoYTD / totalRecYTD) * 100 : 0;

  // ----- DCF (5 anos) -----
  // Ano 1: receita anualizada (YTD * 12 / monthCount). Se ja temos 12 meses,
  // anualizar = identidade. Para 4 meses, ano1 = ytd * 3.
  const dcf = useMemo(() => {
    const { growth_year2, growth_year3, ipca, wacc, perpetuity_growth,
            use_simulated_margin, simulated_margin } = premissas;

    const ano1Receita = monthCount >= 12
      ? totalRecYTD
      : (totalRecYTD * 12) / monthCount;

    // Margem usada pra gerar EBITDA/FCF
    const margemPct = use_simulated_margin
      ? (simulated_margin || 0)
      : margemEfetiva;
    const margemDecimal = margemPct / 100;

    // Projecao de receita 5 anos:
    // Ano 1: anualizada (YTD * 12 / mes)
    // Ano 2: ano1 * (1 + growth_year2)
    // Ano 3: ano2 * (1 + growth_year3)
    // Ano 4-5: cresce por IPCA
    const receitas = [
      ano1Receita,
      ano1Receita * (1 + (growth_year2 || 0) / 100),
      ano1Receita * (1 + (growth_year2 || 0) / 100) * (1 + (growth_year3 || 0) / 100),
    ];
    receitas.push(receitas[2] * (1 + (ipca || 0) / 100));
    receitas.push(receitas[3] * (1 + (ipca || 0) / 100));

    // FCF = receita * margem (aproxima EBITDA, simplificacao do DCF clássico)
    const fcfs = receitas.map(r => r * margemDecimal);
    const ebitdas = fcfs; // mesmo valor (sem D&A separado)

    // VP de cada FCF = FCF / (1 + wacc)^i, i=1..5
    const waccDecimal = (wacc || 0) / 100;
    const factors = [1, 2, 3, 4, 5].map(i => Math.pow(1 + waccDecimal, i));
    const vps = fcfs.map((f, i) => f / factors[i]);
    const pvFCF = vps.reduce((s, v) => s + v, 0);

    // Valor terminal Gordon: FCF[5] * (1 + g) / (wacc - g), descontado por (1+wacc)^5
    const gDecimal = (perpetuity_growth || 0) / 100;
    let terminalValue = 0;
    let pvTerminal = 0;
    if (waccDecimal > gDecimal) {
      terminalValue = (fcfs[4] * (1 + gDecimal)) / (waccDecimal - gDecimal);
      pvTerminal = terminalValue / factors[4];
    }

    const totalValuation = pvFCF + pvTerminal;

    return {
      ano1Receita, margemPct, margemDecimal,
      receitas, ebitdas, fcfs, factors, vps,
      pvFCF, terminalValue, pvTerminal, totalValuation,
      waccValid: waccDecimal > gDecimal,
    };
  }, [premissas, totalRecYTD, monthCount, margemEfetiva]);

  // ----- Helpers de formatacao -----
  const fmtMoney = (n) => "R$ " + formatBR(n || 0, 0);
  const fmtMoneyM = (n) => {
    if (Math.abs(n || 0) >= 1e6) return "R$ " + formatBR((n || 0) / 1e6, 2) + " M";
    if (Math.abs(n || 0) >= 1e3) return "R$ " + formatBR((n || 0) / 1e3, 0) + " K";
    return "R$ " + formatBR(n || 0, 0);
  };

  return (
    <div className="page">
      <div className="report-toolbar no-print" style={{ flexWrap: "wrap", minWidth: 0 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0 }}>Valuation — Fluxo de Caixa Descontado</h1>
          <div className="status-line">
            Projecao de 5 anos · YTD {monthCount} {monthCount === 1 ? "mes" : "meses"} de {REF_YEAR} · WACC {premissas.wacc}% · g {premissas.perpetuity_growth}%
          </div>
        </div>
        <div className="actions" style={{ gap: 12, alignItems: 'center' }}>
          <button className="btn-ghost" onClick={resetPremissas} title="Voltar para premissas default">↺ Resetar premissas</button>
          <button className="btn-primary" onClick={() => window.print()} title="Imprimir / salvar como PDF">
            <Icon name="download" /> Exportar PDF
          </button>
        </div>
      </div>

      {/* ============ Premissas editaveis ============ */}
      <div className="card" style={{ minWidth: 0 }}>
        <h2 className="card-title">Premissas editaveis</h2>
        <div className="row" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 16, minWidth: 0 }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontSize: 12, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 }}>Crescimento da Receita</h3>
            <div className="row" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 12, minWidth: 0 }}>
              <PctSlider label={`Ano 2 (${REF_YEAR + 1})`} value={premissas.growth_year2} onChange={(v) => updatePremissa({ growth_year2: v })} min={-20} max={100} />
              <PctSlider label={`Ano 3 (${REF_YEAR + 2})`} value={premissas.growth_year3} onChange={(v) => updatePremissa({ growth_year3: v })} min={-20} max={100} />
              <PctSlider label="IPCA (anos 4-5)" value={premissas.ipca} onChange={(v) => updatePremissa({ ipca: v })} min={0} max={20} step={0.1} />
              <PctSlider label="Crescimento perpetuo (g)" value={premissas.perpetuity_growth} onChange={(v) => updatePremissa({ perpetuity_growth: v })} min={0} max={20} step={0.5} />
            </div>
          </div>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontSize: 12, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 }}>Taxa de desconto e margem</h3>
            <div className="row" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 12, minWidth: 0 }}>
              <PctSlider label="WACC" value={premissas.wacc} onChange={(v) => updatePremissa({ wacc: v })} min={5} max={50} />
              <PctSlider label="Margem simulada" value={premissas.simulated_margin} onChange={(v) => updatePremissa({ simulated_margin: v })} min={-20} max={50} />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13, color: "var(--fg-2)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={premissas.use_simulated_margin}
                onChange={(e) => updatePremissa({ use_simulated_margin: e.target.checked })}
                style={{ width: 16, height: 16, accentColor: "var(--cyan)" }}
              />
              Usar margem simulada (em vez da margem efetiva {margemEfetiva.toFixed(1).replace(".", ",")}%)
            </label>
          </div>
        </div>
      </div>

      {/* ============ Inputs derivados (window.BIT) ============ */}
      <div className="kpi-row">
        <MiniKpi tone="green" label={`Receita YTD (${REF_YEAR})`} value={formatBR(totalRecYTD, 0)} hint={`${monthCount} ${monthCount === 1 ? "mes" : "meses"} · anualiza p/ ${formatBR(dcf.ano1Receita, 0)}`} />
        <MiniKpi tone="red"   label={`Despesa YTD (${REF_YEAR})`} value={formatBR(totalDespYTD, 0)} hint={`${monthCount} ${monthCount === 1 ? "mes" : "meses"}`} />
        <MiniKpi tone="cyan"  label="Resultado YTD" value={formatBR(resultadoYTD, 0)} hint={`Margem efetiva ${margemEfetiva.toFixed(1).replace(".", ",")}%`} />
        <MiniKpi tone="amber" label="Margem aplicada no DCF" value={dcf.margemPct.toFixed(1).replace(".", ",") + "%"} nonMonetary hint={premissas.use_simulated_margin ? "simulada (toggle on)" : "efetiva (YTD)"} />
      </div>

      {/* ============ Tabela de projecao 5 anos ============ */}
      <div className="card" style={{ minWidth: 0 }}>
        <h2 className="card-title">Projecao 5 anos — Receita, EBITDA, FCF, Valor Presente</h2>
        <div className="t-scroll" style={{ overflowX: "auto" }}>
          <table className="t">
            <thead>
              <tr>
                <th>Ano</th>
                <th className="num">Receita</th>
                <th className="num">EBITDA / FCF</th>
                <th className="num">Crescimento</th>
                <th className="num">Fator desconto (1+WACC)<sup>n</sup></th>
                <th className="num">Valor Presente (FCF)</th>
              </tr>
            </thead>
            <tbody>
              {dcf.receitas.map((rec, i) => {
                const growth = i === 0 ? null
                  : i === 1 ? premissas.growth_year2
                  : i === 2 ? premissas.growth_year3
                  : premissas.ipca;
                const growthLabel = growth == null
                  ? "—"
                  : (growth >= 0 ? "+" : "") + growth.toFixed(1).replace(".", ",") + "%";
                return (
                  <tr key={i}>
                    <td><b>Ano {i + 1}</b> <span style={{ color: "var(--fg-3)" }}>({REF_YEAR + i})</span></td>
                    <td className="num">R$ {formatBR(rec, 0)}</td>
                    <td className="num cyan">R$ {formatBR(dcf.fcfs[i], 0)}</td>
                    <td className="num">{growthLabel}</td>
                    <td className="num">{dcf.factors[i].toFixed(3).replace(".", ",")}</td>
                    <td className="num green">R$ {formatBR(dcf.vps[i], 0)}</td>
                  </tr>
                );
              })}
              <tr style={{ background: "rgba(34, 211, 238, 0.06)", fontWeight: 700 }}>
                <td colSpan="5" style={{ textAlign: "right" }}>VP dos Fluxos (5 anos)</td>
                <td className="num green">R$ {formatBR(dcf.pvFCF, 0)}</td>
              </tr>
              <tr>
                <td colSpan="5" style={{ textAlign: "right" }}>Valor Terminal (Gordon, FCF<sub>5</sub>·(1+g)/(WACC−g))</td>
                <td className="num">R$ {formatBR(dcf.terminalValue, 0)}</td>
              </tr>
              <tr style={{ background: "rgba(34, 211, 238, 0.06)", fontWeight: 700 }}>
                <td colSpan="5" style={{ textAlign: "right" }}>VP do Valor Terminal</td>
                <td className="num green">R$ {formatBR(dcf.pvTerminal, 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        {!dcf.waccValid && (
          <div className="status-line" style={{ marginTop: 8, color: "var(--red)" }}>
            ⚠ WACC ({premissas.wacc}%) deve ser maior que crescimento perpetuo ({premissas.perpetuity_growth}%) para calcular valor terminal.
          </div>
        )}
      </div>

      {/* ============ Card destaque: Valuation Total ============ */}
      <div className="card" style={{
        background: "linear-gradient(135deg, rgba(34,211,238,0.10), rgba(34,211,238,0.02))",
        borderColor: "rgba(34,211,238,0.30)",
        minWidth: 0,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, minWidth: 0 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>
              Valuation Total (Enterprise Value)
            </div>
            <div style={{ fontSize: 38, fontWeight: 800, color: dcf.totalValuation >= 0 ? "var(--cyan)" : "var(--red)", lineHeight: 1.1, wordBreak: "break-word" }}>
              {fmtMoneyM(dcf.totalValuation)}
            </div>
            <div style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 6 }}>
              WACC {premissas.wacc}% · Crescimento perpetuo {premissas.perpetuity_growth}% · Margem {dcf.margemPct.toFixed(1).replace(".", ",")}%
            </div>
          </div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", minWidth: 0 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, color: "var(--fg-3)", textTransform: "uppercase" }}>VP Fluxos (5a)</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--green)", wordBreak: "break-word" }}>R$ {formatBR(dcf.pvFCF, 0)}</div>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, color: "var(--fg-3)", textTransform: "uppercase" }}>VP Terminal</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--cyan)", wordBreak: "break-word" }}>R$ {formatBR(dcf.pvTerminal, 0)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="status-line" style={{ marginTop: 12, fontSize: 11, color: "var(--fg-3)" }}>
        Notas: (1) Receita Ano 1 = Receita YTD × 12/{monthCount} (anualizada). (2) FCF = Receita × Margem ({premissas.use_simulated_margin ? "simulada" : "efetiva"}). (3) Anos 2-3 crescem por premissa; anos 4-5 por IPCA. (4) Valor terminal = Modelo de Gordon. (5) Premissas salvas em localStorage.{VALUATION_LS_KEY}.
      </div>

      {/* ============ Análise textual (export-friendly) ============ */}
      <div className="card" style={{ marginTop: 16, minWidth: 0 }}>
        <h2 className="card-title">Memória de Cálculo e Premissas</h2>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 24, marginTop: 12, minWidth: 0 }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontSize: 12, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>Inputs do período</h3>
            <div style={{ overflowX: "auto" }}>
              <table className="t" style={{ width: "100%" }}>
                <tbody>
                  <tr><td>Ano de referência</td><td className="num"><b>{REF_YEAR}</b></td></tr>
                  <tr><td>Meses com dados</td><td className="num"><b>{monthCount} {monthCount === 1 ? "mês" : "meses"}</b></td></tr>
                  <tr><td>Receita YTD</td><td className="num">R$ {formatBR(totalRecYTD, 0)}</td></tr>
                  <tr><td>Despesa YTD</td><td className="num">R$ {formatBR(totalDespYTD, 0)}</td></tr>
                  <tr><td>Resultado YTD</td><td className="num"><b>R$ {formatBR(resultadoYTD, 0)}</b></td></tr>
                  <tr><td>Margem efetiva (YTD)</td><td className="num">{margemEfetiva.toFixed(2).replace(".", ",")}%</td></tr>
                  <tr><td>Receita anualizada (Ano 1)</td><td className="num"><b>R$ {formatBR(dcf.ano1Receita, 0)}</b></td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontSize: 12, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>Premissas aplicadas</h3>
            <div style={{ overflowX: "auto" }}>
              <table className="t" style={{ width: "100%" }}>
                <tbody>
                  <tr><td>Crescimento Ano 2</td><td className="num">{premissas.growth_year2.toFixed(1).replace(".", ",")}%</td></tr>
                  <tr><td>Crescimento Ano 3</td><td className="num">{premissas.growth_year3.toFixed(1).replace(".", ",")}%</td></tr>
                  <tr><td>IPCA (anos 4-5)</td><td className="num">{premissas.ipca.toFixed(1).replace(".", ",")}%</td></tr>
                  <tr><td>WACC</td><td className="num"><b>{premissas.wacc.toFixed(1).replace(".", ",")}%</b></td></tr>
                  <tr><td>Crescimento perpétuo (g)</td><td className="num">{premissas.perpetuity_growth.toFixed(1).replace(".", ",")}%</td></tr>
                  <tr><td>Margem aplicada</td><td className="num"><b>{dcf.margemPct.toFixed(2).replace(".", ",")}%</b> ({premissas.use_simulated_margin ? "simulada" : "efetiva"})</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <h3 style={{ fontSize: 12, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: 0.6, marginTop: 24, marginBottom: 10 }}>Interpretação</h3>
        <div style={{ fontSize: 13, color: "var(--fg-2)", lineHeight: 1.7 }}>
          <p>
            Com base na receita YTD de <b>R$ {formatBR(totalRecYTD, 0)}</b> ({monthCount} {monthCount === 1 ? "mês" : "meses"} de {REF_YEAR}), a receita anualizada para o Ano 1 do DCF é estimada em <b>R$ {formatBR(dcf.ano1Receita, 0)}</b>. Aplicando uma margem {premissas.use_simulated_margin ? "simulada" : "efetiva"} de <b>{dcf.margemPct.toFixed(1).replace(".", ",")}%</b>, o fluxo de caixa livre do Ano 1 é projetado em R$ {formatBR(dcf.fcfs[0], 0)}.
          </p>
          <p>
            A receita cresce <b>{premissas.growth_year2.toFixed(1).replace(".", ",")}%</b> no Ano 2, <b>{premissas.growth_year3.toFixed(1).replace(".", ",")}%</b> no Ano 3, e <b>{premissas.ipca.toFixed(1).replace(".", ",")}%</b> nos Anos 4-5 (IPCA). Os fluxos são descontados a uma taxa WACC de <b>{premissas.wacc.toFixed(1).replace(".", ",")}%</b>, gerando um Valor Presente dos Fluxos de <b>R$ {formatBR(dcf.pvFCF, 0)}</b>.
          </p>
          {dcf.waccValid ? (
            <p>
              O Valor Terminal pelo Modelo de Gordon, considerando crescimento perpétuo de <b>{premissas.perpetuity_growth.toFixed(1).replace(".", ",")}%</b>, totaliza <b>R$ {formatBR(dcf.terminalValue, 0)}</b>, descontado a R$ {formatBR(dcf.pvTerminal, 0)} a valor presente.
            </p>
          ) : (
            <p style={{ color: "var(--red)" }}>
              ⚠ O WACC ({premissas.wacc.toFixed(1).replace(".", ",")}%) precisa ser maior que o crescimento perpétuo ({premissas.perpetuity_growth.toFixed(1).replace(".", ",")}%) para o Modelo de Gordon ser aplicável.
            </p>
          )}
          <p style={{ marginTop: 12, padding: 12, background: "rgba(34,211,238,0.05)", borderLeft: "3px solid var(--cyan)", borderRadius: 4 }}>
            <b>Valuation total (Enterprise Value): R$ {formatBR(dcf.totalValuation, 0)}</b><br />
            (VP Fluxos R$ {formatBR(dcf.pvFCF, 0)} + VP Terminal R$ {formatBR(dcf.pvTerminal, 0)})
          </p>
          <p style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 12 }}>
            <b>Sensibilidades a considerar:</b> uma variação de ±1pp no WACC desloca o valuation em ~{Math.abs(((dcf.totalValuation * 0.01) / Math.max(0.001, premissas.wacc / 100 - premissas.perpetuity_growth / 100))).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}; uma redução de ±5pp na margem altera o FCF anual em ±R$ {formatBR(Math.abs(dcf.ano1Receita * 0.05), 0)}. Recomenda-se rodar cenários otimista (margem +5pp, WACC −2pp) e conservador (margem −5pp, WACC +3pp) antes de decisões de M&A.
          </p>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { PageFaturamentoProduto, PageCurvaABC, PageMarketing, PageValuation });
