import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const ctx=vm.createContext({TextDecoder,Uint8Array,window:{}});
vm.runInContext(fs.readFileSync('src/js/00-util.js','utf8')+'\n'+fs.readFileSync('src/js/10-leitura.js','utf8'),ctx);
const arquivo=(nome,buffer)=>({name:nome,arrayBuffer:async()=>Uint8Array.from(buffer).buffer});
const cab='Técnico;Nota Fiscal;Remessa;Material Solicitado;Material Solicitado Descrição;Material Enviado;Material Enviado Descrição;Chamado;Data FT;Qtd;\r\n';
const linha='PESSOA TESTE;LT:001;000123;000007;Descrição;000007;Descrição;000456;20/10/2026 10:54:00;2;';
const r=await ctx.lerRelatorio(arquivo('PR RMDF.csv',Buffer.from(cab+linha,'latin1')));
assert.equal(r.tipo,'rmdf');assert.equal(r.regiao,'PR');assert.equal(r.itens[0].qtd,2);assert.equal(r.itens[0].nf,'LT:001');assert.equal(r.itens[0].remessa,'000123');assert.equal(r.itens[0].chamado,'000456');assert.equal(r.itens[0].dataFT,'2026-10-20 10:54');assert.equal(r.linhasIgnoradas,0);
assert.equal((await ctx.lerRelatorio(arquivo('PR Usadas.csv',Buffer.from(cab+linha)))).tipo,'usadas');
assert.equal((await ctx.lerRelatorio(arquivo('PR Novas.csv',Buffer.from(cab.replace('Data FT','TIPO')+linha)))).tipo,'novas');
assert.equal((await ctx.lerRelatorio(arquivo('sem-nome.csv',Buffer.from(cab+linha)),{tipo:'rmdf',regiao:'SC'})).tipo,'rmdf');
for(const quantidade of ['','0','-1','1,5','texto'])await assert.rejects(()=>ctx.lerRelatorio(arquivo('PR RMDF.csv',Buffer.from(cab+linha.replace(';2;',';'+quantidade+';')))),/linha 2/);
const vazio=await ctx.lerRelatorio(arquivo('PR RMDF.csv',Buffer.from(cab)));assert.equal(vazio.itens.length,0);
if(process.env.ARQUIVO_RMDF_TESTE){const real=await ctx.lerRelatorio(arquivo('PR RMDF.csv',fs.readFileSync(process.env.ARQUIVO_RMDF_TESTE)));console.log('Exemplo anexado validado localmente:',JSON.stringify({tipo:real.tipo,uf:real.regiao,linhas:real.itens.length,quantidade:real.itens.reduce((s,p)=>s+p.qtd,0),ignoradas:real.linhasIgnoradas}));}
console.log('Leitura RMDF: prioridade sobre cabeçalho de usadas, Latin-1, referências preservadas, seleção manual, arquivo vazio e quantidades inválidas passaram.');
