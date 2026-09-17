// منطق صفحة الدخول / إنشاء الحساب / استعادة كلمة المرور
// (ملف خارجي لأن سياسة CSP لا تسمح بالسكربتات المضمّنة داخل HTML)
(function () {
  db.auth.getSession().then(({ data: { session } }) => { if (session) location.replace('pages/dashboard.html'); });

  if (U.param('err') === 'disabled') U.toast('تم تعطيل حسابك. تواصل مع المدير', 'error');

  // سنة حقوق النشر
  const y = U.qs('#year'); if (y) y.textContent = new Date().getFullYear();

  // إظهار/إخفاء كلمة المرور
  U.qsa('.pass-toggle').forEach(btn => btn.onclick = () => {
    const form = U.qs('#' + btn.dataset.for); if (!form) return;
    const inp = form.querySelector('[name=password]'); if (!inp) return;
    const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    btn.querySelector('i').className = `fa-solid ${show ? 'fa-eye-slash' : 'fa-eye'}`;
    inp.focus({ preventScroll: true });
  });

  // ترجمة رسائل أخطاء Supabase الشائعة
  const arAuthErr = (msg) => {
    const m = String(msg || '');
    if (/already registered|already been registered/i.test(m)) return 'هذا البريد مسجّل بالفعل، سجّل الدخول بدل ذلك';
    if (/password.*too weak|at least 6 characters/i.test(m)) return 'كلمة المرور قصيرة جداً (6 أحرف على الأقل)';
    if (/valid email/i.test(m)) return 'أدخل بريداً إلكترونياً صحيحاً';
    if (/rate limit|too many requests/i.test(m)) return 'محاولات كثيرة، انتظر قليلاً ثم أعد المحاولة';
    if (/fetch failed|network/i.test(m)) return 'تعذّر الاتصال بالخادم، تحقق من الإنترنت';
    return m || 'حدث خطأ غير متوقع';
  };
  window.__arAuthErr = arAuthErr;

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
    if (error) return U.toast(arAuthErr(error.message), 'error');
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
