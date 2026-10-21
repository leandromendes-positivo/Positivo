import {escaparEmail as esc,layoutEmailFerias} from './layout-email-ferias.mjs';
const paragrafo=texto=>`<p class="email-texto" style="margin:0 0 20px;color:#111111;font-size:16px;line-height:1.7">${esc(texto)}</p>`;
function layoutConta(opcoes){return layoutEmailFerias({...opcoes,etiqueta:'ACESSO AO PAINEL',rodapeMensagem:'Mensagem sobre o acesso ao painel Positivo. Não responda com senhas ou códigos de acesso.',rodapeDetalhe:'Positivo Tecnologia · Mensagem automática. Em caso de dúvida, procure o administrador do painel.'});}
export function emailAcessoTemporario({painel,email,senha,nome=''}){
 return layoutConta({titulo:'Seu acesso ao painel',resumo:'Os dados para seu primeiro acesso ou redefinição de senha.',painel,botaoUrl:painel,textoBotao:'Acessar o painel',conteudo:
  (nome?paragrafo('Olá, '+nome+'.'):'')+paragrafo('Seu acesso ao painel Positivo foi preparado. Use os dados abaixo para entrar.')+
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-top:1px solid #dddddd;border-bottom:1px solid #dddddd"><tr><td style="padding:20px 0"><p class="email-secundario" style="margin:0 0 6px;color:#555555;font-size:13px;line-height:1.5">E-mail cadastrado</p><p class="email-texto" style="margin:0 0 20px;color:#111111;font-size:16px;line-height:1.6;overflow-wrap:anywhere;word-break:break-word">${esc(email)}</p><p class="email-secundario" style="margin:0 0 6px;color:#555555;font-size:13px;line-height:1.5">Senha temporária</p><p class="email-texto" style="margin:0;color:#111111;font-family:Consolas,monospace;font-size:18px;line-height:1.6;overflow-wrap:anywhere;word-break:break-all">${esc(senha)}</p></td></tr></table>`+
  `<p class="email-texto" style="margin:24px 0 16px;color:#111111;font-size:16px;line-height:1.7"><strong>Válida por 24 horas.</strong> No primeiro acesso, você deverá definir sua própria senha.</p>`+paragrafo('Se não reconhecer este cadastro, procure o administrador do painel.')});
}
export function emailRecuperacao({painel,url}){
 return layoutConta({titulo:'Redefina sua senha',resumo:'Instruções para recuperar seu acesso com segurança.',painel,botaoUrl:url,textoBotao:'Definir nova senha',conteudo:
  paragrafo('Você solicitou a recuperação do acesso ao painel Positivo.')+paragrafo('Use o botão abaixo para definir sua nova senha. O link é válido por 15 minutos e só pode ser usado uma vez.')+paragrafo('Se não foi você quem solicitou, ignore esta mensagem. Sua senha atual continua válida.')});
}
