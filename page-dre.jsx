const { useState, useMemo } = React;

// Hierarquia DRE — estrutura idêntica ao PBI
const DRE_HIERARCHY = [
  { nivel1: "Receita Bruta de Vendas", ordem: 1, nivel2: "Receitas Operacionais", nivel3: "Receita de Vendas de Produtos e Serviços", cat: "01.01.01 RECEITA DE VENDAS" },
  { nivel1: "Receita Bruta de Vendas", ordem: 1, nivel2: "Receitas Operacionais", nivel3: "Receita de Vendas de Produtos e Serviços", cat: "01.01.02 RECEITA LOJA FISICA" },
  { nivel1: "Receita Bruta de Vendas", ordem: 1, nivel2: "Receitas Operacionais", nivel3: "Receita de Vendas de Produtos e Serviços", cat: "01.01.03 RECEITA FEIRAS E EVENTOS" },
  { nivel1: "Receita Bruta de Vendas", ordem: 1, nivel2: "Receitas Operacionais", nivel3: "Receita de Vendas de Produtos e Serviços", cat: "01.01.05 RECEITA MARKETPLACE" },
  { nivel1: "Receita Bruta de Vendas", ordem: 1, nivel2: "Receitas Operacionais", nivel3: "Receita de Vendas de Produtos e Serviços", cat: "01.01.06 RECEITA REVENDEDORES" },
  { nivel1: "Receita Bruta de Vendas", ordem: 1, nivel2: "Receitas Operacionais", nivel3: "Receita de Vendas de Produtos e Serviços", cat: "01.01.07 RECEITA WATSAPP" },
  { nivel1: "Receita Bruta de Vendas", ordem: 1, nivel2: "Receitas Operacionais", nivel3: "Receita de Vendas de Produtos e Serviços", cat: "01.01.08 RECEITA SITE" },
  { nivel1: "Receita Bruta de Vendas", ordem: 1, nivel2: "Receitas Operacionais", nivel3: "Receita de Vendas de Produtos e Serviços", cat: "08.01.01 APORTES DO SÓCIO" },
  { nivel1: "Receita Líquida de Vendas", ordem: 2, nivel2: "Deduções da Receita Bruta", nivel3: "Devoluções de Vendas", cat: "02.03.01 DEVOLUÇÕES" },
  { nivel1: "Receita Líquida de Vendas", ordem: 2, nivel2: "Deduções da Receita Bruta", nivel3: "Impostos Sobre Vendas", cat: "02.01 TAXAS SOBRE VENDAS" },
  { nivel1: "Receita Líquida de Vendas", ordem: 2, nivel2: "Deduções da Receita Bruta", nivel3: "Impostos Sobre Vendas", cat: "02.02.01 SIMPLES NACIONAL" },
  { nivel1: "Receita Líquida de Vendas", ordem: 2, nivel2: "Deduções da Receita Bruta", nivel3: "Impostos Sobre Vendas", cat: "02.02.02 OUTROS IMPOSTOS" },
  { nivel1: "Lucro Bruto", ordem: 3, nivel2: "Custos Operacionais", nivel3: "Custo das Vendas de Produtos", cat: "03.01.01 MATÉRIA PRIMA - RAPÉ" },
  { nivel1: "Lucro Bruto", ordem: 3, nivel2: "Custos Operacionais", nivel3: "Custo das Vendas de Produtos", cat: "03.01.02 MATÉRIA PRIMA - ERVAS" },
  { nivel1: "Lucro Bruto", ordem: 3, nivel2: "Custos Operacionais", nivel3: "Custo das Vendas de Produtos", cat: "03.01.03 MATÉRIA PRIMA - ARTESANATO" },
  { nivel1: "Lucro Bruto", ordem: 3, nivel2: "Custos Operacionais", nivel3: "Custo das Vendas de Produtos", cat: "03.01.05 MATÉRIA PRIMA - FUMO" },
  { nivel1: "Lucro Bruto", ordem: 3, nivel2: "Custos Operacionais", nivel3: "Custo das Vendas de Produtos", cat: "03.01.07 PRODUTOS PARA REVENDA" },
  { nivel1: "Lucro Bruto", ordem: 3, nivel2: "Custos Operacionais", nivel3: "Custo das Vendas de Produtos", cat: "03.01.08 EMBALAGEM DO PRODUTO" },
  { nivel1: "Lucro Bruto", ordem: 3, nivel2: "Custos Operacionais", nivel3: "Custo das Vendas de Produtos", cat: "03.01.09 MANUTENÇÃO FEITIO" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Administrativas", cat: "04.03.01 ALUGUEL" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Administrativas", cat: "04.03.02 TELEFONE / INTERNET" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Administrativas", cat: "04.03.03 ENERGIA" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Administrativas", cat: "04.03.04 ÁGUA" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Administrativas", cat: "04.03.05 GÁS" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Administrativas", cat: "04.03.06 SEGURANÇA" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Administrativas", cat: "04.03.07 OUTRAS DESPESAS DE INFRAESTRUTURA" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Administrativas", cat: "04.04.01 SOFTWARES , SISTEMAS E TI" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Administrativas", cat: "04.04.02 ASSESSORIA CONTÁBIL E RH" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Administrativas", cat: "04.04.03 ASSESSORIA ADM / FINANCEIRA" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Administrativas", cat: "04.04.04 ASSESSORIA JURIDICA" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Administrativas", cat: "04.05.01 OUTRAS DESPESAS ADMINISTRATIVAS" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Administrativas", cat: "04.05.02 MATERIAL DE ESCRITÓRIO" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Administrativas", cat: "04.05.03 MATERIAL DE LIMPEZA, COPA E COZINHA" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Administrativas", cat: "04.05.05 REPAROS E MANUTENÇÃO PREDIAL" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Administrativas", cat: "04.05.06 TAXAS BANCÁRIAS" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Comerciais", cat: "04.01.01 PRO-LABORE" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Comerciais", cat: "04.01.02 OUTRAS DESPESAS COM SÓCIOS" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Comerciais", cat: "04.06.01 OUTRAS DESPESAS DE MARKETING E COMERCIAL" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Comerciais", cat: "04.06.02 AGÊNCIA DE MKT" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Comerciais", cat: "04.06.03 FREELANCERS DE MKT" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Comerciais", cat: "04.06.04 TRÁFEGO PAGO" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Comerciais", cat: "04.06.05 MATERIAIS DE DIVULGAÇÃO" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Comerciais", cat: "04.07.01 LOCAÇÃO DO ESPAÇO" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Comerciais", cat: "04.07.02 MÃO DE OBRA TEMPORÁRIA" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Comerciais", cat: "04.07.03 REFEIÇÕES E ENTRETENIMENTO" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Comerciais", cat: "04.07.05 LOCAÇÃO DE VEICULOS E EQUIPAMENTOS" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Comerciais", cat: "08.01.02 RETIRADAS DO SÓCIO" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Operacionais", cat: "03.02.01 FRETES - PAGO PELO CLIENTE" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Operacionais", cat: "03.02.02 FRETES - PAGO PELA EMPRESA" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Operacionais", cat: "03.02.03 EMBALAGEM PARA EXPEDIÇÃO" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Operacionais", cat: "03.02.04 OUTROS CUSTOS" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Operacionais", cat: "04.02.01 SALÁRIOS LÍQUIDOS" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Operacionais", cat: "04.02.02 13º SALÁRIO" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Operacionais", cat: "04.02.03 FÉRIAS" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Operacionais", cat: "04.02.04 VALE ALIMENTAÇÃO E CESTA BÁSICA" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Operacionais", cat: "04.02.05 VALE TRANSPORTE" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Operacionais", cat: "04.02.06 PLANO DE SAÚDE" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Operacionais", cat: "04.02.08 OUTRAS DESPESAS DE RH" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Operacionais", cat: "04.02.09 FGTS S/ FOLHA" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Operacionais", cat: "04.02.10 BONIFICAÇÕES" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Operacionais", cat: "04.02.11 RESCISÕES" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Operacionais", cat: "04.02.12 COMISSÕES" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Operacionais", cat: "04.02.13 INSS S/ FOLHA" },
  { nivel1: "Lucro / Prejuízo Operacional", ordem: 4, nivel2: "Despesas Operacionais", nivel3: "Despesas Operacionais", cat: "04.02.15 ADIANTAMENTO" },
  { nivel1: "Lucro / Prejuízo Líquido", ordem: 5, nivel2: "Receitas e Despesas Financeiras", nivel3: "Outras Despesas Não Operacionais", cat: "09.01.01 SAÍDAS NÃO OPERACIONAIS" },
  { nivel1: "Lucro / Prejuízo Líquido", ordem: 5, nivel2: "Receitas e Despesas Financeiras", nivel3: "Outras Receitas Não Operacionais", cat: "01.02.02 OUTRAS RECEITAS" },
  { nivel1: "Lucro / Prejuízo Líquido", ordem: 5, nivel2: "Receitas e Despesas Financeiras", nivel3: "Outras Receitas Não Operacionais", cat: "09.01.02 ENTRADAS NÃO OPRACIONAIS" },
  { nivel1: "Lucro / Prejuízo Líquido", ordem: 5, nivel2: "Receitas e Despesas Financeiras", nivel3: "Receitas e Rendimentos Financeiros", cat: "10.01.03 RENDIMENTOS DE APLICAÇÕES" },
  { nivel1: "Lucro / Prejuízo Final", ordem: 6, nivel2: "Despesas com Investimentos e Empréstimos", nivel3: "Empréstimos e Dívidas", cat: "10.01.01 CAPTAÇÃO DE EMPRESTIMOS" },
  { nivel1: "Lucro / Prejuízo Final", ordem: 6, nivel2: "Despesas com Investimentos e Empréstimos", nivel3: "Empréstimos e Dívidas", cat: "10.01.02  AMORTIZAÇÃO DE EMPRESTIMOS" },
  { nivel1: "Lucro / Prejuízo Final", ordem: 6, nivel2: "Despesas com Investimentos e Empréstimos", nivel3: "Investimentos em Imobilizado", cat: "05.01.01 AQUISICAÇÃO E REFORMA DE IMOVEIS" },
  { nivel1: "Lucro / Prejuízo Final", ordem: 6, nivel2: "Despesas com Investimentos e Empréstimos", nivel3: "Investimentos em Imobilizado", cat: "05.01.03 AQUISIÇÃO DE MOVEIS E EQUIPAMENTOS" },
];

