// Promoted current-day gallery. Existing day-two routing owns the five editions.
const layoutUrl = new URL('./current-day-layout.js', import.meta.url);
layoutUrl.search = new URL(import.meta.url).search;
const {default:variant} = await import(layoutUrl.href);
const params=new URLSearchParams(location.search);
const section=document.querySelector('[data-current-day]');
section.dataset.labVariant=variant.id;
function syncLanguageLinks(){
  for(const link of document.querySelectorAll('a[data-language-switch]')){
    const target=new URL(link.href);
    for(const key of ['frame','release','theme','text','codexQa']){
      if(new URL(location.href).searchParams.has(key))target.searchParams.set(key,new URL(location.href).searchParams.get(key));
    }
    target.hash=location.hash;
    link.href=target.href;
  }
}
syncLanguageLinks();
const config=JSON.parse(document.getElementById('lab-config').textContent);
const canvas=section.querySelector('.lab-canvas');
const controls=section.querySelector('.lab-controls');
const currentText=section.querySelector('.lab-current');
const storyMore=section.querySelector('.lab-story__more');
let compactStoryOpen=false;
let storyFitCache;
storyMore.addEventListener('click',event=>{if(event.target.closest('summary'))compactStoryOpen=!storyMore.open;});
const frames=[...canvas.querySelectorAll('.lab-frame')];
const count=section.querySelector('.lab-count');
const dialog=section.querySelector('.lab-viewer');
const fullImage=dialog.querySelector('img');
const close=dialog.querySelector('[data-lab-close]');
const reduced=()=>matchMedia('(prefers-reduced-motion:reduce)').matches||document.documentElement.dataset.reduceMotion==='true';
const normalized=index=>(index%frames.length+frames.length)%frames.length;
let current=normalized((Number(params.get('frame'))||1)-1);
let layoutSpec;
let visualOrder=[];
let lastSize='';
let scheduled;
let dragging;
let suppressClickUntil=0;
let photoOpener;

