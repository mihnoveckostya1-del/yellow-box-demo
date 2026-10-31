const messageBox = document.querySelector('#admin-message');
let csrfToken = '';
const weekdays = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const $ = (selector, root = document) => root.querySelector(selector);

function showSection() {
  const target = ['#appointments', '#schedule', '#content'].includes(location.hash) ? location.hash : '#appointments';
  document.querySelectorAll('.panel-section').forEach((section) => { section.hidden = `#${section.id}` !== target; });
  document.querySelectorAll('.dash-nav a').forEach((link) => {
    if (link.hash === target) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
}
window.addEventListener('hashchange', showSection);
showSection();

function message(text, isError = false) {
  messageBox.textContent = text;
  messageBox.style.color = isError ? '#7b2e13' : '#265d37';
}

async function api(url, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body) headers.set('Content-Type', 'application/json');
  if (options.method && !['GET', 'HEAD'].includes(options.method)) headers.set('X-CSRF-Token', csrfToken);
  const response = await fetch(url, { ...options, headers });
  const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (response.status === 401) { location.href = '/yellow-box-demo/demos/avtolyuks-2/admin/login.html'; throw new Error('Сеанс завершён. Войдите снова.'); }
  if (!response.ok) throw new Error(data.error || 'Не удалось выполнить запрос.');
  return data;
}

function formatDate(value) {
  return new Date(value).toLocaleString('ru-RU', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Vladivostok' });
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function loadBookings() {
  const date = $('#booking-filter-date').value;
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  const { bookings } = await api(`/api/admin/bookings${query}`);
  const list = $('#booking-list'); list.replaceChildren();
  if (!bookings.length) { list.append(element('div', 'empty-bookings', date ? 'На эту дату записей пока нет. Можно выбрать другой день или добавить визит вручную.' : 'Пока нет записей. Новые заявки с сайта появятся здесь.')); return; }
  const labels = { confirmed: 'Подтверждена', cancelled: 'Отменена', completed: 'Состоялась', no_show: 'Неявка' };
  for (const booking of bookings) {
    const card = element('article', 'booking-card');
    card.dataset.status = booking.status;
    const customer = element('div');
    customer.append(element('h3', '', booking.customer_name), element('p', '', booking.phone), element('p', 'booking-code', `№ ${booking.confirmation_code} · ${labels[booking.status] || booking.status}`));
    const details = element('div');
    details.append(element('p', '', formatDate(booking.starts_at)), element('p', '', booking.vehicle || 'Автомобиль не указан'), element('p', '', booking.problem || 'Комментарий не указан'));
    if (booking.private_note) details.append(element('p', '', `Заметка владельца: ${booking.private_note}`));
    const actions = element('div', 'booking-actions');
    const status = document.createElement('select');
    status.setAttribute('aria-label', `Статус записи ${booking.customer_name}`);
    for (const [value, label] of Object.entries(labels)) { const option = element('option', '', label); option.value = value; status.append(option); }
    status.value = booking.status;
    status.addEventListener('change', async () => {
      try { await api(`/api/admin/bookings/${booking.id}`, { method: 'PATCH', body: JSON.stringify({ status: status.value }) }); message('Статус записи сохранён.'); await loadBookings(); }
      catch (error) { status.value=booking.status; message(error.message, true); }
    });
    const date = document.createElement('input'); date.type = 'date'; date.value = formatDate(booking.starts_at).slice(-10).split('.').reverse().join('-'); date.setAttribute('aria-label', 'Новая дата');
    // ISO conversion keeps the date independent of the viewer locale.
    const local = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Vladivostok', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(booking.starts_at));
    const p = Object.fromEntries(local.map((part) => [part.type, part.value])); date.value = `${p.year}-${p.month}-${p.day}`;
    const time = document.createElement('input'); time.type = 'time'; time.value = `${p.hour}:${p.minute}`; time.setAttribute('aria-label', 'Новое время');
    const move = element('button', '', 'Перенести');
    move.addEventListener('click', async () => {
      try { await api(`/api/admin/bookings/${booking.id}`, { method: 'PATCH', body: JSON.stringify({ date: date.value, time: time.value }) }); message('Время визита изменено.'); await loadBookings(); }
      catch (error) { message(error.message, true); }
    });
    const note = document.createElement('textarea'); note.maxLength = 1000; note.placeholder = 'Заметка владельца'; note.setAttribute('aria-label', 'Частная заметка владельца'); note.value = booking.private_note || '';
    const saveNote = element('button', '', 'Сохранить заметку');
    saveNote.addEventListener('click', async () => {
      try { await api(`/api/admin/bookings/${booking.id}`, { method: 'PATCH', body: JSON.stringify({ privateNote: note.value }) }); message('Заметка сохранена.'); await loadBookings(); }
      catch (error) { message(error.message, true); }
    });
    const moveRow = element('div', 'reschedule-controls'); moveRow.append(date, time, move);
    actions.append(status, moveRow, note, saveNote);
    card.append(customer, details, actions); list.append(card);
  }
}

async function loadSettings() {
  const data = await api('/api/admin/settings');
  const form = $('#settings-form');
  form.elements.slotMinutes.value = data.slot_minutes;
  form.elements.horizonDays.value = data.booking_horizon_days;
  form.elements.leadMinutes.value = data.lead_minutes;
  const hours = $('#hours-editor'); hours.replaceChildren();
  for (const row of data.hours) {
    const item = element('div', 'hours-row'); item.dataset.weekday = row.weekday;
    item.append(element('strong', '', weekdays[row.weekday]));
    const open = document.createElement('input'); open.type = 'time'; open.value = row.open_time ? row.open_time.slice(0, 5) : '09:00'; open.setAttribute('aria-label', `${weekdays[row.weekday]} открытие`);
    const close = document.createElement('input'); close.type = 'time'; close.value = row.close_time ? row.close_time.slice(0, 5) : '20:00'; close.setAttribute('aria-label', `${weekdays[row.weekday]} закрытие`);
    const closedLabel = element('label'); const closed = document.createElement('input'); closed.type = 'checkbox'; closed.checked = !row.open_time; closed.className = 'closed-day'; closedLabel.append(closed, document.createTextNode('Выходной'));
    item.append(open, close, closedLabel); hours.append(item);
  }
}

async function loadContent() {
  const content = await api('/api/content');
  const root = new URL('../',location.href);
  const mediaDefaults=window.DEMO_MEDIA_DEFAULTS || {logoImage:'assets/yellow-box-logo.jpg',heroImage:'assets/workshop.jpg'};
  for (const [name,preview,fallback] of [['logoImage','#logo-preview',mediaDefaults.logoImage],['heroImage','#hero-preview',mediaDefaults.heroImage]]) {
    $('#content-form').elements[name].value = content[name] || fallback;
    $(preview).src = new URL(content[name] || fallback,root).href;
  }
  $('#content-form').elements.heroImageAlt.value = content.heroImageAlt || 'Фотография автосервиса';
  const brand = $('.dash-brand'); if (brand) { brand.replaceChildren(document.createTextNode(content.name), element('span', '', 'ПАНЕЛЬ ВЛАДЕЛЬЦА')); }
  const form = $('#content-form');
  for (const key of ['name', 'headlineTop', 'headlineBottom', 'phone', 'phoneHref', 'email', 'mapUrl', 'description', 'address', 'hoursLabel']) form.elements[key].value = content[key] || '';
  renderServices(content.services || []);
}

function renderServices(services) {
  const editor = $('#services-editor'); editor.replaceChildren();
  for (const service of services) {
    const row = element('div', 'service-row');
    const name = document.createElement('input'); name.value = service.name; name.maxLength = 120; name.placeholder = 'Название услуги'; name.setAttribute('aria-label', 'Название услуги');
    const price = document.createElement('input'); price.value = service.price; price.maxLength = 100; price.placeholder = 'Цена'; price.setAttribute('aria-label', 'Цена');
    const remove = element('button', '', '×'); remove.type = 'button'; remove.setAttribute('aria-label', 'Удалить услугу'); remove.addEventListener('click', () => row.remove());
    row.append(name, price, remove); editor.append(row);
  }
}

$('#booking-filter-date').addEventListener('change', () => loadBookings().catch((error) => message(error.message, true)));
$('#manual-booking-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  try { await api('/api/admin/bookings', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) }); form.reset(); message('Запись добавлена.'); await loadBookings(); }
  catch (error) { message(error.message, true); }
});
$('#block-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  try { await api('/api/admin/blocked-periods', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) }); form.reset(); message('Интервал закрыт.'); await loadBlocked(); }
  catch (error) { message(error.message, true); }
});

async function loadBlocked() {
  const { periods } = await api('/api/admin/blocked-periods'); const list = $('#blocked-list'); list.replaceChildren();
  for (const period of periods) {
    const row = element('div', 'blocked-item', `${formatDate(period.starts_at)} — ${formatDate(period.ends_at)}${period.reason ? ` · ${period.reason}` : ''}`);
    const remove = element('button', '', 'Открыть'); remove.type = 'button';
    remove.addEventListener('click', async () => { try { await api(`/api/admin/blocked-periods/${period.id}`, { method: 'DELETE' }); await loadBlocked(); message('Интервал снова доступен.'); } catch (error) { message(error.message, true); } });
    row.append(remove); list.append(row);
  }
  if (!periods.length) list.textContent = 'Закрытых интервалов нет.';
}

$('#settings-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const hours = [...$('#hours-editor').children].map((item) => ({
    weekday: Number(item.dataset.weekday),
    openTime: item.querySelector('.closed-day').checked ? null : item.querySelector('input[type="time"]').value,
    closeTime: item.querySelector('.closed-day').checked ? null : item.querySelectorAll('input[type="time"]')[1].value,
  }));
  try {
    await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify({ slotMinutes: Number(form.elements.slotMinutes.value), horizonDays: Number(form.elements.horizonDays.value), leadMinutes: Number(form.elements.leadMinutes.value), hours }) });
    message('Расписание сохранено.'); await loadBookings();
  } catch (error) { message(error.message, true); }
});

