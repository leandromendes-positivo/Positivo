import {abrirServicoFerias,verificarServicoFerias} from './servico-ferias.mjs';
import {processarTestesFerias} from './testes-ferias.mjs';
import {processarLembretes} from './lembretes-ferias.mjs';
try{
 const servico=await abrirServicoFerias();
 const estado=await verificarServicoFerias(servico);
 const testes=await processarTestesFerias(servico,estado.habilitado);
 console.log(`Testes: ${testes.enviados} aceitos; ${testes.falhas} falhas; ${testes.indisponiveis} sem remetente.`);
 if(!estado.habilitado)throw new Error('Serviço de e-mail indisponível. Confira GMAIL_USUARIO e GMAIL_SENHA_APP e a autenticação SMTP.');
 const resultado=await processarLembretes({...servico,painel:process.env.PAINEL_URL||'',simular:process.env.LEMBRETES_SIMULAR==='1'});
 await servico.db.doc('servicos/lembretes-ferias').set({ultimoProcessamento:new Date().toISOString(),ultimaExecucaoSemFalhas:resultado.falhas===0&&resultado.pendentes===0},{merge:true});
 console.log(`Lembretes de férias: ${resultado.enviados} mensagens aceitas; ${resultado.ignorados} saídas já processadas; ${resultado.falhas} falhas; ${resultado.pendentes} tentativas aguardando conferência.`);
 if(resultado.falhas||resultado.pendentes)throw new Error('Há envios que falharam ou aguardam conferência. Verifique caixa_lembretes_ferias no Firestore; resultados incertos não são reenviados automaticamente.');
}catch(e){console.error(`::error title=Lembretes de férias::${e.message?.startsWith('Serviço de')||e.message?.startsWith('Há envios')?e.message:'Falha no processamento. Confira a configuração do serviço e o registro da execução, sem compartilhar credenciais.'}`);process.exitCode=1;}
