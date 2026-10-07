// Central de notificações: exclusivamente dados fictícios em memória.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || 'playwright');
const browser = await chromium.launch({executablePath:process.env.CHROMIUM || undefined});
try {
  const page = await browser.newPage({viewport:{width:1440,height:1000},timezoneId:'America/Sao_Paulo',reducedMotion:'reduce'});
  const erros=[];page.on('pageerror',e=>erros.push(e.message));
  await page.addInitScript(()=>{window.__CP_AGORA='2026-10-07T12:00:00-03:00';});
  await page.goto(process.env.URL_PAINEL_TESTE || 'http://127.0.0.1:8000/pagina-completa.html');
  await page.waitForFunction(()=>E.status==='pronto');
  assert.equal(await page.evaluate(()=>Acesso.modo),'memoria');
  const sino=page.locator('#botao-notificacoes'), abrir=async()=>{await sino.click();await page.locator('.modal.notificacoes').waitFor();};
  await abrir(); assert.match(await page.locator('[data-notif-lista]').innerText(),/Importe as planilhas/);
  await page.keyboard.press('Escape');
  await page.evaluate(()=>{
    // Datas, quantidades e contatos distintos para evitar testes que só espelham o código.
    E.config={...PADROES,meta:10};
    E.cadastro={
      ana:{nome:'Ana Exemplo',regiao:'PR',meta:7,telefone:'',email:''},
      bruno:{nome:'Bruno Exemplo',regiao:'PR',email:'bruno@example.test'},
      caio:{nome:'Caio Exemplo',regiao:'PR',telefone:'(41) 99999-9999'},
      base:{nome:'Base Exemplo',tipo:'base',regiao:'PR'},
      ignorado:{nome:'Ignorado Exemplo',tipo:'ignorar',regiao:'PR'},
    };
    const usada=(k,tid,qtd=1)=>({k,tid,regiao:'PR',mat:'000123',qtd,dataFT:'2026-09-20',desde:'2026-09-20',chamado:k});
    E.usadas=[usada('a1','ana',2),usada('a2','ana'),usada('b1','bruno',3),usada('c1','caio'),usada('c2','caio'),usada('d1','base'),usada('i1','ignorado')];
    const nova=(tid,qtd)=>({tid,regiao:'PR',mat:'000123',qtd,tipoEnvio:'Padrão',desde:'2026-10-05',linhas:1});
    E.novas=[nova('ana',11),nova('bruno',10),nova('caio',3),nova('base',50),nova('ignorado',50)];
    E.indice.arquivos={'usadas:PR':{em:'2026-10-06 08:00',arquivo:'PR Usadas.csv'},'novas:PR':{em:'2026-10-07 08:00',arquivo:'PR Novas.csv'}};
    E.acomp={
      ana:{itens:{a1:{uc:'2026-10-05 10:00',c:1},a2:{uc:'2026-10-07 09:00',c:1}},cobrancas:[{em:'2026-10-07 09:00',canal:'email'}]},
      bruno:{itens:{b1:{p:'2026-10-06',uc:'2026-10-05 10:00',c:1}},cobrancas:[]},
      caio:{itens:{c1:{uc:'2026-10-06 10:00',c:1},c2:{p:'2026-10-08',uc:'2026-10-05 10:00',c:1}},cobrancas:[]},
      base:{itens:{d1:{uc:'2026-10-05 10:00',c:1}},cobrancas:[]},
    };
    mudou();irPara('cobrancas');
  });
  assert.equal(await sino.locator('[data-notif-contador]').innerText(),'5');
  await abrir();
  assert.equal(await page.locator('.notif-item').count(),5);
  assert.equal(await page.locator('.notif-item').first().getAttribute('data-notif-id'),'planilhas');
  assert.match(await page.locator('[data-notif-id="sem_previsao"]').innerText(),/1 técnico tem/);
  assert.match(await page.locator('[data-notif-id="sem_contato"]').innerText(),/1 técnico na fila/);
  assert.match(await page.locator('[data-notif-id="estoque"]').innerText(),/4 peças excedentes/);
  assert.match(await page.locator('[data-notif-id="previsoes"]').innerText(),/3 peças continuam/);
  assert.equal(await page.locator('[data-notif-id="sem_previsao"] li').textContent(),'Ana Exemplo · PR · 2 peças sem previsão');
  // Marcar leitura não registra contato nem modifica previsão/estoque.
  const antes=await page.evaluate(()=>JSON.stringify([E.acomp,E.usadas,E.novas,E.contatos,E.usuarios]));
  await page.locator('[data-notif-leitura="sem_previsao"]').click();
  assert.equal(await page.locator('[data-notif-id="sem_previsao"]').getAttribute('class'),'notif-item lida');
  assert.equal(await page.evaluate(()=>JSON.stringify([E.acomp,E.usadas,E.novas,E.contatos,E.usuarios])),antes);
  const chave=await page.evaluate(()=>Object.keys(localStorage).find(k=>k.startsWith('cp-notificacoes-v1-')));
  const leitura=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),chave);
  assert.deepEqual(Object.keys(leitura),['sem_previsao']);
  assert.doesNotMatch(JSON.stringify(leitura),/Ana|example|token|email/i);
  await page.locator('[data-notif-filtro="nao-lidas"]').click();
  assert.equal(await page.locator('.notif-item').count(),4);
  await page.locator('[data-notif-todas-lidas]').click();
  assert.match(await page.locator('[data-notif-lista]').innerText(),/Você leu todos/);
  await page.keyboard.press('Escape');
  assert.equal(await sino.evaluate(e=>e===document.activeElement),true,'Escape devolve o foco ao sino');
  assert.equal(await sino.locator('[data-notif-contador]').isVisible(),false);
  await abrir();assert.equal(await page.locator('.notif-item.lida').count(),5,'abrir a central preserva as leituras');
  // Filtro abre a lista certa, descarta busca/UF anteriores e respeita leitura individual.
  await page.evaluate(()=>Object.assign(UI.cob,{busca:'outro',regiao:'SC'}));
  await page.locator('[data-notif-destino="sem_previsao"]').click();
  assert.equal(await page.locator('.modal').count(),0);
  assert.equal(await page.locator('.lista-cob .cob').count(),1);
  assert.equal(await page.locator('.lista-cob .cob').getAttribute('data-tid'),'ana');
  assert.match(await page.locator('.notif-filtro-cobranca').innerText(),/2 dias/);
  assert.doesNotMatch(await page.evaluate(()=>resumoTexto()),/Bruno|Caio|Base/);
  await page.evaluate(async()=>{
    const original=exportarExcel;
    exportarExcel=async(nome,abas)=>{window.__exportacao=abas[0].linhas;};
    try{await exportarCobrancas();}finally{exportarExcel=original;}
  });
  assert.equal(await page.evaluate(()=>window.__exportacao.every(l=>l[0]==='Ana Exemplo')),true);
  await page.locator('[data-acao="limpar-foco-cobranca"]').click();
  assert.ok(await page.locator('.lista-cob .cob').count()>1);
  // Uma alteração relevante volta a ser não lida, sem duplicar a categoria.
  await page.evaluate(()=>{E.novas.find(n=>n.tid==='ana').qtd=12;mudou();});
  assert.equal(await sino.locator('[data-notif-contador]').innerText(),'1');
  await abrir();
  assert.equal(await page.locator('.notif-item.nao-lida').count(),1);
  assert.equal(await page.locator('.notif-item.nao-lida').getAttribute('data-notif-id'),'estoque');
  await page.locator('[data-notif-destino="estoque"]').click();
  assert.deepEqual(await page.evaluate(()=>[UI.pagina,UI.es.status,UI.es.busca,UI.es.bases]),['estoque','acima','',false]);
  // Resolver a pendência remove o alerta, incluindo limite exato e estoque inferior.
  await page.evaluate(()=>{E.novas.find(n=>n.tid==='ana').qtd=7;mudou();});
  await abrir();assert.equal(await page.locator('[data-notif-id="estoque"]').count(),0);
  await page.evaluate(()=>{E.novas.find(n=>n.tid==='ana').qtd=0;mudou();});
  assert.equal(await page.locator('[data-notif-id="estoque"]').count(),0);
  await page.evaluate(()=>{E.novas.find(n=>n.tid==='ana').qtd=11;mudou();});
  assert.equal(await page.locator('[data-notif-id="estoque"].nao-lida').count(),1,'reincidência é notificada');
  // A central aberta acompanha mudanças sem roubar foco ou fechar os detalhes.
  await page.locator('[data-notif-detalhes="sem_previsao"] summary').click();
  await page.locator('[data-notif-leitura="sem_previsao"]').focus();
  await page.evaluate(()=>{E.novas.find(n=>n.tid==='ana').qtd=12;mudou();});
  assert.equal(await page.locator('[data-notif-detalhes="sem_previsao"]').getAttribute('open'),'');
  assert.equal(await page.locator('[data-notif-leitura="sem_previsao"]').evaluate(e=>e===document.activeElement),true);
  // Prévia para amanhã remove o alerta de retorno; bases, ignorados e cobranças de ontem não entram.
  await page.evaluate(()=>{E.acomp.ana.itens.a1.p='2026-10-08';mudou();});
  assert.equal(await page.locator('[data-notif-id="sem_previsao"]').count(),0);
  await page.evaluate(()=>{E.acomp.ana.itens.a1.p='';E.acomp.ana.itens.a1.uc='2026-10-06 10:00';mudou();});
  assert.equal(await page.locator('[data-notif-id="sem_previsao"]').count(),0);
  // Virada de data: o alerta aparece sem nova importação.
  await page.evaluate(()=>{window.__CP_AGORA='2026-10-08T12:00:00-03:00';mudou();});
  assert.equal(await page.locator('[data-notif-id="sem_previsao"]').count(),1);
  await page.evaluate(()=>{E.cadastro.ana.email='ana@example.test';mudou();});
  assert.equal(await page.locator('[data-notif-id="sem_contato"]').count(),0);
  await page.evaluate(()=>{E.cadastro.ana.email='invalido';E.cadastro.ana.apelido='<img src=x onerror="window.__xss=1">';mudou();});
  assert.equal(await page.locator('[data-notif-lista] img').count(),0);
  assert.equal(await page.evaluate(()=>window.__xss || null),null);
  // Sem acesso administrativo, importação só orienta e não oferece ação privilegiada.
  await page.keyboard.press('Escape');
  await page.evaluate(()=>{Acesso.modo='firebase';Acesso.projeto='notificacoes-ficticias';Acesso.usuario={uid:'operador-a',email:'a@example.test',nome:'A'};Acesso.perfil={ativo:true,perfil:'usuario'};Notificacoes.atualizar();});
  await abrir();
  assert.equal(await page.locator('[data-notif-destino="planilhas"]').count(),0);
  assert.match(await page.locator('[data-notif-id="planilhas"]').innerText(),/administrador/);
  await page.locator('[data-notif-todas-lidas]').click();await page.keyboard.press('Escape');
  await page.evaluate(()=>{Acesso.usuario={uid:'operador-b',email:'b@example.test',nome:'B'};Notificacoes.atualizar();});
  assert.equal(await sino.locator('[data-notif-contador]').innerText(),'5','leituras isoladas por conta');
  await page.evaluate(()=>{Acesso.usuario={uid:'operador-a',email:'a@example.test',nome:'A'};Notificacoes.atualizar();});
  assert.equal(await sino.locator('[data-notif-contador]').isVisible(),false,'leitura anterior carregada do armazenamento');
  // Evento entre abas atualiza a leitura da mesma conta.
  await page.evaluate(original=>{
    const k=Object.keys(localStorage).find(k=>k.startsWith('cp-notificacoes-v1-')&&k!==original);
    localStorage.removeItem(k);window.dispatchEvent(new StorageEvent('storage',{key:k}));
  },chave);
  assert.equal(await sino.locator('[data-notif-contador]').innerText(),'5','outra aba atualiza a leitura');
  // Armazenamento bloqueado mantém a operação e informa a limitação.
  await abrir();
  await page.evaluate(()=>{window.__setItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('Teste','QuotaExceededError');};});
  await page.locator('[data-notif-leitura="estoque"]').click();
  assert.match(await page.locator('[data-notif-local]').innerText(),/apenas enquanto esta página/);
  await page.evaluate(()=>{Storage.prototype.setItem=window.__setItem;});
  // Teclado, rolagem do fundo, dois temas e largura mínima.
  fs.mkdirSync('capturas/notificacoes',{recursive:true});
  for(const tema of ['dark','light'])for(const [width,height] of [[1440,1000],[768,1024],[390,844],[320,568],[844,390]]){
    await page.evaluate(t=>document.documentElement.dataset.theme=t,tema);
    await page.setViewportSize({width,height});
    const modal=page.locator('.modal.notificacoes');
    const dimensoes=await modal.evaluate(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,w:innerWidth,h:innerHeight};});
    assert.ok(dimensoes.left>=0&&dimensoes.right<=width+1&&dimensoes.top>=0&&dimensoes.bottom<=height+1,`${tema}/${width} dentro da tela: ${JSON.stringify(dimensoes)}`);
    assert.equal(await page.locator('.notificacoes .modal-corpo').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,`${tema}/${width} sem corte`);
    assert.equal(await page.evaluate(()=>document.querySelector('.principal').inert&&document.documentElement.classList.contains('rolagem-bloqueada')),true);
    const topo=await page.evaluate(()=>getComputedStyle(document.body).top);
    await page.mouse.move(10,10);await page.mouse.wheel(0,500);
    assert.equal(await page.evaluate(()=>getComputedStyle(document.body).top),topo,'fundo imóvel');
    await page.locator('.notificacoes .modal-corpo').evaluate(e=>e.scrollTop=0);
    await page.screenshot({path:`capturas/notificacoes/${tema}-${width}.png`});
  }
  await page.locator('[data-notif-todas-lidas]').focus();
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>!!document.activeElement.closest('.modal.notificacoes')),true,'foco contido');
  assert.equal(await page.locator('.modal.notificacoes').evaluate(e=>getComputedStyle(e).animationName),'none');
  await page.keyboard.press('Escape');
  for(const tema of ['dark','light'])for(const width of [1440,768,390,320]){
    await page.evaluate(t=>{document.documentElement.dataset.theme=t;renderizar(true);},tema);
    await page.setViewportSize({width,height:900});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`topo sem rolagem lateral ${tema}/${width}`);
    assert.equal(await sino.evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1;}),true,'sino inteiro na tela');
    assert.equal(await sino.locator('.ic').evaluate(e=>e.getBoundingClientRect().width>=16),true,'sino não encolhe');
    assert.equal(await sino.evaluate(e=>{const r=e.getBoundingClientRect();return [...e.children].filter(c=>c.getClientRects().length).every(c=>{const x=c.getBoundingClientRect();return x.left>=r.left&&x.right<=r.right;});}),true,'ícone, texto e contador sem cortes');
    await page.screenshot({path:`capturas/notificacoes/topo-${tema}-${width}.png`});
  }
  await abrir();
  // Revogação elimina a janela e o contador; nunca mantém dados visíveis sem acesso.
  await page.evaluate(()=>{Acesso.perfil=null;Notificacoes.atualizar();});
  assert.equal(await page.locator('.modal.notificacoes').count(),0);
  assert.equal(await sino.isVisible(),false);
  assert.deepEqual(erros,[]);
  console.log('PASSOU: 5 categorias, regras e quantidades, limites personalizados, retorno de 2 dias, contatos, filtros e exportação, leitura por conta, alterações/reincidências, permissões, XSS, armazenamento bloqueado, atualização aberta, teclado, fundo imóvel, dois temas e 320–1440px.');
}finally{await browser.close();}
