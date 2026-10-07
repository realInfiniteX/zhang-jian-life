import { NODES, ENDINGS, STATS, SOURCES, ART, chapter } from './story.js';
import { newGame, choose, advance, rewind, restoreGame, isHistorical, unmetRequirements } from './engine.js';

const $ = selector => document.querySelector(selector);
const SAVE_KEY='zhang-jian-life-save-v1', COLLECTION_KEY='zhang-jian-life-endings-v1';
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state=newGame(), unlocked=new Set(), storageMessage='本机自动存档';
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
function scene(node, ending=false) {
  const art=ART[node.art],year=ending?1926:node.year;
  return `<div class="scene"><img class="background-art" src="${art.src}" alt="${art.alt}" fetchpriority="high"><div class="scene-copy"><span class="era">${ending?'人生终章':chapter(year)}</span><div class="year">${year}</div><span class="scene-location">${escape(ending?'江海之间':node.place)} <span>/</span> ${year-1853} 岁</span></div><img class="character ${year>=1915?'elder':'adult'}" src="assets/${year>=1915?'elder':'adult'}.webp" alt="${year>=1915?'晚年':'中年'}张謇的艺术立绘，依据历史肖像演绎"><span class="image-caption">${art.caption} · 人物为艺术演绎</span></div>`;
}
function factButton() { return '<button class="fact-link" data-action="fact" type="button">史实对照</button>'; }

