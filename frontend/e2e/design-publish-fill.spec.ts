import { expect, test } from '@playwright/test';

/**
 * The whole product loop through the real UI and API: design a form from scratch, publish it,
 * fill it in (the conditional question appears and is enforced), and find the stored answer.
 */
test('design → publish → fill → see the answer in the list', async ({ page }) => {
  const formId = `e2e-${Date.now()}`;
  const breed = `Golden ${Date.now()}`;

  await test.step('design a new form', async () => {
    await page.goto('/designer/new');
    await page.getByRole('textbox', { name: 'Form id' }).fill(formId);
    await page.getByRole('textbox', { name: 'Başlık' }).fill('E2E Evcil Hayvan');

    await page.getByRole('button', { name: 'Evet / Hayır ekle' }).click();
    await page.getByRole('textbox', { name: 'Etiket', exact: true }).fill('Hayvanınız köpek mi?');
    await page.getByRole('textbox', { name: 'Id', exact: true }).fill('isDog');
    await page.getByRole('textbox', { name: 'Id', exact: true }).press('Enter');
    await page.getByRole('switch', { name: 'Zorunlu' }).click();

    await page.getByRole('button', { name: 'Metin ekle', exact: true }).click();
    await page.getByRole('textbox', { name: 'Etiket', exact: true }).fill('Köpeğinizin cinsi');
    const rules = page.locator('app-expression-editor textarea');
    await rules.nth(0).fill('isDog == true');
    await rules.nth(1).fill('isDog == true');
    await rules.nth(1).press('Escape');

    await expect(page.getByText('koşullu görünür')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Geçerli' })).toBeVisible(); // server-side check passed
  });

  await test.step('preview with the real renderer', async () => {
    await page.getByRole('tab', { name: 'Önizleme' }).click();
    await expect(page.locator('dyn-form-renderer')).toContainText('Hayvanınız köpek mi?');
    await page.getByRole('tab', { name: 'Tasarım' }).click();
  });

  await test.step('publish', async () => {
    await page.getByRole('button', { name: 'Yayınla' }).click();
    await expect(page.getByText('Yayında · v1 · salt okunur')).toBeVisible();
  });

  await test.step('fill it in', async () => {
    await page.getByRole('link', { name: 'Doldur', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'E2E Evcil Hayvan' })).toBeVisible();
    const breedBox = page.getByRole('textbox', { name: 'Köpeğinizin cinsi' });
    await expect(breedBox).toHaveCount(0); // hidden until the answer is "Evet"

    await page.getByRole('radio', { name: 'Evet' }).check();
    await page.getByRole('button', { name: 'Gönder' }).click();
    await expect(page.getByText('Bu alan zorunlu')).toBeVisible(); // now required, still empty

    await breedBox.fill(breed);
    await page.getByRole('button', { name: 'Gönder' }).click();
    await expect(page.getByText('Cevabınız kaydedildi')).toBeVisible();
  });

  await test.step('find the answer in the submissions list', async () => {
    await page.getByRole('link', { name: 'Gelen cevaplar', exact: true }).click();
    await page.getByRole('textbox', { name: 'Alan', exact: true }).fill('isDog');
    await page.getByRole('textbox', { name: 'Değer', exact: true }).fill('true');
    await page.getByRole('button', { name: 'Filtrele' }).click();

    await expect(page.getByText('1 cevap')).toBeVisible();
    await expect(page.getByRole('cell', { name: new RegExp(breed) })).toBeVisible();
  });
});

test('the four example forms are published and open', async ({ page }) => {
  await page.goto('/fill');
  for (const title of [
    'Kasko Risk Formu',
    'Konut Sigortası Risk Formu',
    'Tamamlayıcı Sağlık Sigortası Beyan Formu',
    'Seyahat Sağlık Sigortası Formu',
  ]) {
    await expect(page.getByText(title, { exact: true })).toBeVisible();
  }
  await page.getByRole('link', { name: 'Doldur', exact: true }).first().click();
  await expect(page.locator('dyn-form-renderer mat-stepper')).toBeVisible();
});
