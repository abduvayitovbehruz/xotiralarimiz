'use strict';

// ═══════════════════════════════════════
//  ADMIN ID — faqat shu o'zgarmaydi
// ═══════════════════════════════════════
const ADMIN_ID = 8814675023; // ← O'zingizning Telegram ID ingiz

// ═══════════════════════════════════════
//  STATE
// ═══════════════════════════════════════
let state = {
  users:      [],   // [{id, name}] — admin qo'shgan mehmonlar
  xotiralar:  [],
  gallery:    [],
  kundalik:   [],
  visitors:   [],   // [{id, name, time}] — kim, qachon kirdi
};

let currentUser = null; // {id, name, isAdmin}
let selectedMood = '😊';
let commentCtx = { col:'', id:'' };
let lbSrc = '', lbName = '', lbVideoEl = null;

// ═══════════════════════════════════════
//  STORAGE
// ═══════════════════════════════════════
function save(){ try{ localStorage.setItem('xotira_v4', JSON.stringify(state)); }catch(e){} }
function load(){ try{ const d=localStorage.getItem('xotira_v4'); if(d) state=JSON.parse(d); }catch(e){} }

// ═══════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════
const $  = id => document.getElementById(id);
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2);
const today = () => new Date().toISOString().slice(0,10);
const nowStr = () => new Date().toLocaleString('uz-UZ',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
const fmtDate = d => { if(!d)return''; const[y,m,day]=d.split('-'); return`${day}.${m}.${y}`; };
const fileToB64 = f => new Promise((r,j)=>{ const fr=new FileReader(); fr.onload=()=>r(fr.result); fr.onerror=j; fr.readAsDataURL(f); });
function dlFile(url, name){ const a=document.createElement('a'); a.href=url; a.download=name; a.click(); }

// ═══════════════════════════════════════
//  WATERMARK
// ═══════════════════════════════════════
function setWatermark(name){
  const txt = `${name} • Xotiralarimiz • `;
  $('watermark').innerHTML = Array(10).fill(txt).join('<br/>');
}

// ═══════════════════════════════════════
//  FLOATING HEARTS
// ═══════════════════════════════════════
const HEARTS = ['💕','💗','💖','💝','🌸','✨','💞','💓','🌹','🥀'];
function spawnHeart(){
  const el = document.createElement('div');
  el.className = 'fheart';
  el.textContent = HEARTS[Math.floor(Math.random()*HEARTS.length)];
  el.style.left   = Math.random()*95+'vw';
  el.style.fontSize = (12+Math.random()*18)+'px';
  const dur = 5+Math.random()*6;
  el.style.animationDuration  = dur+'s';
  el.style.animationDelay     = Math.random()*1+'s';
  $('hearts-container').appendChild(el);
  setTimeout(()=>el.remove(), (dur+2)*1000);
}
setInterval(spawnHeart, 1400);
[0,0,0,0,0].forEach(()=>spawnHeart());

// ═══════════════════════════════════════
//  TABS
// ═══════════════════════════════════════
document.querySelectorAll('.tab').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    $('page-'+btn.dataset.tab).classList.add('active');
  });
});

// ═══════════════════════════════════════
//  MODAL
// ═══════════════════════════════════════
function openModal(id){ $(id).classList.add('open'); }
function closeModal(id){ $(id).classList.remove('open'); }
document.querySelectorAll('.modal-close,.btn-cancel').forEach(b=>{
  b.addEventListener('click',()=>closeModal(b.dataset.modal||b.closest('.modal-overlay').id));
});
document.querySelectorAll('.modal-overlay').forEach(o=>{
  o.addEventListener('click',e=>{ if(e.target===o) closeModal(o.id); });
});