function render(focus=false) {
  const node=NODES[state.node],ending=state.ending?ENDINGS[state.ending]:null,hist=isHistorical(state);
  const lastEntry=state.history.at(-1),lastChoice=lastEntry && NODES[lastEntry.node].choices.find(c=>c.id===lastEntry.choice);
  $('#stats').innerHTML=Object.entries(STATS).map(([key,label])=>`<div class="stat-row"><div class="stat-label"><span>${label}</span><span>${state.stats[key]}</span></div><div class="meter"><span style="width:${state.stats[key]}%"></span></div></div>`).join('');
  $('#route-name').textContent=ending?ending.subtitle.split(' · ')[0]:hist?'史实主线':lastChoice?.route||'IF 世界线';
  $('#route-note').textContent=storageMessage;
  $('#chapter-label').textContent=ending?'终卷 · 人生留痕':chapter(node.year);
  $('#progress-label').textContent=`${state.history.length} 次落笔 · ${unlocked.size} / ${Object.keys(ENDINGS).length} 结局`;
  $('#game').classList.toggle('at-ending',Boolean(ending));
  if(ending) {
    $('#game').innerHTML=`${scene(ending,true)}<div class="story-content ending"><div class="ending-narrative"><div class="end-label">${ending.subtitle}</div><h2 id="story-title" tabindex="-1">${ending.title}</h2><div class="narrative">${ending.body.map(t=>`<p>${t}</p>`).join('')}</div></div><div class="ending-reflection"><div class="end-metrics">${Object.entries(STATS).map(([key,label])=>`<div><b>${state.stats[key]}</b><span>${label}</span></div>`).join('')}</div><div class="ending-lesson"><p>${ending.lesson}</p></div><div class="action-row"><button class="primary" data-action="new-life">再写一种人生</button><button class="secondary" data-action="atlas">人生图谱</button><button class="secondary" data-action="journal">回顾选择</button></div>${factButton()}</div></div>`;
  } else if(state.pending) {
    const choice=node.choices.find(c=>c.id===state.pending.choice);
    $('#game').innerHTML=`${scene(node)}<div class="story-content outcome-panel"><div class="dialogue-copy"><div class="speaker">张謇 <span>· 你的抉择</span></div><div class="story-head"><h2 id="story-title" tabindex="-1">${choice.title}</h2></div><div class="narrative"><p>${choice.result}</p></div><div class="effects">${effects(state.pending.changes)}</div></div><div class="decision-panel"><span class="decision-label">这一笔，已经落下。</span><p class="decision-note">${choice.next.startsWith('end:')?'余下的人生，将在终章中回望。':'选择的影响，将随你进入下一段人生。'}</p><div class="action-row"><button class="primary" data-action="continue">${choice.next.startsWith('end:')?'查看人生终章':'继续人生'}</button><button class="secondary" data-action="undo">重新选择</button></div>${factButton()}</div></div>`;
  } else {
    $('#game').innerHTML=`${scene(node)}<div class="story-content"><div class="dialogue-copy"><div class="speaker">张謇 <span>· 内心独白</span><span class="badge ${!hist||node.fiction?'if':''}">${!hist||node.fiction?'IF 世界线':'史实主线'}</span></div><div class="story-head"><h2 id="story-title" tabindex="-1">${node.title}</h2></div><div class="narrative">${node.body.map(t=>`<p>${t}</p>`).join('')}</div>${factButton()}</div><div class="decision-panel"><div class="prompt">你将如何选择？ <span>按 1 / 2 / 3 落笔</span></div><div class="choices">${node.choices.map((choice,index)=>{
      const unmet=unmetRequirements(state,choice);
      return `<button class="choice" type="button" data-choice="${choice.id}" ${unmet.length?'disabled':''}><span class="choice-letter">${String.fromCharCode(65+index)}</span><span class="choice-body"><span class="choice-title">${choice.title}</span><span class="choice-desc">${choice.description}</span><span class="choice-meta">${unmet.length?`<span class="neg">需${unmet.join('、')}（当前 ${Object.keys(choice.requires).map(key=>state.stats[key]).join(' / ')}）</span>`:effects(choice.effects)}</span></span><span class="choice-route">${choice.historical?'史实选择':choice.route?.replace(' IF','')||'IF'}</span></button>`;
    }).join('')}</div></div></div>`;
  }
  $('#trail').innerHTML=state.history.length?state.history.slice(-6).map((entry,i)=>`<button type="button" data-history="${state.history.length-Math.min(6,state.history.length)+i}">${NODES[entry.node].year} · ${NODES[entry.node].choices.find(c=>c.id===entry.choice).title}</button>`).join(''):'<span>人生的第一笔，尚未落下。</span>';
  $('#announcement').textContent=ending?`人生终章：${ending.title}`:state.pending?'已选择：'+lastChoice.title:node.title;
  if(focus) $('#story-title').focus({preventScroll:true});
  document.title=ending?`${ending.title} · 一生一城`:`${node.year} · ${node.title} · 一生一城`;
}
function update(next) { state=next; persist(); render(true); }
function modal(title,html) { $('#modal-title').textContent=title; $('#modal-body').innerHTML=html; if(!$('#modal').open) $('#modal').showModal(); }
function closeModal() { $('#modal').close(); }
function showFact() {
  const node=state.ending?ENDINGS[state.ending]:NODES[state.node];
  modal('史实与这一段人生',`<p class="modal-note">${state.ending?(state.ending==='history'?'史实主线结局':'此结局为架空推演'):!isHistorical(state)||node.fiction?'你已进入 IF 世界线；以下单独说明现实中的历史。':'叙事与选项是游戏化表达，下面是历史依据。'}</p><p>${state.ending?node.lesson:node.fact}</p><div class="source-links">${sourceLinks(node.refs)}</div><p class="modal-note">主要依据：用户提供的《张謇》课程专题材料。链接为核验与延伸阅读入口。</p>`);
}
function showSources() {
  modal('史料与游戏说明',`<p>你将扮演张謇，从1894年的状元转身走到1926年的人生终章。1853年出生、早年读书与1882年赴朝鲜的经历，作为开场背景。</p><p>连续选择“史实选择”组成主世界线。任何一次架空选择都会进入 IF 世界线；后来遇到史实节点，也不会把已作出的推演变回史实。</p><p>内心独白、具体决策过程及数值均为游戏创作，不是张謇原话。数值表示产业能力、人才教育、公共信任与周转空间，不能给历史人物作定量评价。阈值影响少数选项能否选择。</p><h3>历史依据</h3><p>${SOURCES.material.note}</p><ul>${Object.entries(SOURCES).filter(([key])=>key!=='material').map(([,source])=>`<li><a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">${source.title}</a></li>`).join('')}</ul><h3>图片与艺术演绎</h3><p>三个场景和两个人物阶段由内置图像模型生成。书斋、工厂河岸与学堂是时代环境概念画，人物依据张謇历史肖像演绎；不声称精确复原，不属于历史照片。</p><p><a href="assets/art-prompts.json" target="_blank" rel="noopener">查看完整生成提示词</a></p><div class="source-gallery"><figure><img src="assets/zhang-jian.jpg" alt="张謇历史肖像" loading="lazy"><figcaption>张謇肖像，摄影者不详，1926年以前。<a href="https://commons.wikimedia.org/wiki/File:Zhang_Jian.jpg" target="_blank" rel="noopener noreferrer">Commons 来源页</a>标为公有领域。</figcaption></figure><figure><img src="assets/dasheng-1915.jpg" alt="1915年的大生纱厂外观" loading="lazy"><figcaption>1915年大生纱厂，摄影者不详。<a href="https://commons.wikimedia.org/wiki/File:Facade_of_Dasheng_Cotton_Mill_in_1915.jpg" target="_blank" rel="noopener noreferrer">Commons 来源页</a>标为公有领域。</figcaption></figure><figure><img src="assets/museum-2013.jpg" alt="2013年南通博物苑南馆外景" loading="lazy"><figcaption>南通博物苑南馆，猫猫的日记本摄，2013年1月。<a href="https://commons.wikimedia.org/wiki/File:The_South_Building_of_Nantong_Museum_01_2013-01.JPG" target="_blank" rel="noopener noreferrer">来源页</a>，<a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 3.0</a>。原图未修改，仅按比例展示。</figcaption></figure></div><h3>操作与存档</h3><p>点击选项，或按1、2、3选择；作出选择后按Enter继续。点“你的足迹”可回顾并回溯；“人生图谱”展示可探索结局。重新开始保留已发现的结局。</p><p>游戏只在当前浏览器保存进度和结局收藏，无需注册，不上传存档。换浏览器或清理网站数据后，存档可能丢失。浏览器拒绝存储时，仍可完成本次人生。</p>`);
}
function showAtlas() {
  const hints={history:'始终选择史实方向。',balanced:'偏离一次史实，再走向维护学校的终章。',education:'将更多资源交给师资、学校与多方筹资。',prudent:'保留周转余力，在重整时守住经营边界。',public:'积累公共信望，让更多人共同承担责任。',constitution:'长期投入全国制度与共和倡议。',court:'留在旧秩序中，坚持原有制度期待。',partner:'让外部投资者掌握主要经营决定权。',collapse:'以更大借款押注市场，然后抢救遗产。',quiet:'承认边界，从公共事业中心退出。'};
  modal('人生图谱',`<p>沿每个“史实选择”连续前行，可到达主世界线。其余道路探索不同资源与责任的取舍。</p><p class="modal-note">${Object.keys(NODES).length} 个抉择节点 · ${Object.keys(ENDINGS).length} 个结局 · 已发现 ${unlocked.size} 个。以下显示结局方向，方便寻找另一种人生。</p><div class="atlas-grid">${Object.entries(ENDINGS).map(([key,end])=>`<div class="atlas-card ${unlocked.has(key)?'unlocked':''}"><span>${unlocked.has(key)?'已发现':'待探索'}</span><h3>${end.title}</h3><p>${end.subtitle}</p><p>${hints[key]}</p></div>`).join('')}</div><div class="action-row"><button class="secondary" data-action="journal">回顾已走过的人生</button></div>`);
}
function showJournal() {
  modal('你的一生 · 选择回顾',state.history.length?`<p class="modal-note">回溯将进度、数值恢复到该次选择之前；已发现结局保留。</p><ol class="timeline-list">${state.history.map((entry,index)=>{
    const node=NODES[entry.node],choice=node.choices.find(c=>c.id===entry.choice);
    return `<li><b>${node.year} · ${node.title}</b><p>${choice.title}</p><p>${choice.result}</p><button class="secondary" data-rewind="${index}">回到这一选择</button></li>`;
  }).join('')}</ol>`:'<p>你还没有作出第一个选择。</p>');
}
function startLife() { closeModal(); update(newGame()); }
function restartPrompt() { modal('重新写下这一生',`<p>本次人生将回到1894年的起点。已发现的 ${unlocked.size} 个结局保留。</p><div class="action-row"><button class="primary" data-action="new-life">开始新一生</button><button class="secondary" data-action="close">继续这一生</button></div>`); }
document.addEventListener('click',event=>{
  const button=event.target.closest('button');
  if(!button || button.disabled) return;
  try {
    if(button.dataset.choice) return update(choose(state,button.dataset.choice));
    if(button.dataset.rewind!==undefined) { closeModal(); return update(rewind(state,Number(button.dataset.rewind))); }
    if(button.dataset.history!==undefined) return showJournal();
    switch(button.dataset.action) {
      case 'continue': update(advance(state)); break;
      case 'undo': update(rewind(state,state.history.length-1)); break;
      case 'restart': restartPrompt(); break;
      case 'new-life': startLife(); break;
      case 'close': closeModal(); break;
      case 'sources': showSources(); break;
      case 'atlas': showAtlas(); break;
      case 'journal': showJournal(); break;
      case 'fact': showFact(); break;
      case 'fullscreen': Promise.resolve(document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen?.()).catch(()=>{$('#announcement').textContent='此浏览器暂不支持全屏';}); break;
    }
  } catch(error) { $('#announcement').textContent=error.message; }
});
document.addEventListener('keydown',event=>{
  if($('#modal').open || event.repeat || event.ctrlKey || event.altKey || event.metaKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
  if(/^[1-3]$/.test(event.key) && !state.pending && !state.ending) {
    const choice=NODES[state.node].choices[Number(event.key)-1];
    if(choice && !unmetRequirements(state,choice).length) { event.preventDefault(); update(choose(state,choice.id)); }
  } else if(event.key==='Enter' && state.pending && event.target.tagName!=='BUTTON') { event.preventDefault(); update(advance(state)); }
});
$('#modal').addEventListener('click',event=>{if(event.target===$('#modal')){const r=$('#modal').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeModal();}});
render();

const modelContext=document.modelContext;
if(modelContext?.registerTool) {
  const lifecycle=new AbortController();
  const snapshot=()=>({node:state.node,year:state.ending?1926:NODES[state.node].year,stats:{...state.stats},historical:isHistorical(state),ending:state.ending,pending:Boolean(state.pending),choices:state.ending||state.pending?[]:NODES[state.node].choices.map(c=>({id:c.id,title:c.title,available:!unmetRequirements(state,c).length}))});
  const registrations=[
    {name:'read_life_state',title:'读取人生状态',description:'Read the current node, resources, choices and ending without changing progress.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:()=>snapshot()},
    {name:'choose_life_option',title:'作出人生选择',description:'Commit one available choice, update resources and show its consequence. Does not advance past the consequence.',inputSchema:{type:'object',properties:{choiceId:{type:'string'}},required:['choiceId'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:input=>{if(!input||typeof input.choiceId!=='string')throw new Error('choiceId is required');update(choose(state,input.choiceId));return snapshot();}},
    {name:'continue_life',title:'继续人生',description:'Advance from an already chosen consequence to the next node or ending.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:()=>{update(advance(state));return snapshot();}}
  ];
  for(const tool of registrations) {
    try { Promise.resolve(modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{}); } catch { /* Optional browser capability. */ }
  }
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
