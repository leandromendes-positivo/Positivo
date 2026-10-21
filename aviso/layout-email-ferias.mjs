// Tabelas e estilos inline mantêm a leitura mesmo em clientes com CSS limitado.
export const escaparEmail=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function linksEmailFerias(painel){
 try{
  const base=new URL(painel);
  if(base.protocol!=='https:'||base.username||base.password)return null;
  base.hash='';base.search='';if(!base.pathname.endsWith('/'))base.pathname+='/';
  return {painel:new URL('#ferias',base).href,logo:new URL('positivo-email-footer.png',base).href};
 }catch{return null;}
}
// As faixas externas são fluidas; apenas o texto tem largura de leitura limitada.
function faixaEmail(conteudo,{preto=false,classe='',padding='40px 32px'}={}){
 const fundo=preto?'#000000':'#ffffff';
 return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${fundo}" class="${preto?'email-preto':'email-painel'}" style="width:100%;background-color:${fundo}"><tr><td align="center" style="padding:0">
 <!--[if mso]><table role="presentation" width="680" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
 <table role="presentation" align="center" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:680px;margin:0 auto"><tr><td class="${classe}" style="padding:${padding};font-family:Arial,Helvetica,sans-serif">${conteudo}</td></tr></table>
 <!--[if mso]></td></tr></table><![endif]-->
 </td></tr></table>`;
}
export function layoutEmailFerias({titulo,resumo,conteudo,painel='',etiqueta='LEMBRETES DE FÉRIAS',botaoUrl='',textoBotao='Abrir programação de férias',rodapeMensagem='',rodapeDetalhe=''}){
 const esc=escaparEmail,links=linksEmailFerias(painel);
 const header=`<p class="email-cinza" style="margin:0 0 12px;color:#cccccc;font-size:11px;font-weight:700;letter-spacing:1.5px;line-height:1.6">GESTÃO DE COLABORADORES · ${esc(etiqueta)}</p>
 <h1 class="email-titulo email-branco" style="margin:0;color:#ffffff;font-size:32px;letter-spacing:-0.5px;line-height:1.2;font-weight:700">${esc(titulo)}</h1>
 <p class="email-cinza" style="margin:12px 0 0;color:#cccccc;font-size:16px;line-height:1.7">${esc(resumo)}</p>`;
 let destino=links?.painel;
 if(botaoUrl){const u=new URL(botaoUrl);if(u.protocol!=='https:'||u.username||u.password)throw new Error('Link de e-mail inválido');destino=u.href;}
 const cta=destino?`<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#000000" class="email-preto" style="background-color:#000000"><a class="email-branco" href="${esc(destino)}" style="display:inline-block;padding:16px 24px;border:1px solid #000000;background-color:#000000;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;line-height:1.5;text-decoration:none">${esc(textoBotao)}</a></td></tr></table>`:'';
 const footer=`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:0 0 12px">
 ${links?`<img src="${esc(links.logo)}" width="240" height="80" alt="Positivo Tecnologia" style="display:block;margin:0 auto;width:240px;max-width:100%;height:auto;background-color:#000000;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;text-align:center">`:'<p class="email-branco" style="margin:0;color:#ffffff;font-size:24px;font-weight:700">Positivo Tecnologia</p>'}
 </td></tr><tr><td align="center" class="email-cinza" style="font-family:Arial,Helvetica,sans-serif;color:#cccccc;font-size:12px;line-height:1.6;text-align:center">
 <p style="margin:0 0 12px">${rodapeMensagem?esc(rodapeMensagem):'Você recebe este e-mail pela sua inscrição no painel.<br>Para alterar o endereço, o horário ou desativar os avisos, acesse<br><strong class="email-branco" style="color:#ffffff">Férias da equipe → Lembretes por e-mail</strong>.'}</p>
 <p style="margin:0;color:#cccccc">${rodapeDetalhe?esc(rodapeDetalhe):'Gestão de colaboradores · Mensagem automática<br>Consulte o painel para conferir a programação atual.'}</p>
 </td></tr></table>`;
 return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(titulo)}</title><style>
 :root{color-scheme:light;supported-color-schemes:light}
 body,table,td,a{font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}table{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt}img{border:0;outline:none;text-decoration:none}a{color:#111111}
 .email-fundo,.email-painel,.email-cartao{background-color:#ffffff!important}.email-texto{color:#111111!important}.email-secundario{color:#555555!important}.email-preto{background-color:#000000!important;background-image:linear-gradient(#000000,#000000)}.email-branco{color:#ffffff!important}.email-cinza{color:#cccccc!important}
 @media only screen and (max-width:480px){.email-padding{padding:28px 20px!important}.email-header{padding:24px 20px!important}.email-titulo{font-size:28px!important}.email-pessoa{font-size:20px!important}.email-cta{padding:0 20px 36px!important}.email-footer{padding:20px!important}}
 </style></head><body class="email-fundo" bgcolor="#ffffff" style="width:100%;margin:0;padding:0;background-color:#ffffff;color:#111111;font-family:Arial,Helvetica,sans-serif">
 <div style="display:none;font-size:1px;line-height:1px;color:#ffffff;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${esc(resumo)}</div>
 ${faixaEmail(header,{preto:true,classe:'email-header',padding:'28px 32px'})}
 ${faixaEmail(conteudo,{classe:'email-padding email-texto',padding:'36px 32px'})}
 ${links?faixaEmail(cta,{classe:'email-cta',padding:'0 32px 40px'}):''}
 ${faixaEmail(footer,{preto:true,classe:'email-footer',padding:'20px 32px 24px'})}
 </body></html>`;
}
export function montarTesteFerias(painel=''){
 return layoutEmailFerias({titulo:'Teste de e-mail',resumo:'Este é o teste de e-mail que você solicitou no painel.',etiqueta:'TESTE DE ENVIO',painel,conteudo:`<h2 class="email-texto" style="margin:0 0 20px;color:#111111;font-size:26px;line-height:1.3;font-weight:700">Seu teste chegou.</h2><p class="email-texto" style="margin:0;color:#111111;font-size:17px;line-height:1.7">O envio de teste foi concluído. Este é o endereço informado para testar os lembretes das férias da equipe.</p><p class="email-secundario" style="margin:28px 0 0;padding-top:28px;border-top:1px solid #dddddd;color:#555555;font-size:15px;line-height:1.8">Os lembretes automáticos seguem o <strong>horário de Brasília</strong> e a <strong>antecedência</strong> escolhidos na sua inscrição. Este teste não altera nem antecipa os avisos programados.</p>`});
}
