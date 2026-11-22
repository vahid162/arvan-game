import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

// Sample a screenshot because WebGL may discard its drawing buffer after presentation.
async function expectFirefly(page: Page) {
  const screenshot = await page.locator('#glade').screenshot({ scale: 'css' });
  const colors = await page.evaluate(async (png) => {
    const image = new Image();
    image.src = 'data:image/png;base64,' + png;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext('2d')!;
    // The central part of the scene contains the amber firefly and its dark glade.
    context.drawImage(image, image.width / 4, image.height / 4,
      image.width / 2, image.height / 2, 0, 0, canvas.width, canvas.height);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let amber = 0;
    let dark = 0;
    for (let i = 0; i < data.length; i += 4) {
      const red = data[i]!;
      const green = data[i + 1]!;
      const blue = data[i + 2]!;
      if (red > 180 && green > 115 && blue < 160) amber++;
      if (red < 95 && green < 125 && blue < 125) dark++;
    }
    return { amber, dark };
  }, screenshot.toString('base64'));
  expect(colors.amber, 'visible amber firefly').toBeGreaterThan(5);
  expect(colors.dark, 'surrounding glade').toBeGreaterThan(100);
}

test('a fresh mobile viewport loads the production scene without errors', async ({ page, baseURL }) => {
  const errors: string[] = [];
  const resources: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => errors.push('Failed request: ' + request.url()));
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.protocol === 'data:') return;
    if (!response.ok() || url.origin !== baseURL) errors.push(response.status() + ' ' + url.href);
    resources.push(response.request().resourceType());
  });

  // Hold the bundle so the initial HTML can be checked independently of the renderer.
  let releaseBundle!: () => void;
  const bundleGate = new Promise<void>((resolve) => { releaseBundle = resolve; });
  await page.route('**/*.js', async (route) => {
    await bundleGate;
    await route.continue();
  });
  const shell = page.locator('#shell');
  try {
    await page.goto('/', { waitUntil: 'commit' });
    await expect(shell).toHaveAttribute('data-state', 'loading');
    await expect(page.getByRole('status')).toContainText(/load/i);
  } finally {
    releaseBundle();
  }
  await expect(shell).toHaveAttribute('data-state', 'ready');
  await expectFirefly(page);
  expect(resources).toEqual(expect.arrayContaining(['document', 'script', 'stylesheet']));
  expect(errors).toEqual([]);

  if (process.env.P01_CAPTURE === '1') {
    const directory = new URL('../../docs/evidence/', import.meta.url);
    await mkdir(directory, { recursive: true });
    await page.screenshot({ path: fileURLToPath(new URL('p01-mobile.png', directory)), scale: 'css' });
  }
});

test.describe('high-density viewport', () => {
  test.use({ deviceScaleFactor: 3 });

  test('resizing keeps the same scene canvas and WebGL context at capped density', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#shell')).toHaveAttribute('data-state', 'ready');
    const original = await page.evaluateHandle(() =>
      document.querySelector<HTMLCanvasElement>('#glade')!.getContext('webgl2'));
    for (const viewport of [{ width: 390, height: 844 }, { width: 900, height: 500 }]) {
      await page.setViewportSize(viewport);
      await expect.poll(() => page.evaluate(() => {
        const node = document.querySelector<HTMLCanvasElement>('#glade')!;
        const box = node.getBoundingClientRect();
        const parent = document.querySelector('#viewport')!.getBoundingClientRect();
        return box.width > 0 && box.height > 0 &&
          Math.abs(box.width - parent.width) <= 1 && Math.abs(box.height - parent.height) <= 1 &&
          Math.abs(node.width - 2 * box.width) <= 2 && Math.abs(node.height - 2 * box.height) <= 2;
      })).toBe(true);
      expect(await original.evaluate((context) => {
        const node = document.querySelector<HTMLCanvasElement>('#glade');
        return context !== null && context.canvas === node && node.getContext('webgl2') === context;
      })).toBe(true);
      await expectFirefly(page);
    }
  });
});

test('reduced motion starts still and the player can resume and pause the scene', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('#glade');
  const resume = page.getByRole('button', { name: 'Resume motion' });
  await expect(resume).toBeVisible();
  const initial = await canvas.screenshot();
  await resume.click();
  const pause = page.getByRole('button', { name: 'Pause motion' });
  await expect(pause).toBeVisible();
  await expect.poll(async () => (await canvas.screenshot()).equals(initial)).toBe(false);
  await pause.click();
  await expect(resume).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(resume).toBeVisible();
  const pausedFrame = await canvas.screenshot();
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  expect((await canvas.screenshot()).equals(pausedFrame)).toBe(true);
});

test('missing WebGL 2 gives a readable unsupported state', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = new Proxy(HTMLCanvasElement.prototype.getContext, {
      apply(target, canvas, args) {
        if (args[0] === 'webgl2') return null;
        return Reflect.apply(target, canvas, args);
      },
    });
  });
  await page.goto('/');
  await expect(page.locator('#shell')).toHaveAttribute('data-state', 'unsupported');
  const status = page.getByRole('status');
  await expect(status).toBeVisible();
  await expect(status).toContainText(/WebGL\s*2/i);
});

test('a transient graphics startup failure shows a message and recovers on reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    if (sessionStorage.getItem('p01-test-fault')) return;
    HTMLCanvasElement.prototype.getContext = new Proxy(HTMLCanvasElement.prototype.getContext, {
      apply(target, canvas, args) {
        if (args[0] === 'webgl2') {
          sessionStorage.setItem('p01-test-fault', 'injected');
          throw new Error('Injected graphics startup failure');
        }
        return Reflect.apply(target, canvas, args);
      },
    });
  });
  await page.goto('/');
  const shell = page.locator('#shell');
  await expect(shell).toHaveAttribute('data-state', 'failed');
  const status = page.getByRole('status');
  await expect(status).toBeVisible();
  await expect(status).toContainText(/retry|reload|try again|failed|couldn.t|unable/i);
  await page.getByRole('link', { name: /reload/i }).click();
  await expect(shell).toHaveAttribute('data-state', 'ready');
  await expectFirefly(page);
  expect(errors).toEqual([]);
});

for (const issue of ['missing', 'truncated'] as const) {
  test(`a ${issue} entry module leaves recovery instructions in the HTML shell`, async ({ page }) => {
    await page.route('**/*.js', (route) => issue === 'missing'
      ? route.abort('failed')
      : route.fulfill({ contentType: 'text/javascript', body: 'const incomplete =' }), { times: 1 });
    await page.goto('/');
    const shell = page.locator('#shell');
    await expect(shell).toHaveAttribute('data-state', 'failed');
    await expect(page.getByRole('status')).toContainText(/load/i);
    await page.getByRole('link', { name: /reload/i }).click();
    await expect(shell).toHaveAttribute('data-state', 'ready');
  });
}
