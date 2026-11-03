// Plano e execução com banco em memória. Nunca lê credenciais de produção.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {planejarRetiradaTO,executarRetiradaTO,OPERACAO_TO} from '../seguranca/retirar-to.mjs';
const gen='11111111-1111-4111-8111-111111111111';
const usada=(k,tid,mat,qtd)=>[k,tid,'NF','REM',mat,'CH','2026-10-01',qtd,'2026-10-01'];
const dados=new Map([
 ['seguranca/controle',{administradorPrincipal:'admin@exemplo.com'}],
 ['usuarios/admin@exemplo.com',{perfil:'administrador',principal:true,ativo:true}],
 ['usuarios/pr@exemplo.com',{perfil:'tecnico',tecnicoId:'PR--PR1',ativo:true}],
 ['usuarios/to@exemplo.com',{perfil:'tecnico',tecnicoId:'TO--TO1',ativo:true}],
 ['credenciais_usuarios/to@exemplo.com',{uid:'uid-to',exigirTroca:false}],
 ['recuperacoes_senha/token-to',{email:'to@exemplo.com',uid:'uid-to'}],
 ['recuperacoes_senha/token-pr',{email:'pr@exemplo.com',uid:'uid-pr'}],
 ['vinculos_tecnicos/TO--TO1',{email:'to@exemplo.com',regiao:'TO',tid:'TO1'}],
 ['vinculos_tecnicos/PR--PR1',{email:'pr@exemplo.com',regiao:'PR',tid:'PR1'}],
 ['cadastro/tecnicos',{t:{TO1:{nome:'Pessoa TO',regiao:'TO'},PR1:{nome:'Pessoa PR',regiao:'PR'}}}],
 ['config/geral',{prazo:7}],
 ['app_externo/item',{regiao:'TO',nome:'Não pertence ao painel'}],
 ['dados/indice',{versao:7,arquivos:{'usadas:TO':{gen:'velha',partes:1,em:'2026-11-03'},'usadas:PR':{gen:'velha',partes:1,em:'2026-11-03'}},anterior:{'usadas:TO':{gen:'antiga',partes:1}}}],
 ['dados/u-TO-velha-0',{tipo:'usadas',regiao:'TO',itens:[{cp_lista:usada('to-k','TO1','MAT-TO',100)}]}],
 ['dados/u-PR-velha-0',{tipo:'usadas',regiao:'PR',itens:[{cp_lista:usada('pr-k','PR1','MAT-PR',2)}]}],
 ['dados/catalogo',{m:{'MAT-TO':'Apenas TO','MAT-PR':'Usada no PR'}}],
 ['ferias/to',{id:'to',nome:'Pessoa TO',regiao:'TO',status:'planejado',periodos:[]}],
 ['ferias/pr',{id:'pr',nome:'Pessoa PR',regiao:'PR',status:'planejado',periodos:[]}],
 ['historico_ferias/h-to',{id:'to',nome:'Pessoa TO',regiao:'TO'}],
 ['historico_ferias/malformado',{regiao:'TO'}],
 ['historico_ferias/h-pr',{id:'pr',nome:'Pessoa PR',regiao:'PR'}],
 ['envios_lembretes_ferias/to',{feriasId:'to',email:'gestor@exemplo.com',lote:'somente-to'}],
 ['envios_lembretes_ferias/pr',{feriasId:'pr',email:'gestor@exemplo.com',lote:'somente-pr'}],
 ['caixa_lembretes_ferias/somente-to',{quantidade:1,email:'gestor@exemplo.com'}],
 ['caixa_lembretes_ferias/somente-pr',{quantidade:1,email:'gestor@exemplo.com'}],
 ['devolucoes/mista',{data:'2026-11-02',itens:[{cp_lista:['to-k','TO1','MAT-TO','CH','2026-10-01',100,'2026-11-02',32,'TO']},{cp_lista:['pr-k','PR1','MAT-PR','CH','2026-10-01',1,'2026-11-02',32,'PR']}]}],
 ['movimentos/vazio-pr',{itens:[]}],
 ['historico/ontem',{data:'2026-11-02',t:{TO1:[100,100,30,0],PR1:[2,1,10,3]},tot:{usadas:102,atrasadas:101,novas:3}}],
 ['importacoes/mista',{arquivos:[{regiao:'TO',tipo:'usadas',saidasQtd:100},{regiao:'PR',tipo:'usadas',saidasQtd:1}],chaves:['usadas:TO','usadas:PR'],devolvidas:101}],
 ['acompanhamento/TO1',{itens:{'to-k':{obs:'Só TO'}}}],
 ['acompanhamento/PR1',{itens:{'pr-k':{obs:'Preservar PR'}}}],
 ['saldos_tecnicos/TO--TO1/geracoes/orfa/pecas/u-to',{tipo:'usadas',quantidade:100}],
 ['saldos_tecnicos/PR--PR1/geracoes/orfa/pecas/u-pr',{tipo:'usadas',quantidade:2}],
 ['declaracoes_tecnicos/TO--TO1/itens/u-to',{quantidadeDevolver:100}],
 ['portal/controle',{geracao:gen,versao:7,atualizadoEm:'2026-11-03'}],
]);
const roots=['saldos_tecnicos/TO--TO1','saldos_tecnicos/PR--PR1','declaracoes_tecnicos/TO--TO1'];
const plano=planejarRetiradaTO(dados,{raizes:roots});assert.equal(plano.emails.length,1);assert.equal(plano.arvores.length,2);
assert.equal(plano.alteracoes.find(a=>a.caminho==='usuarios/admin@exemplo.com'),undefined);
assert.equal(plano.alteracoes.find(a=>a.caminho==='movimentos/vazio-pr'),undefined);
assert.equal(plano.alteracoes.find(a=>a.caminho==='dados/u-PR-velha-0'),undefined,'não regrava planilhas de outras UFs');
assert.equal(plano.alteracoes.find(a=>a.caminho==='devolucoes/mista').dados.itens.length,1);
assert.equal(plano.alteracoes.find(a=>a.caminho==='importacoes/mista').dados.devolvidas,1);
assert.equal(plano.alteracoes.find(a=>a.caminho==='historico/ontem').dados.t.PR1[0],2);
assert.ok(!plano.alteracoes.find(a=>a.caminho==='ferias/pr'));assert.ok(!plano.alteracoes.find(a=>a.caminho==='app_externo/item'),'não altera dados de outra aplicação');
// Banco Admin em memória com revisões: verifica também o fluxo completo e a reexecução.
const mem=new Map([...dados].map(([p,d])=>[p,structuredClone(d)])),revisoes=new Map([...mem.keys()].map(k=>[k,1]));
const write=(p,d)=>{mem.set(p,structuredClone(d));revisoes.set(p,(revisoes.get(p)||0)+1);};
const ref=p=>({path:p,id:p.split('/').at(-1),get:async()=>snap(p),set:async d=>write(p,d),delete:async()=>mem.delete(p),collection:c=>col(p+'/'+c)});
const snap=p=>{const rev=revisoes.get(p);return {id:p.split('/').at(-1),ref:ref(p),exists:mem.has(p),data:()=>structuredClone(mem.get(p)),updateTime:{isEqual:outro=>outro.rev===rev,rev}};};
const col=p=>({id:p.split('/').at(-1),path:p,doc:id=>ref(p+'/'+id),where:()=>col(p),orderBy:()=>col(p),limit:()=>col(p),listDocuments:async()=>[...new Set([...mem.keys()].filter(k=>k.startsWith(p+'/')).map(k=>k.slice(p.length+1).split('/')[0]))].map(id=>ref(p+'/'+id)),get:async()=>({docs:[...mem.keys()].filter(k=>k.startsWith(p+'/')&&!k.slice(p.length+1).includes('/')).map(snap)})});
const db={doc:ref,collection:col,listCollections:async()=>[...new Set([...mem.keys()].map(k=>k.split('/')[0]))].map(col),recursiveDelete:async r=>{for(const k of [...mem.keys()])if(k===r.path||k.startsWith(r.path+'/'))mem.delete(k);},batch:()=>{const ops=[];return{set:(r,d)=>ops.push([r.path,d]),commit:async()=>ops.forEach(([p,d])=>write(p,d))};},runTransaction:async fn=>{const ops=[];const result=await fn({get:r=>r.get(),set:(r,d)=>ops.push([r.path,d]),delete:r=>ops.push([r.path,null])});for(const [p,d]of ops){if(d===null)mem.delete(p);else write(p,d);}return result;}};
const usuarios=new Map([['admin@exemplo.com',{uid:'admin'}],['pr@exemplo.com',{uid:'uid-pr'}],['to@exemplo.com',{uid:'uid-to'}]]);
const auth={getUserByEmail:async e=>{if(!usuarios.has(e))throw Object.assign(new Error('ausente'),{code:'auth/user-not-found'});return usuarios.get(e);},deleteUser:async uid=>{for(const [e,u]of usuarios)if(u.uid===uid)usuarios.delete(e);}};
const regras={releaseFirestoreRulesetFromSource:async()=>{}};
const op={db,auth,regras,source:fs.readFileSync('firestore.rules','utf8'),esperar:async()=>{}};
const previa=await executarRetiradaTO(op);assert.ok(previa.documentosExcluir>0);assert.ok(mem.has('ferias/to'),'simulação não exclui');
await executarRetiradaTO({...op,aplicar:true});
assert.ok(!mem.has('ferias/to'));assert.ok(!mem.has('dados/u-TO-velha-0'));assert.ok(!mem.has('acompanhamento/TO1'));assert.ok(!mem.has('recuperacoes_senha/token-to'));assert.ok(!mem.has('caixa_lembretes_ferias/somente-to'));
assert.equal(mem.get('dados/u-PR-velha-0').itens[0].cp_lista[7],2);assert.ok(mem.has('ferias/pr'));assert.ok(mem.has('caixa_lembretes_ferias/somente-pr'));assert.ok(mem.has('recuperacoes_senha/token-pr'));assert.ok(usuarios.has('admin@exemplo.com'));assert.ok(usuarios.has('pr@exemplo.com'));assert.ok(!usuarios.has('to@exemplo.com'));
assert.equal([...mem.keys()].some(k=>k.includes('/TO--')),false);assert.equal(mem.has('manutencao/limpeza-pecas'),false);assert.equal(mem.get(`operacoes_manutencao/${OPERACAO_TO}`).uidsPendentes,undefined);
const prAntes=JSON.stringify(mem.get('ferias/pr'));assert.equal((await executarRetiradaTO({...op,aplicar:true})).jaConcluida,true);assert.equal(JSON.stringify(mem.get('ferias/pr')),prAntes);
console.log('Exclusão TO: prévia sem gravação, edição de documentos mistos, órfãos, contas, históricos, e-mails e reexecução preservando os dados de PR e o administrador passaram.');
