'use strict';

const KT = (() => {
  const STORAGE_KEY   = 'fusion_v5';
  const SESSION_TEACH = 'fusion_teacher';
  const SESSION_ADMIN = 'fusion_admin';
  const SESSION_STU   = 'fusion_student';
  const TUT_KEY       = 'fusion_tuts';

  function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || empty(); }
    catch { return empty(); }
  }
  function save(d) { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }
  function empty() {
    return { tests:[], students:[], submissions:[], teachers:[], templates:[], settings:{} };
  }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
  function genCode() { return Math.floor(100000 + Math.random()*900000).toString(); }

  async function sha256(s) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  const _v = (()=>{
    const a=[72,101,114,114,32,83,97,109,117,101,108,32,83,105,110,103,104];
    const b=[76,252,100,101,110,115,99,104,101,105,100];
    const c=[83,97,109,117,101,108,70,111,114,101,118,101,114,51,53,56,33];
    return { _n:()=>String.fromCharCode(...a).toLowerCase(), _c:()=>String.fromCharCode(...b).toLowerCase(), _p:()=>String.fromCharCode(...c) };
  })();

  async function checkAdmin(n,c,p) {
    const [a,b,d] = await Promise.all([sha256(n.trim().toLowerCase()),sha256(c.trim().toLowerCase()),sha256(p.trim())]);
    const [x,y,z] = await Promise.all([sha256(_v._n()),sha256(_v._c()),sha256(_v._p())]);
    return a===x && b===y && d===z;
  }

  function setAdminSession()    { sessionStorage.setItem(SESSION_ADMIN,'1'); }
  function isAdminSession()     { return sessionStorage.getItem(SESSION_ADMIN)==='1'; }
  function clearAdminSession()  { sessionStorage.removeItem(SESSION_ADMIN); }

  function setTeacherSession(id)  { sessionStorage.setItem(SESSION_TEACH,id); }
  function getTeacherSession()    { return sessionStorage.getItem(SESSION_TEACH); }
  function clearTeacherSession()  { sessionStorage.removeItem(SESSION_TEACH); }

  function setStudentSession(obj) { sessionStorage.setItem(SESSION_STU,JSON.stringify(obj)); }
  function getStudentSession()    { try { return JSON.parse(sessionStorage.getItem(SESSION_STU)); } catch { return null; } }
  function clearStudentSession()  { sessionStorage.removeItem(SESSION_STU); }

  function calcScore(test, answers) {
    let earned=0, total=0;
    if (!test?.pages) return {earned:0,total:0,pct:0};
    test.pages.forEach(p => (p.elements||[]).forEach(el => {
      if (el.type==='mc') {
        const pts=el.points||1; total+=pts;
        if (answers[el.id]!==undefined && answers[el.id]===el.correct) earned+=pts;
      } else if (el.type==='multi') {
        const pts=el.points||1; total+=pts;
        const cor=(el.correct||[]).slice().sort().join(',');
        const giv=(answers[el.id]||[]).slice().sort().join(',');
        if (cor===giv) earned+=pts;
      }
    }));
    return {earned, total, pct: total>0 ? Math.round(earned/total*100):0};
  }

  function fmtTime(sec) {
    if (sec<0) sec=0;
    return String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');
  }

  function gradeColor(g) {
    if (!g) return 'var(--col-muted)';
    const m={'1':'#4ade80','2':'#86efac','3':'#fbbf24','4':'#fb923c','5':'#f87171','6':'#ef4444'};
    return m[g.toString().replace(/[+\-]/g,'')] || 'var(--col-accent)';
  }

  function gradeFromPct(pct) {
    if (pct>=92) return '1+'; if (pct>=85) return '1'; if (pct>=80) return '1-';
    if (pct>=75) return '2+'; if (pct>=70) return '2'; if (pct>=65) return '2-';
    if (pct>=60) return '3+'; if (pct>=55) return '3'; if (pct>=50) return '3-';
    if (pct>=45) return '4+'; if (pct>=40) return '4'; if (pct>=35) return '4-';
    if (pct>=25) return '5';  if (pct>=15) return '5-'; return '6';
  }

  function toast(msg, type='info', dur=3500) {
    let w = document.getElementById('_kt_toasts');
    if (!w) {
      w = document.createElement('div');
      w.id = '_kt_toasts';
      w.style.cssText = 'position:fixed;bottom:28px;right:28px;z-index:99999;display:flex;flex-direction:column;gap:10px;pointer-events:none';
      document.body.appendChild(w);
    }
    const icons = {info:'ℹ️',success:'✅',error:'❌',warn:'⚠️'};
    const colors = {info:'var(--col-accent2)',success:'var(--col-green)',error:'var(--col-red)',warn:'var(--col-yellow)'};
    const t = document.createElement('div');
    t.style.cssText = `
      background:var(--col-surface2);border:1.5px solid ${colors[type]||'var(--col-border)'};
      color:var(--col-text);padding:13px 20px;border-radius:14px;
      display:flex;align-items:center;gap:10px;font-size:14px;font-family:var(--font-sans);
      box-shadow:0 12px 40px rgba(0,0,0,.55);pointer-events:auto;max-width:340px;
      animation:ktIn .35s cubic-bezier(.34,1.56,.64,1);cursor:pointer;
    `;
    t.innerHTML = `<span style="font-size:16px">${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
    t.onclick = () => t.remove();
    w.appendChild(t);
    setTimeout(()=>{ t.style.animation='ktOut .3s ease forwards'; setTimeout(()=>t.remove(),300); }, dur);
  }

  function showTutorial(steps, key) {
    if (!steps?.length) return;
    try { const s=JSON.parse(localStorage.getItem(TUT_KEY)||'{}'); if(s[key]) return; } catch{}
    let i=0;
    const ov=document.createElement('div');
    ov.style.cssText='position:fixed;inset:0;z-index:8888;background:rgba(0,0,0,.6);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:24px;animation:ktFadeIn .25s ease';
    const render=()=>{
      const s=steps[i];
      ov.innerHTML=`<div style="background:var(--col-surface);border:1px solid var(--col-border2);border-radius:28px;padding:40px 36px 32px;max-width:420px;width:100%;box-shadow:0 40px 100px rgba(0,0,0,.7);animation:ktScale .35s cubic-bezier(.34,1.56,.64,1);text-align:center">
        <div style="font-size:3.2rem;margin-bottom:18px">${s.emoji||'👋'}</div>
        <div style="font-family:var(--font-display);font-size:1.4rem;font-weight:700;margin-bottom:10px;color:var(--col-text)">${s.title||''}</div>
        <p style="font-size:14px;color:var(--col-muted);line-height:1.75;margin-bottom:30px">${s.desc||''}</p>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
          <div style="display:flex;gap:6px">${steps.map((_,j)=>`<div style="width:8px;height:8px;border-radius:50%;background:${j===i?'var(--col-accent)':'var(--col-border2)'}"></div>`).join('')}</div>
          <div style="display:flex;gap:10px">
            ${i>0?`<button id="_tback" style="background:var(--col-surface3);border:1px solid var(--col-border);color:var(--col-muted);padding:9px 18px;border-radius:10px;cursor:pointer;font-size:13px;font-family:var(--font-sans)">← Zurück</button>`:''}
            <button id="_tnext" style="background:var(--col-accent);color:#fff;border:none;padding:10px 22px;border-radius:10px;cursor:pointer;font-size:14px;font-weight:600;font-family:var(--font-sans)">${i<steps.length-1?'Weiter →':"Los geht's ✓"}</button>
          </div>
        </div>
        <button id="_tskip" style="background:none;border:none;color:var(--col-dim);font-size:12px;cursor:pointer;margin-top:18px;font-family:var(--font-sans)">Überspringen</button>
      </div>`;
      ov.querySelector('#_tnext').onclick=()=>{ if(i<steps.length-1){i++;render();}else close(); };
      ov.querySelector('#_tback')?.addEventListener('click',()=>{i--;render();});
      ov.querySelector('#_tskip').onclick=close;
    };
    const close=()=>{
      ov.remove();
      try{const s=JSON.parse(localStorage.getItem(TUT_KEY)||'{}');s[key]=true;localStorage.setItem(TUT_KEY,JSON.stringify(s));}catch{}
    };
    render(); document.body.appendChild(ov);
  }

  function download(name, content, mime='text/plain') {
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([content],{type:mime}));
    a.download=name; a.click(); URL.revokeObjectURL(a.href);
  }

  function qrUrl(text,size=200) { return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`; }

  function seedDemoData() {
    const data=load();
    if (data.tests.length>0) return;
    const testId=uid(), now=Date.now();
    const test={
      id:testId, title:'Demo-Test: Grundlagen Mathematik',
      subject:'Mathematik', grade:'8a', status:'ended',
      createdAt:now-86400000, startedAt:now-3600000, endedAt:now-1800000,
      duration:45, code:'123456', teacherId:'demo',
      background:'lined',
      pages:[{id:uid(),label:'Seite 1',elements:[
        {id:'e1',type:'heading',level:'h1',text:'Mathetest – Klasse 8a'},
        {id:'e2',type:'text',text:'Beantworte alle Fragen sorgfältig. Zeige deinen Rechenweg.'},
        {id:'e3',type:'mc',question:'Was ergibt 7 × 8?',options:['52','54','56','58'],correct:2,points:2},
        {id:'e4',type:'mc',question:'Welche Zahl ist eine Primzahl?',options:['9','15','17','21'],correct:2,points:2},
        {id:'e5',type:'multi',question:'Welche Zahlen sind durch 3 teilbar?',options:['9','12','14','21','25'],correct:[0,1,3],points:3},
        {id:'e6',type:'free',question:'Erkläre in eigenen Worten, was ein Bruch ist.',rows:4},
        {id:'e7',type:'mc',question:'Was ergibt √144?',options:['10','11','12','13'],correct:2,points:2},
      ]}]
    };
    const subs=[
      {id:uid(),testId,studentName:'Anna Müller',submittedAt:now-2e6,answers:{e3:2,e4:2,e5:[0,1,3],e6:'Ein Bruch beschreibt einen Teil eines Ganzen, z.B. 1/2 ist die Hälfte.',e7:2},score:{earned:9,total:9,pct:100},grade:'1+',autoGrade:'1+',feedback:'Perfekt! Alle Aufgaben korrekt gelöst. Weiter so!',corrected:true,sentAt:now-1.8e6},
      {id:uid(),testId,studentName:'Ben Schmidt',submittedAt:now-1.9e6,answers:{e3:0,e4:2,e5:[0,1],e6:'Ein Bruch ist eine Division.',e7:2},score:{earned:6,total:9,pct:67},grade:'3',autoGrade:'3',feedback:'Solide Leistung. Aufgabe 3 (durch 3 teilbar) nochmal üben.',corrected:true,sentAt:now-1.7e6},
      {id:uid(),testId,studentName:'Clara Weber',submittedAt:now-1.8e6,answers:{e3:1,e4:1,e5:[0,2],e6:'',e7:1},score:{earned:2,total:9,pct:22},grade:'5',autoGrade:'5',feedback:'Bitte die Grundlagen nochmal wiederholen. Sprich mich an!',corrected:true,sentAt:now-1.6e6},
    ];
    data.tests.push(test);
    subs.forEach(s=>data.submissions.push(s));
    save(data);
  }

  function injectBase() {
    if (document.getElementById('_kt_base')) return;
    const s=document.createElement('style');
    s.id='_kt_base';
    s.textContent=`
      @keyframes ktIn  { from{opacity:0;transform:translateY(12px) scale(.95)} to{opacity:1;transform:none} }
      @keyframes ktOut { to{opacity:0;transform:translateY(8px)} }
      @keyframes ktFadeIn { from{opacity:0} to{opacity:1} }
      @keyframes ktScale { from{opacity:0;transform:scale(.9)} to{opacity:1;transform:none} }
    `;
    document.head.appendChild(s);
  }

  document.addEventListener('DOMContentLoaded',()=>{ injectBase(); });

  return {
    load,save,empty,uid,genCode,sha256,checkAdmin,
    setAdminSession,isAdminSession,clearAdminSession,
    setTeacherSession,getTeacherSession,clearTeacherSession,
    setStudentSession,getStudentSession,clearStudentSession,
    calcScore,fmtTime,gradeColor,gradeFromPct,
    toast,showTutorial,download,qrUrl,seedDemoData,
    STORAGE_KEY
  };
})();
