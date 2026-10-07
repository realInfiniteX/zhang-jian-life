import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, themeScore, themeFor, cueFor } from '../dist/audio.js';
import { INTRO } from '../dist/narrative.js';

test('original scores have a bounded complete loop and valid musical voices',()=>{
  for(const id of Object.keys(THEMES)) {
    const notes=themeScore(id);assert.ok(notes.length>=25);
    let beat=-1;
    for(const note of notes) {
      assert.ok(note.beat>=beat&&note.beat<64);beat=note.beat;
      assert.ok(note.midi>=28&&note.midi<=96);
      assert.ok(note.duration>0&&note.duration<16);
      assert.ok(note.gain>0&&note.gain<.4);
    }
  }
  assert.notDeepEqual(themeScore('calm'),themeScore('tension'));
});

test('themes and sound cues follow actual narrative events',()=>{
  const prologue=INTRO.beginning;
  const greeting=prologue.find(f=>f.eventId==='laureate'&&f.frameIndex===0);
  const battle=prologue.find(f=>f.eventId==='naval-shadow'&&f.shotIndex===1&&f.frameIndex===0);
  assert.equal(greeting.pose,'greet');assert.equal(cueFor(greeting),'chime');
  assert.equal(themeFor(battle),'tension');assert.equal(cueFor(battle),'cannon');
  assert.equal(themeFor(INTRO.school[0]),'learning');
  assert.equal(themeFor({year:1926}),'reflection');
  assert.equal(cueFor(prologue[1]),'page');
});
