import { test, expect } from '@playwright/test';
import { NODES } from '../../dist/story.js';
import { INTRO } from '../../dist/narrative.js';

async function readUntilDecision(page) {
  for(let i=0;i<60;i++) {
    const phase=await page.locator('#game').getAttribute('data-phase');
    if(['choice','ending'].includes(phase))return phase;
    await page.locator('[data-action="next-frame"]').click();
  }
  throw new Error('Narration did not reach a decision or ending');
}

test('prologue shows several events and pictures, then a full historical life',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('#story-title')).toHaveText('寒窗未尽');
  await expect(page.locator('[data-choice]')).toHaveCount(0);
  await expect(page.locator('#character-art')).not.toBeVisible();
  await expect(page.locator('#character-previous')).not.toBeVisible();
  const scene=await page.locator('.scene').boundingBox();expect(scene.x).toBe(0);expect(scene.y).toBe(0);expect(scene.width).toBe(page.viewportSize().width);expect(scene.height).toBe(page.viewportSize().height);
  await expect(page.locator('.stat-circle')).toHaveCount(4);
  const stats=await page.locator('#stats').boundingBox();expect(stats.x).toBeLessThan(40);expect(stats.y).toBeGreaterThan(page.viewportSize().height-100);
  await expect(page.locator('body')).not.toContainText('AI 场景画');
  await page.keyboard.press('1');await expect(page.locator('#game')).toHaveAttribute('data-phase','story');
  await page.locator('[data-action="next-frame"]').click();
  await page.reload();await expect(page.locator('.frame-count')).toContainText('2 /');
  await page.locator('[data-action="previous-frame"]').click();await expect(page.locator('.frame-count')).toContainText('1 /');
  const pictures=new Set();
  for(let i=0;i<INTRO.beginning.length;i++) {pictures.add(await page.locator('.background-art').getAttribute('src'));await page.locator('[data-action="next-frame"]').click();}
  expect(pictures.size).toBeGreaterThanOrEqual(5);
  await expect(page.locator('#story-title')).toHaveText('状元之后，何去何从');
  await expect(page.locator('[data-choice]')).toHaveCount(3);
  await page.locator('[data-choice="business"]').click();await page.reload();
  await expect(page.locator('#game')).toHaveAttribute('data-phase','consequence');
  let id='venture';await readUntilDecision(page);
  while(!id.startsWith('end:')) {
    const c=NODES[id].choices.find(c=>c.historical);
    await page.locator(`[data-choice="${c.id}"]`).click();await readUntilDecision(page);id=c.next;
  }
  await expect(page.locator('#story-title')).toHaveText('有用之人');
  await page.getByRole('button',{name:'人生图谱',exact:true}).last().click();await expect(page.locator('.atlas-card.unlocked')).toHaveCount(1);await page.locator('[data-action="close"]').click();
  await page.getByRole('button',{name:'回顾选择',exact:true}).click();await page.locator('[data-rewind="0"]').click();
  await expect(page.locator('#story-title')).toHaveText('状元之后，何去何从');await expect(page.locator('#stats')).toContainText('50');expect(errors).toEqual([]);
});

test('education IF, consequence undo, event journal and readable mobile layout',async({page})=>{
  await page.goto('/');await readUntilDecision(page);
  await page.locator('[data-choice="teaching"]').click();await page.getByRole('button',{name:'重新选择',exact:true}).click();
  await expect(page.locator('#story-title')).toHaveText('状元之后，何去何从');
  for(const choice of ['teaching','teachers','network','fund']) {await page.locator(`[data-choice="${choice}"]`).click();await readUntilDecision(page);}
  await expect(page.locator('#story-title')).toHaveText('桃李江海');
  await page.getByRole('button',{name:'史料与说明',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('不是张謇原话');await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'足迹',exact:true}).click();await expect(page.locator('.journal-event')).not.toHaveCount(0);await page.keyboard.press('Escape');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.evaluate(()=>document.documentElement.style.fontSize='32px');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('blocked storage still permits narrative progress and branching',async({page})=>{
  await page.addInitScript(()=>{Object.defineProperty(Storage.prototype,'setItem',{value(){throw new DOMException('Blocked','SecurityError');}});});
  await page.goto('/');await page.locator('[data-action="next-frame"]').click();await expect(page.locator('#save-status')).toContainText('无法存档');
  await readUntilDecision(page);await page.locator('[data-choice="court"]').click();await readUntilDecision(page);
  await expect(page.locator('#story-title')).toHaveText('改革的门，开了又关');
});