$('#add-service').addEventListener('click', () => {
  const services = [...$('#services-editor').querySelectorAll('.service-row')].map((row) => ({ name: row.children[0].value, price: row.children[1].value }));
  services.push({ name: '', price: '' }); renderServices(services); $('#services-editor').lastElementChild.firstElementChild.focus();
});
$('#content-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const content = Object.fromEntries(['name', 'headlineTop', 'headlineBottom', 'phone', 'phoneHref', 'email', 'mapUrl', 'description', 'address', 'hoursLabel'].map((key) => [key, form.elements[key].value]));
  for (const key of ['logoImage','heroImage','heroImageAlt']) content[key] = form.elements[key].value;
  content.services = [...$('#services-editor').querySelectorAll('.service-row')].map((row) => ({ name: row.children[0].value.trim(), price: row.children[1].value.trim() }));
  if (content.services.some((service) => !service.name || !service.price)) { message('Заполните название и цену каждой услуги.', true); return; }
  try { await api('/api/admin/content', { method: 'PUT', body: JSON.stringify(content) }); message('Сведения сохранены.'); }
  catch (error) { message(error.message, true); }
});

$('#logout-button').addEventListener('click', async () => {
  try { await api('/api/auth/logout', { method: 'POST', body: '{}' }); location.href = '/yellow-box-demo/demos/avtolyuks-2/admin/login.html'; }
  catch (error) { message(error.message, true); }
});

