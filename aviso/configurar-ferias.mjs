// Confere o remetente e atende o pedido único de teste do proprietário, sem exibir endereços.
import {abrirServicoFerias,verificarServicoFerias} from './servico-ferias.mjs';
import {solicitarTesteProprietario,processarTestesFerias,diagnosticarFilaTestes} from './testes-ferias.mjs';
try{
 const servico=await abrirServicoFerias();
 const estado=await verificarServicoFerias(servico);
 if(estado.externo){console.log('Lembretes de férias executados pelo Cloudflare; nenhum envio pelo GitHub.');}
 else {
 const solicitado=await solicitarTesteProprietario(servico.db,{retomarIndisponivel:estado.habilitado});
 if(!solicitado)console.log('::warning title=Teste de e-mail::Nenhuma inscrição disponível da conta principal para o teste solicitado. Cadastre o endereço no painel e use Enviar e-mail de teste.');
 const testes=await processarTestesFerias(servico,estado.habilitado);
 console.log(`::notice title=Teste de e-mail::${testes.enviados} mensagens de teste aceitas pelo servidor; ${testes.falhas} falhas; ${testes.indisponiveis} pedidos sem remetente disponível.`);
 const fila=await diagnosticarFilaTestes(servico.db);
 console.log(`::notice title=Fila de testes::${JSON.stringify(fila)}`);
 if(estado.habilitado)console.log('Lembretes de férias: configuração SMTP verificada. Serviço disponível para os lembretes e testes solicitados.');
 else console.log(`::warning title=Lembretes de férias::${estado.motivo==='credenciais_ausentes'?'Configure GMAIL_USUARIO e GMAIL_SENHA_APP nos Secrets do repositório para habilitar os envios.':'A conexão ou autenticação SMTP falhou. Confira a configuração do remetente nos Secrets.'}`);
 }
}catch(e){console.error('::error title=Configuração dos lembretes::Não foi possível validar e gravar a disponibilidade do serviço. Confira a credencial do projeto e o acesso ao Firestore.');process.exitCode=1;}
