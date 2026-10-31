const form = document.querySelector('#booking-form');
const dateInput = document.querySelector('#booking-date');
const slotsBox = document.querySelector('#slot-list');
const selectedTime = document.querySelector('#booking-time');
const message = document.querySelector('#booking-message');
const phonePattern = /^[+\d()\s-]+$/;
try {
  const saved = localStorage.getItem(window.DEMO_BOOKING_KEY || 'lastBookingUrl');
  const savedUrl = saved ? new URL(saved, location.href) : null;
  if (savedUrl && savedUrl.origin === location.origin && savedUrl.pathname === new URL('booking.html', location.href).pathname && /^#[a-f0-9]{64}$/.test(savedUrl.hash)) {
    document.querySelectorAll('#my-booking-link, #my-booking-mobile').forEach((link) => { link.href = saved; link.hidden = false; });
  }
} catch { /* Saved links are optional when storage is unavailable. */ }

function dateString(date) {
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Vladivostok',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}

let slotsVersion = 0;
async function loadSlots() {
  const version = ++slotsVersion;
  selectedTime.value = '';
  slotsBox.replaceChildren();
  if (!dateInput.value) {
    slotsBox.textContent = 'Сначала выберите дату';
    return;
  }
  slotsBox.textContent = 'Загружаем время…';
  try {
    const response = await fetch(`/api/availability?date=${encodeURIComponent(dateInput.value)}`);
    const data = await response.json();
    if (version !== slotsVersion) return;
    if (data.minDate) dateInput.min = data.minDate;
    if (data.maxDate) dateInput.max = data.maxDate;
    if (!response.ok) throw new Error(data.error || 'Не удалось загрузить свободное время.');
    slotsBox.replaceChildren();
    if (!data.slots.length) {
      slotsBox.textContent = 'На эту дату свободного времени нет. Выберите другой день.';
      return;
    }
    for (const time of data.slots) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'slot-option';
      button.textContent = time;
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => {
        selectedTime.value = time;
        for (const sibling of slotsBox.querySelectorAll('.slot-option')) {
          sibling.classList.remove('is-selected');
          sibling.setAttribute('aria-pressed', 'false');
        }
        button.classList.add('is-selected');
        button.setAttribute('aria-pressed', 'true');
      });
      slotsBox.append(button);
    }
  } catch (error) {
    if (version !== slotsVersion) return;
    slotsBox.textContent = error.message;
  }
}

