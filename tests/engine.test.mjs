import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { NODES, ENDINGS, SOURCES, STATS, ART, CHARACTER_ART } from '../dist/story.js';
import { EVENTS, INTRO, EPILOGUES, framesFor, aftermath } from '../dist/narrative.js';
import { newGame, choose, advance, previousFrame, readToChoice, rewind, restoreGame, isHistorical, unmetRequirements } from '../dist/engine.js';

function finishText(state) {
  let next=state;
  while(!['choice','ending'].includes(next.phase))next=advance(next);
  return next;
}
function decide(state,id) {return finishText(choose(finishText(state),id));}
function historyRun(deviation) {
  let state=newGame();
  while(state.phase!=='ending') {
    state=finishText(state);
    if(state.phase==='ending')break;
    const n=NODES[state.node];
    const c=state.node===deviation?.node?n.choices.find(c=>c.id===deviation.choice):n.choices.find(c=>c.historical);
    assert.ok(c,`historical choice missing ${state.node}`);
    state=decide(state,c.id);
  }
  return state;
}

test('story graph, nested events, shots, frame text and all assets are valid',()=>{
  const visited=new Set(),stack=new Set();
  function walk(id) {
    assert.ok(!stack.has(id),`cycle at ${id}`);
    if(visited.has(id))return;
    visited.add(id);stack.add(id);
    const n=NODES[id];
    assert.ok(n.fact&&n.body.length&&n.refs.length);
    assert.equal(n.choices.length,3);
    assert.equal(new Set(n.choices.map(c=>c.id)).size,3);
    assert.ok(EVENTS[id].length>=2,'each decision follows several events');
    assert.ok(INTRO[id].length>=6,'events must contain several separate narrative frames');
    for(const e of EVENTS[id]) {
      assert.ok(e.shots.length>=2,'events have multiple pictures');
      assert.ok(new Set(e.shots.map(s=>s.art)).size>=2);
    }
    let year=n.year;
    for(const f of INTRO[id]) {
      assert.ok(ART[f.art]);assert.ok(f.text&&f.text.length>=70&&f.text.length<=150,'each frame has substantive, readable text');
      assert.ok(CHARACTER_ART[f.pose]);
      assert.ok(f.year>=year,`${id}: time moves backwards within a chapter`);year=f.year;
      f.refs.forEach(ref=>assert.ok(SOURCES[ref]));
    }
    for(const c of n.choices) {
      for(const [key,delta] of Object.entries(c.effects)){assert.ok(STATS[key]);assert.ok(Number.isInteger(delta));}
      if(c.next.startsWith('end:'))assert.ok(c.next==='end:legacy'||ENDINGS[c.next.slice(4)]);
      else {assert.ok(NODES[c.next]);assert.ok(INTRO[c.next][0].year>=year,`${id} moves backwards into ${c.next}`);walk(c.next);}
      aftermath(id,c.id).forEach(f=>assert.ok(ART[f.art]&&f.text));
    }
    stack.delete(id);
  }
  walk('beginning');
  assert.equal(visited.size,Object.keys(NODES).length);
  for(const art of Object.values(ART))assert.ok(existsSync(new URL('../dist/'+art.src,import.meta.url)),art.src);
  for(const art of Object.values(CHARACTER_ART))assert.ok(existsSync(new URL('../dist/'+art.src,import.meta.url)),art.src);
  for(const name of ['adult.webp','elder.webp','zhang-jian.jpg','dasheng-1915.jpg','museum-2013.jpg','art-prompts.json'])assert.ok(existsSync(new URL('../dist/assets/'+name,import.meta.url)));
  const prompts=JSON.parse(readFileSync(new URL('../dist/assets/art-prompts.json',import.meta.url)));
  assert.equal(prompts.length,Object.keys(ART).length+Object.keys(CHARACTER_ART).length);
  assert.ok(!JSON.stringify(prompts).includes('/Users/'));
  for(const frames of Object.values(EPILOGUES))assert.ok(frames.length>=3);
});

