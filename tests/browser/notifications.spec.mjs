import { test, expect } from '@playwright/test';
import { renderedTextPairs } from './helpers/rendered-contrast.mjs';

async function openClockedLab(page) {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.clock.install({time:new Date('2026-11-20T12:00:00Z')});
  await page.goto('/');
  await page.getByRole('button',{name:'Profile',exact:true}).first().click();
  await page.getByRole('button',{name:'Error Lab',exact:true}).click();
  await expect(page.locator('.plate-loading')).toHaveCount(0);
  await page.clock.pauseAt(new Date('2026-11-20T12:01:00Z'));
}
const code = (page, value) => page.getByRole('button',{name:new RegExp(`^${value} `)});

test('neighboring notices, dismissal and preference changes preserve the original toast deadline', async ({page}) => {
  await openClockedLab(page);
  await code(page,'SOURCE_FETCH_FAILED').click();
  const first = page.locator('.notification-toasts').getByRole('alert',{name:'Source fetch failed',exact:true});
  await page.clock.runFor(4000);
  await code(page,'INSTRUCTION_CONFLICT').click();
  await page.getByRole('button',{name:'Dismiss Instruction conflict',exact:true}).click();
  await page.getByRole('button',{name:'Preferences',exact:true}).click();
  await page.getByRole('switch',{name:'Informational toasts',exact:true}).click();
  await page.clock.runFor(999);
  await expect(first).toBeVisible();
  await page.clock.runFor(1);
  await expect(first).toHaveCount(0);
  await page.getByText('Recent feedback (1)',{exact:true}).click();
  const review = page.getByRole('region',{name:'Recent feedback',exact:true});
  await expect(review.getByRole('article',{name:'Source fetch failed',exact:true})).toBeVisible();
  await review.getByRole('button',{name:'Dismiss Source fetch failed',exact:true}).click();
  await expect(review.getByText('Feedback is clear.',{exact:true})).toBeVisible();
});

test('active repeats keep the deadline; a later attempt gets fresh feedback', async ({page}) => {
  await openClockedLab(page);
  const success = page.getByRole('button',{name:'success toast',exact:true});
  await success.click();
  await page.clock.runFor(4000);
  await success.click();
  await expect(page.getByRole('status',{name:'Success notice preview',exact:true}).getByLabel('2 occurrences')).toBeVisible();
  await page.clock.runFor(1000);
  await expect(page.getByRole('status',{name:'Success notice preview',exact:true})).toHaveCount(0);
  await success.click();
  await expect(page.getByRole('status',{name:'Success notice preview',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'raise info banner',exact:true}).click();
  await page.setViewportSize({width:390,height:600});
  await page.clock.runFor(5000);
  await expect(page.getByRole('status',{name:'Success notice preview',exact:true})).toHaveCount(0);
  await expect(page.getByRole('status',{name:'Heads up',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Dismiss Heads up',exact:true}).click();
});

test('bursts retain bounded readable feedback with an explicit capacity receipt on mobile', async ({page}) => {
  await openClockedLab(page);
  await page.getByRole('group',{name:'Appearance',exact:true}).getByRole('radio',{name:'Light',exact:true}).check();
  for(let i=0;i<55;i++) await code(page,'SOURCE_FETCH_FAILED').click();
  await page.getByRole('button',{name:'raise info banner',exact:true}).click();
  await expect(page.locator('.notification-toasts .notification-item')).toHaveCount(3);
  await expect(page.locator('.notification-banners .notification-item')).toHaveCount(1);
  for (const selector of ['.notification-dock','.notification-banners']) {
    await expect.poll(async()=> (await renderedTextPairs(page.locator(selector))).filter(p=>p.ratio<4.5)).toEqual([]);
  }
  await page.screenshot({path:'.visual-runs/notifications-light-desktop.png'});
  await page.setViewportSize({width:390,height:600});
  await page.getByText('Recent feedback (50)',{exact:true}).click();
  const review=page.getByRole('region',{name:'Recent feedback',exact:true});
  await expect(review.getByRole('article')).toHaveCount(50);
  await expect(review.getByText('Capacity limit: 6 message details omitted.',{exact:true})).toBeVisible();
  for(const mode of ['light','contrast','dark']) {
    await page.getByRole('combobox',{name:'Appearance',exact:true}).selectOption(mode);
    if(mode!=='dark') await expect.poll(async()=> (await renderedTextPairs(review)).filter(p=>p.ratio<4.5)).toEqual([]);
    const box=await review.boundingBox();
    expect(box.height).toBeLessThanOrEqual(361);
    expect(box.y+box.height).toBeLessThan(600);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
    await page.screenshot({path:`.visual-runs/notifications-${mode}-mobile.png`});
  }
  await review.getByRole('button',{name:'Clear feedback',exact:true}).click();
  await expect(review.getByRole('article')).toHaveCount(0);
  await expect(review.getByText('Feedback is clear.',{exact:true})).toBeVisible();
});


test('a repeated hidden toast returns to the visible stack before its original expiry', async ({page}) => {
  await openClockedLab(page);
  await page.getByRole('button',{name:'success toast',exact:true}).click();
  for(const value of ['SOURCE_FETCH_FAILED','INSTRUCTION_CONFLICT','STREAM_TIMEOUT']) await code(page,value).click();
  await expect(page.locator('.notification-toasts').getByText('Success notice preview',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'success toast',exact:true}).click();
  await expect(page.locator('.notification-toasts').getByRole('status',{name:'Success notice preview',exact:true}).getByLabel('2 occurrences')).toBeVisible();
  await page.clock.runFor(5000);
  await expect(page.locator('.notification-toasts .notification-item')).toHaveCount(0);
});

test('an unavailable feedback chunk leaves messages and dismiss controls usable', async ({page}) => {
  await page.route('**/assets/NotificationOverlay-*.js', route=>route.abort());
  await openClockedLab(page);
  await code(page,'SOURCE_FETCH_FAILED').click();
  const fallback=page.getByRole('region',{name:'Recent feedback',exact:true});
  await expect(fallback.getByText('Recent feedback',{exact:true})).toBeVisible();
  await expect(fallback).toContainText('Source fetch failed');
  await expect(fallback).toContainText('ref: err_');
  await fallback.getByRole('button',{name:'Dismiss Source fetch failed',exact:true}).click();
  await expect(fallback).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Error Lab',exact:true})).toBeVisible();
});


test('pending feedback code keeps accepted messages visible on their original deadlines', async ({page}) => {
  let release;
  const held = new Promise(resolve=>{release=resolve;});
  await page.route('**/assets/NotificationOverlay-*.js', async route=>{await held;await route.continue();});
  try {
    await openClockedLab(page);
    await page.getByRole('button',{name:'success toast',exact:true}).click();
    const fallback=page.getByRole('region',{name:'Recent feedback',exact:true});
    await expect(fallback).toContainText('Success notice preview');
    await page.clock.runFor(4999);
    await expect(fallback).toContainText('Success notice preview');
    await page.clock.runFor(1);
    await expect(fallback).toHaveCount(0);
    await code(page,'SOURCE_FETCH_FAILED').click();
    await page.clock.runFor(6000);
    await expect(fallback).toContainText('Source fetch failed');
    await expect(fallback.getByRole('button',{name:'Dismiss Source fetch failed',exact:true})).toBeVisible();
    release();
    await page.getByText('Recent feedback (1)',{exact:true}).click();
    await expect(page.getByRole('article',{name:'Source fetch failed',exact:true})).toBeVisible();
  } finally { release(); }
});
