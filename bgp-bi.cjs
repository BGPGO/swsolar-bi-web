#!/usr/bin/env node
/**
 * bgp-bi — CLI pra criar, buildar, publicar e sincronizar projetos de BI cliente.
 *
 * Comandos:
 *   bgp-bi init [--cliente NAME] [--erp omie|conta-azul] [--extras a,b,c]
 *   bgp-bi build
 *   bgp-bi publish
 *   bgp-bi sync
 *   bgp-bi --help
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execSync, spawnSync } = require('node:child_process');
const readline = require('node:readline');

const ROOT = process.cwd();
const TEMPLATE_REPO = 'git@github.com:BGPGO/bi-template.git';
const COOLIFY_HOST = process.env.COOLIFY_HOST || '187.77.238.125:8000';
const COOLIFY_TOKEN = process.env.COOLIFY_TOKEN || ''; // exigido em init/publish

const args = process.argv.slice(2);
const cmd = args[0] || '--help';

function flag(name, defVal) {
  const idx = args.indexOf('--' + name);
  if (idx === -1) return defVal;
  return args[idx + 1] || true;
}

function log(...m) { console.log(...m); }
function err(...m) { console.error('\x1b[31m✖\x1b[0m', ...m); }
function ok(...m) { console.log('\x1b[32m✓\x1b[0m', ...m); }
function info(...m) { console.log('\x1b[36mℹ\x1b[0m', ...m); }
function warn(...m) { console.warn('\x1b[33m⚠\x1b[0m', ...m); }

function ask(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(prompt, ans => { rl.close(); resolve(ans.trim()); }));
}

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: opts.silent ? 'pipe' : 'inherit', encoding: 'utf8', cwd: ROOT, ...opts });
}

function runSilent(cmd) {
  try { return execSync(cmd, { stdio: 'pipe', encoding: 'utf8', cwd: ROOT }).trim(); } catch (e) { return null; }
}

function loadConfig() {
  const cfgPath = path.join(ROOT, 'bi.config.js');
  if (!fs.existsSync(cfgPath)) {
    err('bi.config.js não encontrado. Rode `bgp-bi init` primeiro.');
    process.exit(1);
  }
  // Cache invalidate
  delete require.cache[require.resolve(cfgPath)];
  return require(cfgPath);
}

function saveConfig(cfg) {
  const cfgPath = path.join(ROOT, 'bi.config.js');
  const content = `// Configuração do cliente. Gerada por bgp-bi init / atualizada por bgp-bi sync.\nmodule.exports = ${JSON.stringify(cfg, null, 2)};\n`;
  fs.writeFileSync(cfgPath, content);
}

function templateVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    return pkg.templateVersion || '0.0.0';
  } catch { return '0.0.0'; }
}

// ============================================================
// init
// ============================================================
async function cmdInit() {
  log('\n\x1b[1m🚀 bgp-bi init — criar novo BI cliente\x1b[0m\n');

  const cfgPath = path.join(ROOT, 'bi.config.js');
  if (fs.existsSync(cfgPath)) {
    const overwrite = await ask('bi.config.js já existe. Sobrescrever? (s/N): ');
    if (overwrite.toLowerCase() !== 's') { info('cancelado'); process.exit(0); }
  }

  let cliente = flag('cliente') || await ask('Nome do cliente (ex: ACME Soluções): ');
  let subdomain = flag('subdomain') || await ask(`Subdomain pro Coolify (ex: acme-bi) [${cliente.toLowerCase().replace(/[^a-z0-9]/g, '-')}-bi]: `);
  if (!subdomain) subdomain = cliente.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-bi';
  const erp = flag('erp') || await ask('Fonte de dados (omie/conta-azul/manual) [omie]: ') || 'omie';
  const extrasArg = flag('extras') || await ask('Pages opcionais separadas por vírgula (faturamento,curva-abc,marketing-ads,crm-omie,valuation) [vazio]: ') || '';
  const extras = extrasArg ? extrasArg.split(',').map(s => s.trim()).filter(Boolean) : [];

  const cfg = {
    cliente: {
      nome: cliente,
      subdomain,
      coolify_app_uuid: '',
      cor_primaria: '#22d3ee',
    },
    fontes: {
      [erp]: erp === 'omie' ? {
        app_key_env: 'OMIE_APP_KEY',
        app_secret_env: 'OMIE_APP_SECRET',
        bancos_ok: [],
      } : {},
      drive: {
        base_path: '',
      },
    },
    pages: {
      geral: ['overview', 'receita', 'despesa', 'fluxo', 'tesouraria', 'comparativo', 'relatorio_ia', 'valuation'],
      outros: extras.map(e => e.replace('-', '_')),
    },
    meta: {
      ano_corrente: new Date().getFullYear(),
      metas_crm: { mes: 1_000_000, ano: 12_000_000 },
      valuation_premissas: { wacc: 25, growth_year2: 20, growth_year3: 20, ipca: 4.5, perpetuity_growth: 10 },
    },
    template: {
      version_when_created: templateVersion(),
      version_last_synced: templateVersion(),
    },
  };
  saveConfig(cfg);
  ok(`bi.config.js criado pra ${cliente}`);

  // .env
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) {
    let envContent = '# Credenciais — NÃO commitar\n';
    if (erp === 'omie') envContent += 'OMIE_APP_KEY=\nOMIE_APP_SECRET=\n';
    if (!process.env.COOLIFY_TOKEN) envContent += 'COOLIFY_TOKEN=\n';
    if (!process.env.ANTHROPIC_API_KEY) envContent += 'ANTHROPIC_API_KEY=\n';
    fs.writeFileSync(envPath, envContent);
    ok('.env criado — preencha as credenciais antes de buildar');
  }

  // Coolify provisioning (opcional)
  if (COOLIFY_TOKEN) {
    const provision = await ask('Provisionar app no Coolify agora? (S/n): ');
    if (provision.toLowerCase() !== 'n') {
      try {
        const repoUrl = runSilent('git config --get remote.origin.url');
        if (!repoUrl) {
          warn('Sem remote git origin. Defina antes: git remote add origin git@github.com:BGPGO/<repo>.git');
        } else {
          info('Provisionando app no Coolify...');
          // POST /applications — depende do esquema da API; placeholder pra preencher quando tiver
          warn('TODO: implementar POST /api/v1/applications/dockerfile');
        }
      } catch (e) {
        err('Falha ao provisionar Coolify:', e.message);
      }
    }
  } else {
    warn('COOLIFY_TOKEN não setado — pule provisionamento, faça depois manualmente ou no .env');
  }

  log('\n\x1b[1mPróximos passos:\x1b[0m');
  log('  1. Preencha .env com credenciais');
  log('  2. Configure paths do Drive em bi.config.js (fontes.drive.base_path)');
  log('  3. node bgp-bi.cjs build  (testa)');
  log('  4. node bgp-bi.cjs publish  (deploy)\n');
}

// ============================================================
// build
// ============================================================
function cmdBuild() {
  log('\n\x1b[1m🔨 bgp-bi build\x1b[0m\n');
  const cfg = loadConfig();
  const errors = [];
  const steps = [
    { name: 'data', script: 'build-data.cjs', required: true },
    { name: 'data-extras', script: 'build-data-extras.cjs', required: cfg.pages.outros.length > 0 },
    { name: 'jsx bundle', script: 'build-jsx.cjs', required: true },
  ];
  for (const step of steps) {
    if (!step.required) continue;
    if (!fs.existsSync(path.join(ROOT, step.script))) {
      warn(`${step.script} não existe, pulando`);
      continue;
    }
    info(`build: ${step.name}`);
    try {
      run(`node ${step.script}`);
      ok(`${step.name} OK`);
    } catch (e) {
      err(`${step.name} FAILED`);
      errors.push(step.name);
    }
  }

  // Smoke test bundle
  const bundlePath = path.join(ROOT, 'app.bundle.js');
  if (fs.existsSync(bundlePath)) {
    info('smoke test: parsing bundle');
    try {
      const code = fs.readFileSync(bundlePath, 'utf8');
      // eslint-disable-next-line no-new-func
      new Function(code);
      ok(`bundle parseia (${(code.length / 1024).toFixed(1)} KB)`);
    } catch (e) {
      err('bundle parse FAILED:', e.message);
      errors.push('bundle parse');
    }
  }

  // Smoke test runtime — eval com stub mínimo de React/window/document
  if (errors.length === 0 && fs.existsSync(path.join(ROOT, 'data.js')) && fs.existsSync(bundlePath)) {
    info('smoke test: runtime render');
    try {
      const stub = `
        const __React = {
          useState: i => [typeof i === 'function' ? i() : i, () => {}],
          useEffect: () => {}, useMemo: f => f(), useRef: i => ({ current: i }),
          useCallback: f => f, useLayoutEffect: () => {}, Fragment: 'F',
          createElement: (t, p, ...c) => typeof t === 'function' ? t(p || {}) : { t, p, c },
        };
        const __ReactDOM = { createRoot: () => ({ render: () => {} }) };
        global.window = {}; global.window.BIT_FILTER = 'realizado';
        global.document = { getElementById: () => ({}), body: { classList: { add: () => {}, remove: () => {} } }, querySelectorAll: () => [], fonts: { ready: Promise.resolve() } };
        global.localStorage = { getItem: () => null, setItem: () => {} };
        global.fetch = () => Promise.resolve({ ok: false, status: 404 });
        global.React = __React; global.ReactDOM = __ReactDOM;
        global.requestAnimationFrame = f => setTimeout(f, 0); global.cancelAnimationFrame = () => {};
      `;
      const dataJS = fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8');
      const extrasJS = fs.existsSync(path.join(ROOT, 'data-extras.js')) ? fs.readFileSync(path.join(ROOT, 'data-extras.js'), 'utf8') : '';
      const bundleJS = fs.readFileSync(bundlePath, 'utf8');
      const fnSrc = stub + dataJS + ';\n' + extrasJS + ';\n' + bundleJS;
      // eslint-disable-next-line no-new-func
      new Function(fnSrc)();
      ok('runtime render OK');
    } catch (e) {
      err('runtime render FAILED:', e.message.split('\n')[0]);
      errors.push('runtime render');
    }
  }

  if (errors.length > 0) {
    err(`Build falhou em: ${errors.join(', ')}`);
    process.exit(1);
  }
  ok('build completo. Pronto pra publish.');
}

// ============================================================
// publish
// ============================================================
async function cmdPublish() {
  log('\n\x1b[1m📤 bgp-bi publish\x1b[0m\n');
  cmdBuild();

  // Confirma se há diff
  const status = runSilent('git status --porcelain');
  if (!status) {
    info('Sem mudanças locais. Forçar deploy mesmo assim?');
    const force = await ask('(s/N): ');
    if (force.toLowerCase() !== 's') { info('cancelado'); return; }
  } else {
    log('\nArquivos modificados:');
    log(status);
    const msg = flag('m') || await ask('\nMensagem do commit [publish]: ') || 'publish';
    run('git add -A');
    run(`git commit -m "${msg.replace(/"/g, '\\"')}"`);
  }

  info('Push pro origin main');
  try { run('git push origin main'); } catch (e) { err('git push falhou'); process.exit(1); }

  // Trigger Coolify deploy
  const cfg = loadConfig();
  const uuid = cfg.cliente.coolify_app_uuid;
  if (!uuid) {
    warn('coolify_app_uuid não configurado em bi.config.js — pule deploy automático');
    return;
  }
  if (!COOLIFY_TOKEN) {
    warn('COOLIFY_TOKEN não setado — defina .env e re-publish');
    return;
  }

  info(`Trigger Coolify deploy (${uuid})`);
  try {
    const out = execSync(
      `curl -s -H "Authorization: Bearer ${COOLIFY_TOKEN}" "http://${COOLIFY_HOST}/api/v1/deploy?uuid=${uuid}&force=false"`,
      { encoding: 'utf8' }
    );
    const j = JSON.parse(out);
    const deployUuid = j.deployments && j.deployments[0] && j.deployments[0].deployment_uuid;
    ok(`deploy enfileirado: ${deployUuid}`);

    // Polling
    info('aguardando finished...');
    const start = Date.now();
    while (Date.now() - start < 180000) {
      await new Promise(r => setTimeout(r, 8000));
      const dOut = execSync(
        `curl -s -H "Authorization: Bearer ${COOLIFY_TOKEN}" "http://${COOLIFY_HOST}/api/v1/deployments/applications/${uuid}"`,
        { encoding: 'utf8' }
      );
      const dJ = JSON.parse(dOut);
      const last = dJ.deployments && dJ.deployments[0];
      if (!last) continue;
      process.stdout.write(`  status=${last.status} commit=${(last.commit || '').slice(0, 8)}\r`);
      if (last.status === 'finished') { log(); ok(`deploy OK em https://${cfg.cliente.subdomain}.${COOLIFY_HOST.split(':')[0]}.sslip.io`); return; }
      if (last.status === 'failed') { log(); err('deploy FAILED — verifique logs no Coolify'); return; }
    }
    warn('deploy ainda em andamento (timeout polling)');
  } catch (e) {
    err('falha no Coolify:', e.message);
  }
}

// ============================================================
// sync
// ============================================================
async function cmdSync() {
  log('\n\x1b[1m🔄 bgp-bi sync — atualizar do template\x1b[0m\n');

  // Garante remote 'template'
  let remotes = runSilent('git remote');
  if (!remotes || !remotes.includes('template')) {
    info('Adicionando remote template');
    try { run(`git remote add template ${TEMPLATE_REPO}`); } catch (e) {}
  }

  info('git fetch template main');
  run('git fetch template main', { silent: false });

  const localVersion = templateVersion();
  let templatePkg = '';
  try {
    templatePkg = runSilent('git show template/main:package.json');
  } catch (e) {
    err('falha ao ler package.json do template');
    process.exit(1);
  }
  let templateVer = '0.0.0';
  try { templateVer = JSON.parse(templatePkg).templateVersion || '0.0.0'; } catch {}

  log(`\n  Versão local:    ${localVersion}`);
  log(`  Versão template: ${templateVer}\n`);

  if (localVersion === templateVer) {
    ok('já está na última versão');
    return;
  }

  const commits = runSilent('git log HEAD..template/main --oneline');
  if (!commits) {
    info('sem commits novos no template');
    return;
  }
  log('Commits novos do template:');
  log(commits);
  log();
  const apply = await ask(`Aplicar via merge? (s/N): `);
  if (apply.toLowerCase() !== 's') { info('cancelado'); return; }

  try {
    run('git merge template/main --no-ff -m "sync template v' + templateVer + '"');
    // Atualiza bi.config.js com nova versão
    const cfg = loadConfig();
    cfg.template = cfg.template || {};
    cfg.template.version_last_synced = templateVer;
    saveConfig(cfg);
    run('git add bi.config.js');
    run('git commit -m "bump template version_last_synced to ' + templateVer + '" --allow-empty');
    ok(`sync OK pra ${templateVer}`);
    log('\nPróximo passo: rode `node bgp-bi.cjs build` pra validar e `publish` pra deploy.');
  } catch (e) {
    err('merge teve conflito. Resolva manualmente e commit.');
    process.exit(1);
  }
}

// ============================================================
// help
// ============================================================
function cmdHelp() {
  log(`
\x1b[1mbgp-bi\x1b[0m — CLI pra projetos de BI cliente standalone

Uso: node bgp-bi.cjs <comando> [opções]

Comandos:
  \x1b[36minit\x1b[0m       Setup inicial — cria bi.config.js, .env, provisiona Coolify
              --cliente "Nome"   --erp omie|conta-azul   --extras a,b,c

  \x1b[36mbuild\x1b[0m      Build local (data + extras + jsx) + smoke test obrigatório

  \x1b[36mpublish\x1b[0m    Build → commit → push → trigger Coolify → polling até OK
              -m "mensagem"

  \x1b[36msync\x1b[0m       Pull updates do bi-template (merge) — atualiza version_last_synced

  \x1b[36m--help\x1b[0m     Esta ajuda

Variáveis de ambiente:
  COOLIFY_HOST     ${COOLIFY_HOST}
  COOLIFY_TOKEN    ${COOLIFY_TOKEN ? '✓ definido' : '✗ não definido'}

Documentação completa:
  bi-blueprint/BLUEPRINT.md     arquitetura
  bi-blueprint/CHECKLIST.md     pre-flight de release
  bi-blueprint/ANTI_PATTERNS.md bugs reais a evitar
  bi-blueprint/MASSIFICATION.md sistema massificado (este CLI)
  ONBOARDING.md                 passo-a-passo pra funcionário novo
  COMMANDS.md                   cheatsheet de comandos
`);
}

// ============================================================
// dispatch
// ============================================================
(async () => {
  switch (cmd) {
    case 'init': await cmdInit(); break;
    case 'build': cmdBuild(); break;
    case 'publish': await cmdPublish(); break;
    case 'sync': await cmdSync(); break;
    case '--help':
    case '-h':
    case 'help':
    default: cmdHelp(); break;
  }
})();
