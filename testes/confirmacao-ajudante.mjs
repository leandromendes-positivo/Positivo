import { preencherData } from './calendario-ajudante.mjs';
// Dados de preparação dos testes: registra a cobrança formal antes de uma previsão.
// Não substitui funções do produto nem contorna as regras do Firebase.
export async function instalarAgendaTeste(page) {
  await page.evaluate(()=>{
    window.garantirEmailTeste=async tid=>{
      let c=emailsFormais(tid)[0];
      if(!c){const itens=pecasCobranca(derivar().mapa.get(tid),'todas');await registrarCobranca(tid,{canal:'email',previsao:'',obs:'Cobrança formal fictícia de teste',itens,tipo:'mistas'});c=emailsFormais(tid)[0];}
      if(!c)throw new Error('A cobrança formal não ficou disponível após o registro.');
      return c;
    };
    window.agendarComEmailTeste=async(itens,data)=>{
      if(!data)return gravarAgendamentos(itens,'');
      for(const [tid,grupo] of agrupar(itens,i=>i.tid)){
        const contato=await garantirEmailTeste(tid);
        const selecionados=grupo.map(i=>({...i,versaoAgenda:E.agendamentos.find(a=>a.peca===i.k)?.versao||0,confirmacao:dadosConfirmacao({...i,tipo:i.tipo||'usadas'},i.qtd,0,contato.id,'Resposta fictícia por e-mail — confirmação de '+data)}));
        await gravarAgendamentos(selecionados,data);
      }
    };
  });
}
export async function preencherConfirmacaoTeste(page,data){
  const contato=page.locator('#confirmacao-contato');
  if(!(await contato.inputValue()))await contato.selectOption({index:1});
  await preencherData(page.locator('#confirmacao-data'),data);
  await page.locator('#confirmacao-email').fill('Re: Devolução de peças — resposta fictícia por e-mail');
  await page.locator('#confirmacao-ateste').check();
  await page.locator('[data-salvar-confirmacao]').click();
}
