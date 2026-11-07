// Maqueta del flujo de confirmación (RSVP). Todavía NO guarda nada: la lista de invitados sale de data/book.json.
// Más adelante este módulo se conectará a la base de datos (búsqueda por nombre, pases y verificación del teléfono).
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function openRSVP(data, root = document.body) {
  const guests = data.rsvp.invitados;
  const wrap = document.createElement('div');
  wrap.className = 'modal'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-label', 'Confirmar asistencia');
  wrap.innerHTML = `<div class="modal__card"><button class="modal__close" aria-label="Cerrar">×</button><div class="modal__body"></div></div>`;
  root.appendChild(wrap);
  const body = wrap.querySelector('.modal__body');
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  wrap.querySelector('.modal__close').onclick = close;
  let guest = null, passes = 1;

  const stepSearch = () => {
    body.innerHTML = `<h2>Confirma tu asistencia</h2><p>Escribe tu nombre tal como aparece en la invitación.</p>
      <input class="field" type="text" autocomplete="off" placeholder="Tu nombre" aria-label="Tu nombre"><div class="results" role="list"></div>
      <p class="note">Vista previa: aún no se guarda ninguna respuesta. Prueba con “Pérez” o “María”.</p>`;
    const input = body.querySelector('input'), res = body.querySelector('.results');
    input.focus();
    input.addEventListener('input', () => {
      const q = norm(input.value); res.innerHTML = '';
      if (q.length < 3) return;
      const found = guests.filter((g) => norm(g.nombre).includes(q));
      if (!found.length) { res.innerHTML = '<p class="note">No encontramos ese nombre. Revisa la escritura o confirma por WhatsApp.</p>'; return; }
      found.forEach((g) => {
        const b = document.createElement('button'); b.className = 'row'; b.setAttribute('role', 'listitem');
        b.innerHTML = `<span>${g.nombre}</span><small>${g.pases} ${g.pases === 1 ? 'pase' : 'pases'}</small>`;
        b.onclick = () => { guest = g; passes = g.pases; stepPasses(); };
        res.appendChild(b);
      });
    });
  };

  const stepPasses = () => {
    body.innerHTML = `<h2>${guest.nombre}</h2><p>Tienes <strong>${guest.pases}</strong> ${guest.pases === 1 ? 'pase disponible' : 'pases disponibles'}. ¿Cuántos asistirán?</p>
      <div class="stepper"><button aria-label="Menos">−</button><output>${passes}</output><button aria-label="Más">+</button></div>
      <button class="btn">Confirmar</button><button class="link">← Buscar otro nombre</button>`;
    const out = body.querySelector('output');
    const [minus, plus] = body.querySelectorAll('.stepper button');
    minus.onclick = () => { passes = Math.max(1, passes - 1); out.textContent = passes; };
    plus.onclick = () => { passes = Math.min(guest.pases, passes + 1); out.textContent = passes; };
    body.querySelector('.btn').onclick = stepPhone;
    body.querySelector('.link').onclick = stepSearch;
  };

  const stepPhone = () => {
    body.innerHTML = `<h2>Un último paso</h2><p>Para verificar que eres tú, escribe los <strong>últimos 4 dígitos</strong> de tu teléfono.</p>
      <input class="field field--code" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="••••" aria-label="Últimos 4 dígitos">
      <p class="err" role="alert" hidden>Esos dígitos no coinciden. Inténtalo de nuevo.</p><button class="btn">Verificar</button>`;
    const inp = body.querySelector('input'), err = body.querySelector('.err');
    inp.focus();
    const check = () => { if (inp.value === guest.telefono4) stepDone(); else err.hidden = false; };
    body.querySelector('.btn').onclick = check;
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') check(); });
  };

  const stepDone = () => {
    body.innerHTML = `<h2>¡Listo!</h2><p>${guest.nombre}: confirmamos ${passes} ${passes === 1 ? 'lugar' : 'lugares'}. ¡Gracias, nos vemos el 31 de diciembre!</p>
      <p class="note">Vista previa: esta respuesta todavía no se guarda.</p><button class="btn">Cerrar</button>`;
    body.querySelector('.btn').onclick = close;
  };

  stepSearch();
}