// ═══════════════════════════════════════
//  FILE DROP
// ═══════════════════════════════════════
function setupDrop(dropId, inputId, prevId){
  const drop=$(dropId), inp=$(inputId), prev=$(prevId);
  drop.addEventListener('click',()=>inp.click());
  drop.addEventListener('dragover',e=>{ e.preventDefault(); drop.style.borderColor='var(--accent2)'; });
  drop.addEventListener('dragleave',()=>drop.style.borderColor='');
  drop.addEventListener('drop',e=>{ e.preventDefault(); drop.style.borderColor=''; showPrev(e.dataTransfer.files,prev); });
  inp.addEventListener('change',()=>showPrev(inp.files,prev));
}
async function showPrev(files, prev){
  prev.innerHTML='';
  for(const f of files){
    const d=await fileToB64(f);
    const el=f.type.startsWith('video/')
      ? Object.assign(document.createElement('video'),{src:d,muted:true,loop:true,autoplay:true,playsinline:true})
      : Object.assign(document.createElement('img'),{src:d,alt:''});
    prev.appendChild(el);
  }
}
setupDrop('x-drop','x-file','x-preview');
setupDrop('g-drop','g-file','g-preview');

// ═══════════════════════════════════════
//  MOOD
// ═══════════════════════════════════════
function initMoods(){
  selectedMood='😊';
  document.querySelectorAll('.mood').forEach(b=>{
    b.classList.remove('selected');
    b.onclick=()=>{ document.querySelectorAll('.mood').forEach(x=>x.classList.remove('selected')); b.classList.add('selected'); selectedMood=b.dataset.mood; };
  });
  document.querySelector('.mood').classList.add('selected');
}

// ═══════════════════════════════════════
//  LIKE
// ═══════════════════════════════════════
function toggleLike(col, id){
  const item=state[col].find(i=>i.id===id); if(!item) return;
  item.liked=!item.liked; item.likes=(item.likes||0)+(item.liked?1:-1);
  save();
}

// ═══════════════════════════════════════
//  LOGIN / AUTH
// ═══════════════════════════════════════
function initAuth(){
  // Telegram Mini App
  try{
    if(window.Telegram?.WebApp?.initDataUnsafe?.user){
      const u=window.Telegram.WebApp.initDataUnsafe.user;
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      loginWith(u.id, u.first_name+(u.last_name?' '+u.last_name:''));
      return;
    }
  }catch(e){}
  // Brauzer — ID so'rash
  $('login-screen').style.display='flex';
}

// Login forma
$('btn-login').addEventListener('click',()=>{
  const idVal = parseInt($('login-id-input').value.trim());
  if(!idVal){ alert('Telegram ID kiriting!'); return; }
  // Ismni avtomatik topish
  const found = state.users.find(u=>u.id===idVal);
  if(idVal===ADMIN_ID){
    loginWith(idVal, 'Admin');
  } else if(found){
    loginWith(idVal, found.name);
  } else {
    showAccessDenied();
  }
});

function loginWith(id, name){
  const isAdmin = id===ADMIN_ID;
  currentUser = {id, name, isAdmin};
  setWatermark(name);
  $('login-screen').style.display='none';
  $('app').style.display='flex';

  if(!isAdmin){
    // Tashrif vaqtini yozish
    if(!state.visitors) state.visitors=[];
    state.visitors.unshift({id, name, time:nowStr()});
    if(state.visitors.length>100) state.visitors.length=100;
    save();
    // Xush kelibsiz
    showWelcome(name);
  } else {
    // Admin panel
    showAdminPanel();
  }

  $('nav-user').textContent=(isAdmin?'👑 ':'💕 ')+name;
  renderAll();
}

function showWelcome(name){
  const el=$('welcome-screen');
  $('welcome-name').textContent=name;
  el.style.display='flex';
  // Animatsiya tugagach o'chirish
  setTimeout(()=>{
    el.style.opacity='0';
    setTimeout(()=>{ el.style.display='none'; el.style.opacity='1'; }, 600);
  }, 2500);
}

function showAccessDenied(){
  $('login-screen').style.display='none';
  $('app').style.display='flex';
  $('no-access').style.display='flex';
}

// ═══════════════════════════════════════
//  ADMIN PANEL — Foydalanuvchi qo'shish
// ═══════════════════════════════════════
function showAdminPanel(){
  // Admin uchun Tashrif tarixi bannerini ko'rsat
  if(state.visitors&&state.visitors.length>0){
    const last=state.visitors[0];
    $('visitor-banner').style.display='block';
    $('visitor-text').textContent=`${last.name} oxirgi marta: ${last.time}`;
  }
  $('tab-users').style.display = 'flex';
  renderUsersList();
}

