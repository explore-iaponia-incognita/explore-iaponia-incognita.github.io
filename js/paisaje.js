/* El camino oculto · paisaje
   Lo que hay pintado en el rollo, de lejos a cerca, con paralaje (p: 0 = infinito, 1 = el papel):
   el sol, tres cordilleras con nieblas que se mueven, el Fuji, el castillo, el mar con la flota y la isla, la llanura de
   Sekigahara, las colinas, la colina de Shiroyama y, delante, el camino de tinta por el que anda el rōnin, con el pino del
   acantilado, el bambú, el torii, el cerezo y ramas de ciruelo en flor que asoman por arriba.
   Las capas grandes se pintan por teselas con el motor de tinta (SA.tinta + SA.arte) en un «taller» que trabaja sin
   bloquear: primero lo que se ve, luego lo de al lado y, en los ratos libres, el resto. */
(function () {
  'use strict';
  var SA = window.SA, U = SA.util, C = SA.color, FX = SA.fx, E = SA.motor, T = SA.tinta, A = SA.arte, F = SA.figura, TAU = Math.PI * 2;

  // dónde está cada cosa (en u, sobre el papel) y a qué profundidad
  var L = {
    titulo: 0.3, sol: 0.95, fuji: 1.55, acantilado: 1.75, pino: 1.7, ninja: [1.655, 0.47], cuervos: 1.86,
    bambu: [2.35, 3.05], llanura: [3.3, 4.5], sekigahara: [3.92, 0.73], castillo: 5.0, torii: 5.35, pagoda: 8.0,
    mar: [5.85, 7.85], barcos: 6.75, isla: 7.08, cerezo: 8.35, shiroyama: 9.85, samurai: [9.86, 0.585], fin: 10.33
  };
  var P = { sol: 0.08, montesA: 0.12, fuji: 0.17, montesB: 0.22, barcos: 0.4, castillo: 0.3, pagoda: 0.3, montesC: 0.36, isla: 0.7, llanura: 0.72, colinas: 0.6, shiroyama: 0.85 };

  var est = {   // estado que cambian los secretos
    florecer: 0, oleaje: 0, hundir: 0, corte: null, estandartes: 0, sol: 1
  };
  var PA = SA.paisaje = { L: L, P: P, estado: est };

  // la línea del suelo del camino, en u (y de la pantalla)
  function lineaU(xu) { return 0.865 + 0.022 * (U.fbm(xu * 1.7, 3, 3) - 0.5); }
  function suelo(xu) { return E.H * lineaU(xu); }
  PA.suelo = suelo;

  /* ------------------------------------------------------------------ el taller: capas pintadas por teselas
     Una capa vive en coordenadas λ = xu · p (unidades de pantalla en esa profundidad). Su x en pantalla:
     λ·u + W/2·(1 − p) − camX·p (− la deriva, si la niebla se mueve). Cada tesela mide «ancho» λ (redondeado a px). */
  var CAPAS = [], cola = [], tamPintado = '';
  function capa(def) { def.teselas = {}; CAPAS.push(def); return def; }
  function kCapa(c) { return E.u * (c.dpr ? Math.min(E.dpr, c.dpr) : E.dpr); }
  function anchoT(c) { return Math.max(1, Math.round(c.ancho * E.u)) / E.u; }
  // (+ la inclinación: el ratón desplaza un poco las capas lejanas, más cuanto más lejos, como si la cámara girara)
  function baseX(c) { return E.W / 2 * (1 - c.p) - E.camX * c.p - (c.deriva ? E.t * c.deriva * E.u : 0) + PA.inclX * (1 - c.p); }
  PA.inclX = 0;
  // una tesela se pinta por pasos (el pintor es un generador): el taller avanza unos milisegundos en cada fotograma
  var trabajo = null;
  function empezar(c, j) {
    var aw = anchoT(c), k = kCapa(c), m = c.margen || 0, g = null;
    var Lz = T.lienzo((aw + 2 * m) * k, (c.y1 - c.y0) * k);
    try { g = c.pintar(Lz, j * aw - m, k, c.y0, j); } catch (err) { console.error(err); }
    return { c: c, j: j, Lz: Lz, gen: g && typeof g.next === 'function' ? g : null, m: m * k };
  }
  function terminar(tr) {
    if (tr.gen) { try { while (!tr.gen.next().done) { /* sigue */ } } catch (err) { console.error(err); } }
    tr.c.teselas[tr.j] = { c: tr.Lz.c, m: tr.m };
    return tr.c.teselas[tr.j];
  }
  function pintarTesela(c, j) {
    if (trabajo && trabajo.c === c && trabajo.j === j) { var t = terminar(trabajo); trabajo = null; return t; }
    return terminar(empezar(c, j));
  }
  function existe(c, j) { var aw = anchoT(c); return !((c.desde != null && (j + 1) * aw < c.desde) || (c.hasta != null && j * aw > c.hasta)); }
  function encolar(c, j, prio) {
    if ((c.teselas[j] && !c.teselas[j].provisional) || !existe(c, j)) return;
    for (var i = 0; i < cola.length; i++) if (cola[i].c === c && cola[i].j === j) { cola[i].prio = Math.min(cola[i].prio, prio); return; }
    cola.push({ c: c, j: j, prio: prio });
  }
  function rangoVisible(c, extra) {
    var aw = anchoT(c) * E.u, b = baseX(c);
    return [Math.floor((-b) / aw) - (extra || 0), Math.floor((E.W - b) / aw) + (extra || 0)];
  }
  // cambia el tamaño de la pantalla: todo se vuelve a pintar (lo visible, enseguida)
  function revisarTam() {
    var t = E.u + 'x' + E.dpr;
    if (t === tamPintado) return;
    tamPintado = t; cola.length = 0; trabajo = null; enCurso = {}; soltado = false;
    CAPAS.forEach(function (c) { c.teselas = {}; });
    sprites = {};
  }
  // una versión rápida de una tesela (baja resolución, sin detalle) para no parar el juego mientras se pinta la buena
  function provisional(c, j) {
    var aw = anchoT(c), k = E.u * 0.35, m = c.margen || 0, Lz = T.lienzo((aw + 2 * m) * k, (c.y1 - c.y0) * k);
    try { var g = (c.rapido || c.pintar)(Lz, j * aw - m, k, c.y0, j); if (g && typeof g.next === 'function') { while (!g.next().done) { /* sigue */ } } } catch (err) { console.error(err); }
    return { c: Lz.c, m: m * k, provisional: true };
  }
  function dibujarCapa(ctx, c, alfa) {
    var aw = anchoT(c), b = baseX(c), v = rangoVisible(c, 0), dirCam = E.camVelPantalla > 0.5 ? 1 : E.camVelPantalla < -0.5 ? -1 : 0;
    for (var j = v[0] - 2; j <= v[1] + 2; j++) {
      if (!existe(c, j)) continue;
      var t = c.teselas[j];
      // las de fuera: a la cola (las que vienen en la dirección del movimiento, antes)
      if (j < v[0] || j > v[1]) { if (!t || t.provisional) encolar(c, j, (j < v[0] ? -1 : 1) === dirCam ? 0.5 : (Math.abs(j < v[0] ? v[0] - j : j - v[1]) > 1 ? 1.5 : 1)); continue; }
      if (!t) {
        if (trabajo && trabajo.c === c && trabajo.j === j) t = pintarTesela(c, j);
        else { var tp0 = performance.now(); t = c.teselas[j] = provisional(c, j); encolar(c, j, 0); if (PA._perfil) PA._perfil.push('prov ' + c.nombre + ' ' + Math.round(performance.now() - tp0)); }
      }
      var x = Math.round((j * aw * E.u + b) * E.dpr) / E.dpr;
      if (alfa != null) ctx.globalAlpha = alfa;
      ctx.drawImage(t.c, t.m, 0, t.c.width - 2 * t.m, t.c.height, x, c.y0 * E.u, aw * E.u, (c.y1 - c.y0) * E.u);
      ctx.globalAlpha = 1;
    }
  }
  // qué toca ahora: primero lo urgente (lo que ya se ve en versión provisional, y lo de al lado); luego, de todo lo que
  // falta (teselas y piezas grandes), lo más cercano a la cámara, y antes lo que queda en la dirección en la que se avanza
  var dirTaller = 1, soltado = false;
  function lejania(x0, x1) {   // px de pantalla hasta lo que se ve (0 si ya se ve); lo de detrás cuenta casi el doble
    var d = x0 > E.W ? x0 - E.W : x1 < 0 ? -x1 : 0;
    return d && (x0 > E.W ? 1 : -1) !== dirTaller ? d * 1.8 : d;
  }
  function elegir(mirar) {
    var v = E.camVelPantalla; if (v > 0.5) dirTaller = 1; else if (v < -0.5) dirTaller = -1;
    var mejor = -1, clave = Infinity, i, k, n;
    for (i = 0; i < cola.length; i++) {
      var w = cola[i];
      if (w.prio < 2) k = w.prio;
      else { var aw = anchoT(w.c) * E.u, x0 = w.j * aw + baseX(w.c); k = 2 + lejania(x0, x0 + aw) / E.W; }
      if (k < clave) { clave = k; mejor = i; }
    }
    // las piezas grandes no tienen versión provisional (si hacen falta antes, se pintan del tirón, y eso es un parón): las
    // que están a menos de media pantalla van incluso antes que mejorar una tesela provisional que ya se ve; las que
    // vienen a menos de una pantalla, antes que las teselas vecinas; y la que está a medias, antes que una nueva
    var gr = null;
    for (n in GRANDES) {
      var sp = sprites[n]; if (sp && sp.u === E.u) continue;
      var def = GRANDES[n];
      k = -0.6 + 1.2 * (def.donde ? def.donde() : 20 * E.W) / E.W - (enCurso[n] ? 0.3 : 0);
      if (k < clave) { clave = k; gr = n; }
    }
    if (gr) return { grande: gr };
    return mejor < 0 ? null : { tesela: mirar ? cola[mejor] : cola.splice(mejor, 1)[0] };
  }
  // la distancia (como lejania) de una pieza en xu (o en la más cercana de varias), a profundidad p y «ancho» u de ancho
  function en(xus, p, ancho) {
    return function () {
      var lista = typeof xus === 'number' ? [xus] : xus, w = ancho * E.u, m = Infinity;
      for (var i = 0; i < lista.length; i++) { var x = E.sx(lista[i], p) + PA.inclX * (1 - p); m = Math.min(m, lejania(x - w / 2, x + w / 2)); }
      return m;
    };
  }
  // trabaja en la cola durante «presupuesto» ms (por pasos: nunca bloquea un fotograma entero)
  PA.trabajar = function (presupuesto) {
    var t0 = performance.now();
    while (performance.now() - t0 < presupuesto) if (!pasoTaller()) return;
  };
  // un paso del taller: empieza o sigue una tesela, o da un paso de una pieza grande; false si ya no queda nada
  function pasoTaller() {
    if (!trabajo) {
      var sig = elegir();
      if (!sig) { if (!soltado && A.soltarTaller) { A.soltarTaller(); soltado = true; } return false; }   // todo pintado
      if (sig.grande) {
        var tg = performance.now(); pasoGrande(sig.grande);
        if (PA._perfil && performance.now() - tg > 20) PA._perfil.push(Math.round(performance.now() - tg) + ':' + sig.grande);
        return 'grande ' + sig.grande;
      }
      var w = sig.tesela;
      if (w.c.teselas[w.j] && !w.c.teselas[w.j].provisional) return 'ya estaba';
      trabajo = empezar(w.c, w.j);
    }
    if (!trabajo.gen) { terminar(trabajo); trabajo = null; return 'tesela entera'; }
    var paso, tp = performance.now(), nombre = trabajo.c.nombre + '#' + trabajo.j;
    try { paso = trabajo.gen.next(); } catch (err) { console.error(err); paso = { done: true }; }
    // espera a que WebKit lo haya pintado de verdad (ver T.vaciar): si no, el trabajo se acumula y llega todo junto
    if (PA.vaciar !== false) T.vaciar();
    if (PA._perfil && performance.now() - tp > 20) PA._perfil.push(Math.round(performance.now() - tp) + ':' + trabajo.c.nombre + ':' + paso.value);
    if (paso.done) { trabajo.c.teselas[trabajo.j] = { c: trabajo.Lz.c, m: trabajo.m }; trabajo = null; }
    return nombre + ' ' + (paso.value || '');
  }
  // al empezar: lo que se ve, ya; y todo lo demás a la cola (se pinta mientras se lee la entrada)
  PA.preparar = function () {
    PA.listo = true;
    revisarTam();
    for (var n in GRANDES) if (GRANDES[n].donde && GRANDES[n].donde() < E.W * 0.15) obtenerGrande(n);
    CAPAS.forEach(function (c) {
      var v = rangoVisible(c, 0);
      for (var j = v[0]; j <= v[1]; j++) if (existe(c, j) && !c.teselas[j]) c.teselas[j] = pintarTesela(c, j);
      var aw = anchoT(c), j0 = Math.floor((c.desde != null ? c.desde : -E.W / E.u) / aw) - 1, j1 = Math.ceil((c.hasta != null ? c.hasta : (E.maxCam() * c.p + E.W) / E.u) / aw) + 1;
      for (var jj = j0; jj <= j1; jj++) encolar(c, jj, 2);
    });
  };
  PA.pendientes = function () { return cola.length + (trabajo ? 1 : 0); };
  // si al taller le queda algo por pintar (teselas o piezas grandes)
  PA.ocupado = function () {
    if (trabajo || cola.length) return true;
    for (var n in GRANDES) { var s = sprites[n]; if (!(s && s.u === E.u)) return true; }
    return false;
  };
  PA._taller = {
    capas: CAPAS, pintar: pintarTesela, cola: cola, paso: function () { return pasoTaller(); },
    actual: function () { return trabajo ? trabajo.c.nombre + '#' + trabajo.j : '-'; },
    siguiente: function () { if (trabajo) return 'sigue ' + trabajo.c.nombre + '#' + trabajo.j; var s = elegir(true); return !s ? '-' : s.grande ? 'grande ' + s.grande : 'tesela ' + s.tesela.c.nombre + '#' + s.tesela.j; },
    faltan: function () { return Object.keys(GRANDES).filter(function (n) { var s = sprites[n]; return !(s && s.u === E.u); }); }
  };

  /* --- las capas --- */
  var MONTES = {
    lejos: { semilla: 11, esp: 0.55, alto: 0.3, base: 0.69, tono: 0.13, detalle: 0, niebla: 0.16, suave: 5 },
    medio: { semilla: 23, esp: 0.42, alto: 0.23, base: 0.73, tono: 0.24, detalle: 0.45, niebla: 0.13, arboles: 0.35 },
    cerca: { semilla: 37, esp: 0.34, alto: 0.16, base: 0.79, tono: 0.36, detalle: 1, niebla: 0.1, arboles: 0.8 },
    colinas: { semilla: 41, esp: 0.28, alto: 0.085, base: 0.86, tono: 0.46, detalle: 1, niebla: 0.06, arboles: 1 }
  };
  function capaMontes(nombre, p, y0, y1, def, dpr, hueco) {
    var defRapido = {}; for (var kk in def) defRapido[kk] = def[kk]; defRapido.detalle = 0;
    return capa({ nombre: nombre, p: p, y0: y0, y1: y1, ancho: 0.9, dpr: dpr, margen: 0.04, rapido: function (Lz, l0, k, yTop) { A.montes(Lz, l0, k, yTop, defRapido); }, pintar: function* (Lz, l0, k, yTop) {
      yield* A.montesPasos(Lz, l0, k, yTop, def);
      if (!hueco) return;
      // los huecos (el mar, la llanura): se borran con un fundido suave
      var x = Lz.x; x.save(); x.globalCompositeOperation = 'destination-out';
      hueco.forEach(function (hq) {
        var a = (hq[0] * p - l0) * k, b = (hq[1] * p - l0) * k, f = hq[2] * k, g = x.createLinearGradient(a - f, 0, b + f, 0), wl = b - a + 2 * f;
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(f / wl, 'rgba(0,0,0,' + (hq[3] || 1) + ')'); g.addColorStop(1 - f / wl, 'rgba(0,0,0,' + (hq[3] || 1) + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g; x.fillRect(a - f, 0, wl, Lz.h);
      });
      x.restore();
    } });
  }
  function capaNiebla(nombre, p, y0, y1, def, deriva) {
    return capa({ nombre: nombre, p: p, y0: y0, y1: y1, ancho: 1.2, dpr: 1, deriva: deriva, pintar: function (Lz, l0, k, yTop) { A.niebla(Lz, l0, k, yTop, def); } });
  }
  var C_LEJOS = capaMontes('montesLejos', P.montesA, 0.32, 0.74, MONTES.lejos, 0.75);
  var C_N1 = capaNiebla('niebla1', 0.15, 0.58, 0.8, { semilla: 2, y: 0.675, alto: 0.07, alfa: 0.75, franja: 0.7 }, 0.000004);
  var C_MEDIO = capaMontes('montesMedio', P.montesB, 0.42, 0.78, MONTES.medio, 1);
  var C_N2 = capaNiebla('niebla2', 0.27, 0.64, 0.84, { semilla: 4, y: 0.725, alto: 0.06, alfa: 0.8, franja: 0.75 }, 0.000007);
  var C_CERCA = capaMontes('montesCerca', P.montesC, 0.56, 0.84, MONTES.cerca, 1.15);
  var C_N3 = capaNiebla('niebla3', 0.45, 0.7, 0.88, { semilla: 6, y: 0.785, alto: 0.05, alfa: 0.85, franja: 0.8 }, 0.00001);
  // las colinas se abren donde está el mar y se allanan en Sekigahara
  var C_COLINAS = capaMontes('colinas', P.colinas, 0.7, 0.9, MONTES.colinas, 1.4, [[L.mar[0] - 0.15, L.mar[1] + 0.15, 0.25, 1], [L.llanura[0] + 0.1, L.llanura[1] - 0.1, 0.3, 0.8]]);
  var HZ = 0.705, ORILLA = 0.835;   // horizonte y orilla del mar, en u
  function defMar(rapido) { return { hz: HZ, orilla: ORILLA + 0.008, a: (L.mar[0] - 0.12) * P.colinas, b: (L.mar[1] + 0.12) * P.colinas, fundido: 0.22, semilla: 3, rapido: rapido }; }
  var C_MAR = capa({ nombre: 'mar', p: P.colinas, y0: 0.69, y1: 0.87, ancho: 0.9, dpr: 1.25, desde: L.mar[0] * P.colinas - 0.4, hasta: L.mar[1] * P.colinas + 0.4,
    pintar: function (Lz, l0, k, yTop) { return A.marPasos(Lz, l0, k, yTop, defMar(false)); },
    rapido: function (Lz, l0, k, yTop) { return A.marPasos(Lz, l0, k, yTop, defMar(true)); } });
  var C_N4 = capaNiebla('niebla4', 0.8, 0.78, 0.92, { semilla: 8, y: 0.845, alto: 0.035, alfa: 0.7, franja: 0.55 }, 0.000014);
  var C_SUELO = capa({ nombre: 'suelo', p: 1, y0: 0.8, y1: 1, ancho: 0.8, dpr: 2, margen: 0.03, pintar: function (Lz, l0, k, yTop) {
    return A.sueloPasos(Lz, l0, l0 + Lz.w / k, { k: k, y: function (xu) { return (lineaU(xu) - yTop) * k; }, semilla: 4 });
  } });
  C_SUELO.desde = -0.3; C_SUELO.hasta = 11;
  // la versión rápida del camino: la banda oscura con su filo, sin pinceladas
  C_SUELO.rapido = function (Lz, l0, k, yTop) {
    var x = Lz.x, w = Lz.w, xu;
    x.fillStyle = T.rgba(T.color.tinta, 0.88); x.beginPath(); x.moveTo(0, (lineaU(l0) - yTop) * k);
    for (xu = l0; xu <= l0 + w / k + 0.01; xu += 0.02) x.lineTo((xu - l0) * k, (lineaU(xu) - yTop) * k - 1);
    for (xu = l0 + w / k + 0.01; xu >= l0; xu -= 0.02) x.lineTo((xu - l0) * k, (lineaU(xu) - yTop + 0.022) * k);
    x.closePath(); x.fill();
  };

  /* ------------------------------------------------------------------ sprites (piezas sueltas, pintadas una vez) */
  var sprites = {};
  // un sprite pintado con el motor de tinta en un lienzo propio (px reales)
  function spriteTinta(nombre, w, h, pintar, dprMax) {
    var d = Math.min(E.dpr, dprMax || 2), s = sprites[nombre];
    if (s && s.u === E.u && s.d === d) return s;
    if (GRANDES[nombre]) { var g = obtenerGrande(nombre); if (g) return g; }
    var Lz;
    try { Lz = pintar(Math.ceil(w * d), Math.ceil(h * d), d); } catch (err) { console.error(err); Lz = T.lienzo(1, 1); }
    s = sprites[nombre] = { c: Lz.c, w: w, h: h, u: E.u, d: d, datos: Lz };
    return s;
  }
  // piezas grandes que se pintan por pasos (generadores) en los ratos libres; si hacen falta antes, se acaban del tirón
  var GRANDES = {}, enCurso = {};
  function grande(nombre, def) { GRANDES[nombre] = def; }   // def: { w(), h(), dprMax, pasos(pw, ph, d) → generador que devuelve el resultado }
  function empezarGrande(nombre) {
    var def = GRANDES[nombre], d = Math.min(E.dpr, def.dprMax || 2), w = def.w(), h = def.h();
    return (enCurso[nombre] = { gen: def.pasos(Math.ceil(w * d), Math.ceil(h * d), d), w: w, h: h, d: d });
  }
  function acabarGrande(nombre, res) {
    var c = enCurso[nombre]; delete enCurso[nombre];
    T.vaciar();
    return (sprites[nombre] = { c: (res.c || (res.yemas && res.yemas.c)), w: c.w, h: c.h, u: E.u, d: c.d, datos: res });
  }
  function obtenerGrande(nombre) {
    var s = sprites[nombre];
    if (s && s.u === E.u) return s;
    if (PA._perfil) PA._perfil.push('grande ' + nombre);
    var c = enCurso[nombre] || empezarGrande(nombre), p;
    try { do { p = c.gen.next(); } while (!p.done); } catch (err) { console.error(err); delete enCurso[nombre]; return null; }
    return acabarGrande(nombre, p.value);
  }
  function pasoGrande(nombre) {   // un paso en segundo plano; true si ya está
    var s = sprites[nombre]; if (s && s.u === E.u) return true;
    var c = enCurso[nombre] || empezarGrande(nombre), p;
    try { p = c.gen.next(); } catch (err) { console.error(err); delete enCurso[nombre]; return true; }
    T.vaciar();
    if (p.done) { acabarGrande(nombre, p.value); return true; }
    return false;
  }
  // vuelve a pintar las piezas dadas (o todas): al cargar las fuentes, solo las que llevan letra (la placa del torii)
  PA.reiniciar = function (nombres) { if (!nombres) { sprites = {}; enCurso = {}; return; } nombres.forEach(function (n) { delete sprites[n]; delete enCurso[n]; }); };

  function unPaso(fn) { return function* () { return fn.apply(null, arguments); }; }
  function receta(nombre, w, h, dprMax, pintar) { grande(nombre, { w: w, h: h, dprMax: dprMax, pasos: unPaso(pintar) }); }
  receta('sol', function () { return E.u * 0.085 * 2.2; }, function () { return E.u * 0.085 * 2.2; }, 2, function (pw) { return A.sol(pw / 2.2); });
  receta('marcoTitulo', function () { return marcoW(); }, function () { return marcoH(); }, 2, function (pw, ph, d) { return pintarMarco(pw, ph, d); });
  grande('ciruelo0', { w: function () { return CIRUELOS[0].w * E.u; }, h: function () { return CIRUELOS[0].h * E.u; }, dprMax: 2, pasos: function (pw, ph) { var c = CIRUELOS[0]; return A.ciruelosPasos(pw, ph, { semilla: c.semilla, desde: c.desde }); } });
  receta('fuji', function () { return E.u * 0.78; }, function () { return E.u * 0.36; }, 1.5, function (pw, ph) { return A.fuji(pw, ph, { tono: 0.26 }); });
  grande('roca', { w: function () { return E.u * 0.66; }, h: function () { return E.u * 0.3; }, dprMax: 2, pasos: unPaso(function (pw, ph) { return A.roca(pw, ph, { semilla: 5 }); }) });
  grande('pino', { w: function () { return E.u * 0.44; }, h: function () { return E.u * 0.44; }, dprMax: 2, pasos: unPaso(function (pw, ph) { return A.pino(pw, ph, { inclina: 0.5, pads: 6, semilla: 3 }); }) });
  grande('pinoChico', { w: function () { return E.u * 0.2; }, h: function () { return E.u * 0.2; }, dprMax: 2, pasos: unPaso(function (pw, ph) { return A.pino(pw, ph, { inclina: -0.4, pads: 4, semilla: 11, escondite: false }); }) });
  grande('isla', { w: function () { return E.u * 0.36; }, h: function () { return E.u * 0.144; }, dprMax: 2, pasos: function (pw, ph) { return A.islaPasos(pw, ph, { semilla: 8, tono: 0.9 }); } });
  grande('hierbaCerca0', { w: function () { return E.u * 0.5; }, h: function () { return E.u * 0.27; }, dprMax: 1, pasos: function (pw, ph, d) { return hierbaCercaPasos(0, pw, ph, d); } });
  // las piezas de las cañas (las usan el bambú de delante y el bosquecillo): por pasos; al acabar quedan en la caché de A
  function* piezasPasos() { var g = A.bambuPiezasPasos(E.H * 1.02, { dpr: E.dpr }), p = g.next(); while (!p.done) { yield 'piezas'; p = g.next(); } return p.value; }
  grande('bambuPiezas', { w: function () { return 1; }, h: function () { return 1; }, dprMax: 2, pasos: function* () { yield* piezasPasos(); return T.lienzo(1, 1); } });
  grande('bambuFondo', { w: function () { return E.u * 1.25; }, h: function () { return E.H; }, dprMax: 1.5, pasos: function* () { var pz = yield* piezasPasos(); return yield* A.bambuFondoPasos(E.u * 1.25, E.H, { dpr: Math.min(E.dpr, 1.5), piezas: pz, suelo: 0.865 }); } });
  grande('hierbaCerca1', { w: function () { return E.u * 0.5; }, h: function () { return E.u * 0.27; }, dprMax: 1, pasos: function (pw, ph, d) { return hierbaCercaPasos(1, pw, ph, d); } });
  grande('ciruelo1', { w: function () { return CIRUELOS[1].w * E.u; }, h: function () { return CIRUELOS[1].h * E.u; }, dprMax: 2, pasos: function (pw, ph) { var c = CIRUELOS[1]; return A.ciruelosPasos(pw, ph, { semilla: c.semilla, desde: c.desde }); } });
  grande('hierbaCerca2', { w: function () { return E.u * 0.5; }, h: function () { return E.u * 0.27; }, dprMax: 1, pasos: function (pw, ph, d) { return hierbaCercaPasos(2, pw, ph, d); } });
  grande('cerezo', { w: function () { return E.u * 0.95; }, h: function () { return E.u * 0.62; }, dprMax: 1.5, pasos: function (pw, ph) { return A.cerezoPasos(pw, ph, {}); } });
  grande('colina', { w: function () { return E.u * 1.25; }, h: function () { return E.u * 0.4; }, dprMax: 1.5, pasos: function (pw, ph) { return A.colinaPasos(pw, ph, {}); } });
  grande('castillo', { w: function () { return E.u * 0.3; }, h: function () { return E.u * 0.26; }, dprMax: 1.25, pasos: function (pw, ph) { return A.castilloPasos(pw, ph, { semilla: 7 }); } });
  grande('pagoda', { w: function () { return E.u * 0.15; }, h: function () { return E.u * 0.25; }, dprMax: 1.25, pasos: function (pw, ph) { return A.pagodaPasos(pw, ph, { semilla: 5 }); } });
  grande('torii', { w: function () { return E.u * 0.42; }, h: function () { return E.u * 0.4; }, dprMax: 2, pasos: function (pw, ph) { return A.toriiPasos(pw, ph, { semilla: 3 }); } });
  receta('linterna', function () { return E.u * 0.066; }, function () { return E.u * 0.11; }, 2, function (pw, ph) { return A.linterna(pw, ph, { semilla: 4 }); });
  receta('linternaLuz', function () { return E.u * 0.066; }, function () { return E.u * 0.11; }, 2, function (pw, ph) { return A.linterna(pw, ph, { semilla: 4, luz: 1 }); });
  [0, 1, 2].forEach(function (i) {
    receta('junco' + i, function () { return E.u * 0.095; }, function () { return E.u * 0.095; }, 1.5, function (pw, ph) { return A.junco(pw, ph, { semilla: 11 + i * 7, mastiles: i === 1 ? 2 : 3, bandera: i !== 2 }); });
  });
  // piezas de las escenas que el taller deja pintadas de antemano (los nubarrones del tifón)
  grande('nubarronLejos', { w: function () { return E.W * 1.5; }, h: function () { return E.H * 0.36; }, dprMax: 0.45, pasos: function (pw, ph) { return A.nubarronPasos(pw, ph, { semilla: 47, tono: 0.55 }); } });
  grande('nubarronCerca', { w: function () { return E.W * 1.8; }, h: function () { return E.H * 0.46; }, dprMax: 0.45, pasos: function (pw, ph) { return A.nubarronPasos(pw, ph, { semilla: 71, tono: 0.95 }); } });
  grande('ciruelo2', { w: function () { return CIRUELOS[2].w * E.u; }, h: function () { return CIRUELOS[2].h * E.u; }, dprMax: 2, pasos: function (pw, ph) { var c = CIRUELOS[2]; return A.ciruelosPasos(pw, ph, { semilla: c.semilla, desde: c.desde }); } });
  /* --- el acantilado: dónde quedan la roca, el pino (con la base en la cima de la roca) y el pino pequeño --- */
  function situarAcantilado() {
    var roca = obtenerGrande('roca'), pino = obtenerGrande('pino'), chico = obtenerGrande('pinoChico');
    if (!roca || !pino) return null;
    var kr = roca.w / roca.datos.w, kp = pino.w / pino.datos.w, ca = E.sx(L.acantilado);
    var rx = ca - roca.w * 0.52, ry = suelo(L.acantilado) - roca.h + E.u * 0.012;
    var cima = [rx + roca.datos.cima[0] * kr, ry + roca.datos.cima[1] * kr];
    var px = cima[0] - pino.datos.base[0] * kp, py = cima[1] - pino.datos.base[1] * kp, r = { roca: roca, pino: pino, rx: rx, ry: ry, px: px, py: py, kp: kp };
    if (chico && roca.datos.cimas && roca.datos.cimas.length) {
      var kc = chico.w / chico.datos.w, cs = roca.datos.cimas[Math.floor(roca.datos.cimas.length * 0.78)];
      r.chico = chico; r.cx = rx + cs[0] * kr - chico.datos.base[0] * kc; r.cy = ry + cs[1] * kr - chico.datos.base[1] * kc + E.u * 0.004;
    }
    PA._acantilado = r;
    return r;
  }

  /* --- la colina de Shiroyama y el último samurái --- */
  // pinta la colina en su sitio (la cima, bajo L.samurai); con «tapar», antes rellena su silueta de papel (para que el sol
  // que se pone en el secreto quede detrás de verdad). Devuelve si se ha pintado.
  function colinaShiroyama(ctx, a, tapar) {
    var u = E.u, cs = E.sx(L.samurai[0], P.shiroyama);
    if (cs < -u * 0.7 || cs > E.W + u * 0.7) return false;
    var s = obtenerGrande('colina'); if (!s) return false;
    var k = s.w / s.datos.w, cima = s.datos.cima, x0 = cs - cima[0] * k, y0 = E.H * 0.6 - cima[1] * k;
    PA._cima = [cs, E.H * 0.6];
    if (tapar && s.datos.cresta) {
      // la colina es opaca (tapa lo de detrás, también el sol del secreto 10): su silueta, rellena de papel, que se pierde
      // hacia abajo en la niebla como la propia colina (sin tapar el camino ni lo que hay delante, que se pinta después)
      var g = ctx.createLinearGradient(0, y0, 0, y0 + s.h);
      g.addColorStop(0, U.rgba(C.papel, a)); g.addColorStop(0.55, U.rgba(C.papel, a)); g.addColorStop(0.85, U.rgba(C.papel, 0));
      ctx.fillStyle = g; ctx.beginPath();
      s.datos.cresta.forEach(function (q, i) { var px = x0 + q[0] * k, py = y0 + q[1] * k + 1; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
      ctx.lineTo(x0 + s.w, y0 + s.h); ctx.lineTo(x0, y0 + s.h); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = a; ctx.drawImage(s.c, x0, y0, s.w, s.h); ctx.globalAlpha = 1;
    return true;
  }
  PA.colinaShiroyama = function (ctx, a) { return colinaShiroyama(ctx, a, true); };
  /* ------------------------------------------------------------------ el mar (entre el horizonte y el camino) */
  var ondas = [];   // ondas que deja el puntero sobre el agua (en u del papel)
  function marEnPantalla() { return [E.sx(L.mar[0], P.colinas), E.sx(L.mar[1], P.colinas)]; }
  PA.esMar = function (sx, sy) { var m = marEnPantalla(); return sx > m[0] && sx < m[1] && sy > E.H * HZ && sy < suelo(E.xuDe(sx)) - 4; };
  // 1 en el mar abierto, 0 en las orillas (fundido de 0,35 u)
  function enMar(x) { var m = marEnPantalla(), d = Math.min(x - m[0], m[1] - x) / (E.u * 0.35); return U.clamp(d, 0, 1); }
  PA.enMar = enMar;
  function mar(ctx) {
    var m = marEnPantalla(), H = E.H, u = E.u, t = E.t;
    if (m[1] < -u * 0.4 || m[0] > E.W + u * 0.4) return;
    dibujarCapa(ctx, C_MAR);
    var x0 = Math.max(-20, m[0] - u * 0.2), x1 = Math.min(E.W + 20, m[1] + u * 0.2), hz = H * HZ, fondo = H * ORILLA, k;
    // el reflejo del sol: pinceladas rojas rotas bajo el sol, que tiemblan
    if (PA.sol && est.sol > 0.01 && PA.sol[0] > x0 && PA.sol[0] < x1) {
      var sxr = PA.sol[0], vr = enMar(sxr) * est.sol;
      for (var rr = 0; rr < 12; rr++) {
        if (U._h(rr * 3.7 + Math.floor(t / 900)) < 0.25) continue;   // algunos destellos se apagan y vuelven
        var fr = rr / 11, yr = hz + 2 + Math.pow(fr, 1.3) * (fondo - hz) * 0.6, ancho = u * (0.034 - fr * 0.024) * (0.55 + 0.45 * Math.sin(t * 0.003 + rr * 2.1)), dxr = Math.sin(t * 0.0021 + rr * 1.7) * u * 0.008;
        ctx.fillStyle = U.rgba(T.color.rojo, (0.3 - fr * 0.22) * vr); ctx.beginPath(); ctx.ellipse(sxr + dxr, yr, ancho, u * (0.0016 + fr * 0.0008), 0, 0, TAU); ctx.fill();
      }
    }
    barcos(ctx);
    isla(ctx);
    // las olas: crestas como medias lunas de pincel (afiladas en los extremos), en filas que se acercan; delante, algunas se rizan
    var ola = 1 + est.oleaje * 2.6, NIV = 4;
    for (var f2 = 0; f2 < 9; f2++) {
      var kf = f2 / 8, y = U.lerp(hz + 4, fondo - 2, Math.pow(kf, 1.5)), p = U.lerp(0.42, 0.95, kf), s = u * U.lerp(0.018, 0.075, kf);
      var desp = E.camX * p + t * 0.012 * (0.5 + kf) * (1 + est.oleaje * 4), caminos = [];
      for (k = 0; k < NIV; k++) caminos.push(new Path2D());
      for (var x = x0 - ((desp % s) + s) % s; x < x1; x += s) {
        var fade = enMar(x + s / 2); if (fade <= 0) continue;
        var semilla = Math.floor((x + desp) / s) + f2 * 1000; if (U._h(semilla) < 0.45) continue;
        var alto = s * 0.045 * ola * (0.6 + 0.7 * U._h(semilla + 3)) * (1 + 0.35 * Math.sin(t * 0.002 + semilla)), ancho2 = s * (0.7 + 0.6 * U._h(semilla + 5)), gros = alto * 0.7 + u * (0.0006 + kf * 0.0012);
        var xa = x + U._h(semilla + 1) * s * 0.4, xc = xa + ancho2 * 0.5, o = caminos[Math.min(NIV - 1, Math.floor(fade * NIV))];
        o.moveTo(xa, y); o.quadraticCurveTo(xc, y - alto * 2, xa + ancho2, y); o.quadraticCurveTo(xc, y - alto * 2 + gros, xa, y);
        if (kf > 0.4 && U._h(semilla + 7) < 0.22 + est.oleaje * 0.5) {   // cresta que se riza
          var cr = alto * 1.4; o.moveTo(xc - cr * 0.2, y - alto * 1.1); o.quadraticCurveTo(xc + cr * 0.6, y - alto * 1.9 - cr * 0.6, xc + cr * 0.9, y - alto * 0.9); o.quadraticCurveTo(xc + cr * 0.5, y - alto * 1.3, xc - cr * 0.2, y - alto * 1.1);
        }
      }
      for (k = 0; k < NIV; k++) { ctx.fillStyle = U.rgba(C.tinta, U.lerp(0.2, 0.5, kf) * (k + 0.5) / NIV); ctx.fill(caminos[k]); }
    }
    // espuma en la orilla: puntos y rayas de papel que van y vienen
    var vaiv = Math.sin(t * 0.0011) * u * 0.004;
    ctx.fillStyle = U.rgba(C.papel, 0.85);
    for (var e2 = Math.floor((x0 + E.camX * 0.95) / 9); e2 < (x1 + E.camX * 0.95) / 9; e2++) {
      if (U._h(e2 * 3.1) < 0.55) continue;
      var ex = e2 * 9 - E.camX * 0.95, fe = enMar(ex); if (fe <= 0.05) continue;
      ctx.beginPath(); ctx.ellipse(ex, fondo - 1 + vaiv + U._h(e2) * 3, 2 + U._h(e2 + 1) * 6, 0.9, 0, 0, TAU); ctx.fill();
    }
    for (var i = ondas.length - 1; i >= 0; i--) {
      var o2 = ondas[i], e = (t - o2.t) / 1600; if (e >= 1) { ondas.splice(i, 1); continue; }
      var ox = E.sx(o2.xu), rr2 = 6 + e * u * 0.09;
      ctx.strokeStyle = U.rgba(C.tinta, 0.4 * (1 - e)); ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(ox, o2.y, rr2, rr2 * 0.22, 0, 0, TAU); ctx.stroke();
    }
  }
  function barcos(ctx) {   // la flota mongola en el horizonte
    var p = P.barcos, u = E.u, hz = E.H * HZ, r = U.azar(17), m = marEnPantalla();
    if (m[1] < -u || m[0] > E.W + u) return;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, E.W, hz + 2.5); ctx.clip();   // el agua tapa lo que se hunde
    for (var i = 0; i < 6; i++) {
      var bx = E.sx(L.barcos + (i - 2.5) * 0.11 + (r() - 0.5) * 0.05, p) + PA.inclX * (1 - p), q = u * (0.062 + r() * 0.026), izq = r() < 0.4, cual = i % 3;
      var hunde = U.clamp(est.hundir * 1.6 - i * 0.12, 0, 1), vis = enMar(bx);
      if (hunde >= 1 || vis <= 0 || bx + q < 0 || bx - q > E.W) continue;
      var sj = obtenerGrande('junco' + cual); if (!sj) continue;
      var lin = (sj.datos.linea || sj.datos.h * 0.86) / sj.datos.h * q;
      var by = hz + 2 + hunde * q * 0.75 + Math.sin(E.t * 0.0017 + i * 1.3) * (0.6 + est.oleaje * 2.5);
      var inc = hunde * 0.7 * (i % 2 ? 1 : -1) + Math.sin(E.t * 0.0013 + i) * 0.025 * (1 + est.oleaje * 5);
      ctx.save(); ctx.translate(bx, by); ctx.rotate(inc); if (izq) ctx.scale(-1, 1);
      ctx.globalAlpha = (1 - hunde * 0.5) * vis; ctx.drawImage(sj.c, -q / 2, -lin, q, q);
      ctx.restore();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  function isla(ctx) {   // Ganryūjima: una isla pequeña y baja con sus pinos
    var p = P.isla, cx = E.sx(L.isla, p), u = E.u, y = E.H * 0.735, w = u * 0.16, vis = enMar(cx);
    if (vis <= 0 || cx + u * 0.2 < 0 || cx - u * 0.2 > E.W) return;
    var si = obtenerGrande('isla');
    if (!si) return;
    var ki = si.w / si.datos.w; ctx.globalAlpha = vis; ctx.drawImage(si.c, cx - si.w / 2, y - si.datos.agua * ki, si.w, si.h); ctx.globalAlpha = 1;
  }
  PA.islaEnPantalla = function () { return [E.sx(L.isla, P.isla), E.H * 0.72, E.u * 0.16]; };

  /* ------------------------------------------------------------------ la llanura de Sekigahara (con estandartes) */
  // un nobori: el estandarte alto de los ejércitos, colgado de un mástil con un travesaño arriba; la tela ondea
  // (la onda recorre la tela de arriba abajo) y lleva el emblema del clan en un círculo de papel
  function estandarte(ctx, x, y, alto, col, ondea, a) {
    if (a <= 0.01 || alto < 2) return;
    var w = alto * 0.24, h = alto * 0.7, top = y - alto, fase = ondea * 0.6 + x * 0.05, i;
    ctx.strokeStyle = U.rgba(C.tinta, 0.85 * a); ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(0.8, alto * 0.018); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, top - alto * 0.04); ctx.stroke();
    var bx = w * 1.04 + ondea * 0.15;
    ctx.lineWidth = Math.max(0.7, alto * 0.012); ctx.beginPath(); ctx.moveTo(x, top + alto * 0.01); ctx.lineTo(x + bx, top + alto * 0.01 + ondea * 0.2); ctx.stroke();
    // la tela: borde izquierdo en el mástil, el derecho y el de abajo ondean
    ctx.fillStyle = U.rgba(col, 0.88 * a); ctx.beginPath(); ctx.moveTo(x, top + alto * 0.012);
    ctx.lineTo(x + bx, top + alto * 0.012 + ondea * 0.2);
    for (i = 1; i <= 8; i++) { var k = i / 8, o = Math.sin(fase + k * 3.2) * ondea * (0.3 + k * 0.7); ctx.lineTo(x + w + o, top + alto * 0.012 + h * k); }
    for (i = 8; i >= 0; i--) { var k2 = i / 8, o2 = Math.sin(fase + 3.2 + k2 * 2) * ondea * 0.5; ctx.lineTo(x + w * k2 + o2 * k2, top + alto * 0.012 + h + o2 * 0.4); }
    ctx.closePath(); ctx.fill();
    // el emblema: un círculo de papel con una marca (bando oscuro: tres barras; bando rojo: un punto)
    var cx = x + w * 0.52 + Math.sin(fase + 0.8) * ondea * 0.25, cy = top + h * 0.26, cr = w * 0.26;
    ctx.fillStyle = U.rgba(C.papel, 0.9 * a); ctx.beginPath(); ctx.arc(cx, cy, cr, 0, TAU); ctx.fill();
    ctx.fillStyle = U.rgba(col, 0.9 * a);
    if (col[0] < 120) { for (i = -1; i <= 1; i++) ctx.fillRect(cx - cr * 0.55, cy + i * cr * 0.42 - cr * 0.1, cr * 1.1, cr * 0.2); }
    else { ctx.beginPath(); ctx.arc(cx, cy, cr * 0.38, 0, TAU); ctx.fill(); }
  }
  PA.estandarte = estandarte;
  function llanura(ctx) {
    var p = P.llanura, u = E.u;
    var a = E.sx(L.llanura[0], p), b = E.sx(L.llanura[1], p);
    if (b < -50 || a > E.W + 50) return;
    // matas grises en la llanura, más pequeñas cuanto más lejos
    var r = U.azar(33), cam = new Path2D();
    for (var i = 0; i < 70; i++) {
      var xu = L.llanura[0] + r() * (L.llanura[1] - L.llanura[0]), fy = r(), x = E.sx(xu, p), y = E.H * (0.765 + fy * 0.045), h = u * (0.006 + r() * 0.01) * (0.6 + fy * 0.7);
      var sw = viento(xu, 0) * 0.6 + Math.sin(E.t * 0.002 + xu * 9) * 0.08, n = 3 + Math.floor(r() * 3);
      for (var b = 0; b < n; b++) { var f = b / (n - 1) - 0.5, a2 = f * 0.9 + sw, w = u * 0.0012; cam.moveTo(x - w + f * h * 0.3, y); cam.quadraticCurveTo(x + f * h * 0.3 + Math.sin(a2 * 0.5) * h * 0.5, y - h * 0.5, x + f * h * 0.3 + Math.sin(a2) * h, y - Math.cos(a2) * h); cam.lineTo(x + w + f * h * 0.3, y); }
    }
    ctx.fillStyle = U.rgba(C.tinta, 0.4); ctx.fill(cam);
    var ba = 1 - est.estandartes;
    if (ba > 0.01) for (var k = 0; k < 7; k++) {
      var xk = E.sx(L.llanura[0] + 0.25 + k * 0.13 + (k % 2) * 0.03, p), yk = E.H * (0.77 + (k % 3) * 0.008);
      estandarte(ctx, xk, yk, u * 0.05, k < 4 ? C.tinta : C.bermellon, Math.sin(E.t * 0.003 + k) * 2, 0.5 * ba);
    }
  }

  /* ------------------------------------------------------------------ el viento
     Una brisa de fondo, ráfagas que recorren el mundo de izquierda a derecha (todo lo que toca se mueve a la vez, en
     orden) y lo que añade el ratón. Lo usan la hierba, el bambú, la ropa del rōnin, los pétalos y las nieblas. */
  function viento(xu, retraso) {
    var t = E.t * 0.001 - (retraso || 0), brisa = 0.12 + 0.06 * Math.sin(t * 0.37);
    var rafaga = Math.pow(Math.max(0, Math.sin((t * 0.55 - xu * 0.32) * 1.3)), 6) * 0.55;   // frente de ráfaga que avanza
    return brisa + rafaga + E.viento * 0.9;
  }
  PA.viento = viento;

  /* ------------------------------------------------------------------ primer plano */
  var bambu = [];
  function prepararBambu() {
    if (bambu.length) return;
    var r = U.azar(44), n = 12;
    for (var i = 0; i < n; i++) bambu.push({ xu: L.bambu[0] + (i + r() * 0.6) * (L.bambu[1] - L.bambu[0]) / n, ancho: 0.011 + r() * 0.006, ang: 0, vel: 0, fase: r() * TAU, curva: (r() - 0.5) * 0.04, tono: 0.6 + r() * 0.35 });
  }
  PA.bambu = bambu;
  // el bosque de bambú a tinta (SA.arte.bambu*): piezas pintadas una vez y montadas en cada fotograma; las cañas más
  // claras (más lejos) primero. Detrás, un bosquecillo gris perdido en la niebla.
  var piezasBambu = null;
  function piezas() {
    var alto = E.H * 1.02;
    if (!piezasBambu || piezasBambu.alto !== alto || piezasBambu.dpr !== E.dpr) piezasBambu = A.bambuPiezas(alto, { dpr: E.dpr });
    return piezasBambu;
  }
  PA.prepararBambu = function () { if (A.bambuPiezas) piezas(); };
  var ordenBambu = null;
  function pintarBambuFondo() { return A.bambuFondo(E.u * 1.25, E.H, { dpr: Math.min(E.dpr, 1.5), piezas: piezas(), suelo: 0.865 }); }
  function dibujarBambuFondo(ctx) {
    var cx = E.sx((L.bambu[0] + L.bambu[1]) / 2, 0.92), w = E.u * 1.25;
    if (cx + w / 2 < 0 || cx - w / 2 > E.W || !A.bambuFondo) return;
    var s = spriteTinta('bambuFondo', w, E.H, pintarBambuFondo, 1.5);
    ctx.drawImage(s.c, cx - w / 2, 0, w, E.H);
  }
  function dibujarBambu(ctx) {
    prepararBambu();
    var u = E.u;
    if (!A.dibujarBambu) return;
    if (!ordenBambu) ordenBambu = bambu.map(function (b, i) { return i; }).sort(function (a, c) { return bambu[a].tono - bambu[c].tono; });
    var pz = null;
    ordenBambu.forEach(function (i) {
      var b = bambu[i], x = E.sx(b.xu); if (x < -u * 0.3 || x > E.W + u * 0.3) return;
      pz = pz || piezas();
      A.dibujarBambu(ctx, x, suelo(b.xu), E.H * 1.02, b.ancho * u, b.ang, b.curva, pz, {
        viento: viento(b.xu, 0.1) * 1.2 + b.ang * 2, t: E.t, tono: b.tono, semilla: i + 1, corte: est.corte && est.corte.i === i ? est.corte : null, u: u, H: E.H
      });
    });
  }
  function actualizarBambu(dt) {
    var p = E.puntero, u = E.u;
    bambu.forEach(function (b) {
      var x = E.sx(b.xu), empuje = 0;
      if (p.sobre && p.y > E.H * 0.1 && p.y < E.H * 0.9) { var dx = x - p.x, alcance = u * 0.09; if (Math.abs(dx) < alcance) empuje = Math.sign(dx || 1) * (1 - Math.abs(dx) / alcance) * (0.04 + U.clamp(p.velocidad, 0, 3) * 0.05); }
      var objetivo = empuje + viento(b.xu, 0) * 0.07 * (0.8 + 0.4 * Math.sin(E.t * 0.0015 + b.fase)) + 0.01 * Math.sin(E.t * 0.0008 + b.fase);
      // muelle amortiguado, en subpasos de 16 ms como mucho (con pasos largos se volvería inestable)
      for (var resto = Math.min(dt, 200); resto > 0; resto -= 16) {
        var h = Math.min(16, resto) / 16;
        b.vel += ((objetivo - b.ang) * 0.02 - b.vel * 0.08) * h; b.ang += b.vel * h;
      }
      b.ang = U.clamp(b.ang, -0.5, 0.5);
    });
  }

  /* --- la hierba del camino: matas de tamaños muy distintos, agrupadas por zonas (hay tramos pelados y tramos espesos);
     cada hoja se curva y se dobla más en la punta con el viento, y se aparta del pincel --- */
  function hierba(ctx) {
    var u = E.u, p = E.puntero, paso = 0.028, desde = Math.floor(E.xuDe(-40) / paso), hasta = Math.ceil(E.xuDe(E.W + 40) / paso);
    var caminos = [new Path2D(), new Path2D()];   // negra y gris (las de detrás)
    for (var n = desde; n <= hasta; n++) {
      var xu = n * paso + U._h(n) * paso * 0.9, dens = U.fbm(xu * 2.6, 7, 3);
      if (U._h(n + 9) > dens * 1.45 - 0.22) continue;
      var grande = dens > 0.56 && U._h(n + 5) < 0.45, gris = !grande && U._h(n + 13) < 0.3;
      var gx = E.sx(xu), gy = suelo(xu) + u * (gris ? -0.003 : 0.004);
      var hojas = grande ? 7 + Math.floor(U._h(n + 2) * 9) : 2 + Math.floor(U._h(n + 2) * 4);
      var alto = u * (grande ? 0.032 + U._h(n + 4) * 0.05 : 0.01 + U._h(n + 4) * 0.022) * (gris ? 0.8 : 1);
      var sw = PA.viento(xu, 0) * 0.7 + Math.sin(E.t * 0.0023 + n * 1.7) * 0.06 * (0.5 + dens);
      if (p.sobre && Math.abs(p.x - gx) < u * 0.06 && Math.abs(p.y - gy) < u * 0.09) sw += (gx - p.x) / (u * 0.06) * 0.6;
      var cam = caminos[gris ? 1 : 0];
      for (var b = 0; b < hojas; b++) {
        var f = hojas > 1 ? b / (hojas - 1) - 0.5 : 0, hb = U._h(n * 7 + b), la = alto * (0.45 + hb * 0.75) * (1 - Math.abs(f) * 0.35);
        var a0 = f * (grande ? 1.25 : 0.9) + (hb - 0.5) * 0.25, flex = 0.35 + hb * 0.5, w = u * (grande ? 0.0028 : 0.002) * (0.7 + hb * 0.6);
        var bx = gx + f * alto * 0.35, aT = a0 + sw * flex * 1.3, aM = a0 * 0.6 + sw * flex * 0.45;
        var mx = bx + Math.sin(aM) * la * 0.5, my = gy - Math.cos(aM) * la * 0.5, tx = bx + Math.sin(aT) * la, ty = gy - Math.cos(aT) * la * (1 - Math.max(0, Math.abs(aT) - 1.1) * 0.4);
        cam.moveTo(bx - w, gy); cam.quadraticCurveTo(mx - w * 0.5, my, tx, ty); cam.quadraticCurveTo(mx + w * 0.5, my, bx + w, gy); cam.closePath();
      }
    }
    ctx.fillStyle = U.rgba(C.tinta, 0.42); ctx.fill(caminos[1]);
    ctx.fillStyle = U.rgba(C.tinta, 0.9); ctx.fill(caminos[0]);
  }

  /* --- cuervos posados en el pino que salen volando si te acercas --- */
  var cuervos = [];
  function prepararCuervos() {
    if (cuervos.length) return;
    for (var i = 0; i < 5; i++) cuervos.push({ dxu: (i - 2) * 0.035 + (i % 2) * 0.01, dyu: 0.01 * (i % 3), estado: 'posado', t0: 0, vx: 0, vy: 0, x: 0, y: 0 });
  }
  // los cuervos, a tinta (sprites de SA.arte.cuervos): posados, o volando con cuatro fases de ala
  var spCuervos = null;
  function cuervo(ctx, x, y, s, aleteo, posado, i) {
    var tam = Math.round(s * 2.4 * E.dpr);
    if (!spCuervos || spCuervos.tam !== tam) { spCuervos = A.cuervos(tam); spCuervos.tam = tam; }
    var L = posado ? spCuervos.posado[(i || 0) % 3] : spCuervos.vuelo[((Math.floor(aleteo / 1.4) % 4) + 4) % 4], w = s * 2.4;
    ctx.drawImage(L.c, x - w / 2, y - w * 0.62, w, w);
  }
  function actualizarCuervos(dt) {
    prepararCuervos();
    var p = E.puntero, u = E.u, bx = E.sx(L.cuervos), by = E.H * 0.505, ac = PA._acantilado;
    if (ac && ac.pino.datos.pads && ac.pino.datos.pads.length > 1) {   // sobre la almohadilla más alta de la derecha
      var pads = ac.pino.datos.pads.slice().sort(function (a, b) { return a.y - b.y; }), pd = pads[0];
      for (var ip = 0; ip < pads.length; ip++) if (pads[ip].x > pd.x && pads[ip].y < pd.y + pd.h * 2) pd = pads[ip];
      bx = ac.px + pd.x * ac.kp; by = ac.py + (pd.y - pd.h * 0.55) * ac.kp;
    }
    cuervos.forEach(function (c, i) {
      var px = bx + c.dxu * u, py = by + c.dyu * u;
      if (c.estado === 'posado') {
        c.x = px; c.y = py;
        if (p.sobre && Math.hypot(p.x - px, p.y - py) < u * 0.12) { c.estado = 'volando'; c.t0 = E.t; c.vx = 0.15 + i * 0.03; c.vy = -0.18 - (i % 3) * 0.05; }
      } else if (c.estado === 'volando') {
        c.x += c.vx * dt; c.y += c.vy * dt; c.vy *= Math.pow(0.995, dt / 16);
        if (E.t - c.t0 > 20000) { c.estado = 'volviendo'; c.t0 = E.t; c.x = E.W + 40; c.y = E.H * 0.2; }
      } else {
        var k = U.clamp((E.t - c.t0) / 4000, 0, 1); c.x = U.lerp(E.W + 40, px, U.sale(k)); c.y = U.lerp(E.H * 0.2, py, U.sale(k)) - Math.sin(k * Math.PI) * u * 0.08;
        if (k >= 1) c.estado = 'posado';
      }
    });
  }

  /* --- pétalos que el viento del ratón empuja (de ciruelo: rojos) --- */
  var petalos = [];
  function prepararPetalos() { if (petalos.length) return; var r = U.azar(66); for (var i = 0; i < 16; i++) petalos.push({ x: r() * 1400, y: r() * 900, vx: 0.02, vy: 0.02, a: r() * TAU, va: (r() - 0.5) * 0.004, s: 2.4 + r() * 2.4 }); }
  function actualizarPetalos(dt) {
    prepararPetalos();
    var p = E.puntero, extra = Math.round(est.florecer * 70);
    while (petalos.length < 16 + extra) {
      var cz = PA._cerezo, ox, oy;
      if (cz && cz.petalos && cz.petalos.length) { var pp = cz.petalos[Math.floor(Math.random() * cz.petalos.length)]; ox = cz.x + pp[0] * cz.k; oy = cz.y + pp[1] * cz.k; }
      else { ox = E.sx(L.cerezo) + (Math.random() - 0.5) * E.u * 0.5; oy = E.H * (0.2 + Math.random() * 0.3); }
      petalos.push({ x: ox, y: oy, vx: 0.03, vy: 0.02, a: Math.random() * TAU, va: (Math.random() - 0.5) * 0.006, s: 2.2 + Math.random() * 2.4, rosa: true });
    }
    if (petalos.length > 16 + extra) petalos.length = 16 + extra;
    petalos.forEach(function (pt, i) {
      if (p.sobre) { var d = Math.hypot(pt.x - p.x, pt.y - p.y); if (d < E.u * 0.15) { pt.vx += (p.vx || 0) * 0.0006 * (1 - d / (E.u * 0.15)) * dt; pt.vy -= 0.0004 * dt * (1 - d / (E.u * 0.15)) * U.clamp(p.velocidad, 0, 2); } }
      var vto = viento(E.xuDe(pt.x), 0);
      pt.vx += (0.02 + vto * 0.12 - pt.vx) * 0.01 * dt / 16; pt.vy += (0.022 - pt.vy) * 0.01 * dt / 16;
      pt.x += (pt.vx + Math.sin(E.t * 0.0013 + i) * 0.02) * dt - (E.camVelPantalla || 0); pt.y += pt.vy * dt; pt.a += pt.va * dt;
      if (pt.y > E.H + 10 || pt.x > E.W + 20 || pt.x < -40) { pt.x = Math.random() * E.W * 0.7 - 20; pt.y = -10 - Math.random() * E.H * 0.3; pt.vx = 0.03; pt.vy = 0.02; }
    });
  }
  function dibujarPetalos(ctx) {
    petalos.forEach(function (pt, i) {
      ctx.fillStyle = U.rgba(pt.rosa ? (i % 3 ? [236, 168, 176] : [248, 214, 216]) : i % 4 === 3 ? C.sakura : T.color.rojo, 0.85);
      ctx.save(); ctx.translate(pt.x, pt.y); ctx.rotate(pt.a); ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.sin(E.t * 0.003 + i))); ctx.beginPath();
      ctx.moveTo(0, -pt.s); ctx.quadraticCurveTo(pt.s * 0.9, -pt.s * 0.2, 0, pt.s); ctx.quadraticCurveTo(-pt.s * 0.9, -pt.s * 0.2, 0, -pt.s); ctx.fill(); ctx.restore();
    });
  }

  /* --- nieve (47 rōnin) --- */
  var copos = [];
  function nieve(ctx, dt) {
    if (E.nieve < 0.01) { copos.length = 0; return; }
    while (copos.length < 220 * E.nieve) copos.push({ x: Math.random() * E.W, y: -Math.random() * E.H, v: 0.02 + Math.random() * 0.05, s: 1 + Math.random() * 2.2, f: Math.random() * TAU });
    ctx.fillStyle = U.rgba(C.papel, 0.9 * E.nieve);
    copos.forEach(function (c) {
      c.y += c.v * (dt || 16); c.x += Math.sin(E.t * 0.001 + c.f) * 0.3 + E.viento * 2;
      if (c.y > E.H) { c.y = -5; c.x = Math.random() * E.W; }
      ctx.beginPath(); ctx.arc(c.x, c.y, c.s, 0, TAU); ctx.fill();
    });
  }

  /* ------------------------------------------------------------------ el rōnin
     Va por el camino al ritmo del rollo: el mundo pasa bajo sus pies y él anda (o corre) lo justo para que los pies no
     resbalen. Mirando hacia donde avanzas, a un tercio de la pantalla; si das la vuelta, se gira y cruza al otro lado.
     Quieto, respira; la ropa, el pelo y los cordones van con el viento. */
  var heroe = { sx: 0.36, dir: 1, fase: 0, vel: 0, mezcla: 1, quieto: 1, vto: 0.2, ultimaCam: null, giro: 0, largo: 1, corre: 0, medita: 0, accion: null };
  var ALTO_HEROE = 0.2, pisadas = [];
  function actualizarHeroe(dt) {
    var h = heroe, s = dt / 1000;
    if (h.ultimaCam == null) h.ultimaCam = E.camX;
    var dx = (E.camX - h.ultimaCam) / E.u; h.ultimaCam = E.camX;      // cuánto ha pasado el mundo (u)
    var v = s > 0 ? dx / s : 0;                                        // u/s
    h.vel = h.vel + (v - h.vel) * Math.min(1, s * 8);
    if (Math.abs(h.vel) > 0.04 && Math.sign(h.vel) !== h.dir) { h.giro += s; if (h.giro > 0.12) { h.dir = Math.sign(h.vel); h.giro = 0; } } else h.giro = 0;
    // su sitio en la pantalla: a un tercio, del lado de donde viene
    // durante un secreto, la tarjeta ocupa la izquierda: él se aparta a la derecha (sin interrumpir lo que esté haciendo)
    var objetivo = E.escena ? 0.62 : h.dir > 0 ? 0.36 : 0.64, antes = h.sx;
    var ocupado = h.accion && h.accion.tipo === 'iai' || h.medita > 0.3;
    if (!ocupado) h.sx += (objetivo - h.sx) * Math.min(1, s * (E.escena ? 0.9 : 1.6));
    if (E.escena && !ocupado && Math.abs(objetivo - h.sx) > 0.01) h.dir = objetivo > h.sx ? 1 : -1;
    var propio = (h.sx - antes) * E.W / E.u;                           // lo que anda él por la pantalla
    var andado = Math.abs(dx + propio), vu = andado / Math.max(s, 1e-3);
    var moviendo = vu > 0.02;
    h.quieto = moviendo ? 0 : h.quieto + s;
    h.mezcla += ((moviendo ? 0 : h.quieto > 0.25 ? 1 : h.mezcla) - h.mezcla) * Math.min(1, s * 6);
    // anda (la zancada crece con la velocidad) y, si vas deprisa, corre; la fase avanza lo que avanzan los pies
    // (corriendo muy deprisa, la cadencia se limita a 3 zancadas por segundo: el viento y la tinta esconden el resto)
    h.largo += (U.clamp(0.75 + vu * 1.1, 0.75, 1.25) - h.largo) * Math.min(1, s * 4);
    h.corre += (U.suave((vu - 0.32) / 0.3) - h.corre) * Math.min(1, s * 5);
    var ciclo = U.lerp(F.AVANCE * h.largo, F.AVANCE_R, h.corre) * ALTO_HEROE, faseAntes = h.fase;
    h.fase += Math.min(andado / ciclo, s * U.lerp(2.2, 3, h.corre));
    // al correr, cada pisada levanta una salpicadura de tinta del camino
    if (h.corre > 0.4 && Math.floor(h.fase * 2) !== Math.floor(faseAntes * 2)) pisadas.push({ x: E.xuDe(h.sx * E.W) + h.dir * 0.012, t: E.t, sem: Math.floor(h.fase * 2), dir: h.dir });
    for (var ip = pisadas.length - 1; ip >= 0; ip--) if (E.t - pisadas[ip].t > 700) pisadas.splice(ip, 1);
    h.rapidez = vu;
    h.vto = h.vto + (viento(E.xuDe(h.sx * E.W), 0.05) - h.vto) * Math.min(1, s * 3);
    // si te quedas quieto un buen rato, se arrodilla a meditar; en cuanto te mueves, se levanta
    var quiereMeditar = (!E.escena && h.quieto > 22) || (h.accion && h.accion.tipo === 'reverencia' && E.t - h.accion.t0 > 1500);
    h.medita += ((quiereMeditar ? 1 : 0) - h.medita) * Math.min(1, s * (quiereMeditar ? 0.9 : 3.5));
    if (h.accion && h.accion.dur && E.t - h.accion.t0 > h.accion.dur) h.accion = null;
  }
  function dibujarHeroe(ctx) {
    var h = heroe, x = h.sx * E.W, xu = E.xuDe(x), y = suelo(xu) + E.u * 0.004, alto = E.u * ALTO_HEROE;
    var vto = h.vto + Math.min(0.6, Math.abs(h.vel) * 0.3);   // la ropa vuela hacia atrás (más si va deprisa)
    var fase = ((h.fase % 1) + 1) % 1, Pq = F.quieto(E.t * 0.001, { viento: vto }), Pa = F.andar(fase, { viento: vto, largo: h.largo, t: E.t * 0.001 });
    if (h.corre > 0.02) Pa = F.mezclar(Pa, F.correr(fase, { viento: vto, t: E.t * 0.001 }), h.corre);
    var P = F.mezclar(Pa, Pq, h.mezcla), arco = null;
    // las acciones: el iaidō (desenvainar y cortar) y la reverencia de rodillas
    if (h.accion && h.accion.tipo === 'iai') { var Pi = F.iai(U.clamp((E.t - h.accion.t0) / h.accion.dur, 0, 1), { viento: vto, t: E.t * 0.001 }); arco = Pi.arco; P = Pi; }
    if (h.medita > 0.01) P = F.mezclar(P, F.seiza(E.t * 0.001, { viento: vto, inclina: h.accion && h.accion.tipo === 'reverencia' ? 0.55 * U.suave((E.t - h.accion.t0 - 1800) / 1500) : 0 }), U.suave(h.medita));
    ctx.fillStyle = U.rgba(C.tinta, 0.22); ctx.beginPath(); ctx.ellipse(x, y + 1, alto * 0.2, alto * 0.016, 0, 0, TAU); ctx.fill();
    // corriendo: estelas de pincel seco detrás (el aire que deja), que tiemblan
    var vel = U.clamp(((h.rapidez || 0) - 0.35) / 1.2, 0, 1) * h.corre;
    if (vel > 0.02) {
      var st = Math.floor(E.t / 70);
      for (var e = 0; e < 7; e++) {
        var he = U._h(e * 5.3 + st * 0.37), yy = y - alto * (0.15 + e * 0.13 + he * 0.06), lx = alto * (0.4 + he * 1.2) * vel, x0 = x - h.dir * alto * (0.12 + he * 0.1);
        ctx.fillStyle = U.rgba(C.tinta, (0.1 + 0.14 * he) * vel);
        ctx.beginPath(); ctx.moveTo(x0, yy - 1); ctx.quadraticCurveTo(x0 - h.dir * lx * 0.4, yy - alto * 0.008, x0 - h.dir * lx, yy); ctx.quadraticCurveTo(x0 - h.dir * lx * 0.4, yy + alto * 0.004, x0, yy + 1); ctx.fill();
      }
    }
    // las salpicaduras de las pisadas
    pisadas.forEach(function (pd) {
      var e2 = (E.t - pd.t) / 700, px = E.sx(pd.x), py = suelo(pd.x), r = U.azar(pd.sem * 7 + 3);
      ctx.fillStyle = U.rgba(C.tinta, 0.7 * (1 - e2));
      for (var g = 0; g < 7; g++) {
        var an = -Math.PI / 2 - pd.dir * (0.6 + r() * 1.2), d = alto * (0.02 + r() * 0.08) * Math.min(1, e2 * 3), rr = alto * (0.004 + r() * 0.008) * (1 - e2 * 0.6);
        ctx.beginPath(); ctx.arc(px + Math.cos(an) * d, py + Math.sin(an) * d * 0.7 + e2 * e2 * alto * 0.05, rr, 0, TAU); ctx.fill();
      }
    });
    F.dibujar(ctx, P, 'ronin', alto, x, y, h.dir < 0);
    // el tajo del iaidō: una media luna de tinta que sigue a la hoja
    if (arco) {
      var cx = x + h.dir * alto * 0.06, cy = y - alto * 0.58, rr = alto * 0.78, pts = [];
      for (var k = 0; k <= 10; k++) { var an = U.lerp(arco[0], arco[1], k / 10); pts.push([cx + Math.cos(an) * rr * h.dir, cy + Math.sin(an) * rr]); }
      FX.trazo(pts, alto * 0.05, 0.7);
    }
  }
  PA.heroe = heroe;
  // para las escenas que pintan algo delante del paisaje (una colina, una niebla) y quieren al rōnin por encima
  PA.dibujarHeroeEncima = function (ctx) { if (E.escena && E.escena.s.heroeEncima) dibujarHeroe(ctx); };
  // los secretos piden gestos al rōnin: 'iai' (desenvaina y corta; op.hacia = x de pantalla a la que mira) o 'reverencia'
  PA.heroeAccion = function (tipo, op) {
    op = op || {};
    if (op.hacia != null) { heroe.dir = op.hacia >= heroe.sx * E.W ? 1 : -1; }
    heroe.accion = { tipo: tipo, t0: E.t, dur: tipo === 'iai' ? 1400 : op.dur || 0 };
    if (tipo === 'reverencia') heroe.quieto = 30;
  };

  /* ------------------------------------------------------------------ vida en el aire: bandadas, motas de tinta y hierba alta desenfocada */
  // una bandada cruza el cielo de vez en cuando: pájaros de dos trazos que aletean, en cuña suelta, lejos (paralaje bajo)
  var bandada = null, proxBandada = 4000;
  function actualizarBandada(dt) {
    if (!bandada) {
      proxBandada -= dt;
      if (proxBandada <= 0) {
        var izq = Math.random() < 0.5, n = 5 + Math.floor(Math.random() * 7);
        bandada = { t: 0, dur: 16000 + Math.random() * 6000, dir: izq ? 1 : -1, y: 0.14 + Math.random() * 0.2, p: 0.25 + Math.random() * 0.15, aves: [] };
        for (var i = 0; i < n; i++) bandada.aves.push({ dx: -i * 0.035 * (0.8 + Math.random() * 0.4), dy: (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.016 + (Math.random() - 0.5) * 0.01, f: Math.random() * TAU, s: 0.8 + Math.random() * 0.4 });
        proxBandada = 22000 + Math.random() * 20000;
      }
      return;
    }
    bandada.t += dt; if (bandada.t > bandada.dur) bandada = null;
  }
  function dibujarBandada(ctx) {
    if (!bandada) return;
    var b = bandada, k = b.t / b.dur, u = E.u, x0 = b.dir > 0 ? U.lerp(-0.3 * E.W, 1.3 * E.W, k) : U.lerp(1.3 * E.W, -0.3 * E.W, k);
    x0 -= E.camVelPantalla * 0;   // el cielo apenas se mueve con el rollo
    ctx.strokeStyle = U.rgba(C.tinta, 0.75); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    b.aves.forEach(function (a) {
      var x = x0 + a.dx * u * b.dir * -1, y = b.y * E.H + a.dy * u + Math.sin(b.t * 0.0013 + a.f) * u * 0.006, s = u * 0.011 * a.s, al = Math.sin(b.t * 0.012 + a.f);
      ctx.lineWidth = Math.max(0.8, s * 0.16); ctx.beginPath();
      ctx.moveTo(x - s, y - s * 0.55 * al); ctx.quadraticCurveTo(x - s * 0.4, y - s * 0.35 * Math.abs(al) - s * 0.1, x, y);
      ctx.quadraticCurveTo(x + s * 0.4, y - s * 0.35 * Math.abs(al) - s * 0.1, x + s, y - s * 0.55 * al); ctx.stroke();
    });
  }
  // motas de tinta que flotan en el aire con el viento (en tres profundidades)
  var motas = [];
  function dibujarMotas(ctx, dt) {
    if (!motas.length) for (var i = 0; i < 26; i++) motas.push({ x: Math.random(), y: Math.random(), p: [0.4, 0.7, 1.15][i % 3], f: Math.random() * TAU, s: 0.6 + Math.random() * 1.6 });
    motas.forEach(function (m) {
      var vto = viento(E.xuDe(m.x * E.W), 0);
      m.x += (vto * 0.00003 * m.p * dt) - (E.camVelPantalla || 0) * m.p / E.W; m.y += Math.sin(E.t * 0.0007 + m.f) * 0.00002 * dt;
      if (m.x > 1.05) m.x -= 1.1; if (m.x < -0.05) m.x += 1.1; if (m.y > 1) m.y -= 1; if (m.y < 0) m.y += 1;
      ctx.fillStyle = U.rgba(C.tinta, 0.18 + 0.2 * (m.p > 1 ? 1 : m.p));
      ctx.beginPath(); ctx.arc(m.x * E.W, m.y * E.H * 0.82, m.s * m.p, 0, TAU); ctx.fill();
    });
  }
  // hierba alta muy cerca de la cámara: desenfocada, oscura, pasa más deprisa que el camino (profundidad de campo)
  var HIERBA_CERCA = [1.05, 3.1, 5.6, 8.1, 10.25];
  function hierbaCerca(ctx) {
    var p = 1.45;
    HIERBA_CERCA.forEach(function (xu, i) {
      var x = E.sx(xu, p), w = E.u * 0.5, h = E.u * 0.27;
      if (x + w * 0.7 < 0 || x - w * 0.7 > E.W) return;
      var s = spriteTinta('hierbaCerca' + (i % 3), w, h, pintarHierbaCerca(i % 3), 1);
      var vaiven = (viento(xu, 0.15) - 0.15) * 0.05 + Math.sin(E.t * 0.0011 + i) * 0.012;
      ctx.save(); ctx.translate(x, E.H + E.u * 0.03); ctx.rotate(vaiven); if (i % 2) ctx.scale(-1, 1); ctx.globalAlpha = 0.82; ctx.drawImage(s.c, -w * 0.38, -h, w, h); ctx.restore();
    });
  }
  function pintarHierbaCerca(i) { return function (pw, ph, d) { var g = hierbaCercaPasos(i, pw, ph, d), p = g.next(); while (!p.done) p = g.next(); return p.value; }; }
  function* hierbaCercaPasos(i, pw, ph, d) {
    // una mata de hierba alta muy cerca de la cámara: hojas largas y finas que se abren en abanico y se doblan con su
    // peso, oscuras; luego desenfocada (se lee como profundidad de campo). Ninguna hoja se sale del lienzo (si una se
    // recortara, ya desenfocada se vería como un borde recto): si se iba a salir, se abre menos
    var Lz = T.lienzo(pw, ph), r = T.azar(90 + i), n = 34 + Math.floor(r() * 14), m = pw * 0.1;
    function hoja(raiz, abre, la, dobla) {
      var pts = [];
      for (var k = 0; k <= 10; k++) {
        var t2 = k / 10, ang = -Math.PI / 2 + abre * 0.35 * t2 + dobla * t2 * t2 * 1.6;
        pts.push([raiz + Math.cos(ang) * la * t2 * 0.9 + abre * pw * 0.12 * t2, ph * 0.97 + Math.sin(ang) * la * t2]);
      }
      return pts;
    }
    for (var b = 0; b < n; b++) {
      var raiz = pw * (0.38 + (r() - 0.5) * 0.18), abre = (r() - 0.5) * 2, la = ph * (0.35 + Math.pow(r(), 0.6) * 0.55), dobla = abre * (0.25 + r() * 0.35);
      var pts = hoja(raiz, abre, la, dobla), intento = 0;
      while (intento++ < 6 && pts.some(function (q) { return q[0] < m || q[0] > pw - m || q[1] < m; })) { abre *= 0.7; dobla *= 0.7; la *= 0.92; pts = hoja(raiz, abre, la, dobla); }
      T.pincelada(Lz.x, pts, { ancho: pw * (0.009 + r() * 0.012), alfa: 0.85 + r() * 0.15, carga: 1, seco: 0.1, entrada: 0.02, salida: 0.95, semilla: Math.floor(r() * 1e6), cerdas: 6, rugoso: 0.08 });
      if (b % 10 === 9) yield 'hierba';
    }
    yield 'hierba';
    // la base de la mata
    Lz.x.fillStyle = T.rgba(T.color.tinta, 0.9); Lz.x.beginPath(); Lz.x.ellipse(pw * 0.38, ph, pw * 0.16, ph * 0.05, 0, 0, TAU); Lz.x.fill();
    return T.desenfocar(Lz, Math.max(3, pw * 0.012), T.lienzo(pw, ph));
  }

  /* ------------------------------------------------------------------ ramas de ciruelo que asoman por arriba (delante de todo) */
  var CIRUELOS = [
    { xu: 0.62, p: 1.18, w: 0.62, h: 0.5, semilla: 21, desde: 'arriba' },
    { xu: 4.55, p: 1.22, w: 0.8, h: 0.48, semilla: 8, desde: 'derecha' },
    { xu: 9.25, p: 1.2, w: 0.9, h: 0.5, semilla: 33, desde: 'izquierda' }
  ];
  function pintarCiruelo(i) { var c = CIRUELOS[i]; return function (pw, ph) { return A.ciruelo(pw, ph, { semilla: c.semilla, desde: c.desde }); }; }
  function ciruelos(ctx) {
    CIRUELOS.forEach(function (c, i) {
      var x = E.sx(c.xu, c.p), w = c.w * E.u, h = c.h * E.u;
      if (x > E.W + 4 || x + w < -4) return;
      var s = spriteTinta('ciruelo' + i, w, h, pintarCiruelo(i));
      var vaiven = Math.sin(E.t * 0.0007 + i) * 0.006 + (viento(c.xu, 0.2) - 0.15) * 0.012;
      // se mece desde el punto por donde entra (el borde de arriba, o el lado)
      var ax = c.desde === 'derecha' ? x + w : c.desde === 'arriba' ? x + w * 0.3 : x;
      ctx.save(); ctx.translate(ax, -E.u * 0.01); ctx.rotate(vaiven * (c.desde === 'derecha' ? -1 : 1));
      ctx.drawImage(s.c, x - ax, 0, w, h); ctx.restore();
    });
  }

  /* ------------------------------------------------------------------ etiquetas al pasar el puntero */
  var ZONAS = [
    { k: '日', es: 'Sol', xu: [0.8, 1.1], yu: [0.15, 0.33], p: P.sol },
    { k: '富士山', es: 'Monte Fuji', xu: [1.1, 2.0], yu: [0.33, 0.62], p: P.fuji },
    { k: '松', es: 'Pino', xu: [1.45, 2.05], yu: [0.3, 0.66], p: 1 },
    { k: '竹林', es: 'Bosque de bambú', xu: [2.3, 3.1], yu: [0.05, 0.86], p: 1 },
    { k: '野', es: 'Llanura', xu: [3.3, 4.5], yu: [0.7, 0.82], p: P.llanura },
    { k: '城', es: 'Castillo', xu: [4.85, 5.15], yu: [0.5, 0.72], p: P.castillo },
    { k: '鳥居', es: 'Torii', xu: [5.2, 5.5], yu: [0.48, 0.88], p: 1 },
    { k: '船', es: 'Barcos', xu: [6.4, 7.1], yu: [0.64, 0.71], p: P.barcos },
    { k: '島', es: 'Isla', xu: [6.94, 7.22], yu: [0.68, 0.74], p: P.isla },
    { k: '海', es: 'Mar', xu: [5.9, 7.8], yu: [0.75, 0.84], p: 1 },
    { k: '桜', es: 'Cerezo', xu: [8.0, 8.7], yu: [0.2, 0.86], p: 1 },
    { k: '城山', es: 'Shiroyama', xu: [9.45, 10.25], yu: [0.55, 0.8], p: P.shiroyama }
  ];
  PA.zonaEn = function (sx, sy) {
    for (var i = ZONAS.length - 1; i >= 0; i--) {
      var z = ZONAS[i], a = E.sx(z.xu[0], z.p), b = E.sx(z.xu[1], z.p);
      if (sx >= a && sx <= b && sy >= z.yu[0] * E.H && sy <= z.yu[1] * E.H) return z;
    }
    return null;
  };
  function etiqueta(ctx) {
    var p = E.puntero; if (!p.sobre || E.escena) return;
    var z = PA.zonaEn(p.x, p.y); if (!z) return;
    var x = p.x + 18, y = p.y + 22;
    E.ctx.font = '400 16px "Shippori Mincho", serif'; var w = E.ctx.measureText(z.k).width;
    E.ctx.font = '400 10.5px "IBM Plex Mono", monospace'; var w2 = E.ctx.measureText('· ' + z.es.toUpperCase()).width + z.es.length * 1.3 + 10;
    ctx.fillStyle = U.rgba(C.papel, 0.82); ctx.fillRect(x - 6, y - 13, w + w2 + 16, 26);
    FX.texto(z.k, x, y, { mincho: true, tam: 16, a: 0.9, base: 'middle' });
    FX.texto('· ' + z.es.toUpperCase(), x + w + 8, y + 1, { tam: 10.5, a: 0.7, espaciado: 1.2 });
  }

  /* ------------------------------------------------------------------ dibujar todo */
  PA.dibujar = function (ctx) {
    if (!PA.listo) return;   // hasta que el taller ha pintado lo primero, solo papel (y el aviso de carga encima)
    revisarTam();
    var u = E.u, H = E.H, W = E.W;
    // el sol: baja y enrojece a lo largo del rollo
    var avance = E.maxCam() ? E.camX / E.maxCam() : 0, sx = E.sx(L.sol, P.sol) + avance * E.W * 0.25 + PA.inclX * (1 - P.sol), sy = H * (0.22 + 0.36 * avance * avance), sr = u * 0.085;
    PA.sol = [sx, sy, sr];
    if (avance > 0.7) FX.brillo(sx, sy, u * 0.5, C.bermellon, 0.12 * U.tramo(avance, 0.7, 1));
    if (est.sol > 0.01) {
      var ss = spriteTinta('sol', sr * 2.2, sr * 2.2, function (pw) { return A.sol(pw / 2.2); });
      ctx.globalAlpha = est.sol * (1 - Math.min(1, E.noche * 1.6)); ctx.drawImage(ss.c, sx - ss.w / 2, sy - ss.h / 2, ss.w, ss.h); ctx.globalAlpha = 1;
    }
    dibujarBandada(ctx);
    // el cielo de una escena (nubes de tormenta…): delante del sol y detrás de todas las montañas
    var esc = E.escena; if (esc && esc.s && esc.s.cielo) { try { esc.s.cielo(ctx, esc.t); } catch (err) { console.error(err); } }
    dibujarCapa(ctx, C_LEJOS);
    // el Fuji, entre la cordillera lejana y su niebla
    var fx = E.sx(L.fuji, P.fuji) + PA.inclX * (1 - P.fuji), fw = u * 0.78, fh = u * 0.36;
    if (fx + fw / 2 > 0 && fx - fw / 2 < W) { var sf = spriteTinta('fuji', fw, fh, function (pw, ph) { return A.fuji(pw, ph, { tono: 0.26 }); }, 1.5); ctx.drawImage(sf.c, fx - fw / 2, H * 0.705 - fh, fw, fh); }
    dibujarCapa(ctx, C_N1);
    dibujarCapa(ctx, C_MEDIO);
    dibujarCapa(ctx, C_N2);
    // el castillo sobre su colina, y más allá la pagoda: entre la cordillera media y la cercana, con el pie en la niebla
    edificio(ctx, 'castillo', L.castillo, P.castillo, 0.3, H * 0.735);
    edificio(ctx, 'pagoda', L.pagoda, P.pagoda, 0.15, H * 0.725);
    dibujarCapa(ctx, C_CERCA);
    dibujarCapa(ctx, C_N3);
    mar(ctx);
    dibujarCapa(ctx, C_COLINAS);
    llanura(ctx);
    dibujarCapa(ctx, C_N4);
    // Shiroyama
    if (colinaShiroyama(ctx, 1, true) && !(E.escena && E.escena.h && E.escena.h.id === 'ultimo-samurai')) {
      var cq = PA._cima;
      FX.figura(cq[0], cq[1] + 1, u * 0.05, { estilo: 'ultimo', cache: true });
    }
    primerPlano(ctx);
    etiqueta(ctx);
  };
  function edificio(ctx, nombre, xu, p, ancho, yPie) {
    var x = E.sx(xu, p) + PA.inclX * (1 - p), w = ancho * E.u;
    if (x + w / 2 < 0 || x - w / 2 > E.W) return;
    var s = obtenerGrande(nombre); if (s) ctx.drawImage(s.c, x - s.w / 2, yPie - s.h, s.w, s.h);
  }
  function primerPlano(ctx) {
    var W = E.W, u = E.u;
    // el acantilado con su pino (detrás del camino): la roca, el pino en la cima, un pino pequeño y los cuervos
    var ca = E.sx(L.acantilado);
    if (ca + u * 0.5 > 0 && ca - u * 0.5 < W) {
      var acan = situarAcantilado();
      if (acan) {
        // la roca tapa lo que hay detrás: su silueta se rellena de papel (las caras claras de la roca son papel)
        var cim = acan.roca.datos.cimas, kr = acan.roca.w / acan.roca.datos.w;
        if (cim && cim.length) {
          var g = ctx.createLinearGradient(0, acan.ry, 0, acan.ry + acan.roca.h);
          g.addColorStop(0, U.rgba(C.papel, 1)); g.addColorStop(0.8, U.rgba(C.papel, 1)); g.addColorStop(1, U.rgba(C.papel, 0));
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(acan.rx + cim[0][0] * kr, acan.ry + acan.roca.h);
          cim.forEach(function (q) { ctx.lineTo(acan.rx + q[0] * kr, acan.ry + q[1] * kr + 1.5); });
          ctx.lineTo(acan.rx + cim[cim.length - 1][0] * kr, acan.ry + acan.roca.h); ctx.closePath(); ctx.fill();
        }
        ctx.drawImage(acan.roca.c, acan.rx, acan.ry, acan.roca.w, acan.roca.h);
        if (acan.chico) ctx.drawImage(acan.chico.c, acan.cx, acan.cy, acan.chico.w, acan.chico.h);
        ctx.drawImage(acan.pino.c, acan.px, acan.py, acan.pino.w, acan.pino.h);
      }
      cuervos.forEach(function (c, i) { cuervo(ctx, c.x, c.y, u * 0.018, E.t * 0.02 + c.dxu * 40, c.estado === 'posado', i); });
    } else cuervos.forEach(function (c, i) { if (c.estado !== 'posado') cuervo(ctx, c.x, c.y, u * 0.018, E.t * 0.02 + c.dxu * 40, false, i); });
    // el camino (y detrás, el bosquecillo de bambú en la niebla)
    dibujarBambuFondo(ctx);
    dibujarCapa(ctx, C_SUELO);
    dibujarBambu(ctx);
    // el torii y las linternas
    var ct = E.sx(L.torii);
    if (ct + u * 0.3 > 0 && ct - u * 0.3 < W) {
      var sl = obtenerGrande('linterna'), sn = E.noche > 0.02 ? obtenerGrande('linternaLuz') : null;
      [-0.22, 0.22].forEach(function (dx, i) {
        var lx = E.sx(L.torii + dx), ly = suelo(L.torii + dx) + 3;
        ctx.save(); ctx.translate(lx, ly); if (i) ctx.scale(-1, 1);
        if (sl) ctx.drawImage(sl.c, -sl.w / 2, -sl.h, sl.w, sl.h);
        if (sn) { ctx.globalAlpha = Math.min(1, E.noche * 1.3); ctx.drawImage(sn.c, -sn.w / 2, -sn.h, sn.w, sn.h); }
        ctx.restore();
      });
      var st = obtenerGrande('torii'); if (st) ctx.drawImage(st.c, ct - st.w / 2, suelo(L.torii) - st.h + 4, st.w, st.h);
    }
    // el cerezo: las yemas siempre; la flor encima, según florece (secreto «Sakura»)
    var cc = E.sx(L.cerezo);
    if (cc + u * 0.5 > 0 && cc - u * 0.5 < W) {
      var sz = obtenerGrande('cerezo');
      if (sz) {
        var zx = cc - sz.w / 2, zy = suelo(L.cerezo) - sz.h + 4;
        ctx.drawImage(sz.datos.yemas.c, zx, zy, sz.w, sz.h);
        if (est.florecer > 0.01) { ctx.globalAlpha = Math.min(1, est.florecer); ctx.drawImage(sz.datos.flor.c, zx, zy, sz.w, sz.h); ctx.globalAlpha = 1; }
        PA._cerezo = { x: zx, y: zy, k: sz.w / sz.datos.yemas.w, petalos: sz.datos.petalos };
      }
    }
    titulo(ctx);
    finRollo(ctx);
    if (!E.escena || (E.escena.s.heroe !== false && !E.escena.s.heroeEncima)) dibujarHeroe(ctx);
    hierba(ctx);
    dibujarMotas(ctx, PA._dt || 16);
    hierbaCerca(ctx);
    ciruelos(ctx);
  }
  // el marco bermellón del título (medidas en función de u)
  function marcoTam() { return E.u * 0.082; }
  function marcoW() { var tam = marcoTam(); return tam * 1.55 + tam * 0.9; }
  function marcoH() { var tam = marcoTam(); return tam * 5 * 1.05 + tam * 0.6 + tam * 0.9; }
  function pintarMarco(pw, ph, d) {
    var tam = marcoTam(), mw = tam * 1.55, mh = tam * 5 * 1.05 + tam * 0.6;
    var Lz = T.lienzo(pw, ph), m = tam * 0.45 * d, W2 = mw * d, H2 = mh * d, ex = tam * 0.32 * d, col = T.color.rojo;
    var lineas = [[[m, m - ex], [m, m + H2 + ex]], [[m + W2, m - ex], [m + W2, m + H2 + ex]], [[m - ex, m], [m + W2 + ex, m]], [[m - ex, m + H2], [m + W2 + ex, m + H2]],
      [[m + 5 * d, m + 5 * d], [m + 5 * d, m + H2 - 5 * d]], [[m + W2 - 5 * d, m + 5 * d], [m + W2 - 5 * d, m + H2 - 5 * d]]];
    lineas.forEach(function (ln, i) { T.pincelada(Lz.x, [ln[0], [(ln[0][0] + ln[1][0]) / 2 + (i % 2 ? 0.6 : -0.6) * d, (ln[0][1] + ln[1][1]) / 2], ln[1]], { ancho: (i < 4 ? 2.1 : 1.1) * d, alfa: i < 4 ? 0.85 : 0.5, color: col, carga: 0.95, seco: 0.45, entrada: 0.04, salida: 0.12, semilla: 70 + i, cerdas: 4, rugoso: 0.15 }); });
    return Lz;
  }
  function titulo(ctx) {
    var x = E.sx(L.titulo), u = E.u; if (x < -u * 0.5 || x > E.W + u * 0.5) return;
    var tam = u * 0.082, y0 = E.H * 0.15, alto = tam * 5 * 1.05;
    // el marco: dos líneas bermellón a cada lado que se pasan de las esquinas, pintadas a pincel fino
    var mw = tam * 1.55, sm = spriteTinta('marcoTitulo', marcoW(), marcoH(), pintarMarco);
    ctx.drawImage(sm.c, x - mw / 2 - tam * 0.45, y0 - tam * 0.75, sm.w, sm.h);
    FX.vertical('隠された道', x, y0, tam, { a: 0.94 });
    FX.sello('侍', x + mw * 0.5 + tam * 0.05, y0 + alto + tam * 0.05, u * 0.042, 0.95, -0.04);
    FX.texto('UN ROLLO CON DIEZ SECRETOS', x + mw * 0.5 + tam * 0.6, y0 + tam * 0.3, { tam: 10.5, a: 0.6, espaciado: 2.2 });
    FX.texto('Desliza para avanzar →', x + mw * 0.5 + tam * 0.6, y0 + tam * 0.3 + 22, { serif: true, cursiva: true, tam: 18, a: 0.8 });
    rodillo(ctx, E.sx(0), false);
  }
  function finRollo(ctx) {
    var x = E.sx(L.fin), u = E.u; if (x > E.W + u) return;
    FX.vertical('終', x, E.H * 0.3, u * 0.16, { a: 0.9 });
    FX.sello('道', x + u * 0.005, E.H * 0.3 + u * 0.2, u * 0.045, 0.95, 0.05);
    rodillo(ctx, E.sx(E.largo), true);
  }
  function rodillo(ctx, x, fin) {   // los rodillos de madera del rollo (jiku)
    var u = E.u, w = u * 0.03, xx = fin ? x - w : x;
    if (xx > E.W + 10 || xx + w < -10) return;
    var g = ctx.createLinearGradient(xx, 0, xx + w, 0);
    g.addColorStop(0, 'rgba(58,38,24,0.95)'); g.addColorStop(0.45, 'rgba(120,84,52,0.95)'); g.addColorStop(1, 'rgba(40,26,16,0.95)');
    ctx.fillStyle = g; ctx.fillRect(xx, 0, w, E.H);
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(fin ? xx - u * 0.02 : xx + w, 0, u * 0.02, E.H);
  }

  // de noche, en lugar del sol, una luna de papel (se pinta después del velo nocturno, para que brille)
  function luna(ctx) {
    // (solo de noche de verdad: el oscurecido de una tormenta no saca la luna)
    var a = U.tramo(E.noche, 0.4, 0.85);
    if (a <= 0 || !PA.sol) return;
    var x = PA.sol[0], y = PA.sol[1], r = PA.sol[2] * 0.85;
    var g = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * 3.2); g.addColorStop(0, U.rgba(C.papel, 0.22 * a)); g.addColorStop(1, U.rgba(C.papel, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3.2, 0, TAU); ctx.fill();
    ctx.fillStyle = U.rgba([236, 230, 214], 0.92 * a); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    // los mares de la luna: manchas blandas e irregulares
    [[-0.28, -0.18, 0.3, 0.6], [0.22, 0.12, 0.2, 1.4], [-0.02, 0.36, 0.14, 2.2], [0.3, -0.3, 0.1, 3]].forEach(function (m) {
      var g2 = ctx.createRadialGradient(x + m[0] * r, y + m[1] * r, 0, x + m[0] * r, y + m[1] * r, m[2] * r);
      g2.addColorStop(0, U.rgba([150, 146, 140], 0.22 * a)); g2.addColorStop(1, U.rgba([150, 146, 140], 0));
      ctx.fillStyle = g2; ctx.beginPath(); ctx.ellipse(x + m[0] * r, y + m[1] * r, m[2] * r * 1.3, m[2] * r, m[3], 0, TAU); ctx.fill();
    });
  }
  PA.dibujarParticulas = function (ctx) { luna(ctx); dibujarPetalos(ctx); nieve(ctx, PA._dt); };
  var camAntes = 0;
  PA.actualizar = function (dt) {
    PA._dt = dt;
    E.camVelPantalla = E.camX - camAntes; camAntes = E.camX;
    actualizarBambu(dt); actualizarCuervos(dt); actualizarPetalos(dt); actualizarHeroe(dt); actualizarBandada(dt);
    // la inclinación sigue al ratón con suavidad (y vuelve al centro si sale)
    var obj = E.puntero.sobre && E.puntero.tipo === 'mouse' ? (0.5 - E.puntero.x / E.W) * E.u * 0.03 : 0;
    PA.inclX += (obj - PA.inclX) * Math.min(1, dt / 600);
    // el taller: poco mientras te mueves, más cuando estás quieto
    // (mientras se ve la entrada, el lienzo está tapado: el taller trabaja mucho más)
    // (y mientras se desenrolla, casi nada: es la primera impresión y tiene que ir fluida)
    if (!PA._sinTrabajo) PA.trabajar(E.desenrollo === 0 ? 45 : E.desenrollo > 0 ? 3 : dt > 34 ? 2 : Math.abs(E.camVelPantalla) > 0.5 ? 4 : 14);
    var p = E.puntero;
    if (p.sobre && PA.esMar(p.x, p.y) && p.velocidad > 0.05 && (!ondas.length || E.t - ondas[ondas.length - 1].t > 90)) ondas.push({ xu: E.xuDe(p.x), y: p.y, t: E.t });
  };
  function enMarYEn(xu, p, ancho) { var f = en(xu, p, ancho); return function () { var m = marEnPantalla(); return Math.max(f(), lejania(m[0], m[1])); }; }
  var DONDE = {
    sol: en(L.sol, P.sol, 0.2), marcoTitulo: en(L.titulo, 1, 0.3), fuji: en(L.fuji, P.fuji, 0.8),
    roca: en(L.acantilado, 1, 0.7), pino: en(L.acantilado, 1, 0.7), pinoChico: en(L.acantilado, 1, 0.7),
    bambuPiezas: en(L.bambu, 1, 0.4), bambuFondo: en((L.bambu[0] + L.bambu[1]) / 2, 0.92, 1.25),
    castillo: en(L.castillo, P.castillo, 0.3), torii: en(L.torii, 1, 0.45), linterna: en(L.torii, 1, 0.5), linternaLuz: en(L.torii, 1, 0.5),
    junco0: enMarYEn(L.barcos, P.barcos, 0.8), junco1: enMarYEn(L.barcos, P.barcos, 0.8), junco2: enMarYEn(L.barcos, P.barcos, 0.8),
    isla: enMarYEn(L.isla, P.isla, 0.4), nubarronLejos: en(L.barcos, 1, 2), nubarronCerca: en(L.barcos, 1, 2), pagoda: en(L.pagoda, P.pagoda, 0.2), cerezo: en(L.cerezo, 1, 1), colina: en(L.shiroyama, P.shiroyama, 1.3)
  };
  CIRUELOS.forEach(function (c, i) { DONDE['ciruelo' + i] = en(c.xu, c.p, c.w); });
  [0, 1, 2].forEach(function (k) { DONDE['hierbaCerca' + k] = en(HIERBA_CERCA.filter(function (x, i) { return i % 3 === k; }), 1.45, 0.5); });
  for (var nd in DONDE) if (GRANDES[nd]) GRANDES[nd].donde = DONDE[nd];
  // una pieza grande ya pintada (o se pinta ahora): para las escenas
  PA.pieza = function (nombre) { return GRANDES[nombre] ? obtenerGrande(nombre) : null; };
  PA.posicion = function (nombre) {   // dónde se ve ahora algo del paisaje (pantalla)
    if (nombre === 'ninja') {
      var ac = PA._acantilado || situarAcantilado();
      if (ac && ac.pino.datos.escondite) return [ac.px + ac.pino.datos.escondite[0] * ac.kp, ac.py + ac.pino.datos.escondite[1] * ac.kp];
      var w = E.u * 0.42, x = E.sx(L.pino) - w * 0.45, y = suelo(L.acantilado) - E.u * 0.3 + 6 + E.u * 0.03 - w;
      return [x + w * 0.22, y + w * 0.34];
    }
    if (nombre === 'sekigahara') return [E.sx(L.sekigahara[0], P.llanura), E.H * L.sekigahara[1]];
    if (nombre === 'isla') return [E.sx(L.isla, P.isla), E.H * 0.715];
    return null;
  };
})();
