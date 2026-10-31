(() => {
  const nativeFetch = window.fetch.bind(window);
  const storageKey = 'yellow-box-pages-demo-v1';
  const tomorrow = new Date(Date.now()+86400000).toLocaleDateString('en-CA',{timeZone:'Asia/Vladivostok'});
  const initial = {
    content:window.DEMO_CONTENT,
    settings:{timezone:'Asia/Vladivostok',slot_minutes:60,booking_horizon_days:30,lead_minutes:120,hours:Array.from({length:7},(_,weekday)=>({weekday,open_time:'09:00:00',close_time:'20:00:00'}))},
    bookings:[{id:1,confirmation_code:'DEMO0001',customer_name:'Демонстрационный клиент',phone:'+7 (000) 000-00-00',vehicle:'Демоавтомобиль',problem:'Пример визита на диагностику',private_note:'',starts_at:`${tomorrow}T10:00:00+10:00`,ends_at:`${tomorrow}T11:00:00+10:00`,status:'confirmed'}],
    periods:[],tokens:{},
  };
  let state = initial;
  try { state = JSON.parse(localStorage.getItem(storageKey)) || initial; } catch {}
  state.content={...initial.content,...state.content};
  const save = () => { try { localStorage.setItem(storageKey,JSON.stringify(state)); } catch { throw new Error('Браузер не смог сохранить демо-данные. Разрешите локальное хранилище или освободите место и повторите действие.'); } };
  const localDate = value => new Date(value).toLocaleDateString('en-CA',{timeZone:'Asia/Vladivostok'});
  const localTime = value => new Date(value).toLocaleTimeString('en-GB',{timeZone:'Asia/Vladivostok',hour:'2-digit',minute:'2-digit'});
  function getSlots(date,excludeId=null) {
    const today=localDate(Date.now()), last=localDate(Date.now()+state.settings.booking_horizon_days*86400000);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || date<today || date>last) return [];
    const day=state.settings.hours.find(h=>h.weekday===new Date(`${date}T12:00:00Z`).getUTCDay());
    const minutes=t=>Number(t.slice(0,2))*60+Number(t.slice(3,5));
    const slots=[], duration=state.settings.slot_minutes;
    if (day?.open_time) for (let n=minutes(day.open_time); n+duration<=minutes(day.close_time); n+=duration) {
      const time=`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
      const start=new Date(`${date}T${time}:00+10:00`).getTime(),end=start+duration*60000;
      if (start<Date.now()+state.settings.lead_minutes*60000) continue;
      if (![...state.bookings.filter(b=>b.status==='confirmed' && b.id!==excludeId),...state.periods].some(b=>start<new Date(b.ends_at).getTime() && end>new Date(b.starts_at).getTime())) slots.push(time);
    }
    return slots;
  }
  const result = (data,status=200) => Promise.resolve(new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}}));
  window.fetch = (input,options={}) => {
    const url = new URL(typeof input === 'string' ? input : input.url,location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith('/api/')) return nativeFetch(input,options);
    try { state=JSON.parse(localStorage.getItem(storageKey)) || state; } catch {}
    state.content={...initial.content,...state.content};
    const path=url.pathname, method=options.method || 'GET';
    const body=options.body ? JSON.parse(options.body) : {};
    if (path==='/api/auth/csrf') return result({token:'static-demo'});
    if (path==='/api/auth/me') return result({username:'Демо-владелец',csrfToken:'static-demo'});
    if (path==='/api/auth/logout') return result({ok:true});
    if (path==='/api/content') return result(state.content);
    if (path==='/api/availability') {
      const date=url.searchParams.get('date');
      return result({slots:getSlots(date),timezone:'Asia/Vladivostok',slotMinutes:state.settings.slot_minutes,minDate:localDate(Date.now()),maxDate:localDate(Date.now()+state.settings.booking_horizon_days*86400000)});
    }
    if ((path==='/api/bookings' || path==='/api/admin/bookings') && method==='POST') {
      if (!getSlots(body.date).includes(body.time)) return result({error:'Это время уже занято или недоступно. Выберите другой слот.'},409);
      const id=Date.now(), starts_at=`${body.date}T${body.time}:00+10:00`;
      const booking={...initial.bookings[0],id,confirmation_code:`DEMO${String(id).slice(-6)}`,starts_at,ends_at:new Date(new Date(starts_at).getTime()+state.settings.slot_minutes*60000).toISOString(),status:'confirmed'};
      state.bookings.push(booking);
      const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
      state.tokens[token]=id; save();
      return result({id,confirmationCode:booking.confirmation_code,confirmation_code:booking.confirmation_code,startsAt:starts_at,receiptToken:token},201);
    }
    if (path==='/api/booking-receipt') {
      const token=new Headers(options.headers).get('Authorization')?.replace('Bearer ','');
      const booking=state.bookings.find(b=>b.id===state.tokens[token]);
      return booking ? result({booking,business:state.content,timezone:'Asia/Vladivostok'}) : result({error:'Демонстрационная запись не найдена в этом браузере. Создайте её заново на сайте.'},404);
    }
    if (path==='/api/admin/bookings' && method==='GET') return result({bookings:state.bookings.filter(b=>!url.searchParams.get('date') || new Date(b.starts_at).toLocaleDateString('en-CA',{timeZone:'Asia/Vladivostok'})===url.searchParams.get('date'))});
    if (/^\/api\/admin\/bookings\/\d+$/.test(path) && method==='PATCH') {
      const booking=state.bookings.find(b=>String(b.id)===path.split('/').pop());
      if (!booking) return result({error:'Запись не найдена.'},404);
      if (body.date && body.time && !getSlots(body.date,booking.id).includes(body.time)) return result({error:'Перенос невозможен: время занято или закрыто.'},409);
      if (body.status==='confirmed' && booking.status!=='confirmed' && !body.date && !getSlots(localDate(booking.starts_at),booking.id).includes(localTime(booking.starts_at))) return result({error:'Нельзя подтвердить запись: время занято или закрыто.'},409);
      if (body.status) booking.status=body.status;
      if (body.date && body.time) { booking.starts_at=`${body.date}T${body.time}:00+10:00`; booking.ends_at=new Date(new Date(booking.starts_at).getTime()+state.settings.slot_minutes*60000).toISOString(); }
      if (body.privateNote!==undefined) booking.private_note=body.privateNote;
      save(); return result(booking);
    }
    if (path==='/api/admin/content') { state.content=body; save(); return result(body); }
    if (path==='/api/admin/settings') {
      if (method==='PUT' && (!Array.isArray(body.hours) || !Number.isInteger(body.slotMinutes) || body.slotMinutes<15 || body.slotMinutes>480 || !Number.isInteger(body.horizonDays) || body.horizonDays<1 || body.horizonDays>90 || !Number.isInteger(body.leadMinutes) || body.leadMinutes<0)) return result({error:'Проверьте параметры расписания.'},400);
      if (method==='PUT' && state.bookings.some(b=>{
        if(b.status!=='confirmed' || new Date(b.starts_at)<=new Date())return false;
        const day=body.hours.find(h=>h.weekday===new Date(`${localDate(b.starts_at)}T12:00:00Z`).getUTCDay());
        return !day?.openTime || day.openTime>localTime(b.starts_at) || day.closeTime<localTime(b.ends_at);
      })) return result({error:'Сначала перенесите или отмените будущие записи вне нового графика.'},409);
      if (method==='PUT') { Object.assign(state.settings,{slot_minutes:body.slotMinutes,booking_horizon_days:body.horizonDays,lead_minutes:body.leadMinutes,hours:body.hours.map(h=>({weekday:h.weekday,open_time:h.openTime,close_time:h.closeTime}))}); save(); }
      return result(state.settings);
    }
    if (path==='/api/admin/blocked-periods') {
      if (method==='POST' && state.bookings.some(b=>b.status==='confirmed' && new Date(b.starts_at)<new Date(`${body.date}T${body.to}:00+10:00`) && new Date(b.ends_at)>new Date(`${body.date}T${body.from}:00+10:00`))) return result({error:'На это время уже есть запись. Сначала перенесите или отмените её.'},409);
      if (method==='POST') { state.periods.push({id:Date.now(),starts_at:`${body.date}T${body.from}:00+10:00`,ends_at:`${body.date}T${body.to}:00+10:00`,reason:body.reason}); save(); }
      return result({periods:state.periods});
    }
    if (path.startsWith('/api/admin/blocked-periods/') && method==='DELETE') { state.periods=state.periods.filter(p=>String(p.id)!==path.split('/').pop()); save(); return result({ok:true}); }
    return result({error:'Эта функция доступна в серверной версии.'},404);
  };
  document.addEventListener('DOMContentLoaded',()=>{
    const banner=document.createElement('div');
    banner.style.cssText='padding:14px 5%;background:#171816;color:#fff;font:600 12px/1.6 Arial,sans-serif;display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between;position:relative;z-index:20';
    banner.append(document.createTextNode('Демо-концепт, не официальный сайт. Записи — примеры только в этом браузере. Удалим по первой просьбе.'));
    const link=document.createElement('a'); link.href=window.DEMO_BASE+'admin/dashboard.html'; link.textContent='Посмотреть демо-панель'; link.style.color='#f0d13b'; banner.append(link); const previous=document.querySelector('.demo-note');if(previous)previous.replaceWith(banner);else document.body.prepend(banner);
    for (const form of document.querySelectorAll('#booking-form,#manual-booking-form')) {
      for (const [name,value] of Object.entries({name:'Демонстрационный клиент',phone:'+70000000000',vehicle:'Демоавтомобиль',problem:'Пример обращения'})) {
        const field=form.elements[name]; if (field) { field.value=value; field.defaultValue=value; field.readOnly=true; }
      }
    }
    const note=document.querySelector('#booking-form > small'); if (note) note.textContent='Это демонстрация: настоящая заявка в автосервис не отправляется. Контактные поля заполнены вымышленными данными.';
    const footer=document.querySelector('.dash-footer'); if (footer) footer.textContent='Демонстрационная панель. Все изменения хранятся только в этом браузере и не отправляются в сервис.';
  });
})();
