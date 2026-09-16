// مكوّن جدول عام مع بحث وترقيم صفحات وتصدير
class DataTable {
  constructor({el, table, select='*', columns, search=[], order='created_at', asc=false, pageSize=20, filters=()=>q=>q, actions, title, onAdd, exportName}) {
    Object.assign(this, {el, table, select, columns, search, order, asc, pageSize, filters, actions, title, onAdd, exportName}); this.page=1; this.q=''; this.rows=[]; this.render();
  }
  render(){
    this.el.innerHTML = `<div class="card"><div class="card-head"><h3>${U.esc(this.title||'')}</h3><div class="flex gap wrap">
      <input class="input" id="dtSearch" placeholder="بحث..." style="width:220px">
      <button class="btn ghost sm" id="dtExport"><i class="fa-solid fa-file-csv"></i> تصدير</button>
      ${this.onAdd?`<button class="btn sm" id="dtAdd"><i class="fa-solid fa-plus"></i> إضافة</button>`:''}</div></div>
      <div id="dtFilters"></div><div class="table-wrap"><table class="table"><thead><tr>${this.columns.map(c=>`<th>${U.esc(c.label)}</th>`).join('')}${this.actions?'<th></th>':''}</tr></thead><tbody id="dtBody"></tbody></table></div><div class="pagination" id="dtPag"></div></div>`;
    U.qs('#dtSearch',this.el).addEventListener('input', U.debounce(e=>{this.q=e.target.value.trim(); this.page=1; this.load();}));
    U.qs('#dtExport',this.el).onclick=()=>U.exportCSV(this.rows.map(r=>{const o={}; this.columns.forEach(c=>o[c.label]=c.raw?c.raw(r):(r[c.key]??'')); return o;}), (this.exportName||this.table)+'.csv');
    if(this.onAdd) U.qs('#dtAdd',this.el).onclick=()=>this.onAdd();
    this.load();
  }
  async load(){
    const body = U.qs('#dtBody',this.el); body.innerHTML=`<tr><td colspan="${this.columns.length+1}" class="center pad"><i class="fa-solid fa-spinner fa-spin"></i></td></tr>`;
    let q = db.from(this.table).select(this.select,{count:'exact'});
    if(this.q && this.search.length){ const s=this.q.replace(/[%,()]/g,''); q = q.or(this.search.map(f=>`${f}.ilike.%${s}%`).join(',')); }
    q = this.filters()(q);
    const from=(this.page-1)*this.pageSize;
    const {data,count,error} = await q.order(this.order,{ascending:this.asc}).range(from, from+this.pageSize-1);
    if(error){ body.innerHTML=`<tr><td colspan="99" class="center" style="color:var(--danger)">${U.esc(error.message)}</td></tr>`; return; }
    this.rows=data||[]; this.count=count||0;
    body.innerHTML = this.rows.length ? this.rows.map(r=>`<tr data-id="${r.id}">${this.columns.map(c=>`<td>${c.render?c.render(r):U.esc(r[c.key]??'')}</td>`).join('')}${this.actions?`<td><div class="actions">${this.actions(r)}</div></td>`:''}</tr>`).join('')
      : `<tr><td colspan="99"><div class="empty"><i class="fa-solid fa-inbox"></i>لا توجد بيانات</div></td></tr>`;
    const pages=Math.ceil(this.count/this.pageSize); const pag=U.qs('#dtPag',this.el);
    pag.innerHTML = pages>1 ? Array.from({length:pages},(_,i)=>i+1).filter(p=>Math.abs(p-this.page)<3||p===1||p===pages).map(p=>`<button class="${p===this.page?'active':''}" data-p="${p}">${p}</button>`).join('') : '';
    U.qsa('button',pag).forEach(b=>b.onclick=()=>{this.page=+b.dataset.p; this.load();});
    this.onLoaded?.(this.rows);
  }
}
window.DataTable = DataTable;
// نموذج عام داخل نافذة
function formModal({title, fields, values={}, onSubmit, submitText='حفظ'}){
  const html = `<form id="fm">${fields.map(f=>{
    const v = values[f.name] ?? f.default ?? '';
    if(f.type==='select') return `<div class="form-group"><label>${U.esc(f.label)}</label><select class="input" name="${f.name}" ${f.required?'required':''}>${(f.options||[]).map(o=>`<option value="${U.esc(o.value)}" ${String(o.value)===String(v)?'selected':''}>${U.esc(o.label)}</option>`).join('')}</select></div>`;
    if(f.type==='textarea') return `<div class="form-group"><label>${U.esc(f.label)}</label><textarea class="input" name="${f.name}">${U.esc(v)}</textarea></div>`;
    if(f.type==='checkbox') return `<div class="form-group flex gap"><label class="switch"><input type="checkbox" name="${f.name}" ${v?'checked':''}><span></span></label><label>${U.esc(f.label)}</label></div>`;
    return `<div class="form-group"><label>${U.esc(f.label)}</label><input class="input" name="${f.name}" type="${f.type||'text'}" value="${U.esc(v)}" ${f.required?'required':''} ${f.step?`step="${f.step}"`:''} ${f.min!==undefined?`min="${f.min}"`:''} maxlength="${f.max||200}" placeholder="${U.esc(f.placeholder||'')}"></div>`;
  }).join('')}<button class="btn block" style="margin-top:8px"><i class="fa-solid fa-floppy-disk"></i> ${U.esc(submitText)}</button></form>`;
  const m = U.modal(html,{title});
  m.querySelector('#fm').onsubmit = async e=>{ e.preventDefault(); const d=U.formData(e.target);
    fields.forEach(f=>{ if(f.type==='checkbox') d[f.name]=e.target[f.name].checked; if(f.type==='number') d[f.name]=U.toNum(d[f.name]); if(d[f.name]==='' && f.nullable!==false) d[f.name]=null; });
    const btn=e.target.querySelector('button'); U.loading(btn);
    try{ await onSubmit(d); m.close(); }catch(err){ U.toast(err.message,'error'); } U.loading(btn,false); };
  return m;
}
window.formModal = formModal;
