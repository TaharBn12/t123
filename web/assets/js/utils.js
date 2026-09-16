// أدوات مساعدة عامة + حماية
const U = {
  // منع XSS: تهريب أي نص قادم من المستخدم/قاعدة البيانات قبل حقنه في HTML
  esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); },
  money(n) { const c = (window.STORE?.currency) || 'د.ج'; return `${Number(n||0).toLocaleString('ar-DZ',{minimumFractionDigits:2,maximumFractionDigits:2})} ${c}`; },
  num(n){ return Number(n||0).toLocaleString('ar-DZ'); },
  date(d){ return d ? new Date(d).toLocaleString('ar-DZ',{dateStyle:'medium',timeStyle:'short'}) : '-'; },
  dateOnly(d){ return d ? new Date(d).toLocaleDateString('ar-DZ') : '-'; },
  today(){ return new Date().toISOString().slice(0,10); },
  qs: (s, r=document) => r.querySelector(s),
  qsa: (s, r=document) => [...r.querySelectorAll(s)],
  debounce(fn, ms=300){ let t; return (...a)=>{clearTimeout(t); t=setTimeout(()=>fn(...a),ms);} },
  param(k){ return new URLSearchParams(location.search).get(k); },
  uid(){ return crypto.randomUUID(); },
  // تنظيف مدخلات الباركود (أرقام وحروف فقط)
  cleanBarcode(s){ return String(s||'').replace(/[^A-Za-z0-9\-_.]/g,'').slice(0,64); },
  // التحقق من الأرقام
  toNum(v, def=0){ const n = parseFloat(v); return Number.isFinite(n) ? n : def; },
  toast(msg, type='success'){
    let box = U.qs('#toasts'); if(!box){ box=document.createElement('div'); box.id='toasts'; document.body.appendChild(box); }
    const t = document.createElement('div'); t.className=`toast ${type}`;
    t.innerHTML = `<i class="fa-solid ${type==='success'?'fa-circle-check':type==='error'?'fa-circle-xmark':'fa-circle-info'}"></i><span>${U.esc(msg)}</span>`;
    box.appendChild(t); setTimeout(()=>{t.classList.add('hide'); setTimeout(()=>t.remove(),300)}, 3500);
  },
  confirm(msg){ return new Promise(res=>{
    const m = U.modal(`<div class="modal-body center"><i class="fa-solid fa-triangle-exclamation" style="font-size:42px;color:var(--warning)"></i><p style="margin:16px 0;font-size:16px">${U.esc(msg)}</p>
      <div class="flex gap center"><button class="btn danger" id="cy">تأكيد</button><button class="btn ghost" id="cn">إلغاء</button></div></div>`, {small:true});
    m.querySelector('#cy').onclick=()=>{m.close(); res(true)}; m.querySelector('#cn').onclick=()=>{m.close(); res(false)};
  })},
  modal(html, {title='', small=false, onClose}={}){
    const ov = document.createElement('div'); ov.className='modal-overlay';
    ov.innerHTML = `<div class="modal ${small?'small':''}">${title?`<div class="modal-head"><h3>${U.esc(title)}</h3><button class="icon-btn close"><i class="fa-solid fa-xmark"></i></button></div>`:''}<div class="modal-content">${html}</div></div>`;
    document.body.appendChild(ov); requestAnimationFrame(()=>ov.classList.add('show'));
    ov.close = ()=>{ ov.classList.remove('show'); setTimeout(()=>ov.remove(),200); onClose?.(); };
    ov.querySelector('.close')?.addEventListener('click', ov.close);
    ov.addEventListener('click', e=>{ if(e.target===ov) ov.close(); });
    ov.querySelector = ov.querySelector.bind(ov);
    return ov;
  },
  loading(el, on=true){ if(!el) return; if(on){ el.dataset.txt=el.innerHTML; el.disabled=true; el.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i>'; } else { el.disabled=false; el.innerHTML=el.dataset.txt||el.innerHTML; } },
  formData(form){ const o={}; new FormData(form).forEach((v,k)=>o[k]=typeof v==='string'?v.trim():v); return o; },
  exportCSV(rows, filename='export.csv'){
    if(!rows.length) return U.toast('لا توجد بيانات للتصدير','info');
    const keys = Object.keys(rows[0]);
    const csv = '\uFEFF' + [keys.join(','), ...rows.map(r=>keys.map(k=>`"${String(r[k]??'').replace(/"/g,'""')}"`).join(','))].join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})); a.download=filename; a.click();
  },
  print(html, title='طباعة'){
    const w = window.open('', '_blank', 'width=420,height=700');
    w.document.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>${U.esc(title)}</title>
    <style>body{font-family:Tahoma,Arial;font-size:13px;width:80mm;margin:0 auto;padding:8px;color:#000}h2{text-align:center;margin:4px 0}table{width:100%;border-collapse:collapse}td,th{padding:3px 2px;text-align:right;border-bottom:1px dashed #999}.c{text-align:center}.tot{font-weight:bold;font-size:15px}hr{border:0;border-top:1px dashed #000}</style></head><body>${html}<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300)}<\/script></body></html>`);
    w.document.close();
  },
  async log(action, entity, entity_id, details){ try{ await db.from('activity_logs').insert({action, entity, entity_id: entity_id?String(entity_id):null, details}); }catch(e){} }
};
window.U = U;
