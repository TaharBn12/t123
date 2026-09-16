// ============================================================
// جسر المسح بين الهاتف والموقع
// ------------------------------------------------------------
// تطبيق الهاتف يُدرج صفاً في جدول scan_events مع «وجهة» (target)،
// وكل صفحة في الموقع تشترك في Realtime وتستقبل وجهتها فقط.
// هكذا تصبح لكل صفحة تحتاج مسح باركود قناة خاصة بها:
//   pos       -> نقطة البيع (يُضاف للسلة)
//   product   -> إضافة/تعديل منتج (يملأ حقل الباركود)
//   purchase  -> فاتورة شراء (يضيف سطراً للفاتورة)
//   inventory -> الجرد (يفتح نافذة تعديل المخزون)
//   returns   -> المرتجعات (يبحث عن الفاتورة)
//   products  -> صفحة «استقبال المسح» العامة
// ============================================================
const ScanBridge = {
  TARGETS: {
    pos:       {label:'نقطة البيع',        icon:'fa-cash-register',  page:'pos.html'},
    product:   {label:'إضافة / تعديل منتج', icon:'fa-plus-circle',    page:'product-form.html'},
    purchase:  {label:'فاتورة شراء',       icon:'fa-truck-ramp-box', page:'purchases.html'},
    inventory: {label:'الجرد والمخزون',     icon:'fa-warehouse',      page:'inventory.html'},
    returns:   {label:'المرتجعات',         icon:'fa-rotate-left',    page:'returns.html'},
    products:  {label:'استقبال المسح',      icon:'fa-mobile-screen',  page:'scanner.html'},
  },
  meta(t){ return ScanBridge.TARGETS[t] || {label:t||'-', icon:'fa-mobile-screen', page:''}; },
  label(t){ return ScanBridge.meta(t).label; },

  /// شارة صغيرة تُوضع في شريط الأدوات: تُظهر الوجهة وحالة الاتصال
  pill(target, id='scanPill'){
    const m = ScanBridge.meta(target);
    return `<span class="scan-pill" id="${id}" title="الوجهة في تطبيق الهاتف: ${U.esc(m.label)}">`
      + `${U.icon(m.icon)} <span>استقبال من الهاتف: <b>${U.esc(m.label)}</b></span>`
      + `<span class="online" id="${id}Dot"></span></span>`;
  },

  /// جلب منتج بالباركود (موحّد لكل الصفحات)
  async productByBarcode(code){
    const bc = U.cleanBarcode(code);
    if(!bc) return null;
    const { data } = await db.from('products')
      .select('id,name,barcode,sale_price,cost_price,stock,min_stock,unit,image_url,category_id,is_active')
      .eq('barcode', bc).maybeSingle();
    return data || null;
  },

  /// تشغيل الاستقبال لوجهة واحدة. يُرجع كائناً فيه close() لإيقاف الاشتراك.
  /// onScan(barcode, ev) — ev هو الصف الكامل من scan_events
  connect({target, onScan, pillId='scanPill', toggle=null}){
    let closed = false;
    const setDot = ok => { const d = U.qs('#'+pillId+'Dot'); if(d) d.classList.toggle('off', !ok); };
    const ch = db.channel('scan-bridge-'+target)
      .on('postgres_changes', {event:'INSERT', schema:'public', table:'scan_events'}, async ({new:ev}) => {
        if(closed || !ev || ev.target !== target) return;
        if(toggle && !toggle.checked) return;              // الإيقاف المؤقت من الواجهة
        // نُعلّم الحدث كمُستهلك حتى لا تعالجه صفحة أخرى
        db.from('scan_events').update({consumed:true}).eq('id', ev.id).then(()=>{}, ()=>{});
        try { await onScan(U.cleanBarcode(ev.barcode), ev); }
        catch(e){ console.error('scan handler failed', e); }
      })
      .subscribe(status => setDot(status === 'SUBSCRIBED'));
    return {
      target,
      close(){ closed = true; try{ db.removeChannel(ch); }catch(e){} setDot(false); },
    };
  },

  /// ربط حقل إدخال بجهة المسح: أي باركود يُمسح من الهاتف يوضع في الحقل
  bindInput({target, input, pillId, onFilled}){
    if(!input) return {close(){}};
    return ScanBridge.connect({target, pillId, onScan: async (barcode, ev)=>{
      input.value = barcode;
      input.dispatchEvent(new Event('input', {bubbles:true}));
      const p = await ScanBridge.productByBarcode(barcode);
      U.toast(p ? `${p.name} — ${U.num(ev.quantity||1)} ${U.esc(p.unit||'')}` : 'باركود غير مسجّل: '+barcode,
              p ? 'success' : 'info', p ? 'fa-circle-check' : 'fa-barcode');
      if(onFilled) await onFilled(barcode, p, ev);
    }});
  },
};
window.ScanBridge = ScanBridge;
