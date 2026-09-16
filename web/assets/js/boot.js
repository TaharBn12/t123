// إعادة التوجيه حسب حالة الجلسة عند فتح الموقع
// (ملف خارجي لأن سياسة CSP لا تسمح بالسكربتات المضمّنة داخل HTML)
(function () {
  const go = (session) => location.replace(session ? 'pages/dashboard.html' : 'login.html');
  db.auth.getSession()
    .then(({ data: { session } }) => go(session))
    .catch(() => go(null));
})();
