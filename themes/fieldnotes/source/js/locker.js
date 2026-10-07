/* Fieldnotes cabinet: local assets, real geometry, on-demand rendering. */
const hosts = [...document.querySelectorAll('[data-locker]')];
if (hosts.length) {
  Promise.all([
    import('../vendor/three/three.module.min.js'),
    import('../vendor/three/RoundedBoxGeometry.js')
  ]).then(([THREE, { RoundedBoxGeometry }]) => {
    hosts.forEach(host => {
      try { createCabinet(host, THREE, RoundedBoxGeometry); }
      catch (error) { showFallback(host); console.warn('Cabinet unavailable:', error.message); }
    });
  }).catch(() => hosts.forEach(showFallback));
}

function showFallback(host) {
  host.dataset.fallback = 'true';
  host.dataset.ready = 'false';
  host.querySelector('.locker-stage canvas')?.remove();
  host.querySelector('[data-locker-hint]').textContent = '从下面的入口，翻翻柜子里的收藏。';
  host.querySelectorAll('[data-locker-open], [data-locker-reset]').forEach(button => { button.hidden = true; });
  host.querySelectorAll('[data-locker-panel]').forEach(panel => { panel.hidden = true; });
  host.querySelector('[data-locker-idle]').hidden = false;
}

function createCabinet(host, T, RoundedBoxGeometry) {
  const stage = host.querySelector('.locker-stage');
  const hint = host.querySelector('[data-locker-hint]');
  const status = host.querySelector('[data-locker-status]');
  const tooltip = host.querySelector('.locker-object-tip');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const scene = new T.Scene();
  const renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'group');
  canvas.setAttribute('aria-label', '可旋转的三维储物柜。左右方向键转动，上下方向键调整视角。数字 1、2、3 打开对应格子，Esc 归位。也可使用下方按钮。');
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.VSMShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const camera = new T.OrthographicCamera(-3.1, 3.1, 3.1, -3.1, .1, 40);
  camera.position.set(0, 4.6, 10);
  camera.lookAt(0, 2.45, 0);
  const hemisphere = new T.HemisphereLight(0xfff8e9, 0x8b969e, 2.4);
  scene.add(hemisphere);
  const keyLight = new T.DirectionalLight(0xfff6e8, 3.2);
  keyLight.position.set(-3, 7, 5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  Object.assign(keyLight.shadow.camera, { left: -5, right: 5, top: 6, bottom: -3, near: .1, far: 20 });
  keyLight.shadow.normalBias = .025;
  keyLight.shadow.bias = -.0002;
  keyLight.shadow.radius = 5;
  keyLight.shadow.blurSamples = 8;
  scene.add(keyLight);
  const fill = new T.DirectionalLight(0xd2dfff, 1.2);
  fill.position.set(4, 3, -3);
  scene.add(fill);
  const shadow = new T.Mesh(new T.PlaneGeometry(200, 200), new T.ShadowMaterial({ opacity: .095 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -.015;
  shadow.receiveShadow = true;
  scene.add(shadow);
  const model = new T.Group();
  scene.add(model);
  const cache = new Map();
  const resources = new Set();
  const register = resource => { resources.add(resource); return resource; };
  const material = (color, roughness = .65, metalness = .05) => register(new T.MeshStandardMaterial({ color, roughness, metalness }));
  const cream = material('#e8e3d3');
  const interior = material('#bcbba9');
  const blue = material('#294ddb', .38, .16);
  const yellow = material('#ecd581', .5, .12);
  const orange = material('#d9835c', .5, .12);
  const chrome = material('#d8dcdf', .23, .7);
  const ink = material('#343d45');
  const paper = material('#fff7df');
  const kraft = material('#ccb282');
  const mint = material('#a4bfb1');
  let disposed = false, inView = true, raf = 0, lastTime = 0;
  let openKey = null, pickedKey = null, drag = null;
  const states = new Map();
  function spring(name, initial = 0) {
    const state = { value: initial, target: initial, velocity: 0 };
    states.set(name, state);
    return state;
  }
  const yaw = spring('yaw', -.35), pitch = spring('pitch', 0);
  const openings = { articles: spring('articles'), life: spring('life'), about: spring('about') };
  const items = new Map();
  function box(parent, w, h, d, mat, x = 0, y = 0, z = 0, radius = .025) {
    const key = [w,h,d,radius].join(',');
    if (!cache.has(key)) cache.set(key, register(new RoundedBoxGeometry(w,h,d,2,Math.min(radius,w/3,h/3,d/3))));
    const mesh = new T.Mesh(cache.get(key), mat);
    mesh.position.set(x,y,z);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function cylinder(parent, radius, height, mat, x, y, z) {
    const mesh = new T.Mesh(register(new T.CylinderGeometry(radius,radius,height,24)),mat);
    mesh.position.set(x,y,z);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function label(parent, text, w, h, x, y, z, options = {}) {
    const bitmap = document.createElement('canvas');
    bitmap.width = 768; bitmap.height = Math.round(768*h/w);
    const ctx = bitmap.getContext('2d');
    if (options.background) { ctx.fillStyle = options.background; ctx.fillRect(0,0,bitmap.width,bitmap.height); }
    ctx.fillStyle = options.color || '#fcf7e8';
    ctx.font = (options.weight || 650) + ' ' + (options.size || Math.round(bitmap.height*.44)) + 'px -apple-system, "PingFang SC", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, bitmap.width/2, bitmap.height*.51, bitmap.width*.92);
    const texture = register(new T.CanvasTexture(bitmap));
    texture.colorSpace = T.SRGBColorSpace;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    const mat = register(new T.MeshStandardMaterial({ map:texture, transparent:true, roughness:.9, polygonOffset:true, polygonOffsetFactor:-1 }));
    const mesh = new T.Mesh(register(new T.PlaneGeometry(w,h)),mat);
    mesh.position.set(x,y,z); parent.add(mesh);
    return mesh;
  }
  function handle(parent,x,y,z,vertical=false) {
    box(parent,vertical?.075:.42,vertical?.44:.075,.085,chrome,x,y,z+.08,.025);
    const offsets = [-.16,.16];
    offsets.forEach(n=>box(parent,.08,.08,.16,chrome,x+(vertical?0:n),y+(vertical?n:0),z,.025));
  }
  function action(group, key, label) { group.userData.action = key; group.userData.label = label; }
  function pickable(key, group, description, offset, rotation = [0,0,0]) {
    const state = spring(key);
    action(group,key,description);
    items.set(key,{group,state,position:group.position.clone(),rotation:group.rotation.clone(),offset,turn:rotation});
  }

  // The cabinet is hollow: every side, hinge, shelf and drawer has depth.
  box(model,3.36,3.6,.12,interior,0,2.28,-.53,.05);
  box(model,.14,3.64,1.22,cream,-1.64,2.3,0,.045);
  box(model,.14,3.64,1.22,cream,1.64,2.3,0,.045);
  box(model,3.42,.16,1.25,cream,0,4.12,0,.05);
  box(model,3.42,.16,1.25,cream,0,.48,0,.05);
  box(model,.12,3.54,1.12,cream,.24,2.3,0,.025);
  box(model,1.31,.11,1.12,cream,.95,1.94,0,.025);
  [-1.36,1.36].forEach(x=>[-.4,.4].forEach(z=>{
    cylinder(model,.085,.39,chrome,x,.23,z);
    cylinder(model,.092,.065,ink,x,.035,z);
  }));
  [1.29,2.12,2.95].forEach(y=>box(model,1.74,.07,.99,cream,-.69,y,-.015,.02));

  const leftDoor = new T.Group(); leftDoor.position.set(-1.55,2.29,.61); model.add(leftDoor);
  box(leftDoor,1.71,3.43,.105,blue,.855,0,0,.035);
  action(leftDoor,'articles','打开文章柜门');
  handle(leftDoor,1.48,.1,.05,true);
  [-1.22,1.22].forEach(y=>cylinder(leftDoor,.045,.22,chrome,0,y,-.015));
  label(leftDoor,'FIELD NOTES',1.4,.19,.855,1.24,.06,{size:61});
  label(leftDoor,'想法，慢慢长出来。',1.32,.22,.855,1.01,.061,{size:52,weight:450});
  for(let i=0;i<4;i++) box(leftDoor,.55,.035,.011,ink,.59,-1.04-i*.115,.056,.004);
  label(leftDoor,'01',.63,.68,.55,.31,.066,{size:600,weight:650});
  label(leftDoor,host.dataset.count+' NOTES',.76,.2,.56,-.16,.066,{size:66});
  // A thick sticker, rather than a flat illustration, on the blue door.
  const sticker = box(leftDoor,.78,.43,.024,paper,.91,-.55,.073,.025);
  sticker.rotation.z = -.12;
  const stickerText = label(leftDoor,'STAY CURIOUS',.73,.25,.91,-.55,.09,{color:'#3158df',size:57});
  stickerText.rotation.z = -.12;

  const rightDoor = new T.Group(); rightDoor.position.set(1.55,3.02,.61); model.add(rightDoor);
  box(rightDoor,1.24,2.0,.105,yellow,-.62,0,0,.035);
  action(rightDoor,'life','打开生活柜门');
  handle(rightDoor,-1.03,-.13,.055,true);
  label(rightDoor,'OFF THE SCREEN',1.0,.19,-.62,.71,.064,{color:'#514c2f',size:53});
  label(rightDoor,'02',.71,.67,-.62,.19,.066,{color:'#514c2f',size:560});
  label(rightDoor,'生活的边角料',1.0,.21,-.62,-.45,.066,{color:'#514c2f',size:62,weight:500});
  [2.38,3.67].forEach(y=>cylinder(model,.04,.17,chrome,1.55,y,.60));

  const drawer = new T.Group(); model.add(drawer);
  action(drawer,'about','拉开个人档案抽屉');
  box(drawer,1.22,1.29,.11,orange,.93,1.21,.61,.035);
  box(drawer,1.20,.065,1.02,kraft,.93,.62,.045,.02);
  box(drawer,.065,.8,.99,kraft,.35,1.02,.04,.015);
  box(drawer,.065,.8,.99,kraft,1.51,1.02,.04,.015);
  box(drawer,1.20,.8,.065,kraft,.93,1.02,-.46,.02);
  handle(drawer,.93,1.11,.68);
  label(drawer,'03 / PERSONAL FILE',1.04,.22,.93,1.56,.68,{color:'#fff5de',size:56});
  box(drawer,.56,.24,.02,paper,.93,.83,.68,.01);
  label(drawer,'OPEN ME',.49,.18,.93,.83,.693,{color:'#785344',size:55});

  // Three real notebooks can be pulled from the shelves.
  const palette = [mint,yellow,orange];
  const titles = [...host.querySelectorAll('[data-locker-pick^="article-"]')];
  titles.forEach((button,index)=>{
    const group = new T.Group();
    group.position.set(-.69,3.23-index*.83,.02); model.add(group);
    box(group,1.34,.48,.42,paper,0,0,0,.018);
    box(group,1.4,.53,.055,palette[index],0,0,.22,.024);
    box(group,1.4,.035,.49,palette[index],0,.25,0,.012);
    const spine = box(group,.09,.51,.49,palette[index],-.67,0,0,.025);
    spine.receiveShadow = true;
    label(group,'0'+(index+1),.28,.24,-.45,.01,.254,{color:'#3b4237',size:105});
    label(group,['BUILD','EXPLORE','IMAGINE'][index],.83,.18,.18,.01,.255,{color:'#3b4237',size:64});
    pickable('article-'+index,group,'取出：'+button.children[1].textContent,[.16,.18,.95],[.04,-.07,-.08]);
  });
  // A physical postcard, built around the theme's existing mountain illustration.
  const postcard = new T.Group(); postcard.position.set(.93,2.92,-.07); model.add(postcard);
  box(postcard,.99,1.22,.05,paper,0,0,0,.025);
  const imageTexture = register(new T.TextureLoader().load(host.dataset.landscape,()=>invalidate(),undefined,()=>{}));
  imageTexture.colorSpace = T.SRGBColorSpace;
  const imageMat = register(new T.MeshStandardMaterial({map:imageTexture,roughness:1}));
  const picture = new T.Mesh(register(new T.PlaneGeometry(.86,.9)),imageMat);
  picture.position.set(0,.09,.031); postcard.add(picture);
  label(postcard,'somewhere, slowly.',.87,.15,0,-.49,.032,{color:'#586654',weight:450,size:54});
  postcard.rotation.z = -.06;
  pickable('postcard',postcard,'取出山海明信片',[-.08,.13,1.85],[.06,.12,.12]);
  box(model,.76,.055,.55,kraft,.92,2.25,-.1,.02);

  // The dossier lives in the drawer. Its front cover hinges open when taken out.
  const dossier = new T.Group(); dossier.position.set(.94,1.31,.04); drawer.add(dossier);
  dossier.rotation.x = -.13;
  box(dossier,.96,.97,.04,kraft,0,0,-.035,.02);
  box(dossier,.3,.12,.042,kraft,-.27,.50,-.035,.02);
  box(dossier,.87,.91,.06,paper,0,.02,.01,.013);
  label(dossier,host.dataset.author,.78,.2,0,.18,.05,{color:'#38403a',size:70});
  label(dossier,'CODE / CREATE / LIVE',.76,.14,0,-.12,.051,{color:'#3158df',size:49});
  const cover = new T.Group(); cover.position.set(0,-.47,.065); dossier.add(cover);
  box(cover,.96,.94,.028,kraft,0,.47,0,.013);
  label(cover,'PERSONAL FILE',.8,.16,0,.72,.02,{color:'#614f32',size:58});
  label(cover,'HELLO,',.8,.23,0,.45,.021,{color:'#3158df',size:91});
  label(cover,'THAT’S ME.',.82,.2,0,.24,.021,{color:'#3158df',size:70});
  pickable('dossier',dossier,'取出并打开个人档案袋',[0,.83,.2],[.10,-.08,-.08]);

  // A few personal objects make the cabinet feel lived in.
  box(model,.96,.12,.63,blue,-.55,4.27,-.02,.04).rotation.y = -.1;
  box(model,.84,.11,.57,paper,-.59,4.38,-.05,.02).rotation.y = .1;
  box(model,.86,.09,.59,orange,-.56,4.48,-.01,.025).rotation.y = .04;
  const pot = new T.Mesh(register(new T.CylinderGeometry(.22,.17,.36,32)),orange);
  pot.position.set(.81,4.38,0); pot.castShadow = true; model.add(pot);
  cylinder(model,.045,.52,mint,.81,4.77,0);
  [-1,1].forEach((side,index)=>{
    const leaf = new T.Mesh(register(new T.SphereGeometry(.18,20,16)),mint);
    leaf.scale.set(.6,1.7,.38); leaf.rotation.z = side*.62;
    leaf.position.set(.81+side*.12,4.82+index*.13,0);leaf.castShadow=true;model.add(leaf);
  });
  label(model,(host.dataset.brand || 'FIELDNOTES').toUpperCase(),2.2,.18,0,.48,.639,{color:'#626452',size:40});

  function applyModel() {
    model.rotation.set(pitch.value,yaw.value,0);
    leftDoor.rotation.y = -1.78 * openings.articles.value;
    rightDoor.rotation.y = 1.78 * openings.life.value;
    drawer.position.z = 1.0 * openings.about.value;
    items.forEach(({group,state,position,rotation,offset,turn})=>{
      group.position.set(position.x+offset[0]*state.value,position.y+offset[1]*state.value,position.z+offset[2]*state.value);
      group.rotation.set(rotation.x+turn[0]*state.value,rotation.y+turn[1]*state.value,rotation.z+turn[2]*state.value);
      group.scale.setScalar(1+(group===postcard ? .28 : group===dossier ? .12 : .1)*state.value);
    });
    cover.rotation.x = -.88 * items.get('dossier').state.value;
  }
  function step(state, dt) {
    if (Math.abs(state.target-state.value)<.0001 && Math.abs(state.velocity)<.001) { state.value=state.target; state.velocity=0; return false; }
    // mass 1, stiffness 100, damping 10: interruption preserves velocity.
    state.velocity += (100*(state.target-state.value)-10*state.velocity)*dt;
    state.value += state.velocity*dt;
    return true;
  }
  function frame(now) {
    raf = 0;
    if (disposed || document.hidden || !inView) return;
    const dt = Math.min((now-lastTime)/1000 || 1/60,1/30); lastTime=now;
    let moving = false;
    states.forEach(state=>{ if (step(state,dt)) moving=true; });
    applyModel(); renderer.render(scene,camera);
    host.dataset.moving = String(moving);
    if (moving) raf=requestAnimationFrame(frame);
  }
  function invalidate() {
    if (!raf && !disposed && !document.hidden && inView) { lastTime=performance.now(); raf=requestAnimationFrame(frame); }
  }
  function target(state, value, immediate=false) {
    state.target=value;
    if (immediate || reduced.matches) {state.value=value;state.velocity=0;}
  }
  function clearItem(immediate=false) {
    pickedKey = null;
    items.forEach(item=>target(item.state,0,immediate));
    host.querySelectorAll('[data-locker-pick]').forEach(button=>{
      button.setAttribute('aria-pressed','false');
      const small=button.querySelector('small');
      if(small)small.textContent='取出';
      else button.firstChild.textContent=button.dataset.lockerPick==='dossier'?'取出档案袋 ':'取出明信片 ';
    });
    host.querySelectorAll('[data-locker-detail]').forEach(panel=>{panel.hidden=true;});
    host.dataset.item='';
  }
  function pickItem(key, immediate=false) {
    const owner = key.startsWith('article-') ? 'articles' : key==='postcard' ? 'life' : 'about';
    if (openKey !== owner) return;
    const shouldClose = pickedKey === key;
    clearItem(immediate);
    if (!shouldClose) {
      pickedKey=key; target(items.get(key).state,1,immediate);
      const button=host.querySelector('[data-locker-pick="'+key+'"]');
      button.setAttribute('aria-pressed','true');
      const small=button.querySelector('small'); if(small)small.textContent='收起';
      else button.firstChild.textContent=key==='dossier'?'收回档案袋 ':'收回明信片 ';
      const detail=host.querySelector('[data-locker-detail="'+key+'"]'); if(detail)detail.hidden=false;
      host.dataset.item=key;
      status.textContent='已取出'+(key==='dossier'?'个人档案袋':key==='postcard'?'明信片':button.children[1].textContent)+'，再次点击可收回。';
      hint.textContent='已经取出来了，再点一下就收好。';
    } else hint.textContent='点一下柜内物件，取出来看看。';
    invalidate();
  }
  function openCompartment(key, immediate=false) {
    const next = key===openKey ? null : key;
    clearItem(immediate); openKey=next;
    Object.entries(openings).forEach(([name,state])=>target(state,name===next?1:0,immediate));
    host.querySelectorAll('[data-locker-open]').forEach(button=>button.setAttribute('aria-expanded',String(button.dataset.lockerOpen===next)));
    host.querySelectorAll('[data-locker-panel]').forEach(panel=>{panel.hidden=panel.dataset.lockerPanel!==next;});
    host.querySelector('[data-locker-idle]').hidden=!!next;
    host.dataset.open=next || '';
    hint.textContent=next?'点一下柜内物件，取出来看看。':'横向拖动转一转 · 点柜门打开';
    status.textContent=next?({articles:'文章柜门已打开，可以取出三本笔记。',life:'生活柜门已打开，可以取出明信片。',about:'档案抽屉已拉开，可以取出并打开档案袋。'}[next]):'柜子已经合好。';
    invalidate();
  }
  function reset(immediate=false) {
    if(openKey)openCompartment(openKey,immediate);
    target(yaw,-.35,immediate); target(pitch,0,immediate);
    tooltip.textContent=''; hint.textContent='横向拖动转一转 · 点柜门打开';
    status.textContent='已合上储物柜，恢复初始视角。'; invalidate();
  }
  function activate(key,immediate=false) {
    if(Object.hasOwn(openings,key))openCompartment(key,immediate);
    else if(items.has(key))pickItem(key,immediate);
  }
  const raycaster = new T.Raycaster(), pointer = new T.Vector2();
  function hit(event) {
    const rect=canvas.getBoundingClientRect();
    pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    raycaster.setFromCamera(pointer,camera);
    // Test the whole cabinet so an opaque door or side blocks objects behind it.
    const first=raycaster.intersectObject(model,true)[0];
    if(!first)return null;
    let object=first.object;
    while(object && object!==model){if(object.userData.action)return object.userData;object=object.parent;}
    return null;
  }
  canvas.addEventListener('pointerdown',event=>{
    if(!event.isPrimary || event.button!==0)return;
    const picked=hit(event);
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,yaw:yaw.target,pitch:pitch.target,moved:false,action:picked?.action};
    canvas.setPointerCapture(event.pointerId); tooltip.textContent='';
  });
  canvas.addEventListener('pointermove',event=>{
    if(drag && drag.id===event.pointerId){
      const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
      if(Math.hypot(dx,dy)>7)drag.moved=true;
      if(drag.moved){
        target(yaw,Math.max(-1.1,Math.min(1.05,drag.yaw+dx*.007)));
        // Touch keeps vertical scrolling; a mouse can also tilt the view.
        if(event.pointerType==='mouse')target(pitch,Math.max(-.13,Math.min(.23,drag.pitch+dy*.003)));
        invalidate();
      }
    } else if(finePointer.matches && event.pointerType==='mouse') {
      const picked=hit(event); canvas.style.cursor=picked?'pointer':'grab';
      tooltip.textContent=picked?(picked.action===openKey?'点击合上这一格':picked.action===pickedKey?'点击收回这件收藏':picked.label):'';
    }
  });
  function release(event,cancelled=false){
    if(!drag || drag.id!==event.pointerId)return;
    const previous=drag;drag=null;
    if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
    if(!cancelled && !previous.moved && previous.action && hit(event)?.action===previous.action)activate(previous.action);
  }
  canvas.addEventListener('pointerup',event=>release(event));
  canvas.addEventListener('pointercancel',event=>release(event,true));
  canvas.addEventListener('lostpointercapture',()=>{drag=null;});
  canvas.addEventListener('pointerleave',()=>{tooltip.textContent='';});
  canvas.addEventListener('keydown',event=>{
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','1','2','3','Escape','Home'].includes(event.key))event.preventDefault();
    if(event.key==='ArrowLeft')target(yaw,Math.max(-1.1,yaw.target-.17),true);
    if(event.key==='ArrowRight')target(yaw,Math.min(1.05,yaw.target+.17),true);
    if(event.key==='ArrowUp')target(pitch,Math.max(-.13,pitch.target-.07),true);
    if(event.key==='ArrowDown')target(pitch,Math.min(.23,pitch.target+.07),true);
    if(['1','2','3'].includes(event.key))openCompartment(['articles','life','about'][Number(event.key)-1],true);
    if(event.key==='Escape' || event.key==='Home')reset(true);
    invalidate();
  });
  host.querySelectorAll('[data-locker-open]').forEach(button=>{
    button.hidden=false;
    button.addEventListener('click',event=>openCompartment(button.dataset.lockerOpen,event.detail===0));
  });
  host.querySelectorAll('[data-locker-pick]').forEach(button=>button.addEventListener('click',event=>pickItem(button.dataset.lockerPick,event.detail===0)));
  const resetButton=host.querySelector('[data-locker-reset]'); resetButton.hidden=false;
  resetButton.addEventListener('click',event=>reset(event.detail===0));
  function resize() {
    if(disposed)return;
    const width=stage.clientWidth,height=stage.clientHeight;
    if(!width || !height)return;
    renderer.setSize(width,height,false);
    const aspect=width/height,viewHeight=Math.max(5.95,6.15/aspect);
    camera.left=-viewHeight*aspect/2;camera.right=viewHeight*aspect/2;
    camera.top=viewHeight/2;camera.bottom=-viewHeight/2;camera.updateProjectionMatrix();
    invalidate();
  }
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(stage);
  const intersection=new IntersectionObserver(entries=>{
    inView=entries[0].isIntersecting;
    if(!inView && raf){cancelAnimationFrame(raf);raf=0;} else invalidate();
  },{rootMargin:'100px'});intersection.observe(stage);
  const themeObserver=new MutationObserver(()=>{
    const dark=document.documentElement.dataset.theme==='dark';
    shadow.material.opacity=dark?.24:.095;hemisphere.intensity=dark?2:2.4;invalidate();
  });themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  function visibility(){if(document.hidden){cancelAnimationFrame(raf);raf=0;}else invalidate();}
  document.addEventListener('visibilitychange',visibility);
  function motionChange(){if(reduced.matches)states.forEach(state=>target(state,state.target,true));invalidate();}
  reduced.addEventListener('change',motionChange);
  function dispose(){
    if(disposed)return;disposed=true;cancelAnimationFrame(raf);
    resizeObserver.disconnect();intersection.disconnect();themeObserver.disconnect();
    document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',motionChange);
    resources.forEach(resource=>resource.dispose());shadow.geometry.dispose();shadow.material.dispose();renderer.dispose();
  }
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();dispose();showFallback(host);});
  window.addEventListener('pagehide',event=>{if(!event.persisted)dispose();else{cancelAnimationFrame(raf);raf=0;}});
  window.addEventListener('pageshow',()=>invalidate());
  stage.appendChild(canvas); resize(); applyModel(); renderer.render(scene,camera);
  host.dataset.ready='true';
  hint.textContent='横向拖动转一转 · 点柜门打开';
  if(host.dataset.mode==='about'){openCompartment('about',true);pickItem('dossier',true);}
}
