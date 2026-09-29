import './style.css';
import { World, SessionMode, RayInteractable, PokeInteractable, OneHandGrabbable, Grabbed, Hovered, createSystem } from '@iwsdk/core';
import { Group, Mesh, BoxGeometry, CylinderGeometry, SphereGeometry, PlaneGeometry, MeshStandardMaterial, MeshBasicMaterial, Color, AmbientLight, DirectionalLight, CanvasTexture, SRGBColorSpace, Vector3 } from 'three';
import { LEVELS, DIRECTIONS, initialRotations, traceWater, loadProgress } from './puzzle.js';
import { setupCapture } from './capture.js';

// Finish evaluating the entry module before IWSDK's lazy initializer imports it.
// Awaiting World.create at module scope creates a production-bundle cycle.
async function start() {
const $ = id => document.getElementById(id);
const STORAGE = 'tidal-loom-v1';
let saved = null;
try { saved = loadProgress(localStorage.getItem(STORAGE)); } catch { $('save-note').textContent = 'Browser storage is unavailable; this session still works.'; }
let levelIndex = saved?.level ?? 0, rotations = saved?.rotations ?? initialRotations(LEVELS[0]), turns = saved?.turns ?? 0;
let world, root, rootEntity, entities = [], tiles = [], flowers = [], uiStatus, history = [], flow;
let soundEnabled = false, audioContext, lastSolved = false;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const simulated = new URLSearchParams(location.search).get('simulate') === '1';
if (simulated) {
  const { XRDevice, metaQuest3 } = await import('iwer');
  const { DevUI } = await import('@iwer/devui');
  const device = new XRDevice(metaQuest3);
  // Explicit simulator mode replaces an unavailable native desktop runtime.
  // Ordinary play and headset use keep the browser's native WebXR untouched.
  device.installRuntime({forceInstall:true});
  device.position.set(0,1.5,.04);
  device.quaternion.set(-Math.sin(.55/2),0,0,Math.cos(.55/2));
  device.primaryInputMode = 'hand';
  device.installDevUI(DevUI);
  $('simulation-label').hidden = false;
  $('simulate').textContent = 'Leave hand simulator';
}

function tone(solved = false) {
  if (!soundEnabled) return;
  try {
    audioContext ??= new AudioContext(); audioContext.resume();
    const t = audioContext.currentTime;
    for (const [i, f] of (solved ? [392, 493.88, 587.33] : [261.63 + levelIndex * 32]).entries()) {
      const osc = audioContext.createOscillator(), gain = audioContext.createGain();
      osc.type = 'sine'; osc.frequency.value = f; gain.gain.setValueAtTime(0, t + i * .13);
      gain.gain.linearRampToValueAtTime(.055, t + i * .13 + .015);
      gain.gain.exponentialRampToValueAtTime(.0001, t + i * .13 + .45);
      osc.connect(gain); gain.connect(audioContext.destination); osc.start(t + i * .13); osc.stop(t + i * .13 + .5);
    }
  } catch { soundEnabled = false; $('sound').textContent = 'Sound unavailable'; }
}
function persist() {
  try { localStorage.setItem(STORAGE, JSON.stringify({ version: 1, level: levelIndex, rotations, turns })); }
  catch { $('save-note').textContent = 'Your browser could not save; keep this tab open to continue.'; }
}
function saveUndo() { history.push({rotations: [...rotations], turns}); if (history.length > 150) history.shift(); }
function turnTile(index, steps = 1) {
  if (!LEVELS[levelIndex].channels[index]) return;
  saveUndo(); rotations[index] = ((rotations[index] + steps) % 4 + 4) % 4; turns++; tone(); refresh();
}
function undo() { const prev = history.pop(); if (!prev) return; rotations = prev.rotations; turns = prev.turns; refresh(); }
function reset() { rotations = initialRotations(LEVELS[levelIndex]); turns = 0; history = []; lastSolved = false; refresh(); }
function next() { if (!flow?.solved) return; levelIndex = (levelIndex + 1) % LEVELS.length; rotations = initialRotations(LEVELS[levelIndex]); turns = 0; history = []; lastSolved = false; buildBoard(); refresh(); }

function material(color, extra = {}) { return new MeshStandardMaterial({color, roughness:.72, metalness:0, ...extra}); }
function mesh(geometry, color, parent, position = [0,0,0], extra) {
  const object = new Mesh(geometry, material(color, extra)); object.position.set(...position); object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
}
function label(text, width, height, dark = false) {
  const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 192;
  const ctx = canvas.getContext('2d');
  function draw(value) { ctx.clearRect(0,0,768,192); ctx.fillStyle = dark ? '#216c60' : '#e8f0ed'; ctx.fillRect(0,0,768,192); ctx.fillStyle = dark ? '#ffffff' : '#294b40'; ctx.font = '500 58px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(value,384,96,730); }
  draw(text); const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
  const plane = new Mesh(new PlaneGeometry(width,height), new MeshBasicMaterial({map:texture}));
  return {plane, set(text) { draw(text); texture.needsUpdate = true; }};
}
function positionOf(index, size) { const gap = .098; return [(index % size - (size - 1)/2)*gap, (Math.floor(index/size) - (size-1)/2)*gap]; }
function interactive(object, action) {
  const entity = world.createTransformEntity(object, rootEntity).addComponent(RayInteractable).addComponent(PokeInteractable);
  object.addEventListener('pointerdown', event => { event.stopPropagation?.(); action(); }); entities.push(entity); return entity;
}
function buildBoard() {
  for (const entity of entities) { entity.object3D?.removeFromParent(); entity.dispose(); }
  entities = []; tiles = []; flowers = [];
  if (rootEntity) rootEntity.dispose();
  root = new Group(); root.position.set(0,1.0,-.58); rootEntity = world.createTransformEntity(root);
  const level = LEVELS[levelIndex], radius = Math.max(.22, level.size * .071);
  mesh(new CylinderGeometry(radius, radius*.95,.048,64), '#c4d4cd',root,[0,-.065,0]);
  mesh(new CylinderGeometry(radius*.94,radius*.94,.006,64), '#9fbbb2',root,[0,-.037,0],{metalness:.12,roughness:.35});
  for (let i = 0; i < level.size ** 2; i++) {
    const [x,z] = positionOf(i,level.size); const tile = new Group(); tile.position.set(x,0,z); root.add(tile);
    const active = Boolean(level.channels[i]);
    const body = mesh(new CylinderGeometry(.043,.039,.052,32), active ? '#e8f0eb' : '#a7b7ac',tile,[0,-.003,0]);
    const channels = [], drops = [];
    if (active) {
      mesh(new CylinderGeometry(.014,.014,.003,20),'#496c63',tile,[0,.025,0]);
      for (let d = 0; d < 4; d++) {
        if (!(level.channels[i] & (1 << d))) continue;
        const [dx,dz] = DIRECTIONS[d];
        mesh(new BoxGeometry(d % 2 ? .043 : .019,.004,d % 2 ? .019 : .043),'#607d72',tile,[dx*.021,.026,dz*.021]);
        const water = mesh(new BoxGeometry(d % 2 ? .042 : .010,.004,d % 2 ? .010 : .042),'#53b7a1',tile,[dx*.021,.029,dz*.021],{emissive:'#29977e',emissiveIntensity:.14}); channels.push(water);
        const drop = mesh(new SphereGeometry(.003,6,4),'#d3fff0',tile); drops.push({object:drop,d});
      }
      const entity = world.createTransformEntity(tile,rootEntity).addComponent(RayInteractable).addComponent(PokeInteractable).addComponent(OneHandGrabbable,{translate:false,rotate:true,rotateMin:[0,-1000,0],rotateMax:[0,1000,0]});
      const tileState={index:i,object:tile,body,channels,drops,entity,grabbing:false,xrPressed:false,cancelledGrab:false,targetAngle:-rotations[i]*Math.PI/2,angleAtGrab:0};
      entity.object3D.addEventListener('pointerdown',event => {event.stopPropagation?.(); if (!world.session)turnTile(i);else if(world.renderer.xr.isPresenting){tileState.xrPressed=true;tileState.cancelledGrab=false;}});
      entity.object3D.addEventListener('pointerup',event => {event.stopPropagation?.();const pressed=tileState.xrPressed;tileState.xrPressed=false;if(pressed&&world.renderer.xr.isPresenting&&!tileState.grabbing&&!entity.hasComponent(Grabbed))turnTile(i);});
      entity.object3D.addEventListener('pointercancel',()=>{tileState.xrPressed=false;tileState.cancelledGrab=true;});
      entities.push(entity); tiles.push(tileState);
    } else {
      for (let k=0;k<3;k++) mesh(new SphereGeometry(.010,8,5),'#7d9789',tile,[(k-1)*.014,.027,k%2*.01]);
    }
  }
  for (const [index,d] of level.targets) {
    const [x,z] = positionOf(index,level.size), [dx,dz] = DIRECTIONS[d]; const flower = new Group(); flower.position.set(x+dx*.066,.015,z+dz*.066); root.add(flower);
    mesh(new CylinderGeometry(.024,.018,.022,20),'#d7e4da',flower);
    const plant = new Group(); plant.position.y=.009; flower.add(plant);
    mesh(new CylinderGeometry(.002,.003,.058,6),'#2f7564',plant,[0,.029,0]);
    for(let k=0;k<5;k++){ const a=k*Math.PI*2/5; const petal=mesh(new SphereGeometry(.011,8,5),'#dff4e8',plant,[Math.sin(a)*.009,.063,Math.cos(a)*.009]); petal.scale.y=.5; }
    mesh(new SphereGeometry(.006,8,5),'#71a889',plant,[0,.066,0]);
    flowers.push({index,d,plant,fed:false});
  }
  const [source,inlet]=level.source, [sx,sz]=positionOf(source,level.size), [dx,dz]=DIRECTIONS[inlet];
  mesh(new CylinderGeometry(.026,.022,.093,20),'#47796c',root,[sx+dx*.075,.025,sz+dz*.075]);
  mesh(new SphereGeometry(.009,10,6),'#b3efda',root,[sx+dx*.075,.083,sz+dz*.075],{emissive:'#5bc4a3',emissiveIntensity:.3});
  const title=label(level.name,.39,.060); title.plane.position.set(0,.18,-radius-.07); root.add(title.plane);
  uiStatus=label('Follow the spring',.37,.047); uiStatus.plane.position.set(0,.116,-radius-.07); root.add(uiStatus.plane);
  const front=radius+.042;
  for(const [i,name,action] of [[0,'Undo',undo],[1,'Reset',reset],[2,'Next',next],[3,'Exit',()=>world.exitXR()]]) {
    const button=new Group(); button.position.set((i-1.5)*.080,-.020,front);
    mesh(new BoxGeometry(.074,.012,.044),'#e8f0ed',button);
    const l=label(name,.069,.023); l.plane.rotation.x=-Math.PI/2; l.plane.position.y=.007; button.add(l.plane); root.add(button); interactive(button,action);
  }
  $('accessible-board').style.gridTemplateColumns=`repeat(${level.size},1fr)`;
  $('accessible-board').replaceChildren();
  for(let i=0;i<level.size**2;i++){const button=document.createElement('button');button.textContent=`${i+1}`;button.disabled=!level.channels[i];button.setAttribute('aria-label',`Turn channel ${i+1}`);button.addEventListener('click',()=>turnTile(i));$('accessible-board').append(button);}
}
function refresh() {
  const level=LEVELS[levelIndex]; flow=traceWater(level,rotations);
  $('chapter').textContent=`ISLAND ${String(levelIndex+1).padStart(2,'0')} / 03`;
  $('level-name').textContent=level.name; $('level-note').textContent=level.note;
  $('gardens').textContent=`${flow.fed.length} / ${level.targets.length}`; $('turns').textContent=turns;
  const message=flow.solved?'Every garden is blooming. A little world restored.':flow.inletBlocked?'The spring is waiting. Turn its nearest channel.':flow.leaks.length?`${flow.leaks.length} open ${flow.leaks.length===1?'edge is':'edges are'} spilling water. Keep the channels connected.`:'Keep following the water to the gardens.';
  $('status').textContent=message; $('undo').disabled=!history.length; $('next').disabled=!flow.solved; $('next').textContent=levelIndex===2?'Play the islands again':'Next island';
  for(const tile of tiles){tile.targetAngle=-rotations[tile.index]*Math.PI/2;const wet=flow.wet.has(tile.index);for(const c of tile.channels)c.visible=wet;for(const d of tile.drops)d.object.visible=wet&&!reducedMotion;}
  for(const flower of flowers)flower.fed=flow.fed.some(([i,d])=>i===flower.index&&d===flower.d);
  for(const [i,button] of Array.from($('accessible-board').children).entries())button.classList.toggle('wet',flow.wet.has(i));
  uiStatus?.set(`${flow.fed.length}/${level.targets.length} gardens${flow.solved?' · Complete':flow.inletBlocked?' · Spring blocked':` · ${flow.leaks.length} spills`}`);
  if(flow.solved&&!lastSolved)tone(true);lastSolved=flow.solved;persist();
}
class LoomMotion extends createSystem({}) {
  update(dt,time) {
    if(!world.renderer.xr.isPresenting){
      const radius=Math.max(.22,LEVELS[levelIndex].size*.071)+.085;
      const halfFov=world.camera.fov*Math.PI/360;
      const distance=radius*1.16/(Math.tan(halfFov)*Math.min(1,world.camera.aspect));
      const offset=new Vector3(.42,.55,.70).normalize().multiplyScalar(distance);
      world.camera.position.set(offset.x,1.02+offset.y,-.58+offset.z);
      world.camera.lookAt(0,1.02,-.58);
    }
    for(const tile of tiles){
      const activeXR=Boolean(world.session)&&world.renderer.xr.isPresenting;
      if(!activeXR){tile.grabbing=false;tile.xrPressed=false;}
      const held=activeXR&&tile.entity.hasComponent(Grabbed);
      if(held&&!tile.grabbing){tile.grabbing=true;tile.angleAtGrab=tile.object.rotation.y;}
      if(!held&&tile.grabbing){tile.grabbing=false;if(!tile.cancelledGrab){const delta=tile.object.rotation.y-tile.angleAtGrab;const steps=Math.abs(delta)<.35?1:-Math.round(delta/(Math.PI/2));turnTile(tile.index,steps||1);}}
      if(!held){const a=tile.object.rotation.y;const difference=Math.atan2(Math.sin(tile.targetAngle-a),Math.cos(tile.targetAngle-a));tile.object.rotation.y+=difference*(reducedMotion?1:Math.min(1,dt*15));}
      tile.body.material.color.set(tile.entity.hasComponent(Hovered)?'#c9e9df':'#e8f0eb');
      if(!reducedMotion)for(const drop of tile.drops){const t=(time*.45+tile.index*.19)%1;const [dx,dz]=DIRECTIONS[drop.d];drop.object.position.set(dx*t*.041,.034,dz*t*.041);}
    }
    for(const flower of flowers){const target=flower.fed?1:.18;const scale=flower.plant.scale.y;flower.plant.scale.set(1,scale+(target-scale)*Math.min(1,dt*5),1);}
  }
}

$('undo').addEventListener('click',undo);$('reset').addEventListener('click',reset);$('next').addEventListener('click',next);
$('help').addEventListener('click',()=>$('help-dialog').showModal());
$('simulate').addEventListener('click',()=>{const url=new URL(location.href);simulated?url.searchParams.delete('simulate'):url.searchParams.set('simulate','1');location.href=url.href;});
$('sound').addEventListener('click',()=>{soundEnabled=!soundEnabled;$('sound').setAttribute('aria-pressed',String(soundEnabled));$('sound').textContent=soundEnabled?'Sound on':'Sound off';if(soundEnabled)tone();});
try {
  world=await World.create($('scene-container'),{xr:{sessionMode:SessionMode.ImmersiveVR,offer:'none',features:{handTracking:{required:true}}},render:{fov:42,near:.01,far:30,camera:{position:[.42,1.55,.12],lookAt:[0,1.0,-.58]}},input:{canvasPointerEvents:true},features:{grabbing:{useHandPinchForGrab:true},locomotion:false,spatialUI:false}});
  world.scene.background=new Color('#eef3f2');world.scene.add(new AmbientLight('#ffffff',.95));
  const sun=new DirectionalLight('#ffffff',1.7);sun.position.set(1,4,2);sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-1;sun.shadow.camera.right=1;sun.shadow.camera.top=1;sun.shadow.camera.bottom=-1;sun.shadow.bias=-.0004;world.scene.add(sun);
  world.renderer.shadowMap.enabled=true;
  world.renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));
  buildBoard(); refresh(); world.registerSystem(LoomMotion); $('loading').remove();
  if(new URLSearchParams(location.search).get('capture')==='1')setupCapture(world.renderer.domElement,simulated);
  const supported=await navigator.xr?.isSessionSupported('immersive-vr').catch(()=>false);
  $('enter-xr').disabled=!supported;$('enter-xr').textContent=supported?(simulated?'Enter hand simulator':'Enter VR'):'VR headset needed';
  $('enter-xr').addEventListener('click',()=>{tone();world.launchXR();});
  world.renderer.xr.addEventListener('sessionstart',()=>{document.body.classList.add('in-xr');});
  world.renderer.xr.addEventListener('sessionend',()=>{document.body.classList.remove('in-xr');});
} catch(error) {
  console.error(error);$('loading').textContent='The 3D view could not start. Try a browser with WebGL enabled.';
}
}
start().catch(error=>{
  console.error(error);
  document.getElementById('loading').textContent='The 3D view could not start. Try a browser with WebGL enabled.';
});
