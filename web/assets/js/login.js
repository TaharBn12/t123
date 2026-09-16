// منطق صفحة الدخول / إنشاء الحساب / استعادة كلمة المرور
// (ملف خارجي لأن سياسة CSP لا تسمح بالسكربتات المضمّنة داخل HTML)
(function () {
  db.auth.getSession().then(({ data: { session } }) => { if (session) location.replace('pages/dashboard.html'); });

  if (U.param('err') === 'disabled') U.toast('تم تعطيل حسابك. تواصل مع المدير', 'error');

  U.qsa('.tabs button').forEach(b => b.onclick = () => {
    U.qsa('.tabs button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    U.qs('#loginForm').classList.toggle('hidden', b.dataset.t !== 'login');
    U.qs('#signupForm').classList.toggle('hidden', b.dataset.t !== 'signup');
  });

  // حماية بسيطة من التخمين على مستوى الواجهة (الحماية الحقيقية في Supabase)
  let attempts = +sessionStorage.getItem('la') || 0;
  const fail = () => {
    attempts++;
    sessionStorage.setItem('la', attempts);
    if (attempts >= 5) setTimeout(() => { attempts = 0; sessionStorage.setItem('la', 0); }, 60000);
  };

  U.qs('#loginForm').onsubmit = async e => {
    e.preventDefault();
    if (attempts >= 5) return U.toast('محاولات كثيرة، انتظر دقيقة', 'error');
    const d = U.formData(e.target), btn = U.qs('#loginBtn');
    U.loading(btn);
    const { error } = await db.auth.signInWithPassword({ email: d.email, password: d.password });
    U.loading(btn, false);
    if (error) { fail(); return U.toast('بيانات الدخول غير صحيحة', 'error'); }
    attempts = 0; sessionStorage.setItem('la', 0);
    const next = U.param('next');
    location.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : 'pages/dashboard.html');
  };

  U.qs('#signupForm').onsubmit = async e => {
    e.preventDefault();
    const d = U.formData(e.target), btn = U.qs('#signupBtn');
    U.loading(btn);
    const { data, error } = await db.auth.signUp({ email: d.email, password: d.password, options: { data: { full_name: d.full_name } } });
    U.loading(btn, false);
    if (error) return U.toast(error.message, 'error');
    if (data.session) location.replace('pages/dashboard.html');
    else U.toast('تم إنشاء الحساب. تحقق من بريدك لتفعيله', 'info');
  };

  U.qs('#forgot').onclick = async e => {
    e.preventDefault();
    const email = U.qs('#loginForm [name=email]').value;
    if (!email) return U.toast('أدخل بريدك أولاً', 'info');
    const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname.replace('login.html', 'pages/profile.html') });
    if (error) return U.toast(error.message, 'error');
    U.toast('تم إرسال رابط الاستعادة', 'success');
  };
})();
