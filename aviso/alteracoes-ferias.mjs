// Só dados de negócio entram na comparação: salvar sem mudar nada não gera aviso.
export function programacaoFerias(f){
 if(!f)return null;
 const p={};
 for(const k of ['nome','matricula','regiao','ciclo','status','direito','vendidos','obs','area','localidade'])p[k]=f[k]??'';
 p.arquivado=!!f.arquivado;
 p.periodos=(f.periodos||[]).map(d=>({inicio:d.inicio||'',fim:d.fim||'',retorno:d.retorno||''})).sort((a,b)=>a.inicio.localeCompare(b.inicio)||a.fim.localeCompare(b.fim)||a.retorno.localeCompare(b.retorno));
 return p;
}
export const mesmaProgramacao=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const data=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)?s.split('-').reverse().join('/'):'Não informado';
export function resumoProgramacao(p){
 if(!p)return 'Cadastro excluído da programação.';
 const status={planejado:'Planejado',confirmado:'Confirmado',cancelado:'Cancelado'}[p.status]||p.status;
 return [`Situação: ${p.arquivado?'Retirado da lista':status}`,`UF: ${p.regiao||'Não informada'} · Ciclo: ${p.ciclo||'Não informado'}`,...p.periodos.map((d,i)=>`${i+1}º período: ${data(d.inicio)} a ${data(d.fim)} · Retorno: ${data(d.retorno||(/^\d{4}-\d{2}-\d{2}$/.test(d.fim)?new Date(Date.parse(d.fim+'T00:00:00Z')+86400000).toISOString().slice(0,10):''))}`)].join('\n');
}
export function camposAlterados(antes,depois){
 if(!depois)return ['Cadastro excluído'];
 if(!antes)return ['Programação alterada após o lembrete anterior'];
 const nomes={nome:'Nome',matricula:'Matrícula',regiao:'UF',ciclo:'Ciclo',status:'Situação',direito:'Dias de direito',vendidos:'Dias vendidos',obs:'Observações',area:'Área',localidade:'Localidade',arquivado:'Presença na lista',periodos:'Datas dos períodos'};
 return Object.keys(nomes).filter(k=>JSON.stringify(antes[k])!==JSON.stringify(depois[k])).map(k=>nomes[k]);
}
