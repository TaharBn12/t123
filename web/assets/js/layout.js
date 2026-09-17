// الهيكل العام: الشريط الجانبي + الرأس + الثيم + بحث سريع
const NAV = [
  {sec:'الرئيسية'},
  {href:'dashboard.html', icon:'fa-gauge-high', label:'لوحة التحكم'},
  {href:'pos.html', icon:'fa-cash-register', label:'نقطة البيع'},
  {href:'scanner.html', icon:'fa-barcode', label:'استقبال المسح'},
  {sec:'المخزون'},
  {href:'products.html', icon:'fa-boxes-stacked', label:'المنتجات'},
  {href:'product-form.html', icon:'fa-plus-circle', label:'إضافة منتج'},
  {href:'categories.html', icon:'fa-tags', label:'التصنيفات'},
  {href:'inventory.html', icon:'fa-warehouse', label:'الجرد والمخزون'},
  {href:'stock-movements.html', icon:'fa-arrow-right-arrow-left', label:'حركات المخزون'},
  {href:'barcodes.html', icon:'fa-qrcode', label:'طباعة الباركود'},
  {sec:'المبيعات'},
  {href:'sales.html', icon:'fa-receipt', label:'الفواتير'},
  {href:'returns.html', icon:'fa-rotate-left', label:'المرتجعات'},
  {href:'customers.html', icon:'fa-users', label:'العملاء'},
  {href:'discounts.html', icon:'fa-percent', label:'الخصومات والعروض', roles:['admin','manager']},
  {sec:'المشتريات'},
  {href:'purchases.html', icon:'fa-truck-ramp-box', label:'المشتريات'},
  {href:'suppliers.html', icon:'fa-handshake', label:'الموردون'},
  {sec:'المالية'},
  {href:'shifts.html', icon:'fa-clock', label:'الورديات والصندوق'},
  {href:'expenses.html', icon:'fa-money-bill-wave', label:'المصروفات'},
  {href:'reports.html', icon:'fa-chart-line', label:'التقارير', roles:['admin','manager']},
  {sec:'النظام', roles:['admin','manager']},
  {href:'users.html', icon:'fa-user-shield', label:'المستخدمون', roles:['admin']},
  {href:'activity.html', icon:'fa-list-check', label:'سجل النشاط', roles:['admin','manager']},
  {href:'settings.html', icon:'fa-gear', label:'الإعدادات', roles:['admin','manager']},
  {href:'backup.html', icon:'fa-database', label:'النسخ الاحتياطي', roles:['admin']},
  {href:'profile.html', icon:'fa-user', label:'حسابي'},
];

