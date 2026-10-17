/* Iaponia Incognita · arte del cerezo y de Shiroyama
   Dos piezas más de SA.arte, pintadas una vez con el motor de tinta:
   - A.cerezo: el cerezo viejo, solo junto al camino, en dos lienzos con las mismas ramas: «yemas» (principios de la
     primavera: ramas desnudas con yemas rojas) y «flor» (plena floración: nubes de flores rosa pálido). El juego funde
     la una en la otra con el secreto «Sakura» y suelta pétalos desde L.petalos.
   - A.colina: la colina de Shiroyama (donde cayó Saigō Takamori en 1877) vista de lejos: cima casi llana, hierba,
     pinos, rocas y niebla al pie. L.cima es el punto de la cima donde el juego pone al samurái.
   Las dos tienen su versión por pasos (A.cerezoPasos, A.colinaPasos: generadores, como A.montesPasos) para pintarlas
   en el taller sin parar el juego. Deterministas (T.azar). */
(function () {
  'use strict';
  var SA = window.SA, T = SA.tinta, A = SA.arte, TAU = Math.PI * 2;
  var TINTA = T.color.tinta;
  // perfil (sólo si A._perf es una lista; con A._sync, cada paso obliga a pintar lo pendiente): para lab-cerezo.html
  var _t0 = 0, _x = null; function marca(n) { if (!A._perf) return; if (A._sync && _x) T.vaciar(_x); var t = performance.now(); A._perf.push(n + ' ' + Math.round(t - _t0)); _t0 = t; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function suave(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function difAng(a, b) { var d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; }
  function semilla(r) { return Math.floor(r() * 1e6) + 1; }

  /* ------------------------------------------------------------------ ramas (polilíneas con ancho) */
  // una rama: puntos, anchos (px), largo acumulado, tangentes y normales
  function rama(p, w, nivel) {
    var n = p.length, L = [0], N = [], D = [], i;
    for (i = 1; i < n; i++) L.push(L[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
    for (i = 0; i < n; i++) {
      var a = p[Math.max(0, i - 1)], b = p[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      D.push([dx / l, dy / l]); N.push([-dy / l, dx / l]);
    }
    return { p: p, w: w, L: L, N: N, D: D, tot: L[n - 1], nivel: nivel, hijos: [] };
  }
  // el punto de la rama a d px del arranque (con su ancho, tangente y normal)
  function en(b, d) {
    var L = b.L, n = L.length, i = 1;
    d = clamp(d, 0, b.tot);
    while (i < n - 1 && L[i] < d) i++;
    var f = clamp((d - L[i - 1]) / ((L[i] - L[i - 1]) || 1), 0, 1), a = b.p[i - 1], c = b.p[i];
    return { x: lerp(a[0], c[0], f), y: lerp(a[1], c[1], f), w: lerp(b.w[i - 1], b.w[i], f), dx: b.D[i][0], dy: b.D[i][1], nx: b.N[i][0], ny: b.N[i][1], a: Math.atan2(b.D[i][1], b.D[i][0]) };
  }
  // la polilínea desplazada por la normal (o: px, número o función del índice)
  function desplazar(b, o) {
    return b.p.map(function (q, i) { var k = typeof o === 'function' ? o(i) : o; return [q[0] + b.N[i][0] * k, q[1] + b.N[i][1] * k]; });
  }
  // los dos bordes, con el temblor de la corteza
  function bordes(b, rug, sem, s) {
    var izq = [], der = [];
    for (var i = 0; i < b.p.length; i++) {
      var q = b.p[i], n = b.N[i], hw = b.w[i] / 2, l = b.L[i] / s;
      var e1 = 1 + (T.fbm1(l * 16, sem, 3) - 0.5) * rug, e2 = 1 + (T.fbm1(l * 16, sem + 7, 3) - 0.5) * rug;
      izq.push([q[0] + n[0] * hw * e1, q[1] + n[1] * hw * e1]); der.push([q[0] - n[0] * hw * e2, q[1] - n[1] * hw * e2]);
    }
    return { izq: izq, der: der };
  }
  // el contorno cerrado de unos bordes (para rellenar)
  function contorno(c, e) {
    var i; c.moveTo(e.izq[0][0], e.izq[0][1]);
    for (i = 1; i < e.izq.length; i++) c.lineTo(e.izq[i][0], e.izq[i][1]);
    for (i = e.der.length - 1; i >= 0; i--) c.lineTo(e.der[i][0], e.der[i][1]);
    c.closePath();
  }
  // un trazo de pincel con el ancho de cada punto (px)
  function trazo(x, pts, anchos, op) {
    var W = 0.01, i; for (i = 0; i < anchos.length; i++) W = Math.max(W, anchos[i]);
    var q = pts.map(function (p, k) { return [p[0], p[1], Math.max(0.02, anchos[k] / W)]; });
    var o = {}; for (var k in op) o[k] = op[k]; o.ancho = W;
    if (o.entrada == null) o.entrada = 0.03; if (o.salida == null) o.salida = 0.12;
    T.pincelada(x, q, o);
  }
  // tramos en que el pintor levanta el pincel: [[i0, i1], …]
  function tramos(n, r, lmin, lmax, hueco) {
    var o = [], i = 0;
    while (i < n - 2) {
      var j = Math.min(n - 1, i + Math.max(3, Math.round(n * lerp(lmin, lmax, r()))));
      if (n - 1 - j < n * lmin * 0.5) j = n - 1;
      o.push([i, j]);
      i = Math.max(o[o.length - 1][0] + 2, j + (r() < 0.4 ? -1 : Math.round(n * hueco * r())));
    }
    return o;
  }

  /* ------------------------------------------------------------------ el cerezo: el esqueleto
     Tronco grueso, retorcido, que se inclina; cuatro ramas maestras con el gesto decidido (una larga hacia donde se
     inclina, una que sube, una al otro lado y una baja de contrapeso) y, de ellas, ramas, ramillas y espolones que
     crecen solos: serpentean, se quiebran y buscan la luz. La copa es una cúpula ancha y aplastada: lo que se sale,
     se vuelve o se acaba. Se crece inclinado a la derecha y, si lado < 0, se refleja. */
  var HIJAS = [0, 7, 4, 2], LMAX = [0, 0.5, 0.32, 0.15, 0.07];
  function esqueleto(w, h, r, lado) {
    var s = h, ramas = [];
    var bx = w * 0.5, by = h - s * 0.008;
    var ccx = bx + s * 0.03, ccy = by - s * 0.58, crx = w * 0.5 - s * 0.02, cry = s * 0.41;
    function fuera(q) { var dx = (q[0] - ccx) / crx, dy = (q[1] - ccy) / cry; if (dy > 0) dy *= 0.5; return Math.sqrt(dx * dx + dy * dy); }
    function P(c, j) { return [bx + (c[0] + (r() - 0.5) * j) * s, by + (c[1] + (r() - 0.5) * j) * s]; }
    function conAnchos(pts, w0, wTip, k) { var m = pts.length - 1; return pts.map(function (q, i) { return wTip + (w0 - wTip) * Math.pow(1 - i / m, k); }); }
    // la madera vieja se tuerce: cada punto se aparta un poco de la curva
    function torcer(pts, amp, sem) {
      var L = 0;
      return pts.map(function (q, i) {
        if (i) L += Math.hypot(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1]);
        var a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
        var k = (T.fbm1(L / s * 9, sem, 3) - 0.5) * amp * s * Math.min(1, i / 3);
        return [q[0] - dy / l * k, q[1] + dx / l * k];
      });
    }

    function crecer(p0, a0, largo, w0, nivel, padre) {
      var paso = s * 0.008, n = Math.max(3, Math.round(largo / paso));
      paso = largo / n;
      var sem = r() * 1000, amp = [0, 0.75, 0.95, 1.1, 1.25][nivel], subir = [0, 0.16, 0.28, 0.4, 0.5][nivel];
      var quie = {}, nq = Math.floor(r() * (nivel <= 2 ? 3 : 2));
      for (var k = 0; k < nq; k++) quie[1 + Math.floor(r() * Math.max(1, n - 2))] = (r() - 0.5) * 0.7;
      var pts = [p0.slice()], a = a0, p = p0;
      for (var i = 1; i <= n; i++) {
        var t = i / n;
        a += (T.fbm1(t * 2.6 + sem, 5, 2) - 0.5) * amp * 3.2 / n;     // serpentea
        a += difAng(-Math.PI / 2, a) * subir * 2 * t / n;              // la punta busca la luz
        if (quie[i]) a += quie[i];                                     // un quiebro
        var e = fuera(p);
        if (e > 0.86) a += difAng(Math.atan2(ccy - p[1], ccx - p[0]), a) * Math.min(1, (e - 0.86) * 3) * 0.1;
        var q = [p[0] + Math.cos(a) * paso, p[1] + Math.sin(a) * paso];
        if (q[0] < s * 0.012 || q[0] > w - s * 0.012 || q[1] < s * 0.01 || (e > 1.04 && t > 0.2)) break;
        pts.push(q); p = q;
      }
      if (pts.length < 3) return null;
      var m = pts.length - 1, frac = m / n;
      var b = rama(pts, conAnchos(pts, w0, s * 0.001, 0.8 + 0.15 * (1 - frac)), nivel);
      b.padre = padre; ramas.push(b);
      hijas(b, nivel);
      return b;
    }
    // las hijas: alternas, hacia arriba o de lado (las que apuntarían abajo se enderezan y se quedan cortas)
    function hijas(b, nivel) {
      if (nivel >= 4) return;
      var nh = HIJAS[nivel] + Math.floor(r() * 2), lados = r() < 0.5 ? 1 : -1, k;
      for (k = 0; k < nh; k++) {
        var tk = lerp(nivel === 1 ? 0.2 : 0.14, 0.92, (k + 0.2 + r() * 0.6) / nh), q = en(b, b.tot * tk);
        lados = -lados; if (r() < 0.2) lados = -lados;
        var da = lados * (0.4 + r() * 0.5), ac = q.a + da, corta = 1;
        if (Math.sin(ac) > 0.15) { ac = q.a - da; if (Math.sin(ac) > 0.15) { ac = q.a - da * 0.25; corta = 0.5; } }
        var wc = q.w * (0.5 + r() * 0.2);
        if (wc < s * 0.0015) continue;
        var lc = Math.min(s * LMAX[nivel + 1], b.tot * (1 - tk) * (0.45 + r() * 0.4) + s * 0.025) * corta;
        var hb = crecer([q.x - q.dx * q.w * 0.3, q.y - q.dy * q.w * 0.3], ac, lc, wc, nivel + 1, b);
        if (hb) b.hijos.push(hb);
      }
      // espolones: brotes cortísimos a lo largo de las ramas finas, cada uno con su yema
      if (nivel >= 2) {
        var ne = Math.floor(b.tot / (s * 0.05));
        for (k = 0; k < ne; k++) {
          var qe = en(b, b.tot * (0.25 + r() * 0.7)), ae = qe.a + (r() < 0.5 ? 1 : -1) * (0.7 + r() * 0.7);
          if (Math.sin(ae) > 0.2) ae = -Math.PI / 2 + (r() - 0.5) * 0.8;
          var le = s * (0.006 + r() * 0.01), we = Math.max(s * 0.0014, qe.w * 0.6);
          var e0 = [qe.x, qe.y], e1 = [qe.x + Math.cos(ae) * le, qe.y + Math.sin(ae) * le];
          var be = rama([e0, [lerp(e0[0], e1[0], 0.5) + (r() - 0.5) * le * 0.2, lerp(e0[1], e1[1], 0.5)], e1], [we, we * 0.8, we * 0.55], 5);
          be.espolon = true; be.padre = b; ramas.push(be);
        }
      }
    }

    // el tronco: sube inclinándose, con una ese, y se ensancha abajo en las raíces
    var tc = [[0, 0.004], [0.004, -0.06], [0.03, -0.13], [0.014, -0.2], [0.04, -0.26], [0.072, -0.315]];
    var tp = torcer(T.curva(tc.map(function (c, i) { return i < 2 ? [bx + c[0] * s, by + c[1] * s] : P(c, 0.018); }), 8), 0.012, 3);
    var tw = tp.map(function (q, i) {
      var f = i / (tp.length - 1), alto = (by - q[1]) / s;
      return s * ((0.09 - 0.012 * f + 0.006 * Math.sin(f * 9 + 1)) * (1 - 0.3 * suave((f - 0.85) / 0.15)) + 0.07 * Math.exp(-alto / 0.028));
    });
    var tronco = rama(tp, tw, 0); tronco.tronco = true; ramas.push(tronco);
    // las ramas maestras: el gesto del árbol (x, y en s desde el pie)
    // (guia: lo que sigue la rama, ya fina, después de la maestra; giro: hacia dónde se abre)
    var MA = [
      { de: 0.97, w: 0.054, guia: 1.1, giro: -0.15, c: [[0.16, -0.4], [0.29, -0.465], [0.43, -0.5], [0.55, -0.535], [0.66, -0.59]] },
      { de: 1.0, w: 0.05, guia: 0.7, giro: 0.45, c: [[0.09, -0.44], [0.07, -0.56], [0.1, -0.66], [0.13, -0.75], [0.16, -0.82]] },
      { de: 0.87, w: 0.047, guia: 1.0, giro: -0.25, c: [[-0.03, -0.39], [-0.12, -0.5], [-0.21, -0.6], [-0.31, -0.67], [-0.43, -0.71]] },
      { de: 0.46, w: 0.034, guia: 1.0, giro: -0.1, c: [[-0.08, -0.205], [-0.2, -0.25], [-0.34, -0.29], [-0.48, -0.34], [-0.6, -0.4]] }
    ];
    var semE = Math.floor(r() * 1e6);
    MA.forEach(function (m, i) {
      r = T.azar(semE + i * 7919);   // cada maestra con su propio azar: cambiar una no cambia las demás
      var q = en(tronco, tronco.tot * m.de), ctrl = [[q.x, q.y]].concat(m.c.map(function (c) { return P(c, 0.03); }));
      var todo = torcer(T.curva(ctrl, 7), 0.016, 20 + i), corte = Math.round(todo.length * 0.8), pts = todo.slice(0, corte + 1);
      var anchos = conAnchos(todo, s * m.w, s * 0.0012, 0.75).slice(0, corte + 1);
      var b = rama(pts, anchos, 1);
      b.maestra = true; b.padre = tronco; tronco.hijos.push(b); ramas.push(b);
      hijas(b, 1);
      // la guía arranca un poco antes del final de la maestra (se solapan) y se abre hacia fuera
      var fin = en(b, b.tot * 0.93), resto = 0, ag = fin.a + m.giro * (fin.dx < 0 ? -1 : 1);
      for (var k = corte; k < todo.length - 1; k++) resto += Math.hypot(todo[k + 1][0] - todo[k][0], todo[k + 1][1] - todo[k][1]);
      var g = crecer([fin.x, fin.y], ag, resto * m.guia + b.tot * 0.07, fin.w * 0.9, 2, b);
      if (g) { g.guia = true; b.hijos.push(g); }
    });
    r = T.azar(semE + 99);
    // las raíces: se abren en el suelo a los dos lados
    [[-1, 0.13, 0.03], [-1, 0.07, 0.022], [1, 0.11, 0.028], [1, 0.05, 0.018]].forEach(function (d, i) {
      var y0 = by - s * (0.03 + r() * 0.012), x0 = bx + d[0] * s * 0.025, pts = [], ws = [];
      for (var k = 0; k <= 10; k++) {
        var f = k / 10, xx = x0 + d[0] * s * d[1] * Math.pow(f, 0.85), yy = lerp(y0, by + s * 0.004, Math.pow(f, 0.45)) + Math.sin(f * 5 + i) * s * 0.0015;
        pts.push([xx, yy]); ws.push(s * d[2] * Math.pow(1 - f * 0.85, 1.4) + s * 0.002);
      }
      var b = rama(pts, ws, 0); b.raiz = true; ramas.push(b);
    });
    if (lado < 0) ramas.forEach(function (b) { b.p.forEach(function (q) { q[0] = w - q[0]; }); var nb = rama(b.p, b.w, b.nivel); b.N = nb.N; b.D = nb.D; });
    return { ramas: ramas, base: [lado < 0 ? w - bx : bx, by], tronco: tronco };
  }

  /* ------------------------------------------------------------------ el cerezo: la madera
     El tronco, las raíces y las ramas maestras se pintan con el pincel de lado: una aguada gris bajo el tronco y las
     raíces (sin costuras) y, encima, trazos largos a lo largo, cargados y oscuros en la cara de sombra (con su canto
     oscuro), secos y rotos en la de luz, con vetas de blanco volante; el canto de luz, fino y a tramos; las lenticelas
     (las rayas de través de la corteza del cerezo: de tinta en la cara de luz, de papel en la de sombra), nudos y
     musgo. Las ramas van de tinta oscura, con la sombra gris de A.rama; las ramillas, en trazos finos y rápidos. */
  var LUZ = [-0.55, -0.83];   // la luz viene de arriba a la izquierda
  function* pintarMadera(x, w, h, E, r) {
    var s = h, ramas = E.ramas;
    var gruesas = ramas.filter(function (b) { return b.tronco || b.raiz || b.maestra; });
    var medias = ramas.filter(function (b) { return !b.tronco && !b.raiz && !b.maestra && !b.espolon && b.w[0] > s * 0.0125; });
    var finas = ramas.filter(function (b) { return !b.tronco && !b.raiz && !b.maestra && (b.espolon || b.w[0] <= s * 0.0125); });
    gruesas.forEach(function (b, i) {
      b.sem = 11 + i * 17;
      b.bordes = bordes(b, b.tronco ? 0.14 : 0.1, b.sem, s);
      var m = 0; for (var k = 0; k < b.N.length; k++) m += b.N[k][0] * LUZ[0] + b.N[k][1] * LUZ[1];
      b.sombra = m > 0 ? -1 : 1;   // de qué lado de la normal queda la cara de sombra
    });
    marca('inicio madera'); yield 'madera';
    // 0 · la sombra en el suelo, al pie
    var base = E.base;
    x.save(); x.translate(base[0] + s * 0.02, base[1] + s * 0.004); x.scale(s * 0.22, s * 0.024);
    var gs = x.createRadialGradient(0, 0, 0, 0, 0, 1); gs.addColorStop(0, T.rgba(TINTA, 0.32)); gs.addColorStop(0.6, T.rgba(TINTA, 0.16)); gs.addColorStop(1, T.rgba(TINTA, 0));
    x.fillStyle = gs; x.beginPath(); x.arc(0, 0, 1, 0, TAU); x.fill(); x.restore();
    // 1 · la aguada gris de toda la madera gruesa
    T.aguada(x, w, h, function (c) { gruesas.forEach(function (b) { if (b.maestra) return; c.beginPath(); contorno(c, b.bordes); c.fill(); }); },
      { gris: 0.2, nubes: 0.65, grano: 0.45, suave: 0, borde: 0.7, semilla: 3 });
    marca('aguadas'); yield 'madera';
    // 2 · el pincel de lado: trazos largos a lo largo; cargados y oscuros en la cara de sombra, secos y rotos en la de luz
    for (var gi = 0; gi < gruesas.length; gi++) { yield 'pincel ' + gi; (function (b) {
      var K = b.tronco ? 9 : b.raiz ? 2 : 4, n = b.p.length, umbral = b.tronco ? 0.56 : b.raiz ? 0.3 : 0.26;
      for (var k = 0; k < K; k++) {
        var u = -0.94 + 1.88 * (k + 0.5) / K + (r() - 0.5) * 0.12, sh = (u + 1) / 2, oscuro = sh > umbral;
        var bw = (oscuro ? 0.3 : 0.22) + 0.08 * r();
        // la cara de luz se pinta en dos o tres tramos (el pintor recarga), la de sombra de un tirón
        var cortes = oscuro ? [[0, 1]] : r() < 0.5 ? [[0, 0.55], [0.5, 1]] : [[0, 0.4], [0.36, 0.72], [0.68, 1]];
        cortes.forEach(function (ct) {
          var i0 = Math.floor(n * ct[0] + r() * n * 0.05), i1 = ct[1] === 1 && (oscuro || b.maestra) ? n - 1 : Math.min(n - 1, Math.floor(n * ct[1] - r() * n * 0.06)), pts = [], an = [], mx = 0;
          var sv = r() * 100;
          for (var i = i0; i <= i1; i++) {
            var ww = b.w[i], l = b.L[i] / s, uv = clamp(u + (T.fbm1(l * 7, sv, 2) - 0.5) * 0.35, -0.97, 0.97), bv = bw * (0.7 + 0.6 * T.fbm1(l * 9, sv + 5, 2));
            var o = b.sombra * uv * (ww / 2) * (1 - bv * 0.8); pts.push([b.p[i][0] + b.N[i][0] * o, b.p[i][1] + b.N[i][1] * o]); an.push(ww * bv); mx = Math.max(mx, ww * bv);
          }
          if (pts.length < 3) return;
          if (oscuro) trazo(x, pts, an, { alfa: 0.8 + 0.12 * r(), carga: 0.95, seco: 0.55 + r() * 0.25, entrada: 0.03, salida: 0.15, rugoso: 0.4, semilla: semilla(r), cerdas: Math.max(5, Math.min(8, Math.round(mx * 0.3))) });
          else trazo(x, pts, an, { alfa: lerp(0.48, 0.75, sh / umbral), carga: 0.85, seco: 0.7, rasgado: lerp(0.6, 0.35, sh / umbral), entrada: 0.06, salida: 0.25, rugoso: 0.35, semilla: semilla(r), cerdas: Math.max(5, Math.min(9, Math.round(mx * 0.3))) });
        });
      }
      if (!b.raiz) {
        var cs = [], ca = [];
        for (var ic = 0; ic < n; ic++) { var wc = b.w[ic], oc = b.sombra * wc * 0.43; cs.push([b.p[ic][0] + b.N[ic][0] * oc, b.p[ic][1] + b.N[ic][1] * oc]); ca.push(wc * 0.16); }
        trazo(x, cs, ca, { alfa: 0.9, carga: 1, seco: 0.45, entrada: 0.02, salida: 0.1, rugoso: 0.45, cerdas: 6, semilla: semilla(r) });
      }
      // blanco volante: vetas cortas de papel, de dos en dos o de tres en tres, en la parte oscura y hacia arriba
      x.save(); x.globalCompositeOperation = 'destination-out';
      var nv = b.tronco ? 6 : b.raiz ? 0 : 2;
      for (k = 0; k < nv; k++) {
        var uu = b.sombra * (umbral * 2 - 1 + r() * (2 - umbral * 2) * 0.85), j0 = Math.floor(n * (0.25 + r() * 0.6)), j1 = Math.min(n - 1, j0 + Math.max(3, Math.floor(n * (0.04 + r() * 0.1)))), nn = 2 + Math.floor(r() * 2);
        for (var v = 0; v < nn; v++) {
          var tl = [], du = (v - (nn - 1) / 2) * 0.07, jj0 = j0 + Math.floor(r() * 3), jj1 = j1 - Math.floor(r() * 3);
          for (var j = jj0; j <= jj1; j++) { var oo = (uu + du) * b.w[j] * 0.5; tl.push([b.p[j][0] + b.N[j][0] * oo, b.p[j][1] + b.N[j][1] * oo]); }
          if (tl.length > 2) T.pincelada(x, tl, { ancho: Math.max(0.7, b.w[j0] * (0.012 + r() * 0.02)), alfa: 0.45 + r() * 0.45, carga: 0.9, seco: 0.6, entrada: 0.35, salida: 0.45, cerdas: 2, semilla: semilla(r) });
        }
      }
      x.restore();
    })(gruesas[gi]); }
    var tr0 = E.tronco;
    for (var kt = 0; kt < 2; kt++) {
      var f0 = 0.3 + kt * 0.3 + r() * 0.1, tw = [], aw = [];
      for (var m = 0; m <= 10; m++) {
        var qt = en(tr0, tr0.tot * (f0 + m / 10 * 0.16)), ut = tr0.sombra * lerp(0.75, -0.55, m / 10);
        tw.push([qt.x + qt.nx * ut * qt.w * 0.5, qt.y + qt.ny * ut * qt.w * 0.5]); aw.push(qt.w * 0.07 * Math.sin(Math.PI * (0.15 + 0.7 * m / 10)));
      }
      trazo(x, tw, aw, { alfa: 0.7, carga: 0.9, seco: 0.75, entrada: 0.1, salida: 0.45, rugoso: 0.4, cerdas: 5, semilla: semilla(r) });
    }
    marca('pincel de lado'); yield 'madera';
    // 3 · el canto de luz: fino, seco y a tramos
    gruesas.forEach(function (b) {
      if (b.raiz) return;
      var ed = b.sombra > 0 ? b.bordes.der : b.bordes.izq;
      tramos(ed.length, r, 0.1, 0.32, 0.16).forEach(function (tr) {
        var seg = ed.slice(tr[0], tr[1] + 1), an = seg.map(function (q, k) { return Math.max(s * 0.002, b.w[tr[0] + k] * (0.04 + 0.04 * T.ruido1(k * 0.3, tr[0]))); });
        if (seg.length > 2 && r() < 0.8) trazo(x, seg, an, { alfa: 0.7 + r() * 0.2, carga: 0.85, seco: 0.75, rugoso: 0.45, entrada: 0.12, salida: 0.4, cerdas: 5, semilla: semilla(r) });
      });
    });
    marca('canto'); yield 'madera';
    // 4 · las lenticelas: rayitas de través en bandas irregulares, que se curvan un poco (las vemos desde abajo);
    //     de tinta en la cara de luz y apenas más claras en la de sombra
    var rayas = [[], []];
    gruesas.forEach(function (b) {
      if (b.raiz) return;
      var d = b.tronco ? b.tot * 0.12 : s * 0.01 * r(), banda = 0;
      while (d < b.tot) {
        var q = en(b, d);
        if (q.w < s * 0.018) break;
        if (banda <= 0) { banda = 2 + Math.floor(r() * 5); d += q.w * (0.15 + r() * 0.5); continue; }   // grupos y huecos
        banda--;
        var nb = 1 + Math.floor(r() * 2.2);
        for (var k = 0; k < nb; k++) {
          var c = clamp((r() - 0.5) * 1.6, -0.82, 0.82), lon = 0.05 + Math.pow(r(), 1.5) * 0.3, u0 = clamp(c - lon, -0.9, 0.9), u1 = clamp(c + lon, -0.9, 0.9);
          var qq = en(b, d + (r() - 0.5) * q.w * 0.06), gr = Math.max(s * 0.0012, qq.w * (0.012 + r() * 0.022)), pts = [];
          for (var m = 0; m <= 6; m++) { var uu = lerp(u0, u1, m / 6), bow = -qq.w * 0.06 * (1 - uu * uu); pts.push([qq.x + qq.nx * uu * qq.w * 0.5 + qq.dx * bow, qq.y + qq.ny * uu * qq.w * 0.5 + qq.dy * bow]); }
          var clara = c * b.sombra > 0.2;
          if (clara && r() < 0.5) continue;
          rayas[clara ? 1 : 0].push({ p: pts, g: gr, a: clara ? 0.2 + r() * 0.25 : 0.5 + r() * 0.4, dx: qq.dx, dy: qq.dy });
        }
        d += q.w * (0.06 + r() * 0.12);
      }
    });
    rayas.forEach(function (lista, i) {
      if (i) { x.save(); x.globalCompositeOperation = 'destination-out'; }
      [0, 1, 2].forEach(function (g3) {
        var a = i ? [0.22, 0.32, 0.42][g3] : [0.55, 0.7, 0.85][g3];
        x.fillStyle = T.rgba(TINTA, a); x.beginPath();
        lista.forEach(function (ry, k) {
          if (k % 3 !== g3) return;
          // una raya: afilada en las puntas, más gruesa en un punto (el pincel apoya y se levanta)
          var p = ry.p, n = p.length, pico = 0.3 + T.h1(p[0][0]) * 0.4, iz = [], de = [];
          for (var m = 0; m < n; m++) { var f = m / (n - 1), g = ry.g * (0.35 + 0.65 * Math.pow(Math.sin(Math.PI * clamp(f / pico * 0.5 + (f > pico ? (f - pico) / (1 - pico) * 0.5 : 0), 0, 1)), 0.6)); iz.push([p[m][0] + ry.dx * g, p[m][1] + ry.dy * g]); de.push([p[m][0] - ry.dx * g, p[m][1] - ry.dy * g]); }
          x.moveTo(iz[0][0], iz[0][1]);
          for (m = 1; m < n; m++) x.lineTo(iz[m][0], iz[m][1]);
          for (m = n - 1; m >= 0; m--) x.lineTo(de[m][0], de[m][1]);
          x.closePath();
        });
        x.fill();
      });
      if (i) x.restore();
    });
    marca('lenticelas ' + rayas[0].length + '+' + rayas[1].length); yield 'madera';
    // 5 · nudos del tronco (una mancha oscura y la corteza que la rodea) y musgo en las horquillas
    var tr = E.tronco;
    [0.42, 0.68].forEach(function (f) {
      var q = en(tr, tr.tot * (f + (r() - 0.5) * 0.08)), u = -tr.sombra * (0.15 + r() * 0.35), R = q.w * (0.06 + r() * 0.03);
      var cx = q.x + q.nx * u * q.w * 0.5, cy = q.y + q.ny * u * q.w * 0.5, ang = Math.atan2(q.ny, q.nx);
      for (var k = 0; k < 3; k++) { x.fillStyle = T.rgba(TINTA, 0.55 + r() * 0.3); x.beginPath(); x.ellipse(cx + (r() - 0.5) * R, cy + (r() - 0.5) * R * 0.6, R * (0.8 + r() * 0.6), R * (0.5 + r() * 0.3), ang + (r() - 0.5) * 0.4, 0, TAU); x.fill(); }
      for (k = 0; k < 2; k++) {
        var arco = [], RR = R * (2 + k * 0.9), a0 = k ? Math.PI * 1.1 : Math.PI * 0.1;
        for (var m = 0; m <= 8; m++) { var a2 = a0 + Math.PI * 0.75 * m / 8; arco.push([cx + Math.cos(a2) * RR * 1.5 * q.nx + Math.sin(a2) * RR * q.dx, cy + Math.cos(a2) * RR * 1.5 * q.ny + Math.sin(a2) * RR * q.dy]); }
        T.pincelada(x, arco, { ancho: Math.max(1, R * 0.35), alfa: 0.6, carga: 0.8, seco: 0.8, entrada: 0.25, salida: 0.45, cerdas: 4, semilla: semilla(r) });
      }
    });
    gruesas.forEach(function (b) {
      if (b.raiz || b.tronco) return;
      var q = en(b, b.tot * 0.04);
      T.salpicar(x, q.x, q.y, q.w * 0.7, { n: 4 + Math.floor(r() * 5), alfa: 0.85, semilla: semilla(r), max: s * 0.004 });
    });
    marca('nudos'); yield 'madera';
    // 6 · las ramas: tinta oscura con su sombra gris a un lado y blanco volante
    medias.sort(function (a, b) { return b.w[0] - a.w[0]; });
    for (var mi = 0; mi < medias.length; mi++) { if (mi && mi % 8 === 0) yield 'medias'; (function (b) {
      var W = b.w[0], n = b.p.length, mid = Math.floor(n / 2);
      var lado = (b.N[mid][0] * LUZ[0] + b.N[mid][1] * LUZ[1]) > 0 ? -1 : 1;
      if (W > s * 0.017) trazo(x, desplazar(b, function (i) { return lado * b.w[i] * 0.04; }), b.w.map(function (v) { return v * 1.25; }), { alfa: 0.17, carga: 0.8, seco: 0.9, rugoso: 0.45, salida: 0.3, semilla: semilla(r), cerdas: Math.max(5, Math.min(8, Math.round(W * 0.35))) });
      trazo(x, b.p, b.w, { alfa: 0.92, carga: 1, seco: 0.3, rugoso: 0.38, entrada: 0.02, salida: 0.08, semilla: semilla(r), cerdas: Math.max(6, Math.min(9, Math.round(W * 0.45))) });
      if (W > s * 0.015) {
        x.save(); x.globalCompositeOperation = 'destination-out';
        for (var v = 0; v < 2; v++) {
          var i0 = Math.floor((0.1 + r() * 0.6) * n), i1 = Math.min(n - 1, i0 + 3 + Math.floor(r() * n * 0.25)), off = (r() < 0.5 ? -1 : 1) * (0.12 + r() * 0.2);
          var tl = []; for (var i = i0; i <= i1; i++) tl.push([b.p[i][0] + b.N[i][0] * off * b.w[i], b.p[i][1] + b.N[i][1] * off * b.w[i]]);
          if (tl.length > 2) T.pincelada(x, tl, { ancho: Math.max(0.7, W * (0.06 + r() * 0.08)), alfa: 1, carga: 0.9, seco: 0.5, entrada: 0.4, salida: 0.5, cerdas: 3, semilla: semilla(r) });
        }
        x.restore();
      }
    })(medias[mi]); }
    marca('medias ' + medias.length); yield 'madera';
    // 7 · ramillas y espolones: trazos finos, rápidos, afilados (unas pocas más grises, más lejos)
    var grupos = [[], [], []];
    finas.forEach(function (b) { grupos[b.espolon ? 0 : r() < 0.22 ? 2 : 1].push(b); });
    grupos.forEach(function (g, i) {
      x.fillStyle = T.rgba(TINTA, [0.9, 0.9, 0.6][i]); x.beginPath();
      g.forEach(function (b) {
        var izq = [], der = [], sem = b.L.length * 3.1 + b.p[0][0];
        for (var k = 0; k < b.p.length; k++) {
          var hw = Math.max(0.28, b.w[k] / 2 * (1 + (T.ruido1(k * 0.8, sem) - 0.5) * 0.35)), n = b.N[k];
          izq.push([b.p[k][0] + n[0] * hw, b.p[k][1] + n[1] * hw]); der.push([b.p[k][0] - n[0] * hw, b.p[k][1] - n[1] * hw]);
        }
        var fin = b.p[b.p.length - 1], dfin = b.D[b.D.length - 1];
        x.moveTo(izq[0][0], izq[0][1]);
        for (k = 1; k < izq.length; k++) x.lineTo(izq[k][0], izq[k][1]);
        x.lineTo(fin[0] + dfin[0] * s * 0.003, fin[1] + dfin[1] * s * 0.003);
        for (k = der.length - 1; k >= 0; k--) x.lineTo(der[k][0], der[k][1]);
        x.closePath();
      });
      x.fill();
    });
    marca('finas ' + finas.length); yield 'madera';
    // 8 · el suelo al pie: unos trazos secos y tumbados (la hierba la pone el juego)
    var k;
    for (k = 0; k < 4; k++) {
      var sx0 = base[0] + (r() - 0.6) * s * 0.4, sl = s * (0.08 + r() * 0.14), sy = base[1] + s * (0.002 + r() * 0.006);
      T.pincelada(x, [[sx0, sy], [sx0 + sl * 0.5, sy + (r() - 0.5) * s * 0.004], [sx0 + sl, sy + (r() - 0.5) * s * 0.004]], { ancho: s * (0.004 + r() * 0.005), alfa: 0.55 + r() * 0.3, carga: 0.8, seco: 0.85, rasgado: 0.5, entrada: 0.1, salida: 0.4, semilla: semilla(r) });
    }
    marca('suelo'); yield 'madera';
  }

  /* ------------------------------------------------------------------ el cerezo: las yemas (finales del invierno)
     Pequeñas y oscuras, en las puntas de las ramillas y de los espolones y alguna a lo largo; unas pocas ya hinchadas,
     con la punta roja. */
  function pintarYemas(x, E, s, r) {
    var lista = [];
    E.ramas.forEach(function (b) {
      if (b.tronco || b.raiz || b.maestra || (b.nivel < 3 && !b.espolon && b.hijos.length)) return;
      var fin = b.p[b.p.length - 1], d = b.D[b.D.length - 1], a = Math.atan2(d[1], d[0]);
      if (r() < 0.78) lista.push([fin[0], fin[1], a, 1]);
      if (r() < 0.25) lista.push([fin[0], fin[1], a + (r() < 0.5 ? 0.7 : -0.7), 0.8]);
      if (b.espolon) return;
      for (var dd = b.tot * (0.35 + r() * 0.2); dd < b.tot * 0.9; dd += s * (0.03 + r() * 0.04)) {
        var q = en(b, dd), ld = r() < 0.5 ? -1 : 1;
        lista.push([q.x + q.nx * ld * q.w * 0.4, q.y + q.ny * ld * q.w * 0.4, q.a + ld * (0.6 + r() * 0.5), 0.75]);
      }
    });
    // cada yema: un huso con punta (escamas cerradas), apoyado en la ramilla; las hinchadas, con la punta más roja
    var cuerpo = new Path2D(), punta = new Path2D();
    lista.forEach(function (y) {
      var R = s * (0.0018 + r() * 0.001) * y[3], Lb = R * (2.5 + r() * 0.8), dx = Math.cos(y[2]), dy = Math.sin(y[2]), nx = -dy, ny = dx;
      var bx = y[0] - dx * R * 0.3, by = y[1] - dy * R * 0.3, tx = bx + dx * Lb, ty = by + dy * Lb, mx = bx + dx * Lb * 0.42, my = by + dy * Lb * 0.42;
      cuerpo.moveTo(bx, by); cuerpo.quadraticCurveTo(mx + nx * R * 1.35, my + ny * R * 1.35, tx, ty); cuerpo.quadraticCurveTo(mx - nx * R * 1.35, my - ny * R * 1.35, bx, by);
      if (r() < 0.45) { var px = bx + dx * Lb * 0.62, py = by + dy * Lb * 0.62; punta.moveTo(tx, ty); punta.quadraticCurveTo(px + nx * R * 0.9, py + ny * R * 0.9, px - dx * R * 0.4, py - dy * R * 0.4); punta.quadraticCurveTo(px - nx * R * 0.9, py - ny * R * 0.9, tx, ty); }
    });
    x.fillStyle = T.rgba([100, 22, 22], 0.94); x.fill(cuerpo);
    x.fillStyle = T.rgba([176, 44, 40], 0.85); x.fill(punta);
    return lista;
  }

  /* ------------------------------------------------------------------ el cerezo: la flor
     Sellos de flor pintados una vez (cinco pétalos con su muesca, más rosa hacia el centro, estambres oscuros): de
     frente, ladeadas, de lado y en capullo, en cinco tonos. Racimos en las ramillas y los espolones, más tupidos en las
     puntas (las ramas maestras y el tronco quedan limpios); debajo, una aguada rosa moteada que los junta en nubes;
     detrás de la madera, flores más hondas; delante, las claras, alguna blanca (el papel) y alguna roja; pétalos que
     caen y pétalos en el suelo. */
  var TONOS = {
    blanco: { c: [236, 186, 192], m: [250, 240, 238], b: [252, 248, 245] },
    claro: { c: [228, 154, 166], m: [247, 222, 222], b: [250, 236, 234] },
    medio: { c: [214, 116, 134], m: [240, 194, 200], b: [245, 212, 214] },
    hondo: { c: [190, 76, 100], m: [226, 150, 164], b: [232, 170, 180] },
    acento: { c: [150, 28, 46], m: [196, 70, 92], b: [214, 104, 122] }
  };
  function petalo(x, a, R, t, alfa) {
    x.save(); x.rotate(a);
    var g = x.createRadialGradient(0, 0, R * 0.05, 0, 0, R);
    g.addColorStop(0, T.rgba(t.c, alfa)); g.addColorStop(0.45, T.rgba(t.m, alfa)); g.addColorStop(1, T.rgba(t.b, alfa));
    x.fillStyle = g; x.beginPath();
    x.moveTo(R * 0.06, 0);
    x.bezierCurveTo(R * 0.28, -R * 0.34, R * 0.8, -R * 0.5, R * 0.98, -R * 0.16);
    x.lineTo(R * 0.84, -R * 0.01);
    x.lineTo(R * 0.98, R * 0.15);
    x.bezierCurveTo(R * 0.8, R * 0.5, R * 0.28, R * 0.34, R * 0.06, 0);
    x.fill(); x.restore();
  }
  function sello(R, tono, tipo, sem) {
    var m = 2, L = T.lienzo(R * 2 + m * 2, R * 2 + m * 2), x = L.x, r = T.azar(sem), t = TONOS[tono], k;
    x.translate(R + m, R + m);
    if (tipo === 'frente' || tipo === 'frente2') {
      var a0 = r() * TAU, fuerte = tipo === 'frente';
      for (k = 0; k < 5; k++) petalo(x, a0 + k / 5 * TAU + (r() - 0.5) * 0.22, R * (0.88 + r() * 0.12), t, 0.92);
      x.fillStyle = T.rgba(fuerte ? t.c : t.m, 0.9); x.beginPath(); x.arc(0, 0, R * (fuerte ? 0.2 : 0.16), 0, TAU); x.fill();
      x.strokeStyle = T.rgba(fuerte ? TONOS.acento.c : t.c, fuerte ? 0.7 : 0.6); x.lineWidth = Math.max(0.5, R * 0.03);
      x.fillStyle = T.rgba(fuerte ? [70, 20, 24] : [150, 60, 70], fuerte ? 0.85 : 0.7);
      var ne = fuerte ? 11 : 7;
      for (k = 0; k < ne; k++) {
        var ae = k / ne * TAU + r() * 0.3, le = R * (0.28 + r() * 0.16);
        x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(ae) * le, Math.sin(ae) * le); x.stroke();
        x.beginPath(); x.arc(Math.cos(ae) * le, Math.sin(ae) * le, Math.max(0.45, R * (fuerte ? 0.055 : 0.045)), 0, TAU); x.fill();
      }
    } else if (tipo === 'lado') {
      // la copa de lado: tres pétalos abiertos hacia arriba, el cáliz y el rabillo
      x.strokeStyle = T.rgba([90, 40, 36], 0.6); x.lineWidth = Math.max(0.5, R * 0.04);
      x.beginPath(); x.moveTo(0, R * 0.35); x.quadraticCurveTo(R * 0.1, R * 0.7, R * 0.05, R * 0.98); x.stroke();
      [-1.05, 0, 1.05].forEach(function (d, i) { petalo(x, -Math.PI / 2 + d * 0.85, R * (i === 1 ? 0.8 : 0.92), t, 0.92); });
      x.fillStyle = T.rgba(TONOS.acento.c, 0.9); x.beginPath(); x.ellipse(0, R * 0.22, R * 0.2, R * 0.16, 0, 0, TAU); x.fill();
      x.fillStyle = T.rgba([70, 30, 28], 0.8); x.beginPath(); x.ellipse(0, R * 0.36, R * 0.14, R * 0.09, 0, 0, TAU); x.fill();
    } else if (tipo === 'capullo') {
      x.strokeStyle = T.rgba([90, 40, 36], 0.6); x.lineWidth = Math.max(0.5, R * 0.04);
      x.beginPath(); x.moveTo(0, R * 0.25); x.quadraticCurveTo(-R * 0.1, R * 0.6, R * 0.02, R * 0.95); x.stroke();
      var g = x.createRadialGradient(0, -R * 0.2, R * 0.05, 0, -R * 0.1, R * 0.5);
      g.addColorStop(0, T.rgba(t.b, 0.95)); g.addColorStop(1, T.rgba(t.c, 0.95));
      x.fillStyle = g; x.beginPath(); x.ellipse(0, -R * 0.12, R * 0.3, R * 0.42, 0, 0, TAU); x.fill();
      x.fillStyle = T.rgba(TONOS.acento.c, 0.9); x.beginPath(); x.ellipse(0, R * 0.22, R * 0.2, R * 0.13, 0, 0, TAU); x.fill();
    } else {   // un pétalo suelto
      petalo(x, -Math.PI / 2, R * 0.95, t, 0.92);
    }
    return L;
  }
  // poner un sello girado y ladeado
  function poner(x, S, cx, cy, R, rot, ladeo, alfa, R0) {
    var k = R / R0, c = Math.cos(rot), sn = Math.sin(rot);
    x.globalAlpha = alfa;
    x.setTransform(c * k, sn * k, -sn * k * ladeo, c * k * ladeo, cx, cy);
    x.drawImage(S.c, -S.w / 2, -S.h / 2);
  }

  function racimos(E, s, r) {
    var lista = [], copa = E.copa;
    function rac(x, y, rc, n, b, punta) { lista.push({ x: x, y: y, rc: rc, n: n, b: b, punta: punta }); }
    E.ramas.forEach(function (b) {
      if (b.raiz || b.tronco || b.maestra) return;
      var fin = b.p[b.p.length - 1];
      if (b.espolon) { if (r() < 0.8) rac(fin[0], fin[1] + s * 0.003, s * (0.009 + r() * 0.007), 2 + Math.floor(r() * 3), b); return; }
      var ini = b.nivel >= 4 ? 0.3 : b.nivel === 3 ? 0.45 : 0.62, d = b.tot * ini, esp = s * 0.042;
      while (d < b.tot * 0.92) {
        var q = en(b, d), f = d / b.tot;
        if (q.w < s * 0.009) rac(q.x + (r() - 0.5) * s * 0.008, q.y + (r() - 0.3) * s * 0.01, s * (0.01 + 0.01 * f + r() * 0.006), 2 + Math.floor(r() * 2.5 + f * 2.5), b);
        d += esp * (0.7 + r() * 0.8);
      }
      if (b.nivel >= 3 || !b.hijos.length) rac(fin[0], fin[1], s * (0.016 + r() * 0.01), 4 + Math.floor(r() * 5), b, true);
    });
    // la luz de cada racimo: más claro arriba y a la izquierda de la copa, más hondo abajo y a la derecha
    lista.forEach(function (c) {
      var u = (c.x - copa[0]) / copa[2], v = (c.y - copa[1]) / copa[3];
      c.luz = clamp(0.55 - v * 0.4 - u * 0.15 + (r() - 0.5) * 0.45, 0, 1);
    });
    return lista;
  }

  function* pintarFlor(F, madera, E, w, h, r) {
    var x = F.x, s = h, R0 = Math.max(6, Math.ceil(s * 0.02)), petalos = [];
    var S = {}, tipos = ['frente', 'frente2', 'lado', 'capullo', 'petalo'];
    Object.keys(TONOS).forEach(function (tono, i) { S[tono] = tipos.map(function (tipo, j) { return sello(R0, tono, tipo, 100 + i * 10 + j); }); });
    marca('sellos'); yield 'flor';
    var lista = racimos(E, s, r), flores = [];
    lista.forEach(function (c) {
      for (var k = 0; k < c.n; k++) {
        var a = r() * TAU, d = Math.sqrt(r()) * c.rc, fx = c.x + Math.cos(a) * d, fy = c.y + Math.sin(a) * d * 0.85 + c.rc * 0.2;
        var luz = clamp(c.luz + (c.y - fy) / c.rc * 0.2 + (r() - 0.5) * 0.3, 0, 1);
        var tono = luz > 0.8 ? 'blanco' : luz > 0.5 ? 'claro' : luz > 0.22 ? 'medio' : 'hondo';
        if (r() < 0.025) tono = 'acento';
        var tr = r(), tipo = tr < 0.62 ? (r() < 0.5 ? 0 : 1) : tr < 0.84 ? 2 : 3;
        flores.push({ x: fx, y: fy, R: s * (0.0065 + r() * 0.004) * (c.punta ? 1.1 : 1), tono: tono, tipo: tipo, rot: tipo < 2 ? r() * TAU : (r() - 0.5) * 0.7, ladeo: tipo < 2 ? 0.55 + r() * 0.45 : 1, delante: r() < 0.5 + luz * 0.25 });
      }
    });
    marca('racimos ' + lista.length + ' flores ' + flores.length); yield 'flor';
    // 1 · la aguada rosa que junta los racimos en nubes: manchas pequeñas, húmedas, moteadas
    var Ag = T.lienzo(w, h), ax = Ag.x;
    ax.fillStyle = T.rgba([230, 168, 174], 1); ax.beginPath();
    lista.forEach(function (q) { for (var k = 0; k < 3; k++) { var ex = q.x + (r() - 0.5) * q.rc * 1.2, ey = q.y + (r() - 0.25) * q.rc, erx = q.rc * (0.3 + r() * 0.35); ax.moveTo(ex + erx, ey); ax.ellipse(ex, ey, erx, q.rc * (0.22 + r() * 0.25), r() * TAU, 0, TAU); } });
    ax.fill();
    var tn = T.textura('nubes', 512, 3, 4, 1.4, 21, false);
    ax.globalCompositeOperation = 'destination-out'; ax.globalAlpha = 0.6; ax.fillStyle = ax.createPattern(tn.c, 'repeat'); ax.fillRect(0, 0, w, h);
    x.globalAlpha = 0.24; x.drawImage(Ag.c, 0, 0); x.globalAlpha = 1;
    marca('aguadas rosa'); yield 'flor';
    // 2 · las flores de detrás, más hondas
    for (var fi = 0; fi < flores.length; fi++) {
      var f = flores[fi];
      if (fi && fi % 1200 === 0) { x.setTransform(1, 0, 0, 1, 0, 0); yield 'flores'; }
      if (f.delante) continue;
      var t = f.tono === 'blanco' ? 'claro' : f.tono === 'claro' ? 'medio' : f.tono;
      poner(x, S[t][f.tipo], f.x, f.y, f.R * 0.92, f.rot, f.ladeo, 0.85, R0);
    }
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1;
    marca('detras'); yield 'flor';
    // 3 · la madera
    x.drawImage(madera.c, 0, 0);
    marca('madera'); yield 'flor';
    // 4 · las flores de delante
    for (fi = 0; fi < flores.length; fi++) {
      f = flores[fi];
      if (fi && fi % 1200 === 0) { x.setTransform(1, 0, 0, 1, 0, 0); yield 'flores'; }
      if (!f.delante) continue;
      poner(x, S[f.tono][f.tipo], f.x, f.y, f.R, f.rot, f.ladeo, 0.95, R0);
      if (fi % 9 === 0) petalos.push([Math.round(f.x), Math.round(f.y)]);
    }
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1;
    marca('delante'); yield 'flor';
    // 5 · pétalos que caen y pétalos en el suelo (un velo rosa al pie y pétalos tumbados, más junto al tronco)
    for (var k = 0; k < 18; k++) {
      var q = lista[Math.floor(r() * lista.length)], px = q.x + (r() - 0.5) * s * 0.1, py = q.y + s * (0.04 + r() * 0.25);
      if (py > h - s * 0.05) continue;
      poner(x, S[r() < 0.5 ? 'medio' : 'claro'][4], px, py, s * (0.0065 + r() * 0.0025), r() * TAU, 0.4 + r() * 0.6, 0.92, R0);
    }
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1;
    var base = E.base;
    x.save(); x.translate(base[0], h - s * 0.008); x.scale(s * 0.3, s * 0.016);
    var gr = x.createRadialGradient(0, 0, 0, 0, 0, 1); gr.addColorStop(0, T.rgba([230, 160, 170], 0.3)); gr.addColorStop(1, T.rgba([230, 160, 170], 0));
    x.fillStyle = gr; x.beginPath(); x.arc(0, 0, 1, 0, TAU); x.fill(); x.restore();
    for (k = 0; k < 60; k++) {
      var gx = base[0] + (r() < 0.5 ? -1 : 1) * s * 0.36 * Math.pow(r(), 1.6), gy = h - s * (0.002 + r() * 0.016);
      poner(x, S[r() < 0.55 ? 'medio' : r() < 0.6 ? 'claro' : 'hondo'][4], gx, gy, s * (0.0055 + r() * 0.0025), r() * TAU, 0.3 + r() * 0.3, 0.95, R0);
    }
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1;
    marca('caidos'); yield 'flor';
    return petalos;
  }

  /* El cerezo. Devuelve { yemas, flor, petalos: [[x, y], …], base: [x, y] } en px del lienzo (base: el pie del tronco).
     op: semilla, lado (1: se inclina a la derecha; −1: a la izquierda), vaciar.
     A.cerezoPasos es la misma pintura por pasos (un generador, como A.montesPasos: cede entre paso y paso y, salvo
     vaciar: false, obliga al lienzo a pintar lo pendiente en cada uno) y devuelve el resultado al acabar;
     A.cerezo lo pinta de una vez. */
  // un subgenerador que, al ceder, obliga al lienzo a pintar lo pendiente (si no, todo cae en el paso que lo lea)
  function* vaciando(g, x, vaciar) { var p = g.next(); while (!p.done) { if (vaciar) T.vaciar(x); yield p.value; p = g.next(); } return p.value; }
  function sinVaciar(op) { var o = {}; for (var k in op) o[k] = op[k]; o.vaciar = false; return o; }
  A.cerezoPasos = function* (w, h, op) {
    op = op || {};
    var sem = op.semilla || 1185, s = h, vaciar = op.vaciar !== false;
    _t0 = performance.now();
    var E = esqueleto(w, h, T.azar(sem), op.lado || 1);
    var xs = [], ys = [];
    E.ramas.forEach(function (b) { var f = b.p[b.p.length - 1]; xs.push(f[0]); ys.push(f[1]); });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = E.base[1] - s * 0.3;
    E.copa = [(x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2];
    marca('esqueleto ' + E.ramas.length); yield 'esqueleto';
    var M = T.lienzo(w, h); _x = M.x;
    yield* vaciando(pintarMadera(M.x, w, h, E, T.azar(sem + 1)), M.x, vaciar);
    var Y = T.lienzo(w, h); _x = Y.x; Y.x.drawImage(M.c, 0, 0);
    pintarYemas(Y.x, E, s, T.azar(sem + 2));
    marca('yemas'); if (vaciar) T.vaciar(Y.x); yield 'yemas';
    var F = T.lienzo(w, h); _x = F.x;
    var petalos = yield* vaciando(pintarFlor(F, M, E, w, h, T.azar(sem + 3)), F.x, vaciar);
    _x = null;
    return { yemas: Y, flor: F, petalos: petalos, base: E.base, w: w, h: h };
  };
  A.cerezo = function (w, h, op) { var g = A.cerezoPasos(w, h, sinVaciar(op)), p = g.next(); while (!p.done) p = g.next(); return p.value; };

  /* ------------------------------------------------------------------ la colina de Shiroyama
     Una colina oscura vista de lejos: laderas largas, un altozano a la izquierda, un hombro a la derecha y la cima
     casi llana, donde espera el samurái. La luz viene de la izquierda.
     1 · aguada de la masa, oscura arriba, que se pierde en una franja de niebla (debajo, las faldas, claras);
     2 · la ladera de sombra; 3 · la banda oscura bajo la cresta; 4 · fibras de cáñamo que bajan por las laderas
     (como en A.montes); 5 · el monte bajo y las copas de los pinos: toques horizontales del pincel (puntos «Mi»),
     primero húmedos (desenfocados) y luego unos pocos secos y nítidos; 6 · el filo de la cresta a pincel seco;
     7 · cantos rodados; 8 · troncos, ramas y agujas de los pinos; 9 · hierba contra el cielo; 10 · la franja de
     niebla y el pie que se desvanece.
     op: semilla, tono (0…1), cima (x de la cima, fracción del ancho), vaciar. Devuelve el lienzo con L.cima = [x, y] (el
     suelo de la cima, en px del lienzo) y L.cresta (la línea de la cresta, [[x, y], …], para tapar lo de detrás).
     A.colinaPasos: lo mismo por pasos (generador); A.colina, de una vez. */
  // un toque del pincel tumbado: una lente horizontal de bordes rotos (en un Path2D, para pintar muchos de una vez)
  function toque(P, cx, cy, lw, lh, ang, sem) {
    var n = 7, c = Math.cos(ang), sn = Math.sin(ang), i, arr = [], aba = [];
    for (i = 0; i <= n; i++) {
      var f = i / n, u = (f - 0.5) * lw, e = Math.pow(Math.sin(Math.PI * f), 0.7) * lh * 0.5;
      var e1 = e * (0.7 + 0.6 * T.h1(sem + i * 1.7)), e2 = e * (0.6 + 0.5 * T.h1(sem + i * 2.3 + 9));
      arr.push([cx + c * u + sn * e1, cy + sn * u - c * e1]); aba.push([cx + c * u - sn * e2, cy + sn * u + c * e2]);
    }
    P.moveTo(arr[0][0], arr[0][1]);
    for (i = 1; i <= n; i++) P.lineTo(arr[i][0], arr[i][1]);
    for (i = n; i >= 0; i--) P.lineTo(aba[i][0], aba[i][1]);
    P.closePath();
  }
  A.colinaPasos = function* (w, h, op) {
    op = op || {};
    var L = T.lienzo(w, h), x = L.x, sem = op.semilla || 1877, s = h, i, k, j, r, vaciar = op.vaciar !== false;
    function azar(n) { return T.azar(sem * 13 + n * 7919); }   // cada parte, su azar: cambiar una no mueve las demás
    var tono = op.tono == null ? 0.85 : op.tono;
    var cx = w * (op.cima == null ? 0.5 : op.cima), techo = h * 0.36, pie = h * 1.02;
    function forma(xx) {
      var u = (xx - cx) / w, dl = u < 0 ? -u / 0.5 : u / 0.44;
      var f = 1 / (1 + Math.pow(Math.max(0, dl - 0.06) / 0.36, 2));
      f += 0.045 * Math.exp(-Math.pow((u + 0.27) / 0.06, 2)) + 0.05 * Math.exp(-Math.pow((u - 0.2) / 0.045, 2));
      f += ((T.fbm1(xx / w * 10, 7, 3) - 0.5) * 0.05 + (T.fbm1(xx / w * 60, 8, 2) - 0.5) * 0.012) * suave((Math.abs(u) - 0.035) / 0.1);
      return f;
    }
    var f0 = forma(cx);
    function cresta(xx) { return pie - (pie - techo) * forma(xx) / f0; }
    function pendiente(xx) { return (cresta(xx + 2) - cresta(xx - 2)) / 4; }
    var paso = Math.max(1, w / 500), linea = [], xx, yN = techo + (pie - techo) * 0.5;   // yN: la franja de niebla
    for (xx = -paso * 2; xx <= w + paso * 2; xx += paso) linea.push([xx, cresta(xx)]);
    function masa(c) { c.beginPath(); c.moveTo(linea[0][0], h + 2); linea.forEach(function (q) { c.lineTo(q[0], q[1]); }); c.lineTo(linea[linea.length - 1][0], h + 2); c.closePath(); c.fill(); }

    // 1 · la masa: oscura arriba, se pierde en la franja de niebla; debajo, las faldas, mucho más claras
    T.aguada(x, w, h, masa, { gris: tono * 0.72, degradado: [1, 0.1], y0: techo, y1: yN + s * 0.08, nubes: 0.55, grano: 0.3, borde: 0.5, semilla: 31 });
    T.aguada(x, w, h, masa, { gris: tono * 0.2, degradado: [0, 1], y0: yN - s * 0.02, y1: yN + s * 0.12, nubes: 0.6, grano: 0.3, semilla: 32 });
    if (vaciar) T.vaciar(x); yield 'colina';
    // 2 · la ladera de sombra: de la cima hacia la derecha, con el borde de la luz difuso y ondulado
    T.aguada(x, w, h, function (c) {
      c.beginPath(); c.moveTo(cx - w * 0.02, cresta(cx - w * 0.02));
      for (xx = cx - w * 0.02; xx <= w + paso; xx += paso * 3) c.lineTo(xx, cresta(xx));
      c.lineTo(w + paso, h + 2);
      for (var yy = h + 2; yy >= techo; yy -= s * 0.04) c.lineTo(cx + w * (0.05 - (h - yy) / h * 0.04 + (T.fbm1(yy / s * 4, 12, 2) - 0.5) * 0.08), yy);
      c.closePath(); c.fill();
    }, { gris: tono * 0.32, degradado: [1, 0.2], y0: techo, y1: h, nubes: 0.5, grano: 0.3, suave: s * 0.05, semilla: 37 });
    if (vaciar) T.vaciar(x); yield 'colina';
    // 3 · la banda oscura bajo la cresta, con el borde de abajo deshilachado
    T.aguada(x, w, h, function (c) {
      c.beginPath(); c.moveTo(linea[0][0], linea[0][1]);
      linea.forEach(function (q) { c.lineTo(q[0], q[1]); });
      for (var m = linea.length - 1; m >= 0; m--) {
        var q = linea[m], u = (q[0] - cx) / w, prof = (pie - q[1]) * (0.12 + 0.18 * suave((u + 0.05) / 0.25)) * (0.45 + T.fbm1(q[0] / w * 16, 9, 3));
        c.lineTo(q[0], q[1] + prof);
      }
      c.closePath(); c.fill();
    }, { gris: tono * 0.5, nubes: 0.55, grano: 0.35, suave: s * 0.014, borde: 0.9, semilla: 33 });
    if (vaciar) T.vaciar(x); yield 'colina';
    // 4 · fibras de cáñamo: grupos de trazos finos que bajan de la cresta siguiendo la pendiente (más en la sombra)
    r = azar(4);
    for (k = 0; k < 34; k++) {
      var lado = r() < 0.65 ? 1 : -1, fx = cx + lado * w * (0.06 + Math.pow(r(), 0.85) * 0.37), fy = cresta(fx) + s * (0.015 + r() * 0.03);
      if (fy > yN) continue;
      var n2 = 2 + Math.floor(r() * 3), lmul = 0.15 + r() * 0.25;
      for (j = 0; j < n2; j++) {
        var sl = fx + (j - n2 / 2) * s * 0.012 + (r() - 0.5) * s * 0.006, sp = pendiente(sl), dx0 = Math.sign(sp || lado) * (0.3 + Math.min(1.4, Math.abs(sp)) * 0.5), ll = (pie - cresta(sl)) * lmul * (0.7 + r() * 0.5), pts = [];
        for (var m = 0; m <= 7; m++) { var f = m / 7; pts.push([sl + dx0 * ll * f * (1 - 0.4 * f) + (T.fbm1(f * 2.5 + j * 3, k, 2) - 0.5) * s * 0.012, cresta(sl) + s * 0.006 + ll * f]); }
        T.pincelada(x, pts, { ancho: Math.max(0.8, s * (0.0022 + r() * 0.0028)), alfa: tono * (0.3 + r() * 0.3), carga: 0.6 + r() * 0.35, seco: 0.85, entrada: 0.15, salida: 0.6, cerdas: 4, semilla: semilla(r), rugoso: 0.2 });
      }
    }
    if (vaciar) T.vaciar(x); yield 'colina';
    // 5 · el monte bajo y las copas de los pinos: toques húmedos (en una capa que se desenfoca) y luego secos y nítidos
    r = azar(5);
    var hum = T.lienzo(w, h), blando = [new Path2D(), new Path2D()], seco = [new Path2D(), new Path2D()];
    for (k = 0; k < 170; k++) {
      var ux = (r() - 0.5) * 2, mx = cx + Math.sign(ux) * Math.pow(Math.abs(ux), 0.8) * w * 0.46;
      var alto = Math.max(1, pie - cresta(mx)), prof = Math.pow(r(), 3) * Math.max(0, yN - cresta(mx)) * 0.9, my = cresta(mx) + s * 0.012 + prof, fr = prof / alto;
      if ((Math.abs(mx - cx) < w * 0.04 && prof < s * 0.05) || cresta(mx) > yN - s * 0.03) continue;
      var nd = 5 + Math.floor(r() * 10 * (1 - fr)), ang = Math.atan(pendiente(mx)) * 0.55, tam = s * (0.018 + r() * 0.016) * (1 - fr * 0.4);
      for (j = 0; j < nd; j++) {
        var dxm = (r() - 0.5) * tam * 3.6, dym = (r() - 0.5) * tam * 0.9 + dxm * Math.tan(ang), lw = tam * (0.7 + r() * 0.8);
        toque(blando[fr < 0.2 ? 0 : 1], mx + dxm, my + dym, lw, lw * (0.35 + r() * 0.2), ang + (r() - 0.5) * 0.3, k * 31.7 + j * 3.1);
        if (r() < 0.3) toque(seco[fr < 0.15 ? 0 : 1], mx + dxm + (r() - 0.5) * tam, my + dym + tam * 0.15, lw * 0.6, lw * 0.22, ang, k * 7.3 + j);
      }
    }
    // los pinos: uno grande junto a la cima (inclinado hacia fuera, sin tapar al samurái), dos en el altozano y dos en el hombro
    var copas = [];
    var px0 = cx - 0.066 * w;
    copas.push(pinoCima(blando, px0, cresta(px0) + s * 0.012, s * 0.25, -1, azar(49)));
    [[-0.27, 0.18, -0.06], [-0.3, 0.13, 0.12], [0.205, 0.17, 0.14], [0.235, 0.11, -0.05]].forEach(function (p, i) {
      var px = cx + p[0] * w; copas.push(pino(blando, seco, px, cresta(px) + s * 0.012, s * p[1], p[2], azar(50 + i)));
    });
    hum.x.fillStyle = T.rgba(TINTA, 0.85); hum.x.fill(blando[0]);
    hum.x.fillStyle = T.rgba(TINTA, 0.55); hum.x.fill(blando[1]);
    var tg = T.textura('granulado', 256, 48, 2, 1.8, 9, false);
    hum.x.globalCompositeOperation = 'destination-out'; hum.x.globalAlpha = 0.3; hum.x.fillStyle = hum.x.createPattern(tg.c, 'repeat'); hum.x.fillRect(0, 0, w, h);
    var hb = T.desenfocar(hum, Math.max(1.5, s * 0.004));
    x.save(); x.globalAlpha = tono; x.drawImage(hb.c, 0, 0); x.globalAlpha = tono * 0.35; x.drawImage(hum.c, 0, 0); x.restore();
    if (vaciar) T.vaciar(x); yield 'colina';
    x.fillStyle = T.rgba(TINTA, Math.min(1, tono * 1.1)); x.fill(seco[0]);
    x.fillStyle = T.rgba(TINTA, tono * 0.6); x.fill(seco[1]);
    if (vaciar) T.vaciar(x); yield 'colina';
    // 6 · el filo de la cresta, a tramos (más cargado cerca de la cima)
    r = azar(6);
    var ini = w * 0.02;
    while (ini < w * 0.98) {
      var lon = w * (0.025 + r() * 0.07), salto = w * (0.004 + r() * 0.02), tr = [];
      for (xx = ini; xx <= ini + lon; xx += paso * 1.5) tr.push([xx, cresta(xx) + 0.5]);
      var cerca = 1 - clamp(Math.abs(ini + lon / 2 - cx) / (w * 0.45), 0, 1);
      if (tr.length > 4 && cresta(ini) < yN) T.pincelada(x, tr, { ancho: Math.max(1.2, s * (0.004 + r() * 0.005 + cerca * 0.004)), alfa: Math.min(1, tono * (0.8 + cerca * 0.5 + r() * 0.2)), carga: 0.7 + r() * 0.3, seco: 0.55 + r() * 0.35, entrada: 0.12, salida: 0.4, rugoso: 0.35, cerdas: 7, semilla: semilla(r) });
      ini += lon + salto;
    }
    if (vaciar) T.vaciar(x); yield 'colina';
    // 7 · cantos rodados
    r = azar(7);
    [[0.09, 0.07, 0.05], [0.16, 0.11, 0.035], [-0.15, 0.12, 0.04]].forEach(function (rc) {
      var rx = cx + rc[0] * w, ry = cresta(rx) + rc[1] * s;
      if (ry < yN) canto(x, rx, ry, rc[2] * s * (0.9 + r() * 0.3), tono, r);
    });
    if (vaciar) T.vaciar(x); yield 'colina';
    // 8 · los troncos, ramas y agujas de los pinos; arbolitos lejanos
    copas.forEach(function (c) { c(x, tono); });
    r = azar(8);
    for (k = 0; k < 12; k++) {
      var ax = cx + (r() - 0.5) * w * 0.86;
      if (Math.abs(ax - cx) < w * 0.09) continue;
      var ay = cresta(ax) + s * (0.004 + r() * 0.05);
      if (ay > yN) continue;
      A.arbolito(x, ax, ay, s * (0.035 + r() * 0.035), Math.min(1, tono * 1.15), r);
    }
    if (vaciar) T.vaciar(x); yield 'colina';
    // 9 · hierba contra el cielo (más alta y tupida en la cima, donde está el samurái)
    r = azar(9);
    var hierba = new Path2D();
    for (xx = w * 0.03; xx < w * 0.97; xx += s * (0.003 + r() * 0.007)) {
      var yy = cresta(xx), cerca2 = 1 - clamp(Math.abs(xx - cx) / (w * 0.4), 0, 1);
      if (yy > yN || r() > 0.3 + 0.6 * cerca2) continue;
      var nb = 1 + Math.floor(r() * 3);
      for (j = 0; j < nb; j++) {
        var bx = xx + (r() - 0.5) * s * 0.006, by = yy + s * 0.003, ang2 = -Math.PI / 2 + (r() - 0.35) * 0.9, lh = s * (0.008 + r() * 0.018) * (0.6 + cerca2 * 0.8), wb = Math.max(0.4, s * 0.0014);
        var ex = bx + Math.cos(ang2) * lh, ey = by + Math.sin(ang2) * lh, cxp = bx + Math.cos(ang2 - 0.25) * lh * 0.55, cyp = by + Math.sin(ang2 - 0.25) * lh * 0.55;
        hierba.moveTo(bx - wb, by); hierba.quadraticCurveTo(cxp, cyp, ex, ey); hierba.quadraticCurveTo(cxp + wb * 0.6, cyp, bx + wb, by); hierba.closePath();
      }
    }
    x.fillStyle = T.rgba(TINTA, Math.min(1, tono * 1.15)); x.fill(hierba);
    if (vaciar) T.vaciar(x); yield 'colina';
    // 10 · la niebla: la franja que cruza la colina (jirones blandos) y el pie que se desvanece
    r = azar(10);
    x.save(); x.globalCompositeOperation = 'destination-out';
    var gb = x.createLinearGradient(0, yN - s * 0.1, 0, yN + s * 0.1);
    gb.addColorStop(0, 'rgba(0,0,0,0)'); gb.addColorStop(0.5, 'rgba(0,0,0,0.45)'); gb.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gb; x.fillRect(0, yN - s * 0.1, w, s * 0.2);
    for (k = 0; k < 16; k++) {
      var nx = w * (k + r()) / 16, ny = yN + (r() - 0.5) * s * 0.08, nrx = w * (0.08 + r() * 0.12), nry = s * (0.025 + r() * 0.035);
      var gn = x.createRadialGradient(0, 0, 0, 0, 0, 1); gn.addColorStop(0, 'rgba(0,0,0,' + (0.35 + r() * 0.35).toFixed(2) + ')'); gn.addColorStop(1, 'rgba(0,0,0,0)');
      x.save(); x.translate(nx, ny); x.scale(nrx, nry); x.fillStyle = gn; x.beginPath(); x.arc(0, 0, 1, 0, TAU); x.fill(); x.restore();
    }
    x.restore();
    x.save(); x.globalCompositeOperation = 'destination-in';
    var gp = x.createLinearGradient(0, h * 0.72, 0, h); gp.addColorStop(0, 'rgba(0,0,0,1)'); gp.addColorStop(0.6, 'rgba(0,0,0,0.35)'); gp.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gp; x.fillRect(0, 0, w, h);
    var gl = x.createLinearGradient(0, 0, w, 0); gl.addColorStop(0, 'rgba(0,0,0,0)'); gl.addColorStop(0.05, 'rgba(0,0,0,1)'); gl.addColorStop(0.95, 'rgba(0,0,0,1)'); gl.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gl; x.fillRect(0, 0, w, h);
    x.restore();
    L.cima = [Math.round(cx), Math.round(cresta(cx))];
    L.cresta = linea;
    return L;
  };
  A.colina = function (w, h, op) { var g = A.colinaPasos(w, h, sinVaciar(op || {})), p = g.next(); while (!p.done) p = g.next(); return p.value; };
  // un canto rodado medio enterrado: el lomo a pincel seco, la cara de sombra oscura, la de luz casi papel y musgo encima
  function canto(x, cx, cy, R, tono, r) {
    var n = 12, lomo = [], i;
    for (i = 0; i <= n; i++) { var a = Math.PI * (1.02 + 0.96 * i / n), rr = R * (0.85 + 0.25 * T.h1(cx + i * 3.7)); lomo.push([cx + Math.cos(a) * rr * 1.25, cy + Math.sin(a) * rr * 0.75]); }
    x.save(); x.globalCompositeOperation = 'destination-out'; x.translate(cx - R * 0.35, cy - R * 0.35); x.scale(R, R * 0.6);
    var gl0 = x.createRadialGradient(0, 0, 0, 0, 0, 1); gl0.addColorStop(0, 'rgba(0,0,0,0.4)'); gl0.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gl0; x.beginPath(); x.arc(0, 0, 1, 0, TAU); x.fill(); x.restore();
    x.fillStyle = T.rgba(TINTA, tono * 0.55); x.beginPath(); x.moveTo(lomo[Math.floor(n * 0.55)][0], lomo[Math.floor(n * 0.55)][1]);
    for (i = Math.floor(n * 0.55); i <= n; i++) x.lineTo(lomo[i][0], lomo[i][1]);
    x.quadraticCurveTo(cx + R * 0.4, cy + R * 0.1, lomo[Math.floor(n * 0.55)][0] - R * 0.15, cy); x.closePath(); x.fill();
    T.pincelada(x, lomo, { ancho: Math.max(1.1, R * 0.16), alfa: Math.min(1, tono * 1.2), carga: 0.9, seco: 0.6, entrada: 0.1, salida: 0.25, rugoso: 0.4, cerdas: 6, semilla: semilla(r) });
    var musgo = new Path2D();
    for (var j = 0; j < 4; j++) { var mp = lomo[2 + Math.floor(r() * (n - 4))]; toque(musgo, mp[0], mp[1] - R * 0.04, R * (0.3 + r() * 0.25), R * 0.13, 0, j * 5.3 + cx); }
    x.fillStyle = T.rgba(TINTA, Math.min(1, tono * 1.15)); x.fill(musgo);
  }
  // el pino de la cima, dibujado a propósito: tronco en ese que se inclina hacia fuera (lado: −1 izquierda), una rama
  // larga y baja con la almohadilla grande, la copa arriba y otra pequeña de contrapeso; como en pino(), las nubes van a
  // «blando» y devuelve la función que pinta encima tronco, ramas, agujas y bases
  function pinoCima(blando, bx, by, alto, lado, r) {
    function Q(a, b) { return [bx - lado * a * alto, by + b * alto]; }   // a < 0: hacia donde se inclina
    var tr = T.curva([Q(0, 0), Q(-0.05, -0.28), Q(0.0, -0.52), Q(-0.1, -0.76), Q(-0.17, -0.94)].map(function (q, i) { return i ? [q[0] + (r() - 0.5) * alto * 0.03, q[1]] : q; }), 7);
    var almo = [
      { rama: [Q(-0.01, -0.5), Q(-0.2, -0.57), Q(-0.4, -0.56)], x: Q(-0.44, 0)[0], y: by - alto * 0.6, w: alto * 0.56, h: alto * 0.16 },
      { rama: [Q(-0.07, -0.7), Q(0.06, -0.75), Q(0.16, -0.73)], x: Q(0.16, 0)[0], y: by - alto * 0.77, w: alto * 0.34, h: alto * 0.12 },
      { rama: null, x: Q(-0.2, 0)[0], y: by - alto * 0.97, w: alto * 0.5, h: alto * 0.17 },
      { rama: [Q(-0.12, -0.84), Q(-0.24, -0.86), Q(-0.33, -0.85)], x: Q(-0.36, 0)[0], y: by - alto * 0.87, w: alto * 0.26, h: alto * 0.1 }
    ];
    almo.forEach(function (a) {
      for (var m = 0; m < 4; m++) { var ex = a.x + (m - 1.5) * a.w * 0.22, ey = a.y + (m === 1 || m === 2 ? -a.h * 0.25 : a.h * 0.05), erx = a.w * (0.2 + r() * 0.08); blando[1].moveTo(ex + erx, ey); blando[1].ellipse(ex, ey, erx, a.h * (0.5 + r() * 0.2), 0, 0, TAU); }
    });
    var sem = semilla(r);
    return function (x, tono) {
      var an = tr.map(function (q, i) { var f = i / (tr.length - 1); return alto * (0.075 - 0.05 * f); });
      trazo(x, tr, an, { alfa: Math.min(1, tono * 1.25), carga: 1, seco: 0.55, entrada: 0.02, salida: 0.15, rugoso: 0.45, cerdas: 7, semilla: sem });
      var rr = T.azar(sem), agujas = new Path2D(), bases = new Path2D();
      almo.forEach(function (a, i) {
        if (a.rama) T.pincelada(x, a.rama, { ancho: Math.max(1, alto * 0.032), alfa: Math.min(1, tono * 1.2), carga: 1, seco: 0.5, entrada: 0.05, salida: 0.5, cerdas: 4, semilla: sem + i + 1 });
        var n = 40 + Math.round(a.w / alto * 40);
        for (var j = 0; j < n; j++) {
          var ang = Math.PI * (1.03 + 0.94 * j / (n - 1)), ex = a.x + Math.cos(ang) * a.w * 0.5 * (0.8 + rr() * 0.3), ey = a.y + Math.sin(ang) * a.h * (0.9 + rr() * 0.5);
          var ix = a.x + (ex - a.x) * (0.4 + rr() * 0.25), iy = a.y + (ey - a.y) * 0.3;
          agujas.moveTo(ix, iy); agujas.lineTo(ex + (rr() - 0.5) * a.w * 0.04, ey - rr() * a.h * 0.25);
        }
        if (a.rama) { bases.moveTo(a.x + a.w * 0.45, a.y + a.h * 0.22); bases.ellipse(a.x, a.y + a.h * 0.22, a.w * 0.45, a.h * 0.3, 0, 0, TAU); }
      });
      x.fillStyle = T.rgba(TINTA, Math.min(1, tono * 0.75)); x.fill(bases);
      x.strokeStyle = T.rgba(TINTA, Math.min(1, tono * 0.9)); x.lineWidth = Math.max(0.5, alto * 0.005); x.lineCap = 'round'; x.stroke(agujas);
    };
  }
  // un pino lejano: tronco curvo y, en pisos, almohadillas de agujas: una nube gris (en la capa húmeda), el abanico de
  // agujas por arriba y la base oscura; más anchas abajo y del lado del viento. Las nubes se apuntan en «blando»;
  // devuelve la función que pinta encima el tronco, las ramas, las agujas y las bases
  function pino(blando, seco, bx, by, alto, inclina, r) {
    var cima = [bx + Math.sin(inclina) * alto, by - alto];
    var tr = T.curva([[bx, by], [bx + Math.sin(inclina) * alto * 0.25 + alto * 0.06 * (r() - 0.5), by - alto * 0.3], [bx + Math.sin(inclina) * alto * 0.7 + alto * 0.08 * (r() - 0.5), by - alto * 0.66], cima], 6);
    var pisos = 3 + (r() < 0.4 ? 1 : 0), viento = inclina < 0 ? -1 : 1, almo = [], sem = semilla(r);
    for (var k = 0; k < pisos; k++) {
      var f = 0.42 + k / (pisos - 1) * 0.58, i = Math.min(tr.length - 1, Math.round(f * (tr.length - 1))), o = tr[i];
      var dl = k === pisos - 1 ? 0 : (k % 2 ? -0.3 : 0.45) * viento;
      var arriba = k === pisos - 1, pw = alto * (arriba ? 0.26 : 0.62 - k * 0.3 / (pisos - 1)) * (0.85 + r() * 0.3) * (dl * viento > 0 ? 1.15 : 0.9), ph = pw * (arriba ? 0.42 : 0.3 + r() * 0.06);
      var px = o[0] + dl * pw * 0.55, py = o[1] + (arriba ? ph * 0.25 : -ph * 0.15);
      for (var m = 0; m < 3; m++) { var ex = px + (m - 1) * pw * 0.28, ey = py + (m === 1 ? -ph * 0.2 : ph * 0.05), erx = pw * (0.24 + r() * 0.1); blando[1].moveTo(ex + erx, ey); blando[1].ellipse(ex, ey, erx, ph * (0.5 + r() * 0.2), 0, 0, TAU); }
      almo.push({ o: o, x: px, y: py, w: pw, h: ph, rama: Math.abs(dl) > 0 });
    }
    return function (x, tono) {
      T.pincelada(x, tr, { ancho: Math.max(1.4, alto * 0.07), alfa: Math.min(1, tono * 1.25), carga: 1, seco: 0.5, entrada: 0.02, salida: 0.35, rugoso: 0.4, cerdas: 6, semilla: sem });
      var rr = T.azar(sem), agujas = new Path2D(), bases = new Path2D();
      almo.forEach(function (a, i) {
        if (a.rama) T.pincelada(x, [a.o, [lerp(a.o[0], a.x, 0.55), a.o[1] - a.h * 0.25], [a.x, a.y + a.h * 0.2]], { ancho: Math.max(0.9, alto * 0.03), alfa: Math.min(1, tono * 1.2), carga: 1, seco: 0.5, salida: 0.5, cerdas: 3, semilla: sem + i + 1 });
        var n = 30 + Math.round(a.w / alto * 30);
        for (var j = 0; j < n; j++) {
          var an = Math.PI * (1.05 + 0.9 * j / (n - 1)), ex = a.x + Math.cos(an) * a.w * 0.5 * (0.8 + rr() * 0.3), ey = a.y + Math.sin(an) * a.h * (0.85 + rr() * 0.45);
          var ix = a.x + (ex - a.x) * (0.45 + rr() * 0.2), iy = a.y + (ey - a.y) * 0.35;
          agujas.moveTo(ix, iy); agujas.lineTo(ex + (rr() - 0.5) * a.w * 0.04, ey - rr() * a.h * 0.25);
        }
        if (i < almo.length - 1) { bases.moveTo(a.x + a.w * 0.44, a.y + a.h * 0.2); bases.ellipse(a.x, a.y + a.h * 0.2, a.w * 0.44, a.h * 0.32, 0, 0, TAU); }
      });
      x.fillStyle = T.rgba(TINTA, Math.min(1, tono * 0.75)); x.fill(bases);
      x.strokeStyle = T.rgba(TINTA, Math.min(1, tono * 0.9)); x.lineWidth = Math.max(0.5, alto * 0.0055); x.lineCap = 'round'; x.stroke(agujas);
    };
  }
})();
