/**
 * Template pra criar adapter novo.
 *
 * Copie pra adapters/<nome>.cjs e implemente validate() e pull().
 * Output deve seguir o schema canonical em adapters/_CONTRACT.md.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

module.exports = {
  id: '<nome-do-adapter>',
  label: '<Nome legível>',
  required_env: [],   // ['CHAVE_API', 'SECRET'] etc — exigidas no .env

  /**
   * Valida config + env. Retorna { ok: boolean, errors: string[] }
   */
  validate(config) {
    const errors = [];
    for (const v of this.required_env) {
      if (!process.env[v]) errors.push(`env ${v} não definido`);
    }
    return { ok: errors.length === 0, errors };
  },

  /**
   * Executa pull. Escreve JSONs canonical em dataDir/. Retorna { fetched, summary }.
   *
   * @param {object} config — bi.config.js completo
   * @param {string} dataDir — caminho absoluto pra data/
   */
  async pull(config, dataDir) {
    fs.mkdirSync(dataDir, { recursive: true });

    // 1) Pull de empresa, categorias, departamentos, clientes, contas
    // const empresa = await fetch(...);
    // fs.writeFileSync(path.join(dataDir, 'empresa.json'), JSON.stringify(empresa));

    // 2) Pull de movimentos (a maior parte do trabalho)
    const movimentos = [];   // array canonical conforme _CONTRACT.md
    // ...

    fs.writeFileSync(path.join(dataDir, 'movimentos.json'), JSON.stringify(movimentos));

    return {
      fetched: movimentos.length,
      summary: {
        adapter: this.id,
        timestamp: new Date().toISOString(),
        records: movimentos.length,
      },
    };
  },
};
