// Original pentatonic themes and short Foley cues; no external recordings.
const melody=[
  [0,62,3],[4,66,2],[6,64,2],[8,69,3],[12,66,2],[14,64,2],
  [16,62,3],[20,59,2],[22,57,2],[24,62,4],[28,64,2],[30,66,2],
  [32,69,3],[36,71,2],[38,69,2],[40,66,3],[44,64,2],[46,62,2],
  [48,59,3],[52,62,2],[54,64,2],[56,62,5],[62,57,2]
];
export const THEMES={
  calm:{title:'江海 · 书斋',bpm:52,roots:[50,57,52,47],shift:0},
  learning:{title:'薪火 · 学堂',bpm:58,roots:[50,52,57,50],shift:12},
  tension:{title:'潮涌 · 危机',bpm:50,roots:[50,45,48,50],shift:0},
  reflection:{title:'归舟 · 余响',bpm:46,roots:[50,47,52,50],shift:-12}
};
export const DEFAULT_SOUND={music:true,effects:true,volume:28};

export function themeFor(frame) {
  if(frame.year>=1926)return 'reflection';
  if(/naval-shadow|market-turns|credit-narrows|creditors-enter|promises-mature|imperial-direction|quiet-distance/.test(frame.eventId||''))return 'tension';
  if(/school|teacher|learning|students|museum-plan/.test(frame.eventId||''))return 'learning';
  return 'calm';
}

export function cueFor(frame) {
  if(frame.frameIndex===0&&frame.shotIndex===1&&frame.eventId==='naval-shadow')return 'cannon';
  if(frame.frameIndex===0&&frame.shotIndex===0&&frame.eventId==='laureate')return 'chime';
  if(frame.pose==='read'&&frame.frameIndex===0)return 'scroll';
  if(frame.frameIndex===0&&frame.art==='machines')return 'machine';
  return 'page';
}

export function themeScore(id) {
  const theme=THEMES[id]||THEMES.calm;
  const notes=melody.filter((_,i)=>id!=='reflection'||i%2===0).map(([beat,midi,duration])=>({
    beat,midi:(id==='tension'&&midi===66?65:id==='tension'&&midi===71?72:midi)+theme.shift,
    duration:duration*(id==='reflection'?1.3:1),kind:'pluck',gain:id==='tension'?.19:.23
  }));
  for(let i=0;i<8;i++) {
    const root=theme.roots[Math.floor(i/2)];
    for(const interval of [0,7,14])notes.push({beat:i*8,midi:root+interval,duration:9,kind:'pad',gain:.025});
  }
  return notes.sort((a,b)=>a.beat-b.beat);
}

export function createAudioGraph(context,destination=context.destination) {
  const master=context.createGain(),music=context.createGain(),effects=context.createGain();
  const room=context.createConvolver(),wet=context.createGain(),filter=context.createBiquadFilter();
  master.gain.value=.55;music.gain.value=.65;effects.gain.value=.7;wet.gain.value=.2;
  filter.type='lowpass';filter.frequency.value=3400;filter.Q.value=.35;
  music.connect(filter);filter.connect(master);filter.connect(room);room.connect(wet);wet.connect(master);
  effects.connect(master);master.connect(destination);
  const impulse=context.createBuffer(2,Math.floor(context.sampleRate*1.8),context.sampleRate);
  let seed=7341;
  for(let channel=0;channel<2;channel++) {
    const data=impulse.getChannelData(channel);
    for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=(seed/2**31-1)*Math.pow(1-i/data.length,3)*.25;}
  }
  room.buffer=impulse;
  const real=new Float32Array(9),imaginary=new Float32Array([0,1,.34,.16,.08,.035,.02,.01,.006]);
  const wave=context.createPeriodicWave(real,imaginary);
  const noise=context.createBuffer(1,Math.floor(context.sampleRate*2),context.sampleRate),samples=noise.getChannelData(0);
  let brown=0;
  for(let i=0;i<samples.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const white=seed/2**31-1;brown=(brown+.02*white)/1.02;samples[i]=.6*white+.4*brown*3;}
  return {master,music,effects,wave,noise};
}

function tone(context,graph,destination,note,at,seconds) {
  const oscillator=context.createOscillator(),envelope=context.createGain();
  oscillator.frequency.value=440*2**((note.midi-69)/12);
  if(note.kind==='pad')oscillator.type='sine';else oscillator.setPeriodicWave(graph.wave);
  const duration=Math.max(.25,seconds*note.duration);
  envelope.gain.setValueAtTime(.00001,at);
  if(note.kind==='pad') {
    envelope.gain.linearRampToValueAtTime(note.gain,at+1.2);
    envelope.gain.setValueAtTime(note.gain,at+Math.max(1.3,duration-2));
    envelope.gain.exponentialRampToValueAtTime(.00001,at+duration+1);
  } else {
    envelope.gain.linearRampToValueAtTime(note.gain,at+.014);
    envelope.gain.exponentialRampToValueAtTime(note.gain*.1,at+duration*.7);
    envelope.gain.exponentialRampToValueAtTime(.00001,at+duration+1.2);
  }
  oscillator.connect(envelope);envelope.connect(destination);
  oscillator.start(at);oscillator.stop(at+duration+1.3);
  oscillator.onended=()=>{oscillator.disconnect();envelope.disconnect();};
}

export function scheduleTheme(context,graph,id,at=0,beats=64) {
  const seconds=60/THEMES[id].bpm;
  for(const note of themeScore(id))if(note.beat<beats)tone(context,graph,graph.music,note,at+note.beat*seconds,seconds);
}

