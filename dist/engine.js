import { NODES, ENDINGS, STATS } from './story.js';

export function newGame() {
  return { version:1, node:'beginning', stats:{industry:25,education:15,trust:40,cash:50}, history:[], pending:null, ending:null };
}

export function unmetRequirements(state, choice) {
  return Object.entries(choice.requires || {}).filter(([key,value])=>state.stats[key]<value).map(([key,value])=>`${STATS[key]}至少 ${value}`);
}

export function choose(state, choiceId) {
  if(state.pending || state.ending) throw new Error('请先继续人生，或开始新的一生。');
  const node=NODES[state.node];
  const choice=node?.choices.find(c=>c.id===choiceId);
  if(!choice) throw new Error('这一节点没有该选项。');
  const unmet=unmetRequirements(state,choice);
  if(unmet.length) throw new Error(unmet.join('，'));
  const next=structuredClone(state);
  const changes={};
  for(const [key,delta] of Object.entries(choice.effects)) {
    next.stats[key]=Math.max(0,Math.min(100,next.stats[key]+delta));
    changes[key]=next.stats[key]-state.stats[key];
  }
  next.history.push({node:state.node,choice:choice.id});
  next.pending={node:state.node,choice:choice.id,changes};
  return next;
}

export function isHistorical(state) {
  return state.history.every(h=>NODES[h.node]?.choices.find(c=>c.id===h.choice)?.historical);
}

export function advance(state) {
  if(!state.pending) throw new Error('请先作出一个选择。');
  const next=structuredClone(state);
  const choice=NODES[next.pending.node].choices.find(c=>c.id===next.pending.choice);
  if(choice.next.startsWith('end:')) {
    const key=choice.next.slice(4);
    next.ending=key==='legacy'?(isHistorical(next)?'history':'balanced'):key;
    if(!ENDINGS[next.ending]) throw new Error('未找到人生结局。');
  } else {
    if(!NODES[choice.next]) throw new Error('未找到后续人生节点。');
    next.node=choice.next;
  }
  next.pending=null;
  return next;
}

// Replay choices through the real rules: old or malformed saves cannot invent resources.
export function restoreGame(saved) {
  if(!saved || saved.version!==1 || !Array.isArray(saved.history) || saved.history.length>50) throw new Error('存档版本或内容无效。');
  let state=newGame();
  for(let i=0;i<saved.history.length;i++) {
    const entry=saved.history[i];
    if(!entry || entry.node!==state.node) throw new Error('存档中的人生顺序无效。');
    state=choose(state,entry.choice);
    if(i<saved.history.length-1 || !saved.pending) state=advance(state);
  }
  if(state.node!==saved.node || state.ending!==saved.ending || Boolean(state.pending)!==Boolean(saved.pending)) throw new Error('存档中的进度无效。');
  return state;
}

export function rewind(state, index) {
  if(!Number.isInteger(index) || index<0 || index>=state.history.length) throw new Error('无效的回溯位置。');
  let next=newGame();
  for(const entry of state.history.slice(0,index)) next=advance(choose(next,entry.choice));
  return next;
}
