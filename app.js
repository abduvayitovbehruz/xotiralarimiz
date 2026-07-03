'use strict';

const ADMIN_ID =8814675023; // ← O'zingizning Telegram ID ingiz

let state = { users:[], xotiralar:[], gallery:[], kundalik:[], visitors:[] };
let currentUser = null;
let selectedMood = '😊';
let commentCtx = { col:'', id:'' };
let lbSrc = '', lbName = '', lbVideoEl = null;

const $ = id => document.getElementById(id);
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2);
const today = () => new Date().toISOString().slice(0,10);
const nowStr = () => new Date().toLocaleString('uz-UZ',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
const fmtDate = d => { if(!d)return''; const[y,m,day]=d.split('-'); return`${day}.${m}.${y}`; };
const fileToB64 = f => new Promise((r,j)=>{ const fr=new FileReader(); fr.onload=()=>r(fr.result); fr.onerror=j; fr.readAsDataURL(f); });
const dlFile = (url,name) => { const a=document.createElement('a'); a.href=url; a.download=name; a.click(); };
const avatarLetter = name => (name||'?')[0].toUpperCase();

function save(){ try{ localStorage.setItem('xotira_v5', JSON.stringify(state)); }catch(e){} }
function load(){ try{ const d=localStorage.getItem('xotira_v5'); if(d) state=JSON.parse(d); }catch(e){} }

// WATERMARK
function setWatermark(name){
  const t=`${name} • Xotiralarimiz • `;
  $('watermark').innerHTML=Array(12).fill(t).join('<br/>');
}

// FLOATING HEARTS
const HEARTS=['💕','💗','💖','💝','🌸','✨','💞','💓','🌹','💫'];
function spawnHeart(){
  const el=document.createElement('div'); el.className='fheart';
  el.textContent=HEARTS[Math.floor(Math.random()*HEARTS.length)];
  el.style.left=Math.random()*95+'vw';
  el.style.fontSize=(12+Math.random()*16)+'px';
  const dur=5+Math.random()*6;
  el.style.animationDuration=dur+'s';
  el.style.animationDelay=Math.random()*.5+'s';
  $('hearts-container').appendChild(el);
  setTimeout(()=>el.remove(),(dur+2)*1000);
}
setInterval(spawnHeart,1300);
[0,0,0,0].forEach(()=>spawnHeart());

// TABS
document.querySelectorAll('.tab').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    $('page-'+btn.dataset.tab).classList.add('active');
  });
});

// MODAL
function openModal(id){ $(id).classList.add('open'); }
function closeModal(id){ $(id).classList.remove('open'); }
document.querySelectorAll('.modal-close,.btn-cancel').forEach(b=>{
  b.addEventListener('click',()=>closeModal(b.dataset.modal||b.closest('.modal-overlay').id));
});
document.querySelectorAll('.modal-overlay').forEach(o=>{
  o.addEventListener('click',e=>{ if(e.target===o) closeModal(o.id); });
});

