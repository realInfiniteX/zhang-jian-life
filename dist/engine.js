import { NODES, ENDINGS, STATS } from './story.js';
import { INTRO, EPILOGUES, framesFor } from './narrative.js';

export function newGame() {
  return { version:2, node:'beginning', stats:{industry:25,education:15,trust:40,cash:50}, history:[], pending:null, ending:null, phase:'story', frame:0 };
}

export function unmetRequirements(state,choice) {
  return Object.entries(choice.requires||{}).filter(([key,value])=>state.stats[key]<value).map(([key,value])=>`${STATS[key]}至少 ${value}`);
}

export function choose(state,choiceId) {
  if(state.phase!=='choice')throw new Error('这一帧是故事。读完当前事件后，再作出选择。');
  const choice=NODES[state.node]?.choices.find(c=>c.id===choiceId);
  if(!choice)throw new Error('这一节点没有该选项。');
  const unmet=unmetRequirements(state,choice);
  if(unmet.length)throw new Error(unmet.join('，'));
  const next=structuredClone(state),changes={};
  for(const [key,delta] of Object.entries(choice.effects)) {
    next.stats[key]=Math.max(0,Math.min(100,next.stats[key]+delta));
    changes[key]=next.stats[key]-state.stats[key];
  }
  next.history.push({node:state.node,choice:choice.id});
  next.pending={node:state.node,choice:choice.id,changes};
  next.phase='consequence';next.frame=0;
  return next;
}

export function isHistorical(state) {
  return state.history.every(h=>NODES[h.node]?.choices.find(c=>c.id===h.choice)?.historical);
}

export function advance(state) {
  if(state.phase==='choice')throw new Error('请先作出一个选择。');
  if(state.phase==='ending')throw new Error('这一生已经走到终章。');
  const next=structuredClone(state);
  next.frame++;
  if(next.frame<framesFor(state).length)return next;
  if(state.phase==='story') {next.phase='choice';return next;}
  if(state.phase==='epilogue') {next.phase='ending';return next;}
  const choice=NODES[state.node].choices.find(c=>c.id===state.pending.choice);
  next.pending=null;next.frame=0;
  if(choice.next.startsWith('end:')) {
    const key=choice.next.slice(4);
    next.ending=key==='legacy'?(isHistorical(next)?'history':'balanced'):key;
    if(!ENDINGS[next.ending])throw new Error('未找到人生结局。');
    next.phase='epilogue';
  } else {
    if(!NODES[choice.next])throw new Error('未找到后续人生节点。');
    next.node=choice.next;next.phase='story';
  }
  return next;
}

export function previousFrame(state) {
  const next=structuredClone(state);
  if(state.phase==='choice') {next.phase='story';next.frame=INTRO[state.node].length-1;}
  else if(state.phase==='ending') {next.phase='epilogue';next.frame=EPILOGUES[state.ending].length-1;}
  else if(state.frame>0)next.frame--;
  else throw new Error('已经是这一段故事的第一帧。');
  return next;
}

export function readToChoice(state) {
  let next=state;
  while(next.phase==='story')next=advance(next);
  return next;
}

function finishConsequence(state) {
  let next=state;
  while(next.phase==='consequence')next=advance(next);
  return next;
}

// Replay decisions; narrated frames carry no resource mutations.
export function restoreGame(saved) {
  if(!saved||![1,2].includes(saved.version)||!Array.isArray(saved.history)||saved.history.length>50)throw new Error('存档版本或内容无效。');
  let next=newGame();
  for(let i=0;i<saved.history.length;i++) {
    const entry=saved.history[i];
    if(!entry||entry.node!==next.node)throw new Error('存档中的人生顺序无效。');
    next=choose(readToChoice(next),entry.choice);
    if(i<saved.history.length-1||!saved.pending)next=finishConsequence(next);
  }
  if(next.node!==saved.node||next.ending!==saved.ending||Boolean(next.pending)!==Boolean(saved.pending))throw new Error('存档中的进度无效。');
  if(saved.version===1) {
    if(next.phase==='epilogue'){next.phase='ending';next.frame=EPILOGUES[next.ending].length;}
    return next;
  }
  const phase=saved.phase,frame=saved.frame;
  if(!Number.isInteger(frame)||frame<0)throw new Error('存档帧无效。');
  const boundary=(next.phase==='story'&&phase==='choice')||(next.phase==='epilogue'&&phase==='ending');
  if(phase!==next.phase&&!boundary)throw new Error('存档阶段无效。');
  const count=framesFor(next).length;
  if(boundary?frame!==count:frame>=count)throw new Error('存档超出故事范围。');
  next.phase=phase;next.frame=frame;
  return next;
}

export function rewind(state,index) {
  if(!Number.isInteger(index)||index<0||index>=state.history.length)throw new Error('无效的回溯位置。');
  let next=newGame();
  for(const entry of state.history.slice(0,index))next=finishConsequence(choose(readToChoice(next),entry.choice));
  return readToChoice(next);
}