// Foydalanuvchi qo'shish tugmasi
$('btn-add-user').addEventListener('click',()=>{
  $('u-name').value=''; $('u-id').value='';
  openModal('modal-user');
});

$('save-user').addEventListener('click',()=>{
  const name=$('u-name').value.trim();
  const id=parseInt($('u-id').value.trim());
  if(!name||!id){ alert('Ism va ID kiriting!'); return; }
  if(state.users.find(u=>u.id===id)){
    alert('Bu ID allaqachon qo\'shilgan!'); return;
  }
  state.users.push({id, name, addedAt:nowStr()});
  save(); renderUsersList(); closeModal('modal-user');
  alert(`✅ ${name} qo'shildi! ID: ${id}`);
});

function renderUsersList(){
  const list=$('users-list'); if(!list) return;
  if(!state.users.length){
    list.innerHTML='<div class="no-users">Hali foydalanuvchi yo\'q</div>'; return;
  }
  list.innerHTML='';
  state.users.forEach(u=>{
    const div=document.createElement('div'); div.className='user-item';
    const lastVisit=state.visitors?.find(v=>v.id===u.id);
    div.innerHTML=`
      <div class="user-avatar">${u.name[0].toUpperCase()}</div>
      <div class="user-info">
        <div class="user-name">${u.name}</div>
        <div class="user-id">ID: ${u.id}</div>
        ${lastVisit?`<div class="user-visit">🕐 ${lastVisit.time}</div>`:'<div class="user-visit">Hali kirmagan</div>'}
      </div>
      <button class="user-del" data-id="${u.id}">🗑</button>`;
    div.querySelector('.user-del').addEventListener('click',()=>{
      if(confirm(`${u.name} o'chirilsinmi?`)){ state.users=state.users.filter(x=>x.id!==u.id); save(); renderUsersList(); }
    });
    list.appendChild(div);
  });
}

// ═══════════════════════════════════════
//  XOTIRALAR
// ═══════════════════════════════════════
$('btn-add-xotira').addEventListener('click',()=>{
  $('x-title').value=''; $('x-date').value=today();
  $('x-place').value=''; $('x-desc').value='';
  $('x-file').value=''; $('x-preview').innerHTML='';
  openModal('modal-xotira');
});

$('save-xotira').addEventListener('click',async()=>{
  const title=$('x-title').value.trim();
  if(!title){ alert('Sarlavha kiriting!'); return; }
  let media=null, isVideo=false;
  const file=$('x-file').files[0];
  if(file){ media=await fileToB64(file); isVideo=file.type.startsWith('video/'); }
  state.xotiralar.unshift({
    id:uid(), title, date:$('x-date').value,
    place:$('x-place').value.trim(), desc:$('x-desc').value.trim(),
    media, isVideo, likes:0, liked:false, comments:[],
    author:currentUser.name, authorId:currentUser.id, time:nowStr()
  });
  save(); renderXotiralar(); closeModal('modal-xotira');
});

