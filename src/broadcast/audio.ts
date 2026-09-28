// Supply a licensed track in broadcast-audio.json. No autoplay audio until explicitly enabled.
const player=document.getElementById('broadcast-audio') as HTMLAudioElement;
player.loop=true;
const query=new URLSearchParams(location.search);
const muted=query.get('audio')==='off';
let desired=false,loadedSrc='';
async function play(){if(!desired||muted)return;try{await player.play();}catch{/* Browser autoplay can require a producer interaction. */}}
if(query.get('controls')==='1'){
  player.controls=true;player.style.cssText='position:absolute;z-index:20;right:50px;top:190px;width:350px';
}
addEventListener('pointerdown',()=>void play());
addEventListener('keydown',()=>void play());
player.addEventListener('error',()=>{player.dataset.state='error';});
player.addEventListener('playing',()=>{player.dataset.state='playing';});
async function refreshAudio(){
  try{
    const response=await fetch('/broadcast-audio.json',{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)return;
    const config=await response.json();
    if(config.enabled!==true||typeof config.src!=='string'||!config.src.trim()||muted){desired=false;player.pause();return;}
    const url=new URL(config.src,location.origin);if(url.protocol!=='https:'&&url.origin!==location.origin)return;
    player.volume=Number.isFinite(config.volume)?Math.max(0,Math.min(1,config.volume)):0.15;
    player.setAttribute('aria-label',typeof config.label==='string'?config.label:'Background music');
    desired=true;
    if(url.href!==loadedSrc){loadedSrc=url.href;player.src=loadedSrc;player.load();}
    if(player.paused)await play();
  }catch{/* Retain playback through a temporary configuration fetch failure. */}
}
void refreshAudio();setInterval(()=>void refreshAudio(),60000);
