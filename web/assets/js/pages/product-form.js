initPage('بيانات المنتج', null, async (c)=>{
  const id=U.param('id'); const [{data:cats},{data:sups}]=await Promise.all([db.from('categories').select('id,name').order('name'),db.from('suppliers').select('id,name').order('name')]);
  let p={barcode:U.param('barcode')||'',unit:'قطعة',min_stock:5,is_active:true,tax_rate:0}; if(id){ const {data}=await db.from('products').select('*').eq('id',id).single(); if(!data) return c.innerHTML='<div class="empty">المنتج غير موجود</div>'; p=data; }
  const opt=(arr,v)=>`<option value="">- بدون -</option>`+(arr||[]).map(x=>`<option value="${x.id}" ${x.id===v?'selected':''}>${U.esc(x.name)}</option>`).join('');
  c.innerHTML=`<form id="pf" class="grid" style="grid-template-columns:2fr 1fr;align-items:start">
   <div><div class="card"><div class="card-head"><h3><i class="fa-solid fa-box"></i> المعلومات الأساسية</h3></div>
    <div class="form-row"><div class="form-group" style="grid-column:1/-1"><label>اسم المنتج *</label><input class="input" name="name" required maxlength="150" value="${U.esc(p.name||'')}"></div>
    <div class="form-group"><label>الباركود</label><div class="flex gap"><input class="input" name="barcode" id="bc" maxlength="64" value="${U.esc(p.barcode||'')}" style="direction:ltr"><button type="button" class="btn ghost" id="genBc" title="توليد"><i class="fa-solid fa-wand-magic-sparkles"></i></button></div></div>
    <div class="form-group"><label>التصنيف</label><select class="input" name="category_id">${opt(cats,p.category_id)}</select></div>
    <div class="form-group"><label>المورد</label><select class="input" name="supplier_id">${opt(sups,p.supplier_id)}</select></div>
    <div class="form-group"><label>الوحدة</label><select class="input" name="unit">${['قطعة','كغ','غرام','لتر','علبة','كرتون','متر','حبة'].map(u=>`<option ${p.unit===u?'selected':''}>${u}</option>`).join('')}</select></div>
    <div class="form-group" style="grid-column:1/-1"><label>الوصف</label><textarea class="input" name="description" maxlength="1000">${U.esc(p.description||'')}</textarea></div></div></div>
    <div class="card"><div class="card-head"><h3><i class="fa-solid fa-tags"></i> التسعير والمخزون</h3></div>
    <div class="form-row"><div class="form-group"><label>سعر التكلفة</label><input class="input" name="cost_price" type="number" step="0.01" min="0" value="${p.cost_price??0}" id="cost"></div>
    <div class="form-group"><label>سعر البيع *</label><input class="input" name="sale_price" type="number" step="0.01" min="0" required value="${p.sale_price??''}" id="sale"></div>
    <div class="form-group"><label>سعر الجملة</label><input class="input" name="wholesale_price" type="number" step="0.01" min="0" value="${p.wholesale_price??0}"></div>
    <div class="form-group"><label>هامش الربح</label><input class="input" id="margin" readonly></div>
    <div class="form-group"><label>المخزون الحالي</label><input class="input" name="stock" type="number" step="any" value="${p.stock??0}" ${id?'readonly title="عدّل المخزون من صفحة الجرد"':''}></div>
    <div class="form-group"><label>حد التنبيه</label><input class="input" name="min_stock" type="number" step="any" min="0" value="${p.min_stock??5}"></div>
    <div class="form-group"><label>الضريبة %</label><input class="input" name="tax_rate" type="number" step="0.01" min="0" max="100" value="${p.tax_rate??0}"></div>
    <div class="form-group"><label>تاريخ الانتهاء</label><input class="input" name="expiry_date" type="date" value="${p.expiry_date||''}"></div></div></div></div>
   <div><div class="card"><div class="card-head"><h3><i class="fa-solid fa-image"></i> الصورة</h3></div><div id="preview" style="height:180px;border-radius:12px;background:var(--bg);display:grid;place-items:center;font-size:50px;overflow:hidden;margin-bottom:10px">${p.image_url?`<img src="${U.esc(p.image_url)}" style="width:100%;height:100%;object-fit:cover">`:'📦'}</div>
    <input class="input" name="image_url" placeholder="رابط الصورة (https://...)" value="${U.esc(p.image_url||'')}" id="imgUrl"><small class="muted">أو</small><input type="file" id="imgFile" accept="image/*" class="input mt"><small class="muted">يتطلب Bucket باسم products في Supabase Storage</small></div>
    <div class="card"><div class="flex gap between mb"><label class="bold">المنتج نشط</label><label class="switch"><input type="checkbox" name="is_active" ${p.is_active?'checked':''}><span></span></label></div>
    <div class="center mb"><svg id="bcsvg"></svg></div>
    <button class="btn block lg success"><i class="fa-solid fa-floppy-disk"></i> ${id?'حفظ التعديلات':'إضافة المنتج'}</button>
    ${id?`<button type="button" class="btn block ghost mt" id="saveNew"><i class="fa-solid fa-copy"></i> حفظ كمنتج جديد</button>`:''}<a href="products.html" class="btn block ghost mt">رجوع</a></div></div></form>`;
  const calcM=()=>{const c=U.toNum(U.qs('#cost').value),s=U.toNum(U.qs('#sale').value); U.qs('#margin').value=c?`${((s-c)/c*100).toFixed(1)}% (${U.money(s-c)})`:U.money(s-c);}; U.qs('#cost').oninput=U.qs('#sale').oninput=calcM; calcM();
  const drawBc=()=>{ try{ const v=U.qs('#bc').value.trim(); if(v) JsBarcode('#bcsvg',v,{height:40,fontSize:12,margin:4}); else U.qs('#bcsvg').innerHTML=''; }catch(e){ U.qs('#bcsvg').innerHTML=''; } }; U.qs('#bc').oninput=drawBc; drawBc();
  U.qs('#genBc').onclick=()=>{ let s='200'+String(Date.now()).slice(-9); let sum=0; for(let i=0;i<12;i++) sum+=+s[i]*(i%2?3:1); U.qs('#bc').value=s+((10-sum%10)%10); drawBc(); };
  U.qs('#imgUrl').oninput=e=>U.qs('#preview').innerHTML=e.target.value?`<img src="${U.esc(e.target.value)}" style="width:100%;height:100%;object-fit:cover">`:'📦';
  U.qs('#imgFile').onchange=async e=>{ const f=e.target.files[0]; if(!f) return; if(f.size>2*1024*1024) return U.toast('الحجم الأقصى 2MB','error'); if(!f.type.startsWith('image/')) return U.toast('ملف غير صالح','error');
    const path=`${U.uid()}.${f.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g,'')}`; const {error}=await db.storage.from('products').upload(path,f); if(error) return U.toast('فشل الرفع: '+error.message,'error');
    const {data}=db.storage.from('products').getPublicUrl(path); U.qs('#imgUrl').value=data.publicUrl; U.qs('#imgUrl').dispatchEvent(new Event('input')); U.toast('تم رفع الصورة'); };
  const save=async(asNew)=>{ const d=U.formData(U.qs('#pf')); d.is_active=U.qs('[name=is_active]').checked; ['cost_price','sale_price','wholesale_price','stock','min_stock','tax_rate'].forEach(k=>d[k]=U.toNum(d[k])); ['category_id','supplier_id','expiry_date','image_url','barcode','description'].forEach(k=>{ if(!d[k]) d[k]=null; }); if(d.barcode) d.barcode=U.cleanBarcode(d.barcode);
    if(d.sale_price<0||d.cost_price<0) return U.toast('قيم غير صالحة','error');
    let r; if(id&&!asNew){ delete d.stock; d.updated_at=new Date().toISOString(); r=await db.from('products').update(d).eq('id',id).select().single(); } else { if(asNew) d.barcode=null; r=await db.from('products').insert(d).select().single(); if(!r.error && d.stock) db.from('stock_movements').insert({product_id:r.data.id,type:'adjustment',quantity:d.stock,notes:'رصيد افتتاحي'}).then(()=>{}); }
    if(r.error) return U.toast(r.error.code==='23505'?'الباركود مستخدم مسبقاً':r.error.message,'error');
    U.log(id&&!asNew?'update':'create','products',r.data.id,{name:d.name}); U.toast('تم الحفظ بنجاح'); setTimeout(()=>location.href=id&&!asNew?'products.html':`product-form.html?id=${r.data.id}`,600); };
  U.qs('#pf').onsubmit=e=>{e.preventDefault(); save(false);}; U.qs('#saveNew')&&(U.qs('#saveNew').onclick=()=>save(true));
});
