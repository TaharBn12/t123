// حارس المصادقة + تحميل الملف الشخصي والصلاحيات
const Auth = {
  user: null, profile: null,
  async require(roles){
    const { data:{ session } } = await db.auth.getSession();
    if(!session){ location.replace(`${Auth.base()}login.html?next=${encodeURIComponent(location.pathname)}`); throw new Error('unauth'); }
    Auth.user = session.user;
    const { data } = await db.from('profiles').select('*').eq('id', session.user.id).single();
    Auth.profile = data || { role:'cashier', full_name: session.user.email };
    if(Auth.profile.is_active === false){ await db.auth.signOut(); location.replace(`${Auth.base()}login.html?err=disabled`); throw new Error('disabled'); }
    if(roles && !roles.includes(Auth.profile.role)){ U.toast('ليست لديك صلاحية الوصول لهذه الصفحة','error'); setTimeout(()=>location.replace(`${Auth.base()}pages/dashboard.html`),1200); throw new Error('forbidden'); }
    // تحميل إعدادات المتجر
    const { data:s } = await db.from('settings').select('value').eq('key','store').maybeSingle();
    window.STORE = s?.value || { currency:'د.ج', tax_rate:0, name:'متجري' };
    db.auth.onAuthStateChange((ev)=>{ if(ev==='SIGNED_OUT') location.replace(`${Auth.base()}login.html`); });
    return Auth.profile;
  },
  base(){ return location.pathname.includes('/pages/') ? '../' : './'; },
  is(...roles){ return roles.includes(Auth.profile?.role); },
  async logout(){ await U.log('logout','auth'); await db.auth.signOut(); }
};
window.Auth = Auth;
