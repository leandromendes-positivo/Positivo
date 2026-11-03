// Compartilhado pelos serviços de e-mail, contas e projeção de saldos.
export function regiaoDesativada(valor){return /^(?:TO|TOCANTINS)(?:$|[^A-Z])/.test(String(valor||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase());}
export const perfilForaDaOperacao=p=>p?.perfil==='tecnico'&&regiaoDesativada(p.tecnicoId);

export async function manutencaoAtiva(db){return (await db.doc('manutencao/limpeza-pecas').get()).exists===true;}