function pauseVideos(except){for(const video of canvas.querySelectorAll('video'))if(video!==except)video.pause();}
function arrange({animate=false,instant=false}={}){
  if(!canvas.clientWidth)return;
  const controlsFocus=controls.contains(document.activeElement)?document.activeElement:null;
  const old=new Map(frames.filter(frame=>!frame.hidden).map(frame=>[frame,{rect:frame.getBoundingClientRect(),slot:frame.dataset.slot}]));
  section.dataset.layoutReady='true';
  frames.forEach(frame=>frame.getAnimations().forEach(animation=>animation.cancel()));
  visualOrder=Array.from({length:Math.min(3,frames.length)},(_,slot)=>frames[normalized(current+slot)]);
  const visible=new Set(visualOrder);
  for(const frame of frames){
    frame.hidden=!visible.has(frame);
    const slot=visualOrder.indexOf(frame);
    frame.dataset.slot=slot;
    frame.dataset.current=String(slot===0);
    frame.querySelector('.lab-select').hidden=slot===0||slot<0;
    const media=frame.querySelector('.lab-photo,video');
    media.inert=slot!==0;
    const video=frame.querySelector('video');
    if(video){video.controls=slot===0;if(slot!==0)video.pause();}
  }
  // Reorder the same nodes, so keyboard order follows the visible sequence.
  const existingOrder=[...canvas.children].filter(frame=>frame.classList.contains('lab-frame')&&!frame.hidden);
  if(existingOrder.some((frame,index)=>frame!==visualOrder[index]))for(const frame of visualOrder)canvas.append(frame);
  const style=getComputedStyle(canvas);
  const gap=parseFloat(style.columnGap)||parseFloat(style.gap)||12;
  const rem=parseFloat(getComputedStyle(document.documentElement).fontSize)||16;
  section.dataset.queueCompact=String(variant.id==='queue'&&canvas.clientWidth<36*rem);
  const controlsHeight=Math.max(44,controls.getBoundingClientRect().height);
  const sectionInset=canvas.getBoundingClientRect().top-section.getBoundingClientRect().top;
  const menuBottom=document.querySelector('.menu-toggle')?.getBoundingClientRect().bottom||0;
  const controlsGap=parseFloat(getComputedStyle(controls).marginBlockStart)||0;
  const availableHeight=Math.max(220,innerHeight-sectionInset-menuBottom-2*gap-controlsHeight-controlsGap);
  const layoutInput={width:canvas.clientWidth,viewportWidth:innerWidth,viewportHeight:innerHeight,ratios:visualOrder.map(frame=>Number(frame.dataset.ratio)),gap,rem,controlsHeight,currentTextHeight:0,availableHeight};
  layoutSpec=variant.layout(layoutInput);
  if(variant.id==='queue'&&layoutSpec.currentText){
    // The source width changes with its native format. Measure the actual
    // copy at the available width before giving the lower pair its positions.
    for(let pass=0;pass<3;pass++){
      currentText.style.left=`${layoutSpec.currentText.x}px`;
      currentText.style.width=`${layoutSpec.currentText.measureWidth}px`;
      layoutInput.currentTextHeight=currentText.getBoundingClientRect().height;
      layoutSpec=variant.layout(layoutInput);
    }
    currentText.style.left=`${layoutSpec.currentText.x}px`;
    currentText.style.width=`${layoutSpec.currentText.width}px`;
  }
  section.dataset.queueCompact=String(variant.id==='queue'&&!layoutSpec.currentText);
  // If the narrowest native source needs two rows, retain those rows for
  // the whole sequence. A wider 3:4 selection must not collapse the panel
  // and move the keyboard command or the document below it.
  const commandWidth=controls.querySelector('.lab-arrows').getBoundingClientRect().width;
  const controlsPairGap=parseFloat(getComputedStyle(controls).columnGap)||0;
  const controlsNeeded=count.getBoundingClientRect().width+commandWidth+controlsPairGap;
  section.dataset.controlsStacked=String(controlsNeeded>layoutSpec.height*Math.min(...layoutInput.ratios));
  controls.style.width=`${layoutSpec.controls.width}px`;
  const measuredControlsHeight=Math.max(44,controls.getBoundingClientRect().height);
  if(Math.abs(measuredControlsHeight-layoutInput.controlsHeight)>.5)layoutSpec=variant.layout({...layoutInput,controlsHeight:measuredControlsHeight,availableHeight:availableHeight-(measuredControlsHeight-controlsHeight)});
  if(layoutSpec.currentText){
    currentText.style.left=`${layoutSpec.currentText.x}px`;
    currentText.style.width=`${layoutSpec.currentText.width}px`;
  }
  // Show the complete memoir when it balances the media height. A short
  // window offers the first full paragraph and keeps the rest one action away.
  const storyFitKey=`${section.clientWidth}:${rem}:${layoutSpec.height}:${measuredControlsHeight}`;
  if(storyFitCache?.key!==storyFitKey){
    section.dataset.measuringStory='true';
    section.dataset.storyCollapsible='false';
    storyMore.open=true;
    const fits=section.clientWidth>66*rem&&section.querySelector('.lab-story').getBoundingClientRect().height<=layoutSpec.height+measuredControlsHeight;
    storyFitCache={key:storyFitKey,fits};
  }
  const storyCollapsible=variant.id==='queue'&&!storyFitCache.fits;
  section.dataset.storyCollapsible=String(storyCollapsible);
  storyMore.open=!storyCollapsible||compactStoryOpen;
  if(section.hasAttribute('data-measuring-story')){
    // Commit the restored open/closed layout while transitions are disabled;
    // removing the measurement flag must not animate a phantom disclosure.
    void storyMore.offsetHeight;
    delete section.dataset.measuringStory;
  }
  canvas.style.height=`${layoutSpec.height}px`;
  for(const [slot,frame] of visualOrder.entries()){
    const p=layoutSpec.positions[slot];
    if(!p||![p.x,p.y,p.width,p.height].every(Number.isFinite))throw new Error(`Invalid ${variant.id} layout`);
    frame.style.width=`${p.width}px`;
    frame.style.height=`${p.height}px`;
    frame.style.transform=`translate(${p.x}px,${p.y}px)`;
    frame.style.zIndex=String(slot===0?3:2-slot);
    if(animate&&!instant&&!reduced()){
      if(variant.id==='queue'&&slot===0){
        frame.querySelector('.lab-photo,video').animate([{opacity:.35},{opacity:1}],{duration:240,easing:'cubic-bezier(.22,1,.36,1)'});
        continue;
      }
      const before=old.get(frame);
      const now=frame.getBoundingClientRect();
      const shiftedOut=before?.slot==='0'&&slot===visualOrder.length-1;
      if(before&&!shiftedOut&&before.rect.width&&before.rect.height){
        const dx=before.rect.left-now.left,dy=before.rect.top-now.top;
        frame.animate([
          {transform:`translate(${p.x+dx}px,${p.y+dy}px) scale(${before.rect.width/now.width},${before.rect.height/now.height})`},
          {transform:`translate(${p.x}px,${p.y}px) scale(1,1)`}
        ],{duration:480,easing:getComputedStyle(section).getPropertyValue('--ease-move').trim()||'cubic-bezier(.65,0,.35,1)'});
      }else{
        frame.animate([{opacity:0},{opacity:1}],{duration:240,easing:'cubic-bezier(.22,1,.36,1)'});
      }
    }
  }
  controls.style.width=`${layoutSpec.controls.width}px`;
  const floatingControls=Number.isFinite(layoutSpec.controls.y);
  controls.style.position=floatingControls?'absolute':'';
  controls.style.top=floatingControls?`${layoutSpec.controls.y}px`:'';
  controls.style.left=floatingControls?`${layoutSpec.controls.x}px`:'';
  controls.style.marginBlockStart=floatingControls?'0':'';
  controls.style.marginInlineStart=floatingControls?'0':`${layoutSpec.controls.x}px`;
  if(floatingControls){
    if(controls.parentElement!==canvas||controls.nextElementSibling!==(visualOrder[1]||null))canvas.insertBefore(controls,visualOrder[1]||null);
  }else if(controls.parentElement!==canvas.parentElement||controls.previousElementSibling!==canvas)canvas.after(controls);
  if(controlsFocus&&document.activeElement!==controlsFocus)controlsFocus.focus({preventScroll:true});
  count.textContent=`${current+1} / ${frames.length}`;
  section.dataset.selected=String(current+1);
  section.dataset.layoutReady='true';
  lastSize=`${canvas.clientWidth}:${innerWidth}:${innerHeight}:${rem}`;
}
function select(index,{keyboard=false}={}){
  current=normalized(index);
  pauseVideos();
  arrange({animate:true,instant:keyboard});
  const url=new URL(location);url.searchParams.set('frame',current+1);history.replaceState(null,'',url);
  syncLanguageLinks();
}
function schedule(){
  cancelAnimationFrame(scheduled);
  scheduled=requestAnimationFrame(()=>{
    const rem=parseFloat(getComputedStyle(document.documentElement).fontSize)||16;
    if(lastSize!==`${canvas.clientWidth}:${innerWidth}:${innerHeight}:${rem}`)arrange();
  });
}

