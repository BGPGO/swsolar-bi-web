// bi.config.js — SW Solar BI
// Fonte: XLSX consolidado (4 empresas) + movimentações caixa/bancos
module.exports = {
  cliente: {
    nome: "SW Solar",
    subdomain: "swsolar-bi",
    coolify_app_uuid: "smgyur5ban03nxmamvkdlxht",
    cor_primaria: "#f59e0b",
  },
  fontes: {
    adapters: ["swsolar-xlsx"],
    swsolar_xlsx: {
      consolidado_file: "BGP_Financeiro_Consolidado.xlsx",
      consolidado_sheet: "CONSOLIDADO",
      movimentos_file: "relatorio_transformado_base_por_empresa.xlsx",
    },
    drive: {
      base_path: "G:/Meu Drive/BGP/CLIENTES/BI/411. SW SOLAR/BASES",
    },
  },
  pages: {
    geral: {
      overview: "active", receita: "active", despesa: "active",
      fluxo: "active", tesouraria: "active", comparativo: "active",
      relatorio: "active", valuation: "hidden",
      orcamento: "hidden", dre: "hidden",
    },
    outros: {
      indicators: "hidden", faturamento_produto: "hidden", curva_abc: "hidden",
      marketing: "hidden", hierarquia: "hidden", detalhado: "hidden",
      profunda_cliente: "hidden", crm: "hidden",
    },
  },
  meta: {
    ano_corrente: 2026,
    metas_crm: { mes: 0, ano: 0 },
    valuation_premissas: { wacc: 25, growth_year2: 20, growth_year3: 20, ipca: 4.5, perpetuity_growth: 10 },
  },
  template: { version_when_created: "1.0.0", version_last_synced: "1.0.0" },
};
