initPage('المنتجات', null, async (c)=>{
  const {data:cats}=await db.from('categories').select('id,name');
  let catF='', stockF='';
  c.innerHTML=`<div class="toolbar"><select class="input" id="catF"><option value="">كل التصنيفات</option>${(cats||[]).map(x=>`<option value="${x.id}">${U.esc(x.name)}</option>`).join('')}</select>
   <select class="input" id="stockF"><option value="">كل المخزون</option><option value="low">منخفض</option><option value="out">نافد</option></select>
   <div class="grow"></div><a href="barcodes.html" class="btn ghost"><i class="fa-solid fa-qrcode"></i> طباعة باركود</a><a href="product-form.html" class="btn"><i class="fa-solid fa-plus"></i> منتج جديد</a></div><div id="tbl"></div>`;
  const dt=new DataTable({el:U.qs('#tbl'),table:'products',select:'*,categories(name)',title:'قائمة المنتجات',search:['name','barcode'],order:'created_at',
    filters:()=>q=>{ if(catF) q=q.eq('category_id',catF); if(stockF==='out') q=q.lte('stock',0); if(stockF==='low') q=q.lte('stock',10); return q; },
    columns:[{label:'المنتج',render:r=>`<div class="flex gap"><div style="width:40px;height:40px;border-radius:8px;background:var(--bg);display:grid;place-items:center;overflow:hidden">${r.image_url?`<img src="${U.esc(r.image_url)}" style="width:100%;height:100%;object-fit:cover">`:'📦'}</div><div><b>${U.esc(r.name)}</b><br><small class="muted" style="direction:ltr">${U.esc(r.barcode||'')}</small></div></div>`,raw:r=>r.name},
      {label:'التصنيف',render:r=>U.esc(r.categories?.name||'-'),raw:r=>r.categories?.name},{label:'التكلفة',render:r=>U.money(r.cost_price),raw:r=>r.cost_price},{label:'سعر البيع',render:r=>`<b style="color:var(--primary)">${U.money(r.sale_price)}</b>`,raw:r=>r.sale_price},
      {label:'المخزون',render:r=>`<span class="badge ${+r.stock<=0?'danger':+r.stock<=+r.min_stock?'warning':'success'}">${U.num(r.stock)} ${U.esc(r.unit||'')}</span>`,raw:r=>r.stock},
      {label:'الحالة',render:r=>`<span class="badge ${r.is_active?'success':'muted'}">${r.is_active?'نشط':'موقوف'}</span>`,raw:r=>r.is_active?'نشط':'موقوف'}],
    actions:r=>`<a class="btn sm ghost" href="product-form.html?id=${r.id}"><i class="fa-solid fa-pen"></i></a><button class="btn sm ghost" data-copy="${r.id}" title="نسخ"><i class="fa-solid fa-copy"></i></button>${Auth.is('admin','manager')?`<button class="btn sm danger" data-del="${r.id}"><i class="fa-solid fa-trash"></i></button>`:''}`});
  dt.onLoaded=()=>{ U.qsa('[data-del]').forEach(b=>b.onclick=async()=>{ if(!await U.confirm('حذف هذا المنتج نهائياً؟')) return; const {error}=await db.from('products').delete().eq('id',b.dataset.del); if(error) return U.toast('لا يمكن الحذف (مرتبط بفواتير) - يمكنك إيقافه بدلاً من ذلك','error'); U.log('delete','products',b.dataset.del); U.toast('تم الحذف'); dt.load(); });
    U.qsa('[data-copy]').forEach(b=>b.onclick=async()=>{ const r=dt.rows.find(x=>x.id===b.dataset.copy); const {id,created_at,updated_at,categories,barcode,...rest}=r; const {error}=await db.from('products').insert({...rest,name:rest.name+' (نسخة)',barcode:null}); if(error) return U.toast(error.message,'error'); dt.load(); }); };
  U.qs('#catF').onchange=e=>{catF=e.target.value; dt.page=1; dt.load();}; U.qs('#stockF').onchange=e=>{stockF=e.target.value; dt.page=1; dt.load();};
});