section.querySelector('[data-lab-prev]').addEventListener('click',event=>select(current-1,{keyboard:event.detail===0}));
section.querySelector('[data-lab-next]').addEventListener('click',event=>select(current+1,{keyboard:event.detail===0}));
canvas.addEventListener('click',event=>{
  if(performance.now()<suppressClickUntil){event.preventDefault();event.stopPropagation();return;}
  const choose=event.target.closest('[data-select]');
  if(choose){
    const keyboard=event.detail===0;
    select(Number(choose.dataset.select),{keyboard});
    if(keyboard)visualOrder[0].querySelector('.lab-photo,video').focus({preventScroll:true});
    return;
  }
  const photo=event.target.closest('.lab-photo');
  if(photo){
    event.preventDefault();pauseVideos();photoOpener=photo;
    fullImage.src=photo.href;fullImage.alt=photo.querySelector('img').alt;
    dialog.showModal();close.focus({preventScroll:true});
  }
});
canvas.addEventListener('keydown',event=>{
  if(event.target.closest('video'))return;
  if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
    event.preventDefault();event.stopPropagation();
    const wasPhoto=event.target.closest('.lab-photo');
    select(current+(event.key==='ArrowRight'?1:-1),{keyboard:true});
    if(wasPhoto)visualOrder[0].querySelector('.lab-photo,video').focus({preventScroll:true});
  }
});
canvas.addEventListener('pointerdown',event=>{
  if(event.button!==0||event.target.closest('video,button'))return;
  dragging={id:event.pointerId,x:event.clientX,y:event.clientY,dx:0,horizontal:false};
});
canvas.addEventListener('pointermove',event=>{
  if(!dragging||dragging.id!==event.pointerId)return;
  dragging.dx=event.clientX-dragging.x;
  if(Math.abs(dragging.dx)>10&&Math.abs(dragging.dx)>Math.abs(event.clientY-dragging.y)*1.2){
    dragging.horizontal=true;
    if(!canvas.hasPointerCapture(event.pointerId))canvas.setPointerCapture(event.pointerId);
  }
  if(dragging.horizontal){
    event.preventDefault();
    const offset=Math.max(-70,Math.min(70,dragging.dx*.25));
    for(const [slot,frame]of visualOrder.entries()){
      frame.getAnimations().forEach(animation=>animation.cancel());
      const p=layoutSpec.positions[slot];frame.style.transform=`translate(${p.x+offset}px,${p.y}px)`;
    }
  }
},{passive:false});
function endDrag(event){
  if(!dragging||dragging.id!==event.pointerId)return;
  const state=dragging;dragging=null;
  if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
  if(state.horizontal){suppressClickUntil=performance.now()+400;select(current+(Math.abs(state.dx)>40?(state.dx<0?1:-1):0));}
}
canvas.addEventListener('pointerup',endDrag);
canvas.addEventListener('pointercancel',event=>{if(dragging?.id===event.pointerId){dragging=null;arrange();}});
canvas.querySelectorAll('img').forEach(img=>img.draggable=false);
close.addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
dialog.addEventListener('close',()=>photoOpener?.focus({preventScroll:true}));

