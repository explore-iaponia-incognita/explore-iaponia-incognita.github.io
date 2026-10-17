/* Iaponia Incognita · figura
   Los personajes son siluetas de tinta articuladas, como las láminas de samuráis a contraluz:
   - un esqueleto (la pose: quieto, andar…) con piernas y brazos por IK de dos huesos;
   - un vestuario (el estilo: sombrero de paja, hakama, mangas, espadas…) que se pinta en negro, de atrás adelante;
   - cada pieza delantera abre un hilo de papel a su alrededor (el blanco que deja el pintor entre dos trazos);
   - las líneas de dentro (pliegues, cuello, paja, brillo de la vaina) se rascan en papel y el bajo se deshace en pincel seco.
   Lo que cuelga (bajo de la hakama, mangas, cordones, pelo) va con retraso respecto al cuerpo y se lo lleva el viento.
   Unidades: 1 = altura de la figura (del suelo a la coronilla, sin sombrero). Origen en el suelo, bajo la cadera;
   x hacia donde mira, y hacia abajo. */
(function () {
  'use strict';
  var SA = window.SA = window.SA || {}, T = SA.tinta, TAU = Math.PI * 2;
  var TINTA = 'rgb(16,15,14)';
  var HUECO = 0.0055;     // el hilo de papel entre piezas
  var RUG = 0.0011;       // lo que tiembla el borde

  /* ------------------------------------------------------------------ geometría */
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mezcla(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
  function mas(a, b, k) { k = k == null ? 1 : k; return [a[0] + b[0] * k, a[1] + b[1] * k]; }
  function dist(a, b) { return Math.hypot(b[0] - a[0], b[1] - a[1]); }
  function dir(a, b) { var d = dist(a, b) || 1; return [(b[0] - a[0]) / d, (b[1] - a[1]) / d]; }
  function rota(v, a) { var c = Math.cos(a), s = Math.sin(a); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c]; }
  function suave(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
  // un marco local con origen o y eje x girado a: devuelve la función que pasa de local a figura
  function marco(o, a) { var c = Math.cos(a), s = Math.sin(a); return function (x, y) { return [o[0] + x * c - y * s, o[1] + x * s + y * c]; }; }
  // IK de dos huesos: la articulación intermedia entre a y b; «lado» (+1 / −1) elige hacia dónde se dobla
  function ik(a, b, l1, l2, lado) {
    var d = Math.max(1e-4, Math.min((l1 + l2) * 0.9995, dist(a, b))), an = Math.atan2(b[1] - a[1], b[0] - a[0]);
    var c = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), al = Math.acos(Math.max(-1, Math.min(1, c))) * lado;
    return [a[0] + Math.cos(an + al) * l1, a[1] + Math.sin(an + al) * l1];
  }

  /* ------------------------------------------------------------------ curvas (muestreadas a polilíneas) */
  function cuad(a, c, b, n) { var o = []; n = n || 10; for (var i = 0; i <= n; i++) { var t = i / n, u = 1 - t; o.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]); } return o; }
  function cub(a, c1, c2, b, n) { var o = []; n = n || 14; for (var i = 0; i <= n; i++) { var t = i / n, u = 1 - t, A = u * u * u, B = 3 * u * u * t, C = 3 * u * t * t, D = t * t * t; o.push([A * a[0] + B * c1[0] + C * c2[0] + D * b[0], A * a[1] + B * c1[1] + C * c2[1] + D * b[1]]); } return o; }
  function cr(p, n) { return T.curva(p, n || 8); }
  // junta tramos sin repetir el punto de unión
  function une() {
    var o = [];
    for (var i = 0; i < arguments.length; i++) { var t = arguments[i]; for (var k = 0; k < t.length; k++) { if (k === 0 && o.length && dist(o[o.length - 1], t[0]) < 1e-7) continue; o.push(t[k]); } }
    return o;
  }
  // perfil de un trazo afilado: crece en «a», se afila en «b» (fracciones del largo)
  function perfil(w, a, b, minimo) {
    a = a == null ? 0.25 : a; b = b == null ? 0.4 : b; minimo = minimo || 0;
    return function (t) { var f = 1; if (a > 0 && t < a) f = Math.sqrt(t / a); if (b > 0 && t > 1 - b) f = Math.min(f, Math.pow(Math.max(0, (1 - t) / b), 0.85)); return Math.max(minimo, w * f); };
  }
  // una cinta alrededor de una polilínea (para trazos, cuerdas, pelo, líneas rascadas)
  function cinta(p, ancho) {
    var n = p.length, L = [0], i; for (i = 1; i < n; i++) L.push(L[i - 1] + dist(p[i - 1], p[i]));
    var tot = L[n - 1] || 1, izq = [], der = [];
    for (i = 0; i < n; i++) {
      var d = dir(p[Math.max(0, i - 1)], p[Math.min(n - 1, i + 1)]), w = ancho(L[i] / tot) / 2;
      izq.push([p[i][0] - d[1] * w, p[i][1] + d[0] * w]); der.push([p[i][0] + d[1] * w, p[i][1] - d[0] * w]);
    }
    return izq.concat(der.reverse());
  }
  // polígono cerrado con las esquinas redondeadas (radio por esquina, en unidades)
  function poli(pts, radios, n) {
    var o = [], N = pts.length;
    for (var i = 0; i < N; i++) {
      var a = pts[(i - 1 + N) % N], c = pts[i], b = pts[(i + 1) % N], r = radios ? radios[i] || 0 : 0;
      if (!r) { o.push(c); continue; }
      var rr = Math.min(r, dist(a, c) * 0.49, dist(c, b) * 0.49);
      o = o.concat(cuad(mas(c, dir(c, a), rr), c, mas(c, dir(c, b), rr), n || 7));
    }
    return o;
  }
  // el bajo de una prenda: de a a b con los pliegues marcados (pequeños arcos hacia abajo)
  function ondas(a, b, n, h) {
    var o = [], m = n * 6;
    for (var i = 0; i <= m; i++) { var t = i / m, k = Math.abs(Math.sin(t * n * Math.PI)); o.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t) + k * h - h * 0.4]); }
    return o;
  }

  /* ------------------------------------------------------------------ pintar en el lienzo (unidades × s = px) */
  function trazar(x, p, s, rug, sem) {
    var n = p.length, acum = 0; if (n < 2) return;
    x.beginPath();
    for (var i = 0; i < n; i++) {
      var q = p[i], d = dir(p[(i - 1 + n) % n], p[(i + 1) % n]);
      if (i) acum += dist(p[i - 1], q);
      var j = rug ? (T.fbm1(acum * 42, sem || 1, 2) - 0.5) * 2 * rug : 0;
      var X = (q[0] - d[1] * j) * s, Y = (q[1] + d[0] * j) * s;
      if (i) x.lineTo(X, Y); else x.moveTo(X, Y);
    }
    x.closePath();
  }
  // una pieza negra; con «hueco», antes abre un hilo de papel a su alrededor (donde ya había tinta)
  function pieza(x, p, s, op) {
    op = op || {};
    var sem = op.sem || 1, rug = op.rug == null ? RUG : op.rug;
    if (op.hueco) {
      x.save(); x.globalCompositeOperation = 'destination-out';
      if (op.recorte) { x.beginPath(); op.recorte(x); x.clip(); }
      trazar(x, p, s, rug, sem); x.lineJoin = 'round'; x.lineWidth = op.hueco * 2 * s; x.strokeStyle = '#000'; x.stroke(); x.fillStyle = '#000'; x.fill();
      x.restore();
    }
    x.globalCompositeOperation = 'source-over'; x.fillStyle = op.color || TINTA;
    trazar(x, p, s, rug, sem); x.fill();
  }
  // una línea rascada (papel): pliegues, cuello, paja…
  function raya(x, p, s, w, op) {
    op = op || {};
    x.save(); x.globalCompositeOperation = 'destination-out'; x.globalAlpha = op.alfa == null ? 1 : op.alfa; x.fillStyle = '#000';
    trazar(x, cinta(p, perfil(w, op.a, op.b, op.min)), s, 0); x.fill(); x.restore();
  }
  // un hilo negro: cordones, pelo
  function hilo(x, p, s, w, op) {
    op = op || {};
    x.save(); x.globalCompositeOperation = 'source-over'; x.fillStyle = op.color || TINTA; x.globalAlpha = op.alfa == null ? 1 : op.alfa;
    trazar(x, cinta(p, perfil(w, op.a == null ? 0.05 : op.a, op.b == null ? 0.6 : op.b, op.min)), s, 0); x.fill(); x.restore();
  }

  /* ------------------------------------------------------------------ medidas y poses */
  var M = { muslo: 0.245, pierna: 0.235, brazo: 0.165, antebrazo: 0.15 };
  var APOYO = 0.6;          // parte del ciclo con el pie en el suelo
  var ZANC = 0.18;          // medio paso (en altos)
  var AVANCE = 2 * ZANC / APOYO;   // lo que avanza la figura en un ciclo (dos pasos), en altos

  // el pie en el ciclo: tobillo y giro de la planta. fl = fase de esa pierna (0 = apoya el talón), largo = escala del paso
  function pie(fl, largo) {
    fl = ((fl % 1) + 1) % 1;
    var z = ZANC * largo, A, a;
    if (fl < APOYO) {
      var t = fl / APOYO, x0 = z - 2 * z * t;
      if (t < 0.14) { a = -0.22 * Math.pow(1 - t / 0.14, 1.5) * largo; A = mas([x0 - 0.035, 0], rota([-0.035, 0.035], a), -1); }
      else if (t > 0.62) { var k = (t - 0.62) / 0.38; a = 0.62 * k * k * largo; A = mas([x0 + 0.085, 0], rota([0.085, 0.035], a), -1); }
      else { a = 0; A = [x0, -0.035]; }
    } else {
      var u = (fl - APOYO) / (1 - APOYO), e = suave(u), a0 = 0.62 * largo, a1 = -0.22 * largo;
      var A0 = mas([-z + 0.085, 0], rota([0.085, 0.035], a0), -1), A1 = mas([z - 0.035, 0], rota([-0.035, 0.035], a1), -1);
      A = [lerp(A0[0], A1[0], e), lerp(A0[1], A1[1], e) - 0.05 * Math.sin(Math.PI * u) * largo];
      a = lerp(a0, a1, suave(u * 1.15));
    }
    return { A: A, a: a };
  }
  function pierna(P, k, p, retraso) {
    var cad = [P.pelvis[0] + 0.012 * k, P.pelvis[1] + 0.014];
    var rod = ik(cad, p.A, M.muslo, M.pierna, -1);
    // el bajo de la hakama cuelga bajo la rodilla, detrás del tobillo, con retraso y viento
    // (sobre la espinilla, cerca del tobillo: si el pie sube, el bajo sube con él)
    var sobre = mezcla(p.A, rod, 0.2), bx = sobre[0] + (retraso.A[0] - p.A[0]) * 0.6 - P.viento * 0.04;
    bx = Math.max(Math.min(rod[0], p.A[0]) - 0.075, Math.min(Math.max(rod[0], p.A[0]) + 0.09, bx));
    var bajo = [bx, Math.min(lerp(p.A[1], rod[1], 0.05) + 0.012, -0.016)];
    return { k: k, cad: cad, rod: rod, tob: p.A, a: p.a, bajo: bajo };
  }
  function marcoTorso(P) {
    var up = [Math.sin(P.incl), -Math.cos(P.incl)], fw = [Math.cos(P.incl), Math.sin(P.incl)], o = P.pelvis;
    return function (u, f) { return [o[0] + up[0] * u + fw[0] * f, o[1] + up[1] * u + fw[1] * f]; };
  }
  function brazos(P) {
    var tor = marcoTorso(P);
    // la katana, metida en el obi: tsuba delante de la barriga, empuñadura hacia delante y arriba
    P.espada = { tsuba: tor(0.07, 0.118), ang: -0.4 + P.incl * 0.6 };
    P.wakizashi = { tsuba: tor(0.088, 0.104), ang: -0.29 + P.incl * 0.6 };
    var sm = marco(P.espada.tsuba, P.espada.ang);
    P.puno = sm(-0.034, 0.002);
    P.hombro = tor(0.292, 0.022);
    P.codo = ik(P.hombro, P.puno, M.brazo, M.antebrazo + 0.03, 1);
    P.muneca = mezcla(P.codo, P.puno, M.antebrazo / (M.antebrazo + 0.03));
  }

  function poseAndar(fase, op) {
    op = op || {};
    var largo = op.largo == null ? 1 : op.largo, v = op.viento || 0;
    var P = { viento: v, t: op.t == null ? fase * 1.1 : op.t, fase: fase, largo: largo, andar: true };
    P.pelvis = [0, -(0.4975 + 0.0095 * Math.cos(4 * Math.PI * (fase - 0.3)) * largo)];
    P.incl = 0.045 + 0.009 * Math.sin(4 * Math.PI * (fase - 0.05)) * largo;
    P.cabeza = 0.07 - 0.012 * Math.sin(4 * Math.PI * (fase - 0.1)) * largo;
    var pn = pie(fase, largo), pf = pie(fase + 0.5, largo);
    P.piernas = [pierna(P, -1, pf, pie(fase + 0.5 - 0.08, largo)), pierna(P, 1, pn, pie(fase - 0.08, largo))];
    // las mangas: van con retraso al paso y el viento se las lleva atrás
    P.mangaN = 0.07 * Math.sin(TAU * (fase - 0.22)) * largo + v * 0.32;
    P.mangaF = 0.07 * Math.sin(TAU * (fase + 0.28)) * largo + v * 0.32;
    P.rebote = Math.cos(4 * Math.PI * (fase - 0.38)) * largo;   // para el pelo y los cordones
    brazos(P);
    return P;
  }
  /* --- correr: menos tiempo en el suelo (hay un instante en el aire), zancada larga, la rodilla sube y el talón patea
     atrás; el cuerpo se inclina hacia delante y la ropa vuela. La mano sigue sujetando la vaina. --- */
  var APOYO_R = 0.36, ADEL = 0.1, ATRAS = 0.23;
  var AVANCE_R = 2 * (ADEL + ATRAS) / (2 * APOYO_R) * 1;   // altos por ciclo
  function bez(a, b, c, d, t) { var u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d; }
  function pieCorrer(fl) {
    fl = ((fl % 1) + 1) % 1;
    var A, a;
    if (fl < APOYO_R) {
      var t = fl / APOYO_R, x0 = ADEL - (ADEL + ATRAS) * t;
      a = t < 0.25 ? -0.12 * (1 - t / 0.25) : t > 0.55 ? 0.9 * Math.pow((t - 0.55) / 0.45, 1.6) : 0;
      A = a > 0 ? mas([x0 + 0.085, 0], rota([0.085, 0.035], a), -1) : [x0, -0.035 - Math.max(0, -a) * 0.05];
    } else {
      var u = (fl - APOYO_R) / (1 - APOYO_R);
      // el tobillo: sale de atrás, sube (el talón patea hacia el glúteo), pasa bajo la cadera con la rodilla alta y se estira delante
      A = [bez(-ATRAS - 0.05, -0.36, 0.2, ADEL, u), -bez(0.08, 0.3, 0.2, 0.035, u)];
      a = lerp(0.9, -0.12, suave(u * 1.1)) + Math.sin(Math.PI * u) * 0.35;
    }
    return { A: A, a: a };
  }
  function poseCorrer(fase, op) {
    op = op || {};
    var v = (op.viento || 0) + 0.45, P = { viento: v, t: op.t == null ? fase * 1.4 : op.t, fase: fase, largo: 1.4, andar: true };
    P.pelvis = [0, -(0.468 + 0.016 * Math.cos(4 * Math.PI * (fase - APOYO_R * 0.5 - 0.25)))];
    P.incl = 0.29 + 0.025 * Math.sin(4 * Math.PI * fase);
    P.cabeza = -0.16;
    var pn = pieCorrer(fase), pf = pieCorrer(fase + 0.5);
    P.piernas = [pierna(P, -1, pf, pieCorrer(fase + 0.5 - 0.06)), pierna(P, 1, pn, pieCorrer(fase - 0.06))];
    P.mangaN = 0.1 * Math.sin(TAU * (fase - 0.2)) + v * 0.4;
    P.mangaF = 0.1 * Math.sin(TAU * (fase + 0.3)) + v * 0.4;
    P.rebote = 1.6 * Math.cos(4 * Math.PI * (fase - 0.3));
    brazos(P);
    return P;
  }
  /* --- en guardia: la espada desenvainada a dos manos, con la hoja en el ángulo «ang» (rad, como en la pantalla:
     −π/2 = hacia arriba, 0 = hacia delante). Las manos van donde las pondría un espadachín para ese ángulo. --- */
  var AGARRES = [[-2.7, 0.47, 0.0], [-2.2, 0.43, 0.07], [-1.57, 0.25, 0.17], [-0.8, 0.17, 0.21], [0, 0.11, 0.22], [0.8, 0.07, 0.2], [1.57, 0.03, 0.15], [2.6, 0.02, 0.02]];
  function agarre(ang) {
    ang = Math.max(-2.7, Math.min(2.6, ang));
    for (var i = 1; i < AGARRES.length; i++) if (ang <= AGARRES[i][0]) { var a = AGARRES[i - 1], b = AGARRES[i], t = (ang - a[0]) / (b[0] - a[0]); return [lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
    return [AGARRES[AGARRES.length - 1][1], AGARRES[AGARRES.length - 1][2]];
  }
  function poseGuardia(op) {
    op = op || {};
    var t = op.t || 0, v = op.viento || 0, ag = op.agacha || 0, resp = Math.sin(t * 1.4);
    var P = { viento: v, t: t, fase: 0, largo: 0, andar: false };
    P.pelvis = [0, -(0.478 - ag * 0.14) - resp * 0.002];
    P.incl = 0.07 + ag * 0.2 + (op.inclina || 0);
    P.cabeza = (op.mira || 0) - ag * 0.12;
    var pn = { A: [0.12 + ag * 0.06, -0.035], a: 0 }, pf = { A: [-0.12 - ag * 0.07, -0.035], a: 0.18 };
    if (op.fase != null) { pn = pie(op.fase, 0.8); pf = pie(op.fase + 0.5, 0.8); }
    P.piernas = [pierna(P, -1, pf, pf), pierna(P, 1, pn, pn)];
    P.mangaN = v * 0.3 + Math.sin(t * 1.3) * 0.03; P.mangaF = v * 0.3 + Math.sin(t * 1.3 + 0.7) * 0.03;
    P.rebote = 0;
    brazos(P);
    var ang = op.ang == null ? -1.2 : op.ang, g = agarre(ang), tor = marcoTorso(P), G = tor(g[0], g[1]), d = [Math.cos(ang), Math.sin(ang)];
    var mango = op.arma === 'yari' ? 0.2 : op.arma === 'remo' ? 0.13 : 0.12;
    P.mano = { pomo: mas(G, d, -mango * 0.55), tsuba: mas(G, d, mango * 0.45), ang: ang, largo: op.largo || 0.55, arma: op.arma || 'katana' };
    P.hombroF = tor(0.3, -0.025);
    var hN = mezcla(P.mano.pomo, P.mano.tsuba, 0.22), hF = mezcla(P.mano.pomo, P.mano.tsuba, 0.74);
    P.puno = hN; P.punoF = hF;
    P.codo = ik(P.hombro, hN, M.brazo, M.antebrazo + 0.03, 1); P.muneca = mezcla(P.codo, hN, M.antebrazo / (M.antebrazo + 0.03));
    P.codoF = ik(P.hombroF, hF, M.brazo, M.antebrazo + 0.03, 1); P.munecaF = mezcla(P.codoF, hF, M.antebrazo / (M.antebrazo + 0.03));
    return P;
  }
  /* --- de rodillas (seiza): sentado sobre los talones, las rodillas en el suelo, las manos en los muslos; con «inclina»
     hace la reverencia. Las piernas no van por IK: se colocan a mano. --- */
  function poseSeiza(t, op) {
    op = op || {};
    var v = op.viento || 0, resp = Math.sin(t * 1.1), P = { viento: v, t: t, fase: 0, largo: 0, andar: false, seiza: true };
    P.pelvis = [-0.02, -0.215 - resp * 0.0012];
    P.incl = 0.02 + resp * 0.004 + (op.inclina || 0);
    P.cabeza = 0.12 + (op.inclina || 0) * 0.3 + Math.sin(t * 0.3) * 0.015;
    function piernaSeiza(k, dx) {
      var cad = [P.pelvis[0] + 0.012 * k + dx, P.pelvis[1] + 0.014], rod = [0.19 + dx, -0.05], tob = [-0.05 + dx, -0.04];
      return { k: k, cad: cad, rod: rod, tob: tob, a: 0, bajo: [-0.02 + dx, -0.03], seiza: true };
    }
    P.piernas = [piernaSeiza(-1, -0.015), piernaSeiza(1, 0)];
    P.mangaN = v * 0.3 + Math.sin(t * 1.2) * 0.02; P.mangaF = P.mangaN;
    P.rebote = 0;
    brazos(P);
    // las manos, sobre los muslos (cerca de la rodilla)
    var mano = mezcla(P.piernas[1].cad, P.piernas[1].rod, 0.72); mano = [mano[0], mano[1] - 0.035];
    P.codo = ik(P.hombro, mano, M.brazo, M.antebrazo + 0.03, 1); P.muneca = mezcla(P.codo, mano, M.antebrazo / (M.antebrazo + 0.03));
    P.manoLibre = mano;
    return P;
  }
  /* --- iaidō: desenvainar, alzar, cortar, quedarse (zanshin) y envainar, con k de 0 a 1. Devuelve la pose y, en el corte,
     el arco del tajo (para pintarlo). --- */
  function poseIai(k, op) {
    op = op || {};
    var t = op.t || 0, v = op.viento || 0;
    if (k < 0.1) return mezclar(poseQuieto(t, op), poseGuardia({ ang: 2.2, t: t, viento: v, agacha: 0.2 }), suave(k / 0.1));
    var ang, ag = 0.2, arco = null;
    if (k < 0.3) ang = lerp(2.2, -2.35, suave((k - 0.1) / 0.2));                        // desenvaina y alza la hoja
    else if (k < 0.42) { var c = (k - 0.3) / 0.12; ang = lerp(-2.35, 0.95, c * c); ag = 0.2 + c * 0.35; arco = [-2.35, ang]; }   // el corte, rapidísimo
    else { ang = 0.95; ag = 0.55; }                                                       // zanshin
    var P = poseGuardia({ ang: ang, t: t, viento: v, agacha: ag, largo: 0.6 });
    if (k > 0.82) P = mezclar(P, poseQuieto(t, op), suave((k - 0.82) / 0.18));
    P.arco = arco;
    return P;
  }
  function poseQuieto(t, op) {
    op = op || {};
    var v = op.viento || 0, resp = Math.sin(t * 1.25);
    var P = { viento: v, t: t, fase: 0, largo: 0, andar: false };
    P.pelvis = [0, -0.5 - resp * 0.0015];
    P.incl = 0.03 + resp * 0.005;
    P.cabeza = 0.08 + Math.sin(t * 0.37) * 0.025;
    var pn = { A: [0.07, -0.035], a: 0 }, pf = { A: [-0.065, -0.035], a: 0 };
    P.piernas = [pierna(P, -1, pf, pf), pierna(P, 1, pn, pn)];
    P.piernas.forEach(function (g, i) { g.bajo[0] += Math.sin(t * 1.7 + i * 1.3) * 0.006 * (0.3 + Math.abs(v)); });
    P.mangaN = v * 0.32 + Math.sin(t * 1.4) * 0.03 * (0.4 + Math.abs(v));
    P.mangaF = v * 0.32 + Math.sin(t * 1.4 + 0.8) * 0.03 * (0.4 + Math.abs(v));
    P.rebote = 0;
    brazos(P);
    return P;
  }

  /* ------------------------------------------------------------------ las piezas */
  function pintarPie(x, g, s, delante) {
    var m = marco(g.tob, g.a);
    var p = poli([m(-0.02, -0.016), m(-0.038, 0.016), m(-0.032, 0.039), m(0.092, 0.039), m(0.1, 0.03), m(0.06, 0.016), m(0.02, -0.01)], [0, 0.018, 0.006, 0.01, 0.01, 0.03, 0]);
    pieza(x, p, s, { hueco: delante ? HUECO * 0.8 : 0, sem: 3 });
  }
  function pintarPierna(x, g, P, s, delante, sem, estrecha) {
    var cad = g.cad, rod = g.rod, bajo = g.bajo;
    if (g.seiza) {
      // de rodillas: la hakama es un montículo de tela que va de la cadera a la rodilla (en el suelo) y vuelve por detrás de los talones
      var monte = poli([[cad[0] - 0.11, cad[1] - 0.03], [cad[0] + 0.08, cad[1] - 0.04], [rod[0] - 0.03, rod[1] - 0.075], [rod[0] + 0.05, rod[1] - 0.025], [rod[0] + 0.045, -0.002],
        [g.tob[0] - 0.1, -0.002], [g.tob[0] - 0.11, -0.07], [cad[0] - 0.13, cad[1] + 0.06]], [0.03, 0.05, 0.06, 0.035, 0.008, 0.008, 0.04, 0.05]);
      pieza(x, monte, s, { hueco: delante ? HUECO : 0, sem: sem, recorte: function (c) { c.rect(-5 * s, (P.pelvis[1] + 0.02) * s, 10 * s, 5 * s); } });
      [0.25, 0.55].forEach(function (f2, i) { raya(x, cr([mezcla([cad[0] - 0.02, cad[1] + 0.02], rod, f2 * 0.3), mezcla([cad[0], cad[1] - 0.02], [rod[0], rod[1] - 0.04], 0.6 + i * 0.1), [rod[0] + 0.01 - i * 0.03, -0.01]], 6), s, 0.0045, { a: 0.4, b: 0.25, alfa: 0.85 }); });
      return;
    }
    var d1 = dir(cad, rod), n1 = [d1[1], -d1[0]];
    var vuelo = estrecha ? 0.042 : 0.092;
    var e = estrecha ? 0.62 : 1;
    var a1 = mas(mas(cad, n1, 0.09 * e), d1, -0.05);
    var a2 = mas(rod, n1, 0.056 * e);
    // el bajo, perpendicular a la espinilla (horizontal si la pierna está recta)
    var d2 = dir(rod, g.tob), n2 = [d2[1], -d2[0]];
    var a3 = mas(mas(bajo, n2, vuelo), d2, -0.004);
    var a4 = mas(mas(bajo, n2, -vuelo - 0.004), d2, 0.002);
    var a5 = mas(mas(rod, n1, -0.07 * e), [0, 1], estrecha ? 0.0 : 0.035);
    var a6 = mas(mas(cad, n1, -0.1 * e), d1, -0.05);
    var a3r = mas(a3, dir(a3, a2), 0.018), a4r = mas(a4, dir(a4, a5), 0.022);
    var hk = une(
      cuad(a1, mas(mezcla(a1, a2, 0.5), n1, 0.014), a2),
      cuad(a2, [lerp(a2[0], a3[0], 0.4) + 0.008, lerp(a2[1], a3[1], 0.55)], a3r),
      cuad(a3r, a3, mezcla(a3, a4, 0.06), 4),
      ondas(mezcla(a3, a4, 0.06), mezcla(a3, a4, 0.94), 4, 0.005),
      cuad(mezcla(a3, a4, 0.94), a4, a4r, 4),
      cuad(a4r, [lerp(a4[0], a5[0], 0.75) - 0.01, lerp(a4[1], a5[1], 0.45)], a5),
      cuad(a5, mas(mezcla(a5, a6, 0.5), n1, -0.018), a6)
    );
    var corte = P.pelvis[1] + 0.12;
    pieza(x, hk, s, { hueco: delante ? HUECO : 0, sem: sem, recorte: function (c) { c.rect(-5 * s, corte * s, 10 * s, 5 * s); } });
    if (estrecha) {
      // las vendas de la pierna (kyahan): rayas cruzadas en la espinilla
      for (var v2 = 0; v2 < 3; v2++) { var pv = mezcla(rod, g.tob, 0.3 + v2 * 0.2); raya(x, [mas(pv, n1, -0.03), mas(mas(pv, n1, 0.03), dir(rod, g.tob), 0.02)], s, 0.0035, { a: 0.2, b: 0.2, alfa: 0.8 }); }
      return;
    }
    // los pliegues: del muslo al bajo, siguiendo la tela
    [0.3, 0.66].forEach(function (f, i) {
      var arriba = mezcla(mas(mezcla(a1, a6, f), d1, 0.05), mezcla(a2, a5, f), 0.35), medio = mezcla(a2, a5, f), abajo = mas(mezcla(a3, a4, f - 0.04 + i * 0.08), [0, -1], 0.014);
      raya(x, cr([arriba, medio, mezcla(medio, abajo, 0.55), abajo], 6), s, 0.0042 - i * 0.0006, { a: 0.45, b: 0.14 });
    });
    // pincel seco en el bajo: rayas cortas que suben
    var r = T.azar(sem * 31 + 7);
    for (var k = 0; k < 7; k++) {
      var f = 0.08 + r() * 0.84, b0 = mezcla(a3, a4, f), l = 0.012 + r() * 0.04;
      raya(x, [mas(b0, [0, 1], 0.004), mas(b0, [r() * 0.006 - 0.003, -1], l)], s, 0.0016 + r() * 0.0022, { a: 0.0, b: 0.9 });
    }
  }
  function pintarEspada(x, o, ang, Lt, Lv, w, s, vacia) {
    var m = marco(o, ang), k = 0.02 * Lv / 0.46;
    function sori(t) { return -k * t * t; }   // la punta de la vaina se curva un poco hacia arriba
    // la vaina: del koiguchi a la contera (kojiri), algo más estrecha al final
    var izq = [], der = [], N = 18;
    for (var i = 0; i <= N; i++) { var t = i / N, xx = -0.006 - (Lv - 0.006) * t, ww = w * (0.5 - 0.06 * t); izq.push(m(xx, sori(t) - ww)); der.push(m(xx, sori(t) + ww)); }
    var fin = m(-Lv, sori(1)), dirFin = dir(m(-Lv + 0.01, sori(0.97)), fin);
    var vaina = izq.concat(cuad(izq[N], mas(fin, dirFin, w * 0.62), der[N], 6), der.reverse());
    // la empuñadura (tsuka) con su pomo (kashira)
    var tsuka = une([m(0.008, -w * 0.52), m(Lt * 0.5, -w * 0.47), m(Lt - 0.006, -w * 0.52)], cuad(m(Lt - 0.006, -w * 0.52), m(Lt + 0.008, 0), m(Lt - 0.006, w * 0.52)), [m(Lt * 0.5, w * 0.47), m(0.008, w * 0.52)]);
    var tsuba = []; for (var j = 0; j <= 20; j++) { var an = j / 20 * TAU; tsuba.push(m(Math.cos(an) * 0.0065, Math.sin(an) * w * 1.35)); }
    pieza(x, vaina, s, { hueco: HUECO, rug: 0.0004 });
    if (vacia) return m;
    pieza(x, tsuka, s, { hueco: HUECO, rug: 0.0003 }); pieza(x, tsuba, s, { hueco: HUECO, rug: 0.0003 });
    // el brillo de la laca en la vaina
    var brillo = []; for (var b = 0; b <= 10; b++) { var tb = 0.08 + 0.8 * b / 10; brillo.push(m(-0.006 - (Lv - 0.006) * tb, sori(tb) - w * 0.2)); }
    raya(x, brillo, s, w * 0.16, { a: 0.3, b: 0.5, alfa: 0.85 });
    // el trenzado de la empuñadura: rombos de papel entre los cruces del cordón
    var nR = Math.max(4, Math.round(Lt / 0.024)), paso = (Lt - 0.03) / nR;
    for (var d = 0; d < nR; d++) {
      var cx = 0.022 + paso * (d + 0.5), hl = paso * 0.36, hw = w * 0.3;
      var rombo = [m(cx - hl, 0), m(cx, -hw), m(cx + hl, 0), m(cx, hw)];
      x.save(); x.globalCompositeOperation = 'destination-out'; trazar(x, rombo, s, 0); x.fillStyle = '#000'; x.fill(); x.restore();
    }
    // el canto de la tsuba
    raya(x, [m(0.003, -w * 1.1), m(0.004, 0), m(0.003, w * 1.1)], s, 0.0016, { a: 0.3, b: 0.3, alfa: 0.8 });
    return m;
  }
  function pintarCabeza(x, P, E, s) {
    var tor = marcoTorso(P);
    var N = tor(0.318, 0.012), hA = P.incl * 0.35 + P.cabeza;
    var H = mas(N, rota([0.014, -0.108], P.incl * 0.35));
    var k = 0.82, c0 = marco(H, hA), cb = function (a, b) { return c0(a * k, b * k); };
    // el cuello
    pieza(x, poli([tor(0.3, -0.05), cb(-0.042, 0.02), cb(-0.02, 0.07), cb(0.024, 0.07), tor(0.33, 0.04), tor(0.3, 0.05)], [0, 0.01, 0.02, 0.01, 0.02, 0]), s);
    // el perfil: la frente queda bajo el ala; se ven la nariz, la boca y el mentón
    var cara = une(
      cuad(cb(-0.045, 0.045), cb(-0.074, 0.0), cb(-0.056, -0.046)),
      cuad(cb(-0.056, -0.046), cb(0.0, -0.088), cb(0.05, -0.052)),
      cuad(cb(0.05, -0.052), cb(0.066, -0.03), cb(0.063, -0.008)),
      [cb(0.066, 0.0)],
      [cb(0.075, 0.022)], [cb(0.064, 0.029)],
      cuad(cb(0.064, 0.029), cb(0.067, 0.04), cb(0.064, 0.05)),
      cuad(cb(0.064, 0.05), cb(0.064, 0.064), cb(0.05, 0.068)),
      cuad(cb(0.05, 0.068), cb(0.0, 0.072), cb(-0.032, 0.05))
    );
    pieza(x, cara, s, { rug: 0.0012, sem: 5 });
    // la barba de unos días, áspera
    if (E.barba) pieza(x, poli([cb(-0.03, 0.042), cb(0.02, 0.05), cb(0.056, 0.05), cb(0.068, 0.06), cb(0.06, 0.075), cb(0.03, 0.08), cb(-0.012, 0.068)], [0, 0.01, 0.006, 0.01, 0.012, 0.012, 0.01]), s, { rug: 0.0022, sem: 15 });
    return { cb: cb, hA: hA, H: H };
  }
  function pintarSombrero(x, P, E, C, s) {
    var R = E.ala || 0.24, Hh = E.copa || 0.115;
    var hs = marco(C.cb(-0.004, -0.044), C.hA + 0.03);
    var kasa = une(
      cuad(hs(-R, 0.005), hs(-R * 0.5, -Hh * 0.8), hs(0, -Hh), 14),
      cuad(hs(0, -Hh), hs(R * 0.5, -Hh * 0.8), hs(R, 0.005), 14),
      cuad(hs(R, 0.005), hs(R * 0.5, 0.02), hs(0, 0.021), 8),
      cuad(hs(0, 0.021), hs(-R * 0.5, 0.02), hs(-R, 0.005), 8)
    );
    pieza(x, kasa, s, { hueco: HUECO, sem: 9, rug: 0.0008 });
    // el botón de arriba
    var bt = []; for (var j = 0; j <= 14; j++) { var an = j / 14 * TAU; bt.push(hs(Math.cos(an) * 0.009, -Hh - 0.004 + Math.sin(an) * 0.007)); }
    pieza(x, bt, s, { rug: 0 });
    // la paja: meridianos del cono vistos de lado (se juntan hacia los bordes), rascados como pincel seco
    var n = 19, r = T.azar(77);
    for (var i = 0; i < n; i++) {
      var th = (i + 0.5) / n * Math.PI, c = Math.cos(th), arranque = 0.1 + (i % 3) * 0.08 + r() * 0.05;
      var linea = cuad(hs(0, -Hh), hs(R * 0.5 * c, -Hh * 0.8), hs(R * c * 0.985, 0.0), 12).slice(Math.round(12 * arranque));
      raya(x, linea, s, 0.0042 + Math.sin(th) * 0.0022, { a: 0.5, b: 0.12, alfa: 0.92 });
    }
    // el borde trenzado del ala
    raya(x, cuad(hs(-R * 0.96, -0.004), hs(0, 0.012), hs(R * 0.96, -0.004), 16), s, 0.0034, { a: 0.1, b: 0.1, alfa: 0.9 });
    return hs;
  }

  // un brazo con su manga: S hombro, Ec codo, W muñeca; swing: ángulo al que cuelga la manga; op: hueco, estrecha, dandara, sem
  function brazoManga(x, S, Ec, W, swing, s, op) {
    op = op || {};
    var du = dir(S, Ec), nb = [-du[1], du[0]], df = dir(Ec, W), nd = [-df[1], df[0]];
    if (nd[1] < 0) nd = [-nd[0], -nd[1]];
    if (nb[0] > 0) nb = [-nb[0], -nb[1]];
    var g = rota([0, 1], swing), up = [0, -1], forma;
    if (op.estrecha) {
      // manga recogida (tasuki) o ajustada: un brazo de tela, sin bolsa
      forma = poli([mas(mas(S, nb, 0.04), up, 0.012), mas(Ec, nb, 0.03), mas(mas(W, df, -0.01), nd, 0.022), mas(mas(W, df, -0.01), nd, -0.022), mas(Ec, nd, -0.03), mas(S, nb, -0.038), mas(S, up, 0.04)], [0.03, 0.03, 0.006, 0.006, 0.03, 0.03, 0.04]);
      pieza(x, forma, s, { hueco: op.hueco ? HUECO : 0, sem: op.sem || 8 });
      return;
    }
    var SB = mas(mas(S, nb, 0.046), up, 0.014), EB = mas(Ec, nb, 0.042);
    var BB = mas(mas(Ec, nb, 0.026), g, 0.135), BF = mas(mas(mezcla(Ec, W, 0.84), g, 0.118), df, 0.004);
    var CB = mas(mas(W, df, -0.02), nd, 0.044), CT = mas(mas(W, df, -0.015), nd, -0.034);
    var ET = mas(Ec, nd, -0.036), SFr = mas(S, nb, -0.042);
    forma = poli([SB, mas(mezcla(SB, EB, 0.5), nb, 0.01), EB, BB, mas(mezcla(BB, BF, 0.5), g, 0.012), BF, CB, CT, ET, SFr, mas(S, up, 0.05)],
                 [0.04, 0.08, 0.05, 0.045, 0.08, 0.04, 0.008, 0.006, 0.05, 0.04, 0.05]);
    pieza(x, forma, s, { hueco: op.hueco ? HUECO : 0, sem: op.sem || 8 });
    raya(x, cr([mas(Ec, nd, 0.012), mezcla(mas(Ec, nd, 0.012), mezcla(BB, BF, 0.35), 0.5), mas(mezcla(BB, BF, 0.35), g, -0.02)], 6), s, 0.0042, { a: 0.3, b: 0.45 });
    // los 47 rōnin: la manga con el borde de triángulos blancos (dandara)
    if (op.dandara) {
      var n = 7;
      for (var i = 0; i < n; i++) {
        var a = mezcla(BB, BF, i / n), b = mezcla(BB, BF, (i + 1) / n), c = mas(mezcla(a, b, 0.5), g, -0.032);
        x.save(); x.globalCompositeOperation = 'destination-out'; trazar(x, [mas(a, g, -0.006), mas(b, g, -0.006), c], s, 0); x.fillStyle = '#000'; x.fill(); x.restore();
      }
    }
  }
  // un puño cerrado alrededor de un mango que va en la dirección «ang», centrado en c
  function punoEn(x, c, ang, s, op) {
    var m = marco(c, ang);
    var p = poli([m(-0.03, -0.022), m(0.0, -0.027), m(0.028, -0.02), m(0.034, 0.0), m(0.026, 0.022), m(0.0, 0.026), m(-0.028, 0.02), m(-0.036, 0.0)], [0.012, 0.012, 0.01, 0.01, 0.012, 0.012, 0.01, 0.01]);
    pieza(x, p, s, { hueco: op && op.hueco ? HUECO * 0.7 : 0, sem: 12, rug: 0.0005 });
    raya(x, [m(-0.012, -0.018), m(-0.004, 0.0), m(-0.01, 0.018)], s, 0.0022, { a: 0.3, b: 0.3, alfa: 0.6 });
  }
  // el arma en la mano: del pomo a la tsuba va la empuñadura; desde la tsuba, la hoja (o el remo, o el asta de la lanza)
  function armaEnMano(x, mano, s) {
    var d = [Math.cos(mano.ang), Math.sin(mano.ang)], n = [-d[1], d[0]], L = mano.largo, a = mano.arma;
    if (a === 'remo') {   // el remo tallado de Musashi: madera gruesa, que se ensancha hacia la pala
      var mr = marco(mano.pomo, mano.ang), lt = dist(mano.pomo, mano.tsuba) + L, izq = [], der = [];
      for (var i = 0; i <= 16; i++) { var t = i / 16, ww = lerp(0.012, 0.024, Math.pow(t, 1.6)) + (T.fbm1(t * 6, 3, 2) - 0.5) * 0.004; izq.push(mr(lt * t, -ww)); der.push(mr(lt * t, ww)); }
      pieza(x, izq.concat(cuad(izq[16], mr(lt + 0.012, 0), der[16], 5), der.reverse()), s, { hueco: HUECO, rug: 0.0008, sem: 21 });
      raya(x, [mr(0.04, -0.004), mr(lt * 0.6, -0.008), mr(lt * 0.95, -0.006)], s, 0.003, { a: 0.3, b: 0.4, alfa: 0.7 });
      return;
    }
    if (a === 'yari') {   // la lanza: un asta larga y la hoja en punta de hoja de laurel
      var my = marco(mano.pomo, mano.ang), la = L;
      pieza(x, [my(-0.12, -0.007), my(la, -0.006), my(la, 0.006), my(-0.12, 0.007)], s, { hueco: HUECO * 0.8, rug: 0.0003 });
      pieza(x, poli([my(la - 0.004, -0.012), my(la + 0.05, -0.016), my(la + 0.12, 0.0), my(la + 0.05, 0.016), my(la - 0.004, 0.012)], [0, 0.02, 0, 0.02, 0]), s, { hueco: HUECO * 0.8, rug: 0.0002 });
      raya(x, [my(la + 0.01, 0), my(la + 0.1, 0)], s, 0.0025, { a: 0.2, b: 0.5, alfa: 0.8 });
      return;
    }
    // espadas: la empuñadura con su trenzado, la tsuba y la hoja curva con un filo de luz
    var largoMango = dist(mano.pomo, mano.tsuba), recta = a === 'ninjato', w = 0.022;
    var mt = marco(mano.pomo, mano.ang);
    pieza(x, une([mt(0, -w * 0.55)], [mt(largoMango, -w * 0.5)], [mt(largoMango, w * 0.5)], [mt(0, w * 0.55)]), s, { hueco: HUECO, rug: 0.0003 });
    var nR = Math.max(3, Math.round(largoMango / 0.024)), paso = (largoMango - 0.02) / nR;
    for (var k = 0; k < nR; k++) { var cx = 0.012 + paso * (k + 0.5), hl = paso * 0.36, hw = w * 0.3; x.save(); x.globalCompositeOperation = 'destination-out'; trazar(x, [mt(cx - hl, 0), mt(cx, -hw), mt(cx + hl, 0), mt(cx, hw)], s, 0); x.fillStyle = '#000'; x.fill(); x.restore(); }
    var tsuba = []; for (var j = 0; j <= 16; j++) { var an = j / 16 * TAU; tsuba.push(mt(largoMango + Math.cos(an) * 0.006, Math.sin(an) * w * (recta ? 1.2 : 1.4))); }
    pieza(x, tsuba, s, { hueco: HUECO * 0.8, rug: 0.0002 });
    var mh = marco(mano.tsuba, mano.ang), sori = recta ? 0 : 0.035 * L / 0.6, hojaI = [], hojaD = [];
    for (var h = 0; h <= 20; h++) { var th = h / 20, cy = -sori * th * th, ww2 = 0.0085 * (1 - Math.pow(th, 6)) + 0.0015; hojaI.push(mh(L * th, cy - ww2)); hojaD.push(mh(L * th, cy + ww2 * 0.8)); }
    pieza(x, hojaI.concat([mh(L + 0.012, -sori * 1.05)], hojaD.reverse()), s, { hueco: HUECO * 0.9, rug: 0.0002 });
    var filo = []; for (var q = 1; q <= 18; q++) { var tq = q / 20; filo.push(mh(L * tq, -sori * tq * tq + 0.0025)); }
    raya(x, filo, s, 0.0028, { a: 0.15, b: 0.3, alfa: 0.9 });
  }
  // las cabezas sin sombrero: moño (chonmage), cinta (hachimaki), pelo salvaje, capucha de ninja
  function tocado(x, P, E, C, s) {
    var cb = C.cb, v = P.viento, t = P.t, tipo = E.sombrero;
    if (tipo === 'capucha') {
      pieza(x, poli([cb(-0.075, 0.05), cb(-0.085, -0.02), cb(-0.05, -0.085), cb(0.02, -0.098), cb(0.07, -0.06), cb(0.078, 0.0), cb(0.075, 0.04), cb(0.06, 0.075), cb(-0.02, 0.085)], [0.02, 0.03, 0.04, 0.04, 0.03, 0.02, 0.02, 0.02, 0.02]), s, { sem: 31 });
      raya(x, [cb(0.03, -0.012), cb(0.055, -0.014), cb(0.078, -0.01)], s, 0.0075, { a: 0.25, b: 0.25 });   // la rendija de los ojos
      var o = cb(-0.07, -0.02), pts = [o];
      for (var k = 1; k <= 7; k++) { var f = k / 7; pts.push([o[0] - 0.16 * f * (0.6 + 0.6 * Math.max(0, v)), o[1] + 0.05 * f * (1 - Math.max(0, v)) + Math.sin(t * 7 + k) * 0.012 * f]); }
      hilo(x, cr(pts, 5), s, 0.022, { a: 0.02, b: 0.9 });
      return;
    }
    if (tipo === 'mono' || tipo === 'hachimaki' || tipo === 'salvaje') {
      // el moño: un mechón atado sobre la coronilla, hacia delante
      if (tipo === 'mono') pieza(x, poli([cb(-0.03, -0.085), cb(0.0, -0.1), cb(0.05, -0.104), cb(0.06, -0.094), cb(0.012, -0.084)], [0.006, 0.01, 0.008, 0.006, 0.008]), s, { sem: 33 });
      if (tipo !== 'mono') {
        // pelo revuelto: mechones que salen de la coronilla y la nuca
        for (var m = 0; m < 7; m++) {
          var a0 = -2.4 + m * 0.42, base = cb(Math.cos(a0) * 0.06, -0.03 + Math.sin(a0) * 0.06), lm = 0.03 + (m % 3) * 0.014;
          hilo(x, [base, [base[0] + Math.cos(a0 - 0.3 - v * 0.4) * lm, base[1] + Math.sin(a0 - 0.2) * lm]], s, 0.012, { a: 0.02, b: 0.95 });
        }
        // la cinta: una banda de papel en la frente y las puntas del nudo al viento
        raya(x, [cb(-0.072, -0.03), cb(0.0, -0.05), cb(0.062, -0.04)], s, 0.012, { a: 0.05, b: 0.05 });
        var nudo = cb(-0.07, -0.03);
        [0, 1].forEach(function (i) {
          var pts2 = [nudo];
          for (var k2 = 1; k2 <= 6; k2++) { var f2 = k2 / 6; pts2.push([nudo[0] - (0.09 + i * 0.03) * f2 * (0.6 + 0.6 * Math.max(0, v)), nudo[1] + (0.02 + i * 0.03) * f2 + Math.sin(t * 8 + k2 + i * 2) * 0.01 * f2]); }
          hilo(x, cr(pts2, 5), s, 0.012, { a: 0.02, b: 0.85, alfa: 0.9 });
        });
      }
    }
  }

  /* ------------------------------------------------------------------ la figura entera */
  var ESTILOS = {
    ronin: { sombrero: 'kasa', ala: 0.24, copa: 0.115, espadas: true, pelo: true, barba: true },
    ninja: { sombrero: 'capucha', hakama: 'estrecha', mangas: 'estrechas', espadas: false, espalda: 'ninjato' },
    musashi: { sombrero: 'salvaje', mangas: 'estrechas', espadas: true, barba: true },
    kojiro: { sombrero: 'mono', haori: true, espadas: false },
    ronin47: { sombrero: 'hachimaki', espadas: true, dandara: true },
    ultimo: { sombrero: 'mono', espadas: true, barba: true }
  };
  function pintar(x, P, E, s) {
    E = typeof E === 'string' ? ESTILOS[E] : (E || ESTILOS.ronin);
    var tor = marcoTorso(P), v = P.viento, t = P.t, pel = P.pelvis;
    x.lineCap = 'round'; x.lineJoin = 'round';

    // 1 · el brazo de atrás (si sostiene un arma): su manga queda detrás del cuerpo
    if (P.mano) brazoManga(x, P.hombroF, P.codoF, P.munecaF, P.mangaF, s, { estrecha: E.mangas === 'estrechas', sem: 7 });
    // el haori: la chaqueta corta, cuyo bajo vuela detrás de las caderas
    if (E.haori) {
      var vh = Math.max(0, v);
      pieza(x, poli([tor(0.31, -0.08), tor(0.12, -0.115), [pel[0] - 0.13 - vh * 0.07, pel[1] + 0.12 - vh * 0.03], [pel[0] - 0.06 - vh * 0.05, pel[1] + 0.15], tor(0.0, 0.0)], [0.03, 0.06, 0.03, 0.03, 0]), s, { sem: 17 });
    }
    // 2 · la pierna de atrás
    var pF = P.piernas[0], pN = P.piernas[1];
    if (!P.seiza) pintarPie(x, pF, s, false); pintarPierna(x, pF, P, s, false, 11, E.hakama === 'estrecha');

    // 3 · el tronco (kimono)
    var torso = poli([
      tor(0.05, -0.094), tor(0.15, -0.088), tor(0.25, -0.096), tor(0.31, -0.072), tor(0.342, -0.03),
      tor(0.346, 0.012), tor(0.33, 0.048), tor(0.25, 0.104), tor(0.15, 0.096), tor(0.05, 0.104)
    ], [0, 0.08, 0.1, 0.05, 0.03, 0.02, 0.04, 0.12, 0.08, 0]);
    pieza(x, torso, s, { sem: 4 });

    // 4 · la hakama por arriba (con el koshi-ita, la tabla de la espalda) y la pierna de delante
    var cint = poli([
      tor(0.085, 0.118), [pel[0] + 0.128, pel[1] + 0.03], [pel[0] + 0.112, pel[1] + 0.12], [pel[0] + 0.01, pel[1] + 0.24],
      [pel[0] - 0.108, pel[1] + 0.12], [pel[0] - 0.118, pel[1] + 0.03], tor(0.06, -0.112), tor(0.118, -0.108), tor(0.12, -0.09)
    ], [0, 0.06, 0.05, 0.1, 0.05, 0.06, 0.02, 0.004, 0]);
    pieza(x, cint, s, { sem: 6 });
    if (!P.seiza) pintarPie(x, pN, s, true); pintarPierna(x, pN, P, s, true, 13, E.hakama === 'estrecha');
    // la hakama por delante: un pliegue que baja del obi
    raya(x, cr([tor(0.075, 0.095), [pel[0] + 0.085, pel[1] + 0.06], [pel[0] + 0.07, pel[1] + 0.15]], 6), s, 0.0042, { a: 0.2, b: 0.6 });
    // la cintura de la hakama (sobre el obi)
    raya(x, cr([tor(0.116, -0.07), tor(0.12, 0.0), tor(0.118, 0.114)], 8), s, 0.0042, { a: 0.3, b: 0.12 });
    // el cuello del kimono: rodea la nuca y cruza el pecho hasta la hakama
    raya(x, cr([tor(0.335, -0.045), tor(0.33, 0.02), tor(0.28, 0.08), tor(0.2, 0.104), tor(0.13, 0.108)], 8), s, 0.0052, { a: 0.25, b: 0.3 });

    // 5 · las espadas a la cintura (la wakizashi, más adentro, y la katana; si la katana está en las manos, queda la vaina)
    if (E.espadas) {
      pintarEspada(x, P.wakizashi.tsuba, P.wakizashi.ang, 0.108, 0.3, 0.021, s);
      var sm = pintarEspada(x, P.espada.tsuba, P.espada.ang, P.mano && P.mano.arma === 'katana' ? 0 : 0.152, 0.46, 0.024, s, P.mano && P.mano.arma === 'katana');
      var ca = sm(-0.075, 0.012), cbj = mas(mezcla(ca, tor(0.07, 0.03), 0.5), [-0.01 - v * 0.01, 1], 0.045 + 0.003 * P.rebote);
      hilo(x, cuad(ca, cbj, tor(0.065, 0.04), 10), s, 0.0042, { a: 0.1, b: 0.1, color: E.cordon || TINTA });
    }
    // a la espalda: el ninjatō del ninja (recto, la empuñadura asoma por el hombro)
    if (E.espalda === 'ninjato' && !(P.mano && P.mano.arma === 'ninjato')) pintarEspada(x, tor(0.33, -0.07), -2.25 + P.incl, 0.1, 0.36, 0.02, s);

    // 6 · si sostiene un arma: el arma, la mano de atrás, la manga de delante y su puño
    if (P.mano) {
      armaEnMano(x, P.mano, s);
      punoEn(x, P.punoF, P.mano.ang, s, { hueco: false });
      brazoManga(x, P.hombro, P.codo, P.muneca, P.mangaN, s, { hueco: true, estrecha: E.mangas === 'estrechas', dandara: E.dandara, sem: 8 });
      punoEn(x, P.puno, P.mano.ang, s, { hueco: true });
    } else {
    // 6 · el brazo de delante: la manga ancha y el puño en la vaina
    var S = P.hombro, Ec = P.codo, W = P.muneca, du = dir(S, Ec), nb = [-du[1], du[0]], df = dir(Ec, W), nd = [-df[1], df[0]];
    if (nd[1] < 0) nd = [-nd[0], -nd[1]];
    if (nb[0] > 0) nb = [-nb[0], -nb[1]];
    brazoManga(x, S, Ec, W, P.mangaN, s, { hueco: true, estrecha: E.mangas === 'estrechas', dandara: E.dandara, sem: 8 });
    if (P.manoLibre) { punoEn(x, P.manoLibre, dir(Ec, P.manoLibre)[0] > 0 ? 0.3 : 2.8, s, { hueco: true }); }
    else {
    // el puño: agarra la vaina detrás de la tsuba, con el pulgar encima
    var pm = marco(P.espada.tsuba, P.espada.ang);
    var puno = poli([pm(-0.07, -0.016), pm(-0.046, -0.03), pm(-0.02, -0.026), pm(-0.009, -0.02), pm(-0.012, -0.012), pm(-0.02, -0.013), pm(-0.014, 0.004), pm(-0.018, 0.022), pm(-0.04, 0.03), pm(-0.062, 0.022), pm(-0.074, 0.004)],
                    [0.01, 0.014, 0.008, 0.004, 0.003, 0.004, 0.008, 0.01, 0.012, 0.012, 0.01]);
    pieza(x, puno, s, { hueco: HUECO * 0.7, sem: 12, rug: 0.0005 });
    raya(x, [pm(-0.046, -0.012), pm(-0.034, 0.0), pm(-0.03, 0.018)], s, 0.0024, { a: 0.3, b: 0.4, alfa: 0.7 });
    }
    }

    // 7 · la cabeza y el pelo suelto bajo el ala (se lo lleva el viento)
    var C = pintarCabeza(x, P, E, s);
    if (E.pelo && E.sombrero === 'kasa') {
      [[-0.06, 0.0, 0.1], [-0.058, 0.018, 0.085], [-0.05, 0.03, 0.07]].forEach(function (h, i) {
        var o = C.cb(h[0], h[1]), pts = [o];
        for (var k = 1; k <= 6; k++) { var f = k / 6; pts.push([o[0] - h[2] * f * (0.7 + 0.5 * Math.max(0, v)), o[1] + h[2] * f * (0.55 - 0.35 * Math.max(0, v)) + Math.sin(t * 6 + k * 0.9 + i * 2) * 0.006 * f + P.rebote * 0.004 * f]); }
        hilo(x, cr(pts, 5), s, 0.008 - i * 0.0012, { a: 0.02, b: 0.85 });
      });
    }
    // 8 · el sombrero y sus cordones (o el tocado: moño, cinta, capucha)
    if (E.sombrero !== 'kasa') { tocado(x, P, E, C, s); return; }
    var hs = pintarSombrero(x, P, E, C, s);
    var nudo = C.cb(0.03, 0.09);
    hilo(x, [hs(0.05, 0.016), mezcla(hs(0.05, 0.016), nudo, 0.5), nudo], s, 0.0032, { a: 0.1, b: 0.1, color: E.cordon || TINTA });
    [[0.11, 0], [0.085, 1.7]].forEach(function (c) {
      var pts = [nudo];
      for (var k = 1; k <= 6; k++) { var f = k / 6; pts.push([nudo[0] - c[0] * f * (0.45 + 0.6 * Math.max(0, v)), nudo[1] + c[0] * f * (0.8 - 0.5 * Math.max(0, v)) + Math.sin(t * 5 + c[1] + k * 0.8) * 0.008 * f]); }
      hilo(x, cr(pts, 5), s, 0.0038, { a: 0.05, b: 0.7, color: E.cordon || TINTA });
    });
  }

  /* ------------------------------------------------------------------ lienzos y caché */
  // el acabado de tinta: grano fino (el papel que asoma) en toda la silueta
  function acabar(L, op) {
    op = op || {};
    var x = L.x, w = L.w, h = L.h;
    // el centro de las manchas grandes se aclara un poco y se motea; los bordes quedan cargados (como la tinta al secarse)
    if (op.aguada !== 0) {
      var k = Math.max(2, Math.round((op.radio || Math.min(w, h) * 0.018))), sw = Math.max(1, Math.round(w / k)), sh = Math.max(1, Math.round(h / k));
      var A = T.lienzo(sw, sh); A.x.drawImage(L.c, 0, 0, w, h, 0, 0, sw, sh);
      var B = T.lienzo(Math.max(1, sw >> 1), Math.max(1, sh >> 1)); B.x.drawImage(A.c, 0, 0, B.w, B.h);
      A.x.clearRect(0, 0, sw, sh); A.x.drawImage(B.c, 0, 0, sw, sh);
      // A = alfa desenfocado: casi 1 dentro, cae en los bordes. Se le pasa el moteado y se resta
      var nub = T.textura('nubes', 512, 3, 4, 1.4, 21, false);
      A.x.globalCompositeOperation = 'destination-in'; A.x.globalAlpha = 1; A.x.fillStyle = A.x.createPattern(nub.c, 'repeat'); A.x.fillRect(0, 0, sw, sh);
      // se aclara el color (gris de tinta diluida) sin quitar opacidad: la figura no se transparenta sobre el fondo
      A.x.globalCompositeOperation = 'source-in'; A.x.fillStyle = 'rgb(92,88,84)'; A.x.fillRect(0, 0, sw, sh);
      x.save(); x.globalCompositeOperation = 'source-atop'; x.globalAlpha = op.aguada == null ? 0.5 : op.aguada; x.imageSmoothingEnabled = true; x.drawImage(A.c, 0, 0, sw, sh, 0, 0, w, h); x.restore();
    }
    var tex = T.textura('grano', 256, 70, 2, 2.6, 5, false);
    x.save(); x.globalCompositeOperation = 'destination-out'; x.globalAlpha = op.grano == null ? 0.07 : op.grano; x.fillStyle = x.createPattern(tex.c, 'repeat'); x.fillRect(0, 0, w, h); x.restore();
  }
  var cache = {};
  // un sprite: la figura en su propio lienzo (origen en los pies)
  function sprite(P, E, alto, clave) {
    if (clave && cache[clave] && cache[clave].alto === alto) return cache[clave];
    var w = Math.ceil(alto * 1.25), h = Math.ceil(alto * 1.32), L = T.lienzo(w, h), ox = Math.round(w * 0.5), oy = Math.round(h * 0.965);
    L.x.save(); L.x.translate(ox, oy); pintar(L.x, P, E, alto); L.x.restore();
    acabar(L);
    var r = { c: L.c, w: w, h: h, ox: ox, oy: oy, alto: alto };
    if (clave) cache[clave] = r;
    return r;
  }
  // poner un sprite en (x, y) = los pies; «izquierda» lo pinta mirando a la izquierda
  function poner(ctx, sp, x, y, alto, izquierda, alfa) {
    var k = (alto || sp.alto) / sp.alto;
    ctx.save(); ctx.translate(x, y); if (izquierda) ctx.scale(-1, 1);
    if (alfa != null) ctx.globalAlpha *= alfa;
    ctx.drawImage(sp.c, -sp.ox * k, -sp.oy * k, sp.w * k, sp.h * k);
    ctx.restore();
  }
  // en vivo: se pinta en un lienzo de trabajo reutilizado y se pone encima (para el protagonista, que se mueve cada fotograma)
  var trabajo = null;
  function dibujar(ctx, P, E, alto, x, y, izquierda, alfa) {
    var w = Math.ceil(alto * 1.25), h = Math.ceil(alto * 1.32);
    if (!trabajo || trabajo.w < w || trabajo.h < h) trabajo = T.lienzo(w, h);
    var L = trabajo, ox = Math.round(w * 0.5), oy = Math.round(h * 0.965);
    L.x.clearRect(0, 0, L.w, L.h);
    L.x.save(); L.x.translate(ox, oy); pintar(L.x, P, E, alto); L.x.restore();
    acabar({ x: L.x, c: L.c, w: w, h: h });
    ctx.save(); ctx.translate(x, y); if (izquierda) ctx.scale(-1, 1); if (alfa != null) ctx.globalAlpha *= alfa;
    ctx.drawImage(L.c, 0, 0, w, h, -ox, -oy, w, h); ctx.restore();
  }

  // mezcla dos poses (números y listas, recursivamente): para pasar de andar a estar quieto sin saltos
  function mezclar(a, b, t) {
    if (t <= 0) return a; if (t >= 1) return b;
    if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * t;
    if (Array.isArray(a) && Array.isArray(b)) { var o = []; for (var i = 0; i < a.length; i++) o.push(mezclar(a[i], b[i], t)); return o; }
    if (a && b && typeof a === 'object') { var r = {}; for (var k in a) r[k] = k in b ? mezclar(a[k], b[k], t) : a[k]; return r; }
    return t < 0.5 ? a : b;
  }

  SA.figura = {
    estilos: ESTILOS, M: M, AVANCE: AVANCE, AVANCE_R: AVANCE_R,
    andar: poseAndar, correr: poseCorrer, quieto: poseQuieto, guardia: poseGuardia, seiza: poseSeiza, iai: poseIai, mezclar: mezclar,
    pintar: pintar, sprite: sprite, poner: poner, dibujar: dibujar,
    limpiar: function () { cache = {}; }
  };
})();