test('the prologue has narration, multiple events and changing pictures before the first decision',()=>{
  let state=newGame();const stats={...state.stats},seen=new Set();
  assert.throws(()=>choose(state,'business'));
  while(state.phase==='story') {
    seen.add(framesFor(state)[state.frame].art);
    assert.equal(state.history.length,0);
    assert.deepEqual(state.stats,stats);
    assert.deepEqual(restoreGame(state),state);
    state=advance(state);
  }
  assert.ok(state.frame>=12);
  assert.ok(seen.has('exam')&&seen.has('laureate')&&seen.has('fleet')&&seen.has('war'));
  assert.throws(()=>advance(state));
  const previous=previousFrame(state);
  assert.equal(previous.phase,'story');assert.deepEqual(previous.stats,stats);
  assert.deepEqual(advance(previous),state);
});

test('historical choices produce the historical ending; any deviation remains IF',()=>{
  const historical=historyRun();assert.equal(historical.ending,'history');assert.ok(isHistorical(historical));assert.equal(historical.history.length,15);
  const deviated=historyRun({node:'funding',choice:'limits'});assert.equal(deviated.ending,'balanced');assert.ok(!isHistorical(deviated));
});

test('seeded lives reach every decision, option and ending through narrated sequences',()=>{
  let seed=9037;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  const nodes=new Set(),edges=new Set(),endings=new Set();
  for(let run=0;run<5000;run++) {
    let state=newGame();
    for(let step=0;step<40&&state.phase!=='ending';step++) {
      state=finishText(state);if(state.phase==='ending')break;
      nodes.add(state.node);
      const choices=NODES[state.node].choices.filter(c=>!unmetRequirements(state,c).length);assert.ok(choices.length);
      const c=choices[Math.floor(random()*choices.length)];edges.add(state.node+':'+c.id);state=decide(state,c.id);
      Object.values(state.stats).forEach(v=>assert.ok(v>=0&&v<=100));
    }
    assert.equal(state.phase,'ending');endings.add(state.ending);
  }
  const hist=historyRun();endings.add(hist.ending);hist.history.forEach(e=>edges.add(e.node+':'+e.choice));
  assert.equal(nodes.size,Object.keys(NODES).length);
  for(const [id,n] of Object.entries(NODES))for(const c of n.choices)assert.ok(edges.has(id+':'+c.id),id+':'+c.id);
  assert.deepEqual([...endings].sort(),Object.keys(ENDINGS).sort());
});

test('resources change once at a choice, never while reading or reviewing its consequence',()=>{
  const choiceState=readToChoice(newGame()),original=structuredClone(choiceState);
  assert.throws(()=>choose(choiceState,'unknown'));assert.deepEqual(choiceState,original);
  const chosen=choose(choiceState,'business');assert.throws(()=>choose(chosen,'business'));
  const later=advance(chosen);assert.deepEqual(later.stats,chosen.stats);
  assert.deepEqual(previousFrame(later),chosen);
  const low={...readToChoice({...newGame(),node:'restructure'}),stats:{...newGame().stats,cash:39}};
  assert.throws(()=>choose(low,'cash'));
  assert.equal(unmetRequirements({...low,stats:{...low.stats,cash:40}},NODES.restructure.choices[0]).length,0);
});

test('every save phase reloads at the exact frame; old saves retain choices and resources',()=>{
  let state=advance(newGame());assert.deepEqual(restoreGame(state),state);
  state=choose(readToChoice(state),'business');assert.deepEqual(restoreGame(state),state);
  state=advance(state);assert.deepEqual(restoreGame(state),state);
  state=advance(state);assert.equal(state.node,'venture');assert.deepEqual(restoreGame(state),state);
  state=decide(state,'shares');assert.deepEqual(restoreGame({...state,stats:{cash:9999}}),state);
  assert.deepEqual(rewind(state,0),readToChoice(newGame()));
  assert.equal(rewind(state,1).node,'venture');
  assert.throws(()=>restoreGame({...state,frame:9999}));
  assert.throws(()=>restoreGame({...state,phase:'ending'}));
  const legacy={version:1,node:'venture',stats:state.stats,history:[{node:'beginning',choice:'business'}],pending:null,ending:null};
  const migrated=restoreGame(legacy);assert.equal(migrated.version,2);assert.equal(migrated.phase,'story');assert.equal(migrated.frame,0);assert.equal(migrated.stats.industry,35);
  const end=historyRun();assert.deepEqual(restoreGame(end),end);
  assert.throws(()=>advance(end));
  assert.deepEqual(restoreGame(previousFrame(end)),previousFrame(end));
});