async function loadPublicContent() {
  try {
    const response = await fetch('/api/content');
    if (!response.ok) return;
    const content = await response.json();
    const mediaDefaults=window.DEMO_MEDIA_DEFAULTS || {logoImage:'assets/yellow-box-logo.jpg',heroImage:'assets/workshop.jpg'};
    const safeImage = value => typeof value === 'string' && (/^assets\/[\w.-]+\.(jpg|jpeg|png|webp)$/.test(value) || /^https:\/\//.test(value) || /^data:image\/(png|jpeg|webp);base64,/.test(value));
    document.querySelectorAll('.brand-logo').forEach((image) => {
      image.hidden=content.logoImage?.endsWith('blank.png');
      if (safeImage(content.logoImage)) image.src = content.logoImage;
      image.alt = content.name;
      image.onerror = () => { image.onerror = null; image.src = mediaDefaults.logoImage; };
    });
    document.querySelectorAll('.brand-name').forEach(node=>node.hidden=Boolean(content.logoImage && !content.logoImage.endsWith('blank.png')));
    const heroPhoto = document.querySelector('#hero-photo');
    if (heroPhoto) {
      const empty=!content.heroImage || content.heroImage.endsWith('blank.png'); heroPhoto.hidden=empty;
      const placeholder=document.querySelector('#hero-placeholder');if(placeholder)placeholder.hidden=!empty;
      if (safeImage(content.heroImage)) heroPhoto.src = content.heroImage;
      heroPhoto.alt = content.heroImageAlt || 'Фотография автосервиса';
      heroPhoto.onerror = () => { heroPhoto.onerror = null; heroPhoto.src = mediaDefaults.heroImage; };
    }
    const photoSource=document.querySelector('.hero-side-bottom > a');
    if (photoSource) photoSource.hidden=Boolean(content.heroImage && content.heroImage!=='assets/workshop.jpg');
    const photoName=document.querySelector('.hero-side-top > span:first-child');if(photoName)photoName.textContent=content.name;
    document.title = `${content.name} — автосервис во Владивостоке`;
    document.querySelectorAll('.brand-name').forEach(brandName=>brandName.replaceChildren(document.createTextNode(content.name), Object.assign(document.createElement('span'), { className: 'brand-dot', textContent: '.' })));
    const heroTitle = document.querySelector('#hero-title');
    if (heroTitle) {
      const lower = document.createElement('span'); lower.textContent = content.headlineBottom;
      heroTitle.replaceChildren(document.createTextNode(content.headlineTop), document.createElement('br'), lower);
    }
    const phoneHref = `tel:${content.phoneHref}`;
    document.querySelectorAll('.header-phone, .menu-call').forEach((node) => node.href = phoneHref);
    const headerPhone = document.querySelector('.header-phone');
    if (headerPhone) headerPhone.textContent = content.phone;
    const heroAddress = document.querySelector('.location-tag');
    if (heroAddress) heroAddress.lastChild.textContent = ` ${content.address}`;
    const contactAddress = document.querySelector('.contact-address > p');
    if (contactAddress) contactAddress.textContent = content.address;
    const contactRows = document.querySelectorAll('.contact-details > div');
    const hoursRow = [...contactRows].find((row) => row.firstElementChild?.textContent === 'График');
    if (hoursRow?.lastElementChild) hoursRow.lastElementChild.textContent = content.hoursLabel;
    const heroHours = document.querySelector('.hero-meta > span:first-child');
    if (heroHours) { heroHours.querySelector('strong').textContent = content.hoursLabel; heroHours.querySelector('small').textContent = 'график работы'; }
    const description = document.querySelector('.hero-description');
    if (description) description.textContent = content.description;
    document.querySelectorAll('a[href^="tel:"]').forEach((link) => {
      link.href = phoneHref;
      if (link.classList.contains('button') || link.closest('.contact-details')) link.textContent = content.phone;
    });
    document.querySelectorAll('a[href^="mailto:"]').forEach((link) => { link.href = `mailto:${content.email}`; link.textContent = content.email; });
    document.querySelectorAll('a[href*="/directions/points/"]').forEach((link) => { link.href = content.mapUrl; });
    const services = document.querySelector('.service-list');
    if (services && Array.isArray(content.services)) {
      services.replaceChildren(...content.services.map((item, index) => {
        const link = document.createElement('a'); link.href = '#prices';
        const no = document.createElement('span'); no.className = 'service-no'; no.textContent = String(index + 1).padStart(2, '0');
        const name = document.createElement('span'); name.className = 'service-title'; name.textContent = item.name;
        const arrow = document.createElement('span'); arrow.className = 'service-arrow'; arrow.setAttribute('aria-hidden', 'true'); arrow.textContent = '↗';
        link.append(no, name, arrow); return link;
      }));
      const priceList = document.querySelector('.price-list');
      if (priceList) priceList.replaceChildren(...content.services.map((item) => {
        const row = document.createElement('div'); row.className = 'price-row';
        const name = document.createElement('span'); name.className = 'price-name'; name.textContent = item.name;
        const dots = document.createElement('span'); dots.className = 'price-dots';
        const price = document.createElement('strong'); price.textContent = item.price;
        row.append(name, dots, price); return row;
      }));
    }
  } catch { /* The static page remains readable if the API is temporarily unavailable. */ }
}

const today = new Date();
const latest = new Date(today); latest.setDate(latest.getDate() + 30);
dateInput.min = dateString(today);
dateInput.max = dateString(latest);
dateInput.value = dateInput.min;
dateInput.addEventListener('change', () => { message.textContent = ''; loadSlots(); });
loadSlots();
loadPublicContent();

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = '';
  const data = Object.fromEntries(new FormData(form));
  if (!data.time) { message.textContent = 'Сначала выберите свободное время.'; return; }
  if (!phonePattern.test(data.phone.trim())) { message.textContent = 'Проверьте номер телефона.'; return; }
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  button.textContent = 'Оформляем запись…';
  try {
    const csrfResponse = await fetch('/api/auth/csrf', { cache: 'no-store' });
    if (!csrfResponse.ok) throw new Error('Не удалось соединиться с сервером. Повторите отправку.');
    const { token } = await csrfResponse.json();
    const response = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token }, body: JSON.stringify(data) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Не удалось создать запись.');
    message.textContent = `Вы записаны на ${new Date(result.startsAt).toLocaleString('ru-RU', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Vladivostok' })}. Номер записи: ${result.confirmationCode}.`;
    const receiptUrl = `/yellow-box-demo/demos/joyrider/booking.html#${result.receiptToken}`;
    try { localStorage.setItem(window.DEMO_BOOKING_KEY || 'lastBookingUrl', receiptUrl); } catch { /* Navigation also works without storage. */ }
    location.assign(receiptUrl);
  } catch (error) {
    message.textContent = error.message;
    message.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await loadSlots();
  } finally {
    button.disabled = false;
    button.innerHTML = 'Подтвердить запись <span aria-hidden="true">↗</span>';
  }
});
