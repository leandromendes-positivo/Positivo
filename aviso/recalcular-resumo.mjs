// Reutiliza as regras do painel para o aviso refletir agendamentos feitos por usuários comuns.
// Executa somente código versionado deste repositório; não recebe código do banco.
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
function decodificar(v) {
  if (v && typeof v.toDate === 'function') return new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(v.toDate());
  if (Array.isArray(v)) return v.map(decodificar);
  if (v && typeof v === 'object') {
    if (Object.keys(v).length === 1 && Array.isArray(v.cp_lista)) return v.cp_lista.map(decodificar);
    return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,decodificar(x)]));
  }
  return v;
}
export async function recalcularResumo(db, dia) {
  const armazem = {
    online: false,
    ler: async caminho => { const d=await db.doc(caminho).get();return d.exists?decodificar(d.data()):null; },
    consultar: async (caminho,op={}) => {
      let q=db.collection(caminho);
      for(const [f,operador,v] of op.onde || [])q=q.where(f,operador,v);
      if(op.ordem)q=q.orderBy(...op.ordem);if(op.limite)q=q.limit(op.limite);
      const s=await q.get();return s.docs.map(d=>({id:d.id,...decodificar(d.data())}));
    },
  };
  const contexto=vm.createContext({ window:{__CP_AGORA:`${dia}T09:00:00`}, Armazem:armazem, Acesso:{modo:'servidor'}, console, setTimeout, clearTimeout });
  const arquivos=['00-util.js','26-identidade.js','30-modelo.js'];
  const codigo=(await Promise.all(arquivos.map(n=>readFile(new URL(`../src/js/${n}`,import.meta.url),'utf8')))).join('\n');
  vm.runInContext(codigo,contexto);
  return await vm.runInContext('(async()=>{await carregarTudo();if(E.status!=="pronto")throw new Error("Não foi possível calcular o resumo atualizado.");return montarResumo();})()',contexto);
}
