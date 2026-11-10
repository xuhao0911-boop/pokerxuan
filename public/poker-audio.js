/* Original procedural lounge score + physical card/chip sounds + local action calls. */
(function(root){
 'use strict';
 const KEY='px-audio-v1',defaults={enabled:true,music:true,effects:true,volume:75,musicVolume:25,effectsVolume:70};
 function normalize(value){const c={...defaults};for(const k of ['enabled','music','effects'])if(typeof value?.[k]==='boolean')c[k]=value[k];for(const k of ['volume','musicVolume','effectsVolume'])if(typeof value?.[k]==='number'&&Number.isFinite(value[k]))c[k]=Math.max(0,Math.min(100,value[k]));return c;}
 const actionKey=a=>a?(a.eventId||[a.at,a.id,a.type,a.amount,a.paid].join(':')):'';
 class Tracker{
  constructor(){this.previous=null;}
  reset(){this.previous=null;}
  update(r){
   if(!r)return [];const p=this.previous;
   if(p?.id===r.id&&r.version<p.version)return [];
   const g=r.game,draw=r.dealerDraw?.active?r.dealerDraw.rounds.at(-1):null;
   const next={id:r.id,version:r.version,hand:g?.hand,board:g?.board.length||0,action:actionKey(g?.lastAction),draw:draw?[draw.number,draw.startedAt||r.dealerDraw.nextAt].join(':'):''};
   this.previous=next;if(!p||p.id!==r.id)return [];
   const events=[];
   if(next.draw&&next.draw!==p.draw)events.push({type:'shuffle'});
   if(g&&next.hand!==p.hand)events.push({type:'deal'});
   if(g&&next.hand===p.hand&&next.board>p.board)events.push({type:'flip',count:next.board-p.board});
   const a=g?.lastAction;if(a&&next.hand===p.hand&&next.action!==p.action&&r.serverNow-a.at<2500&&r.serverNow>=a.at){const type=['call','raise','bet','allin','check','fold'].includes(a.sound)?a.sound:a.type;if(['call','raise','bet','allin','check','fold'].includes(type))events.push({type});}
   return events;
  }
 }
 const tracker=new Tracker();let config=normalize(null);try{config=normalize(JSON.parse(root.localStorage.getItem(KEY)));}catch{}
 let context,master,musicGain,effectsGain,noiseBuffer,unlocked=false,musicTimer=null,nextBeat=0,beat=0,voiceToken=0,activeVoice=null;
 const musicNodes=new Set(),samples=new Map(),metrics={effects:0,voices:0,beats:0};
 const musicAudible=()=>config.enabled&&config.music&&config.volume>0&&config.musicVolume>0&&!root.document?.hidden;
 const effectsAudible=()=>config.enabled&&config.effects&&config.volume>0&&config.effectsVolume>0&&!root.document?.hidden;
 function mix(){if(!context)return;const t=context.currentTime;master.gain.setTargetAtTime(config.enabled?config.volume/100:0,t,.025);musicGain.gain.setTargetAtTime(config.music?config.musicVolume/100:0,t,.04);effectsGain.gain.setTargetAtTime(config.effects?config.effectsVolume/100:0,t,.025);}
 function note(midi,time,duration,level,destination,type='sine',tracked=false){
  const osc=context.createOscillator(),gain=context.createGain();osc.type=type;osc.frequency.value=440*2**((midi-69)/12);gain.gain.setValueAtTime(.00001,time);gain.gain.exponentialRampToValueAtTime(Math.max(.00002,level),time+.018);gain.gain.exponentialRampToValueAtTime(.00001,time+duration);osc.connect(gain);gain.connect(destination);osc.start(time);osc.stop(time+duration+.03);
  if(tracked){musicNodes.add(osc);osc.onended=()=>{musicNodes.delete(osc);gain.disconnect();};}else osc.onended=()=>gain.disconnect();
 }
 function stopMusic(){if(musicTimer){clearInterval(musicTimer);musicTimer=null;}for(const n of musicNodes){try{n.stop();}catch{}}musicNodes.clear();}
 function startMusic(){
  if(!context||!unlocked||context.state!=='running'||!musicAudible()||musicTimer)return;
  nextBeat=context.currentTime+.08;beat=0;
  // An original 84 BPM Dm9 / G13 / Cmaj9 / A7 lounge progression; no recording dependency.
  const chords=[[50,57,60,64,69],[43,53,59,64,69],[48,55,59,62,67],[45,55,61,64,67]],melody=[[76,72],[74,71],[74,71],[73,69]],step=60/84;
  const schedule=()=>{if(!musicAudible()){stopMusic();return;}if(nextBeat<context.currentTime-.2)nextBeat=context.currentTime+.05;while(nextBeat<context.currentTime+.45){const bar=Math.floor(beat/4)%4,pos=beat%4,chord=chords[bar];if(pos===0){chord.slice(1).forEach((n,i)=>note(n,nextBeat+i*.025,step*3.65,.026,musicGain,'triangle',true));note(chord[0]-12,nextBeat,step*1.65,.055,musicGain,'sine',true);}if(pos===2)note(chord[0]-5,nextBeat,step*1.4,.035,musicGain,'sine',true);if(pos===1||pos===3)note(melody[bar][pos===1?0:1],nextBeat,step*1.3,.035,musicGain,'sine',true);metrics.beats++;beat++;nextBeat+=step;}};
  schedule();musicTimer=setInterval(schedule,160);
 }
 async function loadVoice(type){if(!samples.has(type))samples.set(type,fetch('/voice-'+type+'.wav',{cache:'force-cache',signal:AbortSignal.timeout(6000)}).then(r=>{if(!r.ok)throw Error('voice');return r.arrayBuffer();}).then(b=>context.decodeAudioData(b)).catch(()=>null));return samples.get(type);}
 async function voice(type){
  const serial=++voiceToken,at=Date.now(),buffer=await loadVoice(type);
  if(!buffer||serial!==voiceToken||Date.now()-at>1400||!effectsAudible()||context.state!=='running')return;
  try{activeVoice?.stop();}catch{}const source=context.createBufferSource();source.buffer=buffer;const gain=context.createGain();gain.gain.value=.76;source.connect(gain);gain.connect(effectsGain);source.start();source.onended=()=>gain.disconnect();activeVoice=source;metrics.voices++;
 }
 function noise(time,duration,level,cutoff){const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();source.buffer=noiseBuffer;filter.type='highpass';filter.frequency.value=cutoff;gain.gain.setValueAtTime(.00001,time);gain.gain.linearRampToValueAtTime(level,time+.003);gain.gain.exponentialRampToValueAtTime(.00001,time+duration);source.connect(filter);filter.connect(gain);gain.connect(effectsGain);source.start(time,0,duration);source.onended=()=>{gain.disconnect();filter.disconnect();};}
 function cardSound(t){noise(t,.085,.16,2300);note(65,t+.008,.04,.035,effectsGain,'triangle');}
 function chips(t,count){for(let i=0;i<count;i++){const at=t+i*.047;noise(at,.045,.08,4300);note(91+(i%3)*4,at,.05,.045,effectsGain,'triangle');}}
 function play(event){
  if(!context||!unlocked||context.state!=='running'||!effectsAudible())return;
  metrics.effects++;const t=context.currentTime+.008;
  if(event.type==='shuffle'){for(let i=0;i<7;i++)noise(t+i*.045,.05,.08,2600);return;}
  if(event.type==='deal'||event.type==='flip'){const count=event.type==='deal'?4:Math.min(5,event.count||1);for(let i=0;i<count;i++)cardSound(t+i*.1);return;}
  if(event.type==='fold'){cardSound(t);void voice('fold');return;}
  if(event.type==='check'){note(73,t,.07,.07,effectsGain,'triangle');note(73,t+.09,.07,.05,effectsGain,'triangle');void voice('check');return;}
  chips(t,event.type==='allin'?6:event.type==='raise'?4:3);void voice(event.type);
 }
 async function unlock(){
  if(!config.enabled||root.document?.hidden)return;
  try{if(!context){const AC=root.AudioContext||root.webkitAudioContext;if(!AC)return;context=new AC();master=context.createGain();musicGain=context.createGain();effectsGain=context.createGain();musicGain.connect(master);effectsGain.connect(master);const limiter=context.createDynamicsCompressor();limiter.threshold.value=-10;limiter.knee.value=12;limiter.ratio.value=3;master.connect(limiter);limiter.connect(context.destination);noiseBuffer=context.createBuffer(1,Math.ceil(context.sampleRate*.4),context.sampleRate);const data=noiseBuffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;mix();}
   if(context.state==='suspended')await context.resume();unlocked=context.state==='running';mix();startMusic();if(effectsAudible())for(const type of ['call','raise','allin','bet','check','fold'])void loadVoice(type);
  }catch{ /* Audio availability never interrupts a hand. */ }
 }
 function setSettings(input,persist=true){config=normalize({...config,...input});if(persist)try{root.localStorage.setItem(KEY,JSON.stringify(config));}catch{}mix();if(!effectsAudible()){voiceToken++;try{activeVoice?.stop();}catch{}}if(!musicAudible())stopMusic();else if(unlocked)startMusic();if(config.enabled)void unlock();return {...config};}
 root.PokerAudio={normalize,Tracker,getSettings:()=>({...config}),setSettings,unlock,observe:r=>{for(const e of tracker.update(r))play(e);},resetRoom:()=>tracker.reset(),getStatus:()=>({unlocked,state:context?.state||'locked',musicRunning:!!musicTimer,...metrics})};
 if(root.document){root.document.addEventListener('pointerdown',()=>void unlock(),{capture:true,passive:true});root.document.addEventListener('keydown',()=>void unlock(),{capture:true});root.document.addEventListener('visibilitychange',()=>{if(root.document.hidden){stopMusic();voiceToken++;try{activeVoice?.stop();}catch{}void context?.suspend().catch(()=>{});}else if(unlocked)void unlock();});root.addEventListener('pagehide',stopMusic);root.addEventListener('storage',e=>{if(e.key===KEY)try{setSettings(JSON.parse(e.newValue),false);}catch{}});}
})(globalThis);
