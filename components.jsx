/* BIT/BGP Finance — shared components v2 */
const { useState, useEffect, useMemo, useRef } = React;

const Icon = ({ name, ...props }) => {
  const paths = {
    home: <><path d="M3 10l9-7 9 7v10a2 2 0 01-2 2h-4v-7H9v7H5a2 2 0 01-2-2V10z"/></>,
    chart: <><path d="M3 21h18M6 17V9m6 8V5m6 12v-7"/></>,
    money: <><circle cx="12" cy="12" r="9"/><path d="M9 9.5c0-1.1.9-2 2-2h2.5a2 2 0 010 4H11a2 2 0 000 4h2.5a2 2 0 002-2M12 6v12"/></>,
    expense: <><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></>,
    flow: <><path d="M3 12h7l3-7 3 14 3-7h2"/></>,
    treasury: <><path d="M5 21V8l7-4 7 4v13M9 21v-7h6v7M3 21h18"/></>,
    compare: <><path d="M7 4v16M17 4v16M4 8h6M14 16h6"/></>,
    diary: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 7h16M9 3v18"/></>,
    report: <><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M14 3v6h6M9 13h6M9 17h4"/></>,
    fileText: <><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h6M8 9h2"/></>,
    invest: <><path d="M3 17l6-6 4 4 8-8"/><path d="M21 7v6h-6"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/></>,
    menu: <><path d="M4 6h16M4 12h10M4 18h16"/></>,
    chevronRight: <><path d="M9 6l6 6-6 6"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></>,
    bell: <><path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9zM10 21a2 2 0 004 0"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/></>,
    download: <><path d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16"/></>,
    sliders: <><path d="M4 6h11M4 12h7M4 18h13"/><circle cx="18" cy="6" r="2"/><circle cx="14" cy="12" r="2"/><circle cx="20" cy="18" r="2"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    arrowUp: <><path d="M7 14l5-5 5 5"/></>,
    arrowDown: <><path d="M7 10l5 5 5-5"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></>,
    cash: <><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></>,
    accrual: <><path d="M4 4h12l4 4v12H4z"/><path d="M4 12h16M12 4v16"/></>,
    filter: <><path d="M3 5h18l-7 9v6l-4-2v-4z"/></>,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {paths[name]}
    </svg>
  );
};

const Sidebar = ({ active, onSelect, open }) => {
  const general = [
    { id: "overview", icon: "home", label: "Visão Geral" },
    { id: "receita", icon: "money", label: "Receita" },
    { id: "despesa", icon: "expense", label: "Despesa" },
    { id: "fluxo", icon: "flow", label: "Fluxo de Caixa" },
    { id: "tesouraria", icon: "treasury", label: "Tesouraria" },
    { id: "comparativo", icon: "compare", label: "Comparativo" },
    { id: "relatorio", icon: "fileText", label: "Relatório IA" },
    { id: "orcamento", icon: "chart", label: "Orçamento" },
    { id: "dre", icon: "report", label: "DRE" },
    { id: "valuation", icon: "invest", label: "Valuation" },
    { id: "diary", icon: "diary", label: "Diário", badge: "EM BREVE" },
  ];
  const others = [
    { id: "indicators", icon: "chart", label: "Indicadores" },
    { id: "faturamento_produto", icon: "money", label: "Faturamento" },
    { id: "curva_abc", icon: "chart", label: "Curva ABC" },
    { id: "marketing", icon: "invest", label: "Marketing ADS" },
    { id: "hierarquia", icon: "chart", label: "Hierarquia ADS" },
    { id: "detalhado", icon: "report", label: "Detalhado" },
    { id: "profunda_cliente", icon: "user", label: "Profunda Cliente" },
    { id: "crm", icon: "money", label: "CRM" },
    { id: "settings", icon: "settings", label: "Configurações", badge: "EM BREVE" },
  ];
  // Modo da page (active/upsell/hidden) injetado pelo build-jsx.cjs a partir do bi.config.js
  const pageMode = (id) => (window.BI_PAGE_MODE && window.BI_PAGE_MODE[id]) || 'active';
  const isUpsell = (id) => pageMode(id) === 'upsell';
  const isHidden = (id) => pageMode(id) === 'hidden';

  const renderItem = (it) => {
    if (isHidden(it.id)) return null;
    const upsell = isUpsell(it.id);
    return (
      <button
        key={it.id}
        className={`sb-item ${active === it.id ? "active" : ""} ${upsell ? "sb-item-upsell" : ""}`}
        onClick={() => !it.badge && onSelect(it.id)}
        disabled={!!it.badge}
        style={it.badge ? { opacity: 0.55, cursor: "default" } : {}}
        title={upsell ? "Funcionalidade PRO — clique pra ver detalhes" : it.label}
      >
        <Icon name={it.icon} />
        <span className="label">{it.label}</span>
        {upsell && <span className="sb-item-badge-pro">PRO</span>}
        {it.badge && <span className="badge">{it.badge}</span>}
      </button>
    );
  };
  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="sb-brand">
        <img src="assets/bgp-logo-white.png" alt="SW Solar" className="sb-logo-img" style={{ height: 64, width: "auto", borderRadius: 6 }} />
      </div>
      <div className="sb-section">Geral</div>
      {general.map(renderItem)}
      <div className="sb-section">Outros</div>
      {others.map(renderItem)}
      <div className="sb-spacer" />
      <div className="sb-user">
        <div className="avatar">SW</div>
        <div className="who">
          <b>{(window.BIT_META && window.BIT_META.empresa && window.BIT_META.empresa.nome_fantasia) || "Cliente"}</b>
          <span>{(window.BIT_META && window.BIT_META.empresa && window.BIT_META.empresa.cidade) || "Cliente · BGP GO"}</span>
        </div>
      </div>
    </aside>
  );
};

