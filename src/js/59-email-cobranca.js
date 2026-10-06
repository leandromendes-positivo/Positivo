/* Rascunhos de cobrança. Contatos vêm do técnico, nunca do cadastro de usuários. */
const EDITORES_EMAIL = {
  outlook: 'Outlook na Web (Microsoft 365)',
  aplicativo: 'Outlook instalado (aplicativo padrão)',
};
function montarEmailCobranca(t, itens, lembrete = false) {
  const prazo = prazoDoTecnico(t.tid), qtd = somar(itens, i => i.qtd);
  const atrasadas = somar(itens.filter(i => i.dias > prazo), i => i.qtd);
  const lista = [...itens].sort((a,b) => b.dias - a.dias).map((i,n) => [
    `${n + 1}. ${i.desc || 'Material sem descrição'}`,
    `Código: ${i.mat} | Quantidade: ${fmtNum(i.qtd)}`,
    `Chamado: ${i.chamado || 'Não informado'} | Há ${plural(i.dias, 'dia', 'dias')} com o técnico`,
    i.previsao ? `Previsão informada: ${fmtData(i.previsao)}` : '',
  ].filter(Boolean).join('\n')).join('\n\n');
  const operador = Acesso.usuario?.email ? primeiroNomeEmail(Acesso.usuario.email) : '';
  return {
    destinatario: String(t.email || '').trim(),
    assunto: `Positivo | ${lembrete ? 'Programação de devolução' : 'Devolução de peças usadas'} | ${t.nome}`,
    corpo: [
      `${saudacao()}, ${primeiroNome(t.nome)}!`,
      lembrete ? 'Vamos programar a devolução das peças usadas abaixo para manter seu inventário em dia?' : 'Identificamos peças usadas pendentes de devolução sob sua responsabilidade. Segue a relação para conferência.',
      `RESUMO DA SOLICITAÇÃO\nTécnico: ${t.nome}${t.regiao ? ` | Região: ${t.regiao}` : ''}\nData da consulta: ${fmtData(hojeISO())}\nTotal: ${plural(qtd, 'peça', 'peças')} | Acima do prazo: ${fmtNum(atrasadas)}\nPrazo de devolução: ${plural(prazo, 'dia', 'dias')}`,
      `PEÇAS PARA DEVOLUÇÃO\n\n${lista}`,
      'PRÓXIMO PASSO\nPor favor, responda este e-mail com a data prevista para devolução. Se alguma peça já foi devolvida, informe o código e o chamado para conferirmos a baixa.',
      `Obrigado pela colaboração!\n\n${operador ? operador + '\n' : ''}Controle de Peças\nPositivo Tecnologia`,
    ].join('\n\n'),
  };
}
function validarEmailCobranca(d) {
  if (!emailValido(d.destinatario) || /[\r\n]/.test(d.destinatario)) throw new Error('Informe um único e-mail válido para o técnico.');
  if (!d.assunto.trim() || /[\r\n]/.test(d.assunto)) throw new Error('Informe um assunto em uma única linha.');
  if (!d.corpo.trim()) throw new Error('Preencha a mensagem antes de abrir o e-mail.');
}
function linkEmailCobranca(d, editor = 'outlook') {
  validarEmailCobranca(d);
  if (!Object.hasOwn(EDITORES_EMAIL, editor)) throw new Error('Escolha onde abrir o e-mail.');
  if (editor === 'aplicativo') return `mailto:${encodeURIComponent(d.destinatario).replace(/%40/g, '@')}?subject=${encodeURIComponent(d.assunto)}&body=${encodeURIComponent(d.corpo.replace(/\r?\n/g, '\r\n'))}`;
  const url = new URL('https://outlook.office.com/mail/deeplink/compose');
  url.searchParams.set('to', d.destinatario);
  url.searchParams.set('subject', d.assunto);
  url.searchParams.set('body', d.corpo);
  return url.href;
}
function htmlEmailCobranca(d) {
  const paragrafos = d.corpo.split(/\r?\n\s*\r?\n/).map(p => `<p style="margin:0 0 18px;line-height:1.65;overflow-wrap:anywhere">${esc(p).replace(/\r?\n/g, '<br>')}</p>`).join('');
  return `<div style="max-width:640px;margin:auto;background:#fff;color:#202020;font-family:Arial,sans-serif;font-size:14px;border:1px solid #dedede"><div style="padding:24px;background:#0b0b0b;color:#fff;border-bottom:4px solid #24bfb0"><strong style="font-size:22px;letter-spacing:.5px">POSITIVO</strong><br><span style="font-size:11px;letter-spacing:2px">TECNOLOGIA</span></div><div style="padding:24px"><p style="font-size:11px;letter-spacing:1px;color:#666;margin:0 0 12px">CONTROLE DE PEÇAS · DEVOLUÇÕES</p><h1 style="font-size:20px;line-height:1.4;margin:0 0 24px;overflow-wrap:anywhere">${esc(d.assunto)}</h1>${paragrafos}</div></div>`;
}
function rascunhoEmailCobranca(d) {
  validarEmailCobranca(d);
  const base64 = texto => {
    let bytes = ''; for (const byte of new TextEncoder().encode(texto)) bytes += String.fromCharCode(byte);
    return btoa(bytes);
  };
  // Encoded-words curtas preservam acentos e os limites de linha do cabeçalho MIME.
  const blocos = []; let bloco = '';
  for (const letra of d.assunto) {
    if (new TextEncoder().encode(bloco + letra).length > 42) { blocos.push(bloco); bloco = ''; }
    bloco += letra;
  }
  if (bloco) blocos.push(bloco);
  const assunto = blocos.map(s => `=?UTF-8?B?${base64(s)}?=`).join('\r\n ');
  const fronteira = `positivo-${crypto.randomUUID()}`;
  const parte = (mime, texto) => `--${fronteira}\r\nContent-Type: ${mime}; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64(texto).match(/.{1,76}/g).join('\r\n')}\r\n`;
  return `To: ${d.destinatario}\r\nSubject: ${assunto}\r\nX-Unsent: 1\r\nMIME-Version: 1.0\r\nContent-Type: multipart/alternative; boundary="${fronteira}"\r\n\r\n` + parte('text/plain', d.corpo.replace(/\r?\n/g, '\r\n')) + parte('text/html', `<!doctype html><html lang="pt-BR"><body>${htmlEmailCobranca(d)}</body></html>`) + `--${fronteira}--\r\n`;
}