function renderXotiralar(){
  const list=$('xotiralar-list'), empty=$('xotiralar-empty');
  list.innerHTML='';
  if(!state.xotiralar.length){ empty.style.display='flex'; return; }
  empty.style.display='none';
  state.xotiralar.forEach(x=>{
    const div=document.createElement('div'); div.className='card';
    div.innerHTML=`
      ${x.media?`<div class="card-media-wrap">
        ${x.isVideo
          ?`<video class="card-media" src="${x.media}" muted playsinline preload="metadata"></video><div class="card-play-overlay">▶️</div>`
          :`<img class="card-media" src="${x.media}" alt="${x.title}" loading="lazy"/>`}
      </div>`:''}
      <div class="card-body">
        <div class="card-title">${x.title}</div>
        <div class="card-meta">
          ${x.date?`<span class="badge">📅 ${fmtDate(x.date)}</span>`:''}
          ${x.place?`<span class="badge">📍 ${x.place}</span>`:''}
        </div>
        ${x.desc?`<div class="card-desc">${x.desc}</div>`:''}
        <div class="card-author">✍️ ${x.author} • ${x.time}</div>
      </div>
      <div class="card-actions">
        <button class="act-btn like-btn ${x.liked?'liked':''}">${x.liked?'❤️':'🤍'}<span class="cnt">${x.likes||0}</span></button>
        <button class="act-btn cmnt-btn">💬<span class="cnt">${(x.comments||[]).length}</span></button>
        ${x.media?`<button class="act-dl">⬇</button>`:''}
        ${currentUser.isAdmin?`<button class="act-del">🗑</button>`:''}
      </div>`;
    if(x.media) div.querySelector('.card-media').addEventListener('click',()=>openLightbox(x.media,x.isVideo,x.title));
    div.querySelector('.like-btn').addEventListener('click',()=>{ toggleLike('xotiralar',x.id); renderXotiralar(); });
    div.querySelector('.cmnt-btn').addEventListener('click',()=>openComments('xotiralar',x.id));
    if(x.media) div.querySelector('.act-dl').addEventListener('click',()=>dlFile(x.media,x.title+(x.isVideo?'.mp4':'.jpg')));
    if(currentUser.isAdmin) div.querySelector('.act-del').addEventListener('click',()=>{
      if(confirm('O\'chirilsinmi?')){ state.xotiralar=state.xotiralar.filter(i=>i.id!==x.id); save(); renderXotiralar(); }
    });
    list.appendChild(div);
  });
}

// ═══════════════════════════════════════
//  GALLERY
// ═══════════════════════════════════════
$('btn-add-rasm').addEventListener('click',()=>{
  $('g-file').value=''; $('g-desc').value=''; $('g-preview').innerHTML='';
  openModal('modal-rasm');
});

$('save-rasm').addEventListener('click',async()=>{
  const files=$('g-file').files;
  if(!files.length){ alert('Rasm yoki video tanlang!'); return; }
  const desc=$('g-desc').value.trim();
  for(const file of files){
    const data=await fileToB64(file);
    state.gallery.unshift({
      id:uid(), data, desc, isVideo:file.type.startsWith('video/'), name:file.name,
      likes:0, liked:false, comments:[],
      author:currentUser.name, authorId:currentUser.id, time:nowStr()
    });
  }
  save(); renderGallery(); closeModal('modal-rasm');
});

function renderGallery(){
  const grid=$('gallery-grid'), empty=$('gallery-empty');
  grid.innerHTML='';
  if(!state.gallery.length){ empty.style.display='flex'; return; }
  empty.style.display='none';
  state.gallery.forEach(g=>{
    const div=document.createElement('div'); div.className='g-item';
    div.innerHTML=`
      ${g.isVideo
        ?`<video src="${g.data}" muted loop playsinline preload="metadata"></video><div class="g-play">▶️</div>`
        :`<img src="${g.data}" alt="${g.desc}" loading="lazy"/>`}
      <div class="g-overlay">
        <button class="g-like ${g.liked?'liked':''}">${g.liked?'❤️':'🤍'} ${g.likes||0}</button>
        <button class="g-cmt-btn">💬 ${(g.comments||[]).length}</button>
        <button class="g-dl-btn">⬇</button>
        ${currentUser.isAdmin?`<button class="g-del">✕</button>`:''}
      </div>`;
    div.addEventListener('click',e=>{ if(e.target.closest('.g-overlay'))return; openLightbox(g.data,g.isVideo,g.desc||g.name); });
    div.querySelector('.g-like').addEventListener('click',e=>{ e.stopPropagation(); toggleLike('gallery',g.id); renderGallery(); });
    div.querySelector('.g-cmt-btn').addEventListener('click',e=>{ e.stopPropagation(); openComments('gallery',g.id); });
    div.querySelector('.g-dl-btn').addEventListener('click',e=>{ e.stopPropagation(); dlFile(g.data,g.name||(g.isVideo?'video.mp4':'rasm.jpg')); });
    if(currentUser.isAdmin) div.querySelector('.g-del').addEventListener('click',e=>{
      e.stopPropagation();
      if(confirm('O\'chirilsinmi?')){ state.gallery=state.gallery.filter(i=>i.id!==g.id); save(); renderGallery(); }
    });
    grid.appendChild(div);
  });
}

