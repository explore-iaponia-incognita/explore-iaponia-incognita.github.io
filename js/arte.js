/* El camino oculto · arte
   Las piezas del paisaje pintadas con el motor de tinta (SA.tinta), una vez, en lienzos aparte:
   cordilleras en aguada con su niebla, pinos, ciruelos con flor roja, bambú, pagoda, castillo, torii, suelo de
   salpicadura, rocas, barcos, olas, pájaros… Cada función devuelve un lienzo { c, w, h } (y datos de anclaje).
   Unidades: px del lienzo; quien llama decide el tamaño. */
(function () {
  'use strict';
  var SA = window.SA = window.SA || {}, T = SA.tinta, TAU = Math.PI * 2;
  var A = SA.arte = {};
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function suave(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

  /* ------------------------------------------------------------------ cordilleras (por teselas)
     Una cordillera se define en coordenadas del mundo (λ: unidades de la capa) por «def», y cualquier tramo se puede pintar
     por separado: cada montaña sale de su índice con su propio azar, así que dos teselas vecinas pintan lo mismo en el borde.
     Cada montaña se pinta como lo haría un pintor de tinta:
     1. una aguada clara para toda la masa, que se pierde en la niebla hacia abajo;
     2. una segunda aguada, más oscura, cerca de la cresta y en la ladera de sombra (con el borde de abajo deshilachado);
     3. el filo de la cresta a pincel seco, a tramos (el pintor levanta el pincel);
     4. textura «fibra de cáñamo»: trazos finos que bajan por la ladera de sombra;
     5. puntos de musgo en las crestas y arbolitos.
     def: semilla, esp (λ entre montañas), alto (u), base (u, y del pie en la pantalla), tono (alfa), detalle (0…1),
          niebla (u en que se desvanece), arboles (0…1), escarpado (0…1), suave (px de desenfoque por cada 1000 px de u) */
  function h1(n) { var s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  function picoDe(def, i) {
    var r = T.azar(Math.floor(h1(i * 7.13 + (def.semilla || 1) * 13.7) * 1e9) + 11);
    return { i: i, c: (i + 0.5 + (r() - 0.5) * 0.75) * def.esp, a: def.alto * (0.4 + r() * 0.6), an: def.esp * (0.5 + r() * 0.55), asim: 0.65 + r() * 0.7, sem: Math.floor(r() * 1000), sombra: r() < 0.5 ? 1 : -1, r: r };
  }
  function perfilPico(p, l, esc) {
    var d = (l - p.c) / (p.an * (l < p.c ? p.asim : 2 - p.asim)), f = 1 / Math.pow(1 + d * d * 1.5, 1.2);
    var cr = 1 - Math.abs(2 * T.fbm1(l * 4.4, p.sem, 3) - 1), hombro = (T.fbm1(l * 2, p.sem + 5, 2) - 0.5) * 0.35, fino = (T.fbm1(l * 24, p.sem + 9, 3) - 0.5) * 0.07;
    return Math.max(0, p.a * f * (1 + (cr - 0.5) * 0.3 * esc + hombro * f + fino));
  }
  // la altura de la cordillera en λ (la montaña más alta en ese punto), en u: para poner cosas encima
  A.alturaMontes = function (def, l) {
    var m = 0, esc = def.escarpado == null ? 0.6 : def.escarpado;
    for (var i = Math.floor(l / def.esp) - 4; i <= Math.ceil(l / def.esp) + 4; i++) m = Math.max(m, perfilPico(picoDe(def, i), l, esc));
    return m;
  };
  // pinta del tirón (para lo que no va por teselas)
  A.montes = function (L, l0, k, yTop, def) { var g = A.montesPasos(L, l0, k, yTop, def); while (!g.next().done) { /* nada */ } return L; };
  // por pasos: cada «yield» deja que el taller reparta el trabajo entre fotogramas
  A.montesPasos = function* (L, l0, k, yTop, def) {
    var x = L.x, w = L.w, h = L.h, l1 = l0 + w / k, esc = def.escarpado == null ? 0.6 : def.escarpado;
    var tono = def.tono == null ? 0.35 : def.tono, det = def.detalle == null ? 1 : def.detalle, niebla = def.niebla == null ? 0.25 : def.niebla;
    function X(l) { return (l - l0) * k; }
    function Yu(yu) { return (yu - yTop) * k; }
    var base = def.base, alcance = def.esp * 2.6, picos = [];
    for (var i = Math.floor((l0 - alcance) / def.esp) - 1; i <= Math.ceil((l1 + alcance) / def.esp) + 1; i++) picos.push(picoDe(def, i));
    picos.sort(function (p, q) { return (q.a - p.a) || (p.i - q.i); });
    var maxA = def.alto, paso = 2 / k, ox = l0 * k;
    for (var ip = 0; ip < picos.length; ip++) {
      var p = picos[ip];
      var r = p.r, desde = Math.max(l0 - 0.02, p.c - alcance), hasta = Math.min(l1 + 0.02, p.c + alcance);
      var visible = hasta > desde;
      var cresta = [], l;
      if (visible) for (l = desde; l <= hasta + paso; l += paso) cresta.push([X(l), Yu(base - perfilPico(p, l, esc))]);
      var t = tono * (0.78 + 0.22 * p.a / maxA);
      var techoPx = Yu(base - p.a), aPx = p.a * k, nieblaPx = niebla * k;
      // el recuadro del pico (de lado a lado de su cresta, desde su cima hasta abajo): las aguadas trabajan solo ahí
      var caja = visible && cresta.length > 1 ? [cresta[0][0], techoPx - 4, cresta[cresta.length - 1][0], h] : null;
      var masa = function (c) { c.beginPath(); c.moveTo(cresta[0][0], h + 2); cresta.forEach(function (q) { c.lineTo(q[0], q[1]); }); c.lineTo(cresta[cresta.length - 1][0], h + 2); c.closePath(); c.fill(); };
      // 1 · aguada clara
      if (visible && cresta.length > 1) { T.aguada(x, w, h, masa, { gris: t * 0.55, degradado: [1, 0], y0: techoPx + aPx * 0.1, y1: Math.min(h, techoPx + aPx * 0.45 + nieblaPx), nubes: 0.5, grano: 0.2, suave: def.suave ? def.suave * k / 1000 : 0, borde: 0.6, semilla: p.sem, ox: ox, caja: caja }); yield 'aguada'; }
      if (det <= 0) continue;
      // 2 · aguada oscura de la cresta y la ladera de sombra
      if (visible && cresta.length > 1) T.aguada(x, w, h, function (c) {
        c.beginPath(); var i2, q;
        for (i2 = 0; i2 < cresta.length; i2++) { q = cresta[i2]; if (i2) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); }
        for (i2 = cresta.length - 1; i2 >= 0; i2--) {
          q = cresta[i2]; var lq = q[0] / k + l0, lad = suave(((lq - p.c) * p.sombra / p.an + 0.15) / 0.45), hh = Yu(base) - q[1];
          c.lineTo(q[0], q[1] + hh * (0.12 + 0.38 * lad) * (0.55 + 0.9 * T.fbm1(lq * 7, p.sem + 21, 3)));
        }
        c.closePath(); c.fill();
      }, { gris: t * 0.75, nubes: 0.55, grano: 0.3, suave: Math.max(1, k * 0.006), borde: 1, semilla: p.sem + 7, ox: ox, caja: caja });
      yield 'sombra';
      // 3 · el filo de la cresta, a tramos (los tramos se deciden en el mundo, no en la tesela)
      var ini = p.c - alcance;
      while (ini < p.c + alcance) {
        var lon = alcance * 2 * (0.03 + r() * 0.09), salto = alcance * 2 * (0.015 + r() * 0.07), usa = r() < 0.72, anchoF = Math.max(1.1, k * (0.0012 + r() * 0.0026)), alF = t * (1.3 + r() * 0.8), carF = 0.6 + r() * 0.4, secF = 0.6 + r() * 0.35, semF = Math.floor(r() * 1e6);
        if (usa && ini + lon > l0 - 0.05 && ini < l1 + 0.05) {
          var tramo = [];
          for (l = ini; l <= ini + lon; l += paso * 1.5) { var hh2 = perfilPico(p, l, esc); if (hh2 > p.a * 0.3) tramo.push([X(l), Yu(base - hh2) + 0.8]); }
          if (tramo.length > 6) T.pincelada(x, tramo, { ancho: anchoF, alfa: Math.min(1, alF), carga: carF, seco: secF, entrada: 0.15, salida: 0.4, semilla: semF, rugoso: 0.3, cerdas: 7 });
        }
        ini += lon + salto;
      }
      yield 'filo';
      // 4 · fibras de la ladera de sombra
      var grupos = Math.round(det * p.an * 40);
      for (var g = 0; g < grupos; g++) {
        var off = p.an * (0.03 + Math.pow(r(), 0.75) * 1.05), gl = p.c + p.sombra * off * (r() < 0.85 ? 1 : -0.45), nn = 2 + Math.floor(r() * 3), lfac = 0.25 + r() * 0.35;
        var gh = perfilPico(p, gl, esc);
        for (var kk = 0; kk < nn; kk++) {
          var sl = gl + (kk - nn / 2) * 0.006 + (r() - 0.5) * 0.003, sdy = 0.002 + r() * 0.006, lmul = 0.7 + r() * 0.5, an2 = 0.0009 + r() * 0.0013, al2 = 0.35 + r() * 0.45, ca2 = 0.55 + r() * 0.4, se2 = Math.floor(r() * 1e6);
          if (gh < p.a * 0.3 || sl < l0 - 0.3 || sl > l1 + 0.3) continue;
          var dl = (perfilPico(p, sl - 0.002, esc) - perfilPico(p, sl + 0.002, esc)) / 0.004;
          var dx0 = Math.sign(dl || p.sombra) * (0.35 + Math.min(1.4, Math.abs(dl)) * 0.55), sh = perfilPico(p, sl, esc), ll = sh * lfac * lmul, pts = [];
          for (var s = 0; s <= 7; s++) { var fz = s / 7; pts.push([X(sl + dx0 * ll * fz * (1 - 0.4 * fz) + (T.fbm1(fz * 2.5 + kk * 3, p.sem + g, 2) - 0.5) * 0.005), Yu(base - sh + sdy + ll * fz)]); }
          T.pincelada(x, pts, { ancho: k * an2, alfa: t * al2, carga: ca2, seco: 0.8, entrada: 0.15, salida: 0.6, cerdas: 5, semilla: se2, rugoso: 0.2 });
        }
        if (g % 8 === 7) yield 'fibras';
      }
      yield 'fibras';
      // 5 · musgo y arbolitos
      var nm = Math.round(det * p.an * 20);
      for (var m = 0; m < nm; m++) {
        var ml = p.c + (r() - 0.5) * p.an * 1.8, nd = 2 + Math.floor(r() * 5), mh = perfilPico(p, ml, esc), gotas = [];
        for (var d = 0; d < nd; d++) gotas.push([ml + (r() - 0.5) * 0.016, 0.001 + r() * 0.005, 0.0011 + r() * 0.0017, r(), (r() - 0.5) * 0.6]);
        if (mh < p.a * 0.45 || ml < l0 - 0.1 || ml > l1 + 0.1) continue;
        gotas.forEach(function (gd) {
          x.fillStyle = T.rgba(T.color.tinta, Math.min(1, t * (1.8 + gd[3])));
          x.beginPath(); x.ellipse(X(gd[0]), Yu(base - perfilPico(p, gd[0], esc) + gd[1]), gd[2] * k * 1.4, gd[2] * k, gd[4], 0, TAU); x.fill();
        });
      }
      if (def.arboles) {
        var na = Math.round(def.arboles * p.an * 30);
        for (var a2 = 0; a2 < na; a2++) {
          var al = p.c + (r() - 0.5) * p.an * 1.6, ta = 0.007 + r() * 0.009, semA = Math.floor(r() * 1e6), ah = perfilPico(p, al, esc);
          if (ah < p.a * 0.35 || al < l0 - 0.05 || al > l1 + 0.05) continue;
          arbolito(x, X(al), Yu(base - ah) + 1, ta * k, Math.min(1, t * 2.2), T.azar(semA));
        }
      }
      yield 'musgo';
    }
    return L;
  };
  // un pino lejano: tronco fino y copa de manchas horizontales escalonadas (más anchas abajo)
  function arbolito(x, ax, ay, ta, al, r) {
    x.fillStyle = T.rgba(T.color.tinta, al);
    x.beginPath(); x.moveTo(ax - ta * 0.035, ay); x.lineTo(ax - ta * 0.015, ay - ta); x.lineTo(ax + ta * 0.015, ay - ta); x.lineTo(ax + ta * 0.035, ay); x.fill();
    var pisos = 3 + (r() < 0.5 ? 1 : 0);
    for (var k = 0; k < pisos; k++) {
      var f = k / (pisos - 1), yy = ay - ta * (0.3 + f * 0.6), an = ta * (0.42 - f * 0.26) * (0.85 + r() * 0.3), dx = (r() - 0.5) * ta * 0.12;
      x.globalAlpha = 0.8 + r() * 0.2;
      x.beginPath(); x.ellipse(ax + dx, yy, an, ta * (0.13 - f * 0.03), (r() - 0.5) * 0.25, 0, TAU); x.fill();
    }
    x.globalAlpha = 1;
  }
  A.arbolito = arbolito;

  /* ------------------------------------------------------------------ ramas
     Una rama a pincel: cuerpo de tinta con el borde algo irregular y, encima, vetas de «blanco volante» (el pincel seco
     que deja ver el papel a lo largo de la rama). pts en px; ancho al empezar (se afila). */
  function rama(x, pts, ancho, op) {
    op = op || {};
    var r = T.azar(op.semilla || 9);
    // una sombra gris más ancha, a pincel seco: da volumen a la rama
    if (ancho > 6 && op.volumen !== 0) T.pincelada(x, pts, { ancho: ancho * 1.25, alfa: 0.22, carga: 0.8, seco: 0.85, entrada: 0.02, salida: 0.6, rugoso: 0.45, semilla: r() * 1e6, cerdas: Math.round(ancho * 0.9) });
    T.pincelada(x, pts, { ancho: ancho, alfa: op.alfa == null ? 0.94 : op.alfa, color: op.color, carga: 1, seco: op.seco == null ? 0.35 : op.seco, entrada: op.entrada == null ? 0.02 : op.entrada, salida: op.salida == null ? 0.75 : op.salida, rugoso: 0.42, semilla: r() * 1e6, cerdas: Math.max(6, Math.round(ancho * 0.8)) });
    // blanco volante: vetas cortas y nítidas cerca de un borde, más hacia el final del trazo (donde el pincel se seca)
    if (ancho > 5 && op.blanco !== 0) {
      x.save(); x.globalCompositeOperation = 'destination-out';
      var nv = Math.max(2, Math.round(ancho / 4));
      for (var v = 0; v < nv; v++) {
        var lado = r() < 0.5 ? -1 : 1, off = lado * ancho * (0.12 + r() * 0.26), ini = Math.floor((0.15 + r() * 0.75) * (pts.length - 1)), lon = 2 + Math.floor(r() * pts.length * 0.22);
        var tr = pts.slice(ini, Math.min(pts.length, ini + lon)).map(function (q, k, arr) {
          var a = arr[Math.max(0, k - 1)], b = arr[Math.min(arr.length - 1, k + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
          return [q[0] - dy / l * off, q[1] + dx / l * off];
        });
        if (tr.length > 1) T.pincelada(x, tr, { ancho: Math.max(0.8, ancho * (0.05 + r() * 0.1)), alfa: 1, carga: 0.9, seco: 0.5, entrada: 0.4, salida: 0.5, cerdas: 3, semilla: r() * 1e6 });
      }
      x.restore();
    }
  }
  A.rama = rama;

  /* Una flor de ciruelo vista de frente: cinco pétalos de rojo (donde se solapan, más oscuro), centro oscuro y estambres
     de tinta con su punta. de lado: aplastada, se ven tres pétalos y el cáliz. */
  function flor(x, cx, cy, R, rot, r, op) {
    op = op || {};
    var col = op.color || T.color.rojo, lado = op.lado || 0, aplasta = 1 - lado * 0.55;
    x.save(); x.translate(cx, cy); x.rotate(rot);
    for (var k = 0; k < 5; k++) {
      var a = k / 5 * TAU + r() * 0.2, pr = R * (0.46 + r() * 0.1), px = Math.cos(a) * R * 0.52, py = Math.sin(a) * R * 0.52 * aplasta;
      if (lado && py < -R * 0.15) continue;   // de lado no se ven los de atrás
      var g = x.createRadialGradient(px - Math.cos(a) * pr * 0.3, py - Math.sin(a) * pr * 0.3, pr * 0.1, px, py, pr * 1.05);
      g.addColorStop(0, T.rgba(col, (op.alfa || 0.85) * 0.75)); g.addColorStop(0.75, T.rgba(col, op.alfa || 0.85)); g.addColorStop(1, T.rgba(T.color.rojoOscuro, (op.alfa || 0.85) * 0.95));
      x.fillStyle = g; x.beginPath(); x.ellipse(px, py, pr, pr * (0.92 - lado * 0.3), a, 0, TAU); x.fill();
    }
    // el centro y los estambres
    x.fillStyle = T.rgba(T.color.rojoOscuro, 0.9); x.beginPath(); x.arc(0, lado ? R * 0.15 : 0, R * 0.17, 0, TAU); x.fill();
    var ne = lado ? 5 : 8;
    x.strokeStyle = T.rgba(T.color.tinta, 0.85); x.fillStyle = T.rgba(T.color.tinta, 0.95); x.lineWidth = Math.max(0.6, R * 0.05);
    for (var e = 0; e < ne; e++) {
      var ae = lado ? -Math.PI / 2 + (e - (ne - 1) / 2) * 0.32 : e / ne * TAU + r() * 0.4, le = R * (0.55 + r() * 0.3);
      var ex = Math.cos(ae) * le, ey = Math.sin(ae) * le * (lado ? 1 : aplasta);
      x.beginPath(); x.moveTo(0, lado ? R * 0.1 : 0); x.quadraticCurveTo(ex * 0.5 + (r() - 0.5) * R * 0.1, ey * 0.5, ex, ey); x.stroke();
      x.beginPath(); x.arc(ex, ey, Math.max(0.7, R * 0.07), 0, TAU); x.fill();
    }
    if (lado) { x.fillStyle = T.rgba(T.color.tinta, 0.9); x.beginPath(); x.ellipse(0, R * 0.42, R * 0.28, R * 0.16, 0, 0, TAU); x.fill(); }   // cáliz
    x.restore();
  }
  function capullo(x, cx, cy, R, ang) {
    x.fillStyle = T.rgba(T.color.rojo, 0.9); x.beginPath(); x.arc(cx, cy, R, 0, TAU); x.fill();
    x.fillStyle = T.rgba(T.color.rojoOscuro, 0.5); x.beginPath(); x.arc(cx + R * 0.25, cy + R * 0.25, R * 0.55, 0, TAU); x.fill();
    x.fillStyle = T.rgba(T.color.tinta, 0.9); x.beginPath(); x.ellipse(cx - Math.cos(ang) * R * 0.9, cy - Math.sin(ang) * R * 0.9, R * 0.5, R * 0.32, ang, 0, TAU); x.fill();
  }
  A.flor = flor; A.capullo = capullo;

  /* El ciruelo (ume): una rama que entra por un borde del lienzo, en zigzag (el ciruelo se quiebra en ángulos), con brotes
     rectos hacia arriba, flores rojas abiertas, de lado y capullos. Devuelve también dónde están las flores (para soltar pétalos).
     op: semilla, desde ('izquierda' | 'derecha'), flores (densidad), grosor (px) */
  A.ciruelo = function (w, h, op) { var g = A.ciruelosPasos(w, h, op), p = g.next(); while (!p.done) p = g.next(); return p.value; };
  // (por pasos: primero se decide la forma; luego se pintan las ramas y las flores a trozos)
  A.ciruelosPasos = function* (w, h, op) {
    op = op || {};
    var L = T.lienzo(w, h), x = L.x, r = T.azar(op.semilla || 21), s = Math.min(w, h), flores = [], puntas = [], ramas = [];
    var izq = op.desde !== 'derecha';
    var M = s * 0.04;
    // gira el ángulo hacia dentro si el punto se sale del lienzo
    function dentro(p, a) {
      var cx = w / 2, cy = h * 0.45, fuera = p[0] < M || p[0] > w - M || p[1] < M || p[1] > h - M;
      if (!fuera) return a;
      var hacia = Math.atan2(cy - p[1], cx - p[0]), d = hacia - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
      return a + d * 0.6;
    }
    function crece(p0, ang, largo, grosor, nivel) {
      var pts = [p0], p = p0, a = ang, tramos = 3 + Math.floor(r() * 3);
      for (var t = 0; t < tramos; t++) {
        a += (r() - 0.5) * 1.0;                                   // los quiebros del ciruelo
        if (a > 0.95 && a < Math.PI - 0.95) a = a < Math.PI / 2 ? 0.95 : Math.PI - 0.95;   // no cuelga a plomo
        var l = largo / tramos * (0.65 + r() * 0.7), q = [p[0] + Math.cos(a) * l, p[1] + Math.sin(a) * l];
        a = dentro(q, a); q = [p[0] + Math.cos(a) * l, p[1] + Math.sin(a) * l];
        for (var k = 1; k <= 4; k++) pts.push([lerp(p[0], q[0], k / 4) + (r() - 0.5) * grosor * 0.25, lerp(p[1], q[1], k / 4) + (r() - 0.5) * grosor * 0.25]);
        p = q;
      }
      ramas.push([pts, grosor, { semilla: r() * 1e6, seco: nivel === 0 ? 0.5 : 0.35, salida: nivel === 0 ? 0.45 : 0.85 }]);
      if (nivel >= 2 || grosor < 2.2) { puntas.push({ p: p, a: a }); return pts; }
      // ramas hijas: casi siempre hacia arriba o de lado
      var hijos = nivel === 0 ? 4 + Math.floor(r() * 2) : 2 + Math.floor(r() * 2);
      for (var hc = 0; hc < hijos; hc++) {
        var idx = Math.floor((0.2 + r() * 0.72) * (pts.length - 1)), o = pts[idx];
        var da = (0.45 + r() * 0.7) * (r() < 0.72 ? -1 : 1) * (izq ? 1 : -1);
        crece(o, a + da, largo * (0.3 + r() * 0.28), grosor * (0.36 + r() * 0.18), nivel + 1);
      }
      // brotes rectos hacia arriba (los látigos del ciruelo)
      for (var b = 0; b < (nivel === 0 ? 3 : 1); b++) {
        var i2 = Math.floor((0.2 + r() * 0.75) * (pts.length - 1)), o2 = pts[i2], aa = -Math.PI / 2 + (r() - 0.5) * 0.7, ll = s * (0.07 + r() * 0.12);
        var fin = [o2[0] + Math.cos(aa) * ll, o2[1] + Math.sin(aa) * ll];
        if (fin[1] < M) continue;
        ramas.push([[o2, mezcla2(o2, fin, 0.5), fin], Math.max(1.2, grosor * 0.16), { semilla: r() * 1e6, salida: 0.9, blanco: 0, volumen: 0 }]);
        puntas.push({ p: fin, a: aa, brote: true, o: o2 });
      }
      return pts;
    }
    function mezcla2(a, b, t) { return [lerp(a[0], b[0], t) + (r() - 0.5) * 2, lerp(a[1], b[1], t) + (r() - 0.5) * 2]; }
    // por dónde entra la rama: por un lado (casi horizontal) o desde arriba (cuelga y luego se abre de lado)
    var g0 = op.grosor || s * 0.05, p0, a0;
    // (de lado entran por arriba, cerca de la esquina: el borde de arriba del lienzo es el de la pantalla y no se ve el corte)
    if (op.desde === 'arriba') { p0 = [w * 0.3, -g0]; a0 = 1.05; }
    else { p0 = izq ? [w * 0.1, -g0] : [w * 0.9, -g0]; a0 = izq ? 0.5 : Math.PI - 0.5; }
    crece(p0, a0, w * 0.9, g0, 0);
    yield 'forma';
    for (var ir = 0; ir < ramas.length; ir++) { rama(x, ramas[ir][0], ramas[ir][1], ramas[ir][2]); if (ir < 4 || ir % 2 === 1) yield 'ramas'; }
    yield 'ramas';
    // las flores: en las puntas, a lo largo de los brotes y salpicadas por las ramas finas
    var R0 = op.flor || s * 0.026;
    for (var ip = 0; ip < puntas.length; ip++) {
      if (ip && ip % 5 === 0) yield 'flores';
      var pt = puntas[ip];
      var n = pt.brote ? 2 + Math.floor(r() * 3) : 1 + Math.floor(r() * 3);
      for (var k = 0; k < n; k++) {
        var f = pt.brote ? 0.3 + k / n * 0.7 : 1 - k * 0.18, base = pt.o || pt.p;
        var fx = pt.brote ? lerp(base[0], pt.p[0], f) : pt.p[0] - Math.cos(pt.a) * k * R0 * 1.6, fy = pt.brote ? lerp(base[1], pt.p[1], f) : pt.p[1] - Math.sin(pt.a) * k * R0 * 1.6;
        fx += (r() - 0.5) * R0 * 1.2; fy += (r() - 0.5) * R0 * 1.2;
        var tipo = r(), R = R0 * (0.75 + r() * 0.5);
        if (tipo < 0.22) capullo(x, fx, fy, R * 0.42, pt.a);
        else { flor(x, fx, fy, R, r() * TAU, r, { lado: tipo < 0.45 ? 1 : 0 }); flores.push([fx, fy, R]); }
      }
    }
    // unos pétalos sueltos que ya caen
    for (var c = 0; c < (op.caidos || 5); c++) {
      var px = w * (0.2 + r() * 0.7), py = h * (0.4 + r() * 0.55), pr = R0 * (0.35 + r() * 0.2);
      x.fillStyle = T.rgba(T.color.rojo, 0.8); x.beginPath(); x.ellipse(px, py, pr, pr * 0.65, r() * TAU, 0, TAU); x.fill();
    }
    L.flores = flores;
    return L;
  };

  /* ------------------------------------------------------------------ el suelo del camino
     Una franja de tinta como la de las láminas: el filo de arriba a pinceladas horizontales que se secan en las puntas,
     debajo una aguada oscura moteada que se aclara hacia abajo, vetas de pincel seco, salpicaduras y matas.
     Se pinta por tramos (xu0…xu1, en u) que encajan sin costura: cada pincelada está definida en coordenadas del mundo
     por su índice, así que dos tramos vecinos pintan exactamente la misma.
     L: lienzo del tramo; op: k (px por u), y(xu) → altura de la línea del suelo en px del lienzo, fondo (y px donde acaba),
         semilla, tono (0…1), claro (para la playa: menos tinta) */
  A.suelo = function (L, xu0, xu1, op) { var g = A.sueloPasos(L, xu0, xu1, op); while (!g.next().done) { /* nada */ } return L; };
  A.sueloPasos = function* (L, xu0, xu1, op) {
    var x = L.x, k = op.k, Y = op.y, sem = op.semilla || 1, tono = op.tono == null ? 1 : op.tono;
    function px(xu) { return (xu - xu0) * k; }
    var i, xu;
    // 1 · una aguada gris justo bajo la línea, de profundidad irregular y borde blando
    var F = T.auxiliar('suelo', L.w, L.h), paso = 0.008;
    F.x.beginPath(); F.x.moveTo(px(xu0 - paso), Y(xu0 - paso));
    for (xu = xu0; xu <= xu1 + paso; xu += paso) F.x.lineTo(px(xu), Y(xu) - k * 0.002);
    for (xu = xu1 + paso; xu >= xu0 - paso; xu -= paso) F.x.lineTo(px(xu), Y(xu) + k * (0.018 + 0.05 * T.fbm1(xu * 3.1, sem + 4, 3)));
    F.x.closePath(); F.x.fillStyle = '#000'; F.x.fill();
    var nub = T.textura('nubes', 512, 3, 4, 1.4, 21, false);
    F.x.save(); F.x.globalCompositeOperation = 'destination-out'; F.x.globalAlpha = 0.5; F.x.translate(-(((xu0 * k) % 512 + 512) % 512), 0); F.x.fillStyle = F.x.createPattern(nub.c, 'repeat'); F.x.fillRect(0, 0, L.w + 512, L.h); F.x.restore();
    var B = T.desenfocar(F, Math.max(2, k * 0.006));
    x.save(); x.globalAlpha = 0.38 * tono; x.drawImage(B.c, 0, 0, L.w, L.h, 0, 0, L.w, L.h); x.restore();
    yield;
    // 2 · pinceladas en filas: el filo (anchas, oscuras, casi continuas) y, debajo, filas más finas, claras, secas y sueltas
    var FILAS = [
      { esp: 0.09, off: [-0.003, 0.006], ancho: [0.008, 0.026], alfa: [0.85, 0.95], seco: [0.45, 0.8], lon: [0.25, 0.6], p: 1, ras: [0, 0.35] },
      { esp: 0.1, off: [0.006, 0.03], ancho: [0.012, 0.03], alfa: [0.6, 0.85], seco: [0.6, 0.9], lon: [0.25, 0.55], p: 0.85, ras: [0.35, 0.7] },
      { esp: 0.14, off: [0.035, 0.075], ancho: [0.01, 0.024], alfa: [0.4, 0.65], seco: [0.75, 0.95], lon: [0.2, 0.5], p: 0.6, ras: [0.5, 0.85] },
      { esp: 0.2, off: [0.08, 0.13], ancho: [0.008, 0.018], alfa: [0.25, 0.45], seco: [0.85, 0.97], lon: [0.12, 0.35], p: 0.45, ras: [0.6, 0.9] }
    ];
    for (var fila = 0; fila < FILAS.length; fila++) {
      var fi = FILAS[fila], desde = Math.floor((xu0 - 0.7) / fi.esp), hasta = Math.ceil((xu1 + 0.05) / fi.esp), hechas = 0;
      for (i = desde; i <= hasta; i++) {
        var r = T.azar(Math.floor(h1(i * 1.31 + sem + fila * 97.3) * 1e9) + 7);
        if (r() > fi.p) continue;
        var ini = i * fi.esp + r() * fi.esp * 0.8, lon = lerp(fi.lon[0], fi.lon[1], r());
        if (ini > xu1 + 0.03 || ini + lon < xu0 - 0.03) continue;
        var off = lerp(fi.off[0], fi.off[1], r()), curva = (r() - 0.5) * 0.012, pts = [], lento = fila === 0 ? 0.45 + 1.1 * T.fbm1(ini * 1.9, sem + 40, 2) : 1;
        for (var s = 0; s <= 16; s++) { var t = s / 16, xx = ini + lon * t; pts.push([px(xx), Y(xx) + (off + curva * Math.sin(t * Math.PI)) * k + (T.fbm1(xx * 11 + i, sem + fila, 2) - 0.5) * k * 0.006]); }
        if (r() < 0.5) pts.reverse();
        var ras = lerp(fi.ras[0], fi.ras[1], r()); if (ras < 0.15) ras = 0;
        T.pincelada(x, pts, { ancho: k * lerp(fi.ancho[0], fi.ancho[1], r()) * lento, alfa: lerp(fi.alfa[0], fi.alfa[1], r()) * tono, carga: 0.8 + r() * 0.2, seco: lerp(fi.seco[0], fi.seco[1], r()), entrada: 0.04 + r() * 0.1, salida: 0.3 + r() * 0.35, semilla: Math.floor(r() * 1e6), rugoso: 0.3, color: T.color.tinta, rasgado: ras });
        if (++hechas % 2 === 0) yield;
      }
      yield;
    }
    // piedras sobre el filo: manchas oscuras redondeadas con un brillo de pincel seco
    for (i = Math.floor((xu0 - 0.1) / 0.23); i <= Math.ceil((xu1 + 0.1) / 0.23); i++) {
      var rp = T.azar(Math.floor(h1(i * 5.77 + sem * 2) * 1e9) + 9);
      if (rp() > 0.42) continue;
      var pxu = i * 0.23 + rp() * 0.2, pr = (0.006 + rp() * 0.016), pw = pr * (1.3 + rp() * 0.8), py = Y(pxu) + k * pr * 0.25, ps = Math.floor(rp() * 1e6);
      if (px(pxu) < -k * 0.06 || px(pxu) > L.w + k * 0.06) continue;
      var rr = T.azar(ps), forma = [];
      for (var q = 0; q <= 12; q++) { var an = Math.PI + q / 12 * Math.PI; forma.push([px(pxu) + Math.cos(an) * pw * k * (0.85 + rr() * 0.3), py + Math.sin(an) * pr * k * (0.8 + rr() * 0.4)]); }
      x.fillStyle = T.rgba(T.color.tinta, 0.88 * tono); x.beginPath(); x.moveTo(forma[0][0], forma[0][1]); forma.forEach(function (fp) { x.lineTo(fp[0], fp[1]); }); x.closePath(); x.fill();
      x.save(); x.globalCompositeOperation = 'destination-out';
      T.pincelada(x, [[px(pxu) - pw * k * 0.55, py - pr * k * 0.55], [px(pxu) - pw * k * 0.1, py - pr * k * 0.8], [px(pxu) + pw * k * 0.3, py - pr * k * 0.65]], { ancho: pr * k * 0.22, alfa: 0.75, carga: 0.8, seco: 0.85, rasgado: 0.5, entrada: 0.2, salida: 0.5, semilla: ps + 1 });
      x.restore();
    }
    yield;
    // 3 · salpicaduras sobre la línea y algunas gotas sueltas en la franja
    for (i = Math.floor(xu0 / 0.06) - 2; i <= Math.ceil(xu1 / 0.06) + 2; i++) {
      var r2 = T.azar(Math.floor(h1(i * 2.17 + sem * 3) * 1e9) + 3);
      if (r2() > 0.3) continue;
      var sx = i * 0.06 + r2() * 0.06, sy = Y(sx) - k * (0.002 + r2() * 0.02);
      if (px(sx) < -k * 0.1 || px(sx) > L.w + k * 0.1) continue;
      T.salpicar(x, px(sx), sy, k * (0.012 + r2() * 0.03), { n: 3 + Math.floor(r2() * 8), dir: -Math.PI / 2 + (r2() - 0.5) * 1.8, abre: 0.35, semilla: Math.floor(r2() * 1e6), max: k * 0.004, alfa: 0.85 * tono });
    }
    return L;
  };

  /* ------------------------------------------------------------------ el Fuji
     La silueta de laderas cóncavas y cima casi plana; la nieve es el papel que queda sin tinta (con lenguas que bajan
     por las cárcavas), debajo una aguada que se oscurece bajo la nieve y en la ladera de sombra y se pierde en la niebla. */
  A.fuji = function (w, h, op) {
    op = op || {};
    var L = T.lienzo(w, h), x = L.x, r = T.azar(op.semilla || 31), i;
    var cx = w * 0.5, top = h * 0.05, base = h, cima = w * 0.065, ancho = w * 0.5;
    function lado(sg, t) { return [cx + sg * (cima + (ancho - cima) * Math.pow(t, 1.75)), top + (base - top) * t]; }
    var cimaPts = [];   // la cima: unos picos pequeños (el cráter)
    for (i = 0; i <= 10; i++) { var f2 = i / 10; cimaPts.push([cx - cima + 2 * cima * f2, top + (Math.abs(Math.sin(f2 * Math.PI * 3)) * 0.4 + r() * 0.3) * h * 0.012]); }
    function forma(c) {
      c.beginPath(); var q;
      for (i = 40; i >= 0; i--) { q = lado(-1, i / 40); if (i === 40) c.moveTo(q[0], q[1]); else c.lineTo(q[0], q[1]); }
      cimaPts.forEach(function (p) { c.lineTo(p[0], p[1]); });
      for (i = 0; i <= 40; i++) { q = lado(1, i / 40); c.lineTo(q[0], q[1]); }
      c.closePath(); c.fill();
    }
    // la línea de nieve, con lenguas que bajan (en t, de 0 a 1 de arriba abajo)
    var NV = 60, nieve = [];
    for (i = 0; i <= NV; i++) {
      var u = i / NV, lengua = Math.pow(Math.abs(Math.sin(u * Math.PI * 9 + r() * 0.6)), 3) * (0.06 + r() * 0.1);
      nieve.push(0.3 + lengua + (T.fbm1(u * 7, 4, 2) - 0.5) * 0.06);
    }
    function puntoNieve(i2) { var u = i2 / NV, tt = nieve[i2], a = lado(-1, tt), b = lado(1, tt); return [lerp(a[0], b[0], u), tt * (base - top) + top]; }
    // 1 · la aguada de la montaña
    T.aguada(x, w, h, forma, { gris: op.tono || 0.3, degradado: [1, 0], y0: top + (base - top) * 0.3, y1: base, nubes: 0.45, grano: 0.25, borde: 0.7, semilla: 5 });
    // 2 · la ladera de sombra (derecha) y la franja bajo la nieve, más oscuras
    T.aguada(x, w, h, function (c) {
      c.beginPath(); var q = lado(1, 0.28); c.moveTo(cx + cima * 0.3, top + 4);
      for (i = 0; i <= 30; i++) { q = lado(1, 0.02 + 0.6 * i / 30); c.lineTo(q[0], q[1]); }
      for (i = 30; i >= 0; i--) { var t2 = 0.02 + 0.6 * i / 30, q2 = lado(1, t2); c.lineTo(q2[0] - (q2[0] - cx) * (0.35 + 0.25 * T.fbm1(t2 * 6, 8, 2)), q2[1] + h * 0.02); }
      c.closePath(); c.fill();
      c.beginPath(); for (i = 0; i <= NV; i++) { var pn = puntoNieve(i); if (i) c.lineTo(pn[0], pn[1]); else c.moveTo(pn[0], pn[1]); }
      for (i = NV; i >= 0; i--) { var pn2 = puntoNieve(i); c.lineTo(pn2[0], pn2[1] + h * (0.05 + 0.06 * T.fbm1(i * 0.2, 9, 2))); }
      c.closePath(); c.fill();
    }, { gris: (op.tono || 0.3) * 0.75, degradado: [1, 0.2], y0: top, y1: base * 0.75, nubes: 0.5, grano: 0.3, suave: Math.max(1, h * 0.008), borde: 0.8, semilla: 7 });
    // 3 · la nieve: se borra la tinta por encima de la línea de nieve (queda el papel)
    x.save(); x.globalCompositeOperation = 'destination-out'; x.beginPath();
    x.moveTo(cx - w, top - 10); x.lineTo(cx + w, top - 10);
    for (i = NV; i >= 0; i--) { var pq = puntoNieve(i); x.lineTo(pq[0], pq[1]); }
    x.closePath(); x.fill(); x.restore();
    // 4 · el contorno: dos pinceladas secas por las laderas, de la cima hacia abajo, y la cima
    [-1, 1].forEach(function (sg) {
      var pts = []; for (i = 0; i <= 24; i++) { var q = lado(sg, 0.005 + 0.6 * i / 24); pts.push([q[0], q[1] + 1]); }
      T.pincelada(x, pts, { ancho: Math.max(1.5, h * 0.008), alfa: 0.62, carga: 0.85, seco: 0.75, entrada: 0.05, salida: 0.6, semilla: sg > 0 ? 3 : 4, rugoso: 0.3, cerdas: 8 });
    });
    T.pincelada(x, cimaPts.map(function (p) { return [p[0], p[1] + 1]; }), { ancho: Math.max(1.2, h * 0.006), alfa: 0.55, carga: 0.9, seco: 0.6, entrada: 0.1, salida: 0.3, semilla: 6, cerdas: 6 });
    // 5 · las cárcavas en la nieve: trazos grises finos que bajan desde la cima
    for (i = 0; i < 14; i++) {
      var u2 = (i + 0.5) / 14 + (r() - 0.5) * 0.04, t0 = 0.03 + r() * 0.05, t1 = nieve[Math.round(u2 * NV)] * (0.75 + r() * 0.3), pts2 = [];
      for (var s = 0; s <= 6; s++) { var tt = lerp(t0, t1, s / 6), a = lado(-1, tt), b = lado(1, tt); pts2.push([lerp(a[0], b[0], clamp(u2, 0.02, 0.98)), top + (base - top) * tt]); }
      T.pincelada(x, pts2, { ancho: Math.max(1, h * 0.004), alfa: 0.22 + r() * 0.15, carga: 0.7, seco: 0.8, entrada: 0.2, salida: 0.5, semilla: Math.floor(r() * 1e6), cerdas: 4 });
    }
    return L;
  };

  /* ------------------------------------------------------------------ el sol rojo: disco bermellón con el grano del papel */
  /* ------------------------------------------------------------------ nubarrón de tormenta (el tifón del secreto 6)
     Una bancada de cúmulos a aguada que se funden, más oscura en la panza, con el borde de arriba a pincel seco y jirones;
     los lados y la parte de abajo se pierden (en la lluvia). w, h en px del lienzo. op: semilla, tono (0…1). */
  A.nubarron = function (w, h, op) { var g = A.nubarronPasos(w, h, op), p = g.next(); while (!p.done) p = g.next(); return p.value; };
  A.nubarronPasos = function* (w, h, op) {
    op = op || {};
    var L = T.lienzo(w, h), x = L.x, sem = op.semilla || 31, r = T.azar(sem), tono = op.tono == null ? 0.8 : op.tono;
    var bultos = [], n = 13 + Math.floor(r() * 5), i;
    for (i = 0; i < n; i++) {
      var u = (i + 0.2 + r() * 0.6) / n, alto = 0.3 * Math.sin(u * Math.PI) * (0.6 + r() * 0.6);
      bultos.push([w * (0.05 + u * 0.9), h * (0.62 - alto), w * (0.045 + r() * 0.05), h * (0.16 + r() * 0.14)]);
    }
    function forma(c) {
      c.beginPath();
      bultos.forEach(function (b) { c.moveTo(b[0] + b[2], b[1]); c.ellipse(b[0], b[1], b[2], b[3], 0, 0, TAU); });
      c.rect(w * 0.04, h * 0.58, w * 0.92, h * 0.3); c.fill();
    }
    // debajo, papel casi opaco con el borde blando: la nube tapa lo de detrás (el sol), como una nube de verdad
    var pap = op.papel || (SA.color && SA.color.papel) || T.color.papel;
    bultos.forEach(function (b) {
      x.save(); x.translate(b[0], b[1]); x.scale(1, b[3] / b[2]);
      var gb = x.createRadialGradient(0, 0, 0, 0, 0, b[2] * 1.04);
      gb.addColorStop(0, T.rgba(pap, 0.96)); gb.addColorStop(0.72, T.rgba(pap, 0.93)); gb.addColorStop(1, T.rgba(pap, 0));
      x.fillStyle = gb; x.beginPath(); x.arc(0, 0, b[2] * 1.04, 0, TAU); x.fill(); x.restore();
    });
    var gp = x.createLinearGradient(0, h * 0.5, 0, h * 0.9);
    gp.addColorStop(0, T.rgba(pap, 0.94)); gp.addColorStop(1, T.rgba(pap, 0));
    x.fillStyle = gp; x.fillRect(w * 0.05, h * 0.5, w * 0.9, h * 0.4);
    yield 'nube';
    T.aguada(x, w, h, forma, { gris: 0.5 * tono, degradado: [0.55, 1], y0: h * 0.1, y1: h * 0.8, nubes: 0.55, grano: 0.25, suave: Math.max(2, h * 0.035), borde: 0.35, semilla: sem });
    yield 'nube';
    // la panza, más oscura
    T.aguada(x, w, h, function (c) {
      c.beginPath();
      bultos.forEach(function (b) { c.moveTo(b[0] + b[2] * 0.95, b[1] + b[3] * 0.45); c.ellipse(b[0], b[1] + b[3] * 0.45, b[2] * 0.95, b[3] * 0.62, 0, 0, TAU); });
      c.rect(w * 0.06, h * 0.66, w * 0.88, h * 0.18); c.fill();
    }, { gris: 0.42 * tono, degradado: [0, 1], y0: h * 0.32, y1: h * 0.78, nubes: 0.5, grano: 0.3, suave: Math.max(2, h * 0.05), semilla: sem + 3 });
    yield 'nube';
    // el borde de arriba de algunos bultos, a pincel seco
    bultos.forEach(function (b, j) {
      if (r() < 0.4) return;
      var pts = [], a0 = 1.1 + r() * 0.2, a1 = 1.9 - r() * 0.2;
      for (var k = 0; k <= 8; k++) { var a = Math.PI * (a0 + (a1 - a0) * k / 8); pts.push([b[0] + Math.cos(a) * b[2] * 0.97, b[1] + Math.sin(a) * b[3] * 0.97]); }
      T.pincelada(x, pts, { ancho: Math.max(1, h * 0.011), alfa: 0.4 * tono, carga: 0.7, seco: 0.85, rasgado: 0.6, entrada: 0.25, salida: 0.4, semilla: sem + 11 + j, cerdas: 5 });
    });
    // los lados y la parte de abajo se pierden
    x.save(); x.globalCompositeOperation = 'destination-out';
    var g = x.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.07, 'rgba(0,0,0,0)'); g.addColorStop(0.93, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    var g2 = x.createLinearGradient(0, h * 0.7, 0, h);
    g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,1)');
    x.fillStyle = g2; x.fillRect(0, h * 0.7, w, h * 0.3);
    x.restore();
    return L;
  };

  A.sol = function (R, op) {
    op = op || {};
    var m = Math.ceil(R * 0.1), L = T.lienzo(R * 2 + m * 2, R * 2 + m * 2), x = L.x, c = R + m;
    var g = x.createRadialGradient(c - R * 0.2, c - R * 0.25, R * 0.1, c, c, R);
    g.addColorStop(0, T.rgba(op.color || [196, 46, 34], 0.92)); g.addColorStop(0.85, T.rgba(op.color || [186, 38, 30], 0.95)); g.addColorStop(1, T.rgba(T.color.rojoOscuro, 0.95));
    x.fillStyle = g; x.beginPath();
    for (var i = 0; i <= 90; i++) { var a = i / 90 * TAU, rr = R * (1 + (T.fbm1(i * 0.25, 3, 2) - 0.5) * 0.012); if (i) x.lineTo(c + Math.cos(a) * rr, c + Math.sin(a) * rr); else x.moveTo(c + rr, c); }
    x.closePath(); x.fill();
    var tex = T.textura('granulado', 256, 48, 2, 1.8, 9, false);
    x.save(); x.globalCompositeOperation = 'destination-out'; x.globalAlpha = 0.16; x.fillStyle = x.createPattern(tex.c, 'repeat'); x.fillRect(0, 0, L.w, L.h); x.restore();
    L.r = R; L.m = m;
    return L;
  };

  /* ------------------------------------------------------------------ el mar (por teselas)
     Una franja de agua entre el horizonte y la orilla: aguada muy clara que se oscurece hacia la orilla, la línea del
     horizonte quebrada a pincel seco y vetas horizontales de agua en perspectiva (finas y juntas al fondo, largas y
     separadas delante). Se desvanece por los lados (def.a … def.b, en λ, con «fundido»).
     def: hz, orilla (u), a, b, fundido (λ), semilla */
  A.marPasos = function* (L, l0, k, yTop, def) {
    var x = L.x, w = L.w, h = L.h, l1 = l0 + w / k, sem = def.semilla || 3;
    function X(l) { return (l - l0) * k; }
    function Yu(y) { return (y - yTop) * k; }
    function vis(l) { return suave((l - def.a) / def.fundido) * suave((def.b - l) / def.fundido); }
    if (l1 < def.a || l0 > def.b) return L;
    // 1 · la aguada
    var g = x.createLinearGradient(0, Yu(def.hz), 0, Yu(def.orilla + 0.02));
    g.addColorStop(0, T.rgba(T.color.tinta, 0.05)); g.addColorStop(0.5, T.rgba(T.color.tinta, 0.08)); g.addColorStop(1, T.rgba(T.color.tinta, 0.16));
    x.fillStyle = g; x.fillRect(0, Yu(def.hz), w, Yu(def.orilla + 0.03) - Yu(def.hz));
    yield;
    // 2 · el horizonte: tramos sueltos de pincel seco, claros (un horizonte de tinta casi no se dibuja: se adivina), que se
    //     pierden hacia las orillas
    var i, r;
    for (i = Math.floor((l0 - 0.4) / 0.13); i <= Math.ceil((l1 + 0.1) / 0.13); i++) {
      r = T.azar(Math.floor(h1(i * 3.3 + sem) * 1e9) + 1);
      var ini = i * 0.13 + r() * 0.05, lon = 0.03 + Math.pow(r(), 1.6) * 0.16, v = vis(ini + lon / 2), pts = [];
      if (v < 0.05 || r() < 0.18) continue;
      for (var s = 0; s <= 8; s++) pts.push([X(ini + lon * s / 8), Yu(def.hz) + (r() - 0.5) * 0.5]);
      T.pincelada(x, pts, { ancho: Math.max(0.8, k * 0.0013), alfa: (0.22 + r() * 0.3) * v, carga: 0.7, seco: 0.85, entrada: 0.25, salida: 0.35, semilla: Math.floor(r() * 1e6), cerdas: 4 });
    }
    yield;
    // 3 · vetas de agua en filas (perspectiva: más juntas cerca del horizonte)
    // (def.rapido: solo una de cada cuatro filas, para la versión provisional)
    var filas = 22;
    for (var fi = 0; fi < filas; fi++) {
      if (def.rapido && fi % 4) continue;
      var kf = (fi + 0.5) / filas, y = lerp(def.hz + 0.004, def.orilla - 0.004, Math.pow(kf, 1.6)), esp = lerp(0.05, 0.22, kf);
      for (i = Math.floor((l0 - 0.5) / esp); i <= Math.ceil((l1 + 0.1) / esp); i++) {
        r = T.azar(Math.floor(h1(i * 7.1 + fi * 131.7 + sem) * 1e9) + 3);
        if (r() < 0.35) continue;
        var ini2 = i * esp + r() * esp, lon2 = esp * (0.4 + r() * 1.1), pts2 = [];
        for (var s2 = 0; s2 <= 8; s2++) pts2.push([X(ini2 + lon2 * s2 / 8), Yu(y) + Math.sin(s2 * 0.8 + i) * k * 0.0008 * kf]);
        T.pincelada(x, pts2, { ancho: k * lerp(0.0012, 0.0045, kf), alfa: lerp(0.18, 0.4, kf) * (0.6 + r() * 0.6), carga: 0.7 + r() * 0.3, seco: 0.85, rasgado: kf > 0.4 ? 0.5 : 0, entrada: 0.2, salida: 0.45, semilla: Math.floor(r() * 1e6), cerdas: kf > 0.4 ? 0 : 4 });
      }
      yield;
    }
    // 4 · se desvanece por los lados
    var m = x.createLinearGradient(0, 0, w, 0);
    for (i = 0; i <= 16; i++) { var t = i / 16; m.addColorStop(t, 'rgba(0,0,0,' + vis(l0 + (l1 - l0) * t).toFixed(3) + ')'); }
    x.save(); x.globalCompositeOperation = 'destination-in'; x.fillStyle = m; x.fillRect(0, 0, w, h); x.restore();
    return L;
  };

  /* ------------------------------------------------------------------ cuervos
     Posados: el cuerpo es una mancha de tinta húmeda, la cabeza redonda, el pico afilado, la cola de dos o tres trazos
     que se afilan y las patas finas. En vuelo: cuatro fotogramas de alas a pincel seco (las plumas se abren en la punta).
     s = tamaño en px del lienzo (cuadrado); mira a la derecha. */
  A.cuervos = function (s, op) {
    op = op || {};
    var r = T.azar(op.semilla || 51), out = { posado: [], vuelo: [] };
    function lienzo() { return T.lienzo(s, s); }
    for (var v = 0; v < 3; v++) {
      var L = lienzo(), x = L.x, cx = s * 0.5, cy = s * 0.58, inc = (v - 1) * 0.12;
      x.save(); x.translate(cx, cy); x.rotate(inc); x.translate(-cx, -cy);
      // la cola
      for (var c = 0; c < 3; c++) T.pincelada(x, [[cx - s * 0.12, cy + s * 0.02], [cx - s * (0.28 + c * 0.03), cy + s * (0.12 + c * 0.04)], [cx - s * (0.38 + c * 0.04), cy + s * (0.2 + c * 0.05)]], { ancho: s * 0.07, alfa: 0.92, carga: 1, seco: 0.55, entrada: 0.05, salida: 0.6, semilla: 400 + v * 10 + c, cerdas: 6 });
      // el cuerpo: dos pinceladas gruesas que se funden
      T.pincelada(x, [[cx - s * 0.16, cy + s * 0.04], [cx - s * 0.02, cy - s * 0.06], [cx + s * 0.12, cy - s * 0.08]], { ancho: s * 0.2, alfa: 0.96, carga: 1, seco: 0.25, entrada: 0.2, salida: 0.3, semilla: 420 + v, cerdas: 12 });
      T.pincelada(x, [[cx - s * 0.12, cy + s * 0.08], [cx + s * 0.02, cy + s * 0.05], [cx + s * 0.1, cy - s * 0.02]], { ancho: s * 0.15, alfa: 0.9, carga: 1, seco: 0.4, entrada: 0.2, salida: 0.35, semilla: 430 + v, cerdas: 10 });
      // la cabeza y el pico
      x.fillStyle = T.rgba(T.color.tinta, 0.97); x.beginPath(); x.arc(cx + s * 0.15, cy - s * 0.13, s * 0.075, 0, TAU); x.fill();
      x.beginPath(); x.moveTo(cx + s * 0.2, cy - s * 0.16); x.quadraticCurveTo(cx + s * 0.3, cy - s * 0.15, cx + s * 0.34, cy - s * 0.12); x.quadraticCurveTo(cx + s * 0.27, cy - s * 0.1, cx + s * 0.2, cy - s * 0.1); x.closePath(); x.fill();
      x.save(); x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.arc(cx + s * 0.17, cy - s * 0.145, s * 0.012, 0, TAU); x.fill(); x.restore();
      // las patas
      x.strokeStyle = T.rgba(T.color.tinta, 0.9); x.lineWidth = Math.max(0.8, s * 0.014); x.lineCap = 'round'; x.beginPath();
      x.moveTo(cx - s * 0.01, cy + s * 0.08); x.lineTo(cx + s * 0.0, cy + s * 0.2); x.moveTo(cx + s * 0.05, cy + s * 0.07); x.lineTo(cx + s * 0.06, cy + s * 0.2); x.stroke();
      x.restore();
      out.posado.push(L);
    }
    // en vuelo: las alas en cuatro fases (arriba, medio, abajo, medio)
    [1, 0.3, -0.7, 0.3].forEach(function (al, i) {
      var L = lienzo(), x = L.x, cx = s * 0.5, cy = s * 0.5;
      [-1, 1].forEach(function (lado) {
        var punta = [cx - lado * s * 0.05 - s * 0.36 * (lado < 0 ? 1 : -1) * 0, cy], pts = [];
        for (var k = 0; k <= 6; k++) { var f2 = k / 6; pts.push([cx + lado * s * 0.42 * f2, cy - s * 0.3 * al * Math.sin(f2 * Math.PI * 0.6) - s * 0.05 * f2 * f2]); }
        T.pincelada(x, pts, { ancho: s * 0.12, alfa: 0.92, carga: 1, seco: 0.85, entrada: 0.1, salida: 0.4, semilla: 460 + i * 2 + (lado > 0 ? 1 : 0), cerdas: 9, rasgado: 0.25 });
      });
      x.fillStyle = T.rgba(T.color.tinta, 0.96); x.beginPath(); x.ellipse(cx, cy + s * 0.02, s * 0.14, s * 0.06, 0, 0, TAU); x.fill();
      x.beginPath(); x.arc(cx + s * 0.15, cy - s * 0.0, s * 0.045, 0, TAU); x.fill();
      x.beginPath(); x.moveTo(cx + s * 0.18, cy - s * 0.015); x.lineTo(cx + s * 0.26, cy + s * 0.0); x.lineTo(cx + s * 0.18, cy + s * 0.02); x.fill();
      T.pincelada(x, [[cx - s * 0.12, cy + s * 0.02], [cx - s * 0.24, cy + s * 0.05]], { ancho: s * 0.08, alfa: 0.9, carga: 1, seco: 0.6, salida: 0.5, semilla: 470 + i, cerdas: 6 });
      out.vuelo.push(L);
    });
    return out;
  };

  /* ------------------------------------------------------------------ la puerta de una casa de samuráis (yashiki-mon)
     Dos postes, un tejado de tejas con los extremos levantados y nieve encima; las dos hojas de la puerta van aparte
     (para abrirlas). Devuelve { marco, hoja } (lienzos) y las medidas del vano. */
  A.puerta = function (w, h, op) {
    op = op || {};
    var M = T.lienzo(w, h), x = M.x, r = T.azar(op.semilla || 17), cx = w / 2, suelo = h, ph = h * 0.62, pw = w * 0.56;
    // los postes y el dintel, a pincel con un poco de pincel seco
    [-1, 1].forEach(function (lado, i) {
      var px = cx + lado * pw / 2;
      T.pincelada(x, [[px, suelo], [px + lado * 0.5, suelo - ph * 0.5], [px, suelo - ph - h * 0.04]], { ancho: w * 0.045, alfa: 0.92, carga: 1, seco: 0.45, entrada: 0.02, salida: 0.08, semilla: 700 + i, cerdas: 10, rugoso: 0.2 });
    });
    T.pincelada(x, [[cx - pw * 0.62, suelo - ph], [cx, suelo - ph - 2], [cx + pw * 0.62, suelo - ph]], { ancho: h * 0.04, alfa: 0.9, carga: 1, seco: 0.5, entrada: 0.03, salida: 0.12, semilla: 705, cerdas: 9 });
    // el tejado: una masa de tinta con las alas levantadas, filas de tejas (rayas de papel) y la cumbrera
    var techo = function (c) {
      c.beginPath(); c.moveTo(cx - w * 0.5, suelo - ph - h * 0.08);
      c.quadraticCurveTo(cx - w * 0.36, suelo - ph - h * 0.1, cx - w * 0.3, suelo - ph - h * 0.26);
      c.lineTo(cx + w * 0.3, suelo - ph - h * 0.26);
      c.quadraticCurveTo(cx + w * 0.36, suelo - ph - h * 0.1, cx + w * 0.5, suelo - ph - h * 0.08);
      c.quadraticCurveTo(cx, suelo - ph - h * 0.03, cx - w * 0.5, suelo - ph - h * 0.08); c.closePath(); c.fill();
    };
    T.aguada(x, w, h, techo, { gris: 0.92, nubes: 0.25, grano: 0.2, borde: 1, semilla: 3 });
    x.save(); x.globalCompositeOperation = 'destination-out';
    for (var t = 0; t < 9; t++) { var f2 = (t + 1) / 10, xx = lerp(cx - w * 0.42, cx + w * 0.42, f2); T.pincelada(x, [[xx, suelo - ph - h * 0.07], [lerp(xx, cx, 0.12), suelo - ph - h * 0.24]], { ancho: Math.max(1, w * 0.006), alfa: 0.55, carga: 0.9, seco: 0.7, salida: 0.4, semilla: 720 + t, cerdas: 3 }); }
    x.restore();
    // la nieve: una franja de papel sobre el tejado, con el borde de abajo irregular
    x.fillStyle = T.rgba(T.color.papel, 0.97); x.beginPath(); x.moveTo(cx - w * 0.31, suelo - ph - h * 0.255);
    x.quadraticCurveTo(cx, suelo - ph - h * 0.3, cx + w * 0.31, suelo - ph - h * 0.255);
    for (var k = 10; k >= 0; k--) { var fx = cx - w * 0.33 + w * 0.66 * k / 10; x.lineTo(fx, suelo - ph - h * (0.2 + (r() * 0.035))); }
    x.closePath(); x.fill();
    T.pincelada(x, [[cx - w * 0.31, suelo - ph - h * 0.26], [cx, suelo - ph - h * 0.3], [cx + w * 0.31, suelo - ph - h * 0.26]], { ancho: Math.max(1, h * 0.012), alfa: 0.75, carga: 0.9, seco: 0.6, entrada: 0.05, salida: 0.2, semilla: 730, cerdas: 5 });
    // una hoja de la puerta: tablas de madera oscura con las juntas en papel y los clavos
    var hw = pw * 0.5 - w * 0.02, hh = ph * 0.96, H2 = T.lienzo(hw, hh);
    T.aguada(H2.x, hw, hh, function (c) { c.fillRect(0, 0, hw, hh); }, { gris: 0.78, nubes: 0.35, grano: 0.3, borde: 0.8, semilla: 9 });
    H2.x.save(); H2.x.globalCompositeOperation = 'destination-out';
    for (var j = 1; j < 4; j++) T.pincelada(H2.x, [[hw * j / 4, 2], [hw * j / 4 + 0.5, hh - 2]], { ancho: Math.max(1, hw * 0.02), alfa: 0.7, carga: 0.9, seco: 0.5, salida: 0.2, semilla: 740 + j, cerdas: 3 });
    H2.x.restore();
    H2.x.fillStyle = T.rgba(T.color.tinta, 0.9);
    [0.2, 0.5, 0.8].forEach(function (fy) { for (var c2 = 0; c2 < 4; c2++) { H2.x.beginPath(); H2.x.arc(hw * (c2 + 0.5) / 4, hh * fy, Math.max(1, hw * 0.025), 0, TAU); H2.x.fill(); } });
    return { marco: M, hoja: H2, vano: pw, alto: ph };
  };

  /* ------------------------------------------------------------------ niebla (por teselas)
     Jirones horizontales difusos y una franja continua, en coordenadas del mundo.
     def: semilla, y (u, centro de la franja), alto (u), alfa, franja (alfa de la franja), esp (λ entre jirones), color */
  A.niebla = function (L, l0, k, yTop, def) {
    var x = L.x, w = L.w, h = L.h, l1 = l0 + w / k, col = def.color || T.color.papel, esp = def.esp || 0.12;
    function X(l) { return (l - l0) * k; }
    function Yu(yu) { return (yu - yTop) * k; }
    var gl = x.createLinearGradient(0, Yu(def.y - def.alto), 0, Yu(def.y + def.alto));
    var fr = def.franja == null ? 0.55 : def.franja;
    gl.addColorStop(0, T.rgba(col, 0)); gl.addColorStop(0.42, T.rgba(col, fr)); gl.addColorStop(0.58, T.rgba(col, fr)); gl.addColorStop(1, T.rgba(col, 0));
    x.fillStyle = gl; x.fillRect(0, 0, w, h);
    for (var i = Math.floor((l0 - 0.6) / esp); i <= Math.ceil((l1 + 0.6) / esp); i++) {
      var r = T.azar(Math.floor(h1(i * 3.71 + (def.semilla || 1) * 5.3) * 1e9) + 5);
      var cl = i * esp + r() * esp, cy = def.y + (r() - 0.5) * def.alto * 1.1, rx = 0.15 + r() * 0.45, ry = def.alto * (0.25 + r() * 0.45), a = (def.alfa || 0.6) * (0.4 + r() * 0.6);
      if (cl + rx < l0 || cl - rx > l1) continue;
      var g = x.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, T.rgba(col, a)); g.addColorStop(0.6, T.rgba(col, a * 0.5)); g.addColorStop(1, T.rgba(col, 0));
      x.save(); x.translate(X(cl), Yu(cy)); x.scale(rx * k, ry * k); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 1, 0, TAU); x.fill(); x.restore();
    }
    return L;
  };
})();
