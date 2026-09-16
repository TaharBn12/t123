initPage('التصنيفات', null, async (c)=>{
  c.innerHTML='<div id="grid" class="grid g4"></div>';
  const load=async()=>{ const [{data:cats},{data:prods}]=await Promise.all([db.from('categories').select('*').order('name'),db.from('products').select('category_id')]);
    const cnt={}; (prods||[]).forEach(p=>cnt[p.category_id]=(cnt[p.category_id]||0)+1);
    U.qs('#grid').innerHTML=`<div class="card center" style="cursor:pointer;border:2px dashed var(--primary);display:grid;place-items:center;min-height:140px" id="add"><div><i class="fa-solid fa-plus" style="font-size:30px;color:var(--primary)"></i><br><b>تصنيف جديد</b></div></div>`+(cats||[]).map(x=>`<div class="card" style="border-top:4px solid ${U.esc(x.color)};margin:0"><div class="flex between"><span style="font-size:32px">${U.esc(x.icon||'📦')}</span><div class="flex gap"><button class="icon-btn" data-e="${x.id}"><i class="fa-solid fa-pen"></i></button>${Auth.is('admin','manager')?`<button class="icon-btn" data-d="${x.id}" style="color:var(--danger)"><i class="fa-solid fa-trash"></i></button>`:''}</div></div><h3 class="mt">${U.esc(x.name)}</h3><small class="muted">${cnt[x.id]||0} منتج</small></div>`).join('');
    const fields=[{name:'name',label:'الاسم',required:true,max:60},{name:'icon',label:'أيقونة (إيموجي)',max:4,default:'📦'},{name:'color',label:'اللون',type:'color',default:'#6366f1'}];
    U.qs('#add').onclick=()=>formModal({title:'تصنيف جديد',fields,onSubmit:async d=>{const {error}=await db.from('categories').insert(d); if(error) throw error; U.toast('تمت الإضافة'); load();}});
    U.qsa('[data-e]').forEach(b=>b.onclick=()=>{const x=cats.find(y=>y.id===b.dataset.e); formModal({title:'تعديل',fields,values:x,onSubmit:async d=>{const {error}=await db.from('categories').update(d).eq('id',x.id); if(error) throw error; load();}});});
    U.qsa('[data-d]').forEach(b=>b.onclick=async()=>{ if(!await U.confirm('حذف التصنيف؟ ستبقى المنتجات بدون تصنيف')) return; await db.from('categories').delete().eq('id',b.dataset.d); load(); }); };
  load();
});
