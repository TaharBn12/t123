// صفحة استقبال المسح من تطبيق الهاتف - تعرض المنتجات لحظياً
initPage('استقبال المسح من الهاتف', null, async (c)=>{
  let mode = localStorage.getItem('scanMode')||'view', items=[], deviceCount=0;
  c.innerHTML = `
  <div class="scan-hero"><div class="pulse"><i class="fa-solid fa-barcode"></i></div><div class="grow"><h2 style="font-size:20px">جاهز لاستقبال المسح</h2><p style="opacity:.85">افتح تطبيق الماسح على هاتفك وسجّل الدخول بنفس الحساب، وستظهر المنتجات هنا فور مسحها</p>
    <div class="flex gap mt wrap"><span class="online" id="rt" style="color:#fff">الاتصال المباشر</span><span class="badge" style="background:rgba(255,255,255,.2);color:#fff" id="cnt">0 عملية مسح</span></div></div>
    <div style="text-align:center;background:rgba(255,255,255,.15);padding:12px 16px;border-radius:12px"><small>معرّف الجلسة</small><b style="display:block;font-size:13px;direction:ltr">${U.esc(Auth.user.email)}</b></div></div>
  <div class="card"><div class="card-head"><h3>وضع الاستقبال</h3><div class="flex gap wrap">
    <div class="tabs" style="margin:0"><button data-m="view" class="${mode==='view'?'active':''}"><i class="fa-solid fa-eye"></i> عرض المنتج</button><button data-m="inventory" class="${mode==='inventory'?'active':''}"><i class="fa-solid fa-clipboard-list"></i> جرد سريع</button><button data-m="collect" class="${mode==='collect'?'active':''}"><i class="fa-solid fa-layer-group"></i> تجميع قائمة</button></div>
    <button class="btn ghost sm" id="clear"><i class="fa-solid fa-broom"></i> مسح القائمة</button><button class="btn ghost sm" id="manual"><i class="fa-solid fa-keyboard"></i> إدخال يدوي</button></div></div>
    <p class="muted small" id="modeHint"></p>
    <div id="collectBar" class="flex gap wrap mt hidden"><b>القائمة المجمّعة: <span id="collectCount">0</span> صنف</b><div class="grow"></div><button class="btn success sm" id="toPos"><i class="fa-solid fa-cash-register"></i> إرسال إلى نقطة البيع</button><button class="btn info sm" id="toPurchase"><i class="fa-solid fa-truck"></i> إنشاء فاتورة شراء</button><button class="btn ghost sm" id="exportList"><i class="fa-solid fa-file-csv"></i> تصدير</button></div>
  </div>
  <div id="list"><div class="empty"><i class="fa-solid fa-mobile-screen-button"></i>بانتظار أول عملية مسح...</div></div>
  <div class="card mt"><div class="card-head"><h3><i class="fa-solid fa-clock-rotate-left"></i> آخر عمليات المسح المسجلة</h3></div><div id="history"></div></div>`;
  const hints={view:'كل باركود يُمسح من الهاتف تُعرض بطاقة المنتج فوراً مع السعر والمخزون، مع إمكانية التعديل أو إضافة المنتج إن لم يكن موجوداً.',inventory:'يُحتسب عدد مرات المسح لكل منتج ويُقارن بالمخزون المسجل لتسهيل الجرد. يمكنك اعتماد الكميات المحسوبة كمخزون فعلي.',collect:'تُجمّع المنتجات الممسوحة في قائمة واحدة يمكن إرسالها إلى نقطة البيع أو تحويلها لفاتورة شراء.'};
  const setMode=m=>{ mode=m; localStorage.setItem('scanMode',m); U.qsa('.tabs button').forEach(b=>b.classList.toggle('active',b.dataset.m===m)); U.qs('#modeHint').textContent=hints[m]; U.qs('#collectBar').classList.toggle('hidden',m!=='collect'); };
  U.qsa('.tabs button').forEach(b=>b.onclick=()=>setMode(b.dataset.m)); setMode(mode);
  const beep=(ok=true)=>{ try{ const a=new (window.AudioContext||window.webkitAudioContext)(); const o=a.createOscillator(); o.frequency.value=ok?880:220; o.connect(a.destination); o.start(); o.stop(a.currentTime+(ok?.08:.25)); }catch(e){} };
  const render=()=>{ const L=U.qs('#list'); U.qs('#cnt').textContent=`${deviceCount} عملية مسح`; U.qs('#collectCount').textContent=items.length;
    if(!items.length){ L.innerHTML='<div class="empty"><i class="fa-solid fa-mobile-screen-button"></i>بانتظار أول عملية مسح...</div>'; return; }
    L.innerHTML = items.map((it,i)=>{ const p=it.product; if(!p) return `<div class="scan-item unknown ${i===0?'new':''}"><div class="pimg">${U.imgPlaceholder('fa-circle-question')}</div><div><b>باركود غير مسجل</b><div class="muted" style="direction:ltr;text-align:right">${U.esc(it.barcode)}</div><small class="muted">${U.date(it.at)}</small></div><div class="flex gap"><a class="btn sm success" href="product-form.html?barcode=${encodeURIComponent(it.barcode)}"><i class="fa-solid fa-plus"></i> إضافة كمنتج</a><button class="icon-btn" data-rm="${i}"><i class="fa-solid fa-xmark"></i></button></div></div>`;
      const diff = it.count - (+p.stock);
      return `<div class="scan-item ${i===0?'new':''}"><div class="pimg">${p.image_url?`<img src="${U.esc(p.image_url)}">`:U.imgPlaceholder('fa-box-open')}</div>
        <div><b style="font-size:15px">${U.esc(p.name)}</b><div class="flex gap wrap small"><span class="muted" style="direction:ltr">${U.esc(p.barcode||'')}</span><span class="badge primary">${U.money(p.sale_price)}</span><span class="badge ${+p.stock<=+p.min_stock?'warning':'success'}">مخزون: ${U.num(p.stock)} ${U.esc(p.unit||'')}</span>${p.categories?`<span class="badge muted">${U.esc(p.categories.name)}</span>`:''}</div>
        ${mode==='inventory'?`<div class="mt small">تم المسح <b>${it.count}</b> مرة · الفرق عن المسجل: <b style="color:${diff===0?'var(--success)':'var(--danger)'}">${diff>0?'+':''}${diff}</b></div>`:''}${mode==='collect'?`<div class="mt small">الكمية: <b>${it.count}</b> · المجموع: <b>${U.money(it.count*p.sale_price)}</b></div>`:''}<small class="muted">${U.date(it.at)}</small></div>
        <div class="flex gap col" style="align-items:stretch"><a class="btn sm ghost" href="product-form.html?id=${p.id}"><i class="fa-solid fa-pen"></i> تعديل</a>${mode==='inventory'?`<button class="btn sm warning" data-apply="${i}"><i class="fa-solid fa-check"></i> اعتماد ${it.count}</button>`:''}<button class="btn sm ghost" data-qty="${i}"><i class="fa-solid fa-hashtag"></i> كمية</button><button class="icon-btn" data-rm="${i}" style="align-self:center"><i class="fa-solid fa-xmark"></i></button></div></div>`; }).join('');
    U.qsa('[data-rm]',L).forEach(b=>b.onclick=()=>{items.splice(b.dataset.rm,1); render();});
    U.qsa('[data-qty]',L).forEach(b=>b.onclick=()=>{ const v=prompt('الكمية:',items[b.dataset.qty].count); if(v!==null){ items[b.dataset.qty].count=Math.max(U.toNum(v,1),0.001); render(); } });
    U.qsa('[data-apply]',L).forEach(b=>b.onclick=async()=>{ const it=items[b.dataset.apply]; if(!await U.confirm(`تعديل مخزون "${it.product.name}" من ${it.product.stock} إلى ${it.count}؟`)) return;
      const {error}=await db.rpc('adjust_stock',{p_product_id:it.product.id,p_qty:it.count-(+it.product.stock),p_type:'adjustment',p_notes:'جرد عبر الماسح'}); if(error) return U.toast(error.message,'error'); it.product.stock=it.count; U.toast('تم اعتماد الجرد'); render(); }); };
  const handle=async(barcode, qty=1, at=new Date())=>{ barcode=U.cleanBarcode(barcode); if(!barcode) return; deviceCount++;
    const {data:p}=await db.from('products').select('*,categories(name)').eq('barcode',barcode).maybeSingle();
    const ex=items.find(i=>i.barcode===barcode);
    if(ex && mode!=='view'){ ex.count+=qty; ex.at=at; ex.product=p||ex.product; items.splice(items.indexOf(ex),1); items.unshift(ex); }
    else items.unshift({barcode,product:p,count:qty,at});
    if(items.length>100) items.pop(); beep(!!p); render(); loadHistory(); };
  // Realtime
  db.channel('scanner-page').on('postgres_changes',{event:'INSERT',schema:'public',table:'scan_events'},({new:ev})=>{ if(ev.target==='pos') return; handle(ev.barcode,+ev.quantity||1,ev.created_at); db.from('scan_events').update({consumed:true}).eq('id',ev.id).then(()=>{}); })
    .subscribe(s=>U.qs('#rt').classList.toggle('off',s!=='SUBSCRIBED'));
  // دعم ماسح USB أيضاً (كتابة سريعة + Enter)
  let buf='',last=0; document.addEventListener('keydown',e=>{ if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA') return; const now=Date.now(); if(now-last>100) buf=''; last=now; if(e.key==='Enter'){ if(buf.length>=3) handle(buf); buf=''; } else if(e.key.length===1) buf+=e.key; });
  U.qs('#manual').onclick=()=>formModal({title:'إدخال باركود يدوياً',fields:[{name:'barcode',label:'الباركود',required:true},{name:'qty',label:'الكمية',type:'number',default:1}],onSubmit:async d=>handle(d.barcode,d.qty||1)});
  U.qs('#clear').onclick=()=>{items=[]; deviceCount=0; render();};
  U.qs('#toPos').onclick=()=>{ const valid=items.filter(i=>i.product); if(!valid.length) return U.toast('لا منتجات صالحة','info'); localStorage.setItem('held',JSON.stringify([...JSON.parse(localStorage.getItem('held')||'[]'),{cart:valid.map(i=>({id:i.product.id,name:i.product.name,barcode:i.barcode,price:+i.product.sale_price,qty:i.count,stock:+i.product.stock})),at:Date.now()}])); location.href='pos.html'; };
  U.qs('#toPurchase').onclick=()=>{ const valid=items.filter(i=>i.product); if(!valid.length) return U.toast('لا منتجات صالحة','info'); sessionStorage.setItem('purchaseDraft',JSON.stringify(valid.map(i=>({product_id:i.product.id,name:i.product.name,quantity:i.count,cost_price:+i.product.cost_price})))); location.href='purchases.html?new=1'; };
  U.qs('#exportList').onclick=()=>U.exportCSV(items.map(i=>({الباركود:i.barcode,المنتج:i.product?.name||'غير مسجل',الكمية:i.count,السعر:i.product?.sale_price||'',المخزون:i.product?.stock||''})),'scan-list.csv');
  const loadHistory=async()=>{ const {data}=await db.from('scan_events').select('barcode,device_id,target,quantity,created_at').order('created_at',{ascending:false}).limit(15);
    U.qs('#history').innerHTML = (data||[]).length? `<div class="table-wrap"><table class="table"><thead><tr><th>الباركود</th><th>الجهاز</th><th>الوجهة</th><th>الكمية</th><th>الوقت</th></tr></thead><tbody>${data.map(r=>`<tr><td style="direction:ltr;text-align:right">${U.esc(r.barcode)}</td><td>${U.esc(r.device_id||'-')}</td><td><span class="badge ${r.target==='pos'?'success':'info'}">${{pos:'نقطة البيع',products:'المنتجات',inventory:'الجرد'}[r.target]||r.target}</span></td><td>${U.num(r.quantity)}</td><td>${U.date(r.created_at)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">لا سجلات</div>'; };
  loadHistory(); render();
});
