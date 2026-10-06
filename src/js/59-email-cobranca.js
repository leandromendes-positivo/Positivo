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
    `Código: ${i.mat}`,
    `Quantidade: ${fmtNum(i.qtd)} | Tempo com o técnico: ${plural(i.dias, 'dia', 'dias')}`,
    `Chamado: ${i.chamado || 'Não informado'}`,
    i.previsao ? `Previsão informada: ${fmtData(i.previsao)}` : '',
  ].filter(Boolean).join('\n')).join('\n\n');
  const operador = Acesso.usuario?.email ? primeiroNomeEmail(Acesso.usuario.email) : '';
  return {
    destinatario: String(t.email || '').trim(),
    assunto: `Positivo | ${lembrete ? 'Programação de devolução' : 'Devolução de peças usadas'} | ${t.nome}`,
    corpo: [
      `${saudacao()}, ${primeiroNome(t.nome)}!`,
      lembrete ? 'Vamos programar a devolução das peças usadas abaixo para manter seu inventário em dia?' : 'Identificamos peças usadas pendentes de devolução sob sua responsabilidade. Segue a relação para conferência.',
      `RESUMO DA SOLICITAÇÃO\nTécnico: ${t.nome}${t.regiao ? `\nRegião: ${t.regiao}` : ''}\nData da consulta: ${fmtData(hojeISO())}\nTotal: ${plural(qtd, 'peça', 'peças')}\nAcima do prazo: ${plural(atrasadas, 'peça', 'peças')}\nPrazo de devolução: ${plural(prazo, 'dia', 'dias')}`,
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
  // O compositor do Outlook decodifica %20, mas pode exibir o + de URLSearchParams.
  // Codificar cada valor também preserva os sinais + reais em endereços e materiais.
  const params = { to: d.destinatario, subject: d.assunto, body: d.corpo };
  return 'https://outlook.office.com/mail/deeplink/compose?' + Object.entries(params).map(([k,v]) => `${k}=${encodeURIComponent(v)}`).join('&');
}
function htmlEmailCobranca(d) {
  // HTML com estilos inline e tabelas de apresentação para colar no Outlook e usar no .eml.
  // O texto editado é sempre a fonte: nada é descartado nem convertido em HTML executável.
  const fonte = "font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;font-weight:400;color:#262626;word-wrap:break-word;overflow-wrap:anywhere;";
  const forte = texto => `<strong style="font-weight:700;color:#171717">${esc(texto)}</strong>`;
  const linhas = texto => esc(texto).replace(/\r?\n/g, '<br>');
  const titulo = texto => `<h2 style="${fonte}font-size:16px;font-weight:700;line-height:24px;margin:26px 0 12px;color:#171717">${esc(texto)}</h2>`;
  const campos = texto => texto.split('\n').map(l => {
    const pos = l.indexOf(':');
    return pos > 0 ? forte(l.slice(0,pos + 1)) + esc(l.slice(pos + 1)) : esc(l);
  }).join('<br>');
  const blocos = d.corpo.replace(/\r\n/g, '\n').split(/\n\s*\n/).map((p,n) => {
    const ls = p.split('\n'), primeira = ls[0], resto = ls.slice(1).join('\n');
    if (primeira === 'RESUMO DA SOLICITAÇÃO') {
      const resumo = ls.slice(1).map(l => {
        const pos = l.indexOf(':');
        if (pos < 0) return `<tr><td colspan="2" style="${fonte}padding:8px 12px;border-bottom:1px solid #e5e7eb">${esc(l)}</td></tr>`;
        return `<tr><td width="43%" style="${fonte}font-size:12px;color:#555;padding:8px 12px;vertical-align:top;border-bottom:1px solid #e5e7eb">${esc(l.slice(0,pos))}</td><td style="${fonte}padding:8px 12px;vertical-align:top;border-bottom:1px solid #e5e7eb">${forte(l.slice(pos + 1).trim())}</td></tr>`;
      }).join('');
      return titulo('Resumo da solicitação') + `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="table-layout:fixed;border-collapse:collapse;background:#f5f6f7;border:1px solid #e5e7eb"><tbody>${resumo}</tbody></table>`;
    }
    if (primeira === 'PEÇAS PARA DEVOLUÇÃO') return titulo('Peças para devolução') + (resto ? `<p style="${fonte}margin:0 0 16px">${linhas(resto)}</p>` : '');
    if (primeira === 'PRÓXIMO PASSO') return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="table-layout:fixed;border-collapse:collapse;margin:24px 0;background:#f0f7f6;border-left:3px solid #167d72"><tbody><tr><td style="${fonte}padding:16px">${forte('Confirme a previsão de devolução')}<br>${linhas(resto)}</td></tr></tbody></table>`;
    if (/^\d+\.\s/.test(primeira)) return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="table-layout:fixed;border-collapse:collapse;margin:0 0 12px;border:1px solid #e1e4e8;background:#fff"><tbody><tr><td style="${fonte}padding:12px 14px;border-bottom:1px solid #e1e4e8;background:#f8f9fa">${forte(primeira)}</td></tr><tr><td style="${fonte}font-size:13px;line-height:22px;padding:12px 14px">${campos(resto)}</td></tr></tbody></table>`;
    if (p.includes('Controle de Peças\nPositivo Tecnologia')) return `<p style="${fonte}margin:20px 0 0;padding-top:16px;border-top:1px solid #e5e7eb">${forte(primeira)}${resto ? '<br>' + linhas(resto) : ''}</p>`;
    return `<p style="${fonte}margin:0 0 18px">${n === 0 ? forte(p).replace(/\n/g, '<br>') : linhas(p)}</p>`;
  }).join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="${fonte}max-width:640px;margin:0 auto;border-collapse:collapse;table-layout:fixed;background:#fff;border:1px solid #dedede"><tbody><tr><td style="${fonte}padding:22px 24px;background:#111;color:#fff;border-bottom:3px solid #167d72"><strong style="font-size:22px;line-height:26px;font-weight:700;color:#fff">POSITIVO</strong><br><span style="font-size:10px;letter-spacing:2px;color:#fff">TECNOLOGIA</span></td></tr><tr><td style="${fonte}padding:24px"><p style="${fonte}font-size:11px;letter-spacing:1px;color:#616161;margin:0 0 8px">CONTROLE DE PEÇAS</p><h1 style="${fonte}font-size:20px;line-height:28px;font-weight:700;margin:0 0 24px;color:#171717">${esc(d.assunto)}</h1>${blocos}</td></tr></tbody></table>`;
}
async function copiarEmailFormatado(d) {
  if (!d.corpo.trim()) throw new Error('Preencha a mensagem antes de copiar.');
  if (!navigator.clipboard?.write || !window.ClipboardItem) throw new Error('Este navegador não permite copiar com formatação. Use Baixar rascunho (.eml) ou Copiar só texto.');
  try {
    await navigator.clipboard.write([new ClipboardItem({
      'text/html': new Blob([htmlEmailCobranca(d)], { type: 'text/html' }),
      'text/plain': new Blob([d.corpo], { type: 'text/plain' }),
    })]);
  } catch (_) {
    throw new Error('O navegador bloqueou a cópia com formatação. Permita o acesso à área de transferência ou use Baixar rascunho (.eml).');
  }
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