// Build category → sign map: receita cats are positive, despesa cats negative in DRE
const DRE_CAT_SET = new Set(DRE_HIERARCHY.map(h => h.cat));

const PageDRE = ({ filters, setFilters, statusFilter, drilldown, setDrilldown, year, month }) => {
  const [expanded, setExpanded] = useState({});
  const refYear = year || window.REF_YEAR || new Date().getFullYear();
  const regime = "competencia"; // DRE é sempre competência
  const fmt = (window.BIT && window.BIT.fmt) || (n => `R$${n.toFixed(2)}`);
  const MONTH_LABELS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

  // Compute DRE values per category per month from ALL_TX
  // Also builds dreSubs: cat -> Map(razaoSocial -> [12 months])
  const { dreData, dreSubs } = useMemo(() => {
    const allTx = window.ALL_TX || [];
    const rg = regime === "competencia" ? "k" : "c";
    const sf = statusFilter || "realizado";
    var txs = window.filterTx ? window.filterTx(allTx, sf, null, rg, filters) : allTx;
    txs = txs.filter(r => r[1] && r[1].startsWith(String(refYear)));

    // cat -> [12 months]
    const catMonths = new Map();
    // cat -> Map(razaoSocial -> [12 months])
    const catSubs = new Map();
    for (const row of txs) {
      const cat = row[3];
      if (!DRE_CAT_SET.has(cat)) continue;
      const mIdx = parseInt(row[1].slice(5, 7), 10) - 1;
      if (mIdx < 0 || mIdx > 11) continue;
      const kind = row[0]; // 'r' or 'd'
      const valor = row[5];
      const signed = kind === "r" ? valor : -valor;
      if (!catMonths.has(cat)) catMonths.set(cat, Array(12).fill(0));
      catMonths.get(cat)[mIdx] += signed;
      // Sub by razao social (cliente for receita, fornecedor for despesa)
      const razao = (kind === "r" ? row[4] : row[7]) || "Não Definido";
      if (!catSubs.has(cat)) catSubs.set(cat, new Map());
      const subsMap = catSubs.get(cat);
      if (!subsMap.has(razao)) subsMap.set(razao, Array(12).fill(0));
      subsMap.get(razao)[mIdx] += signed;
    }
    return { dreData: catMonths, dreSubs: catSubs };
  }, [statusFilter, regime, refYear, filters]);

  // Aggregate by nivel1
  const nivel1Months = (nivel1Name) => {
    const cats = DRE_HIERARCHY.filter(h => h.nivel1 === nivel1Name);
    const totals = Array(12).fill(0);
    for (const c of cats) {
      const vals = dreData.get(c.cat);
      if (vals) for (var i = 0; i < 12; i++) totals[i] += vals[i];
    }
    return totals;
  };

  // Aggregate by nivel2
  const nivel2Months = (nivel2Name) => {
    const cats = DRE_HIERARCHY.filter(h => h.nivel2 === nivel2Name);
    const totals = Array(12).fill(0);
    for (const c of cats) {
      const vals = dreData.get(c.cat);
      if (vals) for (var i = 0; i < 12; i++) totals[i] += vals[i];
    }
    return totals;
  };

  // Cascaded totals per month (DRE logic from PBI)
  const recBrutaM = nivel1Months("Receita Bruta de Vendas");
  const deducoesM = nivel1Months("Receita Líquida de Vendas");
  const recLiquidaM = recBrutaM.map((v, i) => v + deducoesM[i]);
  const custosM = nivel1Months("Lucro Bruto");
  const lucroBrutoM = recLiquidaM.map((v, i) => v + custosM[i]);
  const despOpM = nivel1Months("Lucro / Prejuízo Operacional");
  const lucroOpM = lucroBrutoM.map((v, i) => v + despOpM[i]);
  const recDespFinM = nivel1Months("Lucro / Prejuízo Líquido");
  const lucroLiqM = lucroOpM.map((v, i) => v + recDespFinM[i]);
  const investM = nivel1Months("Lucro / Prejuízo Final");
  const lucroFinalM = lucroLiqM.map((v, i) => v + investM[i]);

  // Map nivel1 → cascaded totals
  const cascadedMap = {
    "Receita Bruta de Vendas": recBrutaM,
    "Receita Líquida de Vendas": recLiquidaM,
    "Lucro Bruto": lucroBrutoM,
    "Lucro / Prejuízo Operacional": lucroOpM,
    "Lucro / Prejuízo Líquido": lucroLiqM,
    "Lucro / Prejuízo Final": lucroFinalM,
  };

  // Months with data
  const monthsWithData = [];
  for (var mi = 0; mi < 12; mi++) {
    if (recBrutaM[mi] !== 0 || deducoesM[mi] !== 0 || custosM[mi] !== 0 || despOpM[mi] !== 0) monthsWithData.push(mi);
  }
  if (monthsWithData.length === 0) monthsWithData.push(0);

  const sum = (arr) => arr.reduce((s, v) => s + v, 0);
  const avPct = (val, recBruta) => recBruta !== 0 ? ((Math.abs(val) / Math.abs(recBruta)) * 100).toFixed(2).replace(".", ",") + "%" : "0,00%";

  const toggle = (key) => setExpanded(s => ({ ...s, [key]: !s[key] }));

  // Build ordered nivel1 sections
  const nivel1s = [
    { name: "Receita Bruta de Vendas", ordem: 1 },
    { name: "Receita Líquida de Vendas", ordem: 2 },
    { name: "Lucro Bruto", ordem: 3 },
    { name: "Lucro / Prejuízo Operacional", ordem: 4 },
    { name: "Lucro / Prejuízo Líquido", ordem: 5 },
    { name: "Lucro / Prejuízo Final", ordem: 6 },
  ];

  // Get unique nivel2s for a nivel1
  const getNivel2s = (nivel1Name) => {
    const seen = [];
    const seenSet = new Set();
    for (const h of DRE_HIERARCHY) {
      if (h.nivel1 === nivel1Name && !seenSet.has(h.nivel2)) {
        seenSet.add(h.nivel2);
        seen.push(h.nivel2);
      }
    }
    return seen;
  };

  const stickyStyle = { position: "sticky", left: 0, background: "var(--surface)", zIndex: 1 };
  const stickyThStyle = { position: "sticky", left: 0, background: "var(--surface)", zIndex: 3 };

  const valColor = (v) => v > 0 ? "var(--green)" : v < 0 ? "var(--red)" : "var(--fg-3)";

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>DRE</h1>
          <div className="status-line">Demonstração do Resultado do Exercício · {refYear}</div>
        </div>
        <div className="actions">
        </div>
      </div>

      <div className="card" style={{ overflow: "auto" }}>
        <table className="t" style={{ fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ ...stickyThStyle, minWidth: 280 }}>Mes/Ano<br/><span style={{ color: "var(--mute)", fontWeight: 400 }}>Nivel1</span></th>
              {monthsWithData.map(mi => (
                <React.Fragment key={mi}>
                  <th className="num" style={{ minWidth: 110 }}>{MONTH_LABELS[mi]}/{refYear}<br/><span style={{ fontWeight: 400, fontSize: 10 }}>Total DRE Comp</span></th>
                  <th className="num" style={{ minWidth: 50 }}>% AV</th>
                </React.Fragment>
              ))}
              <th className="num" style={{ minWidth: 110 }}>Total<br/><span style={{ fontWeight: 400, fontSize: 10 }}>Total DRE</span></th>
              <th className="num" style={{ minWidth: 50 }}>% AV</th>
            </tr>
          </thead>
          <tbody>
            {nivel1s.map(n1 => {
              const cascaded = cascadedMap[n1.name];
              const totalCascaded = sum(cascaded);
              const totalRecBruta = sum(recBrutaM);
              const isExpanded = expanded[n1.name];
              const nivel2s = getNivel2s(n1.name);

              return (
                <React.Fragment key={n1.name}>
                  {/* Nivel1 header row — cascaded total */}
                  <tr className="section" style={{ cursor: "pointer" }} onClick={() => toggle(n1.name)}>
                    <td style={{ ...stickyStyle, fontWeight: 700 }}>
                      <span className="chev" style={{ marginRight: 6 }}>{isExpanded ? "−" : "+"}</span>
                      {n1.name}
                    </td>
                    {monthsWithData.map(mi => (
                      <React.Fragment key={mi}>
                        <td className="num" style={{ fontWeight: 700, color: valColor(cascaded[mi]) }}>{fmt(cascaded[mi])}</td>
                        <td className="num" style={{ color: "var(--fg-3)" }}>{avPct(cascaded[mi], recBrutaM[mi])}</td>
                      </React.Fragment>
                    ))}
                    <td className="num" style={{ fontWeight: 700, color: valColor(totalCascaded) }}>{fmt(totalCascaded)}</td>
                    <td className="num" style={{ color: "var(--fg-3)" }}>{avPct(totalCascaded, totalRecBruta)}</td>
                  </tr>

                  {/* Nivel2 sub-rows */}
                  {isExpanded && nivel2s.map(n2Name => {
                    const n2Vals = nivel2Months(n2Name);
                    const totalN2 = sum(n2Vals);
                    const isN2Expanded = expanded[`n2:${n2Name}`];
                    const catsInN2 = DRE_HIERARCHY.filter(h => h.nivel2 === n2Name);
                    // Unique nivel3s
                    const nivel3s = [];
                    const n3Set = new Set();
                    for (const h of catsInN2) { if (!n3Set.has(h.nivel3)) { n3Set.add(h.nivel3); nivel3s.push(h.nivel3); } }

                    return (
                      <React.Fragment key={n2Name}>
                        <tr style={{ cursor: "pointer" }} onClick={() => toggle(`n2:${n2Name}`)}>
                          <td style={{ ...stickyStyle, paddingLeft: 24 }}>
                            <span className="chev" style={{ marginRight: 4 }}>{isN2Expanded ? "−" : "+"}</span>
                            {n2Name}
                          </td>
                          {monthsWithData.map(mi => (
                            <React.Fragment key={mi}>
                              <td className="num" style={{ color: valColor(n2Vals[mi]) }}>{fmt(n2Vals[mi])}</td>
                              <td className="num" style={{ color: "var(--fg-3)", fontSize: 11 }}>{avPct(n2Vals[mi], recBrutaM[mi])}</td>
                            </React.Fragment>
                          ))}
                          <td className="num" style={{ color: valColor(totalN2) }}>{fmt(totalN2)}</td>
                          <td className="num" style={{ color: "var(--fg-3)", fontSize: 11 }}>{avPct(totalN2, totalRecBruta)}</td>
                        </tr>

                        {/* Nivel3 subcategory headers + category detail */}
                        {isN2Expanded && nivel3s.map(n3Name => {
                          const catsInN3 = DRE_HIERARCHY.filter(h => h.nivel2 === n2Name && h.nivel3 === n3Name);
                          const n3Vals = Array(12).fill(0);
                          for (const c of catsInN3) {
                            const v = dreData.get(c.cat);
                            if (v) for (var ii = 0; ii < 12; ii++) n3Vals[ii] += v[ii];
                          }
                          const totalN3 = sum(n3Vals);
                          if (totalN3 === 0 && monthsWithData.every(mi => n3Vals[mi] === 0)) return null;
                          const isN3Expanded = expanded[`n3:${n2Name}:${n3Name}`];
                          return (
                            <React.Fragment key={n3Name}>
                              <tr style={{ cursor: "pointer" }} onClick={() => toggle(`n3:${n2Name}:${n3Name}`)}>
                                <td style={{ ...stickyStyle, paddingLeft: 40, fontSize: 11, fontWeight: 600 }}>
                                  <span className="chev" style={{ marginRight: 4 }}>{isN3Expanded ? "−" : "+"}</span>
                                  {n3Name}
                                </td>
                                {monthsWithData.map(mi => (
                                  <React.Fragment key={mi}>
                                    <td className="num" style={{ fontSize: 11, color: valColor(n3Vals[mi]) }}>{n3Vals[mi] !== 0 ? fmt(n3Vals[mi]) : "—"}</td>
                                    <td className="num" style={{ fontSize: 10, color: "var(--fg-3)" }}>{n3Vals[mi] !== 0 ? avPct(n3Vals[mi], recBrutaM[mi]) : ""}</td>
                                  </React.Fragment>
                                ))}
                                <td className="num" style={{ fontSize: 11, fontWeight: 600, color: valColor(totalN3) }}>{totalN3 !== 0 ? fmt(totalN3) : "—"}</td>
                                <td className="num" style={{ fontSize: 10, color: "var(--fg-3)" }}>{totalN3 !== 0 ? avPct(totalN3, totalRecBruta) : ""}</td>
                              </tr>
                              {isN3Expanded && catsInN3.map(catRow => {
                                const vals = dreData.get(catRow.cat) || Array(12).fill(0);
                                const totalCat = sum(vals);
                                if (totalCat === 0 && monthsWithData.every(mi => vals[mi] === 0)) return null;
                                const isCatExpanded = expanded[`cat:${catRow.cat}`];
                                const subsMap = dreSubs.get(catRow.cat);
                                const hasSubs = subsMap && subsMap.size > 0;
                                return (
                                  <React.Fragment key={catRow.cat}>
                                    <tr style={{ opacity: 0.8, cursor: hasSubs ? "pointer" : "default" }} onClick={() => hasSubs && toggle(`cat:${catRow.cat}`)}>
                                      <td style={{ ...stickyStyle, paddingLeft: 60, fontSize: 11 }}>
                                        {hasSubs && <span className="chev" style={{ marginRight: 4 }}>{isCatExpanded ? "−" : "+"}</span>}
                                        {catRow.cat}
                                      </td>
                                      {monthsWithData.map(mi => (
                                        <React.Fragment key={mi}>
                                          <td className="num" style={{ fontSize: 11, color: valColor(vals[mi]) }}>{vals[mi] !== 0 ? fmt(vals[mi]) : "—"}</td>
                                          <td className="num" style={{ fontSize: 10, color: "var(--fg-3)" }}>{vals[mi] !== 0 ? avPct(vals[mi], recBrutaM[mi]) : ""}</td>
                                        </React.Fragment>
                                      ))}
                                      <td className="num" style={{ fontSize: 11, color: valColor(totalCat) }}>{totalCat !== 0 ? fmt(totalCat) : "—"}</td>
                                      <td className="num" style={{ fontSize: 10, color: "var(--fg-3)" }}>{totalCat !== 0 ? avPct(totalCat, totalRecBruta) : ""}</td>
                                    </tr>
                                    {isCatExpanded && subsMap && [...subsMap.entries()]
                                      .sort((a, b) => Math.abs(sum(b[1])) - Math.abs(sum(a[1])))
                                      .map(([razao, rVals]) => {
                                        const totalR = sum(rVals);
                                        if (totalR === 0 && monthsWithData.every(mi => rVals[mi] === 0)) return null;
                                        return (
                                          <tr key={razao} style={{ opacity: 0.6 }}>
                                            <td style={{ ...stickyStyle, paddingLeft: 80, fontSize: 10, fontStyle: "italic" }}>{razao}</td>
                                            {monthsWithData.map(mi => (
                                              <React.Fragment key={mi}>
                                                <td className="num" style={{ fontSize: 10, color: valColor(rVals[mi]) }}>{rVals[mi] !== 0 ? fmt(rVals[mi]) : "—"}</td>
                                                <td className="num" style={{ fontSize: 9, color: "var(--fg-3)" }}>{rVals[mi] !== 0 ? avPct(rVals[mi], recBrutaM[mi]) : ""}</td>
                                              </React.Fragment>
                                            ))}
                                            <td className="num" style={{ fontSize: 10, color: valColor(totalR) }}>{totalR !== 0 ? fmt(totalR) : "—"}</td>
                                            <td className="num" style={{ fontSize: 9, color: "var(--fg-3)" }}>{totalR !== 0 ? avPct(totalR, totalRecBruta) : ""}</td>
                                          </tr>
                                        );
                                      })}
                                  </React.Fragment>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            })}

            {/* Total row */}
            <tr className="total">
              <td style={{ ...stickyStyle, fontWeight: 700 }}>Total</td>
              {monthsWithData.map(mi => (
                <React.Fragment key={mi}>
                  <td className="num" style={{ fontWeight: 700, color: valColor(lucroFinalM[mi]) }}>{fmt(lucroFinalM[mi])}</td>
                  <td className="num" style={{ color: "var(--fg-3)" }}>{avPct(lucroFinalM[mi], recBrutaM[mi])}</td>
                </React.Fragment>
              ))}
              <td className="num" style={{ fontWeight: 700, color: valColor(sum(lucroFinalM)) }}>{fmt(sum(lucroFinalM))}</td>
              <td className="num" style={{ color: "var(--fg-3)" }}>{avPct(sum(lucroFinalM), sum(recBrutaM))}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

window.PageDRE = PageDRE;
