'use strict';
const EDIT_KEY=LS+'-approved-patches';
let patches={};
try{patches=JSON.parse(localStorage.getItem(EDIT_KEY)||'{}')}catch(_){patches={}}
let draft=null,sourceItem=null,editStage='ko',editBusy=false;
const editLanguages=['en','zh','ja'],editNames={en:'영어',zh:'중국어(병음)',ja:'일본어(후리가나)'};
function elem(tag,attrs={},children=[]){
 const e=document.createElement(tag);
 for(const [k,v] of Object.entries(attrs)){if(k==='text')e.textContent=v;else if(k==='class')e.className=v;else if(k==='value')e.value=v;else e.setAttribute(k,v)}
 for(const c of children)e.append(c);
 return e;
}
function editMessage(s){$('editMessage').textContent=s||''}
function updateEditCount(){
 const n=Object.keys(patches).length;
 $('pendingEdits').textContent=n?' ('+n+')':'';
 $('publishBtn').disabled=!n;
}
function saveEditPatches(){localStorage.setItem(EDIT_KEY,JSON.stringify(patches));updateEditCount()}
function applyApprovedEdits(){
 items=db.items.filter(x=>patches[x.id]?.op!=='delete').map(x=>patches[x.id]?.op==='edit'?structuredClone(patches[x.id].item):x);
}
function textarea(label,value,path,lines=2){
 const field=elem('label',{class:'edit-field'});
 field.append(elem('span',{text:label}));
 const ta=elem('textarea',{rows:String(lines),'data-path':path});
 ta.value=value||'';field.append(ta);return field;
}
function editOpen(){
 if(!items.length)return;
 sourceItem=structuredClone(items[idx]);
 draft=structuredClone(items[idx]);editStage='ko';editKorean();
 $('editDialog').showModal();editMessage('');
}
function editKorean(){
 editStage='ko';$('editTitle').textContent='한국어 원문 수정 · '+draft.id;
 $('editDelete').hidden=false;
 const host=$('editContents');host.replaceChildren();
 if(draft.type==='qa'){
  host.append(textarea('한국어 질문',draft.question_ko,'question_ko'));
  host.append(textarea('한국어 답변',draft.answer_ko,'answer_ko',7));
  host.append(textarea('상담 상황',draft.context_ko,'context_ko'));
 }else{
  host.append(textarea('시술카드 제목',draft.title_ko,'title_ko'));
  (draft.rows||[]).forEach((r,i)=>{host.append(elem('h4',{text:'항목 '+(i+1)}));host.append(textarea('명칭',r[0],'rows.'+i+'.0'));host.append(textarea('내용',r[1],'rows.'+i+'.1',4))});
 }
 $('editNext').hidden=false;$('editTranslate').hidden=true;$('editApprove').hidden=true;
}
function pullEditor(){
 for(const t of $('editContents').querySelectorAll('textarea[data-path]')){
  const path=t.dataset.path.split('.');
  let val=draft;
  for(let i=0;i<path.length-1;i++){
   const k=path[i];
   if(val[k]===undefined||val[k]===null)val[k]=/^\d+$/.test(path[i+1])?[]:{};
   val=val[k];
  }
  val[path[path.length-1]]=t.value.trim();
 }
}
function validateKorean(){
 if(draft.type==='qa'&&(!draft.question_ko||!draft.answer_ko))throw Error('질문과 답변을 입력하세요.');
 if(draft.type==='card'&&(!draft.title_ko||draft.rows.some(r=>!r[0]||!r[1])))throw Error('카드 제목·모든 항목을 입력하세요.');
}
function editReview(){
 editStage='review';$('editTitle').textContent='번역 비교 검토 · '+draft.id;
 const host=$('editContents');host.replaceChildren();
 host.append(elem('pre',{class:'edit-original',text:draft.type==='qa'?'KR 질문: '+draft.question_ko+'\n\nKR 답변: '+draft.answer_ko: draft.title_ko+'\n'+draft.rows.map(r=>r.join(': ')).join('\n')}));
 host.append(elem('p',{class:'edit-notice',text:'기존 번역은 수정 전 원문 기준일 수 있습니다. 번역 초안을 생성하거나 직접 수정한 뒤 의학적 정확성과 발음 표기를 검토하세요.'}));
 draft.translations||={};
 for(const lang of editLanguages){
  const tr=draft.translations[lang]||(draft.translations[lang]={});
  const group=elem('section',{class:'edit-language'});
  group.append(elem('h3',{text:editNames[lang]}));
  const add=(label,value,path,lines=2)=>group.append(textarea(label,value,'translations.'+lang+'.'+path,lines));
  if(draft.type==='qa'){
   add('질문',tr.q,'q');add('답변',tr.a,'a',6);
   if(lang==='zh'){add('질문 병음(성조)',tr.qp,'qp');add('답변 병음(성조)',tr.ap,'ap',4)}
   if(lang==='ja'){add('질문 후리가나 (ruby)',tr.qr,'qr');add('답변 후리가나 (ruby)',tr.ar,'ar',4)}
  }else{
   add('시술카드 제목',tr.title,'title');
   tr.rows||=[];
   draft.rows.forEach((r,i)=>{
    const rr=tr.rows[i]||{};
    group.append(elem('h4',{text:'항목 '+(i+1)}));
    add('명칭',rr.label,'rows.'+i+'.label');
    add('설명',rr.text,'rows.'+i+'.text',4);
    if(lang==='zh')add('병음',rr.pinyin,'rows.'+i+'.pinyin');
    if(lang==='ja')add('후리가나',rr.ruby,'rows.'+i+'.ruby');
   });
  }
  const checkbox=elem('label',{class:'edit-checked'},[elem('input',{type:'checkbox','data-checked-lang':lang}),elem('span',{text:editNames[lang]+' 검토 완료'})]);
  group.append(checkbox);host.append(group);
 }
 $('editNext').hidden=true;$('editTranslate').hidden=false;$('editApprove').hidden=false;
}
function sourcePayload(){
 return draft.type==='qa'?{type:'qa',q:draft.question_ko,a:draft.answer_ko}:
 {type:'card',title:draft.title_ko,rows:draft.rows.map(r=>({label:r[0],text:r[1]}))};
}
async function geminiDraft(key){
 const prompt='Translate this Korean clinical manual faithfully into fluent English, Simplified Mandarin and natural Japanese. Preserve all indications, warnings, numbers and uncertainty. Return only JSON with root en, zh, ja. For type qa: each has q,a; zh also qp,ap with Pinyin tone marks; ja also qr,ar with ruby HTML for furigana. For type card: each has title and rows of same length, each with label,text; Chinese rows additionally pinyin, Japanese rows additionally ruby with furigana. Japanese should be spoken JLPT N3 where possible. Never invent medical facts.';
 const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',{
  method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},
  body:JSON.stringify({contents:[{parts:[{text:prompt+'\n'+JSON.stringify(sourcePayload())}]}],generationConfig:{responseMimeType:'application/json',temperature:0.2}})
 });
 const d=await r.json();if(!r.ok)throw Error(d.error?.message||'AI API '+r.status);
 const output=d.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('');
 if(!output)throw Error('AI 응답이 비어 있습니다.');
 return JSON.parse(output.trim().replace(/^[\x60]{3}(?:json)?\s*/i,'').replace(/\s*[\x60]{3}$/,''));
}
async function browserDraft(){
 if(!window.Translator?.create)throw Error('이 브라우저는 기기 자동번역을 지원하지 않습니다. 데스크톱 Chrome 또는 Gemini API를 사용하세요.');
 const translated={};
 for(const lang of editLanguages){
  const instance=await Translator.create({sourceLanguage:'ko',targetLanguage:lang});
  const tr=async s=>s?await instance.translate(s):'';
  if(draft.type==='qa')translated[lang]={q:await tr(draft.question_ko),a:await tr(draft.answer_ko)};
  else{
   const rows=[];
   for(const r of draft.rows)rows.push({label:await tr(r[0]),text:await tr(r[1])});
   translated[lang]={title:await tr(draft.title_ko),rows};
  }
  instance.destroy?.();
 }
 return translated;
}
async function translateDraft(){
 if(editBusy)return;
 pullEditor();editBusy=true;$('editTranslate').disabled=true;editMessage('3개 언어 번역 초안을 생성하는 중입니다.');
 try{
  const key=$('geminiKey').value.trim();
  const result=key?await geminiDraft(key):await browserDraft();
  for(const lang of editLanguages){
   const trans=result[lang];
   if(!trans)throw Error(lang+' 번역 누락');
   if(draft.type==='qa'&&(!trans.q||!trans.a))throw Error(lang+' 질문·답변 누락');
   if(draft.type==='card'&&(!trans.title||trans.rows?.length!==draft.rows.length))throw Error(lang+' 카드 항목 수 불일치');
  }
  for(const lang of editLanguages){
   const trans=result[lang],prev=draft.translations[lang]||{};
   if(draft.type==='qa'){
    draft.translations[lang]={...prev,...trans};
    if(lang==='zh'&&!trans.qp){draft.translations[lang].qp='';draft.translations[lang].ap=''}
    if(lang==='ja'&&!trans.qr){draft.translations[lang].qr='';draft.translations[lang].ar=''}
   }else{
    draft.translations[lang]={...prev,...trans,rows:trans.rows.map((r,i)=>({...prev.rows?.[i],...r,...(lang==='zh'&&!r.pinyin?{pinyin:''}:{}),...(lang==='ja'&&!r.ruby?{ruby:''}:{})}))};
   }
  }
  editReview();editMessage(key?'AI 번역 초안 생성 완료. 의료 표현을 직접 검토하세요.':'기기 번역 생성 완료. 병음·후리가나는 수동으로 보완해야 합니다.');
 }catch(e){editMessage('번역 오류: '+e.message)}
 finally{editBusy=false;$('editTranslate').disabled=false}
}
function approveEdition(){
 try{
  pullEditor();
  for(const lang of editLanguages){
   const tr=draft.translations?.[lang]||{};
   if(draft.type==='qa'&&(!tr.q||!tr.a))throw Error(lang+' 질문/답변 누락');
   if(draft.type==='card'&&(!tr.title||tr.rows?.length!==draft.rows.length||tr.rows.some(r=>!r.label||!r.text)))throw Error(lang+' 카드 번역 누락');
   if(!$('editContents').querySelector('[data-checked-lang="'+lang+'"]')?.checked)throw Error(editNames[lang]+' 검토 확인 필요');
  }
  if(JSON.stringify(draft)===JSON.stringify(sourceItem))throw Error('변경된 내용이 없습니다.');
  patches[draft.id]={op:'edit',base:structuredClone(patches[draft.id]?.base||sourceItem),item:structuredClone(draft)};
  saveEditPatches();items[idx]=structuredClone(draft);$('editDialog').close();render();
  notify('검토 승인본을 기기에 저장했습니다. 클라우드 저장은 별도입니다.');
 }catch(e){editMessage(e.message)}
}
function deleteEdition(){
 if(items.length<2)return editMessage('모든 항목 삭제는 허용되지 않습니다.');
 if(!confirm(draft.id+' 항목을 삭제 대기 상태로 변경할까요? 클라우드 반영 전 되돌릴 수 있습니다.'))return;
 patches[draft.id]={op:'delete',base:structuredClone(patches[draft.id]?.base||sourceItem)};
 saveEditPatches();items.splice(idx,1);idx=Math.min(idx,items.length-1);
 $('editDialog').close();openCurrentToc(true);stateSave();render();notify('삭제 대기 중입니다. 클라우드 저장 전 복구 가능합니다.');
}
function pendingEditList(){
 editStage='pending';$('editTitle').textContent='저장 대기 변경사항';
 $('editDelete').hidden=true;
 const host=$('editContents');host.replaceChildren();
 $('editNext').hidden=true;$('editTranslate').hidden=true;$('editApprove').hidden=true;
 const entries=Object.entries(patches);
 if(!entries.length)host.append(elem('p',{text:'대기 변경사항 없음'}));
 for(const [id,p] of entries){
  const row=elem('div',{class:'edit-pending'});
  row.append(elem('span',{text:(p.op==='delete'?'삭제 · ':'수정 · ')+id}));
  const btn=elem('button',{type:'button',text:'되돌리기'});
  btn.onclick=()=>{delete patches[id];saveEditPatches();$('editDialog').close();sync()};
  row.append(btn);host.append(row);
 }
}
function encoded64(s){
 const bytes=new TextEncoder().encode(s);let str='';
 for(let i=0;i<bytes.length;i+=32768)str+=String.fromCharCode(...bytes.subarray(i,i+32768));
 return btoa(str);
}
async function cloudCommit(){
 const token=$('githubToken').value.trim();
 if(!token)return editMessage('GitHub 저장 토큰을 입력하세요.');
 if(!Object.keys(patches).length)return editMessage('저장 대기 변경사항이 없습니다.');
 $('editPublish').disabled=true;editMessage('현재 클라우드 원본과 비교한 뒤 저장 중입니다.');
 try{
  const url='https://api.github.com/repos/alpakablanc/skin-clinic-manual/contents/manual.json';
  const hdr={Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
  const response=await fetch(url+'?ref=main',{headers:hdr,cache:'no-store'});
  if(!response.ok)throw Error('GitHub 권한 오류 '+response.status);
  const meta=await response.json();
  const blobResponse=await fetch('https://api.github.com/repos/alpakablanc/skin-clinic-manual/git/blobs/'+meta.sha,{headers:hdr,cache:'no-store'});
  if(!blobResponse.ok)throw Error('GitHub 최신 데이터 조회 실패 '+blobResponse.status);
  const blob=await blobResponse.json();
  if(blob.encoding!=='base64'||!blob.content)throw Error('GitHub 데이터 인코딩 오류');
  const binary=atob(blob.content.replace(/\s/g,''));
  const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
  const cloud=JSON.parse(new TextDecoder('utf-8').decode(bytes));
  for(const [id,p] of Object.entries(patches)){
   const before=cloud.items.find(x=>x.id===id);
   if(!before||JSON.stringify(before)!==JSON.stringify(p.base))throw Error(id+' 문답이 외부에서 변경되어 충돌했습니다.');
  }
  cloud.items=cloud.items.filter(x=>patches[x.id]?.op!=='delete').map(x=>patches[x.id]?.op==='edit'?patches[x.id].item:x);
  const pushed=await fetch(url,{method:'PUT',headers:{...hdr,'Content-Type':'application/json'},body:JSON.stringify({message:'Approved manual translations and edits',sha:meta.sha,branch:'main',content:encoded64(JSON.stringify(cloud,null,2))})});
  if(!pushed.ok){const e=await pushed.json().catch(()=>({}));throw Error(e.message||'GitHub HTTP '+pushed.status)}
  patches={};saveEditPatches();editMessage('GitHub 클라우드 저장 완료');
  const selectedId=items[idx]?.id;
  db=cloud;items=cloud.items;idx=Math.max(0,items.findIndex(x=>x.id===selectedId));
  openCurrentToc(true);render();
  $('editDialog').close();notify('클라우드 저장 완료. 다른 기기는 동기화하세요.');
 }catch(e){editMessage('클라우드 저장 실패: '+e.message+' (기기 승인본은 보존됨)')}
 finally{$('editPublish').disabled=false}
}
function editBackup(){
 const result=structuredClone(db);
 result.items=db.items.filter(x=>patches[x.id]?.op!=='delete').map(x=>patches[x.id]?.op==='edit'?patches[x.id].item:x);
 const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));
 const link=elem('a',{href:url,download:'skin-clinic-manual-edited.json'});
 document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
 editMessage('전체 수정본을 JSON 파일로 내보냈습니다.');
}
document.addEventListener('DOMContentLoaded',()=>{
 $('editBtn').onclick=editOpen;
 $('publishBtn').onclick=()=>{editOpen();pendingEditList()};
 $('editClose').onclick=()=>$('editDialog').close();
 $('editNext').onclick=()=>{try{pullEditor();validateKorean();editReview();editMessage('자동 번역 생성 또는 직접 수정 후 검토하세요.')}catch(e){editMessage(e.message)}};
 $('editBack').onclick=()=>{if(editStage==='review'){pullEditor();editKorean()}else if(editStage==='pending'){editKorean()}};
 $('editTranslate').onclick=translateDraft;$('editApprove').onclick=approveEdition;
 $('editDelete').onclick=deleteEdition;$('editPending').onclick=pendingEditList;
 $('editPublish').onclick=cloudCommit;$('editBackup').onclick=editBackup;
 updateEditCount();
});
