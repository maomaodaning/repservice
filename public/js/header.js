//header.js
async function initHeader() {
  const header = document.querySelector('header');
  if (!header) return;

  // Получаем текущего пользователя
  let user = null;
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    user = data.user;
  } catch (err) {
    console.error('Ошибка получения пользователя', err);
  }

  // Строим навигацию
  let navHtml = '';
  
  if (!user) {
    navHtml = `
      <a href="/" data-i18n="nav.home">Главная</a>
      <a href="/login.html" data-i18n="nav.login">Войти</a>
      <a href="/register.html" data-i18n="nav.register">Регистрация</a>
    `;
  } else if (user.role === 'client') {
    navHtml = `
      <a href="/" data-i18n="nav.home">Главная</a>
      <a href="/requests.html" data-i18n="nav.my_requests">Мои заявки</a>
      <a href="/create-request.html" data-i18n="nav.new_request">Новая заявка</a>
      <span class="user-info">Клиент: <b>${user.login || 'ID ' + user.id}</b></span>
      <a href="#" onclick="logout(event)" data-i18n="nav.logout">Выйти</a>
    `;
  } else if (user.role === 'master') {
    navHtml = `
      <a href="/" data-i18n="nav.home">Главная</a>
      <a href="/master.html" data-i18n="nav.my_requests">Мои заявки</a>
      <span class="user-info">Мастер: <b>${user.login || 'ID ' + user.id}</b></span>
      <a href="#" onclick="logout(event)" data-i18n="nav.logout">Выйти</a>
    `;
  } else if (user.role === 'admin') {
    navHtml = `
      <a href="/" data-i18n="nav.home">Главная</a>
      <a href="/admin.html" data-i18n="nav.admin_panel">Панель управления</a>
      <span class="user-info">Админ: <b>${user.login || 'ID ' + user.id}</b></span>
      <a href="#" onclick="logout(event)" data-i18n="nav.logout">Выйти</a>
    `;
  }

  header.innerHTML = `
    <div class="nav-links">${navHtml}</div>
    <div style="display: flex; gap: 15px; align-items: center;">
      <div class="lang-switcher" style="font-size: 13px; display: flex; gap: 5px;">
        <a href="#" onclick="changeLanguage('ru'); return false;" style="text-decoration: none; color: ${localStorage.getItem('lang') === 'ru' || !localStorage.getItem('lang') ? '#2980b9' : '#7f8c8d'}; font-weight: ${localStorage.getItem('lang') === 'ru' || !localStorage.getItem('lang') ? 'bold' : 'normal'};">RU</a>
        <a href="#" onclick="changeLanguage('en'); return false;" style="text-decoration: none; color: ${localStorage.getItem('lang') === 'en' ? '#2980b9' : '#7f8c8d'}; font-weight: ${localStorage.getItem('lang') === 'en' ? 'bold' : 'normal'};">EN</a>
        <a href="#" onclick="changeLanguage('zh'); return false;" style="text-decoration: none; color: ${localStorage.getItem('lang') === 'zh' ? '#2980b9' : '#7f8c8d'}; font-weight: ${localStorage.getItem('lang') === 'zh' ? 'bold' : 'normal'};">中文</a>
      </div>
      <div class="version">v1.0</div>
    </div>
  `;

  // Переводим текст в хедере сразу после его рендера
  if (typeof translatePage === 'function') translatePage();
}

async function logout(e) {
  if (e) e.preventDefault();
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login.html';
}

document.addEventListener('DOMContentLoaded', initHeader);