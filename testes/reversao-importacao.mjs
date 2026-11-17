import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {recuperarImportacao} from '../seguranca/recuperar-importacao.mjs';
const f=vm.runInNewContext(fs.readFileSync('src/js/39-reversao-importacao.js','utf8')+'\n({validarReversaoImportacao,planejarLimpezaImportacao})',{structuredClone});
const id='L20261117092854teste',em='2026-11-17 09:28',imp={id,em,chaves:['usadas:PR']};
const indice={versao:7,arquivos:{'usadas:PR':{lote:id,gen:'errada',partes:1}},anterior:{'usadas:PR':{lote:'anterior',gen:'correta',partes:1,em:'2026-11-16 09:29'}}};
assert.equal(f.validarReversaoImportacao(imp,indice).length,1);
for(const alterado of [{...imp,desfeito:true},{...imp,chaves:[]},{...imp,chaves:['usadas:TO']}])assert.throws(()=>f.validarReversaoImportacao(alterado,indice));
assert.throws(()=>f.validarReversaoImportacao(imp,{...indice,arquivos:{'usadas:PR':{lote:'outra'}}}),/Outra importação/);
assert.throws(()=>f.validarReversaoImportacao(imp,{...indice,reversivel:{'usadas:PR':false}}),/não está mais disponível/);
assert.throws(()=>f.validarReversaoImportacao(imp,{...indice,anterior:{}}),/não está mais disponível/);
assert.equal(f.validarReversaoImportacao(imp,{...indice,anterior:{'usadas:PR':null}}).length,1,'a primeira importação pode voltar a nenhum estoque');
const novo=(nome,extras={})=>({chave:nome,nome,apelido:'',regiao:'PR',tipo:'tecnico',meta:null,telefone:'',email:'',obs:'',criadoEm:em,...extras});
const cadastro={A:{nome:'Técnico anterior',regiao:'PR'},B:novo('Novo indevido'),C:novo('Com peças'),D:novo('Editado',{telefone:'41999999999'}),E:novo('Tem acesso'),F:novo('Tem contato'),G:novo('Tem outro histórico')};
const limpeza=f.planejarLimpezaImportacao(imp,{cadastro,catalogo:{},fotos:{usadas:[{tid:'A',mat:'M'},{tid:'C',mat:'M'}],novas:[],rmdf:[]},registros:[{tid:'F'},{tid:'G',lote:'outro'},{tid:'B',lote:id}],usuarios:[{perfil:'tecnico',tecnicoId:'PR--E'}]});
assert.deepEqual([...limpeza.removidos],['B']);for(const tid of ['A','C','D','E','F','G'])assert.ok(limpeza.cadastro[tid]);assert.ok(cadastro.B,'o planejamento não modifica a origem');
const antes={nome:'Nome anterior',regiao:''},depois={...antes,regiao:'PR'};
const documentada=f.planejarLimpezaImportacao({...imp,cadastroAntes:{X:antes,Y:null,Z:null},cadastroImportado:{X:depois,Y:novo('Y'),Z:novo('Z')},catalogoAntes:{M:'Descrição anterior',N:null,P:'Antiga'},catalogoImportado:{M:'Descrição importada',N:'Nova',P:'Importada'}},{cadastro:{X:depois,Y:novo('Y'),Z:novo('Z',{obs:'Editado depois'})},catalogo:{M:'Descrição importada',N:'Nova',P:'Editada depois'},fotos:{usadas:[],novas:[],rmdf:[]}});
assert.equal(documentada.cadastro.X.regiao,'');assert.ok(!documentada.cadastro.Y);assert.equal(documentada.cadastro.Z.obs,'Editado depois');assert.equal(documentada.catalogo.M,'Descrição anterior');assert.ok(!Object.hasOwn(documentada.catalogo,'N'));assert.equal(documentada.catalogo.P,'Editada depois');

