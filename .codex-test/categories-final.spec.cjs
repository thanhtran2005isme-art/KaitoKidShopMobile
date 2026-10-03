const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const baseURL = 'http://localhost:8081';
const outDir = path.resolve('.codex-test');
const viewports = [
  { width: 390, height: 844 },
  { width: 393, height: 873 },
  { width: 412, height: 915 },
];

async function auditPage(page, viewport, screenshotName) {
  const consoleIssues = [];
  const pageErrors = [];
  const httpErrors = [];
  const requestFailures = [];
  page.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') consoleIssues.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) httpErrors.push(`${r.status()} ${r.url()}`); });
  page.on('requestfailed', r => requestFailures.push(`${r.url()} :: ${r.failure()?.errorText || 'failed'}`));

  await page.setViewportSize(viewport);
  await page.goto(`${baseURL}/categories`, { waitUntil: 'networkidle' });
  await expect(page.getByText('Danh mục', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/sản phẩm$/).last()).toBeVisible();
  const overflow = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    htmlScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  await page.screenshot({ path: path.join(outDir, screenshotName), fullPage: true });
  return { ...viewport, ...overflow, noHorizontalOverflow: overflow.htmlScrollWidth <= overflow.innerWidth && overflow.bodyScrollWidth <= overflow.innerWidth, consoleIssues, pageErrors, httpErrors, requestFailures };
}

test('final categories audit', async ({ browser }) => {
  const result = { viewports: [], interaction: {}, states: {} };
  for (const v of viewports) {
    const context = await browser.newContext({ viewport: v, reducedMotion: 'reduce' });
    const page = await context.newPage();
    result.viewports.push(await auditPage(page, v, `categories-final-${v.width}x${v.height}.png`));
    await context.close();
  }

  const context = await browser.newContext({ viewport: viewports[0], reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(`${baseURL}/categories`, { waitUntil: 'networkidle' });

  const female = page.getByRole('button', { name: 'Lọc sản phẩm Nữ' });
  result.interaction.femaleVisible = await female.isVisible().catch(() => false);
  if (result.interaction.femaleVisible) {
    await female.click();
    await page.waitForLoadState('networkidle');
    result.interaction.afterFemaleCount = await page.getByText(/sản phẩm$/).last().textContent();
  }

  const áo = page.getByRole('button', { name: 'Danh mục Áo' });
  result.interaction.categoryVisible = await áo.isVisible().catch(() => false);
  if (result.interaction.categoryVisible) {
    await áo.click();
    await page.waitForLoadState('networkidle');
    result.interaction.afterCategoryHeading = await page.getByText('Áo', { exact: true }).last().textContent().catch(() => null);
  }

  await page.goto(`${baseURL}/categories`, { waitUntil: 'networkidle' });
  const search = page.getByRole('button', { name: 'Tìm kiếm sản phẩm' });
  await search.click();
  await page.waitForURL('**/search');
  result.interaction.searchUrl = page.url();

  await page.goto(`${baseURL}/categories`, { waitUntil: 'networkidle' });
  const firstProduct = page.getByRole('button', { name: /^Xem / }).first();
  result.interaction.productLabel = await firstProduct.getAttribute('aria-label');
  await firstProduct.click();
  await page.waitForURL('**/product/**');
  result.interaction.productUrl = page.url();
  await context.close();

  const emptyContext = await browser.newContext({ viewport: viewports[0], reducedMotion: 'reduce' });
  const emptyPage = await emptyContext.newPage();
  await emptyPage.route('**/api/products?**', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], totalCount: 0, page: 1, pageSize: 40, totalPages: 0 }) });
  });
  await emptyPage.goto(`${baseURL}/categories`, { waitUntil: 'networkidle' });
  result.states.productEmptyVisible = await emptyPage.getByText('Chưa có sản phẩm', { exact: true }).isVisible().catch(() => false);
  result.states.productEmptyDescriptionVisible = await emptyPage.getByText('Hiện chưa có sản phẩm phù hợp với lựa chọn này.', { exact: true }).isVisible().catch(() => false);
  await emptyPage.screenshot({ path: path.join(outDir, 'categories-final-empty-390x844.png'), fullPage: true });
  await emptyContext.close();

  const productErrorContext = await browser.newContext({ viewport: viewports[0], reducedMotion: 'reduce' });
  const productErrorPage = await productErrorContext.newPage();
  await productErrorPage.route('**/api/products?**', async route => { await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'test failure' }) }); });
  await productErrorPage.goto(`${baseURL}/categories`, { waitUntil: 'networkidle' });
  result.states.productErrorVisible = await productErrorPage.getByText('Chưa tải được sản phẩm', { exact: true }).isVisible().catch(() => false);
  result.states.productRetryVisible = await productErrorPage.getByRole('button', { name: 'Thử lại' }).last().isVisible().catch(() => false);
  await productErrorContext.close();

  const categoryErrorContext = await browser.newContext({ viewport: viewports[0], reducedMotion: 'reduce' });
  const categoryErrorPage = await categoryErrorContext.newPage();
  await categoryErrorPage.route('**/api/categories**', async route => { await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'test failure' }) }); });
  await categoryErrorPage.goto(`${baseURL}/categories`, { waitUntil: 'networkidle' });
  result.states.categoryErrorVisible = await categoryErrorPage.getByText('Chưa tải được danh mục', { exact: true }).isVisible().catch(() => false);
  result.states.categoryRetryVisible = await categoryErrorPage.getByRole('button', { name: 'Thử lại' }).first().isVisible().catch(() => false);
  await categoryErrorContext.close();

  fs.writeFileSync(path.join(outDir, 'categories-final-audit.json'), JSON.stringify(result, null, 2));
  expect(result.viewports.every(v => v.noHorizontalOverflow)).toBeTruthy();
  expect(result.viewports.every(v => v.pageErrors.length === 0 && v.httpErrors.length === 0 && v.requestFailures.length === 0)).toBeTruthy();
  expect(result.states.productEmptyVisible).toBeTruthy();
  expect(result.states.productEmptyDescriptionVisible).toBeTruthy();
  expect(result.states.productErrorVisible).toBeTruthy();
  expect(result.states.categoryErrorVisible).toBeTruthy();
  expect(result.interaction.searchUrl).toContain('/search');
  expect(result.interaction.productUrl).toContain('/product/');
});
