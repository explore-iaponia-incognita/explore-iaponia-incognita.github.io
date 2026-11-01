/* Iaponia Incognita · interfaz
   El registro de secretos, el progreso (en este navegador), el libro de los secretos, la tarjeta de cada escena,
   los créditos, los avisos, los instrumentos, el minimapa del rollo y la entrada. */
(function () {
  'use strict';
  var SA = window.SA, U = SA.util, E = SA.motor;
  var CLAVE = 'camino-oculto.v1';
  var PRUEBA = /[?&]prueba\b/.test(location.search);
  var I = SA.interfaz = { prueba: PRUEBA };
  var huevos = [], final = null;
  var estado = { hallados: {}, final: false, introVista: false };
  var $ = function (id) { return document.getElementById(id); };
  var raiz = document.documentElement;
  var AUTOR = { nombre: 'Pau Morató Sebastià', linkedin: 'https://www.linkedin.com/in/pau-morat%C3%B3-sebasti%C3%A0-5554a01b2' };
  var NUMEROS = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  var PALABRAS = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce'];

  /* ---------- registro ----------
     Cada secreto: { id, n, nombre, kanji, tipo, pista, lugar?: () => [x, y] en pantalla, detectar(api), escena(motor, datos) } */
  SA.registrar = function (h) { huevos.push(h); huevos.sort(function (a, b) { return a.n - b.n; }); };
  SA.registrarFinal = function (h) { final = h; };
  I.huevos = function () { return huevos; };
  I.estado = function () { return estado; };
  I.palabra = function (n) { return PALABRAS[n] || String(n); };

  function cargar() { try { var s = localStorage.getItem(CLAVE); if (s) { var o = JSON.parse(s); for (var k in o) estado[k] = o[k]; } } catch (e) { /* sin almacenamiento */ } }
  function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch (e) { /* sin almacenamiento */ } }
  function cuantos() { return huevos.filter(function (h) { return estado.hallados[h.id]; }).length; }

  /* ---------- disparar un secreto ---------- */
  I.disparar = function (h, datos, op) {
    op = op || {};
    if (E.escena || !$('intro').hidden || !$('creditos').hidden) return false;
    // un secreto ya encontrado no vuelve a salir solo (Pau, 01/11: molestaban mientras buscabas los otros); se vuelve a ver desde el cuaderno
    if (estado.hallados[h.id] && !op.cuaderno && !op.prueba) return false;
    cerrarCuaderno();
    var nuevo = !estado.hallados[h.id] && !op.prueba;
    if (nuevo) { estado.hallados[h.id] = Date.now(); guardar(); }
    h.ultimosDatos = datos || h.ultimosDatos || null;
    var envoltorio = { id: h.id, escena: function (motor) {
      var s = h.escena(motor, datos || h.ultimosDatos || null);
      if (s && s.tarjeta) {
        if (!s.tarjeta.etiqueta) s.tarjeta.etiqueta = 'Secreto ' + U.dos(h.n) + ' / ' + U.dos(huevos.length) + ' · ' + h.tipo;
        if (s.tarjeta.kanji == null) s.tarjeta.kanji = h.kanji;
      }
      return s;
    } };
    E.reproducir(envoltorio, function () {
      pintarLista(nuevo ? h.id : null);
      if (nuevo) {
        aviso('Secreto encontrado <b>' + U.dos(cuantos()) + '/' + huevos.length + '</b> · ' + h.nombre);
        var b = $('b-cuaderno'); b.classList.remove('pulso'); void b.offsetWidth; b.classList.add('pulso');
        if (cuantos() === huevos.length && !estado.final && final) setTimeout(function () { I.verFinal(); }, 1600);
      }
    });
    return true;
  };
  I.verFinal = function () {
    if (!final || E.escena) return;
    cerrarCuaderno();
    var primero = Infinity, ultimo = 0;
    huevos.forEach(function (h) { var t = estado.hallados[h.id]; if (t) { primero = Math.min(primero, t); ultimo = Math.max(ultimo, t); } });
    E.reproducir({ id: 'final', escena: function (motor) { return final.escena(motor, { desde: primero, hasta: ultimo, huevos: huevos }); } }, function () {
      if (cuantos() === huevos.length) { estado.final = true; guardar(); }
      pintarLista();
      mostrarCreditos();
    });
  };

  /* ---------- créditos ---------- */
  function mostrarCreditos() {
    var c = $('creditos');
    c.hidden = false; c.classList.remove('saliendo'); void c.offsetWidth; c.classList.add('visible');
    E.bloqueado = true;
    setTimeout(function () { var b = $('creditos-enlace'); try { b.focus({ preventScroll: true }); } catch (e) { b.focus(); } }, 2600);
  }
  function cerrarCreditos() {
    var c = $('creditos'); if (c.hidden) return;
    c.classList.remove('visible'); c.classList.add('saliendo');
    E.bloqueado = false; E.ultimoInput = E.t;
    setTimeout(function () { c.hidden = true; c.classList.remove('saliendo'); }, 650);
  }
  I.mostrarCreditos = mostrarCreditos;

  /* ---------- tarjeta ---------- */
  I.tarjeta = function (t) {
    var el = $('tarjeta');
    if (!t) { el.classList.remove('visible'); return; }
    var v = function (x) { return typeof x === 'function' ? x() : (x || ''); };
    $('t-kanji').textContent = v(t.kanji);
    $('t-etq').textContent = v(t.etiqueta);
    $('t-tit').textContent = v(t.titulo);
    $('t-txt').innerHTML = v(t.texto);
    $('t-pie').textContent = v(t.pie);
    void el.offsetWidth; el.classList.add('visible');
  };

  /* ---------- aviso ---------- */
  var tAviso = null;
  function aviso(html, ms) {
    var el = $('aviso'); el.innerHTML = html; el.classList.add('visible');
    clearTimeout(tAviso); tAviso = setTimeout(function () { el.classList.remove('visible'); }, ms || 4200);
  }
  I.aviso = aviso;

  /* ---------- libro de los secretos ---------- */
  function abrirCuaderno() {
    $('cuaderno').classList.add('abierto'); $('cuaderno').setAttribute('aria-hidden', 'false');
    $('b-cuaderno').setAttribute('aria-expanded', 'true'); raiz.classList.add('cuaderno-abierto');
  }
  function cerrarCuaderno() {
    $('cuaderno').classList.remove('abierto'); $('cuaderno').setAttribute('aria-hidden', 'true');
    $('b-cuaderno').setAttribute('aria-expanded', 'false'); raiz.classList.remove('cuaderno-abierto');
  }
  I.abrirCuaderno = abrirCuaderno; I.cerrarCuaderno = cerrarCuaderno;

  function fecha(ms) {
    var d = new Date(ms);
    return U.dos(d.getDate()) + '.' + U.dos(d.getMonth() + 1) + '.' + d.getFullYear() + ' · ' + U.dos(d.getHours()) + ':' + U.dos(d.getMinutes());
  }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  function pintarLista(recien) {
    var ol = $('lista'); ol.innerHTML = '';
    huevos.forEach(function (h) {
      var ok = !!estado.hallados[h.id];
      var li = el('li', 'entrada' + (ok ? ' hallada' : '') + (recien === h.id ? ' nueva' : ''));
      li.appendChild(el('div', 'e-num', NUMEROS[h.n] || h.n));
      var c = el('div', 'e-cuerpo');
      c.appendChild(el('div', 'e-tipo', h.tipo));
      var nom = el('div', 'e-nombre');
      if (ok) { nom.textContent = h.nombre; if (h.kanji) nom.appendChild(el('small', '', h.kanji)); }
      else { var cen = el('span', 'e-censura'); cen.style.width = (h.nombre.length * 0.48 + 0.6) + 'em'; nom.appendChild(cen); nom.setAttribute('aria-label', 'Sin descubrir'); }
      c.appendChild(nom);
      c.appendChild(el('p', 'e-pista', h.pista));
      if (ok || PRUEBA) {
        var meta = el('div', 'e-meta');
        if (ok) meta.appendChild(el('span', '', 'Encontrado ' + fecha(estado.hallados[h.id])));
        var b = el('button', 'e-ver', ok ? '↻ Ver otra vez' : '▶ Probar');
        b.type = 'button';
        b.addEventListener('click', function () { I.disparar(h, null, { prueba: !ok, cuaderno: true }); });
        meta.appendChild(b); c.appendChild(meta);
      }
      li.appendChild(c); ol.appendChild(li);
    });
    var n = cuantos();
    $('contador').textContent = U.dos(n) + '/' + U.dos(huevos.length);
    var seg = $('segmentos'); seg.innerHTML = ''; seg.style.gridTemplateColumns = 'repeat(' + huevos.length + ', 1fr)';
    for (var i = 0; i < huevos.length; i++) seg.appendChild(el('i', i < n ? 'si' : ''));
    $('ver-final').hidden = !(estado.final || (PRUEBA && final));
    $('c-credito-linea').hidden = !estado.final;
    raiz.classList.toggle('completo', !!estado.final);
  }

  /* ---------- instrumentos y minimapa ---------- */
  var cuadroHud = 0, ultimos = {};
  function barras(id, valor) {
    var b = Math.ceil(valor * 5 - 0.15); if (ultimos[id] === b) return; ultimos[id] = b;
    var is = $(id).children; for (var i = 0; i < is.length; i++) is[i].classList.toggle('si', i < b);
  }
  function instrumentos() {
    // ki: la cercanía del pincel a un secreto con lugar que aún no se ha encontrado
    var objetivo = 0, p = E.puntero;
    if (p.sobre) huevos.forEach(function (h) {
      if (!h.lugar || estado.hallados[h.id]) return;
      var q = h.lugar(); if (!q) return;
      objetivo = Math.max(objetivo, U.clamp(1 - Math.hypot(p.x - q[0], p.y - q[1]) / (E.u * (h.radioKi || 0.3)), 0, 1));
    });
    E.senal += (objetivo - E.senal) * 0.12;
    if (++cuadroHud % 4) return;
    var total = E.largo * E.u, max = E.maxCam();
    $('h-rollo').textContent = U.num(max ? E.camX / max * 100 : 0) + ' %';
    barras('h-viento', U.clamp(E.viento, 0, 1));
    barras('h-ki', E.senal);
    var m = $('mapa'), w = m.clientWidth, v = $('mapa-ventana');
    v.style.left = (E.camX / total * w) + 'px'; v.style.width = Math.max(6, E.W / total * w) + 'px';
  }

  /* ---------- teclas pulsadas ---------- */
  var SIMBOLOS = { ArrowLeft: '←', ArrowRight: '→' };
  function tecla(d) {
    var s = SIMBOLOS[d.key] || (d.key.length === 1 && /\S/.test(d.key) ? d.key.toUpperCase() : null);
    if (!s) return;
    var cont = $('teclas'), k = el('kbd', '', s);
    cont.appendChild(k);
    while (cont.children.length > 10) cont.removeChild(cont.firstChild);
    setTimeout(function () { if (k.parentNode) k.parentNode.removeChild(k); }, 2300);
  }

  /* ---------- arranque ---------- */
  I.iniciar = function () {
    cargar();
    var tactil = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    $('ayuda').textContent = tactil ? 'Desliza para avanzar · ✍︎ para pintar' : 'Rueda o trackpad para avanzar · Arrastra para pintar · Clic: una gota';
    $('c-intro').textContent = 'Diez secretos escondidos en el rollo. Cada pista apunta a uno; el nombre aparece cuando lo encuentras.';
    if (tactil) {
      E.pincel = false; var md = $('modo'); md.hidden = false; md.textContent = '✋ Mover';
      md.addEventListener('click', function () { E.pincel = !E.pincel; md.textContent = E.pincel ? '✍︎ Pincel' : '✋ Mover'; });
    }

    huevos.forEach(function (h) {
      h.detectar && h.detectar({
        motor: E, en: E.en,
        capa: function (fn) { E.capas.push(fn); },
        hallado: function () { return !!estado.hallados[h.id]; },
        disparar: function (datos) { return I.disparar(h, datos); }
      });
    });
    E.en('cuadro', instrumentos);
    E.en('tecla', tecla);
    // si al empezar no te mueves, una flecha a la derecha invita a recorrer el rollo (hasta que avances por primera vez)
    var yaAvanzo = false;
    E.capas.push(function (ctx, t) {
      if (yaAvanzo || E.camX > E.u * 0.3) { yaAvanzo = true; return; }
      if (t < 5000 || !$('intro').hidden || E.desenrollo != null) return;
      var a = U.clamp((t - 5000) / 800, 0, 1) * (0.55 + 0.35 * Math.sin(t * 0.005)), x = E.W - E.u * 0.09 + Math.sin(t * 0.005) * 6, y = E.H * 0.5;
      ctx.strokeStyle = U.rgba(SA.color.bermellon, a); ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - 22, y); ctx.lineTo(x, y); ctx.moveTo(x - 9, y - 9); ctx.lineTo(x, y); ctx.lineTo(x - 9, y + 9); ctx.stroke();
      SA.fx.texto('DESLIZA', x - 11, y + 26, { tam: 10, alin: 'center', a: a, color: SA.color.bermellon, espaciado: 2 });
    });

    // minimapa: clic o arrastre para ir a otra parte del rollo
    var mapa = $('mapa'), enMapa = false;
    function irMapa(ev) { var r = mapa.getBoundingClientRect(); E.irA(U.clamp((ev.clientX - r.left) / r.width, 0, 1) * E.largo, 700); E.ultimoInput = E.t; }
    mapa.addEventListener('pointerdown', function (ev) { if (E.escena) return; enMapa = true; irMapa(ev); });
    window.addEventListener('pointermove', function (ev) { if (enMapa) irMapa(ev); });
    window.addEventListener('pointerup', function () { enMapa = false; });

    $('b-cuaderno').addEventListener('click', function () { $('cuaderno').classList.contains('abierto') ? cerrarCuaderno() : abrirCuaderno(); });
    $('cerrar-cuaderno').addEventListener('click', cerrarCuaderno);
    $('saltar').addEventListener('click', function () { E.saltar(); });
    $('ver-final').addEventListener('click', function () { I.verFinal(); });
    $('borrar').addEventListener('click', function () {
      if (!window.confirm('¿Borrar todos los secretos encontrados en este navegador?')) return;
      estado = { hallados: {}, final: false, introVista: true }; guardar(); pintarLista();
    });
    window.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !E.escena) { cerrarCuaderno(); cerrarCreditos(); } });

    $('creditos-nombre').textContent = AUTOR.nombre;
    $('c-credito-nombre').textContent = AUTOR.nombre;
    $('creditos-enlace').href = AUTOR.linkedin; $('c-credito').href = AUTOR.linkedin;
    $('creditos-cerrar').addEventListener('click', cerrarCreditos);

    pintarLista();

    var intro = $('intro');
    if (!estado.introVista && !PRUEBA) {
      intro.hidden = false; E.bloqueado = true; E.desenrollo = 0;
      $('empezar').addEventListener('click', function () {
        estado.introVista = true; guardar();
        intro.classList.add('saliendo'); E.bloqueado = false; E.ultimoInput = E.t;
        E.desenrollo = 0.0001;   // el rollo se desenrolla de izquierda a derecha
        setTimeout(function () { intro.hidden = true; }, 900);
      });
      setTimeout(function () { $('empezar').focus({ preventScroll: true }); }, 50);
    }
  };
})();