// ═══════════════════════════════════════
//  KUNDALIK
// ═══════════════════════════════════════
$('btn-add-kun').addEventListener('click',()=>{
  $('k-date').value=today(); $('k-text').value=''; initMoods();
  openModal('modal-kundalik');
});

$('save-kundalik').addEventListener('click',()=>{
  const text=$('k-text').value.trim();
  if(!text){ alert('Matn kiriting!'); return; }
  state.kundalik.unshift({
    id:uid(), date:$('k-date').value, mood:selectedMood, text,
    likes:0, liked:false, comments:[],
    author:currentUser.name, authorId:currentUser.id, time:nowStr()
  });
  save(); renderKundalik(); closeModal('modal-kundalik');
});

function renderKundalik(){
  const list=$('kundalik-list'), empty=$('kundalik-empty');
  list.innerHTML='';
  if(!state.kundalik.length){ empty.style.display='flex'; return; }
  empty.style.display='none';
  state.kundalik.forEach(k=>{
    const div=document.createElement('div'); div.className='kun-card';
    div.innerHTML=`
      <div class="kun-top">
        <span class="kun-mood">${k.mood}</span>
        <div style="flex:1">
          <div class="kun-date">📅 ${fmtDate(k.date)}</div>
          <div class="kun-author">✍️ ${k.author} • ${k.time}</div>
        </div>
        ${currentUser.isAdmin?`<button class="act-del">🗑</button>`:''}
      </div>
      <div class="kun-text">${k.text}</div>
      <div class="kun-actions">
        <button class="act-btn like-btn ${k.liked?'liked':''}">${k.liked?'❤️':'🤍'}<span class="cnt">${k.likes||0}</span></button>
        <button class="act-btn cmnt-btn">💬<span class="cnt">${(k.comments||[]).length}</span></button>
      </div>`;
    div.querySelector('.like-btn').addEventListener('click',()=>{ toggleLike('kundalik',k.id); renderKundalik(); });
    div.querySelector('.cmnt-btn').addEventListener('click',()=>openComments('kundalik',k.id));
    if(currentUser.isAdmin) div.querySelector('.act-del').addEventListener('click',()=>{
      if(confirm('O\'chirilsinmi?')){ state.kundalik=state.kundalik.filter(i=>i.id!==k.id); save(); renderKundalik(); }
    });
    list.appendChild(div);
  });
}

// ═══════════════════════════════════════
//  COMMENTS + REPLY
// ═══════════════════════════════════════
function openComments(col, id){
  commentCtx={col, id};
  renderComments();
  $('comment-input').value='';
  openModal('modal-comment');
}

function getCItem(){ return state[commentCtx.col]?.find(i=>i.id===commentCtx.id); }

