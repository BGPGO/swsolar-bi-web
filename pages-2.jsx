/* BIT/BGP Finance — Pages 2: Fluxo, Tesouraria, Comparativo */
const { useState, useMemo, useEffect } = React;

// useIsMobile é declarado em pages-1.jsx e disponibilizado globalmente no bundle
// concatenado (build-jsx.cjs). Reutilizado aqui pra ajustar height/showLabels dos
// TrendCharts em mobile.

const PageFluxo = ({ filters, setFilters, onOpenFilters, statusFilter, drilldown, setDrilldown, year, month }) => {
  const B = useMemo(() => window.getBit(statusFilter, drilldown, year, month, filters && filters.regime, filters), [statusFilter, drilldown, year, month, filters]);
  const isMobile = useIsMobile();
  const [view, setView] = useState("horizontal");
  const [expanded, setExpanded] = useState({ Receita: true, Despesa: true });
  const refYear = (B.META && B.META.ref_year) || new Date().getFullYear();
  const regime = (filters && filters.regime) || "caixa";

  // Compute full matrix from ALL_TX
  const matrix = useMemo(() => {
    const allTx = window.ALL_TX || [];
    const sf = statusFilter || "realizado";
    // Use filterTx with extraFilters (dateFrom, dateTo, categoria, dia)
    var txs = window.filterTx ? window.filterTx(allTx, sf, null, regime, filters) : allTx;
    txs = txs.filter(r => r[1] && r[1].startsWith(String(year || refYear)));

    const result = {
      receita: { total: Array(12).fill(0), cats: new Map() },
      despesa: { total: Array(12).fill(0), cats: new Map() }
    };

    for (const row of txs) {
      const kind = row[0];
      const mes = row[1];
      const categoria = row[3];
      const cliente = row[4];
      const valor = row[5];
      const fornecedor = row[7];
      const mIdx = parseInt(mes.slice(5, 7), 10) - 1;
      if (mIdx < 0 || mIdx > 11) continue;
      const section = kind === "r" ? result.receita : result.despesa;
      section.total[mIdx] += valor;
      if (!section.cats.has(categoria)) section.cats.set(categoria, { total: Array(12).fill(0), subs: new Map() });
      const cat = section.cats.get(categoria);
      cat.total[mIdx] += valor;
      const subName = kind === "r" ? (cliente || "Sem cliente") : (fornecedor || "Sem fornecedor");
      if (!cat.subs.has(subName)) cat.subs.set(subName, Array(12).fill(0));
      cat.subs.get(subName)[mIdx] += valor;
    }
    return result;
  }, [statusFilter, regime, year, refYear, filters]);

  const toggleExpand = (key) => setExpanded(s => ({ ...s, [key]: !s[key] }));

  const months = B.MONTHS_FULL || [];
  const fmt = B.fmt;

  // Sort categories by total sum descending
  const sortedCats = (catsMap) => {
    return [...catsMap.entries()]
      .map(([name, data]) => ({ name, total: data.total, subs: data.subs, sum: data.total.reduce((s, v) => s + v, 0) }))
      .sort((a, b) => b.sum - a.sum);
  };

  const sortedSubs = (subsMap) => {
    return [...subsMap.entries()]
      .map(([name, vals]) => ({ name, values: vals, sum: vals.reduce((s, v) => s + v, 0) }))
      .filter(s => s.sum > 0)
      .sort((a, b) => b.sum - a.sum);
  };

  // % helper
  const pctLabel = (val, rowTotal, mIdx) => {
    if (view === "vertical") {
      const base = matrix.receita.total[mIdx];
      return base ? ((val / base) * 100).toFixed(1).replace(".", ",") + "%" : "—";
    } else {
      return rowTotal ? ((val / rowTotal) * 100).toFixed(1).replace(".", ",") + "%" : "—";
    }
  };

  const stickyStyle = { position: "sticky", left: 0, background: "var(--surface)", zIndex: 1 };
  const stickyStyleZ2 = { position: "sticky", left: 0, background: "var(--surface)", zIndex: 2 };

  // Totals for footer
  const totalRecAnual = matrix.receita.total.reduce((s, v) => s + v, 0);
  const totalDespAnual = matrix.despesa.total.reduce((s, v) => s + v, 0);
  const totalLiq = totalRecAnual - totalDespAnual;

  // Section renderer (inlined as function returning JSX array — no hooks inside)
  const renderSection = (label, sectionData, colorClass, kind) => {
    const expKey = label;
    const isExpanded = expanded[expKey];
    const sectionTotal = sectionData.total.reduce((s, v) => s + v, 0);
    const cats = sortedCats(sectionData.cats);
    const rows = [];

    // Section header row
    rows.push(
      <tr key={`sec-${label}`} className="section">
        <td style={stickyStyle}>
          <button
            onClick={() => toggleExpand(expKey)}
            style={{ background: "transparent", border: 0, color: "inherit", padding: 0, fontWeight: 700, fontFamily: "inherit", fontSize: "inherit", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <span className="chev">{isExpanded ? "−" : "+"}</span>{label}
          </button>
        </td>
        {months.map((_, i) => (
          <td key={i} className={`num ${colorClass}`}>{fmt(sectionData.total[i])}</td>
        ))}
        <td className={`num ${colorClass}`} style={{ fontWeight: 700 }}>{fmt(sectionTotal)}</td>
        <td className="num" style={{ color: "var(--fg-3)" }}>
          {view === "vertical"
            ? "100%"
            : (sectionTotal ? "100%" : "—")}
        </td>
      </tr>
    );

    if (!isExpanded) return rows;

    // Category rows
    for (const cat of cats) {
      const catKey = `cat:${label}:${cat.name}`;
      const isCatExpanded = expanded[catKey];
      const catTotal = cat.sum;
      rows.push(
        <tr key={catKey}>
          <td style={stickyStyle}>
            <button
              onClick={() => toggleExpand(catKey)}
              style={{ background: "transparent", border: 0, color: "inherit", padding: "0 0 0 18px", fontFamily: "inherit", fontSize: "inherit", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <span className="chev">{isCatExpanded ? "−" : "+"}</span>{cat.name}
            </button>
          </td>
          {months.map((_, i) => (
            <td key={i} className={`num ${colorClass}`} style={{ opacity: 0.85 }}>{cat.total[i] ? fmt(cat.total[i]) : "—"}</td>
          ))}
          <td className={`num ${colorClass}`}>{fmt(catTotal)}</td>
          <td className="num" style={{ color: "var(--fg-3)", fontSize: 11 }}>
            {sectionTotal ? ((catTotal / sectionTotal) * 100).toFixed(1).replace(".", ",") + "%" : "—"}
          </td>
        </tr>
      );

      if (!isCatExpanded) continue;

      // Sub-item rows
      const subs = sortedSubs(cat.subs);
      for (const sub of subs) {
        const subTotal = sub.sum;
        rows.push(
          <tr key={`sub:${label}:${cat.name}:${sub.name}`} style={{ opacity: 0.78 }}>
            <td style={{ ...stickyStyle, paddingLeft: 36, fontSize: 11, color: "var(--fg-2)" }}>
              {sub.name}
            </td>
            {months.map((_, i) => (
              <td key={i} className={`num ${colorClass}`} style={{ fontSize: 11 }}>{sub.values[i] ? fmt(sub.values[i]) : "—"}</td>
            ))}
            <td className={`num ${colorClass}`} style={{ fontSize: 11 }}>{fmt(subTotal)}</td>
            <td className="num" style={{ color: "var(--fg-3)", fontSize: 10 }}>
              {catTotal ? ((subTotal / catTotal) * 100).toFixed(1).replace(".", ",") + "%" : "—"}
            </td>
          </tr>
        );
      }
    }

    return rows;
  };

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Fluxo de Caixa</h1>
          <div className="status-line">Matriz por categoria com hierarquia expandível</div>
        </div>
        <div className="actions">
          <div className="seg">
            <button className={view === "horizontal" ? "active" : ""} onClick={() => setView("horizontal")}>Horizontal</button>
            <button className={view === "vertical" ? "active" : ""} onClick={() => setView("vertical")}>Vertical</button>
          </div>
          <RegimeToggle filters={filters} setFilters={setFilters} />
        </div>
      </div>
      <div className="card" style={{ overflow: "auto" }}>
        <table className="t" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th style={{ minWidth: 240, position: "sticky", left: 0, background: "var(--surface)", zIndex: 3 }}>Categoria</th>
              {months.map(m => (
                <th key={m} className="num" style={{ minWidth: 88 }}>{m ? m.slice(0, 3) : ""}</th>
              ))}
              <th className="num" style={{ minWidth: 100 }}>Total</th>
              <th className="num" style={{ minWidth: 68 }}>%</th>
            </tr>
          </thead>
          <tbody>
            {renderSection("Receita", matrix.receita, "green", "r")}
            {renderSection("Despesa", matrix.despesa, "red", "d")}
            <tr className="total">
              <td style={stickyStyle}>Total Líquido</td>
              {months.map((_, i) => {
                const liq = matrix.receita.total[i] - matrix.despesa.total[i];
                return (
                  <td key={i} className="num" style={{ color: liq >= 0 ? "var(--green)" : "var(--red)" }}>
                    {fmt(liq)}
                  </td>
                );
              })}
              <td className="num" style={{ color: totalLiq >= 0 ? "var(--green)" : "var(--red)", fontWeight: 700 }}>
                {fmt(totalLiq)}
              </td>
              <td className="num" style={{ color: "var(--fg-3)", fontSize: 11 }}>
                {totalRecAnual ? ((totalLiq / totalRecAnual) * 100).toFixed(1).replace(".", ",") + "%" : "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

const PageTesouraria = ({ filters, setFilters, onOpenFilters, statusFilter, drilldown, setDrilldown, year, month }) => {
  const B = useMemo(() => window.getBit(statusFilter, drilldown, year, month, filters && filters.regime, filters), [statusFilter, drilldown, year, month, filters]);
  const BFull = useMemo(() => window.getBit(statusFilter, null, year, month, filters && filters.regime, filters), [statusFilter, year, month, filters]);
  const BReal = useMemo(() => window.getBit('realizado', null, year, month, filters && filters.regime, filters), [year, month, filters]);
  const BPend = useMemo(() => window.getBit('a_pagar_receber', null, year, month, filters && filters.regime, filters), [year, month, filters]);
  const isMobile = useIsMobile();
  const recebido = BReal.TOTAL_RECEITA || 0;
  const aReceber = BPend.TOTAL_RECEITA || 0;
  const pago = BReal.TOTAL_DESPESA || 0;
  const aPagar = BPend.TOTAL_DESPESA || 0;

  // Computar RECEITA_DIA e DESPESA_DIA do BFull (reagindo a year/month/regime)
  const recDiaSeg = BReal.RECEITA_DIA || BFull.RECEITA_DIA || Array(31).fill(0);
  const pagoDiaSeg = BReal.DESPESA_DIA || BFull.DESPESA_DIA || Array(31).fill(0);
  const aReceberDiaSeg = BPend.RECEITA_DIA || Array(31).fill(0);
  const aPagarDiaSeg = BPend.DESPESA_DIA || Array(31).fill(0);

  // Drilldown handler para DailyBars (clique no dia)
  const activeDayIdx = (drilldown && drilldown.type === "dia") ? drilldown.value : -1;
  const handleDayClick = (i) => {
    setDrilldown({ type: "dia", value: i, label: `Dia ${i + 1}` });
  };

  const saldosMes = BFull.SALDOS_MES || Array(12).fill(0);
  // Cumulativo (running balance): cada mês = saldo atual após acumular movimentos
  const SALDOS_REAIS = (window.BIT_EXTRAS && window.BIT_EXTRAS.saldos) || null;
  // Saldo inicial do ano: usa o saldo real mais antigo da planilha (se disponível) menos os movimentos até o mês desse saldo.
  // Sem isso, parte de 0 e mostra apenas o efeito dos movimentos.
  const saldoInicial = (function() {
    if (!SALDOS_REAIS || !SALDOS_REAIS.last) return 0;
    const lastDate = new Date(SALDOS_REAIS.last.data);
    const lastMonthIdx = lastDate.getMonth();
    // Saldo no mês N = saldoInicial + sum(saldosMes[0..N]). Sabemos saldo atual e queremos saldo inicial.
    // saldoInicial = saldoAtual - sum(saldosMes[0..lastMonthIdx])
    let acumAteAgora = 0;
    for (let i = 0; i <= lastMonthIdx; i++) acumAteAgora += saldosMes[i] || 0;
    return SALDOS_REAIS.last.total - acumAteAgora;
  })();
  const saldosCum = saldosMes.reduce((acc, v, i) => {
    acc.push((acc[i - 1] != null ? acc[i - 1] : saldoInicial) + (v || 0));
    return acc;
  }, []);
  const sMax = Math.max(...saldosCum, 0);
  const sMin = Math.min(...saldosCum, 0);
  const sMed = saldosCum.length ? saldosCum.reduce((s, v) => s + v, 0) / saldosCum.length : 0;

  // Fluxo a vencer: pega o segmento a_pagar_receber (que tem só items NÃO realizados)
  // e filtra por data >= hoje. Ordem ascendente (próximo vencimento primeiro).
  const todayKey = (function() {
    const t = new Date();
    return t.getFullYear() * 10000 + (t.getMonth() + 1) * 100 + t.getDate();
  })();
  const parseFluxoDate = (s) => {
    const [d, m, y] = (s || '').split('/').map(Number);
    if (!d || !m || !y) return 0;
    return y * 10000 + m * 100 + d;
  };
  const saldoBaseInicial = (SALDOS_REAIS && SALDOS_REAIS.last && SALDOS_REAIS.last.total) || 0;
  const fluxoFuturoFull = useMemo(() => {
    // Lê direto de ALL_TX (não usa SEG.EXTRATO porque buildExtrato faz slice(0,200)
    // sortado DESC, perdendo lançamentos de 2026 quando há parcelas até 2033).
    const allTx = window.ALL_TX || [];
    // Filtra: não realizado (a-vencer) E data >= hoje
    // ALL_TX schema: [kind, mes (yyyy-mm), dia, categoria, cliente, valor, realizado, fornecedor, cc]
    const apr = allTx.filter(r => r[6] === 0);
    // Constrói tupla compatível com EXTRATO: [data DD/MM/YYYY, cc, categoria, cliente/fornec, valorAssinado, status]
    const rows = apr.map(r => {
      const [kind, mes, dia, categoria, cliente, valor, _realizado, fornecedor, cc] = r;
      if (!mes || !dia) return null;
      const dataStr = String(dia).padStart(2, '0') + '/' + mes.slice(5, 7) + '/' + mes.slice(0, 4);
      const valorAssinado = kind === 'r' ? valor : -valor;
      return [dataStr, cc || 'Operações', categoria, kind === 'r' ? cliente : fornecedor, valorAssinado, ''];
    }).filter(Boolean);
    // Aplica drilldown se houver
    const filtered = window.applyDrilldown ? window.applyDrilldown(rows, drilldown) : rows;
    // Filtra futuro + sort ASC (mais próximas primeiro)
    const sorted = filtered
      .filter(e => parseFluxoDate(e[0]) >= todayKey)
      .sort((a, b) => parseFluxoDate(a[0]) - parseFluxoDate(b[0]));
    // Saldo running
    let saldoRunning = saldoBaseInicial;
    return sorted.map((e) => {
      saldoRunning += (e[4] || 0);
      return [...e, saldoRunning];
    });
  }, [drilldown, todayKey, saldoBaseInicial]);

  // Tabela limita a 60 linhas, mas análise de risco usa o full
  const fluxoFuturo = useMemo(() => fluxoFuturoFull.slice(0, 60), [fluxoFuturoFull]);

  // Análise de risco de caixa: quando o saldo cai abaixo de zero pela 1ª vez?
  // Mínimo projetado e em qual data?
  const riscoAnalise = useMemo(() => {
    if (fluxoFuturoFull.length === 0) return null;
    let primeiroNegativo = null;
    let minSaldo = saldoBaseInicial;
    let minSaldoData = null;
    let saldoFinal = saldoBaseInicial;
    for (const row of fluxoFuturoFull) {
      const saldo = row[6];
      if (saldo < 0 && primeiroNegativo == null) {
        primeiroNegativo = { data: row[0], saldo, valor: row[4], movimento: row[3] || row[2] };
      }
      if (saldo < minSaldo) {
        minSaldo = saldo;
        minSaldoData = row[0];
      }
      saldoFinal = saldo;
    }
    // Dias até primeiro negativo
    let diasAteCrise = null;
    if (primeiroNegativo) {
      const [d, m, y] = primeiroNegativo.data.split('/').map(Number);
      const t = new Date(); t.setHours(0,0,0,0);
      const target = new Date(y, m - 1, d);
      diasAteCrise = Math.round((target - t) / (1000 * 60 * 60 * 24));
    }
    return { primeiroNegativo, minSaldo, minSaldoData, saldoFinal, diasAteCrise, totalLancamentos: fluxoFuturoFull.length };
  }, [fluxoFuturoFull, saldoBaseInicial]);

  // Saldo dia-a-dia agregado (pra chart de projeção). Agrupa lançamentos do mesmo dia.
  const saldoDiario = useMemo(() => {
    if (fluxoFuturoFull.length === 0) return [];
    const byDay = new Map();
    for (const row of fluxoFuturoFull) {
      const dataKey = row[0]; // DD/MM/YYYY
      // Para o chart, queremos o saldo NO FIM do dia
      byDay.set(dataKey, row[6]);
    }
    return [...byDay.entries()].map(([data, saldo]) => ({ data, saldo }));
  }, [fluxoFuturoFull]);

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Tesouraria</h1>
          <div className="status-line"><span className="live-dot" /> Saldos e pulso · {(B.META && B.META.ref_year) || "—"}</div>
        </div>
        <div className="actions">
          <RegimeToggle filters={filters} setFilters={setFilters} />
        </div>
      </div>

      <DrilldownBadge drilldown={drilldown} onClear={() => setDrilldown(null)} />

      <div className="row row-4">
        <KpiTile label={drilldown ? `Recebido · ${drilldown.label}` : "Recebido (PAGO)"} value={B.fmtK(drilldown ? B.TOTAL_RECEITA : recebido)} sparkValues={recDiaSeg} sparkColor="var(--green)" tone="green" nonMonetary />
        <KpiTile label={drilldown ? `A receber · ${drilldown.label}` : "A receber"} value={B.fmtK(drilldown ? 0 : aReceber)} sparkValues={aReceberDiaSeg} sparkColor="var(--cyan)" tone="cyan" nonMonetary />
        <KpiTile label={drilldown ? `Pago · ${drilldown.label}` : "Pago"} value={B.fmtK(drilldown ? B.TOTAL_DESPESA : pago)} sparkValues={pagoDiaSeg} sparkColor="var(--red)" tone="red" nonMonetary />
        <KpiTile label={drilldown ? `A pagar · ${drilldown.label}` : "A pagar"} value={B.fmtK(drilldown ? 0 : aPagar)} sparkValues={aPagarDiaSeg} sparkColor="var(--amber)" tone="amber" nonMonetary />
      </div>

      <div className="row row-1-1">
        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Pulso de receitas</h2>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span className="chip green">Recebido · {B.fmt(recebido)}</span>
              <span className="chip cyan">A receber · {B.fmt(aReceber)}</span>
            </div>
          </div>
          <DailyBars values={recDiaSeg} color="green" onBarClick={handleDayClick} activeIdx={activeDayIdx} />
        </div>
        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Pulso de despesas</h2>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span className="chip red">Pago · {B.fmt(pago)}</span>
              <span className="chip" style={{ background: "rgba(245,158,11,0.12)", color: "#fcd34d", borderColor: "rgba(245,158,11,0.28)" }}>A pagar · {B.fmt(aPagar)}</span>
            </div>
          </div>
          <DailyBars values={pagoDiaSeg} color="red" onBarClick={handleDayClick} activeIdx={activeDayIdx} />
        </div>
      </div>

      {/* Extrato do dia filtrado */}
      {drilldown && drilldown.type === "dia" && (
        <div className="card">
          <h2 className="card-title">Extrato · {drilldown.label}</h2>
          <div className="t-scroll" style={{ maxHeight: 320 }}>
            <table className="t">
              <thead>
                <tr><th>Data</th><th>Categoria</th><th>Cliente / Fornecedor</th><th className="num">Valor</th></tr>
              </thead>
              <tbody>
                {(B.EXTRATO || []).slice(0, 50).map((e, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{e[0]}</td>
                    <td>{e[2]}</td>
                    <td>{e[3]}</td>
                    <td className={`num ${e[4] >= 0 ? "green" : "red"}`}>{B.fmt(e[4])}</td>
                  </tr>
                ))}
                {(!B.EXTRATO || B.EXTRATO.length === 0) && (
                  <tr><td colSpan="4" style={{ color: "var(--mute)", textAlign: "center", padding: 18 }}>Sem movimentações neste dia</td></tr>
                )}
                <tr className="total">
                  <td colSpan="3">Total do dia</td>
                  <td className={`num ${B.VALOR_LIQUIDO >= 0 ? "green" : "red"}`}>{B.fmt(B.VALOR_LIQUIDO)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Saldo real (planilha de saldos) + projeção futura */}
      {(function() {
        const SALDOS = (window.BIT_EXTRAS && window.BIT_EXTRAS.saldos) || null;
        if (!SALDOS || !SALDOS.last) return null;
        const last = SALDOS.last;
        const contas = Object.entries(last.contas).sort((a, b) => b[1] - a[1]);
        // Projeção: saldo último + ∑(a receber) − ∑(a pagar) acumulado por mês.
        // Usa BIT_SEGMENTS.a_pagar_receber pra somar ainda-pendente por mês futuro.
        const seg = (window.BIT_SEGMENTS || {}).a_pagar_receber || { MONTH_DATA: [] };
        const lastDate = new Date(last.data);
        const lastMonthIdx = lastDate.getMonth();
        const proj = [];
        let saldo = last.total;
        for (let i = lastMonthIdx + 1; i < 12; i++) {
          const md = seg.MONTH_DATA[i] || { receita: 0, despesa: 0 };
          saldo += (md.receita || 0) - (md.despesa || 0);
          proj.push({ m: B.MONTHS_FULL[i] || `M${i+1}`, saldo });
        }
        const series = [last.total, ...proj.map(p => p.saldo)];
        const labels = ['Hoje', ...proj.map(p => p.m.slice(0,3))];
        const minProj = Math.min(...series);
        const maxProj = Math.max(...series);
        return (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-title-row">
              <h2 className="card-title">Saldo atual e projeção</h2>
              <span className="chip cyan">Última atualização: {last.data.split('-').reverse().join('/')}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 18 }}>
              {contas.map(([nome, v]) => (
                <div key={nome} className="indicator-card" style={{ padding: 12 }}>
                  <div className="kpi-label" style={{ fontSize: 10 }}>{nome}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16, color: v >= 0 ? 'var(--green)' : 'var(--red)' }}>{B.fmt(v)}</div>
                </div>
              ))}
              <div className="indicator-card" style={{ padding: 12, background: 'rgba(34,211,238,0.08)' }}>
                <div className="kpi-label" style={{ fontSize: 10 }}>Total</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 18, color: 'var(--cyan)' }}>{B.fmt(last.total)}</div>
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <div className="kpi-label" style={{ marginBottom: 6 }}>Projeção mensal (saldo + a receber − a pagar)</div>
              <TrendChart values={series} labels={labels} color="var(--cyan)" height={isMobile ? 160 : 200} showPoints={true} showLabels={!isMobile} gradientId="ts-proj" />
              <div style={{ display: 'flex', gap: 24, marginTop: 8, fontSize: 11, color: 'var(--mute)' }}>
                <span>Mínima projetada: <b style={{ color: minProj >= 0 ? 'var(--green)' : 'var(--red)' }}>{B.fmt(minProj)}</b></span>
                <span>Máxima projetada: <b style={{ color: 'var(--green)' }}>{B.fmt(maxProj)}</b></span>
                <span>Final do ano: <b style={{ color: series[series.length-1] >= 0 ? 'var(--green)' : 'var(--red)' }}>{B.fmt(series[series.length-1])}</b></span>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="row" style={{ gridTemplateColumns: "minmax(0, 7fr) minmax(0, 5fr)" }}>
        <div className="card">
          <h2 className="card-title">Saldo acumulado por mês</h2>
          <div style={{ display: "flex", gap: 24, marginBottom: 14, flexWrap: "wrap" }}>
            <div><div className="kpi-label">Saldo Máximo</div><div style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--green)" }}>{B.fmt(sMax)}</div></div>
            <div><div className="kpi-label">Saldo Mínimo</div><div style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--red)" }}>{B.fmt(sMin)}</div></div>
            <div><div className="kpi-label">Saldo Médio</div><div style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--cyan)" }}>{B.fmt(sMed)}</div></div>
            {SALDOS_REAIS && SALDOS_REAIS.last && (
              <div><div className="kpi-label">Saldo atual (planilha)</div><div style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--cyan)" }}>{B.fmt(SALDOS_REAIS.last.total)}</div></div>
            )}
          </div>
          <TrendChart values={saldosCum} labels={B.MONTHS} color="var(--cyan)" height={isMobile ? 160 : 200} showPoints={true} showLabels={!isMobile} gradientId="ts-saldo" />
          <div className="status-line" style={{ marginTop: 6 }}>
            Saldo cumulativo: parte de R$ {(B.fmt(saldoInicial) || "0").replace("R$ ", "")} no início do ano e acumula receitas − despesas mês a mês.
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Fluxo a vencer (saldo projetado dia a dia)</h2>
          <div className="status-line" style={{ marginBottom: 8 }}>
            {fluxoFuturoFull.length} lançamentos a partir de hoje
            {SALDOS_REAIS && SALDOS_REAIS.last && (
              <> · saldo inicial <b style={{ color: "var(--cyan)" }}>{B.fmt(SALDOS_REAIS.last.total)}</b></>
            )}
          </div>
          {/* Banner de risco de caixa */}
          {riscoAnalise && (
            <div className={`tesouraria-risco ${riscoAnalise.primeiroNegativo ? "risco-critico" : riscoAnalise.minSaldo < saldoBaseInicial * 0.3 ? "risco-atencao" : "risco-ok"}`}>
              {riscoAnalise.primeiroNegativo ? (
                <>
                  <div className="risco-icon">⚠</div>
                  <div className="risco-body">
                    <div className="risco-titulo">SALDO ENTRA EM VERMELHO EM <b>{riscoAnalise.primeiroNegativo.data}</b> {riscoAnalise.diasAteCrise != null && <span className="risco-dias">(em {riscoAnalise.diasAteCrise} {riscoAnalise.diasAteCrise === 1 ? "dia" : "dias"})</span>}</div>
                    <div className="risco-detalhe">
                      Lançamento crítico: <b>{(riscoAnalise.primeiroNegativo.movimento || "").slice(0, 40)}</b> · {B.fmt(riscoAnalise.primeiroNegativo.valor)} · saldo cai pra <b style={{ color: "var(--red)" }}>{B.fmt(riscoAnalise.primeiroNegativo.saldo)}</b>
                    </div>
                    <div className="risco-min">
                      Mínimo projetado: <b style={{ color: "var(--red)" }}>{B.fmt(riscoAnalise.minSaldo)}</b> em {riscoAnalise.minSaldoData} · Saldo final no horizonte: <b style={{ color: riscoAnalise.saldoFinal >= 0 ? "var(--green)" : "var(--red)" }}>{B.fmt(riscoAnalise.saldoFinal)}</b>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="risco-icon">{riscoAnalise.minSaldo < saldoBaseInicial * 0.3 ? "⚠" : "✓"}</div>
                  <div className="risco-body">
                    <div className="risco-titulo">
                      {riscoAnalise.minSaldo < saldoBaseInicial * 0.3
                        ? "SALDO MÍNIMO PROJETADO ABAIXO DE 30% DO ATUAL"
                        : "CAIXA SAUDÁVEL NO HORIZONTE"}
                    </div>
                    <div className="risco-detalhe">
                      Mínimo: <b style={{ color: riscoAnalise.minSaldo < saldoBaseInicial * 0.3 ? "var(--amber)" : "var(--green)" }}>{B.fmt(riscoAnalise.minSaldo)}</b> em {riscoAnalise.minSaldoData} · Final: <b style={{ color: "var(--green)" }}>{B.fmt(riscoAnalise.saldoFinal)}</b>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          {/* Mini chart de saldo dia-a-dia projetado */}
          {saldoDiario.length > 1 && (
            <div className="tesouraria-mini-chart">
              <SaldoProjetadoChart pontos={saldoDiario} saldoInicial={saldoBaseInicial} />
            </div>
          )}
          <div className="t-scroll" style={{ maxHeight: 380 }}>
            <table className="t">
              <thead>
                <tr><th>Vence</th><th>Cliente / Fornecedor</th><th className="num">Movimento</th><th className="num">Saldo</th></tr>
              </thead>
              <tbody>
                {fluxoFuturo.length === 0 && (
                  <tr><td colSpan="4" style={{ textAlign: "center", color: "var(--fg-3)", padding: 20 }}>Sem lançamentos a vencer</td></tr>
                )}
                {fluxoFuturo.map((e, i) => {
                  const saldoCol = e[6];
                  const dataAtual = e[0];
                  const dataAnterior = i > 0 ? fluxoFuturo[i - 1][0] : null;
                  const novoBloco = dataAnterior !== dataAtual; // primeira linha de cada dia
                  // Linha "crítica" se este é o primeiro lançamento que torna o saldo negativo
                  const saldoAnterior = i > 0 ? fluxoFuturo[i - 1][6] : saldoBaseInicial;
                  const cruzouZero = saldoAnterior >= 0 && saldoCol < 0;
                  return (
                    <tr key={i} className={cruzouZero ? "tesouraria-row-critica" : ""} style={novoBloco && i > 0 ? { borderTop: "1px solid var(--border-2)" } : {}}>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: novoBloco ? 700 : 400, color: novoBloco ? "var(--text)" : "var(--fg-3)" }}>{novoBloco ? dataAtual : ""}</td>
                      <td style={{ fontSize: 11 }}>{(e[3] || e[2] || "").slice(0, 32)}</td>
                      <td className={`num ${e[4] < 0 ? "red" : "green"}`} style={{ fontSize: 11 }}>{B.fmt(e[4])}</td>
                      <td className="num" style={{ fontSize: 11, fontWeight: 600, color: saldoCol < 0 ? "var(--red)" : saldoCol < saldoBaseInicial * 0.3 ? "var(--amber)" : "var(--cyan)" }}>{B.fmt(saldoCol)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {fluxoFuturoFull.length > 60 && (
            <div className="status-line" style={{ marginTop: 8, fontSize: 11, textAlign: "center" }}>
              Mostrando primeiros 60 de {fluxoFuturoFull.length} lançamentos · análise de risco usa todos
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Mini chart SVG do saldo projetado dia-a-dia, com marcador da data crítica
const SaldoProjetadoChart = ({ pontos, saldoInicial }) => {
  const W = 800, H = 160, padX = 40, padTop = 16, padBottom = 32;
  if (pontos.length < 2) return null;
  const valores = [saldoInicial, ...pontos.map(p => p.saldo)];
  const min = Math.min(0, ...valores);
  const max = Math.max(...valores);
  const range = (max - min) || 1;
  const stepX = (W - padX * 2) / (pontos.length - 0);
  const xOf = (i) => padX + i * stepX;
  const yOf = (v) => padTop + (1 - (v - min) / range) * (H - padTop - padBottom);
  const zeroY = yOf(0);
  // Path da linha
  const points = pontos.map((p, i) => `${xOf(i + 1)},${yOf(p.saldo)}`).join(" ");
  const startPoint = `${xOf(0)},${yOf(saldoInicial)}`;
  // Área pra preenchimento
  const areaPath = `M ${startPoint} L ${points.replace(/ /g, " L ")} L ${xOf(pontos.length)},${yOf(min)} L ${xOf(0)},${yOf(min)} Z`;
  // Detecta primeira data com saldo negativo
  let critIdx = -1;
  for (let i = 0; i < pontos.length; i++) {
    if (pontos[i].saldo < 0) { critIdx = i; break; }
  }
  // Labels de data: a cada N pontos pra não amassar
  const labelStep = Math.max(1, Math.ceil(pontos.length / 8));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: H, marginBottom: 12 }}>
      <defs>
        <linearGradient id="ts-proj-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--cyan)" stopOpacity="0.32" />
          <stop offset="100%" stopColor="var(--cyan)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* zero line */}
      {zeroY > padTop && zeroY < H - padBottom && (
        <line x1={padX} y1={zeroY} x2={W - 10} y2={zeroY} stroke="rgba(239, 68, 68, 0.4)" strokeDasharray="4 4" strokeWidth="1" />
      )}
      {zeroY > padTop && zeroY < H - padBottom && (
        <text x={W - 10} y={zeroY - 4} textAnchor="end" fontSize="10" fill="var(--red)" fontFamily="var(--font-mono)">R$ 0</text>
      )}
      {/* área */}
      <path d={areaPath} fill="url(#ts-proj-grad)" />
      {/* linha */}
      <polyline points={`${startPoint} ${points}`} fill="none" stroke="var(--cyan)" strokeWidth="2" />
      {/* marcador inicial */}
      <circle cx={xOf(0)} cy={yOf(saldoInicial)} r="4" fill="var(--cyan)" stroke="#0a141a" strokeWidth="2" />
      <text x={xOf(0)} y={yOf(saldoInicial) - 8} textAnchor="middle" fontSize="10" fill="var(--cyan)" fontFamily="var(--font-mono)">Hoje</text>
      {/* marcador crítico */}
      {critIdx >= 0 && (
        <g>
          <line x1={xOf(critIdx + 1)} y1={padTop} x2={xOf(critIdx + 1)} y2={H - padBottom} stroke="var(--red)" strokeDasharray="3 3" strokeWidth="1.2" />
          <circle cx={xOf(critIdx + 1)} cy={yOf(pontos[critIdx].saldo)} r="5" fill="var(--red)" stroke="#0a141a" strokeWidth="2" />
          <text x={xOf(critIdx + 1)} y={padTop - 2} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--red)">{pontos[critIdx].data}</text>
        </g>
      )}
      {/* labels de data no eixo x */}
      {pontos.map((p, i) => {
        if (i % labelStep !== 0 && i !== pontos.length - 1) return null;
        return (
          <text key={i} x={xOf(i + 1)} y={H - 12} textAnchor="middle" fontSize="9" fill="var(--mute)">{p.data.slice(0, 5)}</text>
        );
      })}
    </svg>
  );
};

const PageComparativo = ({ filters, setFilters, statusFilter, drilldown, setDrilldown, year, month }) => {
  const B = useMemo(() => window.getBit(statusFilter, drilldown, year, month, filters && filters.regime, filters), [statusFilter, drilldown, year, month, filters]);
  const refYear = window.REF_YEAR || new Date().getFullYear();
  const fmt = (B && B.fmt) || (n => `R$ ${n.toFixed(2)}`);
  const fmtPct = (B && B.fmtPct) || (n => `${n.toFixed(1)}%`);

  // Estado dos 2 periodos comparados — cada um eh { y, kind: 'mes'|'trim'|'ano', val }
  const [p1, setP1] = useState({ y: refYear, kind: "trim", val: 1 });
  const [p2, setP2] = useState({ y: refYear, kind: "trim", val: 2 });
  const [expanded, setExpanded] = useState({ Receita: true, Despesa: true });

  // Calcula bounds de mes do periodo
  const periodBounds = (p) => {
    if (p.kind === "ano") return { y: p.y, mIni: 1, mFim: 12 };
    if (p.kind === "trim") {
      const tStart = (p.val - 1) * 3 + 1;
      return { y: p.y, mIni: tStart, mFim: tStart + 2 };
    }
    return { y: p.y, mIni: p.val, mFim: p.val }; // mes
  };
  const periodLabel = (p) => {
    if (p.kind === "ano") return `${p.y} · Ano completo`;
    if (p.kind === "trim") {
      const lbl = ["jan-mar", "abr-jun", "jul-set", "out-dez"][p.val - 1];
      return `${p.y} · Trim ${p.val} (${lbl})`;
    }
    const mn = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][p.val - 1];
    return `${mn}/${p.y}`;
  };

  // Filtra ALL_TX por periodo + statusFilter; agrega receitas/despesas por categoria + sub-items
  const aggregate = (p) => {
    const allTx = window.ALL_TX || [];
    const filterTx = window.filterTx;
    const sf = statusFilter || window.BIT_FILTER || "realizado";
    const rg = (filters && filters.regime) || "caixa";
    const txFiltered = filterTx ? filterTx(allTx, sf, null, rg, filters) : allTx;
    const { y, mIni, mFim } = periodBounds(p);
    const mIniStr = `${y}-${String(mIni).padStart(2, "0")}`;
    const mFimStr = `${y}-${String(mFim).padStart(2, "0")}`;
    let totalRec = 0, totalDesp = 0;
    const recCat = new Map(), despCat = new Map();
    const recSubs = new Map(), despSubs = new Map(); // cat -> Map(subName -> valor)
    for (const row of txFiltered) {
      const [kind, mes, , categoria, cliente, valor, , fornecedor] = row;
      if (!mes || mes < mIniStr || mes > mFimStr) continue;
      if (kind === "r") {
        totalRec += valor;
        recCat.set(categoria, (recCat.get(categoria) || 0) + valor);
        if (!recSubs.has(categoria)) recSubs.set(categoria, new Map());
        const sub = cliente || "Sem cliente";
        recSubs.get(categoria).set(sub, (recSubs.get(categoria).get(sub) || 0) + valor);
      } else {
        totalDesp += valor;
        despCat.set(categoria, (despCat.get(categoria) || 0) + valor);
        if (!despSubs.has(categoria)) despSubs.set(categoria, new Map());
        const sub = fornecedor || "Sem fornecedor";
        despSubs.get(categoria).set(sub, (despSubs.get(categoria).get(sub) || 0) + valor);
      }
    }
    return { totalRec, totalDesp, liq: totalRec - totalDesp, recCat, despCat, recSubs, despSubs };
  };

  const a1 = useMemo(() => aggregate(p1), [p1, statusFilter, filters]);
  const a2 = useMemo(() => aggregate(p2), [p2, statusFilter, filters]);

  const safePct = (a, b) => b !== 0 ? (a / b) * 100 : (a !== 0 ? 100 : 0);
  const diffReceita = a2.totalRec - a1.totalRec;
  const diffReceitaPct = safePct(diffReceita, a1.totalRec);
  const diffDespesa = a2.totalDesp - a1.totalDesp;
  const diffDespesaPct = safePct(diffDespesa, a1.totalDesp);
  const diffLiq = a2.liq - a1.liq;
  const diffLiqPct = safePct(diffLiq, Math.abs(a1.liq) || 1);

  // Top categorias unidas (union de p1 + p2)
  const allRecCats = new Set([...a1.recCat.keys(), ...a2.recCat.keys()]);
  const allDespCats = new Set([...a1.despCat.keys(), ...a2.despCat.keys()]);

  // Selector compacto: ano + tipo + valor
  const PeriodPicker = ({ value, onChange, label }) => {
    const yearsAvail = window.AVAILABLE_YEARS || [refYear];
    const monthOpts = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return (
      <div style={{ marginBottom: 12 }}>
        <div className="filter-mini-label">{label}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 6 }}>
          <select className="filter-select" value={value.y} onChange={e => onChange({ ...value, y: Number(e.target.value) })}>
            {yearsAvail.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="filter-select" value={value.kind} onChange={e => onChange({ ...value, kind: e.target.value, val: e.target.value === "mes" ? 1 : (e.target.value === "trim" ? 1 : 1) })}>
            <option value="mes">Mês</option>
            <option value="trim">Trimestre</option>
            <option value="ano">Ano completo</option>
          </select>
        </div>
        {value.kind === "mes" && (
          <select className="filter-select" style={{ width: "100%" }} value={value.val} onChange={e => onChange({ ...value, val: Number(e.target.value) })}>
            {monthOpts.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        )}
        {value.kind === "trim" && (
          <select className="filter-select" style={{ width: "100%" }} value={value.val} onChange={e => onChange({ ...value, val: Number(e.target.value) })}>
            <option value={1}>Trim 1 (jan-mar)</option>
            <option value={2}>Trim 2 (abr-jun)</option>
            <option value={3}>Trim 3 (jul-set)</option>
            <option value={4}>Trim 4 (out-dez)</option>
          </select>
        )}
        <div style={{ marginTop: 4, color: "var(--mute)", fontSize: 11, letterSpacing: "0.04em" }}>{periodLabel(value)}</div>
      </div>
    );
  };

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>Comparativo</h1>
          <div className="status-line">{periodLabel(p1)} vs {periodLabel(p2)}</div>
        </div>
        <div className="actions">
          <RegimeToggle filters={filters} setFilters={setFilters} />
        </div>
      </div>

      <DrilldownBadge drilldown={drilldown} onClear={() => setDrilldown && setDrilldown(null)} />

      <div className="row row-3-9">
        <div style={{ display: "grid", gap: 16 }}>
          <div className="card">
            <h2 className="card-title">Filtragem de datas</h2>
            <PeriodPicker value={p1} onChange={setP1} label="Data comparativa 1" />
            <PeriodPicker value={p2} onChange={setP2} label="Data comparativa 2" />
          </div>

          <div className="card">
            <h2 className="card-title">Indicadores principais</h2>
            <div style={{ display: "grid", gap: 12 }}>
              <div className={`indicator-card ${diffReceita >= 0 ? "" : "red"}`}>
                <div className="kpi-label">Diferença na receita</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: diffReceita >= 0 ? "var(--green)" : "var(--red)", letterSpacing: "-0.02em" }}>{fmt(diffReceita)}</div>
                <div className={`kpi-delta ${diffReceita >= 0 ? "up" : "down"}`}>{fmtPct(diffReceitaPct)}</div>
              </div>
              <div className={`indicator-card ${diffDespesa <= 0 ? "" : "red"}`}>
                <div className="kpi-label">Diferença nas despesas</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: diffDespesa <= 0 ? "var(--green)" : "var(--red)", letterSpacing: "-0.02em" }}>{fmt(diffDespesa)}</div>
                <div className={`kpi-delta ${diffDespesa <= 0 ? "up" : "down"}`}>{fmtPct(diffDespesaPct)}</div>
              </div>
              <div className={`indicator-card ${diffLiq >= 0 ? "" : "red"}`}>
                <div className="kpi-label">Diferença do valor líquido</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: diffLiq >= 0 ? "var(--green)" : "var(--red)", letterSpacing: "-0.02em" }}>{fmt(diffLiq)}</div>
                <div className={`kpi-delta ${diffLiq >= 0 ? "up" : "down"}`}>{fmtPct(diffLiqPct)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Análise comparativa entre períodos</h2>
          </div>
          <div className="t-scroll" style={{ maxHeight: 540 }}>
            <table className="t">
              <thead>
                <tr>
                  <th>Receita / Despesa</th>
                  <th className="num">{periodLabel(p1)}</th>
                  <th className="num">{periodLabel(p2)}</th>
                  <th className="num">Δ Comparativo</th>
                  <th className="num">%</th>
                </tr>
              </thead>
              <tbody>
                {/* Header Receita */}
                <tr className="section">
                  <td>
                    <button onClick={() => setExpanded(s => ({ ...s, Receita: !s.Receita }))} style={{ background: "transparent", border: 0, color: "inherit", padding: 0, fontWeight: 700, fontFamily: "inherit", fontSize: "inherit", display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span className="chev">{expanded.Receita ? "−" : "+"}</span>Receita
                    </button>
                  </td>
                  <td className="num bold green">{fmt(a1.totalRec)}</td>
                  <td className="num bold green">{fmt(a2.totalRec)}</td>
                  <td className={`num bold ${diffReceita >= 0 ? "green" : "red"}`}>{fmt(diffReceita)}</td>
                  <td className={`num bold ${diffReceita >= 0 ? "green" : "red"}`}>{fmtPct(diffReceitaPct)}</td>
                </tr>
                {expanded.Receita && [...allRecCats].sort((x, y) => (a2.recCat.get(y) || 0) + (a1.recCat.get(y) || 0) - ((a2.recCat.get(x) || 0) + (a1.recCat.get(x) || 0))).map((cat, i) => {
                  const v1 = a1.recCat.get(cat) || 0;
                  const v2 = a2.recCat.get(cat) || 0;
                  const diff = v2 - v1;
                  const pct = safePct(diff, v1);
                  const catKey = `rc:${cat}`;
                  const catExpanded = expanded[catKey];
                  // Sub-items: clientes desta categoria (union p1+p2)
                  const subs1 = (a1.recSubs && a1.recSubs.get(cat)) || new Map();
                  const subs2 = (a2.recSubs && a2.recSubs.get(cat)) || new Map();
                  const allSubNames = [...new Set([...subs1.keys(), ...subs2.keys()])];
                  const sortedSubs = allSubNames.map(n => ({ n, s: (subs1.get(n) || 0) + (subs2.get(n) || 0) })).filter(s => s.s > 0).sort((a, b) => b.s - a.s);
                  return (
                    <React.Fragment key={`r${i}`}>
                      <tr>
                        <td style={{ paddingLeft: 24 }}>
                          <button onClick={() => setExpanded(s => ({ ...s, [catKey]: !s[catKey] }))} style={{ background: "transparent", border: 0, color: "inherit", padding: 0, fontFamily: "inherit", fontSize: "inherit", display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                            <span className="chev">{catExpanded ? "−" : "+"}</span>{cat}
                          </button>
                        </td>
                        <td className="num green">{v1 !== 0 ? fmt(v1) : "—"}</td>
                        <td className="num green">{v2 !== 0 ? fmt(v2) : "—"}</td>
                        <td className={`num ${diff >= 0 ? "green" : "red"}`}>{fmt(diff)}</td>
                        <td className={`num ${diff >= 0 ? "green" : "red"}`}>{fmtPct(pct)}</td>
                      </tr>
                      {catExpanded && sortedSubs.map((sub, j) => {
                        const sv1 = subs1.get(sub.n) || 0;
                        const sv2 = subs2.get(sub.n) || 0;
                        const sd = sv2 - sv1;
                        const sp = safePct(sd, sv1);
                        return (
                          <tr key={`r${i}s${j}`} style={{ opacity: 0.8 }}>
                            <td style={{ paddingLeft: 48, fontSize: 11 }}>{sub.n}</td>
                            <td className="num green" style={{ fontSize: 11 }}>{sv1 !== 0 ? fmt(sv1) : "—"}</td>
                            <td className="num green" style={{ fontSize: 11 }}>{sv2 !== 0 ? fmt(sv2) : "—"}</td>
                            <td className={`num ${sd >= 0 ? "green" : "red"}`} style={{ fontSize: 11 }}>{fmt(sd)}</td>
                            <td className={`num ${sd >= 0 ? "green" : "red"}`} style={{ fontSize: 11 }}>{fmtPct(sp)}</td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
                {/* Header Despesa */}
                <tr className="section">
                  <td>
                    <button onClick={() => setExpanded(s => ({ ...s, Despesa: !s.Despesa }))} style={{ background: "transparent", border: 0, color: "inherit", padding: 0, fontWeight: 700, fontFamily: "inherit", fontSize: "inherit", display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span className="chev">{expanded.Despesa ? "−" : "+"}</span>Despesa
                    </button>
                  </td>
                  <td className="num bold red">{fmt(a1.totalDesp)}</td>
                  <td className="num bold red">{fmt(a2.totalDesp)}</td>
                  <td className={`num bold ${diffDespesa <= 0 ? "green" : "red"}`}>{fmt(diffDespesa)}</td>
                  <td className={`num bold ${diffDespesa <= 0 ? "green" : "red"}`}>{fmtPct(diffDespesaPct)}</td>
                </tr>
                {expanded.Despesa && [...allDespCats].sort((x, y) => (a2.despCat.get(y) || 0) + (a1.despCat.get(y) || 0) - ((a2.despCat.get(x) || 0) + (a1.despCat.get(x) || 0))).map((cat, i) => {
                  const v1 = a1.despCat.get(cat) || 0;
                  const v2 = a2.despCat.get(cat) || 0;
                  const diff = v2 - v1;
                  const pct = safePct(diff, v1);
                  const catKey = `dc:${cat}`;
                  const catExpanded = expanded[catKey];
                  const subs1 = (a1.despSubs && a1.despSubs.get(cat)) || new Map();
                  const subs2 = (a2.despSubs && a2.despSubs.get(cat)) || new Map();
                  const allSubNames = [...new Set([...subs1.keys(), ...subs2.keys()])];
                  const sortedSubs = allSubNames.map(n => ({ n, s: (subs1.get(n) || 0) + (subs2.get(n) || 0) })).filter(s => s.s > 0).sort((a, b) => b.s - a.s);
                  return (
                    <React.Fragment key={`d${i}`}>
                      <tr>
                        <td style={{ paddingLeft: 24 }}>
                          <button onClick={() => setExpanded(s => ({ ...s, [catKey]: !s[catKey] }))} style={{ background: "transparent", border: 0, color: "inherit", padding: 0, fontFamily: "inherit", fontSize: "inherit", display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                            <span className="chev">{catExpanded ? "−" : "+"}</span>{cat}
                          </button>
                        </td>
                        <td className="num red">{v1 !== 0 ? fmt(v1) : "—"}</td>
                        <td className="num red">{v2 !== 0 ? fmt(v2) : "—"}</td>
                        <td className={`num ${diff <= 0 ? "green" : "red"}`}>{fmt(diff)}</td>
                        <td className={`num ${diff <= 0 ? "green" : "red"}`}>{fmtPct(pct)}</td>
                      </tr>
                      {catExpanded && sortedSubs.map((sub, j) => {
                        const sv1 = subs1.get(sub.n) || 0;
                        const sv2 = subs2.get(sub.n) || 0;
                        const sd = sv2 - sv1;
                        const sp = safePct(sd, sv1);
                        return (
                          <tr key={`d${i}s${j}`} style={{ opacity: 0.8 }}>
                            <td style={{ paddingLeft: 48, fontSize: 11 }}>{sub.n}</td>
                            <td className="num red" style={{ fontSize: 11 }}>{sv1 !== 0 ? fmt(sv1) : "—"}</td>
                            <td className="num red" style={{ fontSize: 11 }}>{sv2 !== 0 ? fmt(sv2) : "—"}</td>
                            <td className={`num ${sd <= 0 ? "green" : "red"}`} style={{ fontSize: 11 }}>{fmt(sd)}</td>
                            <td className={`num ${sd <= 0 ? "green" : "red"}`} style={{ fontSize: 11 }}>{fmtPct(sp)}</td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
                <tr className="total">
                  <td>Total líquido</td>
                  <td className="num">{fmt(a1.liq)}</td>
                  <td className="num">{fmt(a2.liq)}</td>
                  <td className={`num ${diffLiq >= 0 ? "green" : "red"}`}>{fmt(diffLiq)}</td>
                  <td className={`num ${diffLiq >= 0 ? "green" : "red"}`}>{fmtPct(diffLiqPct)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

// ===== PageRelatorio =====
// Carrega report.json (gerado offline por generate-report.cjs) e renderiza
// um relatorio executivo imprimivel (Ctrl+P -> Save as PDF).
const PageRelatorio = ({ year, statusFilter }) => {
  const refYear = window.REF_YEAR || new Date().getFullYear();
  // Hooks de dados — DEVEM ficar antes de qualquer early return pra não violar
  // a ordem dos hooks. Os useMemo dependem de periodYear/periodMonth declarados abaixo
  // mas useMemo aceita refs do escopo via closure.
  // Estado do periodo a renderizar (defaults: ano corrente YTD)
  const [periodYear, setPeriodYear] = useState(() => {
    try { var p = JSON.parse(localStorage.getItem('bi.report.period') || 'null'); return (p && p.year) || (year || refYear); } catch (e) { return year || refYear; }
  });
  const [periodMonth, setPeriodMonth] = useState(() => {
    try { var p = JSON.parse(localStorage.getItem('bi.report.period') || 'null'); return (p && p.month) || 0; } catch (e) { return 0; } // 0 = ano completo
  });
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Cards reativos ao período (year + month) — antes usavam window.BIT global YTD
  // Mantidos no topo (regra dos hooks) — não chamar dentro de early returns
  const B = useMemo(
    () => window.getBit('realizado', null, periodYear, periodMonth),
    [periodYear, periodMonth]
  );
  const Bprev = useMemo(
    () => window.getBit('a_pagar_receber', null, periodYear, periodMonth),
    [periodYear, periodMonth]
  );

  // resolve o nome do arquivo conforme periodo
  const reportFileName = (y, m) => {
    if (m && m > 0) return `report-${y}-${String(m).padStart(2,'0')}.json`;
    if (y === refYear) return 'report.json'; // default mantem nome principal
    return `report-${y}.json`;
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setGenerating(false);
    setError(null);
    setReport(null);
    try { localStorage.setItem('bi.report.period', JSON.stringify({ year: periodYear, month: periodMonth })); } catch (e) {}
    const file = reportFileName(periodYear, periodMonth);

    // 1) tenta o JSON pre-gerado (estatico). Se 404, cai no fallback de geracao on-demand.
    fetch(file, { cache: 'no-store' })
      .then(r => {
        if (r.ok) return r.json();
        if (r.status === 404) return null; // sinaliza fallback
        throw new Error(`HTTP ${r.status} (arquivo ${file})`);
      })
      .then(data => {
        if (cancelled) return;
        if (data) {
          // tinha relatorio pre-gerado
          setReport(data);
          setLoading(false);
          return null;
        }
        // 2) Fallback: chama a API publica de geracao on-demand
        const apiUrl = window.BI_REPORT_API;
        if (!apiUrl) {
          throw new Error('API de geracao nao configurada');
        }
        setLoading(false);
        setGenerating(true);
        return fetch(`${apiUrl}/generate-report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            year: periodYear,
            month: periodMonth > 0 ? periodMonth : null,
          }),
        }).then(async (resp) => {
          if (cancelled) return;
          if (resp.status === 429) {
            const retry = resp.headers.get('Retry-After') || '3600';
            throw new Error(`Limite de geracao atingido. Tente novamente em ~${Math.ceil(Number(retry) / 60)} minutos.`);
          }
          if (!resp.ok) {
            const t = await resp.text().catch(() => '');
            throw new Error(`Falha ao gerar (HTTP ${resp.status}). Verifique conexao com Anthropic. ${t.slice(0,200)}`);
          }
          const generated = await resp.json();
          if (cancelled) return;
          setReport(generated);
          setGenerating(false);
        });
      })
      .catch(e => {
        if (cancelled) return;
        setError(e.message);
        setLoading(false);
        setGenerating(false);
      });
    return () => { cancelled = true; };
  }, [periodYear, periodMonth]);

  const MONTH_OPTIONS = [
    { v: 0, label: "Ano completo" },
    { v: 1, label: "Janeiro" }, { v: 2, label: "Fevereiro" }, { v: 3, label: "Março" },
    { v: 4, label: "Abril" }, { v: 5, label: "Maio" }, { v: 6, label: "Junho" },
    { v: 7, label: "Julho" }, { v: 8, label: "Agosto" }, { v: 9, label: "Setembro" },
    { v: 10, label: "Outubro" }, { v: 11, label: "Novembro" }, { v: 12, label: "Dezembro" },
  ];
  const availableYears = [2026];

  const PeriodToolbar = (
    <div className="report-period-toolbar" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Período:</span>
      <select className="header-year" value={periodYear} onChange={e => setPeriodYear(Number(e.target.value))}>
        {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
      <select className="header-year" value={periodMonth} onChange={e => setPeriodMonth(Number(e.target.value))}>
        {MONTH_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>
    </div>
  );

  if (loading) {
    return (
      <div className="page">
        <div className="page-title">
          <div><h1>Relatório IA</h1><div className="status-line">Carregando…</div></div>
          <div className="actions">{PeriodToolbar}</div>
        </div>
      </div>
    );
  }

  if (generating) {
    return (
      <div className="page">
        <div className="page-title">
          <div>
            <h1>Relatório IA</h1>
            <div className="status-line">Gerando relatório com IA…</div>
          </div>
          <div className="actions">{PeriodToolbar}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚙️</div>
          <h2 className="card-title" style={{ textAlign: 'center' }}>Gerando análise…</h2>
          <p style={{ color: 'var(--fg-2)', lineHeight: 1.6, marginTop: 12 }}>
            Estamos disparando 7 chamadas à IA da Anthropic em paralelo para construir o relatório executivo deste período.
          </p>
          <p style={{ color: 'var(--fg-3)', fontSize: 13, marginTop: 8 }}>
            Geralmente leva ~30 segundos. Não feche esta página.
          </p>
          <div style={{ marginTop: 24, display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--cyan)', animation: 'pulse 1.4s ease-in-out infinite' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--cyan)', animation: 'pulse 1.4s ease-in-out 0.2s infinite' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--cyan)', animation: 'pulse 1.4s ease-in-out 0.4s infinite' }} />
          </div>
        </div>
      </div>
    );
  }

  if (error || !report) {
    const monthLabel = periodMonth > 0 ? MONTH_OPTIONS[periodMonth].label + ' de ' : '';
    const cmd = periodMonth > 0
      ? `node generate-report.cjs --force --year=${periodYear} --month=${periodMonth}`
      : (periodYear === refYear ? `node generate-report.cjs --force` : `node generate-report.cjs --force --year=${periodYear}`);
    return (
      <div className="page">
        <div className="page-title">
          <div>
            <h1>Relatório IA</h1>
            <div className="status-line">Relatório de {monthLabel}{periodYear} ainda não foi gerado</div>
          </div>
          <div className="actions">{PeriodToolbar}</div>
        </div>
        <div className="card">
          <h2 className="card-title">Gerar agora</h2>
          <p style={{ color: "var(--fg-2)", lineHeight: 1.6, marginTop: 12 }}>
            Abra o terminal na pasta <code style={{ background: "var(--surface-2)", padding: "2px 6px", borderRadius: 4 }}>{"<cliente>"}-bi-web</code> e rode:
          </p>
          <pre style={{ background: "var(--surface-2)", padding: 12, borderRadius: 8, marginTop: 12, fontSize: 13, color: "var(--cyan)" }}>
            {cmd}
          </pre>
          <p style={{ color: "var(--fg-3)", fontSize: 12, marginTop: 12 }}>
            ~30s + 1 chamada Anthropic. Depois de pronto, recarregue esta página (mantém o período selecionado).
          </p>
          {error && <p style={{ color: "var(--red)", fontSize: 12, marginTop: 8 }}>Detalhe: {error}</p>}
        </div>
      </div>
    );
  }

  const fmtDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const k = B.KPIS || B;
  const recebido = k.TOTAL_RECEITA || 0;
  const pago = k.TOTAL_DESPESA || 0;
  const liquido = k.VALOR_LIQUIDO != null ? k.VALOR_LIQUIDO : (recebido - pago);
  const margem = k.MARGEM_LIQUIDA != null ? k.MARGEM_LIQUIDA : (recebido > 0 ? (liquido / recebido) * 100 : 0);
  const aReceber = (Bprev.KPIS && Bprev.KPIS.TOTAL_RECEITA) || 0;
  const aPagar = (Bprev.KPIS && Bprev.KPIS.TOTAL_DESPESA) || 0;

  const sec = (id) => (report.secoes && report.secoes[id]) || { title: id, analysis: '' };

  const renderAnalysis = (text) => {
    if (!text) return <p className="report-analysis muted">(análise indisponível — verifique se a chamada à API foi bem-sucedida)</p>;
    return text.split(/\n\s*\n/).map((p, i) => (
      <p key={i} className="report-analysis">{p.trim()}</p>
    ));
  };

  return (
    <div className="page">
      {/* Toolbar — escondida no print */}
      <div className="report-toolbar no-print">
        <div>
          <h1 style={{ margin: 0 }}>Relatório IA</h1>
          <div className="status-line">Gerado em {fmtDate(report.generated_at)} · {report.periodo}</div>
        </div>
        <div className="actions" style={{ gap: 12, alignItems: 'center' }}>
          {PeriodToolbar}
          <button className="btn-primary" onClick={() => window.print()}>
            <Icon name="download" /> Exportar PDF
          </button>
        </div>
      </div>

      {/* Modal de ajuda */}
      {showHelp && (
        <div className="drawer-overlay no-print" onClick={() => setShowHelp(false)}>
          <div className="card" style={{ maxWidth: 520, margin: "auto", padding: 24 }} onClick={e => e.stopPropagation()}>
            <h2 className="card-title">Como regenerar o relatório</h2>
            <p style={{ color: "var(--fg-2)", lineHeight: 1.6, marginTop: 8 }}>
              O relatório é gerado offline por um script Node que chama a API da Anthropic.
              Não pode ser disparado pelo browser (a chave da API ficaria exposta).
            </p>
            <p style={{ color: "var(--fg-2)", lineHeight: 1.6, marginTop: 12 }}>No terminal, dentro da pasta do projeto:</p>
            <pre style={{ background: "var(--surface-2)", padding: 12, borderRadius: 8, marginTop: 8, fontSize: 13, color: "var(--cyan)" }}>
node generate-report.cjs --force
            </pre>
            <p style={{ color: "var(--fg-3)", fontSize: 12, marginTop: 12 }}>
              Depois recarregue esta página. Sem <code>--force</code>, o script pula se o relatório foi gerado há menos de 1h.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn-primary" onClick={() => setShowHelp(false)}>Entendi</button>
            </div>
          </div>
        </div>
      )}

      {/* Relatorio imprimivel */}
      <article className="report">
        <header className="report-cover">
          <img src="assets/bgp-logo-white.png" alt="BGP" className="report-logo" />
          <h1 className="report-title">BGP GO BI — Relatório Executivo</h1>
          <p className="report-subtitle">{report.empresa}</p>
          <p className="report-meta">Período: {report.periodo} — Realizado</p>
          <p className="report-meta">Gerado em {fmtDate(report.generated_at)}</p>
        </header>

        <section className="report-section">
          <h2>1. Visão Geral</h2>
          <div className="report-kpis">
            <div className="report-kpi"><span className="lbl">Receita realizada</span><span className="val green">{B.fmt(recebido)}</span></div>
            <div className="report-kpi"><span className="lbl">Despesa realizada</span><span className="val red">{B.fmt(pago)}</span></div>
            <div className="report-kpi"><span className="lbl">Resultado líquido</span><span className="val" style={{ color: liquido >= 0 ? "var(--green)" : "var(--red)" }}>{B.fmt(liquido)}</span></div>
            <div className="report-kpi"><span className="lbl">Margem líquida</span><span className="val">{B.fmtPct ? B.fmtPct(margem) : margem.toFixed(2) + "%"}</span></div>
          </div>
          {renderAnalysis(sec('visao_geral').analysis)}
        </section>

        <section className="report-section">
          <h2>2. Receita</h2>
          <div className="report-kpis">
            <div className="report-kpi"><span className="lbl">Receita recebida</span><span className="val green">{B.fmt(recebido)}</span></div>
            <div className="report-kpi"><span className="lbl">Receita a receber</span><span className="val">{B.fmt(aReceber)}</span></div>
          </div>
          <h3 className="report-sub">Top 5 categorias</h3>
          <ul className="report-list">
            {(B.RECEITA_CATEGORIAS || []).slice(0, 5).map((c, i) => (
              <li key={i}><span>{c.name}</span><b>{B.fmt(c.value)}</b></li>
            ))}
          </ul>
          {renderAnalysis(sec('receita').analysis)}
        </section>

        <section className="report-section">
          <h2>3. Despesa</h2>
          <div className="report-kpis">
            <div className="report-kpi"><span className="lbl">Despesa paga</span><span className="val red">{B.fmt(pago)}</span></div>
            <div className="report-kpi"><span className="lbl">Despesa a pagar</span><span className="val">{B.fmt(aPagar)}</span></div>
          </div>
          <h3 className="report-sub">Top 5 categorias</h3>
          <ul className="report-list">
            {(B.DESPESA_CATEGORIAS || []).slice(0, 5).map((c, i) => (
              <li key={i}><span>{c.name}</span><b>{B.fmt(c.value)}</b></li>
            ))}
          </ul>
          {renderAnalysis(sec('despesa').analysis)}
        </section>

        <section className="report-section">
          <h2>4. Fluxo de Caixa</h2>
          <div className="report-kpis">
            <div className="report-kpi"><span className="lbl">Receita total</span><span className="val green">{B.fmt(recebido)}</span></div>
            <div className="report-kpi"><span className="lbl">Despesa total</span><span className="val red">{B.fmt(pago)}</span></div>
            <div className="report-kpi"><span className="lbl">Líquido</span><span className="val" style={{ color: liquido >= 0 ? "var(--green)" : "var(--red)" }}>{B.fmt(liquido)}</span></div>
          </div>
          <h3 className="report-sub">Líquido mês a mês</h3>
          <ul className="report-list">
            {(B.MONTH_DATA || []).map((m, i) => {
              const v = m.receita - m.despesa;
              return <li key={i}><span style={{ textTransform: "capitalize" }}>{m.m}</span><b style={{ color: v >= 0 ? "var(--green)" : "var(--red)" }}>{B.fmt(v)}</b></li>;
            })}
          </ul>
          {renderAnalysis(sec('fluxo_caixa').analysis)}
        </section>

        <section className="report-section">
          <h2>5. Tesouraria</h2>
          <div className="report-kpis">
            <div className="report-kpi"><span className="lbl">Recebido</span><span className="val green">{B.fmt(recebido)}</span></div>
            <div className="report-kpi"><span className="lbl">A receber</span><span className="val">{B.fmt(aReceber)}</span></div>
            <div className="report-kpi"><span className="lbl">Pago</span><span className="val red">{B.fmt(pago)}</span></div>
            <div className="report-kpi"><span className="lbl">A pagar</span><span className="val">{B.fmt(aPagar)}</span></div>
          </div>
          {renderAnalysis(sec('tesouraria').analysis)}
        </section>

        <section className="report-section">
          <h2>6. Comparativo</h2>
          {renderAnalysis(sec('comparativo').analysis)}
        </section>

        <section className="report-section report-conclusion">
          <h2>Conclusão e Recomendações</h2>
          {renderAnalysis(report.conclusao || sec('conclusao').analysis)}
        </section>

        <footer className="report-footer">
          BGP GO BI · {report.empresa} · {report.periodo} · Gerado em {fmtDate(report.generated_at)}
        </footer>
      </article>
    </div>
  );
};

Object.assign(window, { PageFluxo, PageTesouraria, PageComparativo, PageRelatorio });
