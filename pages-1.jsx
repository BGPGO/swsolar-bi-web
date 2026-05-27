/* BIT/BGP Finance — Pages 1: Overview, Indicators, Receita, Despesa */
const { useState, useEffect } = React;

// Hook responsivo: detecta viewport mobile (<= 600px). Usado para ajustar SVGs com
// preserveAspectRatio="none" cujas coords sao plotadas em px absolutos.
const useIsMobile = (breakpoint = 600) => {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= breakpoint : false
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return isMobile;
};

const RangePills = ({ value, onChange }) => {
  const opts = ["7D", "30D", "90D", "YTD", "12M"];
  return (
    <div className="range-pills">
      {opts.map(o => (
        <button key={o} className={value === o ? "active" : ""} onClick={() => onChange(o)}>{o}</button>
      ))}
    </div>
  );
};

// Section heading — kept as a thin alias so all card titles share the standardized style
const SectionHeading = ({ strong, soft }) => (
  <h2 className="card-title">{[strong, soft].filter(Boolean).join(" ")}</h2>
);

// Side-by-side monthly bars (Receita green / Despesa red) with floating value chips
const OverviewBars = ({ data, height = 220, year = "2026", onBarClick, activeIdx }) => {
  const B = window.BIT;
  const max = Math.max(...data.map(d => Math.max(d.receita, d.despesa)), 1);
  // Escala dinâmica: calcula step pra ter no máximo 5 ticks
  const magnitude = Math.pow(10, Math.floor(Math.log10(max || 1)));
  const rawStep = max / 4;
  const niceStep = rawStep <= magnitude ? magnitude : rawStep <= magnitude * 2 ? magnitude * 2 : magnitude * 5;
  const niceMax = Math.max(Math.ceil(max / niceStep) * niceStep, niceStep);
  const ticks = [];
  for (let v = 0; v <= niceMax; v += niceStep) ticks.push(v);
  if (ticks.length > 6) { ticks.length = 0; for (let v = 0; v <= niceMax; v += niceStep * 2) ticks.push(v); }
  const fmtAxis = (v) => v >= 1e6 ? `R$${(v / 1e6).toFixed(1).replace(".", ",")}M` : `R$${Math.round(v / 1000)}K`;
  const fmtChip = (v) => v >= 1e6 ? `${(v / 1e6).toFixed(1).replace(".", ",")}M` : `${Math.round(v / 1000)}K`;
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1, 3);
  const hasActive = activeIdx != null && activeIdx >= 0;

  return (
    <div className="ov-bars">
      <div className="ov-bars-plot" style={{ height }}>
        <div className="ov-bars-axis">
          {ticks.map((t, i) => (
            <div key={i} className="ov-bars-tick" style={{ bottom: `${(t / niceMax) * 100}%` }}>
              <span>{fmtAxis(t)}</span>
            </div>
          ))}
        </div>
        <div className="ov-bars-cols">
          {data.map((d, i) => {
            const rH = (d.receita / niceMax) * 100;
            const dH = (d.despesa / niceMax) * 100;
            const cls = "ov-bar-col" + (onBarClick ? " clickable" : "") +
              (hasActive && i === activeIdx ? " active" : "") +
              (hasActive && i !== activeIdx ? " dimmed" : "");
            return (
              <div key={i} className={cls}
                onClick={onBarClick ? () => onBarClick(d, i) : undefined}
                style={onBarClick ? { cursor: "pointer" } : undefined}
              >
                <div className="ov-bar-stack">
                  <div className="ov-bar green" style={{ height: `${rH}%` }} title={`Receita: ${B.fmt(d.receita)}`}>
                    <span className="ov-bar-chip">{fmtChip(d.receita)}</span>
                  </div>
                  <div className="ov-bar red" style={{ height: `${dH}%` }} title={`Despesa: ${B.fmt(d.despesa)}`}>
                    <span className="ov-bar-chip">{fmtChip(d.despesa)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="ov-bars-x">
        {data.map((d, i) => <span key={i}>{cap(d.m)}</span>)}
      </div>
      <div className="ov-bars-year"><span>{year}</span></div>
    </div>
  );
};

// Diverging line chart — line + zero baseline + value labels above/below points
const IndicatorLine = ({ values, labels, height = 240, color = "var(--cyan)", format }) => {
  // No mobile reduzimos o viewBox horizontal (1100 -> 600) e a altura (240 -> 180).
  // Como preserveAspectRatio="none" estica o conteudo pra preencher a largura do container,
  // um viewBox mais estreito faz os pontos plotados em px absolutos ficarem espacados
  // de forma proporcional ao espaco disponivel no mobile (~326px), evitando o achatamento.
  const isMobile = useIsMobile();
  const w = isMobile ? 600 : 1100;
  const h = isMobile ? 180 : height;
  const padX = isMobile ? 28 : 50;
  const padTop = isMobile ? 28 : 36;
  const padBottom = isMobile ? 28 : 36;
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = max - min || 1;

  const stepX = (w - padX * 2) / (values.length - 1);
  const xOf = (i) => padX + i * stepX;
  const yOf = (v) => padTop + (1 - (v - min) / range) * (h - padTop - padBottom);

  const pts = values.map((v, i) => [xOf(i), yOf(v)]);
  const curve = (p) => {
    let d = `M ${p[0][0]} ${p[0][1]}`;
    for (let i = 1; i < p.length; i++) {
      const [x0, y0] = p[i - 1];
      const [x1, y1] = p[i];
      const cx = (x0 + x1) / 2;
      d += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
    }
    return d;
  };
  const path = curve(pts);
  const zeroY = yOf(0);
  const fmt = format || ((v) => window.BIT.fmt(v));

  // Em mobile, mostramos label de valor Y apenas nos pontos extremos
  // (primeiro, ultimo, max, min) pra evitar amassamento sobre a curva.
  const labelIdxSet = (() => {
    if (!isMobile || values.length <= 4) return null;
    let maxI = 0, minI = 0;
    for (let i = 1; i < values.length; i++) {
      if (values[i] > values[maxI]) maxI = i;
      if (values[i] < values[minI]) minI = i;
    }
    return new Set([0, values.length - 1, maxI, minI]);
  })();

  return (
    <svg className="ind-line" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: h }}>
      <defs>
        <linearGradient id="ind-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.30"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <line x1={padX} y1={zeroY} x2={w - padX} y2={zeroY} stroke="rgba(255,255,255,0.18)" strokeDasharray="6 5" strokeWidth="1"/>
      <path d={`${path} L ${pts[pts.length - 1][0]} ${zeroY} L ${pts[0][0]} ${zeroY} Z`} fill="url(#ind-grad)" />
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
      {pts.map((p, i) => {
        const v = values[i];
        const above = v >= 0;
        const showLabel = labelIdxSet ? labelIdxSet.has(i) : true;
        return (
          <g key={i}>
            <circle cx={p[0]} cy={p[1]} r={isMobile ? 3.5 : 4.5} fill={color} stroke="#0a141a" strokeWidth="2.5"/>
            {showLabel && (
              <text x={p[0]} y={above ? p[1] - 12 : p[1] + 22} textAnchor="middle" fill={v >= 0 ? "#e8f6f9" : "#fca5a5"} fontFamily="var(--font-mono)" fontSize={isMobile ? "10" : "11.5"} fontWeight="600">
                {fmt(v)}
              </text>
            )}
          </g>
        );
      })}
      {labels.map((l, i) => (
        i % 2 === 0 ? (
          <text key={i} x={xOf(i)} y={h - 10} textAnchor="middle" fill="var(--mute)" fontSize="11" fontFamily="var(--font-ui)">{l}</text>
        ) : null
      ))}
    </svg>
  );
};

const PageOverview = ({ filters, setFilters, onOpenFilters, statusFilter, drilldown, setDrilldown, year, month }) => {
  const B = useMemo(() => window.getBit(statusFilter, drilldown, year, month, filters && filters.regime, filters), [statusFilter, drilldown, year, month, filters]);
  const BFull = useMemo(() => window.getBit(statusFilter, null, year, month, filters && filters.regime, filters), [statusFilter, year, month, filters]);
  const [indicator, setIndicator] = useState("Valor líquido");
  const refYear = (B.META && B.META.ref_year) || new Date().getFullYear();
  // descobre o indice ativo se o drilldown for de mes (pra destacar a barra)
  const activeMonthIdx = (drilldown && drilldown.type === "mes")
    ? B.MONTHS_FULL.findIndex(mn => {
        // drilldown.value formato "YYYY-MM" e MONTHS_FULL e ["janeiro","fevereiro",...]
        const mm = String(parseInt(drilldown.value.slice(5, 7), 10)).padStart(2, "0");
        const idx = parseInt(mm, 10) - 1;
        return B.MONTHS_FULL.indexOf(mn) === idx;
      })
    : -1;
  const handleBarMes = (d, i) => {
    const mm = String(i + 1).padStart(2, "0");
    const ym = `${refYear}-${mm}`;
    const lbl = `${d.m.charAt(0).toUpperCase() + d.m.slice(1, 3)}/${refYear}`;
    setDrilldown({ type: "mes", value: ym, label: lbl });
  };

  // Indicator series for the toggle chart (derived da MONTH_DATA full — sem drilldown)
  const margemSeries = BFull.MONTH_DATA.map(m => m.receita > 0 ? ((m.receita - m.despesa) / m.receita) * 100 : 0);
  const indicatorSeries = {
    "Valor líquido":          { values: BFull.MONTH_DATA.map(m => m.receita - m.despesa), color: "var(--cyan)", fmt: (v) => B.fmt(v) },
    "Receita":                { values: BFull.MONTH_DATA.map(m => m.receita), color: "var(--green)", fmt: (v) => B.fmt(v) },
    "Despesa":                { values: BFull.MONTH_DATA.map(m => -m.despesa), color: "var(--red)", fmt: (v) => B.fmt(v) },
    "Margem Líquida":         { values: margemSeries, color: "var(--cyan)", fmt: (v) => `${v.toFixed(2).replace(".", ",")}%` },
  };
  const current = indicatorSeries[indicator];
  const monthLabels = B.MONTHS_FULL.map(m => `${m.charAt(0).toUpperCase() + m.slice(1, 3)} ${refYear}`);

  // Calcular indicadores DRE a partir de ALL_TX filtrado
  const dre = useMemo(() => {
    const rg = (filters && filters.regime === "competencia") ? "k" : "c";
    const sf = statusFilter || "realizado";
    var txs = (window.ALL_TX || []).filter(r => r[9] === rg);
    if (sf === "realizado") txs = txs.filter(r => r[6] === 1);
    else if (sf === "a_pagar_receber") txs = txs.filter(r => r[6] === 0);
    txs = txs.filter(r => r[1] && r[1].startsWith(String(year || refYear)));
    // Apply extra filters (dateFrom, dateTo, categoria, dia)
    if (filters && window.filterTx) txs = window.filterTx(window.ALL_TX || [], sf, drilldown, rg, filters);
    if (!drilldown) txs = txs.filter(r => r[1] && r[1].startsWith(String(year || refYear)));

    var impostos = 0, capex = 0, juros = 0;
    var reImposto = /imposto|icms|pis[\s\/]|cofins|iss[\s\/]|ipi[\s\/]|irpj|irrf|csll|simples|tribut|inss|fgts|dedu[cç][oõ]|DAS\b|reten[cç][aã]o/i;
    var reCapex = /equip|veicul|ve[ií]culo|maquin|imobili|investimento|bens/i;
    var reJuros = /amortiza|empr[eé]stimo|juros|financ/i;
    for (var i = 0; i < txs.length; i++) {
      if (txs[i][0] !== "d") continue;
      var cat = txs[i][3] || "";
      var val = txs[i][5];
      if (cat.startsWith("02.") || reImposto.test(cat)) impostos += val;
      else if (cat.startsWith("05.") || reCapex.test(cat)) capex += val;
      else if (cat.startsWith("10.") || reJuros.test(cat)) juros += val;
    }
    // EBITDA: lucro antes dos juros e impostos = Receita - (Despesa - Impostos - Juros/Amort)
    var ebitda = B.TOTAL_RECEITA - (B.TOTAL_DESPESA - impostos - juros);
    // Resultado Operacional: lucro depois dos juros e impostos = EBITDA - Impostos - Juros
    var resultOp = ebitda - impostos - juros;
    return { impostos, capex, juros, ebitda, resultOp };
  }, [B, statusFilter, filters, year, drilldown, refYear]);

  const indicadores = [
    { value: B.TOTAL_RECEITA, label: "Soma de receita",     kind: "receita" },
    { value: B.TOTAL_DESPESA, label: "Soma de despesa",     kind: "despesa" },
    { value: B.VALOR_LIQUIDO, label: "Valor líquido",       kind: B.VALOR_LIQUIDO >= 0 ? "receita" : "despesa" },
    { value: dre.impostos,    label: "Impostos",             kind: "despesa" },
    { value: dre.ebitda,      label: "EBITDA",               kind: dre.ebitda >= 0 ? "receita" : "despesa" },
    { value: dre.resultOp,    label: "Resultado operacional", kind: dre.resultOp >= 0 ? "receita" : "despesa" },
    { value: dre.capex,       label: "CAPEX",                kind: "despesa" },
  ];

  const statusLabel = statusFilter === "realizado" ? "realizado (PAGO)" :
                      statusFilter === "a_pagar_receber" ? "pendente (A vencer/receber)" : "tudo (pago + pendente)";

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Visão Geral</h1>
          <div className="status-line">Cliente · ano {refYear} · status <b>{statusLabel}</b></div>
        </div>
        <div className="actions">
          <RegimeToggle filters={filters} setFilters={setFilters} />
        </div>
      </div>

      <DrilldownBadge drilldown={drilldown} onClear={() => setDrilldown(null)} />

      <div className="row" style={{ gridTemplateColumns: "minmax(280px, 3fr) minmax(0, 9fr)" }}>
        {/* LEFT: Indicadores Principais + Resultado Geral */}
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <div className="card">
            <SectionHeading strong="INDICADORES" soft="PRINCIPAIS" />
            <div className="kpi-stack">
              {indicadores.map((it, i) => (
                <div key={i} className={`kpi-stack-item ${it.kind}`}>
                  <div className="kpi-stack-value">{B.fmt(it.value)}</div>
                  <div className="kpi-stack-label">{it.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className={`card ${B.VALOR_LIQUIDO >= 0 ? "resultado-card" : "resultado-card resultado-card-neg"}`}>
            <SectionHeading strong="RESULTADO" soft="GERAL" />
            <div className="kpi-stack-value resultado-val">{B.fmt(B.VALOR_LIQUIDO)}</div>
            <div className="kpi-stack-label">Valor líquido</div>
            <div className="kpi-stack-pct" style={{ color: B.VALOR_LIQUIDO >= 0 ? "var(--green)" : "var(--red)" }}>{B.MARGEM_LIQUIDA.toFixed(2).replace(".", ",")}%</div>
            <div className="kpi-stack-label">Margem Líquida</div>
          </div>
        </div>

        {/* RIGHT: Receitas e Despesas + Visualização Indicadores */}
        <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
          <div className="card">
            <div className="card-title-row" style={{ marginBottom: 10 }}>
              <h2 className="card-title">Receitas e despesas</h2>
            </div>
            <div className="legend-pills">
              <span className="legend-pill green">
                <span className="dot" />
                <span className="lbl">Soma de receita</span>
                <span className="val">{B.fmtK(B.TOTAL_RECEITA)}</span>
              </span>
              <span className="legend-pill red">
                <span className="dot" />
                <span className="lbl">Soma de despesas</span>
                <span className="val">{B.fmtK(B.TOTAL_DESPESA)}</span>
              </span>
            </div>
            <OverviewBars data={BFull.MONTH_DATA} height={220} year={String(refYear)} onBarClick={handleBarMes} activeIdx={activeMonthIdx} />
          </div>

          <div className="card">
            <div className="card-title-row" style={{ marginBottom: 12 }}>
              <h2 className="card-title">Visualização indicadores</h2>
              <div className="ind-pills">
                {Object.keys(indicatorSeries).map(k => (
                  <button key={k} className={`ind-pill ${indicator === k ? "active" : ""}`} onClick={() => setIndicator(k)}>{k}</button>
                ))}
              </div>
            </div>
            <div className="legend-pills">
              <span className="legend-pill cyan">
                <span className="dot" />
                <span className="lbl">{indicator}</span>
                <span className="val">{indicator === "Margem Líquida"
                  ? `${(current.values.reduce((s, v) => s + v, 0) / current.values.length).toFixed(2).replace(".", ",")}%`
                  : B.fmtK(current.values.reduce((s, v) => s + v, 0))}</span>
              </span>
            </div>
            <IndicatorLine values={current.values} labels={monthLabels} height={240} color={current.color} format={current.fmt} />
          </div>
        </div>
      </div>
    </div>
  );
};

const PageIndicators = ({ filters, statusFilter, drilldown, setDrilldown, year, month }) => {
  const B = useMemo(() => window.getBit(statusFilter, drilldown, year, month, filters && filters.regime, filters), [statusFilter, drilldown, year, month, filters]);
  const totalReceita = B.TOTAL_RECEITA;
  const totalDespesa = B.TOTAL_DESPESA;
  const valorLiq = B.VALOR_LIQUIDO;
  const margemLiq = B.MARGEM_LIQUIDA;
  const refYear = (B.META && B.META.ref_year) || new Date().getFullYear();
  // sem segregacao de impostos no Omie sem mapeamento de categorias, deixamos 0 e mostramos "—" se nao houver dado
  const margemSeries = B.MONTH_DATA.map(m => m.receita > 0 ? ((m.receita - m.despesa) / m.receita) * 100 : 0);

  const handleBarMes = (d, i) => {
    const mm = String(i + 1).padStart(2, "0");
    const ym = `${refYear}-${mm}`;
    const lbl = `${(d.m || "").charAt(0).toUpperCase() + (d.m || "").slice(1, 3)}/${refYear}`;
    setDrilldown({ type: "mes", value: ym, label: lbl });
  };
  const activeMonthIdx = (drilldown && drilldown.type === "mes")
    ? parseInt(drilldown.value.slice(5, 7), 10) - 1 : -1;

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Indicadores</h1>
          <div className="status-line">Receita, despesa, valor líquido e margem · {statusFilter === "realizado" ? "realizado" : statusFilter === "tudo" ? "tudo" : "pendente"}</div>
        </div>
        <div className="actions">
        </div>
      </div>

      <DrilldownBadge drilldown={drilldown} onClear={() => setDrilldown(null)} />

      <div className="metric-strip">
        <div className="metric">
          <div className="m-label">Receita total</div>
          <div className="m-value">{B.fmt(totalReceita)}</div>
          <div className="m-pct">100%</div>
          <div className="m-bar"><div style={{ width: `100%` }} /></div>
        </div>
        <div className="metric">
          <div className="m-label">Despesa total</div>
          <div className="m-value">{B.fmt(totalDespesa)}</div>
          <div className="m-pct">{totalReceita > 0 ? `${((totalDespesa / totalReceita) * 100).toFixed(2).replace(".",",")}%` : "—"}</div>
          <div className="m-bar red"><div style={{ width: `${totalReceita > 0 ? Math.min(100, (totalDespesa / totalReceita) * 100) : 0}%` }} /></div>
        </div>
        <div className="metric">
          <div className="m-label">Valor líquido</div>
          <div className="m-value" style={{ color: valorLiq >= 0 ? "var(--green)" : "var(--red)" }}>{B.fmt(valorLiq)}</div>
          <div className="m-pct">{margemLiq.toFixed(2).replace(".",",")}%</div>
          <div className="m-bar cyan"><div style={{ width: `${Math.min(100, Math.max(0, margemLiq))}%` }} /></div>
        </div>
        <div className="metric">
          <div className="m-label">Margem líquida</div>
          <div className="m-value">{margemLiq.toFixed(2).replace(".",",")}%</div>
          <div className="m-pct">média do período</div>
          <div className="m-bar"><div style={{ width: `${Math.min(100, Math.max(0, margemLiq))}%` }} /></div>
        </div>
      </div>

      <div className="row row-1-1">
        <div className="card">
          <h2 className="card-title">Margem líquida por mês</h2>
          <TrendChart
            values={margemSeries}
            labels={B.MONTHS}
            color="var(--cyan)"
            height={220}
            gradientId="ml-cyan"
          />
        </div>
        <div className="card">
          <h2 className="card-title">Receita vs Despesa por mês</h2>
          <MonthlyBars data={B.MONTH_DATA} height={240} onBarClick={handleBarMes} activeIdx={activeMonthIdx} />
        </div>
      </div>
    </div>
  );
};

const PageReceita = ({ filters, setFilters, onOpenFilters, statusFilter, drilldown, setDrilldown, year, month }) => {
  const B = useMemo(() => window.getBit(statusFilter, drilldown, year, month, filters && filters.regime, filters), [statusFilter, drilldown, year, month, filters]);
  const BFull = useMemo(() => window.getBit(statusFilter, null, year, month, filters && filters.regime, filters), [statusFilter, year, month, filters]);
  const [range, setRange] = useState("12M");
  const refYear = (B.META && B.META.ref_year) || new Date().getFullYear();
  const mesesComDados = B.MONTH_DATA.filter(m => m.receita > 0).length || 1;
  const mediaMes = B.TOTAL_RECEITA / mesesComDados;
  const numClientes = useMemo(() => {
    var rg = (filters && filters.regime === "competencia") ? "k" : "c";
    var seen = new Set();
    var txs = window.filterTx ? window.filterTx(window.ALL_TX || [], statusFilter || "realizado", drilldown, rg, filters) : [];
    txs = txs.filter(r => r[1] && r[1].startsWith(String(year || refYear)));
    for (var i = 0; i < txs.length; i++) { if (txs[i][0] === "r" && txs[i][4]) seen.add(txs[i][4]); }
    return seen.size;
  }, [filters, statusFilter, drilldown, year, refYear]);
  const ticket = numClientes > 0 ? B.TOTAL_RECEITA / numClientes : 0;

  // Drilldown handlers
  const handleBarMes = (v, i) => {
    const mm = String(i + 1).padStart(2, "0");
    const ym = `${refYear}-${mm}`;
    const mn = B.MONTHS_FULL[i] || "";
    setDrilldown({ type: "mes", value: ym, label: `${mn.charAt(0).toUpperCase() + mn.slice(1, 3)}/${refYear}` });
  };
  const handleCategoria = (it) => setDrilldown({ type: "categoria", value: it.name, label: it.name });
  const handleCliente = (it) => setDrilldown({ type: "cliente", value: it.name, label: it.name });

  // Indices ativos para destaque
  const activeMonthIdx = (drilldown && drilldown.type === "mes")
    ? parseInt(drilldown.value.slice(5, 7), 10) - 1 : -1;
  const activeCategoria = (drilldown && drilldown.type === "categoria") ? drilldown.value : null;
  const activeCliente = (drilldown && drilldown.type === "cliente") ? drilldown.value : null;

  // Extrato filtrado de receitas (usa EXTRATO_RECEITAS pre-separado pelo build,
  // fallback pro filtro inline pra compat com BIT base)
  const extratoReceitas = B.EXTRATO_RECEITAS || B.EXTRATO.filter(e => e[4] > 0);
  const extratoFiltrado = window.applyDrilldown(extratoReceitas, drilldown);
  const totalFiltrado = drilldown
    ? extratoFiltrado.reduce((s, e) => s + e[4], 0)
    : B.TOTAL_RECEITA;

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Receita</h1>
          <div className="status-line">Composição por categoria, cliente e mês</div>
        </div>
        <div className="actions">
          <RegimeToggle filters={filters} setFilters={setFilters} />
        </div>
      </div>

      <DrilldownBadge drilldown={drilldown} onClear={() => setDrilldown(null)} />

      <div className="row row-4">
        <KpiTile label="Receita total" value={B.fmtK(B.TOTAL_RECEITA)} sparkValues={B.MONTH_DATA.map(m => m.receita)} sparkColor="var(--green)" tone="green" nonMonetary />
        <KpiTile label="Média por mês" value={B.fmtK(mediaMes)} sparkValues={B.MONTH_DATA.map(m => m.receita)} sparkColor="var(--cyan)" tone="cyan" nonMonetary />
        <KpiTile label="Clientes" value={String(numClientes)} sparkValues={B.MONTH_DATA.map(m => m.receita > 0 ? 1 : 0)} sparkColor="var(--cyan)" tone="cyan" nonMonetary />
        <KpiTile label="Ticket médio" value={B.fmtK(ticket)} sparkValues={B.MONTH_DATA.map(m => m.receita / 30)} sparkColor="var(--green)" tone="green" nonMonetary />
      </div>

      <div className="card">
        <h2 className="card-title">Receita por mês</h2>
        <SingleBars values={BFull.MONTH_DATA.map(m => m.receita)} labels={BFull.MONTHS_FULL} color="green" height={240}
          onBarClick={handleBarMes} activeIdx={activeMonthIdx} />
      </div>

      <div className="row" style={{ gridTemplateColumns: "minmax(0, 4fr) minmax(0, 5fr) minmax(0, 4fr)" }}>
        <div className="card">
          <h2 className="card-title">Receita por categoria</h2>
          <BarList items={BFull.RECEITA_CATEGORIAS} color="green" onItemClick={handleCategoria} activeName={activeCategoria} />
        </div>

        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Extrato de receitas {drilldown ? `· ${drilldown.label}` : ""}</h2>
          </div>
          <div className="t-scroll">
            <table className="t">
              <thead>
                <tr><th>Data</th><th>Categoria</th><th>Cliente</th><th className="num">Receita</th></tr>
              </thead>
              <tbody>
                {extratoFiltrado.slice(0, 30).map((e, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{e[0]}</td>
                    <td>{e[2]}</td>
                    <td>{e[3]}</td>
                    <td className="num green">{B.fmt(Math.abs(e[4]))}</td>
                  </tr>
                ))}
                {extratoFiltrado.length === 0 && (
                  <tr><td colSpan="4" style={{ color: "var(--mute)", textAlign: "center", padding: 18 }}>Sem receitas no filtro selecionado</td></tr>
                )}
                <tr className="total">
                  <td colSpan="3">Total{drilldown ? " (filtrado)" : ""}</td>
                  <td className="num green">{B.fmt(totalFiltrado)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Receita por cliente</h2>
          <BarList items={BFull.RECEITA_CLIENTES} color="green" onItemClick={handleCliente} activeName={activeCliente} />
        </div>
      </div>
    </div>
  );
};

const PageDespesa = ({ filters, setFilters, onOpenFilters, statusFilter, drilldown, setDrilldown, year, month }) => {
  const B = useMemo(() => window.getBit(statusFilter, drilldown, year, month, filters && filters.regime, filters), [statusFilter, drilldown, year, month, filters]);
  const BFull = useMemo(() => window.getBit(statusFilter, null, year, month, filters && filters.regime, filters), [statusFilter, year, month, filters]);
  const [range, setRange] = useState("12M");
  const refYear = (B.META && B.META.ref_year) || new Date().getFullYear();
  const totalDespesa = B.TOTAL_DESPESA;
  const mesesComDados = B.MONTH_DATA.filter(m => m.despesa > 0).length || 1;
  const mediaMes = totalDespesa / mesesComDados;
  const numFornec = useMemo(() => {
    var rg = (filters && filters.regime === "competencia") ? "k" : "c";
    var seen = new Set();
    var txs = window.filterTx ? window.filterTx(window.ALL_TX || [], statusFilter || "realizado", drilldown, rg, filters) : [];
    txs = txs.filter(r => r[1] && r[1].startsWith(String(year || refYear)));
    for (var i = 0; i < txs.length; i++) { if (txs[i][0] === "d" && txs[i][7]) seen.add(txs[i][7]); }
    return seen.size;
  }, [filters, statusFilter, drilldown, year, refYear]);
  const mediaDesp = numFornec > 0 ? totalDespesa / numFornec : 0;

  const handleBarMes = (v, i) => {
    const mm = String(i + 1).padStart(2, "0");
    const ym = `${refYear}-${mm}`;
    const mn = B.MONTHS_FULL[i] || "";
    setDrilldown({ type: "mes", value: ym, label: `${mn.charAt(0).toUpperCase() + mn.slice(1, 3)}/${refYear}` });
  };
  const handleCategoria = (it) => setDrilldown({ type: "categoria", value: it.name, label: it.name });
  const handleFornecedor = (it) => setDrilldown({ type: "fornecedor", value: it.name, label: it.name });

  const activeMonthIdx = (drilldown && drilldown.type === "mes")
    ? parseInt(drilldown.value.slice(5, 7), 10) - 1 : -1;
  const activeCategoria = (drilldown && drilldown.type === "categoria") ? drilldown.value : null;
  const activeFornecedor = (drilldown && drilldown.type === "fornecedor") ? drilldown.value : null;

  // Extrato filtrado de despesas (usa EXTRATO_DESPESAS pre-separado, fallback inline)
  const extratoDespesas = B.EXTRATO_DESPESAS || B.EXTRATO.filter(e => e[4] < 0);
  const extratoFiltrado = window.applyDrilldown(extratoDespesas, drilldown);
  const totalFiltrado = drilldown
    ? Math.abs(extratoFiltrado.reduce((s, e) => s + e[4], 0))
    : totalDespesa;

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Despesa</h1>
          <div className="status-line">Composição por categoria, fornecedor e mês</div>
        </div>
        <div className="actions">
          <RegimeToggle filters={filters} setFilters={setFilters} />
        </div>
      </div>

      <DrilldownBadge drilldown={drilldown} onClear={() => setDrilldown(null)} />

      <div className="row row-4">
        <KpiTile label="Despesas totais" value={B.fmtK(totalDespesa)} sparkValues={B.MONTH_DATA.map(m => m.despesa)} sparkColor="var(--red)" tone="red" nonMonetary />
        <KpiTile label="Média por mês" value={B.fmtK(mediaMes)} sparkValues={B.MONTH_DATA.map(m => m.despesa)} sparkColor="var(--red)" tone="red" nonMonetary />
        <KpiTile label="Fornecedores" value={String(numFornec)} sparkValues={B.MONTH_DATA.map(m => m.despesa > 0 ? 1 : 0)} sparkColor="var(--cyan)" tone="cyan" nonMonetary />
        <KpiTile label="Média de despesa" value={B.fmtK(mediaDesp)} sparkValues={B.MONTH_DATA.map(m => m.despesa / 30)} sparkColor="var(--red)" tone="red" nonMonetary />
      </div>

      <div className="card">
        <h2 className="card-title">Despesa por mês</h2>
        <SingleBars values={BFull.MONTH_DATA.map(m => m.despesa)} labels={BFull.MONTHS_FULL} color="red" height={240}
          onBarClick={handleBarMes} activeIdx={activeMonthIdx} />
      </div>

      <div className="row" style={{ gridTemplateColumns: "minmax(0, 4fr) minmax(0, 5fr) minmax(0, 4fr)" }}>
        <div className="card">
          <h2 className="card-title">Despesas por categoria</h2>
          <BarList items={BFull.DESPESA_CATEGORIAS} color="red" onItemClick={handleCategoria} activeName={activeCategoria} />
        </div>

        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Extrato de despesas {drilldown ? `· ${drilldown.label}` : ""}</h2>
          </div>
          <div className="t-scroll">
            <table className="t">
              <thead>
                <tr><th>Data</th><th>Categoria</th><th>Fornecedor</th><th className="num">Despesa</th></tr>
              </thead>
              <tbody>
                {extratoFiltrado.slice(0, 30).map((e, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{e[0]}</td>
                    <td>{e[2]}</td>
                    <td>{e[3]}</td>
                    <td className="num red">{B.fmt(Math.abs(e[4]))}</td>
                  </tr>
                ))}
                {extratoFiltrado.length === 0 && (
                  <tr><td colSpan="4" style={{ color: "var(--mute)", textAlign: "center", padding: 18 }}>Sem despesas no filtro selecionado</td></tr>
                )}
                <tr className="total">
                  <td colSpan="3">Total{drilldown ? " (filtrado)" : ""}</td>
                  <td className="num red">{B.fmt(totalFiltrado)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Despesas por fornecedor</h2>
          <BarList items={BFull.DESPESA_FORNECEDORES} color="red" onItemClick={handleFornecedor} activeName={activeFornecedor} />
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { PageOverview, PageIndicators, PageReceita, PageDespesa, RangePills });