export function scheduleCue(context,graph,id,at=context.currentTime) {
  const noise=(duration,frequency,gain,offset=0)=>{
    const source=context.createBufferSource(),filter=context.createBiquadFilter(),envelope=context.createGain();
    source.buffer=graph.noise;filter.type=id==='cannon'?'lowpass':'bandpass';filter.frequency.value=frequency;filter.Q.value=.7;
    envelope.gain.setValueAtTime(.00001,at+offset);envelope.gain.linearRampToValueAtTime(gain,at+offset+.018);envelope.gain.exponentialRampToValueAtTime(.00001,at+offset+duration);
    source.connect(filter);filter.connect(envelope);envelope.connect(graph.effects);source.start(at+offset,0,duration);
    source.onended=()=>{source.disconnect();filter.disconnect();envelope.disconnect();};
  };
  if(id==='cannon') {
    noise(1.5,260,.28);
    const osc=context.createOscillator(),gain=context.createGain();osc.type='sine';osc.frequency.setValueAtTime(85,at);osc.frequency.exponentialRampToValueAtTime(28,at+.8);
    gain.gain.setValueAtTime(.22,at);gain.gain.exponentialRampToValueAtTime(.00001,at+1.1);osc.connect(gain);gain.connect(graph.effects);osc.start(at);osc.stop(at+1.2);osc.onended=()=>{osc.disconnect();gain.disconnect();};
  } else if(id==='chime') {
    for(const [offset,midi] of [[0,74],[.14,81]])tone(context,graph,graph.effects,{kind:'pluck',midi,gain:.15,duration:.55},at+offset,1);
  } else if(id==='scroll') {noise(.45,1600,.09);noise(.36,2300,.065,.22);}
  else if(id==='machine') {for(let i=0;i<5;i++)noise(.11,480,.075,i*.14);}
  else {noise(.11,2700,.045);noise(.11,1700,.035,.075);}
}

export function createSoundtrack(onChange=()=>{}) {
  const key='zhang-jian-sound-v1';let preferences={...DEFAULT_SOUND};
  try {const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved){preferences.music=typeof saved.music==='boolean'?saved.music:preferences.music;preferences.effects=typeof saved.effects==='boolean'?saved.effects:preferences.effects;preferences.volume=Number.isFinite(saved.volume)?Math.max(0,Math.min(100,saved.volume)):preferences.volume;}}catch{/* Defaults are usable without storage. */}
  let context=null,graph=null,timer=null,bus=null,theme='calm',score=[],cursor=0,cycle=0,origin=0,error='';
  const status=()=>({preferences:{...preferences},theme,title:THEMES[theme].title,playing:Boolean(context?.state==='running'&&preferences.music),started:Boolean(context),error});
  const notify=()=>onChange(status());
  function fade(parameter,value,seconds=.06){const t=context.currentTime;parameter.cancelScheduledValues(t);parameter.setTargetAtTime(value,t,seconds);}
  function stopLoop() {
    if(timer!==null){clearInterval(timer);timer=null;}
    if(bus){const old=bus;fade(old.gain,0,.25);setTimeout(()=>old.disconnect(),1600);bus=null;}
  }
  function pump() {
    if(!context||context.state!=='running'||!bus)return;
    const seconds=60/THEMES[theme].bpm;
    for(let guard=0;guard<200;guard++) {
      const note=score[cursor],at=origin+(cycle*64+note.beat)*seconds;
      if(at>context.currentTime+.45)break;
      if(at>=context.currentTime-.03)tone(context,graph,bus,note,Math.max(at,context.currentTime),seconds);
      if(++cursor===score.length){cursor=0;cycle++;}
    }
  }
  function startLoop() {
    stopLoop();if(!context||!preferences.music)return;
    bus=context.createGain();bus.gain.value=0;bus.connect(graph.music);fade(bus.gain,1,.5);
    score=themeScore(theme);cursor=0;cycle=0;origin=context.currentTime+.06;
    pump();timer=setInterval(pump,120);
  }
  async function interact() {
    if(!preferences.music&&!preferences.effects)return;
    try {
      if(!context||context.state==='closed') {
        const Constructor=globalThis.AudioContext||globalThis.webkitAudioContext;
        if(!Constructor)throw new Error('此浏览器暂不支持声音播放');
        context=new Constructor();graph=createAudioGraph(context);graph.master.gain.value=.55*preferences.volume/100;graph.effects.gain.value=preferences.effects?.7:0;
        context.onstatechange=notify;
      }
      if(context.state==='suspended')await context.resume();
      if(preferences.music&&timer===null)startLoop();
      error='';notify();
    } catch(e){error=e.message;notify();}
  }
  function setPreferences(change) {
    const wasMusic=preferences.music;
    preferences={...preferences,...change,volume:Math.max(0,Math.min(100,change.volume??preferences.volume))};
    try {localStorage.setItem(key,JSON.stringify(preferences));}catch{/* Sound remains usable for this session. */}
    if(context&&graph){fade(graph.master.gain,.55*preferences.volume/100);fade(graph.effects.gain,preferences.effects?.7:0);if(!preferences.music)stopLoop();else if(!wasMusic)startLoop();}
    notify();return status();
  }
  function setScene(frame,playEffect=false) {
    const next=themeFor(frame);
    if(next!==theme){theme=next;if(context&&preferences.music)startLoop();notify();}
    if(playEffect&&context?.state==='running'&&preferences.effects)scheduleCue(context,graph,cueFor(frame));
  }
  async function visibility(hidden) {
    if(!context)return;
    if(hidden){if(timer!==null){clearInterval(timer);timer=null;}await context.suspend();}
    else if(preferences.music||preferences.effects)await interact();
    notify();
  }
  function dispose(){if(timer!==null)clearInterval(timer);timer=null;context?.close();context=null;graph=null;bus=null;}
  return {status,interact,setPreferences,setScene,visibility,dispose};
}
