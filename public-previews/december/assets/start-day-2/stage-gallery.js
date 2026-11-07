const {createStageDeck: baseline} = await import('./stage-gallery-baseline.js' + new URL(import.meta.url).search);

// A three-item window: the current original is promoted at full size, with
// the next two originals in smaller places. Media nodes stay unique.
export function createStageDeck(options) {
 const {strip,links,prev,next,count,reduced,onSelect=()=>{}}=options;
 if(links.length<3)return baseline(options);
 const state={strip,links,index:0};
 const field=document.createElement('div');field.className='stage-scene__field';
 field.append(...links);strip.append(field);
 const media=links.map(link=>link.querySelector('img,video'));
 const controls=next.closest('.start-photo-controls');if(controls)strip.after(controls);
 strip.removeAttribute('tabindex');
 prev.tabIndex=next.tabIndex=0;
 const tokens=getComputedStyle(document.documentElement);
 const durationToken=tokens.getPropertyValue('--duration-media').trim();
 const duration=parseFloat(durationToken)*(durationToken.endsWith('ms')?1:1000)||480;
 const easeNumbers=tokens.getPropertyValue('--ease-move').match(/[\d.]+/g)?.map(Number)||[.65,0,.35,1];
 const wrap=n=>(n%links.length+links.length)%links.length;
 const english=document.documentElement.lang==='en';
 let position=0,target=0,frame=0,gesture,suppressClickUntil=0;
 let width=0,height=0,gap=0,sizes=[];
 function easing(x){
  const [a,b,c,d]=easeNumbers,point=(t,p,q)=>3*(1-t)*(1-t)*t*p+3*(1-t)*t*t*q+t*t*t;
  let lo=0,hi=1;for(let i=0;i<12;i++){const mid=(lo+hi)/2;if(point(mid,a,c)<x)lo=mid;else hi=mid;}
  return point((lo+hi)/2,b,d);
 }
 function layout(center){
  const current=wrap(center),following=wrap(center+1),later=wrap(center+2),main=sizes[current];
  const minimum=index=>Math.max(44/sizes[index].w,44/sizes[index].h);
  const scaleFor=(index,fraction)=>Math.max(minimum(index),main.h*fraction/sizes[index].h);
  let nextScale=scaleFor(following,.58),laterScale=scaleFor(later,.34),nextPose,laterPose;
  if(width>480){
   const available=width-main.w-2*gap;
   const shrink=Math.min(1,available/(sizes[following].w*nextScale+sizes[later].w*laterScale));
   nextScale=Math.max(minimum(following),nextScale*shrink);
   laterScale=Math.max(minimum(later),laterScale*shrink);
   const nextWidth=sizes[following].w*nextScale,laterWidth=sizes[later].w*laterScale;
   const free=Math.max(0,width-main.w-nextWidth-laterWidth-2*gap);
   nextPose={x:main.w+gap+free*.5,y:main.h-sizes[following].h*nextScale,s:nextScale};
   laterPose={x:width-laterWidth,y:main.h-sizes[later].h*laterScale,s:laterScale};
  }else{
   const right=main.w+gap,available=width-right;
   nextScale=Math.min(available/sizes[following].w,nextScale);
   const nextHeight=sizes[following].h*nextScale;
   laterScale=Math.min(available/sizes[later].w,Math.max(minimum(later),Math.min(main.h*.30,nextHeight*.62)/sizes[later].h));
   nextPose={x:right,y:main.h*.08,s:nextScale};
   laterPose={x:width-sizes[later].w*laterScale,y:main.h-sizes[later].h*laterScale,s:laterScale};
  }
  const poses=new Map([[current,{x:0,y:0,s:1}],[following,nextPose],[later,laterPose]]);
  const bottom=Math.max(main.h+main.extra,...[...poses].filter(([i])=>i!==current).map(([i,p])=>p.y+sizes[i].h*p.s));
  return {poses,bottom,current,following,later};
 }
 function mix(a,b,t){return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,s:a.s+(b.s-a.s)*t};}
 function paint(){
  if(!sizes.length)return;
  const whole=Math.floor(position),fraction=position-whole;
  const first=layout(whole),second=layout(whole+1),poses=new Map();
  const arriving=second.current,middle=first.later;
  poses.set(arriving,mix(first.poses.get(arriving),second.poses.get(arriving),fraction));
  poses.set(middle,mix(first.poses.get(middle),second.poses.get(middle),fraction));
  if(first.current===second.later){
   poses.set(first.current,mix(first.poses.get(first.current),second.poses.get(second.later),fraction));
  }else if(fraction<.5){
   const index=first.current,from=first.poses.get(index);
   poses.set(index,mix(from,{x:-sizes[index].w-gap,y:-sizes[index].h*.35,s:.28},fraction*2));
  }else{
   const index=second.later,to=second.poses.get(index);
   poses.set(index,mix({x:width+gap,y:-sizes[index].h*.28,s:to.s},to,(fraction-.5)*2));
  }
  links.forEach((link,index)=>{
   const pose=poses.get(index);link.hidden=!pose;
   if(!pose)return;
   link.style.transform=`translate(${pose.x}px, ${pose.y}px) scale(${pose.s})`;
   link.style.zIndex=index===wrap(Math.round(position))?'3':'1';
  });
  const resting=Math.abs(position-Math.round(position))<.00001;
  field.style.height=`${resting?layout(Math.round(position)).bottom:Math.max(first.bottom,second.bottom)}px`;
  strip.dataset.position=position.toFixed(4);
  strip.dataset.readingIndex=String(wrap(Math.round(position)));
 }
 function choose(index){
  state.index=wrap(index);strip.dataset.photoIndex=String(state.index);
  if(count.classList.contains('diary-media__position'))count.innerHTML=`<strong>${String(state.index+1).padStart(2,'0')}</strong><span> / </span><span>${String(links.length).padStart(2,'0')}</span>`;
  else count.textContent=`${state.index+1} / ${links.length}`;
  links.forEach((link,i)=>{
   const current=i===state.index,following=i===wrap(state.index+1),later=i===wrap(state.index+2),video=media[i].tagName==='VIDEO';
   const visible=current||following||later;link.hidden=!visible;link.inert=!visible;
   link.dataset.current=String(current);link.dataset.following=String(following);link.dataset.later=String(later);
   link.setAttribute('aria-hidden',String(!visible));
   link.tabIndex=current&&!video||following||later?0:-1;
   if(video){
    media[i].inert=!current;media[i].tabIndex=current?0:-1;
    media[i].controls=current;
    if(!current)media[i].pause();
    link.setAttribute('role',current?'group':'button');
    link.dataset.kindLabel=english?'Video':'Видео';
    link.setAttribute('aria-label',current?(media[i].getAttribute('aria-label')||''):(english?`Choose video ${i+1}`:`Выбрать видео ${i+1}`));
   }else{
    link.setAttribute('role',current?'link':'button');
    link.setAttribute('aria-label',`${current?(english?'Open full photograph':'Открыть полный снимок'):(english?'Choose photograph':'Выбрать снимок')} ${i+1}. ${media[i].alt}`);
   }
  });
  field.append(links[state.index],links[wrap(state.index+1)],links[wrap(state.index+2)]);
  if(sizes.length)measure();
  onSelect(state.index);
 }
 function animateTo(value,{instant=false}={}){
  cancelAnimationFrame(frame);target=value;choose(Math.round(target));
  if(instant||reduced()){position=target;paint();strip.dataset.turning='false';return;}
  const from=position,start=performance.now();strip.dataset.turning='true';
  const tick=now=>{
   const progress=Math.min(1,(now-start)/duration);
   position=progress===1?target:from+(target-from)*easing(progress);paint();
   if(progress<1)frame=requestAnimationFrame(tick);else strip.dataset.turning='false';
  };
  frame=requestAnimationFrame(tick);
 }
 function go(index,opts={}){
  const wanted=wrap(index),current=wrap(Math.round(target));let step=wrap(wanted-current);
  if(step>links.length/2)step-=links.length;
  animateTo(Math.round(target)+step,opts);
 }
 function fitHeight(){
  if(!sizes.length)return;
  field.style.height=`${layout(state.index).bottom}px`;
 }
 function measure(){
  width=strip.getBoundingClientRect().width;if(!width)return;
  gap=parseFloat(getComputedStyle(field).rowGap)||8;
  const bar=controls?.getBoundingClientRect().height||44;
  const caption=strip.closest('.stage-photos').querySelector('.stage-media-source');
  const sourceHeight=caption?.getBoundingClientRect().height||0;
  const budget=Math.max(200,innerHeight*.82-bar-gap-sourceHeight);
  const widestPreview=Math.max(1,...links.map(item=>Number(item.dataset.mediaWidth)/Number(item.dataset.mediaHeight)));
  const maximumWidth=Math.min(width*(width>480?.55:.70),width-gap-44*widestPreview);
  height=budget/1.07;
  if(width<=480)height=Math.min(height,maximumWidth/(9/16));
  sizes=links.map((link,i)=>{
   const ratio=Number(link.dataset.mediaWidth)/Number(link.dataset.mediaHeight);
   const h=Math.min(height,maximumWidth/ratio),w=h*ratio;
   const actions=link.querySelector('.start-media__actions');
   const error=link.querySelector('.start-media__error');
   const actionHeight=actions?.offsetHeight||0;
   const errorHeight=error&&!error.hidden?error.offsetHeight:0;
   const extra=(actionHeight? actionHeight+gap:0)+(errorHeight? errorHeight+gap:0);
   link.style.width=`${w}px`;link.style.height=`${h+extra}px`;
   link.style.setProperty('--route-media-inline',`${w}px`);
   link.style.setProperty('--route-media-block',`${h}px`);
   return{w,h,extra};
  });
  fitHeight();paint();
 }
 strip.classList.add('stage-scene','stage-route','stage-route--three');
 prev.disabled=next.disabled=links.length<2;
 prev.addEventListener('click',event=>animateTo(Math.round(target)-1,{instant:event.detail===0}));
 next.addEventListener('click',event=>animateTo(Math.round(target)+1,{instant:event.detail===0}));
 strip.addEventListener('click',event=>{
  if(event.metaKey||event.ctrlKey||event.altKey||event.shiftKey)return;
  if(event.detail&&performance.now()<suppressClickUntil){event.preventDefault();event.stopImmediatePropagation();return;}
  const item=event.target.closest('[data-start-photo]'),index=links.indexOf(item);
  if(index>=0&&index!==state.index){event.preventDefault();event.stopImmediatePropagation();go(index,{instant:!event.detail});}
 },true);
 strip.addEventListener('keydown',event=>{
  if(event.target.closest('video'))return;
  if(['Enter',' '].includes(event.key)&&event.target.closest('[data-current="false"]')){
   event.preventDefault();go(links.indexOf(event.target.closest('[data-start-photo]')),{instant:true});state.focusCurrent();return;
  }
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();
  if(event.key==='Home'||event.key==='End')go(event.key==='Home'?0:links.length-1,{instant:true});
  else animateTo(Math.round(target)+(event.key==='ArrowRight'?1:-1),{instant:true});
  state.focusCurrent();
 });
 strip.addEventListener('pointerdown',event=>{
  if(!event.isPrimary||event.button!==0)return;suppressClickUntil=0;
  if(event.target.closest('video,button,.start-media__actions'))return;
  gesture={id:event.pointerId,x:event.clientX,y:event.clientY,origin:position,stride:sizes[wrap(Math.round(position))].w+gap,dx:0,dragging:false};
 });
 strip.addEventListener('pointermove',event=>{
  if(!gesture||gesture.id!==event.pointerId)return;
  const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
  if(!gesture.dragging){
   if(Math.abs(dy)>8&&Math.abs(dy)>Math.abs(dx)){gesture=null;return;}
   if(Math.abs(dx)<7||Math.abs(dx)<Math.abs(dy)*1.2)return;
   cancelAnimationFrame(frame);gesture.dragging=true;strip.setPointerCapture(event.pointerId);
   strip.classList.add('is-dragging');strip.dataset.turning='true';
  }
  event.preventDefault();gesture.dx=dx;
  if(!reduced()){position=gesture.origin-dx/gesture.stride;paint();}
 });
 function finish(event,cancelled=false){
  if(!gesture||gesture.id!==event.pointerId)return;
  const drag=gesture;gesture=null;strip.classList.remove('is-dragging');
  if(drag.dragging){
   suppressClickUntil=performance.now()+400;
   const projected=drag.origin-drag.dx/drag.stride;
   animateTo(Math.round(cancelled?drag.origin:projected));
  }
  if(strip.hasPointerCapture(event.pointerId))strip.releasePointerCapture(event.pointerId);
 }
 strip.addEventListener('pointerup',event=>finish(event));
 strip.addEventListener('pointercancel',event=>finish(event,true));
 strip.addEventListener('lostpointercapture',event=>{if(event.target===strip&&gesture)finish(event,true);});
 strip.addEventListener('dragstart',event=>{if(!event.target.closest('video'))event.preventDefault();});
 state.select=go;
 state.focusCurrent=()=>{
  const item=media[state.index].tagName==='VIDEO'?media[state.index]:links[state.index];
  item.focus({preventScroll:true});
  const reveal=()=>{
   if(document.activeElement!==item)return;
   const row=controls?.getBoundingClientRect();
   if(row){
    const floating=[...document.querySelectorAll('.site-header .menu-toggle,.site-header .site-logo,.site-header .header-actions')]
     .filter(element=>{
      const style=getComputedStyle(element),rect=element.getBoundingClientRect();
      return style.visibility!=='hidden'&&Number(style.opacity)>0&&rect.width>0&&rect.height>0&&rect.left<row.right&&rect.right>row.left;
     }).map(element=>element.getBoundingClientRect().bottom);
    const top=Math.max(0,...floating)+gap;
    const context=strip.closest('.stage-episode')?.querySelector('.stage-context')?.getBoundingClientRect();
    const leadingTop=context&&context.bottom>0?Math.min(row.top,context.top):row.top;
    if(leadingTop<top)window.scrollBy({top:leadingTop-top,behavior:'instant'});
   }
   item.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
  };
  reveal();requestAnimationFrame(reveal);
 };
 state.restore=()=>{gesture=null;animateTo(Math.round(target),{instant:true});measure();};
 links.forEach((link,i)=>{
  link.draggable=false;media[i].draggable=false;
  media[i].addEventListener(media[i].tagName==='VIDEO'?'loadedmetadata':'load',measure);
 });
 choose(0);measure();
 const observer=new ResizeObserver(measure);
 observer.observe(strip);
 if(controls)observer.observe(controls);
 for(const element of strip.closest('.stage-photos').querySelectorAll('.start-media__actions,.start-media__error,.stage-media-source'))observer.observe(element);
 window.addEventListener('resize',measure,{passive:true});
 return state;
}
