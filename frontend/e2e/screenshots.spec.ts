import { expect, Page, test } from '@playwright/test';

/**
 * Regenerates the README screenshots in docs/screenshots. Skipped in normal runs:
 *   SCREENSHOTS=1 npx playwright test screenshots
 * Needs a running stack with at least one casco submission that has LPG.
 */
test.skip(!process.env['SCREENSHOTS'], 'set SCREENSHOTS=1 to regenerate README images');
test.use({ viewport: { width: 1440, height: 900 } });

const shot = (page: Page, name: string) =>
  page.screenshot({ path: `../docs/screenshots/${name}.png`, animations: 'disabled' });

test('designer', async ({ page }) => {
  await page.goto('/designer/casco-risk/1');
  await page.getByRole('button', { name: 'LPG Marka, Açılır liste' }).click();
  await expect(page.getByText('Koşullar')).toBeVisible();
  await shot(page, 'designer');
});

test('rule editor', async ({ page }) => {
  await page.goto('/designer/new');
  await page.getByRole('button', { name: 'Evet / Hayır ekle' }).click();
  await page.getByRole('textbox', { name: 'Etiket', exact: true }).fill('Araçta LPG var mı?');
  await page.getByRole('textbox', { name: 'Id', exact: true }).fill('hasLpg');
  await page.getByRole('textbox', { name: 'Id', exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Açılır liste ekle' }).click();
  // The first "Etiket" is the field's; the others belong to its options.
  await page.getByRole('textbox', { name: 'Etiket', exact: true }).first().fill('LPG Marka');
  const rule = page.locator('app-expression-editor textarea').first();
  await rule.fill('hasLpg = true');
  await expect(page.getByText("'=' yerine '==' kullanın")).toBeVisible();
  await rule.fill('has');
  await rule.press('End');
  await expect(page.getByRole('option', { name: /hasLpg/ })).toBeVisible();
  await shot(page, 'rule-editor');
});

test('preview', async ({ page }) => {
  await page.goto('/designer/health-risk/1');
  await page.getByRole('tab', { name: 'Önizleme' }).click();
  await page.getByRole('textbox', { name: 'Ad Soyad' }).fill('Mehmet Demir');
  await page.getByRole('textbox', { name: 'Doğum Tarihi' }).fill('02.11.1985');
  await page.getByRole('textbox', { name: 'Doğum Tarihi' }).press('Tab');
  await expect(page.locator('.dyn-computed-value').first()).not.toHaveText('—');
  await shot(page, 'preview');
});

test('fill', async ({ page }) => {
  await page.goto('/fill/casco-risk');
  await page.getByRole('textbox', { name: 'Plaka' }).fill('34ABC123');
  await page.getByRole('spinbutton', { name: 'Model Yılı' }).fill('2018');
  await page.getByRole('combobox', { name: 'Yakıt Tipi' }).click();
  await page.getByRole('option', { name: 'Benzin' }).click();
  await page.getByRole('radio', { name: 'Evet' }).check();
  await page.getByRole('textbox', { name: 'Araç Kasko Değeri' }).fill('1250000');
  await page.getByRole('textbox', { name: 'Araç Kasko Değeri' }).press('Tab');
  await expect(page.getByText('LPG Marka')).toBeVisible();
  await page.locator('mat-sidenav-content').evaluate((el) => (el.scrollTop = 140));
  await shot(page, 'fill');
});

test('submissions', async ({ page }) => {
  await page.goto('/submissions');
  await page.getByRole('button', { name: "Örnek: LPG'li araçlar" }).click();
  await page.locator('table.submissions tr.mat-mdc-row button').first().click();
  await expect(page.locator('.detail')).toBeVisible();
  await shot(page, 'submissions');
});
