import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { NODES, ENDINGS, SOURCES, STATS, ART } from '../dist/story.js';
import { newGame, choose, advance, rewind, restoreGame, isHistorical, unmetRequirements } from '../dist/engine.js';

test('all story links, history sources, assets and chronology are valid; graph is acyclic',()=>{
  const visited=new Set(),stack=new Set();
  function walk(id) {
    assert.ok(!stack.has(id),`cycle at ${id}`);
    if(visited.has(id))return;
    visited.add(id);stack.add(id);
    const n=NODES[id];
    assert.ok(n.fact && n.body.length && n.refs.length);
    n.refs.forEach(ref=>assert.ok(SOURCES[ref],`missing source ${ref}`));
    assert.ok(ART[n.art]);
    assert.equal(n.choices.length,3);
    assert.equal(new Set(n.choices.map(c=>c.id)).size,3);
    for(const c of n.choices) {
      for(const [key,delta] of Object.entries(c.effects)) {assert.ok(STATS[key]);assert.ok(Number.isInteger(delta));}
      if(c.next.startsWith('end:'))assert.ok(c.next==='end:legacy'||ENDINGS[c.next.slice(4)],`missing ending ${c.next}`);
      else {assert.ok(NODES[c.next],`${id} missing ${c.next}`);assert.ok(NODES[c.next].year>=n.year,`${id} moves backwards in time`);walk(c.next);}
    }
    stack.delete(id);
  }
  walk('beginning');
  assert.equal(visited.size,Object.keys(NODES).length,'unreachable content');
  for(const art of Object.values(ART))assert.ok(existsSync(new URL('../dist/'+art.src,import.meta.url)));
  for(const name of ['adult.webp','elder.webp','zhang-jian.jpg','dasheng-1915.jpg','museum-2013.jpg','art-prompts.json'])assert.ok(existsSync(new URL('../dist/assets/'+name,import.meta.url)));
  const prompts=JSON.parse(readFileSync(new URL('../dist/assets/art-prompts.json',import.meta.url)));
  assert.equal(prompts.length,5);
  assert.ok(!JSON.stringify(prompts).includes('/Users/'),'no local paths in public attribution');
});

function historyRun(deviation) {
  let state=newGame();
  while(!state.ending) {
    const n=NODES[state.node];
    const c=state.node===deviation?.node?n.choices.find(c=>c.id===deviation.choice):n.choices.find(c=>c.historical);
    assert.ok(c,`historical choice missing ${state.node}`);
    state=advance(choose(state,c.id));
  }
  return state;
}

test('continuous historical choices produce the historical ending; one deviation remains IF',()=>{
  const historical=historyRun();
  assert.equal(historical.ending,'history');
  assert.ok(isHistorical(historical));
  assert.equal(historical.history.length,15);
  const deviated=historyRun({node:'funding',choice:'limits'});
  assert.equal(deviated.ending,'balanced');
  assert.ok(!isHistorical(deviated));
});

test('seeded playthroughs reach every node, every choice and every ending without dead ends',()=>{
  let seed=9037;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  const nodes=new Set(),edges=new Set(),endings=new Set();
  for(let run=0;run<5000;run++) {
    let state=newGame();
    for(let step=0;step<40&&!state.ending;step++) {
      nodes.add(state.node);
      const choices=NODES[state.node].choices.filter(c=>!unmetRequirements(state,c).length);
      assert.ok(choices.length,'no available choices');
      const c=choices[Math.floor(random()*choices.length)];
      edges.add(state.node+':'+c.id);
      state=advance(choose(state,c.id));
      for(const value of Object.values(state.stats))assert.ok(value>=0&&value<=100);
    }
    assert.ok(state.ending,'did not terminate');
    endings.add(state.ending);
  }
  const hist=historyRun();endings.add(hist.ending);
  for(const entry of hist.history)edges.add(entry.node+':'+entry.choice);
  assert.equal(nodes.size,Object.keys(NODES).length);
  const missing=[];
  for(const [id,n] of Object.entries(NODES))for(const c of n.choices)if(!edges.has(id+':'+c.id))missing.push(id+':'+c.id);
  assert.deepEqual(missing,[],'every choice must have a playable path');
  assert.deepEqual([...endings].sort(),Object.keys(ENDINGS).sort());
});

test('resource requirements, consequence locking and invalid inputs do not corrupt the source state',()=>{
  let state=newGame();
  const original=structuredClone(state);
  assert.throws(()=>choose(state,'unknown'));
  assert.throws(()=>advance(state));
  assert.deepEqual(state,original);
  state=choose(state,'business');
  assert.throws(()=>choose(state,'business'));
  const gated=NODES.restructure.choices.find(c=>c.id==='cash');
  assert.ok(unmetRequirements({...newGame(),node:'restructure',stats:{...newGame().stats,cash:39}},gated).length);
  assert.equal(unmetRequirements({...newGame(),stats:{...newGame().stats,cash:40}},gated).length,0);
  assert.throws(()=>choose({...newGame(),node:'restructure',stats:{...newGame().stats,cash:39}},'cash'));
});

test('reload and rewind replay choices and resources, including pending consequences and endings',()=>{
  const initial=newGame();
  let state=choose(initial,'business');
  assert.deepEqual(restoreGame(JSON.parse(JSON.stringify(state))),state);
  state=advance(state);
  state=advance(choose(state,'shares'));
  assert.deepEqual(restoreGame({...state,stats:{cash:9999}}),state);
  assert.deepEqual(rewind(state,0),initial);
  assert.deepEqual(rewind(state,1),advance(choose(initial,'business')));
  assert.throws(()=>rewind(state,-1));
  assert.throws(()=>restoreGame({version:1,history:[{node:'bank',choice:'protect'}]}));
  assert.deepEqual(restoreGame(historyRun()),historyRun());
});