const PAGE_TITLES = {
  overview: "Visão Geral",
  indicators: "Indicadores",
  receita: "Receita",
  despesa: "Despesa",
  fluxo: "Fluxo de Caixa",
  tesouraria: "Tesouraria",
  comparativo: "Comparativo",
  relatorio: "Relatório IA",
  faturamento_produto: "Faturamento por Produto",
  curva_abc: "Curva ABC de Produtos",
  marketing: "Marketing ADS",
  valuation: "Valuation",
  hierarquia: "Hierarquia ADS",
  detalhado: "Detalhado",
  profunda_cliente: "Profunda Cliente",
  crm: "CRM",
};

const DATE_RANGES = [
  { id: "hoje",   label: "Hoje" },
  { id: "semana", label: "Semana" },
  { id: "mes",    label: "Mês" },
  { id: "ano",    label: "Ano" },
];

const DateRangeSeg = ({ value, onChange }) => (
  <div className="seg date-range-seg">
    {DATE_RANGES.map(r => (
      <button key={r.id} className={value === r.id ? "active" : ""} onClick={() => onChange(r.id)}>{r.label}</button>
    ))}
  </div>
);

const STATUS_FILTERS = [
  { id: "realizado", label: "Realizado" },
  { id: "a_pagar_receber", label: "A pagar/receber" },
  { id: "tudo", label: "Tudo" },
];

const StatusFilterSeg = ({ value, onChange }) => (
  <div className="seg status-filter-seg" title="Filtro de status do lançamento">
    {STATUS_FILTERS.map(s => (
      <button key={s.id} className={value === s.id ? "active" : ""} onClick={() => onChange(s.id)}>{s.label}</button>
    ))}
  </div>
);

const YearSelect = ({ value, onChange, available }) => {
  const years = available && available.length ? available : [value];
  return (
    <select
      className="header-year"
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      title="Ano de referência"
    >
      {years.map(y => <option key={y} value={y}>{y}</option>)}
    </select>
  );
};

const MONTH_OPTS = [
  { v: 0, label: "Ano completo" },
  { v: 1, label: "Janeiro" }, { v: 2, label: "Fevereiro" }, { v: 3, label: "Março" },
  { v: 4, label: "Abril" }, { v: 5, label: "Maio" }, { v: 6, label: "Junho" },
  { v: 7, label: "Julho" }, { v: 8, label: "Agosto" }, { v: 9, label: "Setembro" },
  { v: 10, label: "Outubro" }, { v: 11, label: "Novembro" }, { v: 12, label: "Dezembro" },
];