function renderLayout(title){
  const cur = location.pathname.split('/').pop();
  const role = Auth.profile?.role;
  const nav = NAV.filter(n=>!n.roles || n.roles.includes(role)).map(n=> n.sec
    ? `<div class="nav-sec">${n.sec}</div>`
    : `<a href="${n.href}" class="nav-item ${cur===n.href?'active':''}"><i class="fa-solid ${n.icon}"></i><span>${n.label}</span></a>`).join('');
  const app = document.getElementById('app');
  app.innerHTML = `
  <aside class="sidebar" id="sidebar">
    <div class="brand"><div class="logo"><i class="fa-solid fa-cash-register"></i></div><div><b>${U.esc(STORE.name||APP_CONFIG.APP_NAME)}</b><small>نظام إدارة الكاشير</small></div></div>
    <nav class="nav">${nav}</nav>
    <div class="sidebar-foot"><div class="avatar">${U.esc((Auth.profile?.full_name||'م')[0])}</div><div class="grow"><b>${U.esc(Auth.profile?.full_name||'')}</b><small>${{admin:'مدير النظام',manager:'مشرف',cashier:'كاشير'}[role]||role}</small></div><button class="icon-btn" id="logoutBtn" title="خروج"><i class="fa-solid fa-right-from-bracket"></i></button></div>
  </aside>
  <div class="overlay" id="overlay"></div>
  <main class="main">
    <header class="topbar">
      <button class="icon-btn" id="menuBtn"><i class="fa-solid fa-bars"></i></button>
      <button class="icon-btn sidebar-toggle" id="railBtn" title="طيّ/توسيع القائمة"><i class="fa-solid fa-angles-right"></i></button>
      <h1 class="page-title">${U.esc(title)}</h1>
      <div class="grow"></div>
      <div class="quick-search"><i class="fa-solid fa-magnifying-glass"></i><input id="quickSearch" placeholder="بحث سريع عن منتج / باركود..."><div class="qs-results" id="qsResults"></div></div>
      <button class="icon-btn" id="themeBtn" title="الوضع الليلي"><i class="fa-solid fa-moon"></i></button>
      <button class="icon-btn" id="notifBtn" title="تنبيهات"><i class="fa-solid fa-bell"></i><span class="badge-dot" id="notifDot" hidden></span></button>
    </header>
    <section class="content" id="content"></section>
  </main>`;
  U.qs('#logoutBtn').onclick = Auth.logout;
  const closeDrawer = ()=>{ U.qs('#sidebar').classList.remove('open'); U.qs('#overlay').classList.remove('show'); };
  U.qs('#menuBtn').onclick = ()=>{ U.qs('#sidebar').classList.toggle('open'); U.qs('#overlay').classList.toggle('show'); };
  U.qs('#overlay').onclick = closeDrawer;
  // طيّ/توسيع الشريط الجانبي على سطح المكتب (يُحفظ بين الصفحات)
  const side = U.qs('#sidebar'), rail = U.qs('#railBtn');
  const setRail = mini=>{
    side.classList.toggle('mini', mini);
    document.body.classList.toggle('rail-hover', mini);
    rail.querySelector('i').className = `fa-solid ${mini?'fa-angles-left':'fa-angles-right'}`;
    localStorage.setItem('rail', mini?'1':'0');
  };
  setRail(localStorage.getItem('rail')==='1' && window.innerWidth>768);
  rail.onclick = ()=>setRail(!side.classList.contains('mini'));
  // إغلاق الدرج بمفتاح Esc + إبقاء العنصر النشط ظاهراً في القائمة
  document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ closeDrawer(); U.qs('#qsResults').innerHTML=''; } });
  U.qs('.nav-item.active')?.scrollIntoView({block:'nearest'});
  // الثيم
  const applyTheme = t=>{ document.documentElement.dataset.theme=t; localStorage.setItem('theme',t); U.qs('#themeBtn i').className = `fa-solid ${t==='dark'?'fa-sun':'fa-moon'}`; };
  applyTheme(localStorage.getItem('theme')||'light');
  U.qs('#themeBtn').onclick = ()=>applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
  // بحث سريع
  const qs = U.qs('#quickSearch'), res = U.qs('#qsResults');
  qs.addEventListener('input', U.debounce(async ()=>{
    const q = qs.value.trim(); if(q.length<2){ res.innerHTML=''; return; }
    const { data } = await db.from('products').select('id,name,barcode,sale_price,stock').or(`name.ilike.%${q.replace(/[%,()]/g,'')}%,barcode.ilike.%${U.cleanBarcode(q)}%`).limit(8);
    res.innerHTML = (data||[]).map(p=>`<a href="product-form.html?id=${p.id}"><b>${U.esc(p.name)}</b><small>${U.esc(p.barcode||'')} · ${U.money(p.sale_price)} · مخزون ${U.num(p.stock)}</small></a>`).join('') || '<div class="muted pad">لا نتائج</div>';
  }));
  document.addEventListener('click', e=>{ if(!e.target.closest('.quick-search')) res.innerHTML=''; });
  // تنبيهات نقص المخزون
  db.from('products').select('id,name,stock,min_stock').eq('is_active',true).then(({data})=>{
    const low = (data||[]).filter(p=>Number(p.stock)<=Number(p.min_stock));
    if(low.length) U.qs('#notifDot').hidden=false;
    U.qs('#notifBtn').onclick = ()=> U.modal(low.length? `<ul class="list">${low.map(p=>`<li><i class="fa-solid fa-triangle-exclamation" style="color:var(--warning)"></i> <b>${U.esc(p.name)}</b> — المخزون: ${U.num(p.stock)} (الحد: ${U.num(p.min_stock)})</li>`).join('')}</ul>` : '<p class="center muted pad">لا توجد تنبيهات</p>', {title:`تنبيهات المخزون (${low.length})`});
  });
  return U.qs('#content');
}
// تهيئة صفحة قياسية
async function initPage(title, roles, fn){
  try{ await Auth.require(roles); const c = renderLayout(title); await fn(c); }
  catch(e){ if(!['unauth','forbidden','disabled'].includes(e.message)){ console.error(e); U.toast(e.message||'خطأ غير متوقع','error'); } }
}
window.renderLayout = renderLayout; window.initPage = initPage;
