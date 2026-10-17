'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LS='skin-manual-pwa-v2';
const dataURL=new URL('manual.json',document.baseURI).href;
let db=null,items=[],idx=0,search='',drawer=false;
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
function setItem(n){if(n<0||n>=items.length)return;idx=n;stateSave();render();closeMenu();$('main').scrollTop=0}
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
 $('prevBtn').disabled=$('mobilePrev').disabled=idx===0;
 $('nextBtn').disabled=$('mobileNext').disabled=idx===items.length-1;
 renderToc();
}
function renderToc(){
 const term=search.toLocaleLowerCase();
 let out='',shown=0;
 for(let ch=1;ch<=14;ch++){
  const chap=items.map((it,i)=>({it,i})).filter(z=>z.it.chapter_no===ch&&(!term||[z.it.id,title(z.it),z.it.answer_ko,db.sectionNames[z.it.section_id]||''].join(' ').toLowerCase().includes(term)));
  if(!chap.length)continue;shown+=chap.length;
  out+='<div class="toc-chapter"><div class="toc-chapter-title">'+ch+'장 · '+esc(db.chapterNames[String(ch)]||'')+' <span>'+chap.length+'</span></div>';
  let last='';
  for(const {it,i} of chap){
    if(last!==it.section_id){last=it.section_id;out+='<div class="toc-section">'+esc(db.sectionNames[it.section_id]||it.section_id)+'</div>'}
    out+='<button class="toc-item '+(i===idx?'active':'')+'" data-idx="'+i+'"><small>'+esc(it.id)+(saved.has(it.id)?' ★':'')+'</small><span>'+esc(title(it))+'</span></button>';
  }
  out+='</div>';
 }
 $('toc').innerHTML=out||'<p class="no-results">검색 결과가 없습니다.</p>';
 $('totalBadge').textContent=term?shown+' ITEMS':'14 CHAPTERS';
 $('toc').querySelectorAll('[data-idx]').forEach(b=>b.addEventListener('click',()=>setItem(Number(b.dataset.idx))));
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
  const id=items[idx]?.id||localStorage.getItem(LS+'-item');db=obj;items=obj.items;idx=Math.max(0,items.findIndex(x=>x.id===id));updateCloud(offline?'오프라인 저장본':'클라우드 최신');render();return true;
 }catch(e){updateCloud('데이터 오류');notify('데이터 오류: '+e.message);return false}
}
document.addEventListener('DOMContentLoaded',()=>{
 $('syncBtn').addEventListener('click',()=>sync().then(ok=>{if(ok)notify('최신 매뉴얼을 불러왔습니다.')}));
 $('searchBox').addEventListener('input',e=>{search=e.target.value;renderToc()});
 $('languages').querySelectorAll('[data-lang]').forEach(b=>b.addEventListener('click',()=>{const l=b.dataset.lang;langs.has(l)?langs.delete(l):langs.add(l);if(!langs.size)langs.add('ko');document.querySelectorAll('[data-lang]').forEach(x=>{const on=langs.has(x.dataset.lang);x.classList.toggle('selected',on);x.setAttribute('aria-pressed',String(on))});stateSave();render()}));
 document.querySelectorAll('[data-lang]').forEach(x=>x.classList.toggle('selected',langs.has(x.dataset.lang)));
 for(const [n,delta] of [['prevBtn',-1],['nextBtn',1],['mobilePrev',-1],['mobileNext',1]])$(n).addEventListener('click',()=>setItem(idx+delta));
 $('bookmarkBtn').addEventListener('click',()=>{const id=items[idx].id;saved.has(id)?saved.delete(id):saved.add(id);stateSave();render();notify(saved.has(id)?'즐겨찾기 저장':'즐겨찾기 해제')});
 $('menuBtn').addEventListener('click',()=>menu(true));$('mobileToc').addEventListener('click',()=>menu(true));$('backdrop').addEventListener('click',closeMenu);
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