const MonthSelect = ({ value, onChange }) => (
  <select
    className="header-year"
    value={value || 0}
    onChange={e => onChange(Number(e.target.value))}
    title="Mês de referência (Ano completo = todos)"
  >
    {MONTH_OPTS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
  </select>
);

// BiExportButton: modal com checkboxes pra exportar telas selecionadas como PDF
const BI_EXPORT_PAGES = [
  { id: "overview", label: "01 Visão Geral" },
  { id: "receita", label: "02 Receita" },
  { id: "despesa", label: "03 Despesa" },
  { id: "fluxo", label: "04 Fluxo de Caixa" },
  { id: "tesouraria", label: "05 Tesouraria" },
  { id: "comparativo", label: "06 Comparativo" },
  { id: "relatorio", label: "07 Relatório IA" },
  { id: "valuation", label: "08 Valuation" },
  { id: "indicators", label: "09 Indicadores" },
  { id: "faturamento_produto", label: "10 Faturamento por Produto" },
  { id: "curva_abc", label: "11 Curva ABC" },
  { id: "marketing", label: "12 Marketing ADS" },
  { id: "hierarquia", label: "13 Hierarquia ADS" },
  { id: "detalhado", label: "14 Detalhado" },
  { id: "profunda_cliente", label: "15 Profunda Cliente" },
  { id: "crm", label: "16 CRM" },
  { id: "orcamento", label: "17 Orçamento" },
  { id: "dre", label: "18 DRE" },
];

const BiExportButton = ({ statusFilter, year, month, filters }) => {
  const [open, setOpen] = useState(false);
  const visiblePages = BI_EXPORT_PAGES.filter(p => {
    const mode = window.BI_PAGE_MODE && window.BI_PAGE_MODE[p.id];
    return mode !== "hidden";
  });
  const [selected, setSelected] = useState(() => new Set(visiblePages.map(p => p.id)));
  const toggle = (id) => {
    setSelected(s => {
      const ns = new Set(s);
      if (ns.has(id)) ns.delete(id); else ns.add(id);
      return ns;
    });
  };
  const submitPdf = () => {
    if (selected.size === 0) return;
    const ordered = visiblePages.filter(p => selected.has(p.id)).map(p => p.id);
    if (window.startBiExport) window.startBiExport(ordered);
    setOpen(false);
  };
  return (
    <>
      <button className="btn-ghost hd-export-bi" onClick={() => setOpen(true)} title="Exportar BI">
        <Icon name="download" /> <span>Exportar BI</span>
      </button>
      {open && (
        <div className="drawer-overlay no-print" onClick={() => setOpen(false)}>
          <div className="card bi-export-modal" onClick={e => e.stopPropagation()}>
            <h2 className="card-title">Exportar BI</h2>
            <p style={{ color: "var(--fg-2)", marginTop: 8, fontSize: 13 }}>
              Selecione as telas e o formato de exportação.
            </p>
            <div className="bi-export-grid">
              {visiblePages.map(p => (
                <label key={p.id} className="bi-export-row">
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggle(p.id)}
                  />
                  <span>{p.label}</span>
                </label>
              ))}
            </div>
            <div className="bi-export-actions">
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-ghost" onClick={() => setSelected(new Set(visiblePages.map(p => p.id)))}>Todas</button>
                <button className="btn-ghost" onClick={() => setSelected(new Set())}>Nenhuma</button>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
                <button className="btn-primary" onClick={submitPdf} disabled={selected.size === 0}>
                  PDF ({selected.size})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Header: breadcrumb + date slicers + category filter + StatusFilter
const Header = ({ page, onToggleSidebar, statusFilter, setStatusFilter, year, setYear, month, setMonth, filters, setFilters }) => {
  const allCats = useMemo(() => {
    const tx = window.ALL_TX || [];
    const rg = (filters && filters.regime === "competencia") ? "k" : "c";
    const cats = new Set();
    for (var i = 0; i < tx.length; i++) { if (tx[i][9] === rg && tx[i][3]) cats.add(tx[i][3]); }
    return ["Todas categorias", ...Array.from(cats).sort()];
  }, [filters && filters.regime]);
  const dias = useMemo(() => {
    var d = [{ v: 0, l: "Todos" }];
    for (var i = 1; i <= 31; i++) d.push({ v: i, l: "" + i });
    return d;
  }, []);
  const updateFilter = (patch) => setFilters && setFilters(Object.assign({}, filters, patch));
  return (
    <header className="header">
      <button className="hd-icon-btn hd-menu-btn" title="Menu" onClick={onToggleSidebar}><Icon name="menu" /></button>
      <div className="breadcrumb">
        <img src="assets/bgp-logo-white.png" alt="SW Solar" style={{ height: 36, width: "auto", borderRadius: 4, marginRight: 6 }} />
        <Icon name="chevronRight" />
        <span>BI Financeiro</span>
        <Icon name="chevronRight" />
        <b>{PAGE_TITLES[page] || "Visão Geral"}</b>
        {window.BIT_META && window.BIT_META.fetched_at && (
          <span className="hd-updated">
            <Icon name="calendar" style={{ width: 12, height: 12 }} />
            Atualizado em {new Date(window.BIT_META.fetched_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>
      <div style={{ flex: 1 }} />
      <div className="hd-filters" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", overflow: "visible" }}>
        <label style={{ fontSize: 10, color: "var(--mute)", textTransform: "uppercase", letterSpacing: "0.05em" }}>De</label>
        <input type="date" className="header-year" value={(filters && filters.dateFrom) || ""} onChange={e => updateFilter({ dateFrom: e.target.value })} style={{ width: 130, fontSize: 12 }} />
        <label style={{ fontSize: 10, color: "var(--mute)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Até</label>
        <input type="date" className="header-year" value={(filters && filters.dateTo) || ""} onChange={e => updateFilter({ dateTo: e.target.value })} style={{ width: 130, fontSize: 12 }} />
        <label style={{ fontSize: 10, color: "var(--mute)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Dia de</label>
        <select className="header-year" value={(filters && filters.diaFrom) || 0} onChange={e => updateFilter({ diaFrom: Number(e.target.value) })} title="Dia inicial" style={{ width: 90, fontSize: 12 }}>
          {dias.map(d => <option key={d.v} value={d.v}>{d.l}</option>)}
        </select>
        <label style={{ fontSize: 10, color: "var(--mute)", textTransform: "uppercase", letterSpacing: "0.05em" }}>até</label>
        <select className="header-year" value={(filters && filters.diaTo) || 0} onChange={e => updateFilter({ diaTo: Number(e.target.value) })} title="Dia final" style={{ width: 90, fontSize: 12 }}>
          {dias.map(d => <option key={d.v} value={d.v}>{d.l}</option>)}
        </select>
        <select className="header-year" value={(filters && filters.categoria) || "Todas categorias"} onChange={e => updateFilter({ categoria: e.target.value })} title="Filtrar por categoria" style={{ maxWidth: 200, fontSize: 12 }}>
          {allCats.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {setStatusFilter && <StatusFilterSeg value={statusFilter} onChange={setStatusFilter} />}
      <BiExportButton statusFilter={statusFilter} year={year} month={month} filters={filters} />
    </header>
  );
};

// vertical bars (kept)
// Click handlers: onBarClick(monthData, idx). activeIdx adds .active class; outros ficam .dimmed
const MonthlyBars = ({ data, height = 230, type = "both", showLabels = true, onBarClick, activeIdx }) => {
  const max = Math.max(...data.map(d => Math.max(d.receita || 0, d.despesa || 0)));
  const grids = [0, 0.25, 0.5, 0.75, 1].map(p => p * max);
  const hasActive = activeIdx != null && activeIdx >= 0;
  return (
    <div style={{ position: "relative" }}>
      <div className="vbar-axis" style={{ height: height - 24 }}>
        {grids.map((g, i) => (<div key={i} className="grid" style={{ bottom: `${(g / max) * 100}%` }} />))}
        {grids.map((g, i) => (<div key={"l"+i} className="glabel" style={{ bottom: `${(g / max) * 100}%` }}>{window.BIT.fmtK(g)}</div>))}
      </div>
      <div className="vbar-chart" style={{ height }}>
        {data.map((d, i) => {
          const rH = ((d.receita || 0) / max) * 100;
          const dH = ((d.despesa || 0) / max) * 100;
          const cls = "vbar-col" + (onBarClick ? " clickable" : "") +
            (hasActive && i === activeIdx ? " active" : "") +
            (hasActive && i !== activeIdx ? " dimmed" : "");
          return (
            <div key={i} className={cls}
              onClick={onBarClick ? () => onBarClick(d, i) : undefined}
              style={onBarClick ? { cursor: "pointer" } : undefined}
            >
              <div className="stack">
                {(type === "both" || type === "receita") && (
                  <div className="bar" style={{ height: `${rH}%` }} title={`Receita: ${window.BIT.fmt(d.receita)}`}>
                    {showLabels && <span className="v">{window.BIT.fmtK(d.receita)}</span>}
                  </div>
                )}
                {(type === "both" || type === "despesa") && (
                  <div className="bar red" style={{ height: `${dH}%` }} title={`Despesa: ${window.BIT.fmt(d.despesa)}`}>
                    {showLabels && type === "despesa" && <span className="v">{window.BIT.fmtK(d.despesa)}</span>}
                  </div>
                )}
              </div>
              <span className="x">{d.m.slice(0, 3)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const SingleBars = ({ values, labels, color = "green", height = 200, onBarClick, activeIdx }) => {
  const max = Math.max(...values);
  const hasActive = activeIdx != null && activeIdx >= 0;
  return (
    <div className="vbar-chart" style={{ height }}>
      {values.map((v, i) => {
        const h = (v / max) * 100;
        const cls = "vbar-col" + (onBarClick ? " clickable" : "") +
          (hasActive && i === activeIdx ? " active" : "") +
          (hasActive && i !== activeIdx ? " dimmed" : "");
        return (
          <div key={i} className={cls}
            onClick={onBarClick ? () => onBarClick(v, i, labels[i]) : undefined}
            style={onBarClick ? { cursor: "pointer" } : undefined}
          >
            <div className="stack">
              <div className={`bar ${color === "red" ? "red" : ""}`} style={{ height: `${h}%`, width: 22, background: color === "cyan" ? "var(--cyan)" : (color === "red" ? "var(--red)" : "var(--green)") }} title={window.BIT.fmt(v)}>
                <span className="v">{window.BIT.fmtK(v)}</span>
              </div>
            </div>
            <span className="x">{labels[i].slice(0, 3)}</span>
          </div>
        );
      })}
    </div>
  );
};

const DailyBars = ({ values, color = "green", onBarClick, activeIdx }) => {
  const max = Math.max(...values);
  const subPeaks = values.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v).slice(0, 3).map(o => o.i);
  const hasActive = activeIdx != null && activeIdx >= 0;
  return (
    <div className="daily">
      <div className="daily-bars">
        {values.map((v, i) => {
          const h = (v / max) * 100;
          const cls = `b ${color === "red" ? "red" : ""} ${subPeaks.includes(i) ? "peak" : ""}` +
            (hasActive && i === activeIdx ? " active" : "") +
            (hasActive && i !== activeIdx ? " dimmed" : "");
          return (
            <div key={i} className={cls}
              style={{ height: `${Math.max(h, 1)}%`, cursor: onBarClick ? "pointer" : undefined }}
              data-v={window.BIT.fmtK(v)}
              title={`Dia ${i + 1}: ${window.BIT.fmt(v)}`}
              onClick={onBarClick ? () => onBarClick(i, v) : undefined}
            />
          );
        })}
      </div>
      <div className="daily-x">
        <span>1</span><span>5</span><span>10</span><span>15</span><span>20</span><span>25</span><span>31</span>
      </div>
    </div>
  );
};

// Stacked area chart — receita (verde) sobre despesa (vermelho)
const StackedArea = ({ data, height = 320, showAxis = true }) => {
  const w = 1000, h = height;
  const padX = 50, padTop = 16, padBottom = 30;
  const all = data.flatMap(d => [d.receita, d.despesa]);
  const min = 0;
  const max = Math.max(...all) * 1.1;
  const range = max - min;
  const stepX = (w - padX * 2) / (data.length - 1);

  const pts = (key) => data.map((d, i) => {
    const x = padX + i * stepX;
    const y = padTop + (1 - (d[key] - min) / range) * (h - padTop - padBottom);
    return [x, y];
  });
  const curve = (points) => {
    if (points.length < 2) return "";
    let p = `M ${points[0][0]} ${points[0][1]}`;
    for (let i = 1; i < points.length; i++) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      const cx = (x0 + x1) / 2;
      p += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
    }
    return p;
  };

  const ptsR = pts("receita");
  const ptsD = pts("despesa");
  const baseY = padTop + (h - padTop - padBottom);

  const areaR = curve(ptsR) + ` L ${ptsR[ptsR.length - 1][0]} ${baseY} L ${ptsR[0][0]} ${baseY} Z`;
  const areaD = curve(ptsD) + ` L ${ptsD[ptsD.length - 1][0]} ${baseY} L ${ptsD[0][0]} ${baseY} Z`;

  // y axis ticks
  const ticks = 5;
  const tickVals = Array.from({ length: ticks }, (_, i) => (max / (ticks - 1)) * i);

  return (
    <svg className="trend" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ height }}>
      <defs>
        <linearGradient id="ga-green" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.55"/>
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0.03"/>
        </linearGradient>
        <linearGradient id="ga-red" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.55"/>
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.03"/>
        </linearGradient>
      </defs>
      {showAxis && tickVals.map((tv, i) => {
        const y = padTop + (1 - tv / max) * (h - padTop - padBottom);
        return (
          <g key={i}>
            <line x1={padX} y1={y} x2={w - 10} y2={y} stroke="oklch(1 0 0 / 0.04)" strokeDasharray="3 4"/>
            <text x={padX - 8} y={y + 3} textAnchor="end" className="axis-text">R$ {(tv/1e6).toFixed(1).replace(".",",")}M</text>
          </g>
        );
      })}
      <path d={areaR} fill="url(#ga-green)" />
      <path d={areaD} fill="url(#ga-red)" />
      <path d={curve(ptsR)} fill="none" stroke="#22c55e" strokeWidth="2"/>
      <path d={curve(ptsD)} fill="none" stroke="#ef4444" strokeWidth="2"/>
      {showAxis && data.map((d, i) => {
        const x = padX + i * stepX;
        return <text key={i} x={x} y={h - 10} textAnchor="middle" className="axis-text" style={{ textTransform: "capitalize" }}>{d.m.slice(0,3)}</text>;
      })}
    </svg>
  );
};

// Trend (line + area)
const TrendChart = ({ values, labels, height = 160, color = "var(--cyan)", showPoints = true, showLabels = true, gradientId = "tg" }) => {
  const w = 1000, h = height;
  const padX = 40, padY = 32;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = (w - padX * 2) / (values.length - 1);
  const points = values.map((v, i) => {
    const x = padX + i * stepX;
    const y = padY + (1 - (v - min) / range) * (h - padY * 2);
    return [x, y];
  });
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = path + ` L ${points[points.length - 1][0]} ${h - padY} L ${points[0][0]} ${h - padY} Z`;
  return (
    <svg className="trend" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ height }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.30"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map(i => {
        const y = padY + (i / 3) * (h - padY * 2);
        return <line key={i} className="grid" x1={padX} y1={y} x2={w - padX} y2={y} />;
      })}
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
      {showPoints && points.map((p, i) => (
        <g key={i}>
          <circle cx={p[0]} cy={p[1]} r="3" fill={color}/>
          {showLabels && (
            <text className="point-label" x={p[0]} y={p[1] - 8} textAnchor="middle">{window.BIT.fmtK(values[i])}</text>
          )}
        </g>
      ))}
      {labels && labels.map((l, i) => (
        <text key={"x"+i} className="axis-text" x={padX + i * stepX} y={h - 6} textAnchor="middle">{l}</text>
      ))}
    </svg>
  );
};

const MultiLine = ({ series, labels, height = 180 }) => {
  const w = 1000, h = height;
  const padX = 30, padY = 24;
  const all = series.flatMap(s => s.values);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = max - min || 1;
  const stepX = (w - padX * 2) / (series[0].values.length - 1);
  return (
    <svg className="trend" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ height }}>
      {[0, 1, 2, 3].map(i => {
        const y = padY + (i / 3) * (h - padY * 2);
        return <line key={i} className="grid" x1={padX} y1={y} x2={w - padX} y2={y} />;
      })}
      {series.map((s, si) => {
        const points = s.values.map((v, i) => {
          const x = padX + i * stepX;
          const y = padY + (1 - (v - min) / range) * (h - padY * 2);
          return [x, y];
        });
        const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
        return (
          <g key={si}>
            <path d={path} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
            {points.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="2.5" fill={s.color}/>)}
          </g>
        );
      })}
      {labels && labels.map((l, i) => (
        <text key={"x"+i} className="axis-text" x={padX + i * stepX} y={h - 6} textAnchor="middle">{l}</text>
      ))}
    </svg>
  );
};

// Sparkline (used in KPI tile)
const Spark = ({ values, color = "var(--cyan)", filled = true, height = 38 }) => {
  const w = 100, h = height;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => [i * step, (1 - (v - min) / range) * (h - 6) + 3]);
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ");
  const id = `sp-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      {filled && (
        <>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.4"/>
              <stop offset="100%" stopColor={color} stopOpacity="0"/>
            </linearGradient>
          </defs>
          <path d={`${path} L ${w} ${h} L 0 ${h} Z`} fill={`url(#${id})`} />
        </>
      )}
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
};

// Composition donut
const Donut = ({ segments, size = 180, thickness = 22 }) => {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="oklch(0.20 0.012 240)" strokeWidth={thickness}/>
      {segments.map((seg, i) => {
        const len = (seg.value / total) * c;
        const off = c - acc;
        acc += len;
        return (
          <circle
            key={i}
            cx={size/2} cy={size/2} r={r}
            fill="none" stroke={seg.color} strokeWidth={thickness}
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={off}
            transform={`rotate(-90 ${size/2} ${size/2})`}
            strokeLinecap="butt"
          />
        );
      })}
    </svg>
  );
};

// Horizontal bar list (with thin track) — used for bank balances/category
// onItemClick(item, idx) torna a linha clicavel; activeName destaca a linha ativa.
const BarListLine = ({ items, color = "cyan", onItemClick, activeName }) => {
  const max = Math.max(...items.map(it => it.value));
  const hasActive = activeName != null;
  return (
    <div className="bar-list with-bars">
      {items.map((it, i) => {
        const w = (it.value / max) * 100;
        const isActive = hasActive && it.name === activeName;
        const cls = "bar-row" + (onItemClick ? " clickable" : "") +
          (isActive ? " active" : "") +
          (hasActive && !isActive ? " dimmed" : "");
        return (
          <div key={i} className={cls}
            onClick={onItemClick ? () => onItemClick(it, i) : undefined}
            style={onItemClick ? { cursor: "pointer" } : undefined}
          >
            <div className="row-meta">
              <span className="label">{it.name}</span>
              <span className="val">{window.BIT.fmt(it.value)}</span>
            </div>
            <div className="track"><div className={`fill ${color}`} style={{ width: `${w}%` }} /></div>
          </div>
        );
      })}
    </div>
  );
};

const BarListLegend = ({ items, total }) => {
  return (
    <div className="bar-list">
      {items.map((it, i) => {
        const pct = (it.value / total) * 100;
        return (
          <div key={i} className="bar-row">
            <div className="top">
              <span className="dot" style={{ background: it.color }} />
              <span className="label">{it.name}</span>
            </div>
            <div>
              <span className="val">{window.BIT.fmt(it.value)}</span>
              <span className="pct">{pct.toFixed(2).replace(".",",")}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const BarList = ({ items, color = "green", valueKey = "value", labelKey = "name", onItemClick, activeName }) => {
  const mapped = items.map(it => ({ name: it[labelKey], value: it[valueKey] }));
  // se vier onItemClick, propaga o item ORIGINAL (nao o mapeado) pra page poder usar campos extras
  const handler = onItemClick
    ? (mappedIt, idx) => onItemClick(items[idx], idx)
    : undefined;
  return <BarListLine items={mapped} color={color} onItemClick={handler} activeName={activeName} />;
};

const DivergingBars = ({ values, labels }) => {
  const maxAbs = Math.max(...values.map(v => Math.abs(v)));
  return (
    <div className="bar-list">
      {values.map((v, i) => {
        const w = (Math.abs(v) / maxAbs) * 50;
        const positive = v >= 0;
        return (
          <div key={i} className="div-row">
            <div className="label">{labels[i]}</div>
            <div style={{ display: "flex", height: 12, position: "relative" }}>
              <div style={{ flex: 1, position: "relative", borderRight: "1px solid oklch(1 0 0 / 0.08)" }}>
                {!positive && (<div style={{ position: "absolute", right: 0, top: 0, height: "100%", width: `${w * 2}%`, background: "var(--red)", borderRadius: "3px 0 0 3px" }} />)}
              </div>
              <div style={{ flex: 1, position: "relative" }}>
                {positive && (<div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${w * 2}%`, background: "var(--green)", borderRadius: "0 3px 3px 0" }} />)}
              </div>
            </div>
            <div className="val" style={{ color: positive ? "var(--green)" : "var(--red)" }}>{window.BIT.fmtK(v)}</div>
          </div>
        );
      })}
    </div>
  );
};

// KPI Tile (big numbers + sparkline). `tone` selects gradient: green / red / cyan / amber.
// `nonMonetary` hides the R$ prefix (for counts: clients, suppliers, etc).
const KpiTile = ({ label, value, unit, deltaPct, deltaDir, sparkValues, sparkColor, tone, nonMonetary }) => {
  return (
    <div className={`kpi-tile ${tone || ""}`}>
      <div>
        <div className="kpi-label">{label}</div>
        <div className="kpi-value">
          {!nonMonetary && <span className="currency">R$</span>}
          {value}
          {unit && <span className="unit">{unit}</span>}
        </div>
        {deltaPct != null && (
          <div className={`kpi-delta ${deltaDir}`}>
            <Icon name={deltaDir === "up" ? "arrowUp" : "arrowDown"} style={{ width: 12, height: 12 }} />
            {Math.abs(deltaPct).toFixed(1).replace(".", ",")}%
          </div>
        )}
      </div>
      {sparkValues && (
        <div className="spark-wrap">
          <Spark values={sparkValues} color={sparkColor || "var(--cyan)"} />
        </div>
      )}
    </div>
  );
};

// Default filter state — used for active-count + clear-all
const DEFAULT_FILTERS = {
  regime: "caixa",
  status: "Todos status",
  categoria: "Todas categorias",
  cc: "Todos centros de custo",
  dateFrom: "",
  dateTo: "",
  diaFrom: 0,
  diaTo: 0,
};

const countActiveFilters = (f) => {
  let n = 0;
  if (f.regime !== DEFAULT_FILTERS.regime) n++;
  if (f.status !== DEFAULT_FILTERS.status) n++;
  if (f.categoria !== DEFAULT_FILTERS.categoria) n++;
  if (f.cc !== DEFAULT_FILTERS.cc) n++;
  if (f.dateFrom || f.dateTo) n++;
  return n;
};

// Toolbar de filtros inline (substitui o modal removido).
// Lê categorias únicas de window.ALL_TX e seta drilldown global.
const InlineFilterBar = ({ kindHint, drilldown, setDrilldown }) => {
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [grupo, setGrupo] = React.useState(() => {
    if (kindHint === "r") return "Receita";
    if (kindHint === "d") return "Despesa";
    return drilldown && drilldown.type === "kind"
      ? (drilldown.value === "r" ? "Receita" : "Despesa")
      : "Todos";
  });
  React.useEffect(() => {
    if (kindHint === "r") setGrupo("Receita");
    else if (kindHint === "d") setGrupo("Despesa");
  }, [kindHint]);

  // Lê categorias únicas filtradas pelo grupo
  const categorias = React.useMemo(() => {
    const all = window.ALL_TX || [];
    const set = new Set();
    for (const row of all) {
      const [kind, , , categoria] = row;
      if (!categoria) continue;
      if (grupo === "Receita" && kind !== "r") continue;
      if (grupo === "Despesa" && kind !== "d") continue;
      set.add(categoria);
    }
    return [...set].sort();
  }, [grupo]);

  const filtered = React.useMemo(() => {
    if (!searchTerm) return categorias.slice(0, 50);
    const q = searchTerm.toLowerCase();
    return categorias.filter(c => c.toLowerCase().includes(q)).slice(0, 50);
  }, [categorias, searchTerm]);

  const activeCategoria = drilldown && drilldown.type === "categoria" ? drilldown.value : null;

  const setGrupoAndClearCat = (v) => {
    setGrupo(v);
    if (drilldown && drilldown.type === "categoria") setDrilldown(null);
  };
  const handleCatSelect = (c) => {
    setDrilldown({ type: "categoria", value: c, label: c });
    setSearchOpen(false);
    setSearchTerm("");
  };

  return (
    <div className="inline-filterbar">
      {!kindHint && (
        <label className="ifb-item">
          <span>Grupo</span>
          <select className="filter-select" value={grupo} onChange={e => setGrupoAndClearCat(e.target.value)}>
            <option>Todos</option>
            <option>Receita</option>
            <option>Despesa</option>
          </select>
        </label>
      )}
      <label className="ifb-item ifb-search-wrap">
        <span>Categoria</span>
        <div className="ifb-search-trigger" onClick={() => setSearchOpen(o => !o)}>
          <span style={{ flex: 1 }}>
            {activeCategoria
              ? <span style={{ color: "var(--cyan)", fontWeight: 600 }}>{activeCategoria.length > 28 ? activeCategoria.slice(0, 28) + "…" : activeCategoria}</span>
              : <span style={{ color: "var(--mute)" }}>Todas categorias</span>}
          </span>
          <Icon name="chevronRight" />
        </div>
        {searchOpen && (
          <div className="ifb-popover">
            <input
              autoFocus
              type="text"
              placeholder={`Pesquisar (${categorias.length} categorias)`}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="ifb-search-input"
            />
            <div className="ifb-popover-list">
              <div className="ifb-popover-item" onClick={() => { setDrilldown(null); setSearchOpen(false); setSearchTerm(""); }}>
                <i>Todas categorias</i>
              </div>
              {filtered.map(c => (
                <div key={c}
                  className={`ifb-popover-item ${activeCategoria === c ? "active" : ""}`}
                  onClick={() => handleCatSelect(c)}>
                  {c}
                </div>
              ))}
              {filtered.length === 0 && <div className="ifb-popover-item" style={{ color: "var(--mute)" }}>Nada encontrado</div>}
            </div>
          </div>
        )}
      </label>
      {(activeCategoria || (drilldown && drilldown.type !== "categoria")) && (
        <button className="btn-ghost" onClick={() => setDrilldown(null)} title="Limpar filtros">
          Limpar
        </button>
      )}
    </div>
  );
};

// Compact button that opens the side drawer
const Filters = ({ filters, onOpen, page }) => {
  if (page === "comparativo") return null;
  const active = countActiveFilters(filters);
  return (
    <button className="btn-ghost filters-btn" onClick={onOpen}>
      <Icon name="sliders" /> Filtros
      {active > 0 && <span className="filters-badge">{active}</span>}
    </button>
  );
};

// Export current view (window.print → Save as PDF)
const ExportButton = () => (
  <button className="btn-ghost" onClick={() => window.print()}>
    <Icon name="download" /> Exportar
  </button>
);

const FiltersDrawer = ({ open, onClose, filters, setFilters }) => {
  if (!open) return null;
  const update = (patch) => setFilters({ ...filters, ...patch });
  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <header className="drawer-header">
          <h2>Filtros</h2>
          <button className="drawer-close" onClick={onClose} aria-label="Fechar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>
        <div className="drawer-body">
          <div className="drawer-group">
            <label>Regime</label>
            <div className="seg full">
              <button className={filters.regime === "caixa" ? "active" : ""} onClick={() => update({ regime: "caixa" })}>
                <Icon name="cash" /> Caixa
              </button>
              <button className={filters.regime === "competencia" ? "active" : ""} onClick={() => update({ regime: "competencia" })}>
                <Icon name="accrual" /> Competência
              </button>
            </div>
          </div>
          <div className="drawer-group">
            <label>Status</label>
            <select className="filter-select" value={filters.status} onChange={(e) => update({ status: e.target.value })}>
              <option>Todos status</option><option>Pago</option><option>A pagar</option><option>Atrasado</option>
            </select>
          </div>
          <div className="drawer-group">
            <label>Categoria</label>
            <select className="filter-select" value={filters.categoria} onChange={(e) => update({ categoria: e.target.value })}>
              <option>Todas categorias</option><option>Folha</option><option>Marketing</option><option>Impostos</option>
              <option>Infra & Cloud</option><option>Software & SaaS</option><option>Comissões</option>
            </select>
          </div>
          <div className="drawer-group">
            <label>Centro de custo</label>
            <select className="filter-select" value={filters.cc} onChange={(e) => update({ cc: e.target.value })}>
              <option>Todos centros de custo</option><option>Comercial</option><option>Operações</option><option>Financeiro</option>
            </select>
          </div>
          <div className="drawer-group">
            <label>Período personalizado</label>
            <div className="date-range-pair">
              <input type="date" className="filter-select" value={filters.dateFrom} onChange={(e) => update({ dateFrom: e.target.value })} />
              <span className="date-range-sep">→</span>
              <input type="date" className="filter-select" value={filters.dateTo} onChange={(e) => update({ dateTo: e.target.value })} />
            </div>
          </div>
        </div>
        <footer className="drawer-footer">
          <button className="btn-ghost" onClick={() => setFilters({ ...DEFAULT_FILTERS })}>Limpar</button>
          <button className="btn-primary" onClick={onClose}>Aplicar</button>
        </footer>
      </aside>
    </div>
  );
};

// Chip que indica que o usuario filtrou um pedaco da tela clicando num grafico.
// drilldown shape: { type: 'mes'|'categoria'|'cliente'|'fornecedor'|'dia', value, label }
const DrilldownBadge = ({ drilldown, onClear }) => {
  if (!drilldown) return null;
  return (
    <div className="drilldown-badge">
      <span className="dd-label">Filtrando: <b>{drilldown.label}</b></span>
      <button className="dd-clear" onClick={onClear} aria-label="Limpar filtro">× Limpar</button>
    </div>
  );
};

// Helpers usados nas Pages para filtrar o EXTRATO conforme o drilldown ativo.
// EXTRATO row layout: [data DD/MM/YYYY, ccusto, categoria, cliente/fornecedor, valor, status]
function extratoMonthKey(dateStr) {
  // "04/05/2026" -> "2026-05"
  if (!dateStr || typeof dateStr !== "string") return "";
  const parts = dateStr.split("/");
  if (parts.length !== 3) return "";
  return `${parts[2]}-${parts[1]}`;
}
function applyDrilldown(extrato, dd) {
  if (!dd || !Array.isArray(extrato)) return extrato;
  if (dd.type === "mes") {
    return extrato.filter(e => extratoMonthKey(e[0]) === dd.value);
  }
  if (dd.type === "categoria") {
    return extrato.filter(e => e[2] === dd.value);
  }
  if (dd.type === "cliente" || dd.type === "fornecedor") {
    return extrato.filter(e => e[3] === dd.value);
  }
  return extrato;
}

// Toggle Caixa/Competência inline (visível direto nas pages)
const RegimeToggle = ({ filters, setFilters }) => {
  if (!filters || !setFilters) return null;
  const regime = (filters && filters.regime) || "caixa";
  const set = (r) => setFilters({ ...filters, regime: r });
  return (
    <div className="seg" style={{ minWidth: 200 }}>
      <button className={regime === "caixa" ? "active" : ""} onClick={() => set("caixa")}>
        <Icon name="cash" /> Caixa
      </button>
      <button className={regime === "competencia" ? "active" : ""} onClick={() => set("competencia")}>
        <Icon name="accrual" /> Competência
      </button>
    </div>
  );
};

Object.assign(window, {
  Icon, Sidebar, Header, Filters, FiltersDrawer, InlineFilterBar, ExportButton, DEFAULT_FILTERS,
  MonthlyBars, SingleBars, DailyBars, StackedArea, TrendChart, MultiLine,
  BarList, BarListLine, BarListLegend, DivergingBars, Donut, Spark, KpiTile,
  PAGE_TITLES, StatusFilterSeg, STATUS_FILTERS,
  DrilldownBadge, applyDrilldown, extratoMonthKey, RegimeToggle,
});