// FILE DROP
function setupDrop(dropId,inputId,prevId){
  const drop=$(dropId),inp=$(inputId),prev=$(prevId);
  drop.addEventListener('click',()=>inp.click());
  drop.addEventListener('dragover',e=>{ e.preventDefault(); drop.style.borderColor='var(--accent2)'; });
  drop.addEventListener('dragleave',()=>drop.style.borderColor='');
  drop.addEventListener('drop',e=>{ e.preventDefault(); drop.style.borderColor=''; showPrev(e.dataTransfer.files,prev); });
  inp.addEventListener('change',()=>showPrev(inp.files,prev));
}
async function showPrev(files,prev){
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

// MOOD
function initMoods(){
  selectedMood='😊';
  document.querySelectorAll('.mood').forEach(b=>{
    b.classList.remove('selected');
    b.onclick=()=>{ document.querySelectorAll('.mood').forEach(x=>x.classList.remove('selected')); b.classList.add('selected'); selectedMood=b.dataset.mood; };
  });
  document.querySelector('.mood').classList.add('selected');
}

// LIKE
function toggleLike(col,id){
  const item=state[col].find(i=>i.id===id); if(!item) return;
  item.liked=!item.liked; item.likes=(item.likes||0)+(item.liked?1:-1);
  save();
}

// AUTH
function initAuth(){
  try{
    if(window.Telegram?.WebApp?.initDataUnsafe?.user){
      const u=window.Telegram.WebApp.initDataUnsafe.user;
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      loginWith(u.id, u.first_name+(u.last_name?' '+u.last_name:''));
      return;
    }
  }catch(e){}
  $('login-screen').style.display='flex';
}

$('btn-login').addEventListener('click',()=>{
  const idVal=parseInt($('login-id-input').value.trim());
  if(!idVal){ alert('Telegram ID kiriting!'); return; }
  if(idVal===ADMIN_ID){ loginWith(idVal,'Admin'); return; }
  const found=state.users.find(u=>u.id===idVal);
  if(found){ loginWith(idVal,found.name); }
  else{ showAccessDenied(); }
});

function loginWith(id,name){
  const isAdmin=id===ADMIN_ID;
  currentUser={id,name,isAdmin};
  setWatermark(name);

  // Avatar
  const av=$('ci-avatar');
  if(av) av.textContent=avatarLetter(name);

  $('login-screen').style.display='none';
  $('app').style.display='flex';
  $('nav-user-name').textContent=(isAdmin?'👑 ':'')+name;

  if(!isAdmin){
    if(!state.visitors) state.visitors=[];
    state.visitors.unshift({id,name,time:nowStr()});
    if(state.visitors.length>200) state.visitors.length=200;
    save();
    showWelcome(name);
  } else {
    $('tab-users').style.display='flex';
    if(state.visitors?.length>0){
      const last=state.visitors[0];
      $('visitor-banner').style.display='block';
      $('visitor-text').textContent=`${last.name} oxirgi kirish: ${last.time}`;
    }
    renderUsersList();
  }
  renderAll();
}

function showWelcome(name){
  const el=$('welcome-screen');
  $('welcome-name').textContent=name;
  el.style.display='flex'; el.style.opacity='1';
  setTimeout(()=>{
    el.style.transition='opacity .7s ease';
    el.style.opacity='0';
    setTimeout(()=>{ el.style.display='none'; },700);
  },2800);
}

function showAccessDenied(){
  $('login-screen').style.display='none';
  const na=$('no-access');
  na.style.display='flex';
}

// USERS
$('btn-add-user').addEventListener('click',()=>{
  $('u-name').value=''; $('u-id').value='';
  openModal('modal-user');
});

$('save-user').addEventListener('click',()=>{
  const name=$('u-name').value.trim();
  const id=parseInt($('u-id').value.trim());
  if(!name||!id){ alert('Ism va ID kiriting!'); return; }
  if(state.users.find(u=>u.id===id)){ alert('Bu ID allaqachon bor!'); return; }
  state.users.push({id,name,addedAt:nowStr()});
  save(); renderUsersList(); closeModal('modal-user');
});

function renderUsersList(){
  const list=$('users-list'); if(!list) return;
  if(!state.users.length){
    list.innerHTML='<div class="no-users">Hali do\'st qo\'shilmagan<br/>+ Qo\'shish tugmasini bosing</div>'; return;
  }
  list.innerHTML='';
  state.users.forEach((u,i)=>{
    const visits=state.visitors?.filter(v=>v.id===u.id)||[];
    const lastVisit=visits[0];
    const div=document.createElement('div');
    div.className='user-item';
    div.style.animationDelay=(i*.05)+'s';
    div.innerHTML=`
      <div class="u-avatar">${avatarLetter(u.name)}</div>
      <div class="u-info">
        <div class="u-name">${u.name}</div>
        <div class="u-id">ID: ${u.id} • Qo'shildi: ${u.addedAt||''}</div>
        ${lastVisit
          ?`<div class="u-visit"><div class="u-visit-dot"></div>Oxirgi kirish: ${lastVisit.time} (${visits.length} marta)</div>`
          :`<div class="u-never">🔘 Hali kirmagan</div>`}
      </div>
      <button class="u-del">🗑</button>`;
    div.querySelector('.u-del').addEventListener('click',()=>{
      if(confirm(`${u.name} o'chirilsinmi?`)){ state.users=state.users.filter(x=>x.id!==u.id); save(); renderUsersList(); }
    });
    list.appendChild(div);
  });
}

// XOTIRALAR
$('btn-add-xotira').addEventListener('click',()=>{
  $('x-title').value=''; $('x-date').value=today();
  $('x-place').value=''; $('x-desc').value='';
  $('x-file').value=''; $('x-preview').innerHTML='';
  openModal('modal-xotira');
});

$('save-xotira').addEventListener('click',async()=>{
  const title=$('x-title').value.trim();
  if(!title){ alert('Sarlavha kiriting!'); return; }
  let media=null,isVideo=false;
  const file=$('x-file').files[0];
  if(file){ media=await fileToB64(file); isVideo=file.type.startsWith('video/'); }
  state.xotiralar.unshift({
    id:uid(),title,date:$('x-date').value,
    place:$('x-place').value.trim(),desc:$('x-desc').value.trim(),
    media,isVideo,likes:0,liked:false,comments:[],
    author:currentUser.name,authorId:currentUser.id,time:nowStr()
  });
  save(); renderXotiralar(); closeModal('modal-xotira');
});

function makeActionsHtml(item, showDl){
  return `
    <div class="card-actions">
      <button class="act-btn like-btn ${item.liked?'liked':''}">
        <span class="heart-icon">${item.liked?'❤️':'🤍'}</span>
        <span class="cnt">${item.likes||0}</span>
      </button>
      <button class="act-btn cmnt-btn">
        💬 <span class="cnt">${(item.comments||[]).length}</span>
      </button>
      <div class="act-sep"></div>
      ${showDl&&item.media?`<button class="act-dl">⬇</button>`:''}
      ${currentUser.isAdmin?`<button class="act-del">🗑</button>`:''}
    </div>`;
}

function renderXotiralar(){
  const list=$('xotiralar-list'),empty=$('xotiralar-empty');
  list.innerHTML='';
  if(!state.xotiralar.length){ empty.style.display='flex'; return; }
  empty.style.display='none';
  state.xotiralar.forEach((x,i)=>{
    const div=document.createElement('div'); div.className='card';
    div.style.animationDelay=(i*.04)+'s';
    div.innerHTML=`
      ${x.media?`
        <div class="card-media-wrap">
          ${x.isVideo
            ?`<video class="card-media" src="${x.media}" muted playsinline preload="metadata"></video>
              <div class="card-play-overlay"><div class="play-circle">▶</div></div>`
            :`<img class="card-media" src="${x.media}" alt="${x.title}" loading="lazy"/>`}
        </div>`:''}
      <div class="card-body">
        <div class="card-author-row">
          <div class="card-avatar">${avatarLetter(x.author)}</div>
          <div class="card-author-info">
            <div class="card-author-name">${x.author}</div>
            <div class="card-author-time">${x.time}</div>
          </div>
        </div>
        <div class="card-title">${x.title}</div>
        <div class="card-meta">
          ${x.date?`<span class="badge">📅 ${fmtDate(x.date)}</span>`:''}
          ${x.place?`<span class="badge">📍 ${x.place}</span>`:''}
        </div>
        ${x.desc?`<div class="card-desc">${x.desc}</div>`:''}
      </div>
      ${makeActionsHtml(x, true)}`;

    if(x.media) div.querySelector('.card-media-wrap').addEventListener('click',()=>openLightbox(x.media,x.isVideo,x.title));
    div.querySelector('.like-btn').addEventListener('click',()=>{ toggleLike('xotiralar',x.id); renderXotiralar(); });
    div.querySelector('.cmnt-btn').addEventListener('click',()=>openComments('xotiralar',x.id));
    if(x.media) div.querySelector('.act-dl')?.addEventListener('click',()=>dlFile(x.media,x.title+(x.isVideo?'.mp4':'.jpg')));
    if(currentUser.isAdmin) div.querySelector('.act-del')?.addEventListener('click',()=>{
      if(confirm('O\'chirilsinmi?')){ state.xotiralar=state.xotiralar.filter(i=>i.id!==x.id); save(); renderXotiralar(); }
    });
    list.appendChild(div);
  });
}

// GALLERY
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
      id:uid(),data,desc,isVideo:file.type.startsWith('video/'),name:file.name,
      likes:0,liked:false,comments:[],
      author:currentUser.name,authorId:currentUser.id,time:nowStr()
    });
  }
  save(); renderGallery(); closeModal('modal-rasm');
});

