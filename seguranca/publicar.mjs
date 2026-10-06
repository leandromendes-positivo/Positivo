// Executado no GitHub Actions com a credencial em Secret. Nunca inclui chaves no site.
import { readFile } from 'node:fs/promises';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getSecurityRules } from 'firebase-admin/security-rules';
// Exibe pré-requisitos sem expor credenciais nos avisos públicos do GitHub.
function falhaConfiguracao(mensagem) {
  console.error(`::error title=Configuração do acesso::${mensagem}`);
  return new Error(mensagem);
}
const config = JSON.parse(await readFile(new URL('../firebase-config.json',import.meta.url),'utf8'));
if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw falhaConfiguracao('Configure o Secret FIREBASE_SERVICE_ACCOUNT no repositório para publicar as regras de acesso.');
let credencial;
try { credencial = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT); }
catch { throw falhaConfiguracao("O Secret FIREBASE_SERVICE_ACCOUNT não contém um JSON válido."); }
if (credencial.project_id !== config.projectId) throw falhaConfiguracao('A credencial pertence a outro projeto. Publicação interrompida.');
const app = initializeApp({credential:cert(credencial),projectId:config.projectId});
const db = getFirestore(app);
const controle = db.doc('seguranca/controle');
const atual = await controle.get();
let email = atual.data()?.administradorPrincipal;
if (!email) {
  email = String(process.env.INITIAL_ADMIN_EMAIL || '').trim().toLowerCase();
  if (!/^[^\s/@]+@[^\s/@]+\.[^\s/@]+$/.test(email) || email.length > 254) throw falhaConfiguracao('Informe INITIAL_ADMIN_EMAIL nas Variables do repositório ou execute o workflow com o e-mail do administrador inicial.');
}
// Uma alteração de variável não troca nem recria o administrador principal existente.
await db.runTransaction(async tx => {
  const ref = db.doc(`usuarios/${email}`);
  const [snap, controleAtual] = await Promise.all([tx.get(ref),tx.get(controle)]);
  if (controleAtual.exists) {
    if (controleAtual.data().administradorPrincipal !== email) throw falhaConfiguracao("A configuração inicial foi alterada por outra implantação. Execute novamente.");
    if (!snap.exists || !snap.data().principal || !snap.data().ativo || snap.data().perfil !== 'administrador') throw falhaConfiguracao('O administrador principal precisa ser recuperado no console do Firebase antes de publicar.');
    return;
  }
  const por={uid:'implantacao',email}, em=FieldValue.serverTimestamp();
  tx.set(ref,{email,perfil:'administrador',ativo:true,principal:true,criadoEm:snap.data()?.criadoEm||em,criadoPor:snap.data()?.criadoPor||por,atualizadoEm:em,atualizadoPor:por});
  tx.set(controle,{versao:2,administradorPrincipal:email,atualizadoEm:em});
});
const source=await readFile(new URL('../firestore.rules',import.meta.url),'utf8');
await getSecurityRules(app).releaseFirestoreRulesetFromSource(source);
console.log('Regras de acesso publicadas e administrador principal validado.');
