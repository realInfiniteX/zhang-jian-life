import { test, expect } from '@playwright/test';

test('music starts on interaction, controls persist, and sound settings preserve the story',async({page})=>{
  await page.goto('/');
  await expect(page.locator('.narrative p')).toHaveText(/已经荣登状元/);
  expect((await page.locator('.narrative p').innerText()).length).toBeGreaterThanOrEqual(70);
  await page.getByRole('button',{name:'继续',exact:true}).click();
  await expect(page.locator('body')).toHaveAttribute('data-audio','playing');
  const frame=await page.locator('.frame-count').innerText();
  await page.getByRole('button',{name:'音乐与音效设置'}).click();
  await expect(page.locator('#audio-status')).toContainText('播放中');
  await page.getByLabel('背景音乐',{exact:true}).uncheck();
  await expect(page.locator('#audio-status')).toContainText('已关闭');
  await page.getByLabel('音量',{exact:true}).fill('17');
  await expect(page.locator('#sound-volume-value')).toHaveText('17%');
  await page.getByLabel('翻页与事件音效',{exact:true}).uncheck();
  await page.getByRole('button',{name:'关闭',exact:true}).click();
  await expect(page.locator('.frame-count')).toHaveText(frame);
  await page.reload();
  await page.getByRole('button',{name:'音乐与音效设置'}).click();
  await expect(page.getByLabel('背景音乐',{exact:true})).not.toBeChecked();
  await expect(page.getByLabel('音量',{exact:true})).toHaveValue('17');
  await page.getByLabel('背景音乐',{exact:true}).check();
  await expect(page.locator('body')).toHaveAttribute('data-audio','playing');
});

test('every theme renders audible music and cues without clipping',async({page})=>{
  await page.goto('/');
  const renders=await page.evaluate(async()=>{
    const {THEMES,createAudioGraph,scheduleTheme,scheduleCue}=await import('/audio.js');
    const results=[];
    for(const id of Object.keys(THEMES)) {
      const context=new OfflineAudioContext(2,22050*8,22050),graph=createAudioGraph(context);
      scheduleTheme(context,graph,id,0,8);
      if(id==='tension')scheduleCue(context,graph,'cannon',2);
      const buffer=await context.startRendering(),samples=buffer.getChannelData(0);
      let energy=0,peak=0;
      for(const sample of samples){energy+=sample*sample;peak=Math.max(peak,Math.abs(sample));}
      results.push({id,rms:Math.sqrt(energy/samples.length),peak});
    }
    return results;
  });
  for(const render of renders){expect(render.rms).toBeGreaterThan(.001);expect(render.peak).toBeLessThan(.7);}
});

test('greeting and reading poses appear, while reduced motion suppresses camera animation',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await expect(page.locator('#character-art')).toHaveAttribute('src','assets/adult-greet.webp');
  await expect(page.locator('#character-art')).toBeVisible();
  expect(await page.locator('#background-art').evaluate(el=>el.getAnimations().length)).toBe(0);
  for(let i=0;i<14;i++)await page.getByRole('button',{name:'继续',exact:true}).click();
  await expect(page.locator('#character-art')).toHaveAttribute('src','assets/adult-read.webp');
  expect(await page.locator('#character-art').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
});

test('the merchant shares the foreground and speaker focus changes during negotiation',async({page})=>{
  await page.goto('/');
  for(let i=0;i<16;i++)await page.getByRole('button',{name:'继续',exact:true}).click();
  await page.locator('[data-choice="business"]').click();
  while(await page.locator('#game').getAttribute('data-phase')!=='choice')await page.locator('[data-action="next-frame"]').click();
  await page.locator('[data-choice="shares"]').click();
  await page.locator('[data-action="next-frame"]').click();
  await page.locator('[data-action="next-frame"]').click();
  await expect(page.locator('#supporting-art')).toHaveAttribute('data-cast','xu');
  await expect(page.locator('#supporting-art')).toBeVisible();
  await expect(page.locator('#character-art')).toBeVisible();
  await expect(page.locator('.speaker')).toContainText('许掌柜');
  await expect(page.locator('#character-art')).toHaveClass(/muted-character/);
  await page.locator('[data-action="next-frame"]').click();
  await expect(page.locator('.speaker')).toContainText('张謇');
  await expect(page.locator('#supporting-art')).toHaveClass(/muted-character/);
  for(let i=0;i<7;i++)await page.locator('[data-action="next-frame"]').click();
  await expect(page.locator('[data-choice="borrow"]')).toContainText('许掌柜的短借');
});
