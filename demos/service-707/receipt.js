const state = document.querySelector('#receipt-state');
const details = document.querySelector('#receipt-details');
const retry = document.querySelector('#receipt-retry');
let token = location.hash.slice(1);
let loadVersion = 0;
const statusCopy = {
  confirmed: ['Вы записаны', 'Приходите к выбранному времени. Если планы изменились, позвоните в сервис.'],
  cancelled: ['Запись отменена', 'Эта запись больше не занимает время. Вы можете выбрать новый визит на сайте.'],
  completed: ['Визит состоялся', 'Спасибо за визит. Новую запись можно оформить на сайте.'],
  no_show: ['Визит пропущен', 'Свяжитесь с сервисом, чтобы договориться о новом времени.'],
};
async function loadReceipt() {
  const version = ++loadVersion;
  retry.hidden = true;
  details.hidden = true;
  document.querySelector('#receipt-link-wrap').hidden = true;
  document.querySelector('#receipt-feedback').textContent = '';
  state.textContent = 'Загружаем запись…';
  document.querySelector('.receipt-ticket').setAttribute('aria-busy', 'true');
  try {
    if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('В ссылке нет данных записи. Откройте сохранённую ссылку целиком или вернитесь на сайт.');
    const response = await fetch('/api/booking-receipt', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    const data = await response.json();
    if (version !== loadVersion) return;
    if (!response.ok) throw new Error(data.error || 'Не удалось загрузить запись.');
    const { booking, business, timezone } = data;
    try { localStorage.setItem(window.DEMO_BOOKING_KEY || 'lastBookingUrl', `/yellow-box-demo/demos/service-707/booking.html#${token}`); } catch { /* Link still works without storage. */ }
    document.querySelector('.receipt-brand').replaceChildren(document.createTextNode(business.name.toLocaleLowerCase()), Object.assign(document.createElement('span'), { textContent: '.' }));
    const [label, note] = statusCopy[booking.status] || ['Статус уточняется', 'Позвоните в сервис для уточнения записи.'];
    state.textContent = label; state.dataset.status = booking.status;
    document.querySelector('#receipt-code').textContent = `Запись № ${booking.confirmation_code}`;
    const date = new Date(booking.starts_at);
    document.querySelector('#receipt-date').textContent = date.toLocaleDateString('ru-RU', { timeZone: timezone, day: 'numeric', month: 'long' });
    document.querySelector('#receipt-time').textContent = date.toLocaleTimeString('ru-RU', { timeZone: timezone, hour: '2-digit', minute: '2-digit' });
    document.querySelector('#receipt-zone').textContent = date.toLocaleDateString('ru-RU', { timeZone: timezone, weekday: 'long', year: 'numeric' }) + ' · время сервиса';
    document.querySelector('#receipt-business').textContent = business.name;
    document.querySelector('#receipt-address').textContent = business.address;
    document.querySelector('#receipt-vehicle-row').hidden = !booking.vehicle;
    document.querySelector('#receipt-vehicle').textContent = booking.vehicle;
    document.querySelector('#receipt-status-note').textContent = note;
    const call = document.querySelector('#receipt-call'); call.href = `tel:${business.phoneHref}`; call.textContent = business.phone; call.hidden = false;
    const map = document.querySelector('#receipt-map');
    if (/^https:\/\//.test(business.mapUrl)) map.href = business.mapUrl; else map.hidden = true;
    details.hidden = false;
  } catch (error) { if (version === loadVersion) { details.hidden = true; state.textContent = error.message; retry.hidden = false; } }
  finally { if (version === loadVersion) document.querySelector('.receipt-ticket').setAttribute('aria-busy', 'false'); }
}
document.querySelector('#copy-receipt').addEventListener('click', async () => {
  const input = document.querySelector('#receipt-link'); input.value = location.href;
  document.querySelector('#receipt-link-wrap').hidden = false;
  try { await navigator.clipboard.writeText(location.href); document.querySelector('#receipt-feedback').textContent = 'Ссылка скопирована. Сохраните её в заметках или закладках.'; }
  catch { input.focus(); input.select(); document.querySelector('#receipt-feedback').textContent = 'Скопируйте ссылку из поля ниже и сохраните её.'; }
});
retry.addEventListener('click', loadReceipt);
window.addEventListener('hashchange', () => { token = location.hash.slice(1); loadReceipt(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) loadReceipt(); });
loadReceipt();
