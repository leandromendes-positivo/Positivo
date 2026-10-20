// Anota falhas no resumo do Actions antes de impedir a publicação das regras.
try {
  await import('./seguranca-regras.mjs');
  await import('./portal-regras.mjs');
  await import('./portal-e2e.mjs');
  await import('./lembretes-ferias-regras.mjs');
  await import('./lembretes-ferias-e2e.mjs');
  await import('./limpeza-pecas.mjs');
  await import('./sessao-email-e2e.mjs');
  await import('./ferias-planejamento-e2e.mjs');
} catch(e) {
  console.error(`::error title=Falha nos testes de acesso::${String(e.stack||e).replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A')}`);
  process.exitCode=1;
}
