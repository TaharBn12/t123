initPage('المشتريات', null, async (c)=>{
  const [{data:sups},{data:prods}]=await Promise.all([db.from('suppliers').select('id,name').order('name'),db.from('products').select('id,name,barcode,cost_price').eq('is_active',true).order('name')]);
  c.innerHTML=`<div class="toolbar"><div class="grow"></div><button class="btn" id="new"><i class="fa-solid fa-plus"></i> فاتورة شراء جديدة</button></div><div id="tbl"></div>`;
  const supF=U.param('supplier');
  const dt=new DataTable({el:U.qs('#tbl'),table:'purchases',select:'*,suppliers(name),profiles(full_name),purchase_items(quantity)',title:'سجل المشتريات',search:['invoice_ref'],filters:()=>q=>supF?q.eq('supplier_id',supF):q,
    columns:[{label:'التاريخ',render:r=>U.date(r.created_at),raw:r=>r.created_at},{label:'المورد',render:r=>`<b>${U.esc(r.suppliers?.name||'-')}</b>`,raw:r=>r.suppliers?.name},{label:'مرجع الفاتورة',key:'invoice_ref'},{label:'الأصناف',render:r=>r.purchase_items?.length||0,raw:r=>r.purchase_items?.length},{label:'الإجمالي',render:r=>`<b>${U.money(r.total)}</b>`,raw:r=>r.total},{label:'المدفوع',render:r=>U.money(r.paid),raw:r=>r.paid},{label:'المتبقي',render:r=>`<b style="color:${r.total-r.paid>0?'var(--danger)':'var(--success)'}">${U.money(r.total-r.paid)}</b>`,raw:r=>r.total-r.paid},{label:'بواسطة',render:r=>U.esc(r.profiles?.full_name||''),raw:r=>r.profiles?.full_name}],
    actions:r=>`<button class="btn sm ghost" data-v="${r.id}"><i class="fa-solid fa-eye"></i></button>`});
  dt.onLoaded=()=>U.qsa('[data-v]').forEach(b=>b.onclick=async()=>{ const {data}=await db.from('purchase_items').select('*,products(name)').eq('purchase_id',b.dataset.v); U.modal(`<div class="table-wrap"><table class="table"><thead><tr><th>الصنف</th><th>الكمية</th><th>التكلفة</th><th>المجموع</th></tr></thead><tbody>${(data||[]).map(i=>`<tr><td>${U.esc(i.products?.name||'')}</td><td>${U.num(i.quantity)}</td><td>${U.money(i.cost_price)}</td><td>${U.money(i.total)}</td></tr>`).join('')}</tbody></table></div>`,{title:'تفاصيل فاتورة الشراء'}); });
  const newPurchase=(draft=[])=>{ let lines=draft.length?draft:[{}]; let bridge=null;
    const m=U.modal(`<div class="form-row mb"><div class="form-group"><label>المورد</label><select class="input" id="sup"><option value="">- بدون -</option>${(sups||[]).map(s=>`<option value="${s.id}" ${s.id===supF?'selected':''}>${U.esc(s.name)}</option>`).join('')}</select></div><div class="form-group"><label>مرجع الفاتورة</label><input class="input" id="ref"></div></div>
      <div class="flex gap mb wrap"><input class="input" id="scan" placeholder="امسح باركود لإضافة صنف" style="direction:ltr">${ScanBridge.pill('purchase','scanPillP')}</div><div id="lines"></div><button class="btn ghost sm mb" id="addL"><i class="fa-solid fa-plus"></i> سطر</button>
      <div class="form-row"><div class="form-group"><label>الإجمالي</label><input class="input" id="tot" readonly></div><div class="form-group"><label>المدفوع</label><input class="input" id="paid" type="number" step="0.01" min="0"></div></div><label class="flex gap mb"><input type="checkbox" id="updCost" checked> تحديث سعر التكلفة في المنتجات</label><button class="btn success block" id="save"><i class="fa-solid fa-check"></i> حفظ واستلام البضاعة</button>`,{title:'فاتورة شراء جديدة', onClose:()=>{ try{ if(bridge) bridge.close(); }catch(e){} }});
    const dl=`<datalist id="pl">${(prods||[]).map(p=>`<option value="${U.esc(p.name)}">`).join('')}</datalist>`;
    const render=()=>{ m.querySelector('#lines').innerHTML=dl+`<table class="table"><thead><tr><th>الصنف</th><th style="width:100px">الكمية</th><th style="width:120px">التكلفة</th><th></th></tr></thead><tbody>${lines.map((l,i)=>`<tr><td><input class="input" list="pl" value="${U.esc(l.name||'')}" data-n="${i}" placeholder="اكتب اسم المنتج"></td><td><input class="input" type="number" step="any" min="0" value="${l.quantity||''}" data-q="${i}"></td><td><input class="input" type="number" step="0.01" min="0" value="${l.cost_price??''}" data-c="${i}"></td><td><button class="icon-btn" data-x="${i}"><i class="fa-solid fa-xmark"></i></button></td></tr>`).join('')}</tbody></table>`;
      U.qsa('[data-n]',m).forEach(i=>i.onchange=()=>{const p=prods.find(x=>x.name===i.value); lines[i.dataset.n].name=i.value; lines[i.dataset.n].product_id=p?.id; if(p&&!lines[i.dataset.n].cost_price){ lines[i.dataset.n].cost_price=+p.cost_price; render(); }});
      U.qsa('[data-q]',m).forEach(i=>i.oninput=()=>{lines[i.dataset.q].quantity=U.toNum(i.value); calc();}); U.qsa('[data-c]',m).forEach(i=>i.oninput=()=>{lines[i.dataset.c].cost_price=U.toNum(i.value); calc();}); U.qsa('[data-x]',m).forEach(b=>b.onclick=()=>{lines.splice(b.dataset.x,1); render();}); calc(); };
    const calc=()=>m.querySelector('#tot').value=U.money(lines.reduce((s,l)=>s+(l.quantity||0)*(l.cost_price||0),0));
    m.querySelector('#addL').onclick=()=>{lines.push({}); render();};
    m.querySelector('#scan').onkeydown=e=>{ if(e.key!=='Enter') return; const p=prods.find(x=>x.barcode===U.cleanBarcode(e.target.value)); if(!p) return U.toast('غير موجود','error'); const ex=lines.find(l=>l.product_id===p.id); if(ex) ex.quantity=(ex.quantity||0)+1; else { if(lines.length===1&&!lines[0].name) lines=[]; lines.push({product_id:p.id,name:p.name,quantity:1,cost_price:+p.cost_price}); } e.target.value=''; render(); };
    m.querySelector('#save').onclick=async()=>{ const valid=lines.filter(l=>l.product_id&&l.quantity>0); if(!valid.length) return U.toast('أضف أصنافاً صالحة','error'); const total=valid.reduce((s,l)=>s+l.quantity*(l.cost_price||0),0); const paid=Math.min(U.toNum(m.querySelector('#paid').value),total); const sup=m.querySelector('#sup').value||null; U.loading(m.querySelector('#save'));
      const {data:pu,error}=await db.from('purchases').insert({supplier_id:sup,user_id:Auth.user.id,invoice_ref:m.querySelector('#ref').value,total,paid}).select().single(); if(error) return U.toast(error.message,'error');
      await db.from('purchase_items').insert(valid.map(l=>({purchase_id:pu.id,product_id:l.product_id,quantity:l.quantity,cost_price:l.cost_price||0,total:l.quantity*(l.cost_price||0)})));
      for(const l of valid){ await db.rpc('adjust_stock',{p_product_id:l.product_id,p_qty:l.quantity,p_type:'purchase',p_ref:pu.id}); if(m.querySelector('#updCost').checked&&l.cost_price) await db.from('products').update({cost_price:l.cost_price}).eq('id',l.product_id); }
      if(sup&&total-paid>0){ const s=(await db.from('suppliers').select('balance').eq('id',sup).single()).data; await db.from('suppliers').update({balance:+(s?.balance||0)+total-paid}).eq('id',sup); }
      if(paid>0) await db.from('expenses').insert({title:`شراء بضاعة ${m.querySelector('#ref').value||''}`,category:'مشتريات',amount:paid,user_id:Auth.user.id});
      U.log('purchase','purchases',pu.id,{total}); U.toast('تم الاستلام وتحديث المخزون'); m.close(); dt.load(); }; render();
    // === قناة المسح الخاصة بفاتورة الشراء (تُغلق مع النافذة) ===
    bridge=ScanBridge.connect({target:'purchase', pillId:'scanPillP', onScan:async (barcode, ev)=>{
      const pr=prods.find(x=>x.barcode===barcode);
      if(!pr) return U.toast('باركود غير مسجّل: '+barcode,'error','fa-barcode');
      const qty=Math.max(U.toNum(ev.quantity,1),0.001);
      const ex=lines.find(l=>l.product_id===pr.id);
      if(ex) ex.quantity=(ex.quantity||0)+qty;
      else { if(lines.length===1&&!lines[0].name) lines=[]; lines.push({product_id:pr.id,name:pr.name,quantity:qty,cost_price:+pr.cost_price}); }
      render(); U.toast(`أُضيف ${pr.name} × ${U.num(qty)}`,'success','fa-cart-plus');
    }}); };
  U.qs('#new').onclick=()=>newPurchase();
  if(U.param('new')){ const d=JSON.parse(sessionStorage.getItem('purchaseDraft')||'[]'); sessionStorage.removeItem('purchaseDraft'); newPurchase(d); }
});
