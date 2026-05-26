/* upsell-pages.jsx — UpsellPage genérica + catalog por page id.
 *
 * Uso:
 *   if (window.BI_PAGE_MODE['valuation'] === 'upsell') {
 *     return <UpsellPage pageId="valuation" />;
 *   }
 *
 * O modo de cada page vem do bi.config.js > pages.{geral,outros}[id]
 * e é injetado em window.BI_PAGE_MODE pelo build-jsx.cjs.
 */

const UPSELL_CATALOG = {
  valuation: {
    title: "Valuation — Fluxo de Caixa Descontado",
    icon: "📈",
    descricao: "Avalie quanto sua empresa vale com base em projeções de 5 anos descontadas a valor presente. Premissas editáveis (WACC, crescimento, margem, IPCA), modelo de Gordon pro valor terminal, sensibilidade a cenários otimista/conservador.",
    beneficios: [
      "Valor de mercado da empresa em tempo real, atualizado conforme dados financeiros mudam",
      "Cenários editáveis: ajuste WACC, crescimento e margem em segundos",
      "Memória de cálculo completa exportável em PDF (premissas + interpretação)",
      "Útil pra M&A, captação, sucessão familiar, planejamento estratégico",
    ],
    preview_visual: "tabela de projeção 5 anos + card grande com Enterprise Value + análise textual",
    pra_quem: "CFOs, sócios em transição, empresas em fundraising ou M&A",
  },
  relatorio_ia: {
    title: "Relatório IA Executivo",
    icon: "🤖",
    descricao: "Análise executiva mensal e anual gerada por IA, com interpretação contextualizada dos números, identificação de riscos e oportunidades, e recomendações estratégicas acionáveis. 7 seções (Visão Geral, Receita, Despesa, Fluxo, Tesouraria, Comparativo, Conclusão) baseadas nos dados reais do período.",
    beneficios: [
      "Análise narrativa profunda — não só gráficos, mas explicação do que aconteceu e por quê",
      "Identifica padrões: concentração de cliente, sazonalidade, descasamento caixa, etc",
      "Recomendações específicas por período (mês/ano)",
      "Exportável em PDF estilo apresentação executiva",
      "Atualizado mensalmente — pode ser enviado pra investidores/conselho",
    ],
    preview_visual: "relatório formato A4 com capa BGP + 7 seções + cards de KPIs por seção",
    pra_quem: "C-levels que precisam comunicar resultados pra board/investidores",
  },
  faturamento_produto: {
    title: "Faturamento por Produto",
    icon: "📦",
    descricao: "Análise detalhada de vendas por produto, família, vendedor e mês. Ranking de produtos, matriz produto × mês, ticket médio, top vendedores, top clientes.",
    beneficios: [
      "Top 100 produtos com faturamento, quantidade e variação mês a mês",
      "Identifica produtos em queda e em crescimento",
      "Ranking de vendedores com conversão",
      "Matriz produto × mês visual",
    ],
    preview_visual: "card grande METRICAS GERAIS + barras horizontais por família + matriz tabular",
    pra_quem: "diretores comerciais, gerentes de produto",
  },
  curva_abc: {
    title: "Curva ABC de Produtos",
    icon: "📊",
    descricao: "Classificação ABC dos produtos por receita acumulada (regra 80/15/5). Identifica produtos críticos (A) que fazem 80% do faturamento. Curva acumulada visual.",
    beneficios: [
      "Reclassificação automática (não confia em rótulos do XLSX externo)",
      "Top 20 produtos com badges A/B/C coloridos",
      "Curva acumulada com gradiente",
      "Tabela completa filtrável por classe",
    ],
    preview_visual: "KPIs por classe + curva gradiente + tabela top 20 com badges",
    pra_quem: "compras, planejamento, gestão de estoque",
  },
  marketing_ads: {
    title: "Análise Profunda — Marketing ADS",
    icon: "📣",
    descricao: "Performance de campanhas Facebook/Instagram ADS: CPM, CPC, cliques, leads, alcance, impressões. Hierarquia visual Campanha → Conjunto → Anúncio.",
    beneficios: [
      "4 KPIs grandes: Custo, Cliques, Impressões, Impacto",
      "Chart CPM × Valor Investido por campanha",
      "Top campanhas e anúncios por leads",
      "Filtros reativos por campanha e anúncio",
    ],
    preview_visual: "4 KPIs laranja + gráfico CPM × Valor + bar lists",
    pra_quem: "marketing digital, agências",
  },
  crm_omie: {
    title: "CRM Pipeline de Oportunidades",
    icon: "🎯",
    descricao: "Pipeline de vendas com funil cumulativo, conversão por fase, ranking de vendedores, motivo de perda. Inclui metas comerciais (mês e ano) com progresso visual.",
    beneficios: [
      "Funil 03 Proposta → 04 Negociação → 05 Aguardando → 06 Conclusão",
      "Conversão por vendedor + ticket médio",
      "Banner de metas: R$ X de R$ Y do mês com barra colorida",
      "Análise de motivo de perda com top 8 razões",
    ],
    preview_visual: "5 KPIs + funil colorido + barras de meta + listas vendedor/origem/motivo",
    pra_quem: "diretores comerciais, head de vendas",
  },
  hierarquia: {
    title: "Hierarquia ADS (Tree)",
    icon: "🌳",
    descricao: "Visualização hierárquica em árvore de Campanhas → Conjuntos → Anúncios com métricas em cada nível.",
    beneficios: [
      "Árvore SVG com conectores Bezier",
      "Métricas (alcance, impressões, valor) por nó",
      "Filtros reativos cascateados",
    ],
    preview_visual: "árvore com 4 colunas + conectores curvos laranja",
    pra_quem: "marketing avançado, planejamento de campanha",
  },
  detalhado: {
    title: "Detalhamento de Vendas",
    icon: "🔍",
    descricao: "Análise por família e cliente com matriz produto × mês mostrando quantidade vendida e valor faturado mensal.",
    beneficios: [
      "Top 10 famílias e top 14 clientes em bar lists",
      "Matriz produto × mês com 30 produtos e classificação ABC",
      "Reativa ao filtro de mês do header",
    ],
    preview_visual: "2 bar lists + matriz tabular ampla",
    pra_quem: "gestão comercial, controladoria",
  },
  profunda_cliente: {
    title: "Análise Profunda Cliente",
    icon: "👥",
    descricao: "Drill-down por cliente com filtros por período (mês inicial/final) e busca textual.",
    beneficios: [
      "Bar overlay por cliente com participação no faturamento",
      "Filtro de período granular",
      "Cross-filter com drilldown global",
    ],
    preview_visual: "tabela com barras horizontais sobrepostas",
    pra_quem: "gestão de contas, atendimento estratégico",
  },
};

