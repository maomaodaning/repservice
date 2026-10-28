document.getElementById('request-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const message = document.getElementById('message');
  
  const body = {
    problem_description: form.problem_description.value,
    device: {
      type: form.device_type.value,
      brand: form.device_brand.value,
      model: form.device_model.value,
      serial_number: form.device_serial.value,
    },
  };

  try {
    const res = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    
    if (!res.ok) throw new Error(data.error?.message || 'Ошибка');
    
    message.textContent = `Заявка №${data.request.request_id} создана!`;
    message.style.color = 'green';
    form.reset();
  } catch (err) {
    message.textContent = err.message;
    message.style.color = 'red';
  }
});