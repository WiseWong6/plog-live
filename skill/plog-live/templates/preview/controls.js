const v=document.querySelector('video'),play=document.querySelector('#play'),range=document.querySelector('#progress'),replay=document.querySelector('#replay'),speed=document.querySelector('#speed'),sound=document.querySelector('#sound'),time=document.querySelector('output');
let enabled=false,drag=false,resume=false,hide;v.muted=true;
const clock=t=>`${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`;
function update(){play.textContent=v.paused?'播放':'暂停';range.max=v.duration||1;range.value=v.currentTime;time.textContent=`${clock(v.currentTime/v.playbackRate)} / ${clock((v.duration||0)/v.playbackRate)}`;v.muted=!enabled||v.paused||drag||document.hidden;}
function toggle(){v.paused?v.play().catch(()=>{}):v.pause();update()}
play.onclick=toggle;replay.onclick=()=>{v.currentTime=0;v.play().catch(()=>{});update()};
speed.onclick=()=>{const rates=[.5,1,1.5,2,3];v.playbackRate=rates[(rates.indexOf(v.playbackRate)+1)%rates.length];speed.textContent=v.playbackRate+'×';update()};
if(sound)sound.onclick=()=>{enabled=!enabled;sound.textContent=enabled?'声音开':'声音关';sound.setAttribute('aria-pressed',enabled);update()};
range.onpointerdown=event=>{resume=!v.paused;drag=true;v.pause();range.setPointerCapture?.(event.pointerId)};
range.oninput=()=>{v.currentTime=Number(range.value);update()};
function release(){if(!drag)return;drag=false;if(resume)v.play().catch(()=>{});update()};range.onpointerup=release;range.onpointercancel=release;
for(const e of ['loadedmetadata','timeupdate','play','pause','seeked','ratechange'])v.addEventListener(e,update);
document.addEventListener('visibilitychange',()=>{if(document.hidden)v.pause();update()});window.addEventListener('pagehide',()=>v.pause());
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!['BUTTON','INPUT'].includes(document.activeElement.tagName)){e.preventDefault();toggle()}});
document.addEventListener('pointermove',()=>{document.body.classList.add('show');clearTimeout(hide);hide=setTimeout(()=>{if(!drag)document.body.classList.remove('show')},1600)});
update();
