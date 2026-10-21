import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
let resposta,modal,administrador=true;const timers=[];
const contexto=vm.createContext({URL,crypto:{randomUUID:()=> 'operacao-teste'},setTimeout:fn=>timers.push(fn),Acesso:{usuario:{uid:'admin'}},UI:{pagina:'usuarios'},podeAdministrar:()=>administrador,exigirAdministrador:()=>{if(!administrador)throw Error('Sem acesso');},esc:s=>String(s).replaceAll('<','&lt;'),renderizar:()=>{},confirmarAdministradorSenha:async()=>{},solicitarConta:async()=>resposta,abrirModal:op=>{modal=op;return{el:{querySelector:()=>({}),querySelectorAll:()=>[]}};}});
vm.runInContext(fs.readFileSync('src/js/79-usuarios.js','utf8'),contexto);
for(const enviado of [true,false]){
 resposta={gerado:true,enviado,email:'pessoa@empresa.com',link:'https://positivo.pages.dev/',senhaTemporaria:'Senha-temporaria-teste'};
 await vm.runInContext("enviarSenhaUsuario('pessoa@empresa.com',true)",contexto);
 assert.match(modal.corpo,/Senha-temporaria-teste/);assert.match(modal.corpo,/https:\/\/positivo.pages.dev\//);assert.match(modal.rodape,/Copiar dados/);
 assert.match(vm.runInContext('avisoEnviosAcesso()',contexto),/Ver link e senha temporária/);
 modal.aoFechar();assert.match(vm.runInContext("resultadosEnviosAcesso().get('pessoa@empresa.com').acesso.senhaTemporaria",contexto),/Senha-temporaria/);
 timers.pop()();assert.equal(vm.runInContext("resultadosEnviosAcesso().get('pessoa@empresa.com').acesso",contexto),undefined);
}
resposta={enviado:true};await vm.runInContext("enviarSenhaUsuario('pessoa@empresa.com',true)",contexto);assert.match(vm.runInContext('avisoEnviosAcesso()',contexto),/publicação do Worker/);
console.log('Acesso gerado: exibição e cópia com e sem envio, reabertura temporária, expiração e alerta de Worker antigo passaram.');
