initPage('نقطة البيع', null, async (c)=>{
  let products=[], cats=[], catMap=new Map(), cart=[], customer=null, pay='cash', discount={type:'fixed',value:0}, shift=null;
  const taxRate = U.toNum(STORE.tax_rate);
  // الوردية المفتوحة
  const {data:sh} = await db.from('shifts').select('*').eq('user_id',Auth.user.id).eq('status','open').order('opened_at',{ascending:false}).limit(1).maybeSingle(); shift=sh;
  c.innerHTML = `<div class="pos-layout">
   <div class="pos-products">
    <div class="flex gap mb wrap"><div class="grow flex gap scan-box">${U.icon('fa-barcode')}<input id="scanInput" placeholder="امسح الباركود أو ابحث بالاسم (Enter)" autofocus autocomplete="off"><button class="icon-btn clear-search hidden" id="scanClear" title="مسح البحث">${U.icon('fa-xmark')}</button></div>
     ${shift?`<span class="badge success">${U.icon('fa-clock')} وردية مفتوحة</span>`:`<a href="shifts.html" class="badge warning">${U.icon('fa-triangle-exclamation')} لا توجد وردية مفتوحة</a>`}
     <label class="flex gap small"><input type="checkbox" id="liveScan" checked> استقبال من الهاتف <span class="online" id="rtDot"></span></label></div>
    <div class="flex gap between mb wrap"><div class="cats grow" id="cats"></div><span class="muted small" id="pcount"></span></div>
    <div class="pos-grid" id="pgrid">${'<div class="p-card sk" aria-hidden="true"><div class="pimg"></div><div class="ln"></div><div class="ln" style="width:55%"></div></div>'.repeat(12)}</div>
   </div>
   <div class="cart">
    <div class="flex gap" style="padding:12px;border-bottom:1px solid var(--border)"><i class="fa-solid fa-user muted"></i><select class="input" id="custSel" style="flex:1"><option value="">زبون عام</option></select><button class="icon-btn" id="addCust" title="زبون جديد"><i class="fa-solid fa-plus"></i></button></div>
    <div class="cart-items" id="cartItems"><div class="empty"><i class="fa-solid fa-cart-shopping"></i>السلة فارغة</div></div>
    <div class="cart-foot">
      <div class="row"><span>المجموع</span><b id="sub">0</b></div>
      <div class="row"><span>الخصم <button class="btn ghost sm" id="discBtn" style="padding:2px 8px"><i class="fa-solid fa-pen"></i></button></span><b id="disc" style="color:var(--danger)">0</b></div>
      ${taxRate?`<div class="row"><span>الضريبة ${taxRate}%</span><b id="tax">0</b></div>`:'<span id="tax" hidden></span>'}
      <div class="row total"><span>الإجمالي</span><b id="tot">0</b></div>
      <div class="pay-methods"><button class="active" data-p="cash"><i class="fa-solid fa-money-bill"></i> نقدي</button><button data-p="card"><i class="fa-solid fa-credit-card"></i> بطاقة</button><button data-p="credit"><i class="fa-solid fa-hand-holding-dollar"></i> آجل</button></div>
      <div class="flex gap mb"><input class="input" id="paid" type="number" step="0.01" placeholder="المبلغ المدفوع"><div style="min-width:110px;text-align:center"><small class="muted">الباقي</small><b id="change" style="display:block">0</b></div></div>
      <div class="flex gap"><button class="btn success lg grow" id="payBtn" style="justify-content:center"><i class="fa-solid fa-check"></i> إتمام البيع <span class="kbd">F9</span></button><button class="btn ghost" id="holdBtn" title="تعليق"><i class="fa-solid fa-pause"></i></button><button class="btn danger" id="clearBtn" title="إفراغ"><i class="fa-solid fa-trash"></i></button></div>
    </div></div></div>`;
  const load = async ()=>{
    const [{data:p},{data:ct},{data:cu}] = await Promise.all([db.from('products').select('id,name,barcode,sale_price,stock,min_stock,category_id,image_url,tax_rate,unit').eq('is_active',true).order('name').limit(1000), db.from('categories').select('*').order('name'), db.from('customers').select('id,name,phone').order('name').limit(500)]);
    products=p||[]; cats=ct||[]; catMap=new Map(cats.map(x=>[x.id,x]));
    const cnt={}; products.forEach(x=>cnt[x.category_id]=(cnt[x.category_id]||0)+1);
    U.qs('#cats').innerHTML = `<button class="active" data-c="">${U.icon('fa-layer-group')} الكل <span class="cc">${U.num(products.length)}</span></button>`+cats.map(x=>`<button data-c="${x.id}" style="--cat:${U.esc(x.color||'#6366f1')}">${U.catIcon(x.icon,'fa-tag')} ${U.esc(x.name)} <span class="cc">${U.num(cnt[x.id]||0)}</span></button>`).join('');
    U.qsa('#cats button').forEach(b=>b.onclick=()=>{U.qsa('#cats button').forEach(x=>x.classList.remove('active')); b.classList.add('active'); renderGrid(b.dataset.c);});
    U.qs('#custSel').innerHTML += (cu||[]).map(x=>`<option value="${x.id}">${U.esc(x.name)} ${x.phone?'- '+U.esc(x.phone):''}</option>`).join('');
    renderGrid('');
  };
  const renderGrid=(cat, q='')=>{ const grid=U.qs('#pgrid');
    const list=products.filter(p=>(!cat||p.category_id===cat)&&(!q||p.name.includes(q)||(p.barcode||'').includes(q))).slice(0,200);
    U.qs('#pcount').textContent = list.length? `${U.num(list.length)} منتج` : '';
    if(!list.length){ grid.innerHTML = `<div class="empty pos-empty">${U.icon(q?'fa-magnifying-glass':'fa-box-open')}<b>${q?'لا نتائج مطابقة':'لا منتجات هنا'}</b><small>${q?'جرّب كلمة أخرى أو امسح باركود المنتج مباشرة':'أضف منتجات من صفحة «المنتجات» لتظهر هنا فوراً'}</small></div>`; return; }
    grid.innerHTML = list.map(p=>{ const st=+p.stock, out=st<=0, low=!out&&st<=+(p.min_stock??5), ct=catMap.get(p.category_id);
      return `<div class="p-card ${out?'out':''}" data-id="${p.id}" tabindex="0" role="button" title="${U.esc(p.name)} — ${U.money(p.sale_price)}" style="--cat:${U.esc(ct?.color||'#6366f1')}">
        <div class="pimg">${p.image_url?`<img src="${U.esc(p.image_url)}" alt="" loading="lazy">`:`<span class="ph">${U.icon('fa-box-open')}</span>`}
          <span class="stk ${out?'danger':low?'warning':'success'}">${U.icon(out?'fa-circle-xmark':'fa-boxes-stacked')}<b>${U.num(st)}</b>${p.unit?`<small>${U.esc(p.unit)}</small>`:''}</span>
          ${out?`<span class="oos">نفد المخزون</span>`:''}</div>
        <div class="pinfo"><b>${U.esc(p.name)}</b>${p.barcode?`<span class="pbc" dir="ltr">${U.esc(p.barcode)}</span>`:''}
          <div class="prow"><span class="price">${U.money(p.sale_price)}</span>${ct?`<span class="pcat" title="${U.esc(ct.name)}">${U.catIcon(ct.icon,'fa-tag')} ${U.esc(ct.name)}</span>`:''}</div></div></div>`; }).join('');
    bindCards(grid); syncChips(); };
  const bindCards=grid=>{ U.qsa('.p-card',grid).forEach(el=>{ const act=()=>add(products.find(p=>p.id===el.dataset.id));
      el.onclick=act; el.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); act(); } }; }); };
  // شارة الكمية الموجودة في السلة فوق بطاقة المنتج
  const syncChips=()=>{ const m={}; cart.forEach(i=>m[i.id]=(m[i.id]||0)+i.qty);
    U.qsa('.p-card').forEach(el=>{ const q=m[el.dataset.id]||0; let b=el.querySelector('.in-cart');
      if(!q){ b?.remove(); return; }
      if(!b){ b=document.createElement('span'); b.className='in-cart'; el.querySelector('.pimg')?.appendChild(b); }
      if(b) b.innerHTML=`${U.icon('fa-cart-shopping')}<b>${U.num(q)}</b>`; }); };
  const add=(p,qty=1)=>{ if(!p) return; if(+p.stock<=0 && !STORE.allow_negative){ U.toast(`المنتج "${p.name}" غير متوفر بالمخزون`,'error'); return; }
    const it=cart.find(i=>i.id===p.id); if(it) it.qty+=qty; else cart.push({id:p.id,name:p.name,barcode:p.barcode,price:+p.sale_price,qty,stock:+p.stock,tax_rate:+p.tax_rate||0});
    beep(); renderCart(); };
  const beep=()=>{ try{ const a=new (window.AudioContext||window.webkitAudioContext)(); const o=a.createOscillator(); o.frequency.value=880; o.connect(a.destination); o.start(); o.stop(a.currentTime+.08);}catch(e){} };
  const calc=()=>{ const sub=cart.reduce((s,i)=>s+i.price*i.qty,0); let d=discount.type==='percent'?sub*discount.value/100:discount.value; d=Math.min(d,sub); const tax=(sub-d)*taxRate/100; return {sub,d,tax,total:sub-d+tax}; };
  const renderCart=()=>{ const box=U.qs('#cartItems');
    box.innerHTML = cart.length? cart.map((i,ix)=>`<div class="cart-item"><div><b>${U.esc(i.name)}</b><small>${U.money(i.price)} × ${i.qty} = <b>${U.money(i.price*i.qty)}</b></small></div>
      <div class="qty"><button data-a="-" data-i="${ix}">−</button><input type="number" value="${i.qty}" data-i="${ix}" min="0.001" step="any"><button data-a="+" data-i="${ix}">+</button></div><button class="icon-btn" data-del="${ix}" style="width:30px;height:30px;color:var(--danger)"><i class="fa-solid fa-xmark"></i></button></div>`).join('') : '<div class="empty"><i class="fa-solid fa-cart-shopping"></i>السلة فارغة</div>';
    U.qsa('.qty button',box).forEach(b=>b.onclick=()=>{const i=cart[b.dataset.i]; i.qty+=b.dataset.a==='+'?1:-1; if(i.qty<=0) cart.splice(b.dataset.i,1); renderCart();});
    U.qsa('.qty input',box).forEach(inp=>inp.onchange=()=>{cart[inp.dataset.i].qty=Math.max(U.toNum(inp.value,1),0.001); renderCart();});
    U.qsa('[data-del]',box).forEach(b=>b.onclick=()=>{cart.splice(b.dataset.del,1); renderCart();});
    const t=calc(); U.qs('#sub').textContent=U.money(t.sub); U.qs('#disc').textContent='- '+U.money(t.d); U.qs('#tax').textContent=U.money(t.tax); U.qs('#tot').textContent=U.money(t.total); calcChange(); syncChips(); };
  const calcChange=()=>{ const t=calc(); const paid=U.toNum(U.qs('#paid').value); U.qs('#change').textContent=U.money(pay==='credit'?0:Math.max(0,paid-t.total)); };
  U.qs('#paid').oninput=calcChange;
  U.qsa('.pay-methods button').forEach(b=>b.onclick=()=>{U.qsa('.pay-methods button').forEach(x=>x.classList.remove('active')); b.classList.add('active'); pay=b.dataset.p; calcChange();});
  U.qs('#discBtn').onclick=()=>formModal({title:'خصم على الفاتورة',fields:[{name:'type',label:'النوع',type:'select',options:[{value:'fixed',label:'مبلغ ثابت'},{value:'percent',label:'نسبة %'}]},{name:'value',label:'القيمة',type:'number',step:'0.01',min:0},{name:'code',label:'أو كود خصم',placeholder:'اختياري'}],values:discount,onSubmit:async d=>{
    if(d.code){ const {data:dc}=await db.from('discounts').select('*').eq('code',d.code).eq('is_active',true).maybeSingle(); if(!dc) throw new Error('كود الخصم غير صالح'); const t=calc(); if(t.sub<+dc.min_amount) throw new Error(`الحد الأدنى للفاتورة ${U.money(dc.min_amount)}`); discount={type:dc.type,value:+dc.value}; }
    else discount={type:d.type,value:Math.max(0,d.value)}; renderCart(); }});
  U.qs('#clearBtn').onclick=async()=>{ if(cart.length && await U.confirm('إفراغ السلة؟')){cart=[]; discount={type:'fixed',value:0}; renderCart();} };
  U.qs('#holdBtn').onclick=()=>{ if(!cart.length) return; const held=JSON.parse(localStorage.getItem('held')||'[]'); held.push({cart,at:Date.now()}); localStorage.setItem('held',JSON.stringify(held)); cart=[]; renderCart(); U.toast('تم تعليق الفاتورة'); showHeld(); };
  const showHeld=()=>{ const held=JSON.parse(localStorage.getItem('held')||'[]'); let b=U.qs('#heldBtn'); if(!held.length){ b?.remove(); return; } if(!b){ b=document.createElement('button'); b.id='heldBtn'; b.className='btn warning sm'; U.qs('.pos-products .flex').appendChild(b); }
    b.innerHTML=`<i class="fa-solid fa-pause"></i> معلّقة (${held.length})`; b.onclick=()=>{ const m=U.modal(`<ul class="list">${held.map((h,i)=>`<li class="flex between"><span>${h.cart.length} صنف · ${U.date(h.at)}</span><button class="btn sm" data-i="${i}">استرجاع</button></li>`).join('')}</ul>`,{title:'الفواتير المعلقة'});
      U.qsa('[data-i]',m).forEach(x=>x.onclick=()=>{ cart=held.splice(x.dataset.i,1)[0].cart; localStorage.setItem('held',JSON.stringify(held)); renderCart(); m.close(); showHeld(); }); }; };
  showHeld();
  U.qs('#addCust').onclick=()=>formModal({title:'زبون جديد',fields:[{name:'name',label:'الاسم',required:true},{name:'phone',label:'الهاتف'}],onSubmit:async d=>{const {data,error}=await db.from('customers').insert(d).select().single(); if(error) throw error; U.qs('#custSel').innerHTML+=`<option value="${data.id}" selected>${U.esc(data.name)}</option>`; U.toast('تمت إضافة الزبون');}});
  // الباركود / البحث
  const si=U.qs('#scanInput');
  si.addEventListener('keydown',e=>{ if(e.key!=='Enter') return; e.preventDefault(); const v=si.value.trim(); if(!v) return;
    let p=products.find(x=>x.barcode===U.cleanBarcode(v)); if(!p){ const l=products.filter(x=>x.name.includes(v)); if(l.length===1) p=l[0]; else if(l.length>1){ renderGrid('',v); si.select(); return; } }
    if(p){ add(p); si.value=''; toggleClear(); renderGrid(U.qs('#cats .active')?.dataset.c||''); } else { U.toast('باركود غير معروف: '+v,'error'); si.select(); } });
  const clr=U.qs('#scanClear');
  const toggleClear=()=>clr.classList.toggle('hidden', !si.value);
  // دالة بحث واحدة مؤجَّلة (debounce) تُنشأ مرة واحدة لا مع كل ضغطة
  const searchNow=U.debounce(()=>renderGrid(U.qs('#cats .active')?.dataset.c||'', si.value.trim()),200);
  clr.onclick=()=>{ si.value=''; toggleClear(); renderGrid(U.qs('#cats .active')?.dataset.c||''); si.focus(); };
  si.addEventListener('input',()=>{ toggleClear(); searchNow(); });
  document.addEventListener('keydown',e=>{ if(e.key==='F9'){e.preventDefault(); U.qs('#payBtn').click();} if(e.key==='F2'){e.preventDefault(); si.focus();} });
  // استقبال من الهاتف عبر Realtime
  const ch = db.channel('pos-scan').on('postgres_changes',{event:'INSERT',schema:'public',table:'scan_events'},async ({new:ev})=>{
    if(!U.qs('#liveScan').checked || ev.target!=='pos') return;
    let p=products.find(x=>x.barcode===ev.barcode);
    if(!p){ const {data}=await db.from('products').select('id,name,barcode,sale_price,stock,category_id,image_url,tax_rate').eq('barcode',ev.barcode).maybeSingle(); if(data){products.push(data); p=data;} }
    if(p){ add(p,+ev.quantity||1); U.toast(p.name,'info','fa-mobile-screen'); } else U.toast('باركود غير معروف من الهاتف: '+ev.barcode,'error');
    db.from('scan_events').update({consumed:true}).eq('id',ev.id).then(()=>{});
  }).subscribe(s=>{ U.qs('#rtDot').classList.toggle('off', s!=='SUBSCRIBED'); });
  // إتمام البيع
  U.qs('#payBtn').onclick=async()=>{ if(!cart.length) return U.toast('السلة فارغة','info'); const t=calc(); let paid=U.toNum(U.qs('#paid').value); const cid=U.qs('#custSel').value||null;
    if(pay==='credit' && !cid) return U.toast('اختر زبوناً للبيع الآجل','error');
    if(pay!=='credit'){ if(!paid) paid=t.total; if(paid<t.total-0.001) return U.toast('المبلغ المدفوع أقل من الإجمالي','error'); }
    const btn=U.qs('#payBtn'); U.loading(btn);
    const items=cart.map(i=>({product_id:i.id,product_name:i.name,barcode:i.barcode,quantity:i.qty,unit_price:i.price,discount:0,tax:0,total:+(i.price*i.qty).toFixed(2)}));
    const sale={customer_id:cid,shift_id:shift?.id||null,subtotal:t.sub,discount:t.d,tax:t.tax,total:t.total,paid:pay==='credit'?paid:Math.min(paid,t.total)+0,change_due:pay==='credit'?0:Math.max(0,paid-t.total),payment_method:pay,status:'completed'};
    const {data:sid,error}=await db.rpc('complete_sale',{p_sale:sale,p_items:items}); U.loading(btn,false);
    if(error) return U.toast('فشل: '+error.message,'error');
    U.log('sale','sales',sid,{total:t.total});
    const {data:sd}=await db.from('sales').select('sale_number').eq('id',sid).single();
    printReceipt(sd?.sale_number, sale, cart, t);
    cart=[]; discount={type:'fixed',value:0}; U.qs('#paid').value=''; renderCart(); U.toast('تم البيع بنجاح'); si.focus();
    // تحديث المخزون محلياً
    items.forEach(i=>{const p=products.find(x=>x.id===i.product_id); if(p) p.stock-=i.quantity;}); renderGrid(U.qs('#cats .active')?.dataset.c||'', si.value.trim()); };
  const printReceipt=(no,sale,items,t)=>{ if(STORE.auto_print===false) return;
    U.print(`<h2>${U.esc(STORE.name||'')}</h2><div class="c">${U.esc(STORE.address||'')}<br>${U.esc(STORE.phone||'')}</div><hr>
    <div>فاتورة رقم: <b>#${no}</b></div><div>التاريخ: ${U.date(new Date())}</div><div>الكاشير: ${U.esc(Auth.profile.full_name||'')}</div><hr>
    <table><tr><th>الصنف</th><th>ك</th><th>السعر</th><th>المجموع</th></tr>${items.map(i=>`<tr><td>${U.esc(i.name)}</td><td>${i.qty}</td><td>${(+i.price).toFixed(2)}</td><td>${(i.price*i.qty).toFixed(2)}</td></tr>`).join('')}</table><hr>
    <table><tr><td>المجموع</td><td>${U.money(t.sub)}</td></tr>${t.d?`<tr><td>الخصم</td><td>-${U.money(t.d)}</td></tr>`:''}${t.tax?`<tr><td>الضريبة</td><td>${U.money(t.tax)}</td></tr>`:''}<tr class="tot"><td>الإجمالي</td><td>${U.money(t.total)}</td></tr><tr><td>المدفوع</td><td>${U.money(sale.paid)}</td></tr><tr><td>الباقي</td><td>${U.money(sale.change_due)}</td></tr></table><hr>
    <div class="c">${U.esc(STORE.receipt_footer||'')}</div>`,`فاتورة #${no}`); };
  await load();
});
