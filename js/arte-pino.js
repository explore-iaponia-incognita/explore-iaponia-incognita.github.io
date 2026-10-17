/* El camino oculto · arte del pino
   El pino negro (kuromatsu) del acantilado, la roca en la que se agarra y la isla de Ganryūjima, pintados con el motor de
   tinta (SA.tinta) como en un sumi-e:
   · el pino: tronco que se inclina y se tuerce, pintado con el pincel de lado (vetas secas), contorno oscuro, corteza de
     escamas y nudos; ramas largas casi horizontales y, en sus puntas, almohadillas de agujas: una nube de aguada clara
     con la panza más oscura y, encima, muchos abanicos de agujas, más apretados y oscuros en el filo de arriba;
   · la roca: bloques de caras talladas «a hachazos» (fupi cun), filos oscuros, aristas que bajan como grietas, puntos
     de musgo y matas;
   · la isla: una loma baja y plana vista desde lejos, con pinos diminutos, rocas y la línea del agua.
   Cada función devuelve un lienzo { c, x, w, h } con sus anclajes en px del lienzo. Todo sale de la semilla (sin Math.random). */
(function () {
  'use strict';
  var SA = window.SA, T = SA.tinta, A = SA.arte, TAU = Math.PI * 2;
  var TINTA = T.color.tinta;
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function suave(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

  /* ------------------------------------------------------------------ lienzos de paso
     Siempre nuevos y del tamaño justo (probado: reutilizar uno grande sale más caro en WebKit que crear uno pequeño). */
  function trabajo(w, h) {
    var L = T.lienzo(w, h), x = L.x;
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.fillStyle = '#000'; x.strokeStyle = '#000';
    return L;
  }
  // desenfoca la zona (sx, sy, sw, sh) de F y la pone en ctx en (dx, dy): reducir y ampliar, como T.desenfocar
  function difuminar(ctx, F, fw, fh, radio, sx, sy, sw, sh, dx, dy) {
    var k = Math.max(1, Math.round(radio)), w = Math.max(1, Math.round(fw / k)), h = Math.max(1, Math.round(fh / k)), w2 = Math.max(1, w >> 1), h2 = Math.max(1, h >> 1);
    var A2 = trabajo(w, h); A2.x.drawImage(F.c, 0, 0, fw, fh, 0, 0, w, h);
    var B2 = trabajo(w2, h2); B2.x.drawImage(A2.c, 0, 0, w, h, 0, 0, w2, h2);
    A2.x.clearRect(0, 0, w, h); A2.x.drawImage(B2.c, 0, 0, w2, h2, 0, 0, w, h);
    ctx.drawImage(A2.c, sx * w / fw, sy * h / fh, sw * w / fw, sh * h / fh, dx, dy, sw, sh);
  }

  /* ------------------------------------------------------------------ aguada con margen
     Igual que T.aguada, pero el desenfoque se hace en un lienzo con margen: WebKit, al reducir un lienzo con suavizado,
     a veces lee fuera de su borde (memoria sin limpiar) y deja una raya gris en los bordes derecho e inferior.
     Con margen, esa raya cae fuera de lo que se copia. op.caja ([x0, y0, x1, y1], opcional): dónde cabe la forma; el lienzo
     de trabajo es solo esa caja (mucho más rápido en piezas grandes con muchas aguadas pequeñas). */
  function aguada(ctx, w, h, dibujarForma, op) {
    op = op || {};
    var m = op.suave && op.suave >= 1 ? Math.ceil(op.suave) * 4 + 4 : 0, x0 = 0, y0 = 0, cw = w, ch = h;
    if (op.caja) {
      var ex = 2 + (m ? Math.ceil(op.suave * 2) : 0);   // lo que se extiende el desenfoque fuera de la forma
      x0 = Math.max(0, Math.floor(op.caja[0]) - ex); y0 = Math.max(0, Math.floor(op.caja[1]) - ex);
      cw = Math.min(w, Math.ceil(op.caja[2]) + ex) - x0; ch = Math.min(h, Math.ceil(op.caja[3]) + ex) - y0;
      if (cw < 1 || ch < 1) return;
    }
    var fw = cw + m * 2, fh = ch + m * 2, F = trabajo(fw, fh), x = F.x;
    x.save(); x.translate(m - x0, m - y0); dibujarForma(x, F); x.restore();
    x.save();
    if (op.degradado) {
      var g = x.createLinearGradient(0, (op.y0 == null ? 0 : op.y0) + m - y0, 0, (op.y1 == null ? h : op.y1) + m - y0);
      g.addColorStop(0, 'rgba(0,0,0,' + op.degradado[0] + ')'); g.addColorStop(1, 'rgba(0,0,0,' + op.degradado[1] + ')');
      x.globalCompositeOperation = 'destination-in'; x.fillStyle = g; x.fillRect(0, 0, fw, fh); x.globalCompositeOperation = 'source-over';
    }
    var desp = (((op.semilla || 0) * 97) % 512 + 512) % 512;
    if (op.nubes) {
      var tn = T.textura('nubes', 512, 3, 4, 1.4, 21, false);
      x.save(); x.globalCompositeOperation = 'destination-out'; x.globalAlpha = op.nubes; x.fillStyle = x.createPattern(tn.c, 'repeat'); x.translate(m - x0 - desp, m - y0 - desp * 0.37); x.fillRect(x0 + desp - m, y0 + desp * 0.37 - m, fw, fh); x.restore();
    }
    if (op.grano !== 0) {
      var tg = T.textura('granulado', 256, 48, 2, 1.8, 9, false);
      x.save(); x.globalCompositeOperation = 'destination-out'; x.globalAlpha = op.grano == null ? 0.22 : op.grano; x.fillStyle = x.createPattern(tg.c, 'repeat'); x.translate(m - x0 - desp, m - y0); x.fillRect(x0 + desp - m, y0 - m, fw, fh); x.restore();
    }
    x.restore();
    var gris = op.gris == null ? 0.35 : op.gris;
    ctx.save(); ctx.globalAlpha = gris;
    if (m) difuminar(ctx, F, fw, fh, op.suave, m, m, cw, ch, x0, y0);
    else ctx.drawImage(F.c, 0, 0, cw, ch, x0, y0, cw, ch);
    if (op.borde) { ctx.globalAlpha = gris * op.borde * 0.6; ctx.drawImage(F.c, m, m, cw, ch, x0, y0, cw, ch); }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ caminos */
  function longitudes(pts) { var o = [0]; for (var i = 1; i < pts.length; i++) o.push(o[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return o; }
  // normal unitaria (−ty, tx) en cada punto: a la derecha de un camino que sube
  function normales(pts) {
    return pts.map(function (p, i) {
      var a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      return [-dy / l, dx / l];
    });
  }
  function indiceEn(ls, d) { var k = 0; while (k < ls.length - 1 && ls[k] < d) k++; return k; }
  // el trozo de un camino entre dos fracciones de su longitud, con una presión (3.ª coordenada) que late
  function tramo(pts, ls, f0, f1, presion, sem) {
    var Lt = ls[ls.length - 1], a = f0 * Lt, b = f1 * Lt, o = [];
    for (var i = 0; i < pts.length; i++) if (ls[i] >= a && ls[i] <= b) o.push([pts[i][0], pts[i][1], (pts[i][2] == null ? 1 : pts[i][2]) * (1 + (T.fbm1(ls[i] * 0.04, sem, 2) - 0.5) * presion * 2)]);
    return o;
  }
  // un camino denso (un punto cada ~paso px) por una polilínea
  function densificar(pts, paso) {
    var o = [pts[0].slice()];
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / paso));
      for (var k = 1; k <= n; k++) o.push([lerp(a[0], b[0], k / n), lerp(a[1], b[1], k / n)]);
    }
    return o;
  }

  /* Un contorno a pincel: pocos tramos largos, con presión que late, que se secan al final; entre tramo y tramo, a veces,
     un hueco corto (el pintor levanta el pincel). op: ancho, alfa, seco, carga, huecos (prob.), tramo (largo medio, fracción),
     rasgado, desde / hasta (fracciones), presion */
  function contorno(x, pts, op, r) {
    if (pts.length < 3) return;
    var ls = longitudes(pts), f = op.desde || 0, fin = op.hasta == null ? 1 : op.hasta;
    while (f < fin - 0.03) {
      var f1 = Math.min(fin, f + (op.tramo || 0.5) * (0.6 + r() * 0.8));
      if (fin - f1 < 0.12) f1 = fin;
      var sub = tramo(pts, ls, f, f1, op.presion == null ? 0.4 : op.presion, Math.floor(r() * 100));
      if (op.alReves || (op.alReves == null && r() < 0.5)) sub.reverse();
      if (sub.length > 2) T.pincelada(x, sub, { ancho: op.ancho * (0.85 + r() * 0.3), alfa: op.alfa == null ? 0.9 : op.alfa, carga: op.carga == null ? 0.95 : op.carga, seco: op.seco == null ? 0.55 : op.seco, entrada: 0.03 + r() * 0.08, salida: 0.18 + r() * 0.25, rugoso: op.rugoso == null ? 0.35 : op.rugoso, rasgado: op.rasgado && r() < 0.4 ? op.rasgado : 0, cerdas: op.cerdas, semilla: Math.floor(r() * 1e6) });
      f = f1 + (r() < (op.huecos == null ? 0.35 : op.huecos) ? 0.008 + r() * 0.03 : -0.01);
    }
  }

  // un punto de tinta irregular, algo apaisado (musgo): nunca un círculo perfecto
  function punto(x, cx, cy, rr, rot, r, alfa) {
    var n = 7, p = [], k;
    for (k = 0; k < n; k++) { var a = k / n * TAU, q = rr * (0.7 + r() * 0.55); p.push([Math.cos(a) * q * 1.3, Math.sin(a) * q]); }
    x.save(); x.translate(cx, cy); x.rotate(rot); x.fillStyle = T.rgba(TINTA, alfa); x.beginPath();
    x.moveTo((p[n - 1][0] + p[0][0]) / 2, (p[n - 1][1] + p[0][1]) / 2);
    for (k = 0; k < n; k++) { var a1 = p[k], b1 = p[(k + 1) % n]; x.quadraticCurveTo(a1[0], a1[1], (a1[0] + b1[0]) / 2, (a1[1] + b1[1]) / 2); }
    x.fill(); x.restore();
  }
  // un grupo de puntos de musgo sobre un filo (s: tamaño del grupo)
  function musgo(x, cx, cy, s, n, r, alfa) {
    for (var i = 0; i < n; i++) {
      var rr = s * 0.13 / Math.pow(r() * 0.85 + 0.15, 0.6);
      punto(x, cx + (r() - 0.5) * s * 2, cy + (r() - 0.5) * s * 0.5, Math.min(s * 0.32, rr), (r() - 0.5) * 0.5, r, alfa * (0.7 + r() * 0.3));
    }
  }
  // una mata de hierba: hojas finas que salen de un punto y se curvan hacia fuera
  function mata(x, bx, by, alto, r, alfa) {
    var n = 4 + Math.floor(r() * 4);
    for (var i = 0; i < n; i++) {
      var f = (i + 0.5) / n - 0.5, a = -Math.PI / 2 + f * 1.5 + (r() - 0.5) * 0.35, l = alto * (0.5 + r() * 0.6) * (1 - Math.abs(f) * 0.6), cv = f * 1.1 + (r() - 0.5) * 0.5;
      var pts = [];
      for (var k = 0; k <= 6; k++) { var g = k / 6, aa = a + cv * g * g; pts.push([bx + Math.cos(aa) * l * g + f * alto * 0.12, by + Math.sin(aa) * l * g]); }
      T.pincelada(x, pts, { ancho: Math.max(0.8, alto * 0.07), alfa: alfa, carga: 1, seco: 0.35, entrada: 0.02, salida: 0.85, cerdas: 3, rugoso: 0.2, semilla: Math.floor(r() * 1e6) });
    }
  }

  /* ------------------------------------------------------------------ el pino: agujas */
  /* Un abanico de agujas (la «media rueda» del kuromatsu): agujas rectas, casi del mismo largo, repartidas con regularidad
     desde un mismo punto; con algo de cuerpo en la base y afiladas en la punta.
     f: { x, y, R (largo), ang (hacia dónde abre), abre (semiapertura, rad), alfa } */
  function abanico(x, f, r, gro, k) {
    var n = clamp(Math.round(f.abre * (3 + f.R * 0.3)), 5, 19), al = f.alfa * k;
    x.fillStyle = T.rgba(TINTA, al); x.beginPath();
    for (var i = 0; i < n; i++) {
      var g = n > 1 ? i / (n - 1) : 0.5, a = f.ang - f.abre + 2 * f.abre * g + (r() - 0.5) * f.abre / n * 1.1;
      var l = f.R * (0.84 + r() * 0.18) * (1 - 0.16 * Math.pow(Math.abs(g - 0.5) * 2, 2)), r0 = f.R * (0.08 + r() * 0.14);
      var ca = Math.cos(a), sa = Math.sin(a), sx = f.x + ca * r0, sy = f.y + sa * r0, ex = f.x + ca * l, ey = f.y + sa * l;
      var gw = gro * (0.7 + r() * 0.6) / 2, nx = -sa * gw, ny = ca * gw, cv = (r() - 0.5) * l * 0.08;
      var mx = (sx + ex) / 2 - sa * cv, my = (sy + ey) / 2 + ca * cv;
      x.moveTo(sx + nx, sy + ny); x.quadraticCurveTo(mx + nx * 0.6, my + ny * 0.6, ex, ey); x.quadraticCurveTo(mx - nx * 0.6, my - ny * 0.6, sx - nx, sy - ny); x.closePath();
    }
    x.fill();
  }
  /* Una almohadilla: una nube plana de dos a cuatro lóbulos, abombada por arriba y casi llana por debajo, hecha de tres
     filas de abanicos que se pisan: la de abajo (grande y más clara), la del medio y la cresta (pequeños, juntos y muy
     oscuros, abriendo hacia fuera del filo). claro: [x, y, rx, ry] donde no se pone ningún abanico. */
  function hacerPad(cx, cy, pw, ph, r, Rmin, gira, claro) {
    var P = { x: cx, y: cy, w: pw, h: ph, sem: Math.floor(r() * 997), ab: [] }, R = P.R = Math.max(Rmin, ph * 0.46), gi = gira || 0;
    var nl = 2 + Math.floor(r() * 3), lob = [], j;
    for (j = 0; j < nl; j++) lob.push([lerp(-0.55, 0.55, nl > 1 ? j / (nl - 1) : 0.5) + (r() - 0.5) * 0.3, 0.5 + r() * 0.5, 0.2 + r() * 0.16]);
    function bul(u) { var s = 0; lob.forEach(function (l) { var d = (u - l[0]) / l[2]; s += l[1] * Math.exp(-d * d); }); return s; }
    var bmax = 0.01; for (j = -20; j <= 20; j++) bmax = Math.max(bmax, bul(j / 20));
    P.arriba = function (u) { return cy + u * pw / 2 * gi - ph * 0.58 * Math.pow(Math.max(0, 1 - u * u), 0.45) * (0.55 + 0.45 * bul(u) / bmax); };
    P.abajo = function (u) { return cy + u * pw / 2 * gi + ph * 0.36 * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), 2.4)), 0.35); };
    function fuera(hx, hy) { return claro && Math.pow((hx - claro[0]) / claro[2], 2) + Math.pow((hy - claro[1]) / claro[3], 2) < 1; }
    // una fila de abanicos entre −umax y umax; en los extremos abren hacia fuera y son más pequeños
    function fila(yDe, paso, Rk, alfa, abre, v, umax, claros, salto) {
      for (var u = -umax + r() * paso / pw; u <= umax; u += paso / (pw / 2) * (0.75 + r() * 0.5)) {
        var hx = cx + u * pw / 2 + (r() - 0.5) * paso * 0.25, hy = yDe(u) + (r() - 0.5) * R * salto;
        if (fuera(hx, hy)) continue;
        var ext = Math.abs(u) > 0.6 ? (u < 0 ? -1 : 1) * (Math.abs(u) - 0.6) / 0.4 : 0, ae = Math.abs(ext);
        P.ab.push({ x: hx, y: hy, u: u, v: v, R: Rk * (0.8 + r() * 0.3) * (1 - 0.4 * ae * ae), ang: -Math.PI / 2 + u * 0.3 + ext * 0.55 + (r() - 0.5) * 0.25, abre: abre * (0.88 + r() * 0.16) + ae * 0.15, alfa: alfa * (0.8 + r() * 0.2) * (r() < claros ? 0.5 : 1) });
      }
    }
    fila(function (u) { return P.abajo(u) - ph * 0.05; }, R * 0.6, R, 0.6, 1.42, 1, 0.8, 0.3, 0.4);
    fila(function (u) { return lerp(P.abajo(u), P.arriba(u), 0.45); }, R * 0.66, R * 0.82, 0.8, 1.38, 0.5, 0.9, 0.25, 0.4);
    fila(function (u) { return P.arriba(u) + R * 0.38; }, R * 0.34, R * 0.56, 0.92, 1.3, 0, 0.96, 0.05, 0.16);
    // unos pocos abanicos que cuelgan de la panza (las agujas de abajo), claros y cortos: el borde de abajo no es una regla
    for (var uc = -0.7 + r() * 0.3; uc < 0.75; uc += 0.35 + r() * 0.3) {
      var hxc = cx + uc * pw / 2, hyc = P.abajo(uc) - ph * 0.06, lc = uc < 0 ? -1 : 1;
      if (!fuera(hxc, hyc)) P.ab.unshift({ x: hxc, y: hyc, u: uc, v: 1.2, R: R * (0.4 + r() * 0.2), ang: Math.PI / 2 + lc * (0.5 + r() * 0.5), abre: 0.7 + r() * 0.3, alfa: 0.32 + r() * 0.15 });
    }
    return P;
  }
  // el contorno cerrado de una almohadilla (para su aguada)
  function formaPad(c, P) {
    var n = 28, j, u;
    for (j = 0; j <= n; j++) { u = -1 + 2 * j / n; var px = P.x + u * P.w / 2, py = P.arriba(u); if (j) c.lineTo(px, py); else c.moveTo(px, py); }
    for (j = n; j >= 0; j--) { u = -1 + 2 * j / n; c.lineTo(P.x + u * P.w / 2, P.abajo(u)); }
    c.closePath();
  }
  // la panza: una franja a lo largo del borde de abajo, de alto irregular
  function formaPanza(c, P) {
    var n = 24, j, u;
    for (j = 0; j <= n; j++) { u = -0.98 + 1.96 * j / n; var px = P.x + u * P.w / 2; if (j) c.lineTo(px, P.abajo(u)); else c.moveTo(px, P.abajo(u)); }
    for (j = n; j >= 0; j--) { u = -0.98 + 1.96 * j / n; var bt = P.abajo(u), tp = P.arriba(u); c.lineTo(P.x + u * P.w / 2, bt - (bt - tp) * (0.16 + 0.2 * T.fbm1(u * 3 + P.sem, 5, 2))); }
    c.closePath();
  }
  /* Pinta una lista de almohadillas: la aguada clara (todas a la vez, para que no se oscurezcan donde se pisan), la panza,
     el hueco oscuro del escondite (op.hueco: [x, y, rx, ry]) y los abanicos, de la almohadilla de arriba a la de abajo.
     op: gris, gris2 (panza), k (multiplica el alfa de las agujas), gro (grosor de aguja), semilla */
  function pintarPads(x, w, h, lista, op, r) {
    var S = Math.min(w, h), bb = [1e9, 1e9, -1e9, -1e9];
    lista.forEach(function (P) { bb[0] = Math.min(bb[0], P.x - P.w / 2 - P.R * 1.2); bb[1] = Math.min(bb[1], P.y - P.h * 0.6 - P.R * 1.2); bb[2] = Math.max(bb[2], P.x + P.w / 2 + P.R * 1.2); bb[3] = Math.max(bb[3], P.y + P.h * 0.5 + P.R * 0.6); });
    function cajaNucleos() { var b = [1e9, 1e9, -1e9, -1e9]; lista.forEach(function (P) { if (P.ex == null) return; var cy2 = lerp(P.ey, P.y, 0.45); b[0] = Math.min(b[0], P.ex - P.w * 0.13); b[1] = Math.min(b[1], cy2 - P.h * 0.24); b[2] = Math.max(b[2], P.ex + P.w * 0.13); b[3] = Math.max(b[3], cy2 + P.h * 0.24); }); return b; }
    aguada(x, w, h, function (c) {
      c.beginPath();
      lista.forEach(function (P) {
        formaPad(c, P);
        P.ab.forEach(function (f) { var ox = f.x + Math.cos(f.ang) * f.R * 0.35, oy = f.y + Math.sin(f.ang) * f.R * 0.35, rr = f.R * 0.5; c.moveTo(ox + rr, oy); c.arc(ox, oy, rr, 0, TAU); });
      });
      c.fill();
    }, { gris: op.gris, nubes: 0.55, grano: 0.25, suave: Math.max(1, S * 0.003), borde: 0.8, semilla: op.semilla, caja: bb });
    aguada(x, w, h, function (c) { c.beginPath(); lista.forEach(function (P) { formaPanza(c, P); }); c.fill(); }, { gris: op.gris2, nubes: 0.45, grano: 0.2, suave: Math.max(1.5, S * 0.008), semilla: op.semilla + 3, caja: bb });
    // el corazón de cada almohadilla, donde entra su rama: más oscuro (la madera se pierde en la espesura)
    aguada(x, w, h, function (c) { c.beginPath(); lista.forEach(function (P) { if (P.ex == null) return; var cy2 = lerp(P.ey, P.y, 0.45); c.moveTo(P.ex + P.w * 0.13, cy2); c.ellipse(P.ex, cy2, P.w * 0.13, P.h * 0.24, 0, 0, TAU); }); c.fill(); }, { gris: 0.32, nubes: 0.35, grano: 0.15, suave: Math.max(2, S * 0.008), semilla: op.semilla + 8, caja: cajaNucleos() });
    if (op.hueco) aguada(x, w, h, function (c) { c.beginPath(); c.ellipse(op.hueco[0], op.hueco[1], op.hueco[2], op.hueco[3], 0, 0, TAU); c.fill(); }, { gris: 0.6, nubes: 0.3, grano: 0.15, suave: Math.max(2, S * 0.008), semilla: op.semilla + 6, caja: [op.hueco[0] - op.hueco[2], op.hueco[1] - op.hueco[3], op.hueco[0] + op.hueco[2], op.hueco[1] + op.hueco[3]] });
    lista.slice().sort(function (a, b) { return a.y - b.y; }).forEach(function (P) { var kp = (op.k == null ? 1 : op.k) * (0.86 + (T.h1(P.sem) * 0.24)); P.ab.forEach(function (f) { abanico(x, f, r, op.gro, kp); }); });
  }

  /* ------------------------------------------------------------------ el pino: tronco y ramas */
  // los bordes de un tubo de corteza (tronco, rama gruesa o raíz): a = lado +n, b = lado −n, con el borde nudoso
  function bordes(esp, an, sem, rug) {
    var ns = normales(esp), ls = longitudes(esp), Lt = ls[ls.length - 1] || 1, a = [], b = [];
    for (var i = 0; i < esp.length; i++) {
      var hw = an[i] / 2, e1 = 1 + (T.fbm1(ls[i] * 0.06, sem, 3) - 0.5) * rug, e2 = 1 + (T.fbm1(ls[i] * 0.06, sem + 5, 3) - 0.5) * rug;
      a.push([esp[i][0] + ns[i][0] * hw * e1, esp[i][1] + ns[i][1] * hw * e1]);
      b.push([esp[i][0] - ns[i][0] * hw * e2, esp[i][1] - ns[i][1] * hw * e2]);
    }
    return { a: a, b: b, n: ns, ls: ls, L: Lt };
  }
  function forma(c, B) { c.moveTo(B.a[0][0], B.a[0][1]); B.a.forEach(function (p) { c.lineTo(p[0], p[1]); }); for (var i = B.b.length - 1; i >= 0; i--) c.lineTo(B.b[i][0], B.b[i][1]); c.closePath(); }
  // la franja de sombra de un tubo: del borde de sombra hasta una línea irregular cerca del eje
  function formaSombra(c, esp, an, B, lado, desde, sem) {
    var n = esp.length, i;
    for (i = 0; i < n; i++) { var k = lado > 0 ? B.a[i] : B.b[i]; if (i) c.lineTo(k[0], k[1]); else c.moveTo(k[0], k[1]); }
    for (i = n - 1; i >= 0; i--) {
      var hw = an[i] / 2 * (desde + 0.4 * (T.fbm1(B.ls[i] * 0.03, sem, 3) - 0.5)), nn = B.n[i];
      c.lineTo(esp[i][0] + nn[0] * hw * lado, esp[i][1] + nn[1] * hw * lado);
    }
    c.closePath();
  }
  /* La corteza en escamas (鱗皴): filas de arcos colgados, uno junto a otro, como tejas o escamas de pez; cada fila va al
     tresbolillo con la de abajo y gira un poco a lo largo del tronco (la torsión del pino). Sobre el cilindro, las escamas
     se estrechan hacia los bordes. Cada arco es una pincelada algo seca, más gruesa en su panza; hay más, y más oscuras,
     en el lado de sombra, y en el de la luz se pierden. */
  function corteza(x, esp, an, B, lado, dens, S, r, f0, f1) {
    var paso = S * 0.027, fila = 0, gro = Math.max(0.8, S * 0.0042);
    for (var d = f0 * B.L + paso * 0.6; d < f1 * B.L; d += paso * (0.85 + r() * 0.3), fila++) {
      var k = indiceEn(B.ls, d), wv = an[k], cols = clamp(Math.round(wv / (S * 0.024)), 2, 5), giro = d / B.L * 1.1 + (fila % 2) * 0.5;
      for (var c = -1; c <= cols; c++) {
        var a0 = (c + giro % 1 + (r() - 0.5) * 0.15) / cols, a1 = a0 + (0.9 + r() * 0.2) / cols;
        if (a1 <= 0.02 || a0 >= 0.98) continue;
        a0 = Math.max(0.02, a0); a1 = Math.min(0.98, a1);
        var um = Math.sin(-Math.PI / 2 + Math.PI * (a0 + a1) / 2), som = suave((um * lado + 0.45) / 1.25);
        if (r() > dens * (0.3 + 0.7 * som)) continue;
        var pts = [], hondo = paso * (0.4 + r() * 0.25);
        for (var m = 0; m <= 8; m++) {
          var g = m / 8, ph = -Math.PI / 2 + Math.PI * lerp(a0, a1, g), u = Math.sin(ph), dd = d - Math.sin(g * Math.PI) * hondo;
          var kk = indiceEn(B.ls, dd), pp = esp[kk], nn = B.n[kk], ww = an[kk] * 0.48;
          pts.push([pp[0] + nn[0] * u * ww, pp[1] + nn[1] * u * ww, 0.35 + 1.1 * Math.sin(g * Math.PI)]);
        }
        T.pincelada(x, pts, { ancho: gro * (0.8 + r() * 0.5) * (0.75 + 0.45 * som), alfa: 0.4 + 0.5 * som, carga: 0.95, seco: 0.55, entrada: 0.1, salida: 0.25, cerdas: 4, rugoso: 0.35, semilla: Math.floor(r() * 1e6) });
      }
    }
  }
  // un nudo: una media luna oscura bajo un arco fino (el ojo de una rama perdida)
  function nudo(x, cx, cy, rx, ry, rot, r) {
    var cs = Math.cos(rot), sn = Math.sin(rot);
    function P(lx, ly) { return [cx + lx * cs - ly * sn, cy + lx * sn + ly * cs]; }
    var lu = [], ar = [], m, th;
    for (m = 0; m <= 12; m++) { th = 0.15 * Math.PI + m / 12 * 0.7 * Math.PI; var q = P(Math.cos(th) * rx, Math.sin(th) * ry); q.push(0.5 + Math.sin(th)); lu.push(q); }
    for (m = 0; m <= 10; m++) { th = 1.1 * Math.PI + m / 10 * 0.8 * Math.PI; ar.push(P(Math.cos(th) * rx * 0.9, Math.sin(th) * ry * 0.8)); }
    T.pincelada(x, lu, { ancho: Math.max(1.2, ry * 0.55), alfa: 0.9, carga: 1, seco: 0.4, entrada: 0.15, salida: 0.4, cerdas: 4, rugoso: 0.3, semilla: Math.floor(r() * 1e6) });
    T.pincelada(x, ar, { ancho: Math.max(0.8, ry * 0.22), alfa: 0.75, carga: 0.9, seco: 0.6, entrada: 0.2, salida: 0.4, cerdas: 3, rugoso: 0.3, semilla: Math.floor(r() * 1e6) });
  }

  /* ------------------------------------------------------------------ el pino
     A.pino(w, h, op) → lienzo con: base [x,y] (pie del tronco: ahí se apoya en la roca; las raíces bajan algo más),
     pads [{x,y,w,h}] (centro y tamaño de cada almohadilla) y escondite [x,y] (dentro de la almohadilla grande de más a la
     izquierda, en su hueco oscuro: ahí se abren los ojos del ninja).
     op: semilla, inclina (−1 izquierda … 1 derecha), pads (3…7), sombra (1: sombra a la derecha; −1: a la izquierda),
         fondo (false: sin almohadillas de fondo), alto (0,4…0,8: fracción del alto hasta la copa; menos = pino achaparrado),
         escondite (false: sin el hueco oscuro de los ojos) */
  A.pino = function (w, h, op) {
    op = op || {};
    var L = T.lienzo(w, h), x = L.x, sem = op.semilla == null ? 3 : op.semilla, r = T.azar(sem * 7919 + 17);
    var inc = clamp(op.inclina == null ? 0.45 : op.inclina, -1, 1), sg = inc < 0 ? -1 : 1, sb = op.sombra || 1;
    var S = Math.min(w, h), nPads = clamp(Math.round(op.pads == null ? 5 : op.pads), 3, 7), M = S * 0.02, Rmin = Math.max(2.4, S * 0.012);
    var sv = [0.6 * sb, 0.8], i;
    function ladoSombra(B) { var s = 0; B.n.forEach(function (n) { s += n[0] * sv[0] + n[1] * sv[1]; }); return s >= 0 ? 1 : -1; }

    // 1 · la espina del tronco: se inclina, se tuerce y la punta vuelve hacia atrás (una S)
    var bx = w * 0.5 - inc * w * 0.16, by = h * 0.955, alto = h * clamp(op.alto == null ? 0.7 : op.alto, 0.4, 0.8);
    // DX: la inclinación; SW: un vaivén propio (aunque el pino esté derecho, el tronco nunca es un palo)
    var DX = [0, 0.06, 0.2, 0.33, 0.38, 0.34, 0.24], SW = [0, 0.025, 0.055, 0.03, -0.025, -0.045, -0.02], vai = (r() < 0.5 ? 1 : -1) * (1 - Math.abs(inc) * 0.5), ctrl = [];
    for (i = 0; i < DX.length; i++) ctrl.push([bx + (DX[i] * inc + SW[i] * vai) * alto + (i ? (r() - 0.5) * 0.04 * alto : 0), by - Math.pow(i / (DX.length - 1), 0.95) * alto]);
    // la copa no puede salirse del lienzo: si hay que meterla, la punta del tronco la sigue
    var pwC = w * 0.29, phC = pwC * 0.44, cTop = ctrl[ctrl.length - 1], cxC = clamp(cTop[0] + sg * w * 0.03, M + pwC * 0.62, w - M - pwC * 0.62), dC = cxC - (cTop[0] + sg * w * 0.03);
    ctrl[ctrl.length - 1][0] += dC; ctrl[ctrl.length - 2][0] += dC * 0.5; ctrl[ctrl.length - 3][0] += dC * 0.15;
    var esp = T.curva(ctrl, 14), nE = esp.length;
    function anchoT(t) { return S * lerp(0.09, 0.028, Math.pow(t, 0.7)) * (1 + 0.25 * Math.exp(-t * 8) + 0.6 * Math.exp(-t * 22)) * (1 + 0.07 * Math.sin(t * 15 + sem)) * (1 - 0.55 * suave((t - 0.86) / 0.14)); }
    var anT = esp.map(function (p, j) { return anchoT(j / (nE - 1)); });
    function enT(t) { return esp[Math.round(clamp(t, 0, 1) * (nE - 1))]; }
    var BT = bordes(esp, anT, sem + 1, 0.16), ladoT = ladoSombra(BT);

    // 2 · las ramas y sus almohadillas
    var RAMAS = [
      { t: 0.34, lado: -1, largo: 0.37, sube: -0.015, pad: 1.1 },
      { t: 0.47, lado: 1, largo: 0.34, sube: 0.0, pad: 1.15 },
      { t: 0.65, lado: -1, largo: 0.27, sube: -0.04, pad: 0.9 },
      { t: 0.8, lado: 1, largo: 0.2, sube: -0.04, pad: 0.76 },
      { t: 0.25, lado: 1, largo: 0.22, sube: 0.035, pad: 0.62 }
    ];
    // cuántas almohadillas: siempre la copa; luego, por orden, las ramas 0 y 1, la 2, la 3, una segunda copa y la rama 4
    var nR = [2, 3, 4, 4, 5][nPads - 3], conCopa2 = nPads >= 6, ramas = [], pads = [];
    // una almohadilla cuyo borde de abajo recibe la rama en (ex, ey); claro: hueco sin abanicos (el escondite)
    function ponPad(ex, ey, lado, escala, conClaro) {
      var pw = w * 0.34 * escala * (0.92 + r() * 0.16), ph = pw * (0.36 + r() * 0.06), R = Math.max(Rmin, ph * 0.46);
      var cx = clamp(ex + lado * pw * 0.12, M + pw / 2 + R * 0.7, w - M - pw / 2 - R * 0.7), cy = Math.max(M + ph * 0.6 + R * 0.6, ey - ph * 0.2);
      var P = hacerPad(cx, cy, pw, ph, r, Rmin, (r() - 0.5) * 0.08, conClaro ? [cx - pw * 0.06, cy + ph * 0.06, pw * 0.12, ph * 0.15] : null);
      P.ex = cx - lado * pw * 0.12; P.ey = cy + ph * 0.2; P.lado = lado;
      pads.push(P); return P;
    }
    // el escondite va en la rama baja del lado izquierdo
    var iEsc = sg > 0 ? 0 : 1;
    for (i = 0; i < nR; i++) {
      var RD = RAMAS[i], lado = RD.lado * sg, p0 = enT(RD.t), an0 = anchoT(RD.t) * 0.68;
      var P = ponPad(p0[0] + lado * w * RD.largo * (0.92 + r() * 0.16), p0[1] + RD.sube * h, lado, RD.pad, i === iEsc && op.escondite !== false);
      var ex = P.ex, ey = P.ey, dxr = ex - p0[0];
      // la rama sale casi horizontal, se dobla hacia abajo (el codo del pino) y remonta hacia la almohadilla
      var c2 = [[p0[0] - lado * anchoT(RD.t) * 0.2, p0[1]], [p0[0] + dxr * 0.28, lerp(p0[1], ey, 0.28) + h * (0.025 + r() * 0.02)], [p0[0] + dxr * 0.6, lerp(p0[1], ey, 0.6) + h * (0.014 + r() * 0.016)], [ex, ey]];
      var e2 = T.curva(c2, 12), n2 = e2.length;
      var a2 = e2.map(function (p, j) { var g = j / (n2 - 1); return an0 * lerp(1, 0.3, Math.pow(g, 0.75)) * (1 + 0.35 * Math.exp(-g * 9)); });
      ramas.push({ esp: e2, an: a2, pad: P, an0: an0, desde: anchoT(RD.t) * 0.55 });
    }
    // la copa: la almohadilla de arriba, sobre la punta del tronco, y otra menor al lado (la cima no es un sombrero)
    var cima = esp[nE - 1];
    var PC = hacerPad(cxC, Math.max(M + phC * 0.7, cima[1] - phC * 0.12), pwC, phC, r, Rmin, sg * 0.04);
    PC.ex = cima[0]; PC.ey = cima[1]; pads.push(PC);
    if (conCopa2) {
      var pw2 = pwC * 0.62, PC2 = hacerPad(clamp(PC.x - sg * pwC * 0.5, M + pw2 * 0.62, w - M - pw2 * 0.62), PC.y + phC * 0.55, pw2, pw2 * 0.42, r, Rmin, -sg * 0.05);
      PC2.ex = lerp(cima[0], PC2.x, 0.4); PC2.ey = PC2.y + pw2 * 0.12; pads.push(PC2);
      ramas.push({ esp: T.curva([enT(0.9), [lerp(enT(0.9)[0], PC2.ex, 0.5), lerp(enT(0.9)[1], PC2.ey, 0.3)], [PC2.ex, PC2.ey]], 8), pad: PC2, an0: anchoT(0.9) * 0.3, fina: true });
    }
    // 3 · almohadillas de fondo: más claras (tinta aguada), detrás de las de delante: dan profundidad a la copa
    var gro = Math.max(0.5, S * 0.0028);
    if (op.fondo !== false) {
      var fondo = [], P1 = pads[nR > 1 ? 1 : 0];
      fondo.push(hacerPad(clamp(PC.x - sg * w * 0.16, M + w * 0.14, w - M - w * 0.14), PC.y + h * 0.06, w * 0.26, w * 0.26 * 0.38, r, Rmin, 0));
      fondo.push(hacerPad(clamp(P1.x - P1.lado * w * 0.1, M + w * 0.15, w - M - w * 0.15), P1.y - h * 0.075, w * 0.28, w * 0.28 * 0.38, r, Rmin, 0));
      pintarPads(x, w, h, fondo, { gris: 0.1, gris2: 0.1, k: 0.32, gro: gro, semilla: sem + 40 }, r);
    }

    // 4 · tronco y ramas gruesas: aguada moteada, la sombra, el pincel de lado (vetas secas), corteza, contornos y raíces
    var gruesas = ramas.filter(function (R2) { return !R2.fina; });
    gruesas.forEach(function (R2, j) { R2.B = bordes(R2.esp, R2.an, sem + 7 + j * 13, 0.2); R2.lado = ladoSombra(R2.B); });
    var cajaT = caja(BT.a.concat(BT.b)); gruesas.forEach(function (R2) { var b2 = caja(R2.B.a.concat(R2.B.b)); cajaT = [Math.min(cajaT[0], b2[0]), Math.min(cajaT[1], b2[1]), Math.max(cajaT[2], b2[2]), Math.max(cajaT[3], b2[3])]; });
    aguada(x, w, h, function (c) { c.beginPath(); forma(c, BT); gruesas.forEach(function (R2) { forma(c, R2.B); }); c.fill(); }, { gris: 0.28, nubes: 0.65, grano: 0.35, borde: 1, semilla: sem + 11, caja: cajaT });
    aguada(x, w, h, function (c) {
      c.beginPath(); formaSombra(c, esp, anT, BT, ladoT, 0.05, sem + 2); c.fill();
      c.beginPath(); gruesas.forEach(function (R2, j) { formaSombra(c, R2.esp, R2.an, R2.B, R2.lado, -0.1, sem + 9 + j); }); c.fill();
    }, { gris: 0.42, nubes: 0.5, grano: 0.3, suave: Math.max(1, S * 0.004), borde: 0.6, semilla: sem + 13, caja: cajaT });
    // el pincel de lado: tramos cortos y secos que se solapan a lo largo del tronco (como pasadas de un pincel ancho),
    // más estrechos, más hacia la sombra y más oscuros en cada capa
    var anMax = anT[0];
    [[0, 0.95, 0.22, 0.65], [0.35, 0.55, 0.3, 0.5], [0.66, 0.28, 0.48, 0.35]].forEach(function (pv) {
      for (var f = -r() * 0.15; f < 1; f += 0.2 + r() * 0.12) {
        var k0 = Math.max(0, Math.round(f * (nE - 1))), k1 = Math.min(nE - 1, Math.round((f + 0.3 + r() * 0.12) * (nE - 1))), pts = [];
        for (var m = k0; m <= k1; m++) { var o = ladoT * (pv[0] + (r() - 0.5) * 0.04) * anT[m] * 0.5; pts.push([esp[m][0] + BT.n[m][0] * o, esp[m][1] + BT.n[m][1] * o, anT[m] / anMax]); }
        if (pts.length < 3) continue;
        if (r() < 0.5) pts.reverse();
        T.pincelada(x, pts, { ancho: anMax * pv[1], alfa: pv[2], carga: 1, seco: 0.65, entrada: 0.08, salida: 0.25, rasgado: pv[3], rugoso: 0.3, semilla: Math.floor(r() * 1e6) });
      }
    });
    gruesas.forEach(function (R2) {
      var k0 = indiceEn(R2.B.ls, R2.desde), am = R2.an[k0], pts = R2.esp.slice(k0).map(function (p, m) { var o = R2.lado * 0.25 * R2.an[m + k0] * 0.5; return [p[0] + R2.B.n[m + k0][0] * o, p[1] + R2.B.n[m + k0][1] * o, R2.an[m + k0] / am]; });
      if (pts.length > 2) T.pincelada(x, pts, { ancho: am * 0.75, alfa: 0.38, carga: 1, seco: 0.7, entrada: 0.05, salida: 0.15, rasgado: 0.5, rugoso: 0.3, semilla: Math.floor(r() * 1e6) });
    });
    corteza(x, esp, anT, BT, ladoT, 0.95, S, r, 0.04, 0.95);
    gruesas.forEach(function (R2) { if (R2.an0 > S * 0.026) corteza(x, R2.esp, R2.an, R2.B, R2.lado, 0.7, S, r, R2.desde / R2.B.L, 0.55); });
    // nudos
    var nN = 1 + (r() < 0.5 ? 1 : 0);
    for (i = 0; i < nN; i++) {
      var tn = 0.18 + i * 0.3 + r() * 0.08, kn = Math.round(tn * (nE - 1)), un = -ladoT * (0.05 + r() * 0.3), nn = BT.n[kn], ww = anT[kn];
      nudo(x, esp[kn][0] + nn[0] * un * ww * 0.5, esp[kn][1] + nn[1] * un * ww * 0.5, ww * 0.16 * Math.sqrt(1 - un * un), ww * 0.1, Math.atan2(nn[1], nn[0]), r);
    }
    // contornos: el de la sombra, grueso y oscuro, casi entero; el de la luz, más fino y con huecos
    function perfilar(B, lado, f0, ancho1, ancho2, f1, hu) {
      var s1 = (lado > 0 ? B.a : B.b).map(function (p, m) { var n2 = B.n[m]; return [p[0] - n2[0] * lado * ancho1 * 0.3, p[1] - n2[1] * lado * ancho1 * 0.3]; });
      var s2 = (lado > 0 ? B.b : B.a).map(function (p, m) { var n2 = B.n[m]; return [p[0] + n2[0] * lado * ancho2 * 0.3, p[1] + n2[1] * lado * ancho2 * 0.3]; });
      contorno(x, s1, { ancho: ancho1, alfa: 0.93, seco: 0.55, huecos: hu * 0.4, tramo: 0.6, rasgado: 0.35, desde: f0, hasta: f1 }, r);
      contorno(x, s2, { ancho: ancho2, alfa: 0.88, seco: 0.7, huecos: hu, tramo: 0.45, desde: f0, hasta: f1 }, r);
    }
    perfilar(BT, ladoT, 0.02, S * 0.013, S * 0.0075, 0.985, 0.5);
    gruesas.forEach(function (R2) { perfilar(R2.B, R2.lado, Math.min(0.4, R2.desde / R2.B.L), Math.max(1.1, R2.an0 * 0.24), Math.max(0.8, R2.an0 * 0.13), 0.92, 0.25); });
    // las raíces: el pie se abre (el contorno se curva hacia fuera) y unas líneas finas de garra bajan a la roca
    [-1, 1].forEach(function (ld) {
      var B0 = ld > 0 ? BT.a : BT.b, nrz = 2 + (r() < 0.5 ? 1 : 0);
      for (var j = 0; j < nrz; j++) {
        var k0 = 1 + j * 2 + Math.floor(r() * 2), p0 = B0[k0], fuera = w * (0.025 + r() * 0.03) * (1 - j * 0.3), baja = h * (0.01 + r() * 0.012), pr = [];
        for (var m = 0; m <= 10; m++) { var g = m / 10; pr.push([p0[0] - ld * anT[k0] * 0.12 * (1 - g) + ld * fuera * g, p0[1] + (by - p0[1]) * g * 0.6 + baja * Math.pow(g, 1.5)]); }
        T.pincelada(x, pr, { ancho: Math.max(1, S * (0.007 - j * 0.0015)), alfa: 0.88, carga: 1, seco: 0.6, entrada: 0.05, salida: 0.7, rugoso: 0.4, cerdas: 5, semilla: Math.floor(r() * 1e6) });
      }
    });
    ramas.forEach(function (R2) { if (R2.fina) A.rama(x, R2.esp, Math.max(1.2, R2.an0), { semilla: Math.floor(r() * 1e6), salida: 0.6, blanco: 0, volumen: 0 }); });

    // la punta del tronco se pierde en la copa: se borra con suavidad antes de pintar las agujas
    var gT = x.createRadialGradient(cima[0], cima[1] - phC * 0.05, 0, cima[0], cima[1] - phC * 0.05, phC * 0.45);
    gT.addColorStop(0, 'rgba(0,0,0,0.92)'); gT.addColorStop(0.55, 'rgba(0,0,0,0.6)'); gT.addColorStop(1, 'rgba(0,0,0,0)');
    x.save(); x.globalCompositeOperation = 'destination-out'; x.fillStyle = gT; x.beginPath(); x.arc(cima[0], cima[1] - phC * 0.05, phC * 0.45, 0, TAU); x.fill(); x.restore();

    // 5 · ramitas: del final de la rama suben, en horquilla, hacia los abanicos del medio de la almohadilla
    pads.forEach(function (P2) {
      var cand = P2.ab.filter(function (f) { return f.v === 0.5 && Math.abs(f.x - P2.ex) < P2.w * 0.3; }), nt = Math.min(cand.length, 1 + Math.floor(r() * 2)), gr = Math.max(0.6, S * 0.0022);
      for (var j = 0; j < nt; j++) {
        var f = cand[Math.floor(r() * cand.length)], ox = P2.ex - P2.lado * P2.R * (0.3 + r() * 0.4), oy = P2.ey + P2.R * 0.1, mx = lerp(ox, f.x, 0.5) + (r() - 0.5) * P2.R * 0.3, my = lerp(oy, f.y, 0.65);
        T.pincelada(x, T.curva([[ox, oy], [mx, my], [f.x, f.y]], 6), { ancho: gr * (0.8 + r() * 0.5), alfa: 0.62, carga: 1, seco: 0.5, entrada: 0.03, salida: 0.6, cerdas: 4, rugoso: 0.3, semilla: Math.floor(r() * 1e6) });
      }
    });

    // 5b · brotes: un manojo de dos o tres abanicos en el lomo de las ramas gruesas (el pino echa agujas a lo largo)
    var brotes = [];
    gruesas.forEach(function (R2) {
      if (r() < 0.25) return;
      var g = 0.45 + r() * 0.25, k = Math.round(g * (R2.esp.length - 1)), q = R2.esp[k], n = R2.B.n[k], arriba = n[1] < 0 ? 1 : -1, Rb = Math.max(Rmin, R2.pad.R * 0.6);
      var bx2 = q[0] + n[0] * arriba * R2.an[k] * 0.4, by2 = q[1] + n[1] * arriba * R2.an[k] * 0.4, nf = 2 + Math.floor(r() * 2);
      T.pincelada(x, [[q[0], q[1]], [bx2, by2 - Rb * 0.2]], { ancho: Math.max(0.6, S * 0.0022), alfa: 0.8, carga: 1, seco: 0.4, entrada: 0.05, salida: 0.5, cerdas: 3, semilla: Math.floor(r() * 1e6) });
      for (var j = 0; j < nf; j++) brotes.push({ x: bx2 + (j - (nf - 1) / 2) * Rb * 0.55 + (r() - 0.5) * Rb * 0.2, y: by2 - Rb * (0.15 + r() * 0.2), R: Rb * (0.8 + r() * 0.3), ang: -Math.PI / 2 + (j - (nf - 1) / 2) * 0.45 + (r() - 0.5) * 0.2, abre: 1.15 + r() * 0.25, alfa: 0.8 + r() * 0.15 });
    });
    if (brotes.length) aguada(x, w, h, function (c) { c.beginPath(); brotes.forEach(function (f) { var rr = f.R * 0.6; c.moveTo(f.x + rr, f.y - f.R * 0.3); c.arc(f.x, f.y - f.R * 0.3, rr, 0, TAU); }); c.fill(); }, { gris: 0.16, nubes: 0.5, grano: 0.25, suave: Math.max(1, S * 0.004), semilla: sem + 70, caja: caja(brotes.map(function (f) { return [f.x, f.y - f.R * 0.3]; })).map(function (v, i) { return v + (i < 2 ? -1 : 1) * Math.max.apply(null, brotes.map(function (f) { return f.R; })); }) });
    // puntos de musgo en el tronco: junto al pie y en las axilas de las ramas
    for (i = 0; i < 6; i++) {
      var tm = i < 2 ? 0.03 + r() * 0.08 : RAMAS[Math.min(nR - 1, i - 2)].t + (r() - 0.5) * 0.04, km2 = Math.round(clamp(tm, 0, 1) * (nE - 1)), um = (r() - 0.5) * 1.4;
      punto(x, esp[km2][0] + BT.n[km2][0] * um * anT[km2] * 0.5, esp[km2][1] + BT.n[km2][1] * um * anT[km2] * 0.5, Math.max(0.8, S * (0.003 + r() * 0.003)), r() * 3, r, 0.85);
    }

    // 6 · las almohadillas: aguada (todas a la vez), panza, el hueco del escondite y las agujas
    var EP = pads[Math.min(iEsc, pads.length - 1)];
    var esc = [EP.x - EP.w * 0.06, EP.y + EP.h * 0.06];
    pintarPads(x, w, h, pads, { gris: 0.19, gris2: 0.3, k: 1, gro: gro, semilla: sem + 50, hueco: op.escondite === false ? null : [esc[0], esc[1], EP.w * 0.16, EP.h * 0.22] }, r);
    brotes.forEach(function (f) { abanico(x, f, r, gro, 1); });

    L.base = [bx, by];
    L.pads = pads.map(function (P2) { return { x: P2.x, y: P2.y, w: P2.w, h: P2.h }; });
    L.escondite = esc;
    return L;
  };
  /* ------------------------------------------------------------------ la roca (el acantilado del pino)
     Como en las rocas de tinta: bloques de caras planas, pintados de atrás adelante. En cada bloque, la cara de la luz se
     queda casi en blanco (el papel) y la de sombra, al otro lado de la arista, se llena de golpes «de hacha» (fupi cun):
     pinceladas anchas, cortas, inclinadas y secas, recortadas a su cara, que dejan la arista nítida. El filo de arriba va
     a pincel seco y a tramos, con una franja oscura debajo y grupos de puntos de musgo encima. */
  function dentroPoli(px, py, poli) {
    var c = false;
    for (var i = 0, j = poli.length - 1; i < poli.length; j = i++) { var a = poli[i], b = poli[j]; if ((a[1] > py) !== (b[1] > py) && px < (b[0] - a[0]) * (py - a[1]) / (b[1] - a[1]) + a[0]) c = !c; }
    return c;
  }
  function trazar(c, poli) { c.moveTo(poli[0][0], poli[0][1]); for (var i = 1; i < poli.length; i++) c.lineTo(poli[i][0], poli[i][1]); c.closePath(); }
  function caja(poli) { var b = [1e9, 1e9, -1e9, -1e9]; poli.forEach(function (p) { b[0] = Math.min(b[0], p[0]); b[1] = Math.min(b[1], p[1]); b[2] = Math.max(b[2], p[0]); b[3] = Math.max(b[3], p[1]); }); return b; }
  function area(poli) { var s = 0; for (var i = 0, j = poli.length - 1; i < poli.length; j = i++) s += (poli[j][0] + poli[i][0]) * (poli[j][1] - poli[i][1]); return Math.abs(s / 2); }
  /* Un golpe de hacha: el pincel tumbado deja un canto casi recto (algo torcido respecto a la caída) y se arrastra hacia
     abajo; cada cerda se queda sin tinta a una distancia distinta (las de los lados antes) y alguna deja un hueco: la
     cabeza, cargada y oscura; la cola, seca. Las cerdas no se pintan una a una: se añaden a la capa (Path2D) de su tono,
     y cada capa se rellena de una vez (miles de rellenos sueltos con recorte son muy lentos en WebKit). */
  var TONOS = [0.16, 0.27, 0.4, 0.55, 0.72, 0.9];
  function capaDe(capas, a) { var k = 0; for (var i = 1; i < TONOS.length; i++) if (Math.abs(TONOS[i] - a) < Math.abs(TONOS[k] - a)) k = i; return capas[k]; }
  function hachazo(capas, px, py, a, lon, an, alfa, r) {
    var ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca, tor = (r() < 0.5 ? 1 : -1) * (0.15 + r() * 0.4);
    var n = Math.max(4, Math.round(an / 1.4)), gw = an / n * 1.7, al = alfa * (0.85 + r() * 0.15);
    for (var b = 0; b < n; b++) {
      var o = (b + 0.5) / n - 0.5, d0 = (r() - 0.3) * lon * 0.06, sx = px + nx * o * an + ca * (o * an * tor + d0), sy = py + ny * o * an + sa * (o * an * tor + d0);
      var l = lon * (0.35 + r() * 0.65) * (1 - 0.55 * Math.pow(Math.abs(o) * 2, 2)), corte = r() < 0.5 ? l * (0.3 + r() * 0.45) : l, hueco = l * (0.05 + r() * 0.14);
      if (l < 2) continue;
      var c = capaDe(capas, al * (0.6 + r() * 0.4));
      [[0, corte, 1], [corte + hueco, l, 0.6]].forEach(function (tr) {
        if (tr[1] - tr[0] < 1) return;
        var g0 = gw * (1 - tr[0] / l * 0.75) / 2 * tr[2], g1 = gw * 0.1, x0 = sx + ca * tr[0], y0 = sy + sa * tr[0], x1 = sx + ca * tr[1], y1 = sy + sa * tr[1];
        c.moveTo(x0 + nx * g0, y0 + ny * g0); c.lineTo(x1 + nx * g1, y1 + ny * g1); c.lineTo(x1 - nx * g1, y1 - ny * g1); c.lineTo(x0 - nx * g0, y0 - ny * g0); c.closePath();
      });
    }
  }
  /* Golpes de hacha que nacen de un borde de arriba (el filo, una arista) y bajan por la cara, recortados a ella: en filas,
     la primera pegada al borde (apretada y oscura) y las siguientes más abajo, más sueltas y más claras. Cada fila se
     rellena por capas de tono: las filas que se pisan sí oscurecen.
     op: n (por fila), filas, lon (px), ancho (px), alfa, dir (ángulo de caída) */
  function hachazos(x, cara, borde, op, r) {
    var bd = densificar(borde, 2), ls = longitudes(bd), Lt = ls[ls.length - 1];
    if (Lt < 2) return;
    x.save(); x.beginPath(); trazar(x, cara); x.clip();
    for (var f = 0; f < (op.filas || 1); f++) {
      var capas = TONOS.map(function () { return new Path2D(); });
      for (var i = 0; i < op.n; i++) {
        var q = bd[indiceEn(ls, Lt * (i + 0.2 + r() * 0.6) / op.n)], baja = op.lon * (f * (0.55 + r() * 0.3) + r() * 0.15) - op.ancho * 0.2;
        var a = op.dir + (r() - 0.5) * 0.3, k = 1 + Math.floor(r() * 2), an = op.ancho * (0.7 + r() * 0.6), lon = op.lon * (0.6 + r() * 0.7) * (1 - f * 0.15);
        for (var j = 0; j < k; j++) hachazo(capas, q[0] + Math.cos(a) * baja + Math.cos(a + Math.PI / 2) * an * 0.8 * j, q[1] + Math.sin(a) * baja + Math.sin(a + Math.PI / 2) * an * 0.8 * j, a + (r() - 0.5) * 0.1, lon * (1 - j * 0.25), an * (0.8 + r() * 0.3), op.alfa * Math.pow(0.7, f) * (0.75 + r() * 0.4), r);
      }
      capas.forEach(function (c, i2) { x.fillStyle = T.rgba(TINTA, TONOS[i2]); x.fill(c); });
    }
    x.restore();
  }
  function bloque(x, w, h, Bq, r) {
    var S = Math.min(w, h), poli = Bq.poli, filo = Bq.filo, bb = caja(poli), top = bb[1], j;
    // 1 · tapa lo de detrás (las rocas de delante se ven claras sobre las de atrás)
    x.save(); x.globalCompositeOperation = 'destination-out'; x.fillStyle = 'rgba(0,0,0,0.9)'; x.beginPath(); trazar(x, poli); x.fill(); x.restore();
    // 2 · aguada clara del bloque y la de la cara de sombra, más oscuras arriba
    aguada(x, w, h, function (c) { c.beginPath(); trazar(c, poli); c.fill(); }, { gris: Bq.tono, degradado: [1, 0.35], y0: top, y1: h, nubes: 0.6, grano: 0.35, borde: 0.9, semilla: Bq.sem, caja: bb });
    aguada(x, w, h, function (c) { c.beginPath(); trazar(c, Bq.sombra); c.fill(); }, { gris: Bq.tono * 2, degradado: [1, 0.45], y0: top, y1: h, nubes: 0.5, grano: 0.3, borde: 0.7, semilla: Bq.sem + 2, caja: caja(Bq.sombra) });
    // 3 · franja oscura bajo el filo
    aguada(x, w, h, function (c) {
      c.beginPath(); var fd = densificar(filo, S * 0.02);
      fd.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); });
      for (j = fd.length - 1; j >= 0; j--) c.lineTo(fd[j][0], fd[j][1] + h * (0.02 + 0.07 * T.fbm1(j * 0.15 + Bq.sem, 3, 2)));
      c.closePath(); c.fill();
    }, { gris: Bq.tono * 2.2, nubes: 0.5, grano: 0.3, suave: Math.max(1, S * 0.01), semilla: Bq.sem + 4, caja: [bb[0], bb[1], bb[2], Math.min(h, bb[1] + (bb[3] - bb[1]) * 0.6 + h * 0.1)] });
    // 4 · la meseta: el plano de arriba se queda claro, entre el filo de atrás y el borde de delante
    if (Bq.meseta) {
      var me = Bq.meseta;
      x.save(); x.globalCompositeOperation = 'destination-out';
      aguada(x, w, h, function (c) { c.beginPath(); me.atras.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); for (j = me.delante.length - 1; j >= 0; j--) c.lineTo(me.delante[j][0], me.delante[j][1]); c.closePath(); c.fill(); }, { gris: 0.75, grano: 0.3, suave: Math.max(1, S * 0.005), semilla: Bq.sem + 5, caja: caja(me.atras.concat(me.delante)) });
      x.restore();
    }
    // 5 · golpes de hacha: en la cara de sombra, desde la arista y el filo de ese lado, en tres filas; en la de luz, pocos
    //     y claros desde el filo, y una faceta algo más oscura junto a cada arista secundaria
    var lon = h * 0.17 * Bq.escala, an = h * 0.04 * Bq.escala, pl0 = Bq.pliegues[0], bordeS = pl0.slice(0, 2).reverse().concat(filo.slice(Bq.pliegue));
    hachazos(x, Bq.sombra, bordeS, { n: Math.max(3, Math.round(longitudes(densificar(bordeS, 4)).pop() / (an * 1.2))), filas: 3, lon: lon, ancho: an, alfa: 0.75, dir: Bq.dir }, r);
    var anB = w * 0.045;
    aguada(x, w, h, function (c) { c.beginPath(); c.moveTo(pl0[0][0], pl0[0][1]); pl0.forEach(function (q) { c.lineTo(q[0], q[1]); }); for (j = pl0.length - 1; j >= 0; j--) c.lineTo(pl0[j][0] - Bq.lado * anB * (0.6 + 0.6 * j / pl0.length), pl0[j][1]); c.closePath(); c.fill(); }, { gris: Bq.tono * 1.4, degradado: [1, 0.2], y0: pl0[0][1], y1: pl0[pl0.length - 1][1], nubes: 0.5, grano: 0.3, suave: Math.max(2, S * 0.015), semilla: Bq.sem + 7, caja: [caja(pl0)[0] - anB * 1.3, caja(pl0)[1], caja(pl0)[2] + anB * 1.3, caja(pl0)[3]] });
    var bordeL = filo.slice(0, Bq.pliegue + 1);
    hachazos(x, Bq.luz, bordeL, { n: Math.max(2, Math.round(longitudes(densificar(bordeL, 4)).pop() / (an * 4))), filas: 1, lon: lon * 0.7, ancho: an * 0.75, alfa: 0.3, dir: Bq.dir }, r);
    (Bq.facetas || []).forEach(function (fc, i) {
      var ar = Bq.pliegues[i + 1];
      aguada(x, w, h, function (c) { c.beginPath(); trazar(c, fc); c.fill(); }, { gris: Bq.tono * 0.9, degradado: [1, 0.2], y0: caja(fc)[1], y1: caja(fc)[3], nubes: 0.5, grano: 0.3, semilla: Bq.sem + 9, caja: caja(fc) });
      if (ar) hachazos(x, fc, ar, { n: 3, filas: 2, lon: lon * 0.75, ancho: an * 0.8, alfa: 0.42, dir: Bq.dir }, r);
    });
    // 6 · contornos: el filo (grueso, oscuro, a tramos), las aristas y algún costado (finos, se pierden hacia abajo)
    contorno(x, densificar(filo, 2), { ancho: S * 0.013 * Bq.peso, alfa: 0.93, seco: 0.6, huecos: 0.35, tramo: 0.35, rasgado: 0.4, presion: 0.55 }, r);
    (Bq.pliegues || []).forEach(function (pl, i) { contorno(x, densificar(pl, 2), i ? { ancho: S * 0.005 * Bq.peso, alfa: 0.7, seco: 0.8, huecos: 0.65, tramo: 0.35, rasgado: 0.45, hasta: 0.45 + r() * 0.2, alReves: false } : { ancho: S * 0.008 * Bq.peso, alfa: 0.85, seco: 0.7, huecos: 0.5, tramo: 0.45, rasgado: 0.35, hasta: 0.7 + r() * 0.25, alReves: false }, r); });
    (Bq.costados || []).forEach(function (cs) { contorno(x, densificar(cs, 2), { ancho: S * 0.006 * Bq.peso, alfa: 0.78, seco: 0.8, huecos: 0.6, tramo: 0.45, hasta: 0.5 + r() * 0.35, alReves: false }, r); });
    if (Bq.meseta) contorno(x, densificar(Bq.meseta.delante, 2), { ancho: S * 0.0065, alfa: 0.75, seco: 0.75, huecos: 0.5, tramo: 0.35 }, r);
    // 7 · musgo: grupos de puntos sobre el filo, más en los salientes
    var fd2 = densificar(filo, 2), Lf = longitudes(fd2), nM = Math.round(Lf[Lf.length - 1] / (S * 0.1) * Bq.musgo);
    for (j = 0; j < nM; j++) {
      var q = fd2[Math.floor(Math.pow(r(), 0.9) * fd2.length)];
      musgo(x, q[0], q[1] + S * 0.003, S * (0.016 + r() * 0.016), 3 + Math.floor(r() * 6), r, 0.92);
    }
    // y matas de musgo más grandes en las esquinas (los vértices del filo que sobresalen)
    for (j = 1; j < filo.length - 1; j++) if (r() < 0.45 * Bq.musgo) musgo(x, filo[j][0], filo[j][1] + S * 0.004, S * (0.03 + r() * 0.02), 6 + Math.floor(r() * 6), r, 0.95);
  }

  A.roca = function (w, h, op) {
    op = op || {};
    var L = T.lienzo(w, h), x = L.x, sem = op.semilla == null ? 5 : op.semilla, r = T.azar(sem * 6271 + 3), S = Math.min(w, h), esp = (op.sombra || 1) < 0, j;
    function P(u, v) { return [(esp ? 1 - u : u) * w, v * h]; }
    function J(a) { return (r() - 0.5) * a; }
    function filoEn(f, u) { for (var k = 0; k < f.length - 1; k++) if (f[k][0] <= u && f[k + 1][0] >= u) return lerp(f[k][1], f[k + 1][1], (u - f[k][0]) / (f[k + 1][0] - f[k][0])); return 1; }
    // los bloques en unidades (u de 0 a 1 en w, v de 0 a 1 en h), de atrás adelante: filo de izquierda a derecha,
    // pie (u izquierda, u derecha), pliegue (vértice del filo del que baja la arista de sombra), meseta (vértices del plano de arriba)
    var DEF = [
      { filo: [[0.05, 0.76], [0.075, 0.56], [0.13, 0.5], [0.165, 0.33], [0.23, 0.26], [0.275, 0.13], [0.33, 0.085], [0.43, 0.068], [0.53, 0.075], [0.58, 0.105], [0.61, 0.2], [0.645, 0.27], [0.67, 0.45], [0.7, 0.62]], pie: [0.03, 0.74], pliegue: 9, tono: 0.21, meseta: [6, 8], peso: 1.15, musgo: 1.4, escala: 1, aristas: [3, 5] },
      { filo: [[0.21, 0.92], [0.23, 0.7], [0.3, 0.6], [0.44, 0.535], [0.49, 0.57], [0.53, 0.75], [0.555, 0.95]], pie: [0.19, 0.58], pliegue: 3, tono: 0.17, peso: 0.9, musgo: 1, escala: 0.7, aristas: [] },
      { filo: [[0.6, 0.56], [0.63, 0.43], [0.69, 0.37], [0.76, 0.375], [0.8, 0.44], [0.86, 0.5], [0.92, 0.66], [0.97, 0.9]], pie: [0.58, 0.995], pliegue: 3, tono: 0.2, peso: 1, musgo: 1.2, escala: 0.85, aristas: [] },
      { filo: [[0.0, 0.9], [0.025, 0.68], [0.13, 0.595], [0.18, 0.61], [0.235, 0.74], [0.265, 0.92]], pie: [0.0, 0.28], pliegue: 2, tono: 0.12, peso: 0.85, musgo: 0.8, escala: 0.6 },
      { filo: [[0.665, 0.93], [0.7, 0.81], [0.77, 0.78], [0.83, 0.83], [0.865, 0.94]], pie: [0.65, 0.875], pliegue: 2, tono: 0.12, peso: 0.75, musgo: 0.6, escala: 0.45 }
    ];
    var filos = [];
    DEF.forEach(function (D, bi) {
      // el filo con algo de azar (las rocas de tinta son angulosas: sin suavizar)
      var fU = D.filo.map(function (p, i) { return [p[0] + (i ? J(0.01) : 0), p[1] + J(0.02)]; }), vp = fU[D.pliegue];
      var plU = [vp, [vp[0] - 0.025 + J(0.02), lerp(vp[1], 1, 0.35)], [vp[0] - 0.012 + J(0.02), lerp(vp[1], 1, 0.7)], [vp[0] + J(0.01), 1.0]];
      var filo = fU.map(function (p) { return P(p[0], p[1]); }), pl = plU.map(function (p) { return P(p[0], p[1]); });
      var poli = [P(D.pie[0], 1.0)].concat(filo, [P(D.pie[1], 1.0)]);
      var sombra = pl.slice().reverse().concat(filo.slice(D.pliegue + 1), [P(D.pie[1], 1.0)]);
      var luz = [P(D.pie[0], 1.0)].concat(filo.slice(0, D.pliegue), pl);
      // aristas secundarias: bajan de algunos vértices del lado de la luz
      var pliegues = [pl];
      var facetas = [];
      for (var i = 2; i < D.pliegue - 1; i++) if (D.aristas ? D.aristas.indexOf(i) >= 0 : r() < 0.35) {
        var v0 = fU[i], arU = [v0, [v0[0] - 0.012 + J(0.015), lerp(v0[1], 1, 0.3)], [v0[0] + J(0.02), lerp(v0[1], 1, 0.6)]], ar = arU.map(function (q) { return P(q[0], q[1]); });
        pliegues.push(ar);
        // la faceta: de la arista hacia el lado de sombra, hasta la mitad del tramo de filo siguiente
        var v1 = fU[i + 1], anF = Math.min(0.09, (v1[0] - v0[0]) * 0.9 + 0.03);
        facetas.push(ar.concat([P(arU[2][0] + anF * 0.6, arU[2][1] + 0.05), P(arU[1][0] + anF, arU[1][1]), P(lerp(v0[0], v1[0], 0.7), lerp(v0[1], v1[1], 0.7))]));
      }
      var costados = [[filo[0], P(D.pie[0], 1.0)], [filo[filo.length - 1], P(D.pie[1], 1.0)]];
      var meseta = null;
      if (D.meseta) {
        var at = filo.slice(D.meseta[0] - 1, D.meseta[1] + 2), de = at.map(function (p, ii) { var f = ii / (at.length - 1); return [p[0], p[1] + h * (0.03 + 0.015 * Math.sin(f * Math.PI)) * Math.sin(Math.min(1, Math.min(f, 1 - f) * 4) * Math.PI / 2)]; });
        meseta = { atras: densificar(at, 3), delante: densificar(de, 3) };
      }
      bloque(x, w, h, { poli: poli, filo: filo, pliegue: D.pliegue, sombra: sombra, luz: luz, facetas: facetas, pliegues: pliegues, costados: costados, dir: esp ? Math.PI / 2 + 0.35 : Math.PI / 2 - 0.35, lado: esp ? -1 : 1, tono: D.tono, peso: D.peso, musgo: D.musgo, escala: D.escala, meseta: meseta, sem: sem * 13 + bi * 7 }, r);
      filos.push(filo);
    });
    // matas de hierba sobre la meseta y el escalón, y unas salpicaduras
    [[0.3, 0], [0.57, 0], [0.73, 2], [0.36, 1]].forEach(function (m) {
      var u = m[0] + J(0.03), q = P(u, filoEn(DEF[m[1]].filo, u) + 0.012);
      mata(x, q[0], q[1], S * (0.06 + r() * 0.04), r, 0.88);
    });
    for (j = 0; j < 3; j++) { var qs = P(0.2 + r() * 0.6, 0.15 + r() * 0.4); T.salpicar(x, qs[0], qs[1], S * 0.06, { n: 5 + Math.floor(r() * 6), semilla: Math.floor(r() * 1e6), alfa: 0.8, max: S * 0.006 }); }
    // el pie se funde con el suelo
    x.save(); x.globalCompositeOperation = 'destination-out';
    var gF = x.createLinearGradient(0, h * 0.86, 0, h); gF.addColorStop(0, 'rgba(0,0,0,0)'); gF.addColorStop(1, 'rgba(0,0,0,1)');
    x.fillStyle = gF; x.fillRect(0, h * 0.86, w, h * 0.14); x.restore();
    // anclajes: el pie del pino en la meseta (algo por delante del filo de atrás) y el perfil de arriba
    var f0 = DEF[0].filo, mU = (f0[6][0] + f0[8][0]) / 2, mq = P(mU, filoEn(f0, mU) + 0.022);
    L.cima = [mq[0], mq[1]];
    // el perfil de arriba: en cada x, el filo más alto de todos los bloques (cada ~w/60 px)
    var cimas = [];
    for (var cx = 0; cx <= w; cx += w / 60) {
      var yt = null;
      filos.forEach(function (f) { for (var k = 0; k < f.length - 1; k++) { var a = f[k], b = f[k + 1], x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]); if (cx >= x0 && cx <= x1 && x1 > x0) { var yy = lerp(a[1], b[1], (cx - a[0]) / (b[0] - a[0])); if (yt == null || yy < yt) yt = yy; } } });
      if (yt != null) cimas.push([cx, yt]);
    }
    L.cimas = cimas;
    return L;
  };
  /* ------------------------------------------------------------------ la isla (Ganryūjima, vista desde lejos)
     Una loma baja de cima casi plana sobre la línea del agua: aguada gris más oscura abajo (la orilla mojada), una franja
     negra en la línea del agua, el filo de arriba a pincel seco, golpes de hacha pequeños en la ladera de sombra, musgo,
     dos pinos (uno grande y otro menor) y arbolitos, rocas en la orilla; debajo, un reflejo muy claro que solo asoma en
     rayitas sueltas (las ondas) y dos o tres trazos de agua.
     A.isla(w, h, op) → lienzo con agua (y de la línea del agua; el borde de la isla es recto ahí), cima [x,y] (lo alto
     de la loma, donde está el pino) y pinos [[x,y],…] (pie de cada pino). op: semilla, tono (0…1: más claro = más lejos),
     sombra (1 / −1) */
  A.islaPasos = function* (w, h, op) {
    op = op || {};
    var L = T.lienzo(w, h), x = L.x, sem = op.semilla == null ? 8 : op.semilla, r = T.azar(sem * 4513 + 9), S = Math.min(w, h), tono = op.tono == null ? 1 : op.tono;
    var agua = Math.round(h * 0.8), alto = h * 0.3, esp = (op.sombra || 1) < 0, j;
    function P(u, v) { return [(esp ? 1 - u : u) * w, agua - (1 - v) * alto]; }
    function J(a) { return (r() - 0.5) * a; }
    // la loma: filo de izquierda a derecha (v = 1 en el agua, 0 en lo más alto)
    var fU = [[0.05, 1], [0.1, 0.66], [0.17, 0.42], [0.26, 0.24], [0.36, 0.12], [0.47, 0.08], [0.56, 0.1], [0.63, 0.2], [0.69, 0.08], [0.75, 0.13], [0.82, 0.4], [0.89, 0.72], [0.95, 1]].map(function (p, i, a) { return [p[0] + (i && i < a.length - 1 ? J(0.015) : 0), p[1] + (i && i < a.length - 1 ? J(0.06) : 0)]; });
    var filo = fU.map(function (p) { return P(p[0], p[1]); }), pl = 8;
    var vp = fU[pl], plU = [vp, [vp[0] - 0.02, 0.45], [vp[0] - 0.005, 0.8], [vp[0] + 0.01, 1.02]], pls = plU.map(function (p) { return P(p[0], p[1]); });
    var poli = filo.concat([P(fU[fU.length - 1][0], 1.02), P(fU[0][0], 1.02)]);
    var sombra = pls.slice().reverse().concat(filo.slice(pl + 1));
    x.save(); x.beginPath(); x.rect(0, 0, w, agua); x.clip();
    // 1 · aguada: más oscura hacia el agua; la ladera de sombra, más
    aguada(x, w, h, function (c) { c.beginPath(); trazar(c, poli); c.fill(); }, { gris: 0.26 * tono, degradado: [0.6, 1], y0: agua - alto, y1: agua, nubes: 0.55, grano: 0.3, borde: 0.8, semilla: sem });
    aguada(x, w, h, function (c) { c.beginPath(); trazar(c, sombra); c.fill(); }, { gris: 0.24 * tono, degradado: [0.8, 1], y0: agua - alto, y1: agua, nubes: 0.5, grano: 0.3, suave: Math.max(1, S * 0.01), semilla: sem + 2 });
    yield 'isla 2';
    // 2 · la orilla: una franja oscura sobre la línea del agua que se pierde hacia arriba
    aguada(x, w, h, function (c) {
      c.beginPath(); c.moveTo(filo[0][0], agua + 2);
      for (j = 0; j <= 40; j++) { var u = lerp(fU[0][0], fU[fU.length - 1][0], j / 40), q = P(u, 1); c.lineTo(q[0], agua - h * (0.025 + 0.04 * T.fbm1(u * 9, sem + 3, 2))); }
      c.lineTo(filo[filo.length - 1][0], agua + 2); c.closePath(); c.fill();
    }, { gris: 0.6 * tono, nubes: 0.4, grano: 0.25, suave: Math.max(1, S * 0.012), semilla: sem + 4 });
    yield 'isla 3';
    // 3 · golpes de hacha pequeños en la ladera de sombra (desde el filo) y alguno en la de luz
    var lon = alto * 0.45, an = alto * 0.1;
    hachazos(x, sombra, pls.slice(0, 2).reverse().concat(filo.slice(pl)), { n: 7, filas: 2, lon: lon, ancho: an, alfa: 0.5 * tono, dir: esp ? Math.PI / 2 + 0.3 : Math.PI / 2 - 0.3 }, r);
    hachazos(x, poli, filo.slice(1, pl), { n: 4, filas: 1, lon: lon * 0.7, ancho: an * 0.8, alfa: 0.25 * tono, dir: esp ? Math.PI / 2 + 0.3 : Math.PI / 2 - 0.3 }, r);
    yield 'isla 4';
    // 4 · el filo y la arista, a pincel seco
    contorno(x, densificar(filo, 2), { ancho: Math.max(1, S * 0.012), alfa: 0.85 * tono, seco: 0.65, huecos: 0.4, tramo: 0.3, rasgado: 0.3 }, r);
    contorno(x, densificar(pls, 2), { ancho: Math.max(0.8, S * 0.008), alfa: 0.7 * tono, seco: 0.75, huecos: 0.5, tramo: 0.5, hasta: 0.7, alReves: false }, r);
    x.restore();
    yield 'isla 5';
    // 5 · los pinos: uno grande en lo alto (a la izquierda de la cima) y otro menor; arbolitos lejanos por el filo
    function filoEn(u) { for (var k = 0; k < fU.length - 1; k++) if (fU[k][0] <= u && fU[k + 1][0] >= u) return lerp(fU[k][1], fU[k + 1][1], (u - fU[k][0]) / (fU[k + 1][0] - fU[k][0])); return 1; }
    var pinos = [], pSpec = [[0.42, h * 0.5, 0.35, 4], [0.6, h * 0.36, -0.3, 3]];
    pSpec.forEach(function (ps, i) {
      var hp = Math.round(ps[1]), q = P(ps[0] + J(0.02), filoEn(ps[0]) + 0.05), pi = A.pino(Math.round(hp * 1.1), hp, { semilla: sem * 7 + i, inclina: (esp ? -1 : 1) * ps[2], pads: ps[3], fondo: false, alto: 0.55, escondite: false });
      x.save(); x.globalAlpha = tono; x.drawImage(pi.c, q[0] - pi.base[0], q[1] - pi.base[1]); x.restore();
      pinos.push(q);
    });
    for (j = 0; j < 4; j++) { var ua = 0.2 + r() * 0.6, qa = P(ua, filoEn(ua)); if (Math.abs(ua - 0.42) < 0.06 || Math.abs(ua - 0.6) < 0.05) continue; A.arbolito(x, qa[0], qa[1] + 1, alto * (0.18 + r() * 0.12), 0.85 * tono, r); }
    yield 'isla 6';
    // 6 · musgo en el filo
    var fd = densificar(filo, 2);
    for (j = 0; j < 7; j++) { var qm = fd[Math.floor(r() * fd.length)]; if (qm[1] < agua - 3) musgo(x, qm[0], qm[1] + 1, S * 0.03, 3 + Math.floor(r() * 4), r, 0.85 * tono); }
    yield 'isla 7';
    // 7 · rocas en la orilla
    var rocas = [[0.04, 0.06, 0.5], [0.09, 0.04, 0.35], [0.9, 0.05, 0.45], [0.985, 0.03, 0.3], [0.2, 0.025, 0.22]];
    rocas.forEach(function (rc, i) {
      var cx = (esp ? 1 - rc[0] : rc[0]) * w + J(w * 0.01), rw = w * rc[1], rh = alto * rc[2], pts = [[cx - rw, agua], [cx - rw * 0.7, agua - rh * 0.7], [cx - rw * 0.2 + J(rw * 0.2), agua - rh], [cx + rw * 0.4, agua - rh * 0.85], [cx + rw, agua]];
      x.save(); x.beginPath(); x.rect(0, 0, w, agua); x.clip();
      aguada(x, w, h, function (c) { c.beginPath(); trazar(c, pts); c.fill(); }, { gris: 0.55 * tono, nubes: 0.4, grano: 0.25, borde: 0.8, semilla: sem + 20 + i });
      x.restore();
      contorno(x, densificar(pts.slice(0, 4), 1.5), { ancho: Math.max(0.8, S * 0.008), alfa: 0.85 * tono, seco: 0.6, huecos: 0.3, tramo: 0.6 }, r);
    });
    yield 'isla 8';
    // 8 · la línea del agua: un trazo largo y seco, recto, que pasa bajo la isla
    var la = [[filo[0][0] - w * 0.03, agua + 0.5], [filo[filo.length - 1][0] + w * 0.03, agua + 0.5]];
    T.pincelada(x, densificar(la, 3), { ancho: Math.max(1.2, S * 0.018), alfa: 0.8 * tono, carga: 0.9, seco: 0.7, entrada: 0.05, salida: 0.3, rasgado: 0.35, semilla: sem + 30 });
    yield 'isla 9';
    // 9 · el reflejo: la loma invertida, muy clara, que solo se ve en rayitas horizontales sueltas (las ondas)
    var R = trabajo(w, h), O = trabajo(w, h);
    aguada(R.x, w, h, function (c) { c.beginPath(); c.moveTo(poli[0][0], 2 * agua - poli[0][1]); poli.forEach(function (p) { c.lineTo(p[0], 2 * agua - p[1]); }); c.closePath(); c.fill(); }, { gris: 1, degradado: [1, 0], y0: agua, y1: agua + alto * 0.8, grano: 0.2, semilla: sem + 33 });
    O.x.fillStyle = '#000';
    for (j = 0; j < 46; j++) { var yo = agua + 2 + Math.pow(r(), 1.3) * alto * 0.75, xo = filo[0][0] + r() * (filo[filo.length - 1][0] - filo[0][0]), lo = w * (0.03 + r() * 0.12), go = Math.max(0.8, alto * (0.02 + r() * 0.025)); O.x.beginPath(); O.x.ellipse(xo, yo, lo / 2, go / 2, 0, 0, TAU); O.x.fill(); }
    R.x.globalCompositeOperation = 'destination-in'; R.x.drawImage(O.c, 0, 0, w, h, 0, 0, w, h);
    x.save(); x.globalAlpha = 0.3 * tono; x.drawImage(R.c, 0, 0, w, h, 0, 0, w, h); x.restore();
    // 10 · dos o tres trazos de agua, cortos y secos
    for (j = 0; j < 3; j++) {
      var y0 = agua + h * (0.05 + j * 0.05 + r() * 0.02), x0 = w * (0.12 + r() * 0.55), lw = w * (0.12 + r() * 0.16), pa = [];
      for (var m = 0; m <= 10; m++) pa.push([x0 + lw * m / 10, y0 + Math.sin(m / 10 * Math.PI) * h * 0.006]);
      T.pincelada(x, pa, { ancho: Math.max(1, S * 0.016), alfa: 0.4 * tono, carga: 0.8, seco: 0.8, entrada: 0.1, salida: 0.4, rasgado: 0.5, semilla: Math.floor(r() * 1e6) });
    }
    L.agua = agua;
    var c0 = P(0.47, filoEn(0.47));
    L.cima = [c0[0], c0[1]];
    L.pinos = pinos;
    return L;
  };
  A.isla = function (w, h, op) { var g = A.islaPasos(w, h, op), p = g.next(); while (!p.done) p = g.next(); return p.value; };
})();
