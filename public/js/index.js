// index.js
async function loadServices() {
  const tbody = document.querySelector('#services-table tbody');
  try {
    const res = await fetch('/api/services');
    const data = await res.json();
    tbody.innerHTML = data.services
      .map(s => `<tr><td>${s.name}</td><td>${s.price} BYN</td><td>${s.duration}</td></tr>`)
      .join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="3">Ошибка загрузки</td></tr>';
  }
}

loadServices();