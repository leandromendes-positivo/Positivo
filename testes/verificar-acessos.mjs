// Anota falhas no resumo do Actions antes de impedir a publicação das regras.
try {
  await import('./seguranca-regras.mjs');
  await import('./portal-regras.mjs');
  await import('./portal-e2e.mjs');
} catch(e) {
  console.error(`::error title=Falha nos testes de acesso::${String(e.stack||e).replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A')}`);
  process.exitCode=1;
}
