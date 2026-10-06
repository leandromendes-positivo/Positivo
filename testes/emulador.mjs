// Somente emulador local. Nunca usa credenciais ou URLs do projeto real.
export async function prepararEmulador() {
  const base = 'http://127.0.0.1:8080';
  const projeto = 'demo-controle-pecas';
  try { await fetch('http://127.0.0.1:9099/'); }
  catch { throw new Error('O emulador de Authentication não está ativo na porta 9099. Inicie Auth e Firestore antes do teste.'); }
  const reset = await fetch(`${base}/emulator/v1/projects/${projeto}/databases/(default)/documents`, { method: 'DELETE' });
  if (!reset.ok) throw new Error('Não foi possível preparar o emulador local.');
  const doc = async (caminho, fields) => {
    const r = await fetch(`${base}/v1/projects/${projeto}/databases/(default)/documents/${caminho}`, { method:'PATCH', headers:{'Authorization':'Bearer owner','Content-Type':'application/json'}, body:JSON.stringify({fields}) });
    if (!r.ok) throw new Error(await r.text());
  };
  await doc('usuarios/teste@exemplo.com', {
    email:{stringValue:'teste@exemplo.com'},perfil:{stringValue:'administrador'},ativo:{booleanValue:true},principal:{booleanValue:true},
    criadoEm:{timestampValue:'2026-10-01T12:00:00Z'},atualizadoEm:{timestampValue:'2026-10-01T12:00:00Z'},
    criadoPor:{mapValue:{fields:{uid:{stringValue:'bootstrap'},email:{stringValue:'teste@exemplo.com'}}}},
    atualizadoPor:{mapValue:{fields:{uid:{stringValue:'bootstrap'},email:{stringValue:'teste@exemplo.com'}}}},
  });
  await doc('seguranca/controle',{versao:{integerValue:'2'}});
}