function renderGallery(){
  const grid=$('gallery-grid'),empty=$('gallery-empty');
  grid.innerHTML='';
  if(!state.gallery.length){ empty.style.display='flex'; return; }
  empty.style.display='none';
  state.gallery.forEach((g,i)=>{
    const div=document.createElement('div'); div.className='g-item';
    div.style.animationDelay=(i*.03)+'s';
    div.innerHTML=`
      ${g.isVideo
        ?`<video src="${g.data}" muted loop playsinline preload="metadata"></video>
          <div class="g-play-icon">▶</div>`
        :`<img src="${g.data}" alt="${g.desc||''}" loading="lazy"/>`}
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
    if(currentUser.isAdmin) div.querySelector('.g-del')?.addEventListener('click',e=>{
      e.stopPropagation();
      if(confirm('O\'chirilsinmi?')){ state.gallery=state.gallery.filter(i=>i.id!==g.id); save(); renderGallery(); }
    });
    grid.appendChild(div);
  });
}

// KUNDALIK
$('btn-add-kun').addEventListener('click',()=>{
  $('k-date').value=today(); $('k-text').value=''; initMoods();
  openModal('modal-kundalik');
});

$('save-kundalik').addEventListener('click',()=>{
  const text=$('k-text').value.trim();
  if(!text){ alert('Matn kiriting!'); return; }
  state.kundalik.unshift({
    id:uid(),date:$('k-date').value,mood:selectedMood,text,
    likes:0,liked:false,comments:[],
    author:currentUser.name,authorId:currentUser.id,time:nowStr()
  });
  save(); renderKundalik(); closeModal('modal-kundalik');
});

function renderKundalik(){
  const list=$('kundalik-list'),empty=$('kundalik-empty');
  list.innerHTML='';
  if(!state.kundalik.length){ empty.style.display='flex'; return; }
  empty.style.display='none';
  state.kundalik.forEach((k,i)=>{
    const div=document.createElement('div'); div.className='kun-card';
    div.style.animationDelay=(i*.04)+'s';
    div.innerHTML=`
      <div class="kun-top">
        <div class="kun-mood-wrap">${k.mood}</div>
        <div class="kun-meta">
          <div class="kun-author">${k.author}</div>
          <div class="kun-date">📅 ${fmtDate(k.date)} • ${k.time}</div>
        </div>
        ${currentUser.isAdmin?`<button class="act-del" style="flex-shrink:0">🗑</button>`:''}
      </div>
      <div class="kun-text">${k.text}</div>
      <div class="kun-actions">
        <button class="act-btn like-btn ${k.liked?'liked':''}">
          <span class="heart-icon">${k.liked?'❤️':'🤍'}</span>
          <span class="cnt">${k.likes||0}</span>
        </button>
        <button class="act-btn cmnt-btn">💬 <span class="cnt">${(k.comments||[]).length}</span></button>
      </div>`;
    div.querySelector('.like-btn').addEventListener('click',()=>{ toggleLike('kundalik',k.id); renderKundalik(); });
    div.querySelector('.cmnt-btn').addEventListener('click',()=>openComments('kundalik',k.id));
    if(currentUser.isAdmin) div.querySelector('.act-del')?.addEventListener('click',()=>{
      if(confirm('O\'chirilsinmi?')){ state.kundalik=state.kundalik.filter(i=>i.id!==k.id); save(); renderKundalik(); }
    });
    list.appendChild(div);
  });
}

// COMMENTS
function openComments(col,id){
  commentCtx={col,id};
  renderComments();
  $('comment-input').value='';
  openModal('modal-comment');
}

function getCItem(){ return state[commentCtx.col]?.find(i=>i.id===commentCtx.id); }

function renderComments(){
  const item=getCItem(); if(!item) return;
  const list=$('comments-list'); list.innerHTML='';
  if(!item.comments?.length){
    list.innerHTML='<div class="no-comments">Hali izoh yo\'q<br/>Birinchi izoh qoldiring! 💬</div>'; return;
  }
  item.comments.forEach(c=>{
    const div=document.createElement('div'); div.className='comment-item';
    const repliesHtml=(c.replies||[]).map(r=>`
      <div class="reply-item">
        <div class="r-row">
          <div class="r-avatar">${avatarLetter(r.author)}</div>
          <div class="r-body">
            <div class="r-name">${r.author}</div>
            <div class="r-text">${r.text}</div>
            <div class="r-footer">
              <span class="r-time">${r.time}</span>
              ${currentUser.isAdmin?`<button class="r-del" data-rid="${r.id}" data-cid="${c.id}">🗑</button>`:''}
            </div>
          </div>
        </div>
      </div>`).join('');
    div.innerHTML=`
      <div class="c-row">
        <div class="c-avatar">${avatarLetter(c.author)}</div>
        <div class="c-body">
          <div class="c-name">${c.author}</div>
          <div class="c-text">${c.text}</div>
          <div class="c-footer">
            <span class="c-time">${c.time}</span>
            <button class="c-reply-btn">Javob</button>
            ${currentUser.isAdmin?`<button class="c-del" data-cid="${c.id}">🗑</button>`:''}
          </div>
        </div>
      </div>
      ${repliesHtml?`<div class="c-replies">${repliesHtml}</div>`:''}
      <div class="reply-row" id="rr-${c.id}">
        <input class="reply-inp" placeholder="${c.author} ga javob..."/>
        <button class="btn-send-reply">➤</button>
      </div>`;

    div.querySelector('.c-reply-btn').addEventListener('click',()=>{
      const rr=$(`rr-${c.id}`);
      rr.classList.toggle('show');
      if(rr.classList.contains('show')) rr.querySelector('.reply-inp').focus();
    });
    div.querySelector('.btn-send-reply').addEventListener('click',()=>{
      const inp=div.querySelector('.reply-inp');
      const text=inp.value.trim(); if(!text) return;
      if(!c.replies) c.replies=[];
      c.replies.push({id:uid(),text,author:currentUser.name,authorId:currentUser.id,time:nowStr()});
      save(); renderComments(); renderAll();
    });
    div.querySelector('.reply-inp').addEventListener('keydown',e=>{ if(e.key==='Enter') div.querySelector('.btn-send-reply').click(); });

    if(currentUser.isAdmin){
      div.querySelector('.c-del')?.addEventListener('click',()=>{
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

$('btn-send-comment').addEventListener('click',sendComment);
$('comment-input').addEventListener('keydown',e=>{ if(e.key==='Enter') sendComment(); });

function sendComment(){
  const text=$('comment-input').value.trim(); if(!text) return;
  const item=getCItem(); if(!item) return;
  if(!item.comments) item.comments=[];
  item.comments.push({id:uid(),text,author:currentUser.name,authorId:currentUser.id,time:nowStr(),replies:[]});
  save(); renderComments(); $('comment-input').value=''; renderAll();
}

// LIGHTBOX
function openLightbox(src,isVideo,name){
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

$('lb-close').addEventListener('click',closeLightbox);
$('lightbox').addEventListener('click',e=>{ if(e.target===$('lightbox')) closeLightbox(); });
$('lb-download').addEventListener('click',()=>{
  dlFile(lbSrc,lbName+(lbSrc.startsWith('data:video')?'.mp4':'.jpg'));
});

// SCREENSHOT PROTECTION
document.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('keydown',e=>{
  if(e.key==='PrintScreen'||(e.ctrlKey&&e.key==='p')||(e.metaKey&&e.shiftKey&&['3','4','5'].includes(e.key)))
    e.preventDefault();
});

function renderAll(){ renderXotiralar(); renderGallery(); renderKundalik(); }

load(); initMoods(); initAuth();
