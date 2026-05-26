const { useState, useMemo } = React;

// Semi-circular gauge (speedometer) — uses strokeDasharray for reliable fill
const GaugeChart = ({ pct, size = 120 }) => {
  const strokeW = 10;
  const r = size / 2 - strokeW - 4;
  const cx = size / 2;
  const cy = size / 2 + 4;
  const svgH = size / 2 + strokeW + 20;
  const color = pct > 100 ? "var(--red)" : pct > 85 ? "#f59e0b" : "var(--green)";
  const halfCirc = Math.PI * r;
  const clampedPct = Math.max(0, Math.min(pct, 150));
  const fillLen = (clampedPct / 100) * halfCirc;
  const d = `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy}`;
  return (
    <svg width={size} height={svgH} viewBox={`0 0 ${size} ${svgH}`}>
      <path d={d} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={strokeW} strokeLinecap="round" />
      {clampedPct > 0 && (
        <path d={d} fill="none" stroke={color} strokeWidth={strokeW} strokeLinecap="round"
          strokeDasharray={`${fillLen} ${halfCirc}`} />
      )}
      <text x={cx} y={cy + 18} textAnchor="middle" fontSize={size > 150 ? "22" : "16"} fontWeight="700" fill={color} fontFamily="var(--font-mono)">
        {pct.toFixed(1).replace(".", ",")}%
      </text>
    </svg>
  );
};

