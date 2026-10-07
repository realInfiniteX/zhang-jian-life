import { test, expect } from '@playwright/test';
import { NODES } from '../../dist/story.js';

test('a complete historical life, saved consequence, restart collection and timeline rewind',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('#story-title')).toHaveText('状元之后，何去何从');
  await expect(page.locator('.character')).toBeVisible();
  await expect(page.locator('.background-art')).toBeVisible();
  await page.locator('[data-choice="business"]').click();
  await page.reload();
  await expect(page.getByRole('button',{name:'继续人生',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'继续人生',exact:true}).click();
  let id='venture';
  while(!id.startsWith('end:')) {
    const c=NODES[id].choices.find(c=>c.historical);
    await page.locator(`[data-choice="${c.id}"]`).click();
    await page.locator('[data-action="continue"]').click();
    id=c.next;
  }
  await expect(page.locator('#story-title')).toHaveText('有用之人');
  await page.getByRole('button',{name:'人生图谱',exact:true}).last().click();
  await expect(page.locator('.atlas-card.unlocked')).toHaveCount(1);
  await page.locator('[data-action="close"]').click();
  await page.getByRole('button',{name:'回顾选择',exact:true}).click();
  await page.locator('[data-rewind="0"]').click();
  await expect(page.locator('#story-title')).toHaveText('状元之后，何去何从');
  await expect(page.locator('#progress-label')).toContainText('1 / 10');
  await expect(page.locator('#stats')).toContainText('50');
  expect(errors).toEqual([]);
});

test('education IF, undo, source dialog, and no horizontal clipping',async({page})=>{
  await page.goto('/');
  await page.locator('[data-choice="teaching"]').click();
  await page.getByRole('button',{name:'重新选择',exact:true}).click();
  await expect(page.locator('#story-title')).toHaveText('状元之后，何去何从');
  for(const choice of ['teaching','teachers','network','fund']) {
    await page.locator(`[data-choice="${choice}"]`).click();
    await page.locator('[data-action="continue"]').click();
  }
  await expect(page.locator('#story-title')).toHaveText('桃李江海');
  await page.getByRole('button',{name:'史料与说明',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('不是张謇原话');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.evaluate(()=>document.documentElement.style.fontSize='32px');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('unavailable or corrupt browser storage does not prevent play',async({page})=>{
  await page.addInitScript(()=>{Object.defineProperty(Storage.prototype,'setItem',{value(){throw new DOMException('Blocked','SecurityError');}});});
  await page.goto('/');
  await page.locator('[data-choice="court"]').click();
  await expect(page.locator('#route-note')).toContainText('无法存档');
  await page.locator('[data-action="continue"]').click();
  await expect(page.locator('#story-title')).toHaveText('改革的门，开了又关');
});
