let currentLang = localStorage.getItem('lang') || 'ru';
let translations = {};

async function loadTranslations() {
  try {
    const res = await fetch(`/locales/${currentLang}.json`);
    translations = await res.json();
  } catch (err) {
    console.error('Ошибка загрузки перевода:', err);
  }
}

function translatePage() {
  // Находим все элементы с атрибутом data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    // Разбиваем ключ по точкам (например, "nav.home" -> ["nav", "home"])
    const keys = key.split('.');
    let text = translations;
    
    for (const k of keys) {
      if (text) text = text[k];
    }
    
    if (text) {
      // Если это placeholder для input, меняем его
      if (el.tagName === 'INPUT' && el.hasAttribute('placeholder')) {
        el.placeholder = text;
      } else {
        el.textContent = text;
      }
    }

    if (el.hasAttribute('data-i18n-placeholder')) {
      el.placeholder = text;
    }

  });
}

async function changeLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
  await loadTranslations();
  translatePage();
  // Обновляем header, так как он генерируется через JS
  if (typeof initHeader === 'function') initHeader(); 
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
  await loadTranslations();
  translatePage();
});