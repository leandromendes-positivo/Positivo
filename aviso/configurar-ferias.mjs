// Valida a configuração existente sem enviar mensagens nem exibir credenciais.
import {abrirServicoFerias,verificarServicoFerias} from './servico-ferias.mjs';
try{
 const estado=await verificarServicoFerias(await abrirServicoFerias());
 if(estado.habilitado)console.log('Lembretes de férias: configuração SMTP verificada. Nenhum e-mail enviado nesta validação.');
 else console.log(`::warning title=Lembretes de férias::${estado.motivo==='credenciais_ausentes'?'Configure GMAIL_USUARIO e GMAIL_SENHA_APP nos Secrets do repositório para habilitar os envios.':'A conexão ou autenticação SMTP falhou. Confira a configuração do remetente nos Secrets.'}`);
}catch(e){console.error('::error title=Configuração dos lembretes::Não foi possível validar e gravar a disponibilidade do serviço. Confira a credencial do projeto e o acesso ao Firestore.');process.exitCode=1;}
