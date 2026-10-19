import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runInNewContext} from 'node:vm';
import {prepararPortalExistente} from '../seguranca/portal.mjs';
const montar=runInNewContext(fs.readFileSync('src/js/27-portal.js','utf8')+'\nmontarSaldosTecnicos',{TextEncoder});
const usadas=[{tid:'ANA',regiao:'PR',k:'1',mat:'A',qtd:2},{tid:'ANA',regiao:'SC',k:'1',mat:'A',qtd:9},{tid:'BRUNO',regiao:'PR',k:'2',mat:'B',qtd:7}];
const novas=[{tid:'ANA',regiao:'PR',mat:'A|B',tipoEnvio:'C',qtd:3},{tid:'ANA',regiao:'PR',mat:'A',tipoEnvio:'B|C',qtd:4}];
const saldos=montar(usadas,novas,{ANA:{nome:'Ana Silva'},BRUNO:{nome:'Bruno'}},{A:'Placa'});
assert.equal(saldos.size,3);assert.equal(saldos.get('PR--ANA').pecas.size,3);assert.equal(saldos.get('SC--ANA').pecas.size,1);
assert.equal(saldos.get('PR--ANA').pecas.get('u-1').quantidade,2);assert.equal(saldos.get('SC--ANA').pecas.get('u-1').quantidade,9);
assert.equal(saldos.get('PR--ANA').pecas.get('u-1').descricao,'Placa');
assert.equal(montar([],[],{},{}).size,0);
assert.throws(()=>montar([...usadas,usadas[0]],[],{},{}),/ambíguo/);
for(const qtd of [-1,0,1.5,Infinity,NaN])assert.throws(()=>montar([{...usadas[0],qtd}],[],{},{}),/quantidades/);
assert.throws(()=>montar([{...usadas[0],tid:'../OUTRA'}],[],{},{}),/inválida/);
// Exercita também a publicação inicial, inclusive o formato compacto real cp_lista.
const docs=new Map([
 ['dados/indice',{versao:7,arquivos:{'usadas:PR':{gen:'g-antiga',partes:1}}}],
 ['cadastro/tecnicos',{t:{ANA:{nome:'Ana'}}}],['dados/catalogo',{m:{A:'Placa'}}],
 ['dados/u-PR-g-antiga-0',{itens:[{cp_lista:['abc','ANA','NF','REM','A','CH','',4,'2026-10-19']}]}]
]);
const ref=path=>({path,collection:c=>({doc:id=>ref(`${path}/${c}/${id}`)}),get:async()=>snap(path)});
const snap=path=>({exists:docs.has(path),data:()=>docs.get(path)});
const db={doc:ref,batch:()=>{const staged=[];return {set:(r,d)=>staged.push([r.path,d]),commit:async()=>{for(const [p,d] of staged)docs.set(p,d);}};},runTransaction:async fn=>fn({get:r=>r.get(),set:(r,d)=>docs.set(r.path,d)})};
await prepararPortalExistente(db);
const controle=docs.get('portal/controle');assert.equal(controle.versao,7);
const publicado=docs.get(`saldos_tecnicos/PR--ANA/geracoes/${controle.geracao}/pecas/u-abc`);
assert.equal(publicado.quantidade,4);assert.equal(publicado.mat,'A');assert.equal(publicado.chamado,'CH');
await prepararPortalExistente(db);assert.equal(docs.get('portal/controle').geracao,controle.geracao,'implantação idempotente');
assert.equal([...docs.keys()].filter(p=>p.startsWith('usuarios/')).length,0,'nenhum acesso é criado automaticamente');
console.log('Projeção: separação por técnico/UF, ausência de colisões, saldo vazio e migração do estoque existente passaram.');
