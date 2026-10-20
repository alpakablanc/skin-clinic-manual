'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LS='skin-manual-pwa-v2';
const dataURL=new URL('manual.json',document.baseURI).href;
let db=null,items=[],idx=0,search='',drawer=false;
const openChapters=new Set(),openSections=new Set();
let langs=new Set(JSON.parse(localStorage.getItem(LS+'-langs')||'["ko","en"]'));
let saved=new Set(JSON.parse(localStorage.getItem(LS+'-favorites')||'[]'));
let installPrompt=null;
const name={ko:'한국어',en:'English',zh:'中文',ja:'日本語'};
const tr={ko:null,en:'en',zh:'zh',ja:'ja'};
function notify(s){const e=$('toast');e.textContent=s;e.hidden=false;setTimeout(()=>e.hidden=true,3500)}
function title(x){return x.type==='card'?x.title_ko:x.question_ko}
function getrow(x,l){return l==='ko'?null:x.translations?.[tr[l]]||{}}
function rubyHtml(s){return String(s||'').replace(/<(?!\/?(?:ruby|rt|rb)>)[^>]*>/gi,'')}
function val(x,l,key){return l==='ko'?x[key+'_ko']:(getrow(x,l)?.[key==='question'?'q':key==='answer'?'a':key]||'')}
function sent(s){return String(s||'').match(/[^。！？!?;；]+[。！？!?;；]?/g)||[]}
function pin(s){return String(s||'').match(/[^.!?;]+[.!?;]?/g)||[]}
function renderLangText(t,l,phon){
 if(l==='ja'&&phon)return '<div class="ja-text">'+rubyHtml(phon)+'</div>';
 if(l==='zh'&&phon){const ss=sent(t),pp=pin(phon);if(ss.length===pp.length&&ss.length)return ss.map((v,i)=>'<p class="cn-sent">'+esc(v)+'</p><p class="pinyin">'+esc(pp[i])+'</p>').join('');return '<p>'+esc(t)+'</p><p class="pinyin">'+esc(phon)+'</p>'}
 return '<p>'+esc(t||'')+'</p>';
}
function block(x,l){
 const d=getrow(x,l);let q='',a='',qp='',ap='';
 if(x.type==='qa'){
  q=l==='ko'?x.question_ko:d.q;a=l==='ko'?x.answer_ko:d.a;
  qp=l==='zh'?d.qp:l==='ja'?d.qr:'';ap=l==='zh'?d.ap:l==='ja'?d.ar:'';
  return '<article class="language-card"><div class="language-head"><span class="lang-code">'+l.toUpperCase()+'</span><span>'+name[l]+'</span></div><div class="question">'+renderLangText(q,l,qp)+'</div><div class="answer">'+renderLangText(a,l,ap)+'</div></article>';
 }
 const tt=l==='ko'?x.title_ko:d.title;
 let html='<article class="language-card"><div class="language-head"><span class="lang-code">'+l.toUpperCase()+'</span><span>'+name[l]+'</span></div><h3>'+esc(tt)+'</h3><div class="card-rows">';
 for(let i=0;i<x.rows.length;i++){const r=l==='ko'?{label:x.rows[i][0],text:x.rows[i][1]}:d.rows?.[i]||{};html+='<div class="card-row"><b>'+esc(r.label)+'</b><div>'+renderLangText(r.text,l,l==='zh'?r.pinyin:l==='ja'?r.ruby:'')+'</div></div>'}
 return html+'</div></article>';
}
function stateSave(){localStorage.setItem(LS+'-item',items[idx]?.id||'');localStorage.setItem(LS+'-langs',JSON.stringify([...langs]));localStorage.setItem(LS+'-favorites',JSON.stringify([...saved]))}
function openCurrentToc(reset=false){
 const current=items[idx];
 if(!current)return;
 if(reset){openChapters.clear();openSections.clear()}
 openChapters.add(Number(current.chapter_no));
 openSections.add(String(current.section_id));
}
function keepCurrentTocVisible(){
 const toc=$('toc'),current=toc.querySelector('.toc-item.active');
 if(!current)return;
 const frame=toc.getBoundingClientRect(),box=current.getBoundingClientRect();
 if(frame.height===0)return;
 if(box.top<frame.top+12)toc.scrollTop+=box.top-frame.top-12;
 else if(box.bottom>frame.bottom-12)toc.scrollTop+=box.bottom-frame.bottom+12;
}
function setItem(n){
 if(n<0||n>=items.length)return;
 idx=n;
 const term=search.trim().toLocaleLowerCase();
 if(term&&!matchesToc(items[idx],term)){search='';$('searchBox').value=''}
 openCurrentToc(!search.trim());
 stateSave();render();keepCurrentTocVisible();closeMenu();$('readingScroll').scrollTop=0;
}
function render(){
 if(!items.length)return;
 const x=items[idx],ch=db.chapterNames[String(x.chapter_no)]||'';
 $('crumb').textContent='제'+x.chapter_no+'장 · '+ch+' / '+(db.sectionNames[x.section_id]||'');
 $('position').textContent=(idx+1)+' / '+items.length;
 $('eyebrow').textContent=x.type==='card'?'D-CARD · 시술 요약':x.level==='심화'?'심화 상담':'기본 Q&A';
 $('itemHeading').textContent=title(x);
 const c=$('caseContext');const ctx=x.context_ko||'';c.hidden=!ctx;c.textContent=ctx;
 $('bookmarkBtn').classList.toggle('saved',saved.has(x.id));
 $('readings').innerHTML=[...langs].sort((a,b)=>['ko','en','zh','ja'].indexOf(a)-['ko','en','zh','ja'].indexOf(b)).map(l=>block(x,l)).join('');
 $('prevBtn').disabled=idx===0;
 $('nextBtn').disabled=idx===items.length-1;
 $('navPosition').textContent=(idx+1)+' / '+items.length;
 renderToc();
}
function matchesToc(it,term){
 if(!term)return true;
 const chapter=db.chapterNames[String(it.chapter_no)]||'';
 const section=db.sectionNames[it.section_id]||'';
 return [it.id,title(it),it.answer_ko,chapter,section].join(' ').toLocaleLowerCase().includes(term);
}
function renderToc(){
 if(!db)return;
 const term=search.trim().toLocaleLowerCase();
 const groups=new Map();
 for(let i=0;i<items.length;i++){
  const it=items[i];
  if(!matchesToc(it,term))continue;
  const ch=Number(it.chapter_no);
  if(!groups.has(ch))groups.set(ch,new Map());
  const sections=groups.get(ch);
  const sectionId=String(it.section_id);
  if(!sections.has(sectionId))sections.set(sectionId,[]);
  sections.get(sectionId).push({it,i});
 }
 let out='',shown=0;
 for(let ch=1;ch<=14;ch++){
  const sections=groups.get(ch);
  if(!sections)continue;
  const count=[...sections.values()].reduce((n,rows)=>n+rows.length,0);
  shown+=count;
  const chapterOpen=openChapters.has(ch);
  out+='<section class="toc-chapter">';
  out+='<button type="button" class="toc-chapter-title" data-chapter="'+ch+'" aria-expanded="'+chapterOpen+'" aria-controls="toc-chapter-'+ch+'">';
  out+='<span class="toc-chevron" aria-hidden="true">▸</span><span class="toc-label">'+ch+'장 · '+esc(db.chapterNames[String(ch)]||'')+'</span><span class="toc-count">'+count+'</span></button>';
  out+='<div class="toc-chapter-contents" id="toc-chapter-'+ch+'" '+(chapterOpen?'':'hidden')+'>';
  let sectionNum=0;
  for(const [sectionId,rows] of sections){
   const sectionOpen=openSections.has(sectionId);
   const sectionHtmlId='toc-section-'+ch+'-'+(++sectionNum);
   out+='<div class="toc-section-group">';
   out+='<button type="button" class="toc-section" data-section="'+esc(sectionId)+'" aria-expanded="'+sectionOpen+'" aria-controls="'+sectionHtmlId+'">';
   out+='<span class="toc-chevron" aria-hidden="true">▸</span><span class="toc-label">'+esc(db.sectionNames[sectionId]||sectionId)+'</span><span class="toc-count">'+rows.length+'</span></button>';
   out+='<div class="toc-section-contents" id="'+sectionHtmlId+'" '+(sectionOpen?'':'hidden')+'>';
   for(const {it,i} of rows){
    out+='<button type="button" class="toc-item '+(i===idx?'active':'')+'" data-idx="'+i+'" '+(i===idx?'aria-current="true"':'')+'><small>'+esc(it.id)+(saved.has(it.id)?' ★':'')+'</small><span>'+esc(title(it))+'</span></button>';
   }
   out+='</div></div>';
  }
  out+='</div></section>';
 }
 $('toc').innerHTML=out||'<p class="no-results">검색 결과가 없습니다.</p>';
 $('totalBadge').textContent=term?shown+' ITEMS':'14 CHAPTERS';
}
function toggleToc(e){
 const chapter=e.target.closest('[data-chapter]');
 if(chapter){
  const ch=Number(chapter.dataset.chapter);
  openChapters.has(ch)?openChapters.delete(ch):openChapters.add(ch);
  renderToc();return;
 }
 const section=e.target.closest('[data-section]');
 if(section){
  const id=section.dataset.section;
  openSections.has(id)?openSections.delete(id):openSections.add(id);
  renderToc();return;
 }
 const item=e.target.closest('[data-idx]');
 if(item)setItem(Number(item.dataset.idx));
}
function searchToc(value){
 search=value;
 openChapters.clear();openSections.clear();
 const term=search.trim().toLocaleLowerCase();
 if(term){
  for(const it of items){
   if(matchesToc(it,term)){
    openChapters.add(Number(it.chapter_no));
    openSections.add(String(it.section_id));
   }
  }
 }else openCurrentToc();
 renderToc();
}
function menu(open){drawer=open;$('sidebar').classList.toggle('open',open);$('backdrop').hidden=!open}
function closeMenu(){menu(false)}
function updateCloud(t){$('cloudText').textContent=t;$('cloudState').className='cloud-indicator '+(t.includes('클라우드')?'online':'')}
async function sync(){
 updateCloud('동기화 중');let raw=null,offline=false;
 try{const r=await fetch(dataURL,{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);raw=await r.text();const c=await caches.open('manual-offline-v1');await c.put(dataURL,new Response(raw,{headers:{'Content-Type':'application/json'}}))}
 catch(e){offline=true;try{const r=await caches.match(dataURL);if(r)raw=await r.text()}catch(_){}}
 if(!raw){updateCloud('연결 필요');notify('처음 접속할 때는 인터넷 연결이 필요합니다.');return}
 try{const obj=JSON.parse(raw);if(!Array.isArray(obj.items)||obj.items.length!==462)throw Error('462개 항목 구조 불일치');
  const id=items[idx]?.id||localStorage.getItem(LS+'-item');db=obj;items=obj.items;idx=Math.max(0,items.findIndex(x=>x.id===id));openCurrentToc(!search.trim());updateCloud(offline?'오프라인 저장본':'클라우드 최신');render();keepCurrentTocVisible();return true;
 }catch(e){updateCloud('데이터 오류');notify('데이터 오류: '+e.message);return false}
}
document.addEventListener('DOMContentLoaded',()=>{
 $('syncBtn').addEventListener('click',()=>sync().then(ok=>{if(ok)notify('최신 매뉴얼을 불러왔습니다.')}));
 $('toc').addEventListener('click',toggleToc);
 $('searchBox').addEventListener('input',e=>searchToc(e.target.value));
 $('languages').querySelectorAll('[data-lang]').forEach(b=>b.addEventListener('click',()=>{const l=b.dataset.lang;langs.has(l)?langs.delete(l):langs.add(l);if(!langs.size)langs.add('ko');document.querySelectorAll('[data-lang]').forEach(x=>{const on=langs.has(x.dataset.lang);x.classList.toggle('selected',on);x.setAttribute('aria-pressed',String(on))});stateSave();render()}));
 document.querySelectorAll('[data-lang]').forEach(x=>x.classList.toggle('selected',langs.has(x.dataset.lang)));
 for(const [n,delta] of [['prevBtn',-1],['nextBtn',1]])$(n).addEventListener('click',()=>setItem(idx+delta));
 $('bookmarkBtn').addEventListener('click',()=>{const id=items[idx].id;saved.has(id)?saved.delete(id):saved.add(id);stateSave();render();notify(saved.has(id)?'즐겨찾기 저장':'즐겨찾기 해제')});
 $('menuBtn').addEventListener('click',()=>{menu(true);keepCurrentTocVisible()});$('backdrop').addEventListener('click',closeMenu);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();if(e.key==='/'&&document.activeElement.tagName!=='INPUT'){e.preventDefault();$('searchBox').focus()}});
 $('installBtn').addEventListener('click',async()=>{
  if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;return}
  $('installInstructions').textContent=/iphone|ipad|ipod/i.test(navigator.userAgent)?'Safari의 공유 메뉴에서 홈 화면에 추가를 선택하세요.':'브라우저 메뉴에서 앱 설치 또는 홈 화면에 추가를 선택하세요.';
  $('installDialog').showModal();
 });
 $('closeInstall').addEventListener('click',()=>$('installDialog').close());
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e});
 if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(console.warn);
 sync();
});
