import { NODES, ENDINGS, STATS, SOURCES, ART, CHARACTER_ART, CAST_ART, chapter } from './story.js';
import { newGame, choose, advance, previousFrame, rewind, restoreGame, isHistorical, unmetRequirements } from './engine.js';

import { INTRO, NARRATIVE_COUNTS, framesFor, decisionScene } from './narrative.js';
import { createSoundtrack } from './audio.js';

const $ = selector => document.querySelector(selector);
const SAVE_KEY='zhang-jian-life-save-v1', COLLECTION_KEY='zhang-jian-life-endings-v1';
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state=newGame(), unlocked=new Set(), storageMessage='本机自动存档';
const soundtrack=createSoundtrack(renderSoundStatus);
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
try {
  const saved=localStorage.getItem(SAVE_KEY);
  if(saved) { state=restoreGame(JSON.parse(saved)); storageMessage='已接续本机存档'; }
  const collection=JSON.parse(localStorage.getItem(COLLECTION_KEY)||'[]');
  if(Array.isArray(collection)) unlocked=new Set(collection.filter(key=>Object.hasOwn(ENDINGS,key)));
} catch { storageMessage='存档未能读取，已从人生起点开始'; state=newGame(); }
if(state.ending) unlocked.add(state.ending);

function persist() {
  if(state.ending) unlocked.add(state.ending);
  try {
    localStorage.setItem(SAVE_KEY,JSON.stringify(state));
    localStorage.setItem(COLLECTION_KEY,JSON.stringify([...unlocked]));
    storageMessage='本机自动存档';
  } catch { storageMessage='浏览器无法存档；本次仍可继续游玩'; }
}
function sourceLinks(refs) { return refs.filter(key=>SOURCES[key]?.url).map(key=>`<a href="${escape(SOURCES[key].url)}" target="_blank" rel="noopener noreferrer">${SOURCES[key].title}</a>`).join(''); }
function effects(changes) { return Object.entries(changes).map(([key,n])=>`<span class="${n<0?'neg':''}">${STATS[key]} ${n>0?'+':''}${n}</span>`).join(''); }
const game=$('#game');
game.innerHTML='<div class="scene"><img id="background-art" class="background-art" alt=""><div class="scene-copy"></div><img id="character-previous" class="character character-previous" alt="" aria-hidden="true" hidden><img id="character-art" class="character" alt=""><img id="supporting-art" class="cast-character" alt="" hidden><div id="scene-pulse" class="scene-pulse"></div></div><div id="stage-dialogue"></div>';
const warmed=new Map();
let cameraAnimation=null,sceneAnimation=null;
function warmImage(src) {
  if(warmed.has(src))return;
  const image=new Image();warmed.set(src,image);
  image.onload=image.onerror=()=>warmed.delete(src);image.src=src;
}
for(const pose of ['greet','read'])warmImage(CHARACTER_ART[pose].src);
function currentScene() {
  if(state.phase==='choice')return decisionScene(state.node);
  if(state.phase==='ending')return {art:ENDINGS[state.ending].art,year:1926,place:'江海之间',eventTitle:'人生终章',character:false,camera:'wide',refs:ENDINGS[state.ending].refs,fact:ENDINGS[state.ending].lesson};
  return framesFor(state)[state.frame];
}
function renderScene(meta,perform=false) {
  const art=ART[meta.art],bg=$('#background-art'),actor=$('#character-art'),previous=$('#character-previous');
  const pictureChanged=bg.getAttribute('src')!==art.src;
  if(pictureChanged) {
    bg.src=art.src;
    cameraAnimation?.cancel();
    if(!reducedMotion.matches)cameraAnimation=bg.animate([
      {transform:`scale(${meta.camera==='close'?1.04:1}) translateX(0)`},
      {transform:`scale(${meta.camera==='close'?1.075:1.035}) translateX(-4px)`}
    ],{duration:18000,easing:'ease-out',fill:'forwards'});
  }
  bg.alt=art.alt;
  const elderly=meta.year>=1915,key=elderly?'elder':meta.pose||'adult',sprite=CHARACTER_ART[key];
  const poseChanged=actor.getAttribute('src')!==sprite.src,wasVisible=Boolean(actor.getAttribute('src'))&&!actor.hidden;
  if(poseChanged) {
    previous.getAnimations().forEach(animation=>animation.cancel());
    previous.src=actor.getAttribute('src')||sprite.src;previous.className=`character ${elderly?'elder':'adult'} character-previous`;
    previous.hidden=!(wasVisible&&meta.character&&!reducedMotion.matches);
    if(!previous.hidden) {
      const blend=previous.animate([{opacity:.9},{opacity:0}],{duration:430,fill:'forwards'});
      blend.onfinish=()=>{previous.hidden=true;};
    }
    actor.src=sprite.src;
  }
  actor.className=`character ${elderly?'elder':'adult'}`;
  actor.alt=sprite.alt;actor.hidden=!meta.character;
  actor.dataset.pose=key;
  actor.classList.toggle('muted-character',Boolean(meta.speaking&&meta.speaking!=='zhang'));
  if(!meta.character)previous.hidden=true;
  if((poseChanged||!wasVisible)&&meta.character&&!reducedMotion.matches)actor.animate([{opacity:0},{opacity:1}],{duration:450});
  if(perform&&meta.character&&!reducedMotion.matches&&meta.frameIndex===0) {
    actor.animate([
      {transform:'translateX(-50%) translateY(0) rotate(0deg)'},
      {transform:`translateX(-50%) translateY(${key==='greet'?6:2}px) rotate(${key==='greet'?-1.5:-.5}deg)`},
      {transform:'translateX(-50%) translateY(0) rotate(0deg)'}
    ],{duration:key==='greet'?1600:2200,easing:'ease-in-out'});
  }
  if(perform&&meta.eventId==='naval-shadow'&&meta.shotIndex===1&&meta.frameIndex===0&&!reducedMotion.matches) {
    sceneAnimation?.cancel();sceneAnimation=$('.scene').animate([{transform:'translate(0,0)'},{transform:'translate(2px,1px)'},{transform:'translate(-2px,0)'},{transform:'translate(1px,-1px)'},{transform:'translate(0,0)'}],{duration:580});
    $('#scene-pulse').animate([{opacity:0},{opacity:.12},{opacity:0}],{duration:550});
  }
  const support=$('#supporting-art'),castKey=meta.cast?.[0],supporting=CAST_ART[castKey];
  const changedSupport=supporting&&support.getAttribute('src')!==supporting.src;
  if(supporting) {
    if(changedSupport)support.src=supporting.src;
    support.alt=supporting.alt;support.dataset.cast=castKey;support.hidden=false;
    support.classList.toggle('muted-character',Boolean(meta.speaking&&meta.speaking!==castKey));
    if(changedSupport&&!reducedMotion.matches)support.animate([{opacity:0},{opacity:1}],{duration:500});
  } else {support.hidden=true;delete support.dataset.cast;}
  game.classList.toggle('has-cast',Boolean(supporting));
  $('.scene-copy').innerHTML=`<span class="era">${escape(chapter(meta.year))}</span><div class="year">${meta.year}</div><span class="scene-location">${escape(meta.place)} <span>/</span> ${meta.year-1853} 岁</span>`;
  const upcoming=framesFor(state).slice(state.frame+1).find(f=>f.art!==meta.art);
  if(upcoming)warmImage(ART[upcoming.art].src);
  for(const cast of meta.cast||[])warmImage(CAST_ART[cast].src);
  if(state.pending){const destination=NODES[state.node].choices.find(c=>c.id===state.pending.choice).next;if(INTRO[destination])for(const cast of INTRO[destination][0].cast||[])warmImage(CAST_ART[cast].src);}
  soundtrack.setScene(meta,perform);
}
function speakerLabel(meta) {
  const supporting=CAST_ART[meta.speaking];
  return escape(meta.speaker)+(supporting?`<span class="speaker-role">${supporting.role}</span>`:'');
}
function factButton() {return '<button class="fact-link" data-action="fact" type="button">史实对照</button>';}
function frameNavigation() {
  const previous=state.frame>0?'<button class="frame-back" data-action="previous-frame">上一帧</button>':'';
  const undo=state.pending?'<button class="frame-back" data-action="undo">重新选择</button>':'';
  return `<div class="frame-navigation"><div>${previous}${undo}</div><button class="primary" data-action="next-frame">继续</button></div>`;
}
function render(focus=false,perform=false) {
  const node=NODES[state.node],ending=state.ending?ENDINGS[state.ending]:null,hist=isHistorical(state),meta=currentScene();
  const shortLabels={industry:'实业',education:'教育',trust:'信望',cash:'余力'};
  $('#stats').innerHTML=Object.entries(STATS).map(([key,label])=>`<div class="stat-row" title="${label}：${state.stats[key]} / 100"><span class="stat-circle" style="--value:${state.stats[key]}" role="meter" aria-label="${label}" aria-valuenow="${state.stats[key]}" aria-valuemin="0" aria-valuemax="100"><span>${state.stats[key]}</span></span><span class="stat-label">${shortLabels[key]}</span></div>`).join('');
  $('#save-status').textContent=storageMessage;
  game.dataset.phase=state.phase;
  game.classList.toggle('at-ending',state.phase==='ending');
  $('.sidebar').hidden=state.phase==='ending';
  renderScene(meta,perform);
  if(state.phase==='ending') {
    $('#stage-dialogue').innerHTML=`<section class="ending-screen" aria-labelledby="story-title"><div class="ending-wrap"><header class="ending-hero"><div class="end-label">1926 · 人生终章 <span>${ending.subtitle}</span></div><h2 id="story-title" tabindex="-1">${ending.title}</h2><p class="ending-motto">${ending.motto}</p><span class="ending-seal" aria-hidden="true">终</span></header><div class="ending-grid"><div class="ending-story">${ending.body.map(text=>`<p>${text}</p>`).join('')}</div><aside class="ending-summary" aria-label="最终人生状态"><h3>人生状态</h3><div class="end-metrics">${Object.entries(STATS).map(([key,label])=>`<div><b>${state.stats[key]}</b><span>${label}</span></div>`).join('')}</div><p>${state.history.length} 次抉择 · 已发现 ${unlocked.size} / ${Object.keys(ENDINGS).length} 个结局</p></aside></div><div class="ending-lesson"><p>${ending.lesson}</p></div><div class="action-row ending-actions"><button class="primary" data-action="new-life">再写一种人生</button><button class="secondary" data-action="atlas">人生图谱</button><button class="secondary" data-action="journal">回顾选择</button>${factButton()}</div></div></section>`;
  } else if(state.phase!=='choice') {
    const frameCount=framesFor(state).length;
    $('#stage-dialogue').innerHTML=`<div class="story-content reading-panel"><div class="dialogue-copy"><div class="speaker">${speakerLabel(meta)}<span class="badge ${!hist?'if':''}">${!hist?'IF 世界线':'史实主线'}</span></div><h2 id="story-title" class="frame-title" tabindex="-1">${meta.eventTitle}</h2><div class="narrative"><p>${meta.text}</p></div>${meta.effects?`<div class="effects">${effects(state.pending.changes)}</div>`:''}<div class="frame-tools">${factButton()}<span class="frame-count" aria-label="当前段落进度">${state.frame+1} / ${frameCount}</span></div>${frameNavigation()}</div></div>`;
  } else {
    $('#stage-dialogue').innerHTML=`<div class="story-content"><div class="dialogue-copy"><div class="speaker">张謇<span class="badge ${!hist||node.fiction?'if':''}">${!hist||node.fiction?'IF 世界线':'史实主线'}</span></div><div class="story-head"><h2 id="story-title" tabindex="-1">${node.title}</h2></div><div class="narrative"><p>${node.body.at(-1)}</p></div><div class="frame-tools">${factButton()}<button class="frame-back" data-action="previous-frame">回看上一帧</button></div></div><div class="decision-panel"><div class="choices">${node.choices.map((choice,index)=>{
      const unmet=unmetRequirements(state,choice),description=unmet.length?unmet.join('、'):choice.description;
      return `<button class="choice" type="button" data-choice="${choice.id}" title="${escape(description)}" ${unmet.length?'disabled':''}><span class="choice-letter">${String.fromCharCode(65+index)}</span><span class="choice-body"><span class="choice-title">${choice.title}</span><span class="sr-only">${description} ${Object.entries(choice.effects).map(([key,n])=>STATS[key]+(n>0?'+':'')+n).join('，')}</span></span><span class="choice-route">${choice.historical?'史实选择':choice.route?.replace(' IF','')||'IF'}</span></button>`;
    }).join('')}</div></div></div>`;
  }
  $('#announcement').textContent=state.phase==='choice'?node.title:state.phase==='ending'?ending.title:meta.text;
  if(focus)$('#story-title').focus({preventScroll:true});
  document.title=`${meta.year} · ${meta.eventTitle} · 一生一城`;
}
function update(next,perform=true) {state=next;persist();render(true,perform);}
function modal(title,html) { $('#modal-title').textContent=title; $('#modal-body').innerHTML=html; if(!$('#modal').open) $('#modal').showModal(); }
function closeModal() { $('#modal').close(); }
function showFact() {
  const node=state.ending?ENDINGS[state.ending]:NODES[state.node],meta=currentScene();
  modal('史实与这一段人生',`<p class="modal-note">${state.ending?(state.ending==='history'?'史实主线结局':'此结局为架空推演'):!isHistorical(state)||node.fiction?'你已进入 IF 世界线；以下单独说明现实中的历史。':'叙事与选项是游戏化表达，下面是历史依据。'}</p><p>${state.ending?node.lesson:meta.fact}</p><div class="source-links">${sourceLinks(meta.refs)}</div><p class="modal-note">主要依据：用户提供的《张謇》课程专题材料。链接为核验与延伸阅读入口。</p>`);
}
function showSources() {
  modal('史料与游戏说明',`<p>你将扮演张謇，从1894年荣当状元之后走到1926年的人生终章。开场先呈现金榜与翰林新身份；早年读书、殿试与1882年赴朝鲜的经历，在此后作为回忆交代。</p><p>连续选择“史实选择”组成主世界线。任何一次架空选择都会进入 IF 世界线；后来遇到史实节点，也不会把已作出的推演变回史实。</p><p>内心独白、具体决策过程及数值均为游戏创作，不是张謇原话。左下角圆环表示实业根基、教育薪火、公共信望与周转余力，不能给历史人物作定量评价。阈值影响少数选项能否选择。</p><h3>历史依据</h3><p>${SOURCES.material.note}</p><ul>${Object.entries(SOURCES).filter(([key])=>key!=='material').map(([,source])=>`<li><a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">${source.title}</a></li>`).join('')}</ul><h3>配角与对白</h3><p>许掌柜（商股代表）、林先生（师范教员）与顾先生（立宪同人）是为呈现经营、办学与议政分歧创作的戏剧合成角色，非真实人物传记。角色互动与对白是游戏创作；“史实选择”表示历史行动方向，不表示曾发生一场同名会谈。</p><h3>图片来源</h3><p>十七个场景、四张张謇立绘与三张配角立绘由内置图像模型生成。人物参考张謇历史肖像，环境为时代场景创作。</p><p><a href="assets/art-prompts.json" target="_blank" rel="noopener">查看完整生成提示词</a></p><div class="source-gallery"><figure><img src="assets/zhang-jian.jpg" alt="张謇历史肖像" loading="lazy"><figcaption>张謇肖像，摄影者不详，1926年以前。<a href="https://commons.wikimedia.org/wiki/File:Zhang_Jian.jpg" target="_blank" rel="noopener noreferrer">Commons 来源页</a>标为公有领域。</figcaption></figure><figure><img src="assets/dasheng-1915.jpg" alt="1915年的大生纱厂外观" loading="lazy"><figcaption>1915年大生纱厂，摄影者不详。<a href="https://commons.wikimedia.org/wiki/File:Facade_of_Dasheng_Cotton_Mill_in_1915.jpg" target="_blank" rel="noopener noreferrer">Commons 来源页</a>标为公有领域。</figcaption></figure><figure><img src="assets/museum-2013.jpg" alt="2013年南通博物苑南馆外景" loading="lazy"><figcaption>南通博物苑南馆，猫猫的日记本摄，2013年1月。<a href="https://commons.wikimedia.org/wiki/File:The_South_Building_of_Nantong_Museum_01_2013-01.JPG" target="_blank" rel="noopener noreferrer">来源页</a>，<a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 3.0</a>。原图未修改，仅按比例展示。</figcaption></figure></div><h3>音乐与演出</h3><p>原创合成配乐按场景换奏，配有翻页、卷轴、报喜、机器与海战音效。右上角“音乐”可调整音量、关闭配乐或关闭音效。人物手势与动作是叙事演出，环境使用轻微推镜头；系统减少动态效果的偏好会被尊重。</p><h3>操作与存档</h3><p>按Enter、空格或右方向键逐帧阅读，左方向键回看。故事展开后，才会出现关键抉择；点击选项或按1、2、3选择。点“足迹”可回顾并回溯；“图谱”展示可探索结局。重新开始保留已发现的结局。</p><p>游戏只在当前浏览器保存进度和结局收藏，无需注册，不上传存档。换浏览器或清理网站数据后，存档可能丢失。浏览器拒绝存储时，仍可完成本次人生。</p>`);
}
function showAtlas() {
  const hints={history:'始终选择史实方向。',balanced:'偏离一次史实，再走向维护学校的终章。',education:'将更多资源交给师资、学校与多方筹资。',prudent:'保留周转余力，在重整时守住经营边界。',public:'积累公共信望，让更多人共同承担责任。',constitution:'长期投入全国制度与共和倡议。',court:'留在旧秩序中，坚持原有制度期待。',partner:'让外部投资者掌握主要经营决定权。',collapse:'以更大借款押注市场，然后抢救遗产。',quiet:'承认边界，从公共事业中心退出。'};
  modal('人生图谱',`<p>沿每个“史实选择”连续前行，可到达主世界线。其余道路探索不同资源与责任的取舍。</p><p class="modal-note">${NARRATIVE_COUNTS.events} 个事件 · ${NARRATIVE_COUNTS.frames} 帧事件叙事 · ${Object.keys(NODES).length} 个抉择节点 · ${Object.keys(ENDINGS).length} 个结局 · 已发现 ${unlocked.size} 个。以下显示结局方向，方便寻找另一种人生。</p><div class="atlas-grid">${Object.entries(ENDINGS).map(([key,end])=>`<div class="atlas-card ${unlocked.has(key)?'unlocked':''}"><span>${unlocked.has(key)?'已发现':'待探索'}</span><h3>${end.title}</h3><p>${end.subtitle}</p><p>${hints[key]}</p></div>`).join('')}</div><div class="action-row"><button class="secondary" data-action="journal">回顾已走过的人生</button></div>`);
}
function eventLog(nodeId,limit=INTRO[nodeId].length) {
  const groups=new Map();
  for(const frame of INTRO[nodeId].slice(0,limit)) {
    if(!groups.has(frame.eventId))groups.set(frame.eventId,{title:frame.eventTitle,frames:[]});
    groups.get(frame.eventId).frames.push(frame);
  }
  return [...groups.values()].map(e=>`<details class="journal-event"><summary>${e.title}</summary>${e.frames.map(f=>`<p>${f.text}</p>`).join('')}</details>`).join('');
}
function showJournal() {
  const completed=state.history.map((entry,index)=>{
    const node=NODES[entry.node],choice=node.choices.find(c=>c.id===entry.choice);
    return `<li><b>${node.title}</b><p>${node.body[0]}</p>${eventLog(entry.node)}<p class="journal-choice">你的选择：${choice.title}</p><button class="secondary" data-rewind="${index}">回到这一选择</button></li>`;
  }).join('');
  const current=!state.pending&&!state.ending?`<li><b>正在经历 · ${NODES[state.node].title}</b>${eventLog(state.node,state.phase==='choice'?INTRO[state.node].length:state.frame+1)}</li>`:'';
  modal('你的一生 · 事件与选择',`<p class="modal-note">事件按你的阅读进度收录。回到已作出的选择时，资源与后续进度一并回溯；已发现结局保留。</p><ol class="timeline-list">${completed}${current}</ol>`);
}
function renderSoundStatus(status) {
  const button=$('[data-action="sound"]');
  if(button){button.classList.toggle('sound-on',status.playing);button.title=status.playing?'配乐播放中 · '+status.title:'音乐与音效设置';}
  document.body.dataset.audio=status.error?'unavailable':status.playing?'playing':status.started?'paused':'waiting';
  const line=$('#audio-status');
  if(line)line.textContent=status.error||(!status.preferences.music?'背景音乐已关闭':status.playing?'播放中 · '+status.title:'准备播放 · '+status.title);
  const volume=$('#sound-volume-value');if(volume)volume.textContent=status.preferences.volume+'%';
}
function showSound() {
  const status=soundtrack.status(),p=status.preferences;
  modal('音乐与音效',`<p>配乐随书斋、学堂、危机与终章切换，轻声陪伴阅读。</p><div class="sound-controls"><label class="sound-option"><span>背景音乐</span><input id="music-enabled" type="checkbox" ${p.music?'checked':''}></label><label class="sound-option"><span>翻页与事件音效</span><input id="effects-enabled" type="checkbox" ${p.effects?'checked':''}></label><label for="sound-volume" class="sound-volume-label">音量 <span id="sound-volume-value">${p.volume}%</span></label><input id="sound-volume" type="range" min="0" max="100" value="${p.volume}" aria-label="音量"><p id="audio-status" role="status"></p></div><p class="modal-note">设置保存在当前浏览器。切到其他标签页时，声音会暂停。</p>`);
  renderSoundStatus(status);
}
document.addEventListener('input',event=>{
  if(event.target.id==='sound-volume')soundtrack.setPreferences({volume:Number(event.target.value)});
});
document.addEventListener('change',event=>{
  if(event.target.id==='music-enabled'){soundtrack.setPreferences({music:event.target.checked});void soundtrack.interact();}
  if(event.target.id==='effects-enabled'){soundtrack.setPreferences({effects:event.target.checked});void soundtrack.interact();}
});
document.addEventListener('visibilitychange',()=>{void soundtrack.visibility(document.hidden);});
window.addEventListener('pagehide',()=>soundtrack.dispose(),{once:true});
function startLife() { closeModal(); update(newGame()); }
function restartPrompt() { modal('重新写下这一生',`<p>本次人生将回到1894年的起点。已发现的 ${unlocked.size} 个结局保留。</p><div class="action-row"><button class="primary" data-action="new-life">开始新一生</button><button class="secondary" data-action="close">继续这一生</button></div>`); }
document.addEventListener('click',event=>{
  const button=event.target.closest('button');
  if(!button || button.disabled) return;
  void soundtrack.interact();
  try {
    if(button.dataset.choice) return update(choose(state,button.dataset.choice));
    if(button.dataset.rewind!==undefined) { closeModal(); return update(rewind(state,Number(button.dataset.rewind)),false); }
    switch(button.dataset.action) {
      case 'next-frame': update(advance(state)); break;
      case 'previous-frame': update(previousFrame(state),false); break;
      case 'undo': update(rewind(state,state.history.length-1),false); break;
      case 'restart': restartPrompt(); break;
      case 'new-life': startLife(); break;
      case 'close': closeModal(); break;
      case 'sources': showSources(); break;
      case 'atlas': showAtlas(); break;
      case 'journal': showJournal(); break;
      case 'fact': showFact(); break;
      case 'sound': showSound(); break;
      case 'fullscreen': Promise.resolve(document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen?.()).catch(()=>{$('#announcement').textContent='此浏览器暂不支持全屏';}); break;
    }
  } catch(error) { $('#announcement').textContent=error.message; }
});
document.addEventListener('keydown',event=>{
  if($('#modal').open || event.repeat || event.ctrlKey || event.altKey || event.metaKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
  if(/^[1-3 ]$/.test(event.key)||['Enter','ArrowRight','ArrowLeft'].includes(event.key))void soundtrack.interact();
  if(/^[1-3]$/.test(event.key) && state.phase==='choice') {
    const choice=NODES[state.node].choices[Number(event.key)-1];
    if(choice && !unmetRequirements(state,choice).length) { event.preventDefault(); update(choose(state,choice.id)); }
  } else if(['Enter',' ','ArrowRight'].includes(event.key)&&!['choice','ending'].includes(state.phase)&&event.target.tagName!=='BUTTON') {event.preventDefault();update(advance(state));}
  else if(event.key==='ArrowLeft'&&(state.frame>0||['choice','ending'].includes(state.phase))) {event.preventDefault();update(previousFrame(state),false);}
});
$('#modal').addEventListener('click',event=>{if(event.target===$('#modal')){const r=$('#modal').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeModal();}});
render();
renderSoundStatus(soundtrack.status());

const modelContext=document.modelContext;
if(modelContext?.registerTool) {
  const lifecycle=new AbortController();
  const snapshot=()=>({node:state.node,year:currentScene().year,phase:state.phase,frame:state.frame,frameCount:framesFor(state).length,event:currentScene().eventTitle,speaker:currentScene().speaker,cast:(currentScene().cast||[]).map(key=>CAST_ART[key].name),stats:{...state.stats},historical:isHistorical(state),ending:state.ending,pending:Boolean(state.pending),choices:state.phase!=='choice'?[]:NODES[state.node].choices.map(c=>({id:c.id,title:c.title,available:!unmetRequirements(state,c).length}))});
  const registrations=[
    {name:'read_life_state',title:'读取人生状态',description:'Read the current node, resources, choices and ending without changing progress.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:()=>snapshot()},
    {name:'choose_life_option',title:'作出人生选择',description:'Commit one available choice, update resources and show its consequence. Does not advance past the consequence.',inputSchema:{type:'object',properties:{choiceId:{type:'string'}},required:['choiceId'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:input=>{if(!input||typeof input.choiceId!=='string')throw new Error('choiceId is required');update(choose(state,input.choiceId));return snapshot();}},
    {name:'continue_life',title:'继续人生',description:'Read the next narrative frame. Enters a decision only after its events are read, or continues a chosen consequence or epilogue. Fails while a choice is required.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:()=>{update(advance(state));return snapshot();}}
  ];
  for(const tool of registrations) {
    try { Promise.resolve(modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{}); } catch { /* Optional browser capability. */ }
  }
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