// Firestore em memória testa a aplicação atômica e idempotente do lote autorizado.
function bancoFalso(){
 const docs=new Map(),copia=v=>v===undefined?v:structuredClone(v),snap=p=>({id:p.split('/').at(-1),exists:docs.has(p),data:()=>copia(docs.get(p))});
 const ref=p=>({path:p,id:p.split('/').at(-1),get:async()=>snap(p),collection:c=>colecao(`${p}/${c}`),set:async(d,op)=>salvar(p,d,op)});
 const salvar=(p,d,op)=>docs.set(p,op?.merge?{...docs.get(p),...copia(d)}:copia(d));
 function colecao(c,filtros=[],ordem=null,limite=null){return {doc:id=>ref(`${c}/${id}`),where:(...f)=>colecao(c,[...filtros,f],ordem,limite),orderBy:(...o)=>colecao(c,filtros,o,limite),limit:n=>colecao(c,filtros,ordem,n),get:async()=>{
  let linhas=[...docs].filter(([p])=>p.startsWith(c+'/')&&p.split('/').length===c.split('/').length+1).filter(([,d])=>filtros.every(([k,op,v])=>op==='=='?d[k]===v:op==='>='?d[k]>=v:false));
  if(ordem)linhas.sort((a,b)=>String(a[1][ordem[0]]||'').localeCompare(String(b[1][ordem[0]]||''))*(ordem[1]==='desc'?-1:1));if(limite)linhas=linhas.slice(0,limite);return {docs:linhas.map(([p])=>snap(p))};
 }};}
 const staged=()=>{const a=[];return {a,set:(r,d,op)=>a.push(()=>salvar(r.path,d,op)),delete:r=>a.push(()=>docs.delete(r.path)),commit:async()=>{for(const f of a)f();}};};
 return {docs,doc:ref,collection:colecao,batch:staged,runTransaction:async f=>{const t=staged();const r=await f({...t,get:async r=>snap(r.path)});await t.commit();return r;}};
}
function semente(){
 const db=bancoFalso();
 for(const [p,d]of Object.entries({
  'dados/indice':indice,[`importacoes/${id}`]:{...imp,id:undefined},'cadastro/tecnicos':{t:{A:cadastro.A,B:cadastro.B}},'dados/catalogo':{m:{M:'Placa'}},'seguranca/controle':{administradorPrincipal:'administrador@example.test'},
  'dados/u-PR-correta-0':{itens:[{cp_lista:['boa','A','NF','REM','M','CH','2026-11-10',2,'2026-11-10']}]},
  'dados/u-PR-errada-0':{itens:[{cp_lista:['ruim','B','NF','REM','M','CH','2026-11-17',99,'2026-11-17']}]},
  'devolucoes/errada':{data:'2026-11-17',lote:id,itens:[{cp_lista:['boa','A','M','CH','2026-11-10',2,'2026-11-17 09:28',7,'PR',id]}]},
  'movimentos/errada':{data:'2026-11-17',lote:id,itens:[{k:'mov-ruim',lote:id,tid:'B',regiao:'PR',qtd:10,mat:'M',dias:1,desde:'2026-11-16',em:'2026-11-17 09:28',destino:'pendente'}]},
  'agendamentos/existente':{tid:'A',peca:'boa',previsao:'',versao:1},'contatos/existente':{tid:'A',itens:['boa'],em:'2026-11-16 10:00',canal:'email'},
  'usuarios/principal@example.test':{perfil:'administrador',ativo:true},'ferias/f1':{nome:'Férias preservadas',inicio:'2026-12-01'},
  'historico/2026-11-16':{data:'2026-11-16',t:{A:[2,0,6,0]},tot:{usadas:2}},'historico/2026-11-17':{data:'2026-11-17',t:{B:[99,0,0,0]},tot:{usadas:99}}
 }))db.docs.set(p,d);
 return db;
}
const db=semente(),inicial=JSON.stringify([...db.docs]);
const plano=await recuperarImportacao(db,{id,versaoEsperada:7,dia:'2026-11-17'});assert.equal(plano.cadastrosRemovidos,1);assert.equal(JSON.stringify([...db.docs]),inicial,'conferir não grava nada');
await assert.rejects(recuperarImportacao(db,{id,versaoEsperada:6,dia:'2026-11-17',aplicar:true}),/mudou/);assert.equal(JSON.stringify([...db.docs]),inicial);
const r=await recuperarImportacao(db,{id,versaoEsperada:7,dia:'2026-11-17',aplicar:true});assert.equal(r.estado,'verificada');
assert.equal(db.docs.get('dados/indice').versao,8);assert.equal(db.docs.get('dados/indice').arquivos['usadas:PR'].gen,'correta');assert.equal(db.docs.get('dados/indice').reversivel['usadas:PR'],false);
assert.ok(!db.docs.get('cadastro/tecnicos').t.B);assert.ok(db.docs.get('cadastro/tecnicos').t.A);assert.ok(!db.docs.has('devolucoes/errada'));assert.ok(!db.docs.has('movimentos/errada'));
assert.equal(db.docs.get('historico/2026-11-17').tot.usadas,2);assert.ok(!db.docs.get('historico/2026-11-17').t.B);assert.equal(db.docs.get('resumo/atual').dias['2026-11-17'].pendentes,2);
assert.equal(db.docs.get('portal/controle').versao,8);assert.ok(db.docs.has('dados/u-PR-errada-0'),'a versão incorreta continua guardada para recuperação administrativa');
assert.equal(db.docs.get('ferias/f1').nome,'Férias preservadas');assert.ok(db.docs.has('contatos/existente'));assert.ok(db.docs.has('agendamentos/existente'));assert.ok(db.docs.get('usuarios/principal@example.test').ativo);
assert.ok(db.docs.has(`recuperacoes_importacao/${id}/antes/cadastro`));
const geracao=db.docs.get('portal/controle').geracao;await recuperarImportacao(db,{id,versaoEsperada:7,dia:'2026-11-17',aplicar:true});assert.equal(db.docs.get('portal/controle').geracao,geracao,'reexecutar não aplica uma segunda reversão');
console.log('Reversão: versão anterior, conflito, proteção contra segunda reversão, cadastros indevidos, edições preservadas, catálogo, backup, saldos, histórico, resumo, portal e idempotência passaram.');
