initPage('لوحة التحكم', null, async (c)=>{
  const {data:s, error} = await db.rpc('dashboard_stats');
  if(error) U.toast('تعذر تحميل الإحصائيات: '+error.message,'error');
  const st = s||{};
  c.innerHTML = `
  <div class="grid g4 mb">
    <div class="stat"><div class="ic bg-primary"><i class="fa-solid fa-sack-dollar"></i></div><div><b>${U.money(st.today_sales)}</b><small>مبيعات اليوم (${U.num(st.today_count)} فاتورة)</small></div></div>
    <div class="stat"><div class="ic bg-success"><i class="fa-solid fa-calendar-check"></i></div><div><b>${U.money(st.month_sales)}</b><small>مبيعات الشهر</small></div></div>
    <div class="stat"><div class="ic bg-warning"><i class="fa-solid fa-triangle-exclamation"></i></div><div><b>${U.num(st.low_stock)}</b><small>منتجات منخفضة المخزون</small></div></div>
    <div class="stat"><div class="ic bg-danger"><i class="fa-solid fa-money-bill-transfer"></i></div><div><b>${U.money(st.today_expenses)}</b><small>مصروفات اليوم</small></div></div>
  </div>
  <div class="grid g3 mb">
    <a href="pos.html" class="stat" style="cursor:pointer"><div class="ic bg-info"><i class="fa-solid fa-cash-register"></i></div><div><b>فتح نقطة البيع</b><small>ابدأ عملية بيع جديدة</small></div></a>
    <a href="scanner.html" class="stat" style="cursor:pointer"><div class="ic bg-primary"><i class="fa-solid fa-barcode"></i></div><div><b>استقبال المسح</b><small>ربط ماسح الهاتف</small></div></a>
    <a href="product-form.html" class="stat" style="cursor:pointer"><div class="ic bg-success"><i class="fa-solid fa-plus"></i></div><div><b>إضافة منتج</b><small>${U.num(st.products)} منتج نشط</small></div></a>
  </div>
  <div class="grid g2">
    <div class="card"><div class="card-head"><h3><i class="fa-solid fa-chart-area"></i> مبيعات آخر 7 أيام</h3></div><div class="chart-box"><canvas id="weekChart"></canvas></div></div>
    <div class="card"><div class="card-head"><h3><i class="fa-solid fa-fire"></i> الأكثر مبيعاً (30 يوم)</h3></div><div id="topProducts"><i class="fa-solid fa-spinner fa-spin"></i></div></div>
    <div class="card"><div class="card-head"><h3><i class="fa-solid fa-clock-rotate-left"></i> آخر الفواتير</h3><a href="sales.html" class="btn ghost sm">الكل</a></div><div id="lastSales"></div></div>
    <div class="card"><div class="card-head"><h3><i class="fa-solid fa-box-open"></i> تنبيهات المخزون</h3><a href="inventory.html" class="btn ghost sm">الكل</a></div><div id="lowStock"></div></div>
  </div>`;
  const week = st.week||[];
  const dark = document.documentElement.dataset.theme==='dark';
  new Chart(U.qs('#weekChart'),{type:'bar',data:{labels:week.map(w=>new Date(w.d).toLocaleDateString('ar-DZ',{weekday:'short',day:'numeric'})),datasets:[{label:'المبيعات',data:week.map(w=>w.v),backgroundColor:'rgba(99,102,241,.7)',borderRadius:8}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,grid:{color:dark?'#1e293b':'#e2e8f0'}},x:{grid:{display:false}}}}});
  // الأكثر مبيعاً
  const since = new Date(Date.now()-30*864e5).toISOString();
  const {data:items} = await db.from('sale_items').select('product_name,quantity,total,sales!inner(created_at)').gte('sales.created_at',since).limit(2000);
  const agg={}; (items||[]).forEach(i=>{ agg[i.product_name]=agg[i.product_name]||{q:0,t:0}; agg[i.product_name].q+=+i.quantity; agg[i.product_name].t+=+i.total; });
  const top = Object.entries(agg).sort((a,b)=>b[1].q-a[1].q).slice(0,6); const max=top[0]?.[1].q||1;
  U.qs('#topProducts').innerHTML = top.length? top.map(([n,v])=>`<div class="mb"><div class="flex between"><b>${U.esc(n)}</b><span class="muted">${U.num(v.q)} · ${U.money(v.t)}</span></div><div class="progress"><span style="width:${v.q/max*100}%"></span></div></div>`).join('') : '<div class="empty">لا مبيعات بعد</div>';
  const {data:ls} = await db.from('sales').select('id,sale_number,total,payment_method,created_at,customers(name)').order('created_at',{ascending:false}).limit(6);
  U.qs('#lastSales').innerHTML = (ls||[]).length ? `<ul class="list">${ls.map(s=>`<li class="flex between"><a href="sale-details.html?id=${s.id}"><b>#${s.sale_number}</b> <small class="muted">${U.esc(s.customers?.name||'زبون عام')} · ${U.date(s.created_at)}</small></a><b style="color:var(--primary)">${U.money(s.total)}</b></li>`).join('')}</ul>` : '<div class="empty">لا فواتير</div>';
  const {data:low} = await db.from('products').select('id,name,stock,min_stock').eq('is_active',true).order('stock').limit(30);
  const l2=(low||[]).filter(p=>+p.stock<=+p.min_stock).slice(0,6);
  U.qs('#lowStock').innerHTML = l2.length? `<ul class="list">${l2.map(p=>`<li class="flex between"><a href="product-form.html?id=${p.id}">${U.esc(p.name)}</a><span class="badge ${+p.stock<=0?'danger':'warning'}">${U.num(p.stock)} ${+p.stock<=0?'نفد':'منخفض'}</span></li>`).join('')}</ul>` : `<div class="empty">${U.icon('fa-circle-check')}المخزون بحالة جيدة</div>`;
});
