// Mantém as falhas de cada motor visíveis no resumo público, sem credenciais.
try {
  await import('./sessao-email-e2e.mjs');
} catch(e) {
  const detalhe=String(e.stack||e).replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A');
  console.error(`::error title=Sessão ${process.env.PW_BROWSER||'chromium'}::${detalhe}`);
  process.exitCode=1;
}
