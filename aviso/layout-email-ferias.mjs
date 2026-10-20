// Tabelas e estilos inline mantêm a leitura mesmo em clientes com CSS limitado.
export const escaparEmail=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function linksEmailFerias(painel){
 try{
  const base=new URL(painel);
  if(base.protocol!=='https:'||base.username||base.password)return null;
  base.hash='';base.search='';if(!base.pathname.endsWith('/'))base.pathname+='/';
  return {painel:new URL('#ferias',base).href,logo:new URL('positivo-email.png',base).href};
 }catch{return null;}
}
export function layoutEmailFerias({titulo,resumo,conteudo,painel='',etiqueta='LEMBRETES DE FÉRIAS'}){
 const esc=escaparEmail,links=linksEmailFerias(painel);
 return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${esc(titulo)}</title><style>
 :root{color-scheme:light dark;supported-color-schemes:light dark}
 body,table,td,a{font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}table{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt}img{border:0;outline:none;text-decoration:none}a{color:#155e63}
 @media only screen and (max-width:480px){.email-externo{padding:16px 8px!important}.email-padding{padding:24px 20px!important}.email-card{padding:20px 16px!important}.email-titulo{font-size:26px!important}.email-data{font-size:19px!important}.email-botao{display:block!important}.email-pessoa{font-size:17px!important}}
 @media (prefers-color-scheme:dark){.email-fundo{background-color:#101820!important}.email-painel{background-color:#1b2631!important}.email-cartao{background-color:#222f3c!important;border-color:#405160!important}.email-texto{color:#f2f6fa!important}.email-secundario{color:#c4cfdb!important}.email-linha{border-color:#405160!important}.email-footer{background-color:#17212b!important}.email-link{color:#9fddd7!important}.email-selo{background-color:#183d3c!important;color:#bdebe4!important}.email-urgente{background-color:#442c1c!important;color:#ffd7ac!important}}
 [data-ogsc] .email-fundo{background-color:#101820!important}[data-ogsc] .email-painel{background-color:#1b2631!important}[data-ogsc] .email-cartao{background-color:#222f3c!important;border-color:#405160!important}[data-ogsc] .email-texto{color:#f2f6fa!important}[data-ogsc] .email-secundario{color:#c4cfdb!important}[data-ogsc] .email-footer{background-color:#17212b!important}[data-ogsc] .email-link{color:#9fddd7!important}
 </style></head><body class="email-fundo" bgcolor="#eef2f5" style="margin:0;padding:0;background-color:#eef2f5;font-family:Arial,Helvetica,sans-serif;color:#172b3a">
 <div style="display:none;font-size:1px;line-height:1px;color:#eef2f5;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${esc(resumo)}</div>
 <table role="presentation" width="100%" class="email-fundo" bgcolor="#eef2f5" style="width:100%;background-color:#eef2f5"><tr><td align="center" class="email-externo" style="padding:32px 12px">
 <!--[if mso]><table role="presentation" width="640" align="center"><tr><td><![endif]-->
 <table role="presentation" width="100%" class="email-painel" bgcolor="#ffffff" style="width:100%;max-width:640px;background-color:#ffffff;border-radius:16px;overflow:hidden">
 <tr><td bgcolor="#142e38" class="email-padding" style="padding:32px;background-color:#142e38;border-top:5px solid #70c9b7">
 <p style="margin:0 0 14px;color:#bce8df;font-size:11px;font-weight:bold;letter-spacing:1.8px;line-height:1.5">GESTÃO DE PESSOAS &nbsp;/&nbsp; ${esc(etiqueta)}</p>
 <h1 class="email-titulo" style="margin:0;color:#ffffff;font-size:30px;line-height:1.2;font-weight:bold">${esc(titulo)}</h1>
 <p style="margin:12px 0 0;color:#e0edf0;font-size:15px;line-height:1.6">${esc(resumo)}</p></td></tr>
 <tr><td class="email-padding email-texto" style="padding:28px 32px;color:#172b3a;font-size:15px;line-height:1.6">${conteudo}</td></tr>
 ${links?`<tr><td class="email-padding" style="padding:0 32px 28px"><table role="presentation" width="100%"><tr><td align="center" bgcolor="#155e63" style="background-color:#155e63;border-radius:8px"><a class="email-botao" href="${esc(links.painel)}" style="display:block;border:14px solid #155e63;border-radius:8px;background-color:#155e63;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;line-height:1.5;text-align:center;text-decoration:none">Abrir programação de férias &nbsp; →</a></td></tr></table></td></tr>`:''}
 <tr><td class="email-footer email-padding email-linha" bgcolor="#f6f8fa" style="padding:26px 32px;background-color:#f6f8fa;border-top:1px solid #dce4eb">
 <p class="email-secundario" style="margin:0 0 16px;color:#526577;font-size:12px;line-height:1.7">Você recebe esta mensagem pela sua inscrição no painel. Para alterar o e-mail, o horário ou desativar os avisos, acesse <strong>Férias da equipe → Lembretes por e-mail</strong>.</p>
 ${links?`<table role="presentation"><tr><td bgcolor="#ffffff" style="background-color:#ffffff;border:1px solid #dce4eb;border-radius:8px"><img src="${esc(links.logo)}" width="194" height="81" alt="Positivo Tecnologia" style="display:block;width:194px;height:81px;max-width:100%;background-color:#ffffff;color:#142e38;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold"></td></tr></table>`:'<p class="email-texto" style="margin:0;color:#172b3a;font-size:18px;font-weight:bold">Positivo Tecnologia</p>'}
 <p class="email-secundario" style="margin:14px 0 0;color:#526577;font-size:11px;line-height:1.7">Gestão de colaboradores · Mensagem automática<br>Consulte o painel para conferir a programação atual.</p>
 </td></tr></table><!--[if mso]></td></tr></table><![endif]-->
 </td></tr></table></body></html>`;
}
export function montarTesteFerias(painel=''){
 return layoutEmailFerias({titulo:'Teste de e-mail',resumo:'Este é o teste de e-mail que você solicitou no painel.',etiqueta:'TESTE DE ENVIO',painel,conteudo:`<table role="presentation" width="100%" class="email-cartao" bgcolor="#f5faf9" style="background-color:#f5faf9;border:1px solid #dce4eb;border-left:4px solid #26766f;border-radius:10px"><tr><td class="email-card" style="padding:24px"><h2 class="email-texto" style="margin:0 0 10px;color:#172b3a;font-size:20px;line-height:1.4">Teste dos lembretes de férias</h2><p class="email-texto" style="margin:0;color:#172b3a;font-size:15px;line-height:1.7">Se você está lendo esta mensagem, o e-mail de teste chegou à sua caixa.</p></td></tr></table><p class="email-secundario" style="margin:22px 0 0;color:#526577;font-size:14px;line-height:1.7">Os lembretes automáticos seguem o <strong>horário de Brasília</strong> e a <strong>antecedência</strong> escolhidos na sua inscrição. Este teste não altera nem antecipa os avisos programados.</p>`});
}