function renderComments(){
  const item=getCItem(); if(!item) return;
  const list=$('comments-list'); list.innerHTML='';
  if(!item.comments?.length){ list.innerHTML='<div class="no-comments">Hali izoh yo\'q 💬</div>'; return; }
  item.comments.forEach(c=>{
    const div=document.createElement('div'); div.className='comment-item';
    const repliesHtml=(c.replies||[]).map(r=>`
      <div class="reply-item">
        <div class="r-header">
          <span class="r-name">${r.author}</span>
          <span class="r-time">${r.time}</span>
          ${currentUser.isAdmin?`<button class="r-del" data-rid="${r.id}" data-cid="${c.id}">✕</button>`:''}
        </div>
        <div class="r-text">${r.text}</div>
      </div>`).join('');
    div.innerHTML=`
      <div class="c-header">
        <span class="c-name">${c.author}</span>
        <span class="c-time">${c.time}</span>
        ${currentUser.isAdmin?`<button class="c-del" data-cid="${c.id}">✕</button>`:''}
      </div>
      <div class="c-text">${c.text}</div>
      <button class="c-reply-btn">↩ Javob</button>
      ${repliesHtml?`<div class="c-replies">${repliesHtml}</div>`:''}
      <div class="reply-row" style="display:none">
        <input class="reply-inp" placeholder="Javob yozing..."/>
        <button class="btn-send-reply">➤</button>
      </div>`;

    div.querySelector('.c-reply-btn').addEventListener('click',()=>{
      const row=div.querySelector('.reply-row');
      row.style.display=row.style.display==='none'?'flex':'none';
      if(row.style.display==='flex') row.querySelector('.reply-inp').focus();
    });
    div.querySelector('.btn-send-reply').addEventListener('click',()=>{
      const inp=div.querySelector('.reply-inp');
      const text=inp.value.trim(); if(!text) return;
      if(!c.replies) c.replies=[];
      c.replies.push({id:uid(), text, author:currentUser.name, authorId:currentUser.id, time:nowStr()});
      save(); renderComments(); renderAll();
    });
    div.querySelector('.reply-inp').addEventListener('keydown',e=>{ if(e.key==='Enter') div.querySelector('.btn-send-reply').click(); });

    if(currentUser.isAdmin){
      div.querySelector('.c-del').addEventListener('click',()=>{
        item.comments=item.comments.filter(x=>x.id!==c.id);
        save(); renderComments(); renderAll();
      });
      div.querySelectorAll('.r-del').forEach(btn=>{
        btn.addEventListener('click',()=>{
          const cmt=item.comments.find(x=>x.id===btn.dataset.cid);
          if(cmt) cmt.replies=cmt.replies.filter(r=>r.id!==btn.dataset.rid);
          save(); renderComments();
        });
      });
    }
    list.appendChild(div);
  });
}

$('btn-send-comment').addEventListener('click', sendComment);
$('comment-input').addEventListener('keydown',e=>{ if(e.key==='Enter') sendComment(); });

function sendComment(){
  const text=$('comment-input').value.trim(); if(!text) return;
  const item=getCItem(); if(!item) return;
  if(!item.comments) item.comments=[];
  item.comments.push({id:uid(), text, author:currentUser.name, authorId:currentUser.id, time:nowStr(), replies:[]});
  save(); renderComments(); $('comment-input').value=''; renderAll();
}

// ═══════════════════════════════════════
//  LIGHTBOX
// ═══════════════════════════════════════
function openLightbox(src, isVideo, name){
  lbSrc=src; lbName=name||'fayl';
  const content=$('lb-content'); content.innerHTML='';
  if(lbVideoEl){ lbVideoEl.pause(); lbVideoEl=null; }
  if(isVideo){
    lbVideoEl=document.createElement('video');
    Object.assign(lbVideoEl,{src,controls:true,autoplay:true,playsinline:true});
    content.appendChild(lbVideoEl);
  } else {
    content.appendChild(Object.assign(document.createElement('img'),{src,alt:name||''}));
  }
  $('lightbox').classList.add('open');
}

function closeLightbox(){
  $('lightbox').classList.remove('open');
  if(lbVideoEl){ lbVideoEl.pause(); lbVideoEl=null; }
  $('lb-content').innerHTML='';
}

$('lb-close').addEventListener('click', closeLightbox);
$('lightbox').addEventListener('click',e=>{ if(e.target===$('lightbox')) closeLightbox(); });
$('lb-download').addEventListener('click',()=>{
  dlFile(lbSrc, lbName+(lbSrc.startsWith('data:video')?'.mp4':'.jpg'));
});

// ═══════════════════════════════════════
//  SCREENSHOT PROTECTION
// ═══════════════════════════════════════
document.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('keydown',e=>{
  if(e.key==='PrintScreen'||(e.ctrlKey&&e.key==='p')||(e.metaKey&&e.shiftKey&&['3','4','5'].includes(e.key)))
    e.preventDefault();
});

// ═══════════════════════════════════════
//  RENDER ALL + INIT
// ═══════════════════════════════════════
function renderAll(){ renderXotiralar(); renderGallery(); renderKundalik(); }

load();
initMoods();
initAuth();