function UpsellPage({ pageId, onContact }) {
  const meta = UPSELL_CATALOG[pageId] || {
    title: pageId,
    icon: "✨",
    descricao: "Funcionalidade premium disponível em planos avançados.",
    beneficios: [],
    preview_visual: "",
    pra_quem: "",
  };

  const handleContact = () => {
    if (onContact) onContact(pageId);
    else {
      // Fallback: copia template pra clipboard ou abre mailto
      const subject = encodeURIComponent(`Interesse em ${meta.title}`);
      const body = encodeURIComponent(`Olá BGP,\n\nGostaria de ativar a funcionalidade "${meta.title}" no nosso BI.\n\nEnvie por favor as opções de plano.\n\nObrigado.`);
      window.open(`mailto:bi@bertuzzipatrimonial.com.br?subject=${subject}&body=${body}`, "_blank");
    }
  };

  return (
    <div className="page upsell-page">
      <div className="page-title">
        <div>
          <h1>{meta.icon} {meta.title}</h1>
          <div className="status-line">
            <span className="upsell-badge-pro">PRO</span> Funcionalidade premium — disponível mediante contratação
          </div>
        </div>
      </div>

      <div className="upsell-hero">
        <div className="upsell-hero-icon">{meta.icon}</div>
        <div className="upsell-hero-body">
          <h2 className="upsell-hero-title">{meta.title}</h2>
          <p className="upsell-hero-desc">{meta.descricao}</p>
          <button className="btn-primary upsell-cta" onClick={handleContact}>
            Solicitar contratação
          </button>
          <span className="upsell-cta-hint">Envia email pra BGP — você aciona quando quiser</span>
        </div>
      </div>

      <div className="row" style={{ gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: 16 }}>
        <div className="card">
          <h2 className="card-title">O que essa funcionalidade entrega</h2>
          <ul className="upsell-beneficios">
            {meta.beneficios.map((b, i) => (
              <li key={i}>
                <span className="upsell-check">✓</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
          {meta.preview_visual && (
            <div className="upsell-preview-mock">
              <div className="upsell-preview-label">Preview visual</div>
              <div className="upsell-preview-box">
                {meta.preview_visual}
              </div>
            </div>
          )}
        </div>

        <div className="card upsell-side">
          <h2 className="card-title">Pra quem é</h2>
          <p style={{ color: "var(--fg-2)", lineHeight: 1.6, fontSize: 13 }}>{meta.pra_quem || "Times executivos e gestores que precisam de visibilidade financeira aprofundada."}</p>
          <div className="upsell-divider"></div>
          <h3 style={{ fontSize: 12, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>Como funciona a contratação</h3>
          <ol style={{ paddingLeft: 18, color: "var(--fg-2)", fontSize: 12, lineHeight: 1.7 }}>
            <li>Click em "Solicitar contratação"</li>
            <li>BGP retorna em 1 dia útil com proposta</li>
            <li>Após aceite, ativação em ~3 dias</li>
            <li>Treinamento incluído (1h Google Meet)</li>
          </ol>
        </div>
      </div>

      <div className="status-line" style={{ marginTop: 16, fontSize: 11, color: "var(--fg-3)", textAlign: "center" }}>
        Esta tela é apenas demonstrativa — sem dados reais. Contrate pra ativar com seus números.
      </div>
    </div>
  );
}

window.UpsellPage = UpsellPage;
window.UPSELL_CATALOG = UPSELL_CATALOG;