const PageOrcamento = ({ filters, setFilters, statusFilter, drilldown, setDrilldown, year, month }) => {
  const [view, setView] = useState("geral");
  const [selectedMonth, setSelectedMonth] = useState(null); // "2026-01" etc
  const [selectedCat, setSelectedCat] = useState(null); // category name for local filter
  const B = useMemo(() => window.getBit(statusFilter, null, year, month, filters && filters.regime, filters), [statusFilter, year, month, filters]);
  const fmt = B.fmt;

  const orcDataRaw = window.BIT_ORCAMENTO || [];

  // Apply header date filters (dateFrom/dateTo) to orcamento data
  const orcData = useMemo(() => {
    let data = orcDataRaw;
    const df = filters && filters.dateFrom;
    const dt = filters && filters.dateTo;
    if (df) {
      const dfYm = df.slice(0, 7); // "YYYY-MM"
      data = data.filter(r => r.mes >= dfYm);
    }
    if (dt) {
      const dtYm = dt.slice(0, 7);
      data = data.filter(r => r.mes <= dtYm);
    }
    return data;
  }, [orcDataRaw, filters]);

  // All budget categories (for filter dropdown)
  const allOrcCats = useMemo(() => {
    return [...new Set(orcDataRaw.map(r => r.conta))].sort();
  }, [orcDataRaw]);

  // Apply local filters: selectedMonth + selectedCat
  const filteredData = useMemo(() => {
    let data = orcData;
    if (selectedMonth) data = data.filter(r => r.mes === selectedMonth);
    if (selectedCat) data = data.filter(r => r.conta === selectedCat);
    return data;
  }, [orcData, selectedMonth, selectedCat]);

  // Aggregate
  const agg = useMemo(() => {
    const byMonth = new Map();
    const byConta = new Map();

    for (const r of filteredData) {
      if (!byMonth.has(r.mes)) byMonth.set(r.mes, { orcado: 0, realizado: 0 });
      const m = byMonth.get(r.mes);
      m.orcado += r.orcamento;
      m.realizado += r.realizado;

      if (!byConta.has(r.conta)) byConta.set(r.conta, { orcado: 0, realizado: 0, depto: r.departamento });
      const c = byConta.get(r.conta);
      c.orcado += r.orcamento;
      c.realizado += r.realizado;
    }

    const months = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const cats = [...byConta.entries()].map(([name, d]) => ({
      name, ...d,
      saldo: d.orcado - d.realizado,
      pct: d.orcado > 0 ? (d.realizado / d.orcado) * 100 : (d.realizado > 0 ? 100 : 0),
    })).sort((a, b) => b.orcado - a.orcado);
    const totalOrcado = cats.reduce((s, c) => s + c.orcado, 0);
    const totalRealizado = cats.reduce((s, c) => s + c.realizado, 0);
    const totalPct = totalOrcado > 0 ? (totalRealizado / totalOrcado) * 100 : 0;
    return { months, cats, totalOrcado, totalRealizado, totalPct };
  }, [filteredData]);

  // For bar chart: always show ALL months from orcData (unfiltered by month), so bars don't disappear
  const barData = useMemo(() => {
    const byMonth = new Map();
    let data = orcData; // date-filtered but NOT month-filtered
    if (selectedCat) data = data.filter(r => r.conta === selectedCat);
    for (const r of data) {
      if (!byMonth.has(r.mes)) byMonth.set(r.mes, { orcado: 0, realizado: 0 });
      const m = byMonth.get(r.mes);
      m.orcado += r.orcamento;
      m.realizado += r.realizado;
    }
    return [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [orcData, selectedCat]);

  const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const monthLabel = (ym) => MONTH_NAMES[parseInt(ym.slice(5, 7), 10) - 1] || ym;

  const handleBarClick = (ym) => {
    setSelectedMonth(selectedMonth === ym ? null : ym);
  };

  const handleCatClick = (catName) => {
    setSelectedCat(selectedCat === catName ? null : catName);
  };

  const clearFilters = () => { setSelectedMonth(null); setSelectedCat(null); };

  const hasLocalFilter = selectedMonth || selectedCat;
  const filterLabel = [
    selectedMonth && monthLabel(selectedMonth),
    selectedCat,
  ].filter(Boolean).join(" · ");

  // ===== VIEW 1: Análise Geral =====
  const viewGeral = () => {
    const barMax = Math.max(...barData.map(m => Math.max(m[1].orcado, m[1].realizado)), 1);
    return (
      <>
        <div className="card">
          <h2 className="card-title">DESPESA REALIZADA X ORÇADA</h2>
          <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
            <span className="legend-pill red"><span className="dot" /><span className="lbl">Realizado</span></span>
            <span className="legend-pill" style={{ background: "rgba(59,130,246,0.12)", color: "#60a5fa", borderColor: "rgba(59,130,246,0.28)" }}><span className="dot" style={{ background: "#3b82f6" }} /><span className="lbl">Orçado</span></span>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", padding: "0 8px" }}>
            {barData.map(([ym, d]) => {
              const rPct = Math.max((d.realizado / barMax) * 100, 1);
              const oPct = Math.max((d.orcado / barMax) * 100, 1);
              const isActive = selectedMonth === ym;
              const isDimmed = selectedMonth && !isActive;
              return (
                <div key={ym} style={{ flex: 1, textAlign: "center", opacity: isDimmed ? 0.35 : 1, cursor: "pointer", transition: "opacity 150ms" }}
                  onClick={() => handleBarClick(ym)}>
                  <div style={{ display: "flex", gap: 4, justifyContent: "center", alignItems: "flex-end", height: 240 }}>
                    <div style={{ width: "38%", display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
                      <div style={{ fontSize: 9, color: "var(--red)", fontFamily: "var(--font-mono)", textAlign: "center", marginBottom: 4, whiteSpace: "nowrap" }}>{fmt(d.realizado)}</div>
                      <div style={{ height: `${rPct}%`, background: "var(--red)", borderRadius: "4px 4px 0 0", boxShadow: isActive ? "0 0 0 2px var(--cyan)" : "none" }} />
                    </div>
                    <div style={{ width: "38%", display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
                      <div style={{ fontSize: 9, color: "#60a5fa", fontFamily: "var(--font-mono)", textAlign: "center", marginBottom: 4, whiteSpace: "nowrap" }}>{fmt(d.orcado)}</div>
                      <div style={{ height: `${oPct}%`, background: "#3b82f6", borderRadius: "4px 4px 0 0", boxShadow: isActive ? "0 0 0 2px var(--cyan)" : "none" }} />
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: isActive ? "var(--cyan)" : "var(--mute)", marginTop: 8, fontWeight: isActive ? 700 : 600 }}>{monthLabel(ym)}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <h2 className="card-title">TOTAL DESPESA{hasLocalFilter ? ` · ${filterLabel}` : ""}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 24, alignItems: "center", padding: "16px 0" }}>
            <div style={{ textAlign: "center" }}>
              <div className="kpi-label">Orçamento no período</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#60a5fa", fontFamily: "var(--font-mono)", marginTop: 8 }}>{fmt(agg.totalOrcado)}</div>
              <div className="kpi-label" style={{ marginTop: 4 }}>Soma de Previsto</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <GaugeChart pct={agg.totalPct} size={200} />
            </div>
            <div style={{ textAlign: "center" }}>
              <div className="kpi-label">Realizado no período</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: agg.totalRealizado > agg.totalOrcado ? "var(--red)" : "var(--green)", fontFamily: "var(--font-mono)", marginTop: 8 }}>{fmt(agg.totalRealizado)}</div>
              <div className="kpi-label" style={{ marginTop: 4 }}>Soma de Realizado</div>
            </div>
          </div>
        </div>
      </>
    );
  };

  // ===== VIEW 2: Análise Profunda =====
  const viewProfunda = () => {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
        {agg.cats.filter(c => c.orcado > 0 || c.realizado > 0).map(cat => {
          const isActive = selectedCat === cat.name;
          const isDimmed = selectedCat && !isActive;
          return (
            <div key={cat.name} className="card" style={{ padding: 0, overflow: "hidden", opacity: isDimmed ? 0.35 : 1, cursor: "pointer", transition: "opacity 150ms", boxShadow: isActive ? "0 0 0 2px var(--cyan)" : undefined }}
              onClick={() => handleCatClick(cat.name)}>
              <div style={{ background: isActive ? "rgba(34,211,238,0.18)" : "rgba(59,130,246,0.18)", padding: "10px 16px", borderBottom: `1px solid ${isActive ? "rgba(34,211,238,0.28)" : "rgba(59,130,246,0.28)"}` }}>
                <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: isActive ? "var(--cyan)" : "#93c5fd" }}>{cat.name}</h3>
              </div>
              <div style={{ padding: "12px 16px", textAlign: "center" }}>
                <GaugeChart pct={cat.pct} size={150} />
                <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: "var(--mute)" }}>ORÇADO</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "#60a5fa" }}>{fmt(cat.orcado)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: "var(--mute)" }}>REALIZADO</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: cat.realizado > cat.orcado ? "var(--red)" : "var(--green)" }}>{fmt(cat.realizado)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderTop: "1px solid var(--border)", paddingTop: 6 }}>
                    <span style={{ color: "var(--mute)" }}>DESVIO</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: cat.saldo >= 0 ? "var(--green)" : "var(--red)" }}>{fmt(cat.saldo)}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ===== VIEW 3: Análise Tabelas =====
  const viewTabelas = () => {
    const totalDif = agg.totalOrcado - agg.totalRealizado;
    return (
      <div className="card">
        <h2 className="card-title">ORÇADO × REALIZADO</h2>
        <div className="t-scroll" style={{ maxHeight: 600 }}>
          <table className="t">
            <thead>
              <tr><th>Categoria</th><th className="num">Orçado</th><th className="num">Realizado</th><th className="num">Diferença</th></tr>
            </thead>
            <tbody>
              {agg.cats.map((c, i) => (
                <tr key={i} style={{ cursor: "pointer", opacity: selectedCat && selectedCat !== c.name ? 0.4 : 1 }}
                  onClick={() => handleCatClick(c.name)}>
                  <td style={{ fontSize: 12 }}>{c.name}</td>
                  <td className="num" style={{ fontSize: 12, color: "#60a5fa" }}>{fmt(c.orcado)}</td>
                  <td className="num" style={{ fontSize: 12, color: c.realizado > c.orcado ? "var(--red)" : "var(--green)" }}>{fmt(c.realizado)}</td>
                  <td className="num" style={{ fontSize: 12, color: c.saldo >= 0 ? "var(--green)" : "var(--red)" }}>{fmt(c.saldo)}</td>
                </tr>
              ))}
              <tr className="total">
                <td>Total</td>
                <td className="num" style={{ color: "#60a5fa" }}>{fmt(agg.totalOrcado)}</td>
                <td className="num" style={{ color: agg.totalRealizado > agg.totalOrcado ? "var(--red)" : "var(--green)" }}>{fmt(agg.totalRealizado)}</td>
                <td className="num" style={{ color: totalDif >= 0 ? "var(--green)" : "var(--red)" }}>{fmt(totalDif)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Orçamento</h1>
          <div className="status-line">Orçado × Realizado · Despesas</div>
        </div>
        <div className="actions" style={{ gap: 8 }}>
          <select className="header-year" value={selectedCat || ""} onChange={e => setSelectedCat(e.target.value || null)}
            style={{ maxWidth: 200, fontSize: 12 }} title="Filtrar por categoria orçamento">
            <option value="">Todas categorias</option>
            {allOrcCats.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="seg">
            <button className={view === "geral" ? "active" : ""} onClick={() => setView("geral")}>Análise Geral</button>
            <button className={view === "profunda" ? "active" : ""} onClick={() => setView("profunda")}>Análise Profunda</button>
            <button className={view === "tabelas" ? "active" : ""} onClick={() => setView("tabelas")}>Análise Tabelas</button>
          </div>
        </div>
      </div>

      {/* No modo print, renderiza as 3 visões */}
      {typeof document !== "undefined" && document.body.classList.contains("bi-print-mode") && (
        <>
          <h2 style={{ marginTop: 16, marginBottom: 8, fontSize: 14, color: "var(--mute)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Análise Geral</h2>
          {viewGeral()}
          <h2 style={{ marginTop: 24, marginBottom: 8, fontSize: 14, color: "var(--mute)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Análise Profunda</h2>
          {viewProfunda()}
          <h2 style={{ marginTop: 24, marginBottom: 8, fontSize: 14, color: "var(--mute)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Análise Tabelas</h2>
          {viewTabelas()}
        </>
      )}

      {typeof document !== "undefined" && !document.body.classList.contains("bi-print-mode") && hasLocalFilter && (
        <div className="drilldown-badge">
          <span className="dd-label">Filtrando: <b>{filterLabel}</b></span>
          <button className="dd-clear" onClick={clearFilters} aria-label="Limpar filtro">× Limpar</button>
        </div>
      )}

      {(typeof document === "undefined" || !document.body.classList.contains("bi-print-mode")) && view === "geral" && viewGeral()}
      {(typeof document === "undefined" || !document.body.classList.contains("bi-print-mode")) && view === "profunda" && viewProfunda()}
      {(typeof document === "undefined" || !document.body.classList.contains("bi-print-mode")) && view === "tabelas" && viewTabelas()}
    </div>
  );
};

window.PageOrcamento = PageOrcamento;
