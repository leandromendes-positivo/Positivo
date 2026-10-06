// Rascunhos locais: nenhum e-mail é enviado nem provedor externo é aberto.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const pasta = 'capturas/email-cobranca'; fs.mkdirSync(pasta, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const erros = []; page.on('pageerror', e => erros.push(e.message));
  await page.addInitScript(() => { window.__CP_AGORA = '2026-10-05T09:00:00'; });
  await page.goto(process.env.URL_PAINEL_TESTE || 'http://127.0.0.1:8000/pagina-completa.html');
  await page.waitForFunction(() => E.status === 'pronto');
  assert.equal(await page.evaluate(() => Acesso.modo), 'memoria');
  await page.setInputFiles('#entrada-topo', fs.readdirSync('exemplos').filter(f => f.endsWith('.csv')).map(f => path.resolve('exemplos', f)));
  await page.waitForFunction(() => !!UI.im.resultado);
  const tid = await page.evaluate(() => derivar().itens.find(i => i.qtd === 2).tid);
  await page.evaluate(() => {
    window.__linksEmail = [];
    document.addEventListener('click', e => {
      const link = e.target.closest('#cob-email-link');
      if (link) { e.preventDefault(); if (link.hasAttribute('href')) window.__linksEmail.push(link.href); }
    });
    Acesso.usuario = { uid: 'operadora-teste', email: 'maria.silva@example.test' };
  });
  await page.evaluate(() => irPara('config'));
  await page.locator('[data-email-tecnico]').selectOption(tid);
  await page.locator('[data-acao="preparar-email"]').click();
  assert.equal(await page.locator('#cob-painel-email').isVisible(), true);
  await page.waitForFunction(() => document.activeElement.id === 'cob-email-para');
  assert.equal(await page.locator('#cob-email-para').inputValue(), '');
  assert.equal(await page.locator('#cob-email-link').getAttribute('href'), null, 'sem contato não abre rascunho sem destinatário');
  await page.locator('#cob-email-para').fill('invalido');
  await page.locator('#cob-email-link').click();
  assert.deepEqual(await page.evaluate(() => window.__linksEmail), []);
  // Editar contato não cria usuário, e o compositor aberto recebe o endereço novo.
  await page.locator('.modal [data-acao="editar-tecnico"]').click();
  await page.locator('#tec-form [name="email"]').fill('ana+campo@example.test');
  await page.locator('#tec-form [name="telefone"]').fill('41999999999');
  await page.locator('.modal').last().locator('[data-salvar]').click();
  await page.waitForFunction(() => document.querySelectorAll('.modal').length === 1);
  assert.equal(await page.evaluate(tid => derivar().mapa.get(tid).nome, tid), 'Ana Exemplo Costa', 'editar contato preserva o nome');
  assert.equal(await page.locator('#cob-email-para').inputValue(), 'invalido', 'não sobrescreve destinatário editado manualmente');
  await page.keyboard.press('Escape');
  await page.evaluate(tid => modalCobrar(tid, 'cobrar', derivar().mapa.get(tid).usadas, 'email'), tid);
  assert.equal(await page.locator('#cob-email-para').inputValue(), 'ana+campo@example.test');
  await page.evaluate(tid => salvarTecnico(tid, {email:'ana.atualizada@example.test'}), tid);
  assert.equal(await page.locator('#cob-email-para').inputValue(), 'ana.atualizada@example.test', 'atualiza contato quando o destinatário não foi editado');
  await page.evaluate(tid => salvarTecnico(tid, {email:'ana+campo@example.test'}), tid);
  assert.deepEqual(await page.evaluate(() => [E.usuarios.length, (Acesso.perfil || {}).email || null]), [0, null]);
  assert.equal(await page.evaluate(async () => (await Armazem.consultar('usuarios')).length), 0);
  const corpo = await page.locator('#cob-email-corpo').inputValue();
  assert.match(corpo, /Total: 3 peças/); assert.match(corpo, /Quantidade: 2/);
  assert.match(corpo, /Prazo de devolução: 7 dias/); assert.match(corpo, /Maria\nControle de Peças/);
  assert.match(corpo, /RESUMO DA SOLICITAÇÃO/); assert.match(corpo, /PEÇAS PARA DEVOLUÇÃO/);
  const original = { assunto: await page.locator('#cob-email-assunto').inputValue(), corpo };
  const prazoProprio = await page.evaluate(async tid => {
    await salvarTecnico(tid, {prazoUsadas:14});
    const t = derivar().mapa.get(tid), d = montarEmailCobranca(t, t.usadas);
    await salvarTecnico(tid, {prazoUsadas:null});
    return d.corpo;
  }, tid);
  assert.match(prazoProprio, /Prazo de devolução: 14 dias/);
  assert.match(prazoProprio, /Acima do prazo: 0/);
  await page.locator('#cob-email-link').click();
  let url = new URL((await page.evaluate(() => window.__linksEmail)).at(-1));
  assert.equal(url.origin, 'https://outlook.office.com');
  assert.equal(url.pathname, '/mail/deeplink/compose');
  assert.equal(url.searchParams.get('to'), 'ana+campo@example.test');
  assert.equal(url.searchParams.get('subject'), original.assunto); assert.equal(url.searchParams.get('body'), corpo);
  assert.equal(await page.evaluate(() => E.contatos.length), 0, 'abrir rascunho não registra envio');
  await page.locator('#cob-email-assunto').fill('Devolução — João & peças? revisão #2');
  await page.locator('#cob-email-corpo').fill('Olá!\n\nCódigo 000123 | Quantidade: 2\nAguardamos confirmação & previsão.');
  await page.locator('#cob-email-editor').selectOption('aplicativo');
  await page.locator('#cob-email-link').click();
  url = new URL((await page.evaluate(() => window.__linksEmail)).at(-1));
  assert.equal(url.protocol, 'mailto:'); assert.equal(decodeURIComponent(url.pathname), 'ana+campo@example.test');
  assert.equal(url.searchParams.get('subject'), 'Devolução — João & peças? revisão #2');
  assert.match(url.searchParams.get('body'), /Olá!\r\n\r\nCódigo 000123/);
  assert.equal(url.searchParams.has('bcc'), false);
  // Cabeçalhos maliciosos e endereços múltiplos não são aceitos pelos geradores.
  assert.equal(await page.evaluate(() => {
    const d = { destinatario:'ana@example.test', assunto:'Devolução', corpo:'Teste' };
    let recusados = 0;
    for (const alteracao of [{destinatario:'ana@example.test\r\nBcc:outro@example.test'}, {destinatario:'ana@example.test,outro@example.test'}, {assunto:'Assunto\r\nBcc:outro@example.test'}]) {
      for (const gerar of [x => linkEmailCobranca(x), rascunhoEmailCobranca]) try { gerar({...d,...alteracao}); } catch { recusados++; }
    }
    return recusados;
  }), 6);
  // A mensagem completa, inclusive depois da 15ª linha, fica no rascunho.
  const longo = await page.evaluate(tid => {
    const t = derivar().mapa.get(tid), base = t.usadas[0];
    return montarEmailCobranca(t, Array.from({length:80},(_,n) => ({...base, mat:`000${n}`, desc:`Peça fictícia ${n}`, qtd:2}))).corpo;
  }, tid);
  assert.match(longo, /80\. Peça fictícia 79/); assert.match(longo, /Total: 160 peças/);
  await page.locator('#cob-email-corpo').fill(longo + '\n\n<img src=x onerror="window.__emailXss=1">');
  await page.locator('#cob-email-editor').selectOption('outlook');
  assert.equal(await page.locator('#cob-email-link').getAttribute('href'), null);
  assert.match(await page.locator('[data-email-aviso]').innerText(), /Nenhuma peça foi removida/);
  await page.locator('.cobrar-formatado summary').click();
  assert.equal(await page.locator('[data-email-previa] img').count(), 0, 'prévia escapa conteúdo HTML');
  const download = page.waitForEvent('download');
  await page.locator('[data-baixar-email]').click();
  await (await download).saveAs(`${pasta}/cobranca.eml`);
  const mime = JSON.parse(execFileSync('python3', ['-c', `import json,sys\nfrom email import policy\nfrom email.parser import BytesParser\nm=BytesParser(policy=policy.default).parse(open(sys.argv[1],'rb'))\nprint(json.dumps({'to':str(m['To']),'subject':str(m['Subject']),'draft':str(m['X-Unsent']),'plain':m.get_body(('plain',)).get_content(),'html':m.get_body(('html',)).get_content()}))`, `${pasta}/cobranca.eml`], {encoding:'utf8'}));
  assert.equal(mime.to, 'ana+campo@example.test'); assert.equal(mime.draft, '1');
  assert.equal(mime.subject, 'Devolução — João & peças? revisão #2'); assert.match(mime.plain, /80\. Peça fictícia 79/);
  assert.match(mime.html, /POSITIVO/); assert.match(mime.html, /&lt;img/); assert.equal(mime.html.includes('<img src=x'), false);
  await page.locator('#cob-email-corpo').fill(original.corpo); await page.locator('#cob-email-assunto').fill(original.assunto);
  await page.locator('#cob-email-corpo').evaluate(el => el.scrollTop = 0);
  await page.locator('.cobrar-formatado summary').click();
  for (const tema of ['dark','light']) {
    await page.evaluate(tema => document.documentElement.dataset.theme = tema, tema);
    for (const [width,height] of [[1440,1000],[768,1024],[390,844],[320,568],[844,390]]) {
      await page.setViewportSize({width,height});
      assert.equal(await page.locator('.modal-corpo').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true, `sem corte: ${tema}/${width}`);
      assert.equal(await page.locator('.modal').evaluate(el => {const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1;}), true);
      await page.locator('#cob-email-link').scrollIntoViewIfNeeded();
      assert.equal(await page.locator('#cob-email-link').evaluate(el => el.scrollWidth<=el.clientWidth+1), true);
      await page.locator('.modal-corpo').evaluate(el => el.scrollTop = 0);
      await page.screenshot({path:`${pasta}/outlook-${tema}-${width}.png`});
    }
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('[data-registrar]').click();
  await page.waitForFunction(() => !document.querySelector('.modal'));
  assert.equal(await page.evaluate(() => E.contatos.at(-1).canal), 'email');
  assert.equal(await page.evaluate(() => E.contatos.at(-1).email), 'maria.silva@example.test', 'autoria é do operador, não do destinatário');
  assert.equal(await page.evaluate(() => E.usuarios.length), 0);
  await page.evaluate(tid => { modalCobrar(tid, 'vencendo', derivar().mapa.get(tid).usadas, 'email'); }, tid);
  assert.match(await page.locator('#cob-email-assunto').inputValue(), /Programação de devolução/);
  assert.deepEqual(await page.locator('#cob-email-editor option').allTextContents(), ['Outlook na Web (Microsoft 365)','Outlook instalado (aplicativo padrão)']);
  await page.keyboard.press('Escape');
  // A abertura tardia do foco não pode redirecionar a digitação para o apelido.
  assert.equal(await page.evaluate(async tid => {
    modalTecnico(tid);
    document.querySelector('#tec-form [name="telefone"]').focus();
    await new Promise(resolve => setTimeout(resolve, 60));
    return document.activeElement.name;
  }, tid), 'telefone');
  await page.keyboard.press('Escape');
  assert.deepEqual(erros, []);
  console.log('PASSOU: Outlook Web/aplicativo, conteúdo e destinatário preenchidos, edição, acentos, códigos, quantidades, lembrete, limites sem truncar, .eml com HTML seguro, contato sem usuário, autoria, registro explícito, ambos os temas e 320–1440px.');
} finally { await browser.close(); }