for (const [id,name,preview] of [['#logo-upload','logoImage','#logo-preview'],['#hero-upload','heroImage','#hero-preview']]) {
  $(id).addEventListener('change',async (event) => {
    const file = event.target.files[0]; if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5*1024*1024) { message('Выберите PNG, JPEG или WebP размером до 5 МБ.',true); event.target.value=''; return; }
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1,(name==='logoImage'?700:1400)/bitmap.width,(name==='logoImage'?400:1000)/bitmap.height);
      const canvas=document.createElement('canvas'); canvas.width=Math.max(1,Math.round(bitmap.width*scale)); canvas.height=Math.max(1,Math.round(bitmap.height*scale));
      canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height); bitmap.close();
      const value=canvas.toDataURL(name==='logoImage'?'image/png':'image/jpeg',.82);
      if (value.length>900000) throw new Error('Изображение слишком сложное. Выберите файл меньшего размера.');
      $('#content-form').elements[name].value=value; $(preview).src=value; message('Изображение подготовлено. Нажмите «Сохранить сведения».');
    } catch(error) { message(error.message || 'Не удалось открыть изображение.',true); }
  });
}

try {
  const me = await api('/api/auth/me'); csrfToken = me.csrfToken;
  await Promise.all([loadBookings(), loadSettings(), loadContent(), loadBlocked()]);
} catch (error) { message(error.message, true); }
