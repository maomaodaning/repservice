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
    // Гость
    navHtml = `
      <a href="/">Главная</a>
      <a href="/login.html">Войти</a>
      <a href="/register.html">Регистрация</a>
    `;
  } else if (user.role === 'client') {
    // Клиент
    navHtml = `
      <a href="/">Главная</a>
      <a href="/requests.html">Мои заявки</a>
      <a href="/create-request.html">Новая заявка</a>
      <span class="user-info">Клиент: <b>${user.login || 'ID ' + user.id}</b></span>
      <a href="#" onclick="logout(event)">Выйти</a>
    `;
  } else if (user.role === 'master') {
    // Мастер
    navHtml = `
      <a href="/">Главная</a>
      <a href="/master.html">Мои заявки</a>
      <span class="user-info">Мастер: <b>${user.login || 'ID ' + user.id}</b></span>
      <a href="#" onclick="logout(event)">Выйти</a>
    `;
  } else if (user.role === 'admin') {
    // Админ
    navHtml = `
      <a href="/">Главная</a>
      <a href="/admin.html">Панель управления</a>
      <span class="user-info">Админ: <b>${user.login || 'ID ' + user.id}</b></span>
      <a href="#" onclick="logout(event)">Выйти</a>
    `;
  }

  header.innerHTML = `
    <div class="nav-links">${navHtml}</div>
    <div class="version">v1.0</div>
  `;
}

async function logout(e) {
  if (e) e.preventDefault();
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login.html';
}

// Запускаем при загрузке страницы
document.addEventListener('DOMContentLoaded', initHeader);