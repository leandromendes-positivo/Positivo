// Preenche pela interface visível, mantendo o input ISO interno dos formulários.
export async function preencherData(campo, valor) {
  const page = campo.page();
  if (await page.locator('.calendario').count()) await page.keyboard.press('Escape');
  await campo.locator('..').locator('.seletor-data-botao').click();
  if (!valor) await page.locator('[data-cal-limpar]').click();
  else {
    if (!(await page.locator('.calendario-digitacao input').isVisible())) await page.locator('[data-cal-digitar]').click();
    await page.locator('.calendario-digitacao input').fill(valor.split('-').reverse().join('/'));
    await page.locator('.calendario-digitacao [type="submit"]').click();
  }
}
