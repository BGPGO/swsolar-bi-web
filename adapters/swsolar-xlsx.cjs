/**
 * Adapter: SW Solar — XLSX Consolidado (4 empresas)
 *
 * Le o arquivo BGP_Financeiro_Consolidado.xlsx do Drive.
 * Sheet CONSOLIDADO com colunas:
 *   Tipo | Empresa | Parte (Credor/Cliente) | Documento | Lancamento
 *   Dt. Vencimento | Data Baixa/Vencimento | Valor (R$) | Acrescimo (R$)
 *   Desconto (R$) | Liquido (R$) | Centro de Custo | Categoria Financeira
 *   Area de Negocio | Dt. Emissao | Situacao Inadimplencia | Status
 *   Tipo Documento | Tipo Operacao
 *
 * Mapeamento:
 *   Tipo "A RECEBER" -> natureza R, "A PAGAR" -> natureza P
 *   Status contendo "Baixado" -> realizado=true, else false
 *   Liquido (R$) como valor_total (fallback: Valor (R$))
 *   Categoria Financeira -> categoria
 *   Parte (Credor/Cliente) -> cliente
 *   Centro de Custo -> centro_custo
 *   Empresa -> conta_corrente (para filtro por empresa)
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const XLSX = require('xlsx');

function readSheet(file, sheetName) {
  const wb = XLSX.readFile(file, { type: 'binary', codepage: 65001 });
  const sn = sheetName || wb.SheetNames[0];
  if (!wb.Sheets[sn]) {
    console.warn(`  [warn] Sheet "${sn}" nao encontrada. Sheets disponiveis: ${wb.SheetNames.join(', ')}`);
    return [];
  }
  return XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: '' });
}

function num(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

function isoDate(v) {
  if (!v) return null;
  if (typeof v === 'number' && v > 1000) {
    // Excel serial date
    const ms = (v - 25569) * 86400 * 1000;
    const d = new Date(ms);
    return d.toISOString().slice(0, 10);
  }
  if (typeof v === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
    const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return null;
}

let idSeq = 1;

module.exports = {
  id: 'swsolar-xlsx',
  label: 'SW Solar XLSX Consolidado',
  required_env: [],

  validate(config) {
    const errors = [];
    const drive = config.fontes && config.fontes.drive && config.fontes.drive.base_path;
    if (!drive) errors.push('config.fontes.drive.base_path nao definido');
    else if (!fs.existsSync(drive)) errors.push(`drive base_path nao existe: ${drive}`);

    const cfg = config.fontes && config.fontes['swsolar_xlsx'];
    if (!cfg) { errors.push('config.fontes.swsolar_xlsx nao definido'); return { ok: false, errors }; }

    if (drive && fs.existsSync(drive)) {
      const file = path.join(drive, cfg.consolidado_file || 'BGP_Financeiro_Consolidado.xlsx');
      if (!fs.existsSync(file)) errors.push(`consolidado file nao existe: ${file}`);
    }
    return { ok: errors.length === 0, errors };
  },

  async pull(config, dataDir) {
    fs.mkdirSync(dataDir, { recursive: true });
    const drive = config.fontes.drive.base_path;
    const cfg = config.fontes['swsolar_xlsx'];

    console.log('=== SW Solar XLSX pull ===');

    // 1. Consolidado
    const consolidadoPath = path.join(drive, cfg.consolidado_file || 'BGP_Financeiro_Consolidado.xlsx');
    const sheetName = cfg.consolidado_sheet || 'CONSOLIDADO';
    console.log('Lendo consolidado:', consolidadoPath, '| sheet:', sheetName);
    const rows = readSheet(consolidadoPath, sheetName);
    console.log(`  ${rows.length} linhas brutas`);

    // Operações internas que não são receita/despesa real — excluir
    const EXCLUIR_TIPO_OP = /^(Abatimento de Adiantamento|Distrato|Substituição|Cancelamento|Por Bens)$/i;

    const movimentos = [];
    for (const r of rows) {
      const tipo = String(r['Tipo'] || '').trim().toUpperCase();
      if (!tipo) continue;
      // Tipo values: "A RECEBER", "RECEBIDO", "A PAGAR", "PAGO"
      const natureza = (tipo === 'A RECEBER' || tipo === 'RECEBIDO') ? 'R' : 'P';
      const realizado = (tipo === 'PAGO' || tipo === 'RECEBIDO');

      // Excluir operações internas (abatimentos, distratos)
      const tipoOp = String(r['Tipo Operação'] || r['Tipo Operacao'] || '').trim();
      if (EXCLUIR_TIPO_OP.test(tipoOp)) continue;

      const valorLiquido = num(r['Líquido (R$)']) || num(r['Liquido (R$)']);
      const valorBruto = num(r['Valor (R$)']);
      const valor = Math.abs(valorLiquido || valorBruto);
      if (valor === 0) continue;

      // Usar Dt. Vencimento como data principal (competência)
      const dtVenc = isoDate(r['Dt. Vencimento']);
      const dtBaixa = isoDate(r['Data Baixa/Vencimento']);
      const dtEmissao = isoDate(r['Dt. Emissão'] || r['Dt. Emissao']);

      // Precisamos de pelo menos uma data
      if (!dtVenc && !dtBaixa && !dtEmissao) continue;

      const status = realizado ? 'PAGO' : 'EM ABERTO';

      movimentos.push({
        id: `sw-${idSeq++}`,
        fonte: 'swsolar-xlsx',
        natureza,
        status,
        realizado,
        data_emissao: dtEmissao || dtVenc || dtBaixa,
        data_vencimento: dtVenc || dtBaixa || dtEmissao,
        // Data efetiva: receita usa Data Baixa (caixa), despesa usa Dt. Vencimento (competência)
        data_pagamento: natureza === 'R' ? (dtBaixa || dtVenc || dtEmissao) : (dtVenc || dtBaixa || dtEmissao),
        valor_total: valor,
        valor_pago: realizado ? valor : 0,
        valor_aberto: realizado ? 0 : valor,
        categoria: String(r['Categoria Financeira'] || 'Sem categoria').trim(),
        centro_custo: String(r['Centro de Custo'] || '').trim(),
        cliente: String(r['Parte (Credor/Cliente)'] || '').trim(),
        conta_corrente: String(r['Empresa'] || '').trim(),
        codigo_banco: '',
        observacao: String(r['Tipo Documento'] || '').trim(),
        area_negocio: String(r['Área de Negócio'] || r['Area de Negocio'] || '').trim(),
        tags: [],
      });
    }

    console.log(`  movimentos validos: ${movimentos.length} (${movimentos.filter(m => m.natureza === 'R').length} receitas, ${movimentos.filter(m => m.natureza === 'P').length} despesas)`);
    console.log(`  realizados: ${movimentos.filter(m => m.realizado).length} | em aberto: ${movimentos.filter(m => !m.realizado).length}`);

    fs.writeFileSync(path.join(dataDir, 'movimentos.json'), JSON.stringify(movimentos, null, 2));

    // Empresa
    fs.writeFileSync(path.join(dataDir, 'empresa.json'), JSON.stringify({
      nome_fantasia: config.cliente?.nome || 'SW Solar',
      fonte: 'swsolar-xlsx',
    }));

    // Categorias
    const allCats = [...new Set(movimentos.map(m => m.categoria).filter(Boolean))];
    fs.writeFileSync(path.join(dataDir, 'categorias.json'), JSON.stringify(
      allCats.map(name => ({ codigo: name, descricao: name, tipo: 'mista' })), null, 2
    ));

    // Clientes
    const allClientes = [...new Set(movimentos.map(m => m.cliente).filter(Boolean))];
    fs.writeFileSync(path.join(dataDir, 'clientes.json'), JSON.stringify(
      allClientes.map(name => ({ codigo: name, nome_fantasia: name, razao_social: name })), null, 2
    ));

    // Empty auxiliary files
    fs.writeFileSync(path.join(dataDir, 'departamentos.json'), JSON.stringify([]));
    fs.writeFileSync(path.join(dataDir, 'contas_correntes.json'), JSON.stringify([]));
    fs.writeFileSync(path.join(dataDir, 'contas_pagar.json'), JSON.stringify([]));
    fs.writeFileSync(path.join(dataDir, 'contas_receber.json'), JSON.stringify([]));
    fs.writeFileSync(path.join(dataDir, 'orcamento.json'), JSON.stringify([]));

    // Summary
    fs.writeFileSync(path.join(dataDir, '_summary.json'), JSON.stringify({
      adapter: 'swsolar-xlsx',
      fetched_at: new Date().toISOString(),
      records: movimentos.length,
      empresas: [...new Set(movimentos.map(m => m.conta_corrente).filter(Boolean))],
    }, null, 2));

    console.log(`=== SW Solar XLSX OK: ${movimentos.length} movimentos ===`);
    return { fetched: movimentos.length, summary: { adapter: 'swsolar-xlsx', records: movimentos.length } };
  },
};
