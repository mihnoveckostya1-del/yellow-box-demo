const message = document.querySelector('#login-message');
let csrfToken = '';

async function refreshCsrf() {
  const response = await fetch('/api/auth/csrf');
  const data = await response.json();
  csrfToken = data.token;
}

async function submitForm(form, endpoint) {
  message.textContent = '';
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    const response = await fetch(`/api/auth/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Не удалось выполнить вход.');
    location.href = '/yellow-box-demo/admin/dashboard.html';
  } catch (error) { message.textContent = error.message; }
  finally { button.disabled = false; }
}

document.querySelector('#login-tab').addEventListener('click', () => {
  document.querySelector('#login-form').hidden = false; document.querySelector('#setup-form').hidden = true;
  document.querySelector('#login-tab').classList.add('active'); document.querySelector('#setup-tab').classList.remove('active'); message.textContent = '';
});
document.querySelector('#setup-tab').addEventListener('click', () => {
  document.querySelector('#login-form').hidden = true; document.querySelector('#setup-form').hidden = false;
  document.querySelector('#setup-tab').classList.add('active'); document.querySelector('#login-tab').classList.remove('active'); message.textContent = '';
});
document.querySelector('#login-form').addEventListener('submit', (event) => { event.preventDefault(); submitForm(event.currentTarget, 'login'); });
document.querySelector('#setup-form').addEventListener('submit', (event) => { event.preventDefault(); submitForm(event.currentTarget, 'setup'); });
refreshCsrf().catch(() => { message.textContent = 'Не удалось соединиться с сервером. Обновите страницу.'; });
