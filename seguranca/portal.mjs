// Projeta os saldos existentes sem criar acessos ou adivinhar vínculos por nome/e-mail.
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {randomUUID} from 'node:crypto';
export async function prepararPortalExistente(db) {
  const [indiceSnap,controleSnap,cadastroSnap,catalogoSnap]=await Promise.all(['dados/indice','portal/controle','cadastro/tecnicos','dados/catalogo'].map(p=>db.doc(p).get()));
  const indice=indiceSnap.data()||{},versao=indice.versao||0;
  if(controleSnap.exists&&controleSnap.data().versao===versao)return;
  const usadas=[],novas=[];
  for(const [chave,ent] of Object.entries(indice.arquivos||{})) {
    if(!ent?.gen)continue;
    const [tipo,regiao]=chave.split(':');
    const prefixo=tipo==='usadas'?'u':'n';
    for(let parte=0;parte<(ent.partes||0);parte++) {
      const snap=await db.doc(`dados/${prefixo}-${regiao}-${ent.gen}-${parte}`).get();
      if(!snap.exists||!Array.isArray(snap.data().itens))throw new Error('Uma parte do estoque está ausente. Portal não publicado.');
      for(const compacta of snap.data().itens) {
        const l=Array.isArray(compacta)?compacta:compacta.cp_lista;
        if(!Array.isArray(l))throw new Error('Linha compacta inválida no estoque.');
        if(tipo==='usadas')usadas.push({k:l[0],tid:l[1],regiao,nf:l[2],mat:l[4],chamado:l[5],qtd:l[7],desde:l[8]});
        else novas.push({tid:l[0],regiao,mat:l[1],tipoEnvio:l[2],qtd:l[3],desde:l[5]});
      }
    }
  }
  const codigo=await readFile(new URL('../src/js/27-portal.js',import.meta.url),'utf8');
  const montar=runInNewContext(`${codigo}\nmontarSaldosTecnicos`,{TextEncoder});
  const saldos=montar(usadas,novas,cadastroSnap.data()?.t||{},catalogoSnap.data()?.m||{});
  const geracao=randomUUID();let batch=db.batch(),n=0;
  async function gravar(ref,d){batch.set(ref,d);if(++n===400){await batch.commit();batch=db.batch();n=0;}}
  for(const [id,s] of saldos) {
    const ref=db.doc(`saldos_tecnicos/${id}/geracoes/${geracao}`);
    await gravar(ref,{nome:s.nome,tid:s.tid,regiao:s.regiao,total:s.pecas.size});
    for(const [p,d] of s.pecas)await gravar(ref.collection('pecas').doc(p),d);
  }
  if(n)await batch.commit();
  await db.runTransaction(async tx=>{
    const [atual,controle]=await Promise.all([tx.get(db.doc('dados/indice')),tx.get(db.doc('portal/controle'))]);
    if((atual.data()?.versao||0)!==versao)throw new Error('Uma importação mudou o estoque durante a implantação. Execute novamente.');
    if(controle.exists&&controle.data().versao===versao)return;
    tx.set(db.doc('portal/controle'),{geracao,versao,atualizadoEm:indice.atualizadoEm||new Date().toISOString()});
  });
  console.log('Estoque existente preparado em documentos individuais por técnico e UF. Nenhum acesso criado automaticamente.');
}
