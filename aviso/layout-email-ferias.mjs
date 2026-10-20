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
export function layoutEmailFerias({titulo,resumo,conteudo,painel='',etiqueta='LEMBRETES DE FÉRIAS'}){
 const esc=escaparEmail,links=linksEmailFerias(painel);
 return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(titulo)}</title><style>
 :root{color-scheme:light;supported-color-schemes:light}
 body,table,td,a{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}table{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt}img{border:0;outline:none;text-decoration:none}a{color:#111111}
 .email-fundo,.email-painel,.email-cartao{background-color:#ffffff!important}.email-texto{color:#111111!important}.email-secundario{color:#555555!important}.email-preto{background-color:#000000!important;background-image:linear-gradient(#000000,#000000)}.email-branco{color:#ffffff!important}.email-cinza{color:#cccccc!important}
 @media only screen and (max-width:480px){.email-externo{padding:0!important}.email-padding{padding:32px 24px!important}.email-header{padding:44px 24px!important}.email-titulo{font-size:36px!important}.email-data{font-size:20px!important}.email-pessoa{font-size:22px!important}.email-cta{padding:0 24px 40px!important}.email-footer-texto{padding:8px 24px 40px!important}}
 </style></head><body class="email-fundo" bgcolor="#ffffff" style="margin:0;padding:0;background-color:#ffffff;color:#111111">
 <div style="display:none;font-size:1px;line-height:1px;color:#ffffff;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${esc(resumo)}</div>
 <table role="presentation" width="100%" class="email-fundo" bgcolor="#ffffff"><tr><td align="center" class="email-externo" style="padding:32px 12px">
 <!--[if mso]><table role="presentation" width="680" align="center"><tr><td><![endif]-->
 <table role="presentation" width="100%" class="email-painel" bgcolor="#ffffff" style="width:100%;max-width:680px;background-color:#ffffff">
 <tr><td bgcolor="#000000" class="email-preto email-header" style="padding:60px 44px;background-color:#000000">
 <p class="email-cinza" style="margin:0 0 24px;color:#cccccc;font-size:11px;font-weight:500;letter-spacing:2px;line-height:1.6">GESTÃO DE COLABORADORES<br>${esc(etiqueta)}</p>
 <h1 class="email-titulo email-branco" style="margin:0;color:#ffffff;font-size:44px;letter-spacing:-1px;line-height:1.12;font-weight:700">${esc(titulo)}</h1>
 <p class="email-cinza" style="margin:24px 0 0;color:#cccccc;font-size:17px;line-height:1.7">${esc(resumo)}</p></td></tr>
 <tr><td class="email-padding email-texto" bgcolor="#ffffff" style="padding:44px;color:#111111;font-size:17px;line-height:1.7">${conteudo}</td></tr>
 ${links?`<tr><td class="email-cta" style="padding:0 44px 48px"><table role="presentation" width="100%"><tr><td align="center" bgcolor="#000000" class="email-preto"><a class="email-branco" href="${esc(links.painel)}" style="display:block;padding:19px 12px;border:1px solid #000000;background-color:#000000;color:#ffffff;font-size:16px;font-weight:700;line-height:1.5;text-align:center;text-decoration:none">Abrir programação de férias</a></td></tr></table></td></tr>`:''}
 <tr><td bgcolor="#000000" class="email-preto" style="padding:0;background-color:#000000">
 ${links?`<img src="${esc(links.logo)}" width="680" alt="Positivo Tecnologia" style="display:block;width:100%;max-width:680px;height:auto;background-color:#000000;color:#ffffff;font-size:28px;font-weight:700;text-align:center">`:'<p class="email-branco" style="margin:0;padding:64px 24px;text-align:center;color:#ffffff;font-size:32px;font-weight:700">Positivo Tecnologia</p>'}
 </td></tr>
 <tr><td class="email-preto email-footer-texto" bgcolor="#000000" style="padding:8px 44px 48px;background-color:#000000">
 <p class="email-cinza" style="margin:0;color:#cccccc;font-size:13px;line-height:1.8">Você recebe este e-mail pela sua inscrição no painel. Para alterar o endereço, o horário ou desativar os avisos, acesse <strong class="email-branco" style="color:#ffffff">Férias da equipe → Lembretes por e-mail</strong>.</p>
 <p class="email-cinza" style="margin:24px 0 0;padding-top:24px;border-top:1px solid #444444;color:#cccccc;font-size:12px;line-height:1.8">Gestão de colaboradores · Mensagem automática<br>Consulte o painel para conferir a programação atual.</p>
 </td></tr></table><!--[if mso]></td></tr></table><![endif]-->
 </td></tr></table></body></html>`;
}
export function montarTesteFerias(painel=''){
 return layoutEmailFerias({titulo:'Teste de e-mail',resumo:'Este é o teste de e-mail que você solicitou no painel.',etiqueta:'TESTE DE ENVIO',painel,conteudo:`<h2 class="email-texto" style="margin:0 0 20px;color:#111111;font-size:26px;line-height:1.3;font-weight:700">Seu teste chegou.</h2><p class="email-texto" style="margin:0;color:#111111;font-size:17px;line-height:1.7">O envio de teste foi concluído. Este é o endereço informado para testar os lembretes das férias da equipe.</p><p class="email-secundario" style="margin:28px 0 0;padding-top:28px;border-top:1px solid #dddddd;color:#555555;font-size:15px;line-height:1.8">Os lembretes automáticos seguem o <strong>horário de Brasília</strong> e a <strong>antecedência</strong> escolhidos na sua inscrição. Este teste não altera nem antecipa os avisos programados.</p>`});
}