for(const frame of frames){
  const media=frame.querySelector('video,img');
  const error=frame.querySelector('.lab-error');
  const retry=frame.querySelector('[data-retry]');
  const failed=()=>{error.hidden=false;error.querySelector('p').textContent=config.text.failed;retry.disabled=false;};
  const loaded=()=>{error.hidden=true;error.querySelector('p').textContent=config.text.failed;retry.disabled=false;};
  media.addEventListener('error',failed);
  media.addEventListener(media.tagName==='VIDEO'?'loadeddata':'load',loaded);
  // The initial request can fail before this module and its listeners arrive.
  if(media.tagName==='IMG'&&media.complete&&media.currentSrc){if(media.naturalWidth)loaded();else failed();}
  else if(media.tagName==='VIDEO'&&media.error)failed();
  retry.addEventListener('click',()=>{
    retry.disabled=true;error.querySelector('p').textContent=config.text.loading;
    if(media.tagName==='VIDEO')media.load();else media.src=media.src;
  });
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseVideos();});
new IntersectionObserver(entries=>{if(!entries[0].isIntersecting)pauseVideos();},{threshold:0}).observe(canvas);
new MutationObserver(()=>{if(document.body.className.includes('menu-open')||document.documentElement.className.includes('menu-open'))pauseVideos();}).observe(document.body,{attributes:true,attributeFilter:['class']});
new ResizeObserver(schedule).observe(canvas);
addEventListener('resize',schedule);
section.addEventListener('current-day:restore',()=>{syncStoryRoute();arrange();syncLanguageLinks();});
section.addEventListener('current-day:pause',()=>pauseVideos());
for(const menu of document.querySelectorAll('.nav-shell'))menu.addEventListener('toggle',()=>{if(menu.open)pauseVideos();});
function syncStoryRoute(){
  if(location.hash==='#life-story-05'){
    compactStoryOpen=true;
    storyMore.open=true;
  }
  syncLanguageLinks();
}
addEventListener('hashchange',syncStoryRoute);
syncStoryRoute();
document.fonts?.ready.then(()=>arrange());
arrange();
