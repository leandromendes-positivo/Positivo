// Escopo pessoal das notificações com autorias distintas; fixture local, sem mensagens externas.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PW_PATH || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const erros = []; page.on('pageerror', e => erros.push(e.message));
  await page.addInitScript(() => { window.__CP_AGORA = '2026-10-09T12:00:00'; });
  await page.goto(process.env.URL_PAINEL_TESTE || 'http://127.0.0.1:8000/pagina-completa.html');
  await page.waitForFunction(() => E.status === 'pronto');
  assert.equal(await page.evaluate(() => Acesso.modo), 'memoria');
  await page.evaluate(() => {
    E.cadastro = {}; E.usadas = []; E.contatos = []; E.agendamentos = []; E.acompLegado = {};
    const nomes = ['Ana Própria','Bruno Outro','Carla Própria','Diego Outro','Emma Própria','Fabio Outro','Gabi Própria','Heitor Outro'];
    nomes.forEach((nome, n) => {
      const tid = 't'+n, k = 'p'+n, uid = n % 2 ? 'outro' : 'operador', qtd = n+1, id = 'c'+n;
      E.cadastro[tid] = { nome, regiao:'PR', tipo:'tecnico', email:'tecnico'+n+'@example.test' };
      E.usadas.push({ k,tid,regiao:'PR',mat:k,qtd,dataFT:'2026-09-29',desde:'2026-09-29',chamado:k });
      E.contatos.push({ id,tid,uid,email:uid+'@example.test',canal:n>=6?'whatsapp':'email',previsao:'',obs:'',pecas:qtd,itens:[k],tipo:'usadas',detalhes:[{k,tipo:'usadas',mat:k,qtd}],referencia:{dataReferencia:'2026-10-08',lotesReferencia:[]},em:'2026-10-08 09:00' });
      if (n < 4) E.agendamentos.push({ peca:k,tid,uid,email:uid+'@example.test',previsao:n<2?'2026-10-08':'2026-10-10',versao:1,em:'2026-10-08 10:00',confirmacao:{tipo:'usadas',mat:k,regiao:'PR',quantidade:qtd,qtdRmdf:0,contatoId:id,referenciaEmail:'Resposta formal '+nome,observacao:'',dataReferencia:'2026-10-08',lotesReferencia:[]} });
    });
    E.novas = [{tid:'t0',regiao:'PR',mat:'N',qtd:12,tipoEnvio:'Padrão',desde:'2026-10-08'}];
    E.indice.arquivos = {'usadas:PR':{em:'2026-10-08 08:00'},'novas:PR':{em:'2026-10-08 08:00'}};
    combinarAcompanhamento();
    Acesso.modo = 'firebase'; Acesso.projeto = 'notificacoes-fixture';
    Acesso.usuario = {uid:'operador',email:'operador@example.test',nome:'Operador'};
    Acesso.perfil = {ativo:true,perfil:'usuario'}; mudou(); irPara('cobrancas');
  });
  const sino = page.locator('#botao-notificacoes');
  await sino.click();
  assert.equal(await page.locator('[data-notif-id="planilhas"]').count(), 0);
  assert.equal(await page.locator('[data-notif-id="sem_contato"]').count(), 0);
  assert.match(await page.locator('[data-notif-id="previsoes"]').innerText(), /1 peça continua/);
  assert.match(await page.locator('[data-notif-id="respostas_confirmadas"]').innerText(), /3 peças com previsão/);
  assert.match(await page.locator('[data-notif-id="respostas_pendentes"]').innerText(), /5 peças aguardam/);
  assert.equal(await page.locator('[data-notif-id="estoque"]').count(), 1, 'estoque é área permitida para consulta');
  assert.doesNotMatch(await page.locator('[data-notif-lista]').innerText(), /Bruno|Diego|Fabio|Heitor/);
  assert.equal(await sino.locator('[data-notif-contador]').innerText(), '5');
  await page.locator('[data-notif-destino="previsoes"]').click();
  assert.equal(await page.evaluate(() => UI.cob.somenteMeus), true);
  assert.equal(await page.locator('.lista-cob .cob').count(), 1);
  assert.equal(await page.locator('.lista-cob .cob').getAttribute('data-tid'), 't0');
  await sino.click(); await page.locator('[data-notif-destino="respostas_pendentes"]').click();
  assert.equal(await page.locator('.resposta-cartao').count(), 1);
  assert.match(await page.locator('.resposta-cartao').innerText(), /Emma/);
  await sino.click(); await page.locator('[data-notif-destino="respostas_confirmadas"]').click();
  assert.equal(await page.locator('.resposta-cartao').count(), 1);
  assert.match(await page.locator('.resposta-cartao').innerText(), /Carla/);
  await page.locator('[data-acao="limpar-meus-registros"]').click();
  assert.equal(await page.locator('.resposta-cartao').count(), 2, 'consulta geral permitida continua disponível');
  // Promoção e rebaixamento atualizam a janela aberta sem reutilizar os totais de administrador.
  await sino.click();
  await page.evaluate(() => { Acesso.perfil.perfil = 'administrador'; mudou(); });
  assert.equal(await page.locator('[data-notif-id="planilhas"]').count(), 1);
  assert.match(await page.locator('[data-notif-id="previsoes"]').innerText(), /3 peças continuam/);
  assert.match(await page.locator('[data-notif-id="respostas_confirmadas"]').innerText(), /7 peças com previsão/);
  assert.match(await page.locator('[data-notif-id="respostas_pendentes"]').innerText(), /11 peças aguardam/);
  await page.evaluate(() => { Acesso.perfil.perfil = 'usuario'; mudou(); });
  assert.equal(await page.locator('[data-notif-id="planilhas"]').count(), 0);
  assert.doesNotMatch(await page.locator('[data-notif-lista]').innerText(), /Bruno|Diego|Fabio|Heitor/);
  // Autoria desconhecida não deve ser atribuída ao usuário pelo destinatário/e-mail do técnico.
  await page.evaluate(() => { E.agendamentos.find(a => a.peca === 'p0').uid = ''; combinarAcompanhamento(); mudou(); });
  assert.equal(await page.locator('[data-notif-id="previsoes"]').count(), 0);
  await page.keyboard.press('Escape');
  await page.evaluate(() => { Acesso.usuario = {uid:'outro',email:'outro@example.test',nome:'Outro'}; mudou(); });
  await sino.click();
  assert.match(await page.locator('[data-notif-id="previsoes"]').innerText(), /2 peças continuam/);
  assert.match(await page.locator('[data-notif-id="respostas_confirmadas"]').innerText(), /4 peças com previsão/);
  assert.match(await page.locator('[data-notif-id="respostas_pendentes"]').innerText(), /6 peças aguardam/);
  await page.evaluate(() => { Acesso.perfil.ativo = false; mudou(); });
  assert.equal(await page.locator('.modal.notificacoes').count(), 0);
  assert.equal(await sino.isVisible(), false);
  assert.deepEqual(await page.evaluate(() => alertasOperacionais()), []);
  assert.deepEqual(erros, []);
  console.log('PASSOU: administradores globais; usuários com notificações, totais e atalhos por autoria; estoque permitido; promoção, rebaixamento, troca de conta e revogação.');
} finally { await browser.close(); }
