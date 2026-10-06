// OAuth e Graph interceptados: nenhum rascunho real é criado, nenhum e-mail é enviado.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const erros = [], pedidos = []; page.on('pageerror', e => erros.push(e.message));
  let statusGraph = 201, linkGraph = 'https://outlook.office365.com/owa/?ItemID=rascunho-teste&viewmodel=ReadMessageItem', redeFalha = false;
  await page.route('https://graph.microsoft.com/**', async route => {
    const req = route.request();
    pedidos.push({url:req.url(), method:req.method(), headers:req.headers(), body:req.method()==='POST' ? req.postDataJSON() : null});
    if (req.method() === 'GET') return route.fulfill({json:{mail:'maria@empresa.example.test',userPrincipalName:'maria@tenant.example.test'}});
    if (redeFalha) return route.abort('failed');
    // Retardo também verifica que cliques repetidos não duplicam o POST.
    await new Promise(r => setTimeout(r, 100));
    await route.fulfill({status:statusGraph,json:statusGraph===201 ? {id:'id-teste',isDraft:true,webLink:linkGraph} : {error:{message:'detalhe interno não deve aparecer'}}});
  });
  await page.goto(process.env.URL_PAINEL_TESTE || 'http://127.0.0.1:8000/pagina-completa.html');
  await page.waitForFunction(() => E.status === 'pronto');
  assert.equal(await page.evaluate(() => Acesso.modo), 'memoria', 'usar apenas a fixture sem Firebase real');
  await page.setInputFiles('#entrada-topo', fs.readdirSync('exemplos').filter(f => f.endsWith('.csv')).map(f => path.resolve('exemplos', f)));
  await page.waitForFunction(() => !!UI.im.resultado);
  const tid = await page.evaluate(async () => {
    const t = derivar().tecnicos.find(t=>t.usadas.length);
    await salvarTecnico(t.tid, {email:'tecnico+campo@example.test'});
    return t.tid;
  });
  await page.evaluate(tid => modalCobrar(tid, 'cobrar', derivar().mapa.get(tid).usadas, 'email'), tid);
  assert.equal(await page.locator('#cob-email-editor').inputValue(), 'formatado');
  assert.equal(await page.locator('#cob-email-link').isVisible(), false);
  assert.equal(await page.locator('[data-outlook-abrir]').isDisabled(), true);
  await page.locator('[data-outlook-conectar]').click();
  await page.waitForFunction(() => document.querySelector('[data-outlook-status]').dataset.estado === 'erro');
  assert.match(await page.locator('[data-outlook-status]').innerText(), /acesso autorizado/);
  assert.equal(pedidos.length, 0);
  // Mock do SDK auxiliar: a sessão principal não pode ser autenticada, vinculada ou encerrada.
  await page.evaluate(() => {
    window.__oauth = {scopes:[], params:null, persistencia:null, principalAlterada:0, saiu:0, excluiu:0, codigo:'', apps:[]};
    Acesso.modo = 'firebase';
    Acesso.usuario = {uid:'operadora-google',email:'maria.silva@gmail.example.test'};
    Acesso.perfil = {ativo:true,perfil:'usuario'};
    Acesso.auth = { currentUser:{uid:'operadora-google'}, signOut:()=>{window.__oauth.principalAlterada++;} };
    window.CP_FIREBASE = {apiKey:'config-ficticia',projectId:'teste-local'};
    function auth() {}
    auth.Auth = {Persistence:{NONE:'NONE'}};
    auth.OAuthProvider = class {
      constructor(id) { window.__oauth.provedor = id; window.__oauth.scopes = []; }
      setCustomParameters(p) { window.__oauth.params=p; }
      addScope(s) { window.__oauth.scopes.push(s); }
    };
    window.firebase = {auth, initializeApp:(cfg,nome)=>{
      window.__oauth.apps.push(nome);
      const auxiliar={
        setPersistence:async valor=>{window.__oauth.persistencia=valor;},
        signInWithPopup:async()=>{
          const credential={accessToken:'token-ficticio-somente-teste'};
          if (window.__oauth.codigo) throw Object.assign(new Error('não expor detalhe técnico'),{code:window.__oauth.codigo,credential});
          return {credential,user:{email:'maria@empresa.example.test'}};
        },
        signOut:async()=>{window.__oauth.saiu++;}
      };
      return {auth:()=>auxiliar,delete:async()=>{window.__oauth.excluiu++;}};
    }};
    window.__janelas = [];
    window.open = (url, alvo) => {
      if (window.__popupBloqueado) return null;
      const janela = {url,alvo,closed:false,opener:'ainda-aberto',document:{title:'',body:{textContent:''}},location:{replace:v=>{janela.destino=v;}},close:()=>{janela.closed=true;}};
      window.__janelas.push(janela); return janela;
    };
  });
  const conectar = async () => {
    await page.locator('[data-outlook-conectar]').click();
    await page.waitForFunction(() => !document.querySelector('[data-outlook-abrir]').disabled);
  };
  await conectar();
  assert.match(await page.locator('[data-outlook-conta]').innerText(), /maria@empresa.example.test/);
  const oauth = await page.evaluate(() => window.__oauth);
  assert.deepEqual(oauth.scopes, ['User.Read','Mail.ReadWrite']);
  assert.deepEqual(oauth.params, {tenant:'common',prompt:'select_account'}, 'destinatário nunca é sugerido para autenticação');
  assert.equal(oauth.persistencia, 'NONE'); assert.equal(oauth.provedor, 'microsoft.com');
  assert.equal(oauth.saiu, 1); assert.equal(oauth.excluiu, 1); assert.equal(oauth.principalAlterada, 0);
  assert.notEqual(oauth.apps[0], '[DEFAULT]');
  assert.equal(pedidos.length, 1); assert.match(pedidos[0].url, /\/me\?\$select=mail,userPrincipalName/);
  const postagens = () => pedidos.filter(p=>p.method==='POST');
  const criar = async (erro=false) => {
    await page.locator('[data-outlook-abrir]').click();
    await page.waitForFunction(erro => {
      const estado=document.querySelector('[data-outlook-status]');
      return estado.dataset.estado === (erro ? 'erro' : 'ok') && !estado.textContent.includes('Criando') && !document.querySelector('[data-outlook-conectar]').disabled;
    }, erro);
  };
  await page.locator('[data-outlook-abrir]').click();
  await page.locator('[data-outlook-abrir]').evaluate(el=>el.click());
  await page.waitForFunction(() => document.querySelector('[data-outlook-status]').textContent.includes('Rascunho aberto'));
  assert.equal(postagens().length, 1);
  const d = await page.evaluate(() => ({destinatario:document.querySelector('#cob-email-para').value,assunto:document.querySelector('#cob-email-assunto').value,corpo:document.querySelector('#cob-email-corpo').value}));
  assert.equal(postagens()[0].body.subject, 'Devolução de peças');
  assert.deepEqual(postagens()[0].body.toRecipients, [{emailAddress:{address:'tecnico+campo@example.test'}}]);
  assert.equal(postagens()[0].body.body.contentType, 'HTML');
  assert.equal(postagens()[0].body.body.content, await page.evaluate(d=>htmlEmailCobranca(d),d));
  assert.equal(await page.evaluate(() => document.querySelector('[data-email-previa]').innerHTML), await page.evaluate(html=>{const e=document.createElement('div');e.innerHTML=html;return e.innerHTML;},postagens()[0].body.body.content));
  assert.doesNotMatch(postagens()[0].body.body.content, /maria|Se alguma peça já foi devolvida|Controle de Peças<br>Positivo Tecnologia/i);
  assert.equal(postagens()[0].headers.authorization, 'Bearer token-ficticio-somente-teste');
  assert.equal(await page.evaluate(() => window.__janelas[0].destino), linkGraph);
  assert.equal(await page.evaluate(() => window.__janelas[0].opener), null);
  await criar(); assert.equal(postagens().length, 1, 'reabre sem duplicar');
  assert.equal(await page.evaluate(() => E.contatos.length), 0, 'criar rascunho não confirma cobrança');
  // Mensagem grande: nenhum limite de URL, nenhum item descartado, sem HTML executável.
  const longo = await page.evaluate(tid=>{
    const t=derivar().mapa.get(tid),base=t.usadas[0];
    return montarEmailCobranca(t,Array.from({length:80},(_,n)=>({...base,mat:`000${n}`,desc:`Peça C++ ${n}`,qtd:2}))).corpo;
  },tid);
  await page.locator('#cob-email-corpo').fill(longo+'\n\n<img src=x onerror="window.__xss=1">');
  await page.locator('#cob-email-assunto').fill('Devolução de peças — revisão');
  assert.equal(await page.locator('[data-outlook-reabrir]').isVisible(), false, 'edição invalida link anterior');
  await criar(); assert.equal(postagens().length, 2);
  assert.match(postagens()[1].body.body.content, /80\. Peça C\+\+ 79/);
  assert.match(postagens()[1].body.body.content, /&lt;img/);
  assert.equal(await page.locator('[data-email-previa] img').count(), 0);
  // Popup bloqueado mantém um link seguro para o rascunho completo, sem refazer a criação.
  await page.evaluate(()=>window.__popupBloqueado=true);
  await criar(); assert.equal(postagens().length, 2);
  assert.match(await page.locator('[data-outlook-status]').innerText(), /bloqueou a nova aba/);
  assert.equal(await page.locator('[data-outlook-reabrir]').getAttribute('href'), linkGraph);
  await page.evaluate(()=>window.__popupBloqueado=false);
  // Recusa do tenant, expiração e falha incerta de rede jamais resultam em sucesso falso.
  await page.locator('#cob-email-corpo').fill('Mensagem revisada');
  statusGraph = 403; await criar(true);
  assert.match(await page.locator('[data-outlook-status]').innerText(), /aprovação da TI/);
  assert.equal(await page.locator('[data-outlook-reabrir]').isVisible(), false);
  statusGraph = 401; await criar(true);
  assert.match(await page.locator('[data-outlook-status]').innerText(), /expirou/);
  assert.equal(await page.locator('[data-outlook-abrir]').isDisabled(), true);
  await conectar();
  redeFalha = true; const antesFalha=postagens().length; await criar(true);
  assert.equal(postagens().length, antesFalha+1, 'não repete POST automaticamente em falha incerta');
  assert.match(await page.locator('[data-outlook-status]').innerText(), /Confira a pasta Rascunhos/);
  redeFalha = false; statusGraph = 201; linkGraph = 'https://outlook.office.com.evil.example/rascunho';
  await criar(true);
  assert.match(await page.locator('[data-outlook-status]').innerText(), /endereço inesperado/);
  assert.equal(await page.evaluate(()=>window.__janelas.at(-1).closed),true);
  // Mesmo e-mail já autenticado pelo Google: não vincula contas nem troca o usuário do painel.
  await page.locator('[data-outlook-desconectar]').click();
  await page.evaluate(()=>window.__oauth.codigo='auth/account-exists-with-different-credential');
  await conectar();
  assert.equal(await page.evaluate(()=>Acesso.usuario.uid),'operadora-google');
  assert.equal(await page.evaluate(()=>window.__oauth.principalAlterada),0);
  await page.locator('[data-outlook-desconectar]').click();
  await page.evaluate(()=>window.__oauth.codigo='auth/popup-closed-by-user');
  await page.locator('[data-outlook-conectar]').click();
  await page.waitForFunction(()=>document.querySelector('[data-outlook-status]').dataset.estado==='erro');
  assert.match(await page.locator('[data-outlook-status]').innerText(), /cancelada/);
  assert.equal(await page.locator('[data-outlook-abrir]').isDisabled(),true);
  await page.evaluate(()=>window.__oauth.codigo=''); await conectar();
  // Dois temas e telas estreitas com o novo fluxo visível.
  fs.mkdirSync('capturas/outlook-formatado',{recursive:true});
  for (const tema of ['dark','light']) for (const width of [1440,768,390,320]) {
    await page.evaluate(t=>document.documentElement.dataset.theme=t,tema);
    await page.setViewportSize({width,height:900});
    assert.equal(await page.locator('.modal-corpo').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,`${tema}/${width}`);
    await page.locator('[data-outlook-painel]').scrollIntoViewIfNeeded();
    assert.equal(await page.locator('[data-outlook-abrir]').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);
    await page.screenshot({path:`capturas/outlook-formatado/${tema}-${width}.png`});
  }
  // Nenhuma credencial persistida, usuário de contato cadastrado ou registro automático.
  assert.deepEqual(await page.evaluate(()=>[E.usuarios.length,E.contatos.length]),[0,0]);
  assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}).includes('token-ficticio')),false);
  assert.equal(pedidos.every(p=>p.method==='GET'||(p.method==='POST'&&p.url.endsWith('/me/messages'))),true);
  const antesRevogacao=pedidos.length;
  assert.match(await page.evaluate(async d=>{
    Acesso.perfil=null;
    try { await OutlookCobranca.criar(d); return 'não bloqueou'; } catch(e) { return e.message; }
  },d),/acesso autorizado/);
  assert.equal(pedidos.length,antesRevogacao);
  assert.equal(await page.evaluate(()=>OutlookCobranca.conta()),'');
  assert.deepEqual(erros,[]);
  console.log('PASSOU: rascunho HTML idêntico à prévia, OAuth separado, permissões mínimas sem envio, assinatura removida, assunto, sem duplicação/truncamento, falhas/expiração/contas/popup, escape HTML, contatos separados e responsividade.');
} finally { await browser.close(); }
