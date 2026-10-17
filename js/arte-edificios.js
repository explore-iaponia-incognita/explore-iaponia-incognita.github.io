/* Iaponia Incognita · arte de edificios
   El castillo (como el de Himeji), la pagoda de cinco pisos, el torii bermellón, la linterna de piedra y el junco de la
   flota mongola, pintados con el motor de tinta (SA.tinta) como lo haría un pintor: los muros son el papel con una aguada
   gris en el lado de la sombra; los tejados, una aguada con el alero de un solo trazo oscuro que se levanta en las puntas
   (con su halo de tinta corrida); y el pie se pierde en la niebla. Cada función devuelve un lienzo { c, x, w, h } de
   fondo transparente y su anclaje. Todo sale de la semilla: misma semilla, mismo dibujo. */
(function () {
  'use strict';
  var SA = window.SA, T = SA.tinta, A = SA.arte, TAU = Math.PI * 2;
  var TINTA = T.color.tinta, rgba = T.rgba;
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sem(r) { return Math.floor(r() * 1e9) + 1; }
  function papelDe(op) { return op.papel || (SA.color && SA.color.papel) || T.color.papel; }

  /* ------------------------------------------------------------------ el taller: lienzos de trabajo prestados
     WebKit pone un tope a la memoria de los lienzos y el recolector la devuelve tarde: si cada aguada creara los suyos
     (como T.aguada y T.desenfocar), al pintar muchas piezas seguidas los últimos lienzos saldrían vacíos. Aquí los de
     trabajo se piden prestados por nombre y se reutilizan (se limpian al prestarlos); cada pieza solo crea el suyo.
     Además se trabaja con 8 px de margen a la derecha y abajo, y lo que el desenfoque arrastre al borde cae fuera. */
  var MG = 8, TALLER = {};
  function prestado(clave, w, h) {
    w = Math.max(1, Math.ceil(w)); h = Math.max(1, Math.ceil(h));
    var L = TALLER[clave];
    // siempre con 4 px vacíos de más: al ampliar o reducir una parte, el suavizado lee del borde lo mismo (transparente)
    // tenga el lienzo el tamaño que tenga; así el dibujo no depende de lo que se pintó antes
    if (!L || L.w < w + 4 || L.h < h + 4) {
      var nw = Math.max(w + 4, L ? L.w : 0), nh = Math.max(h + 4, L ? L.h : 0);
      L = TALLER[clave] = T.lienzo(nw, nh);
    }
    var x = L.x; x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, L.w, L.h);
    x.fillStyle = '#000'; x.strokeStyle = '#000'; x.lineWidth = 1; x.lineCap = 'round'; x.lineJoin = 'round'; x.imageSmoothingEnabled = true;
    L.uw = w; L.uh = h;   // la parte que se usa (el lienzo puede ser mayor)
    return L;
  }
  // devuelve la memoria del taller (por ejemplo, después de pintar todas las piezas)
  // (solo suelta las referencias: encoger a 0 un lienzo que otro dibujo pendiente aún usa cuelga WebKit al pintar ese dibujo)
  A.soltarTaller = function () { TALLER = {}; };
  function capa(w, h, clave) { return prestado(clave || 'K', w + MG, h + MG); }
  // un lienzo de trabajo propio (como «capa», pero sin compartir): para lo que se usa de un paso a otro de un pintor por pasos
  function propia(w, h) { var L = T.lienzo(w + MG + 4, h + MG + 4); L.uw = w + MG; L.uh = h + MG; return L; }
  function correr(g) { var p = g.next(); while (!p.done) p = g.next(); return p.value; }
  // desenfoque reduciendo y ampliando (como T.desenfocar), con lienzos prestados; devuelve el lienzo «o» (vale hasta el próximo)
  function desenfoca(src, w, h, radio) {
    var k = Math.max(1, Math.round(radio)), sw = Math.max(1, Math.round(w / k)), sh = Math.max(1, Math.round(h / k)), bw = Math.max(1, sw >> 1), bh = Math.max(1, sh >> 1);
    var a = prestado('a', sw, sh), b = prestado('b', bw, bh), o = prestado('o', w, h);
    a.x.imageSmoothingQuality = 'high'; a.x.drawImage(src.c, 0, 0, w, h, 0, 0, sw, sh);
    b.x.drawImage(a.c, 0, 0, sw, sh, 0, 0, bw, bh);
    a.x.clearRect(0, 0, sw, sh); a.x.drawImage(b.c, 0, 0, bw, bh, 0, 0, sw, sh);
    o.x.imageSmoothingQuality = 'high'; o.x.drawImage(a.c, 0, 0, sw, sh, 0, 0, w, h);
    return o;
  }
  /* Aguada: lo mismo que T.aguada (forma en negro, degradado de niebla, moteado, grano, desenfoque y borde húmedo, con
     los mismos parámetros), pero en el taller y con el margen. op.caja = [x0, y0, x1, y1]: trabaja solo en ese recuadro
     (mucho más rápido para formas pequeñas; el moteado queda en el mismo sitio que sin caja). */
  function aguada(ctx, w, h, forma, op) {
    op = op || {};
    var ox = 0, oy = 0, H0 = h, cj = op.caja;
    if (cj) { ox = Math.max(0, Math.floor(cj[0])); oy = Math.max(0, Math.floor(cj[1])); w = Math.min(w, Math.ceil(cj[2])) - ox; h = Math.min(h, Math.ceil(cj[3])) - oy; if (w <= 0 || h <= 0) return; }
    w = Math.ceil(w) + MG; h = Math.ceil(h) + MG;
    var F = prestado('F', w, h), x = F.x;
    if (ox || oy) x.translate(-ox, -oy);
    forma(x, F);
    x.setTransform(1, 0, 0, 1, 0, 0);
    if (op.degradado) {
      var g = x.createLinearGradient(0, (op.y0 == null ? 0 : op.y0) - oy, 0, (op.y1 == null ? H0 : op.y1) - oy);
      g.addColorStop(0, 'rgba(0,0,0,' + op.degradado[0] + ')'); g.addColorStop(1, 'rgba(0,0,0,' + op.degradado[1] + ')');
      x.globalCompositeOperation = 'destination-in'; x.fillStyle = g; x.fillRect(0, 0, w, h); x.globalCompositeOperation = 'source-over';
    }
    var desp = ((((op.ox || 0) + (op.semilla || 0) * 97) % 512) + 512) % 512;
    if (op.nubes) { var tn = T.textura('nubes', 512, 3, 4, 1.4, 21, false); x.save(); x.globalCompositeOperation = 'destination-out'; x.globalAlpha = op.nubes; x.fillStyle = x.createPattern(tn.c, 'repeat'); x.translate(-desp - ox, -oy); x.fillRect(desp + ox, oy, w, h); x.restore(); }
    if (op.grano !== 0) { var tg = T.textura('granulado', 256, 48, 2, 1.8, 9, false); x.save(); x.globalCompositeOperation = 'destination-out'; x.globalAlpha = op.grano == null ? 0.22 : op.grano; x.fillStyle = x.createPattern(tg.c, 'repeat'); x.translate(-desp - ox, -oy); x.fillRect(desp + ox, oy, w, h); x.restore(); }
    var gris = op.gris == null ? 0.35 : op.gris, S2 = op.suave ? desenfoca(F, w, h, op.suave) : F;
    ctx.save();
    ctx.globalAlpha = gris; ctx.drawImage(S2.c, 0, 0, w, h, ox, oy, w, h);
    if (op.borde) { ctx.globalAlpha = gris * op.borde * 0.6; ctx.drawImage(F.c, 0, 0, w, h, ox, oy, w, h); }
    ctx.restore();
  }
  // la tinta oscura con su halo (nijimi): la capa desenfocada y clara debajo, la capa nítida encima
  function conHalo(ctx, K, radio, alfa) {
    var w = K.uw || K.w, h = K.uh || K.h;
    if (radio >= 1) { var B = desenfoca(K, w, h, radio); ctx.save(); ctx.globalAlpha = alfa; ctx.drawImage(B.c, 0, 0, w, h, 0, 0, w, h); ctx.restore(); }
    ctx.drawImage(K.c, 0, 0, w, h, 0, 0, w, h);
  }
  // una pincelada con los valores de una línea de dibujo
  function trazo(x, pts, ancho, alfa, r, op) {
    op = op || {};
    T.pincelada(x, pts, { ancho: ancho, alfa: alfa, color: op.color, carga: op.carga == null ? 0.95 : op.carga, seco: op.seco == null ? 0.4 : op.seco,
      entrada: op.entrada == null ? 0.08 : op.entrada, salida: op.salida == null ? 0.3 : op.salida, rugoso: op.rugoso == null ? 0.22 : op.rugoso,
      cerdas: op.cerdas, semilla: sem(r), rasgado: op.rasgado, soloCerdas: op.soloCerdas, pelo: op.pelo });
  }
  // de a a b a mano: un temblor leve y, si se pide, el pincel que se levanta a tramos
  function recta(x, a, b, ancho, alfa, r, op) {
    op = op || {};
    var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    var n = Math.max(3, Math.ceil(l / 4)), amp = op.temblor == null ? 0.25 + ancho * 0.1 : op.temblor, s = r() * 100, pts = [], i;
    for (i = 0; i <= n; i++) { var t = i / n, j = (T.fbm1(t * l / 26 + s, 5, 2) - 0.5) * 2 * amp; pts.push([a[0] + dx * t + nx * j, a[1] + dy * t + ny * j]); }
    if (!op.tramos) { trazo(x, pts, ancho, alfa, r, op); return; }
    var cortes = [], k = 1 + Math.floor(r() * 2), ini = 0;
    for (i = 0; i < k; i++) cortes.push(0.2 + r() * 0.6);
    cortes.sort();
    cortes.concat([1.2]).forEach(function (c) {
      var hueco = 0.04 + r() * 0.08, a0 = Math.floor(ini * n), a1 = Math.min(n, Math.floor(Math.min(1, c - hueco / 2) * n));
      if (a1 - a0 >= 2) trazo(x, pts.slice(a0, a1 + 1), ancho, alfa * (0.75 + r() * 0.25), r, op);
      ini = c + hueco / 2;
    });
  }
  // marcas pequeñas y baratas (juntas de piedra, tejas, listones): curvas [x0, y0, x1, y1, cx, cy] en un solo camino
  function marcas(x, lista, ancho, col, alfa) {
    x.save(); x.strokeStyle = rgba(col || TINTA, alfa); x.lineWidth = ancho; x.lineCap = 'round'; x.beginPath();
    lista.forEach(function (m) { x.moveTo(m[0], m[1]); x.quadraticCurveTo(m[4], m[5], m[2], m[3]); });
    x.stroke(); x.restore();
  }
  // aguada de color: la forma con la textura de la aguada (moteado, grano), teñida de «col»
  function aguadaColor(ctx, w, h, forma, col, op) {
    var cj = op.caja, ox = cj ? Math.max(0, Math.floor(cj[0])) : 0, oy = cj ? Math.max(0, Math.floor(cj[1])) : 0;
    var rw = (cj ? Math.min(w, Math.ceil(cj[2])) - ox : w) + MG, rh = (cj ? Math.min(h, Math.ceil(cj[3])) - oy : h) + MG, R = prestado('R', rw, rh), o2 = {};
    for (var k in op) if (k !== 'caja') o2[k] = op[k];
    aguada(R.x, rw - MG, rh - MG, function (c, F) { c.translate(-ox, -oy); forma(c, F); c.translate(ox, oy); }, o2);
    R.x.globalCompositeOperation = 'source-in'; R.x.fillStyle = rgba(col, 1); R.x.fillRect(0, 0, rw, rh);
    ctx.drawImage(R.c, 0, 0, rw, rh, ox, oy, rw, rh);
  }
  // veladura: aclara lo ya pintado hacia el papel (la distancia, la niebla) sin tocar lo transparente
  function veladura(L, pap, a, y0, y1) {
    var x = L.x; x.save(); x.globalCompositeOperation = 'source-atop';
    if (y0 == null) x.fillStyle = rgba(pap, a);
    else { var g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, rgba(pap, a[0])); g.addColorStop(1, rgba(pap, a[1])); x.fillStyle = g; }
    x.fillRect(0, 0, L.w, L.h); x.restore();
  }
  // jirones de niebla: elipses horizontales difusas (en negro, para usarlas de máscara)
  function jirones(m, n, x0, x1, y0, y1, rx, ry, a, r) {
    for (var i = 0; i < n; i++) {
      var cx = lerp(x0, x1, r()), cy = lerp(y0, y1, r()), sx = rx * (0.5 + r()), sy = ry * (0.5 + r()), al = a * (0.4 + r() * 0.6);
      var g = m.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, 'rgba(0,0,0,' + al.toFixed(3) + ')'); g.addColorStop(0.55, 'rgba(0,0,0,' + (al * 0.55).toFixed(3) + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
      m.save(); m.translate(cx, cy); m.scale(sx, sy); m.fillStyle = g; m.beginPath(); m.arc(0, 0, 1, 0, TAU); m.fill(); m.restore();
    }
  }
  // niebla que vela (color papel, solo sobre lo pintado): jirones entre y0 e y1
  function velo(L, pap, y0, y1, n, a, r, rx) {
    var V = prestado('V', L.w, L.h);
    jirones(V.x, n, -L.w * 0.15, L.w * 1.15, y0, y1, rx || L.w * 0.4, (y1 - y0) * 0.35, a, r);
    V.x.globalCompositeOperation = 'source-in'; V.x.fillStyle = rgba(pap, 1); V.x.fillRect(0, 0, L.w, L.h);
    L.x.save(); L.x.globalCompositeOperation = 'source-atop'; L.x.drawImage(V.c, 0, 0, L.w, L.h, 0, 0, L.w, L.h); L.x.restore();
  }
  // la niebla de abajo: todo se desvanece entre y0 e y1 (transparente del todo debajo), con jirones que suben un poco
  function nieblaAbajo(L, y0, y1, r, op) {
    op = op || {};
    var Mk = prestado('M', L.w, L.h), m = Mk.x, g = m.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.35, 'rgba(0,0,0,0.3)'); g.addColorStop(0.75, 'rgba(0,0,0,0.85)'); g.addColorStop(1, 'rgba(0,0,0,1)');
    m.fillStyle = g; m.fillRect(0, y0, L.w, L.h - y0);
    jirones(m, op.n || 9, -L.w * 0.1, L.w * 1.1, y0 - (y1 - y0) * 0.5, y1, L.w * 0.22, (y1 - y0) * 0.16, op.a || 0.7, r);
    L.x.save(); L.x.globalCompositeOperation = 'destination-out'; L.x.drawImage(Mk.c, 0, 0, L.w, L.h, 0, 0, L.w, L.h); L.x.restore();
  }
  // se desvanece (se vuelve transparente) entre y0 (nada) e y1 (a0 → a1 de borrado)
  function desvanece(L, y0, y1, a0, a1) {
    var x = L.x, g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, 'rgba(0,0,0,' + a0 + ')'); g.addColorStop(1, 'rgba(0,0,0,' + a1 + ')');
    x.save(); x.globalCompositeOperation = 'destination-out'; x.fillStyle = g; x.fillRect(0, y0, L.w, L.h - y0); x.restore();
  }
  // la niebla húmeda: lo de abajo se desenfoca poco a poco (nítido en y0, desenfocado del todo en y1)
  function difumina(L, y0, y1, radio) {
    var P = capa(L.w, L.h, 'P'); P.x.drawImage(L.c, 0, 0);
    var o = desenfoca(P, L.w + MG, L.h + MG, radio), B = prestado('Q', L.w, L.h); B.x.drawImage(o.c, 0, 0, L.w, L.h, 0, 0, L.w, L.h);
    function grad(c) { var g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)'); return g; }
    B.x.globalCompositeOperation = 'destination-in'; B.x.fillStyle = grad(B.x); B.x.fillRect(0, 0, L.w, L.h);
    L.x.save(); L.x.globalCompositeOperation = 'destination-out'; L.x.fillStyle = grad(L.x); L.x.fillRect(0, 0, L.w, L.h); L.x.restore();
    L.x.drawImage(B.c, 0, 0, L.w, L.h, 0, 0, L.w, L.h);
  }
  // los lados se funden (f = fracción del ancho que se desvanece en cada lado)
  function lados(L, f) {
    var x = L.x, g = x.createLinearGradient(0, 0, L.w, 0);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(f, 'rgba(0,0,0,0)'); g.addColorStop(1 - f, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
    x.save(); x.globalCompositeOperation = 'destination-out'; x.fillStyle = g; x.fillRect(0, 0, L.w, L.h); x.restore();
  }

  /* ------------------------------------------------------------------ tejados
     Un tejado visto de frente y algo desde abajo. t: cx, y (alero en el centro), a (semiancho del alero), punta (lo que
     sale la punta), sori (lo que sube), alto (de la superficie), as (semiancho arriba), canto (grosor del alero) */
  function aleroPts(t, n) {
    var pts = [];
    for (var i = 0; i <= n; i++) {
      var u = -1 + 2 * i / n, au = Math.abs(u), sg = u < 0 ? -1 : 1;
      pts.push([t.cx + u * t.a + sg * t.punta * Math.pow(au, 3), t.y - t.sori * (Math.pow(au, 4.2) + 0.35 * Math.pow(Math.max(0, au - 0.9) / 0.1, 2))]);
    }
    return pts;
  }
  // las limas (aristas): de la punta del alero hacia la esquina de arriba, cóncavas
  function limaPts(t, sg, n) {
    var al = aleroPts(t, 24), p = sg < 0 ? al[0] : al[al.length - 1], ya = t.y - t.alto, q = [t.cx + sg * t.as, ya], o = [];
    var c = [lerp(p[0], q[0], 0.55), lerp(p[1], ya, 0.2)];
    for (var i = 0; i <= (n || 10); i++) { var k = i / (n || 10), m = 1 - k; o.push([m * m * p[0] + 2 * m * k * c[0] + k * k * q[0], m * m * p[1] + 2 * m * k * c[1] + k * k * q[1]]); }
    return o;
  }
  function formaTejado(c, t) {
    var al = aleroPts(t, 24), ld = limaPts(t, 1), li = limaPts(t, -1), i;
    c.moveTo(al[0][0], al[0][1]);
    for (i = 1; i < al.length; i++) c.lineTo(al[i][0], al[i][1]);
    for (i = 1; i < ld.length; i++) c.lineTo(ld[i][0], ld[i][1]);
    for (i = li.length - 1; i >= 0; i--) c.lineTo(li[i][0], li[i][1]);
  }
  // el alero: dos trazos que salen del centro hacia las puntas; la presión se aligera al final y la punta se levanta
  function trazoAlero(x, t, alfa, r, op) {
    op = op || {};
    var al = aleroPts(t, 40), mid = 20 + Math.round((r() - 0.5) * 6);
    [al.slice(0, mid + 2).reverse(), al.slice(mid - 1)].forEach(function (pts) {
      var pp = pts.map(function (q, i) { var g = i / (pts.length - 1); return [q[0], q[1], 1.08 - 0.4 * Math.pow(g, 1.6)]; });
      var o = { entrada: 0.04, salida: op.salida || 0.3, seco: op.seco == null ? 0.5 : op.seco, carga: 1, rugoso: 0.3 };
      // a veces el pincel se levanta un instante y vuelve a apoyarse
      if (op.corte !== false && r() < 0.45 && pp.length > 12) { var c = Math.floor(pp.length * (0.5 + r() * 0.25)); trazo(x, pp.slice(0, c), t.canto, alfa, r, { entrada: 0.04, salida: 0.12, seco: o.seco, carga: 1, rugoso: 0.3 }); trazo(x, pp.slice(c + 1), t.canto * 0.92, alfa * 0.95, r, { entrada: 0.15, salida: o.salida, seco: o.seco + 0.1, carga: 0.9, rugoso: 0.3 }); }
      else trazo(x, pp, t.canto, alfa, r, o);
    });
  }
  // la sombra del vuelo bajo el alero: franja que baja desde el alero (hondo px), estrechándose hacia el muro (ancho)
  function sombraVuelo(c, t, hondo, ancho) {
    var al = aleroPts(t, 24), i;
    c.beginPath(); c.moveTo(al[0][0], al[0][1]);
    for (i = 1; i < al.length; i++) c.lineTo(al[i][0], al[i][1]);
    for (i = al.length - 1; i >= 0; i--) { var u = Math.abs(i / (al.length - 1) * 2 - 1), dy = hondo * (1 - 0.8 * Math.pow(u, 2.5)); c.lineTo(lerp(t.cx, al[i][0], ancho == null ? 1 : lerp(ancho, 1, Math.pow(u, 6))), al[i][1] + dy); }
    c.closePath();
  }
  // las tejas: rayas finas (por filas, siguiendo la caída) dentro de la superficie
  function tejas(x, t, paso, alfa, r) {
    x.save(); x.beginPath(); formaTejado(x, t); x.closePath(); x.clip();
    var l = [], ya = t.y - t.alto;
    for (var xx = t.cx - t.a - t.punta; xx < t.cx + t.a + t.punta; xx += paso * (0.75 + r() * 0.5)) {
      var u = (xx - t.cx) / (t.a + t.punta), xa = t.cx + u * t.as;
      l.push([xa, ya - 2, xx, t.y + 2, lerp(xa, xx, 0.6), lerp(ya, t.y, 0.5)]);
    }
    marcas(x, l, Math.max(0.5, paso * 0.18), TINTA, alfa);
    x.restore();
  }

  /* ------------------------------------------------------------------ hastiales y remates */
  // chidori-hafu: el hastial triangular sobre un faldón: tímpano de yeso, tablas oscuras que se abren abajo, su teja gris
  function chidori(x, K, g, tono, pap, r) {
    var ax = g.cx, ay = g.y - g.alto, a = g.a, yb = g.y;
    function lado(sg, f) { f = f || 1; return [[ax, ay], [ax + sg * a * 0.4 * f, ay + g.alto * 0.5], [ax + sg * a * 0.84 * f, yb - g.alto * 0.05], [ax + sg * a * 1.06 * f, yb - g.alto * 0.16]]; }
    var li = T.curva(lado(-1), 6), ld = T.curva(lado(1), 6);
    // la teja del hastial: una franja gris por encima de cada tabla
    x.fillStyle = rgba(TINTA, 0.42 * tono); x.beginPath(); x.moveTo(ax, ay - g.canto * 1.6);
    T.curva(lado(1, 1.08), 6).forEach(function (p) { x.lineTo(p[0], p[1] - g.canto * 1.2); }); ld.slice().reverse().forEach(function (p) { x.lineTo(p[0], p[1]); });
    li.forEach(function (p) { x.lineTo(p[0], p[1]); }); T.curva(lado(-1, 1.08), 6).reverse().forEach(function (p) { x.lineTo(p[0], p[1] - g.canto * 1.2); });
    x.closePath(); x.fill();
    // el tímpano: papel con su sombra
    x.fillStyle = rgba(pap, 1); x.beginPath(); x.moveTo(ax - a * 0.86, yb + 1);
    li.slice().reverse().forEach(function (p) { x.lineTo(p[0], p[1] + 1); }); ld.forEach(function (p) { x.lineTo(p[0], p[1] + 1); });
    x.lineTo(ax + a * 0.86, yb + 1); x.closePath(); x.fill();
    var gr = x.createLinearGradient(ax - a, 0, ax + a, 0); gr.addColorStop(0, rgba(TINTA, 0.05 * tono)); gr.addColorStop(0.5, rgba(TINTA, 0.1 * tono)); gr.addColorStop(1, rgba(TINTA, 0.32 * tono));
    x.fillStyle = gr; x.beginPath(); x.moveTo(ax, ay + g.alto * 0.08); x.lineTo(ax + a * 0.84, yb); x.lineTo(ax - a * 0.84, yb); x.closePath(); x.fill();
    var gs = x.createLinearGradient(0, ay, 0, ay + g.alto * 0.45); gs.addColorStop(0, rgba(TINTA, 0.3 * tono)); gs.addColorStop(1, rgba(TINTA, 0));
    x.fillStyle = gs; x.beginPath(); x.moveTo(ax, ay); x.lineTo(ax + a * 0.5, ay + g.alto * 0.6); x.lineTo(ax - a * 0.5, ay + g.alto * 0.6); x.closePath(); x.fill();
    // la ventanita (o la celosía) y la base
    x.fillStyle = rgba(TINTA, 0.6 * tono); x.fillRect(ax - a * 0.12, yb - g.alto * 0.4, a * 0.24, g.alto * 0.19);
    recta(K.x, [ax - a * 0.9, yb], [ax + a * 0.9, yb], Math.max(0.7, g.canto * 0.55), 0.7 * tono, r, { temblor: 0.25 });
    // las tablas: dos trazos desde la cumbre y el adorno colgado (gegyo)
    trazo(K.x, li.slice(), g.canto, 0.92 * tono, r, { entrada: 0.05, salida: 0.3, seco: 0.3 });
    trazo(K.x, ld.slice(), g.canto, 0.92 * tono, r, { entrada: 0.05, salida: 0.3, seco: 0.3 });
    K.x.fillStyle = rgba(TINTA, 0.85 * tono); K.x.beginPath(); K.x.ellipse(ax, ay + g.canto * 1.4, g.canto * 0.5, g.canto * 0.85, 0, 0, TAU); K.x.fill();
  }
  // kara-hafu: el hastial en campana del alero
  function karahafu(x, K, g, tono, pap, r) {
    var pts = [], n = 28, i;
    for (i = 0; i <= n; i++) {
      var u = -1.3 + 2.6 * i / n, au = Math.abs(u), c = au < 1 ? Math.pow(Math.cos(au * Math.PI / 2), 2) : -0.1 * Math.pow((au - 1) / 0.3, 2);
      pts.push([g.cx + u * g.a, g.y - g.alto * c]);
    }
    // la teja por encima (sigue la campana) y el tímpano debajo
    x.fillStyle = rgba(TINTA, 0.4 * tono); x.beginPath();
    pts.forEach(function (p, j) { var yy = p[1] - g.canto * 1.5 - g.alto * 0.15 * Math.max(0, 1 - Math.abs(j / n * 2 - 1) * 1.3); if (j) x.lineTo(p[0], yy); else x.moveTo(p[0], yy); });
    for (i = n; i >= 0; i--) x.lineTo(pts[i][0], pts[i][1]);
    x.closePath(); x.fill();
    x.fillStyle = rgba(pap, 1); x.beginPath(); x.moveTo(pts[3][0], g.y + 1);
    pts.slice(3, n - 2).forEach(function (p) { x.lineTo(p[0], p[1] + g.canto * 0.5); }); x.lineTo(pts[n - 3][0], g.y + 1); x.closePath(); x.fill();
    var gr = x.createLinearGradient(g.cx - g.a, 0, g.cx + g.a, 0); gr.addColorStop(0, rgba(TINTA, 0.04)); gr.addColorStop(1, rgba(TINTA, 0.28 * tono));
    x.fillStyle = gr; x.fillRect(g.cx - g.a, g.y - g.alto * 0.75, g.a * 2, g.alto * 0.75);
    x.fillStyle = rgba(TINTA, 0.5 * tono); x.beginPath(); x.ellipse(g.cx, g.y - g.alto * 0.3, g.a * 0.22, g.alto * 0.13, 0, 0, TAU); x.fill();
    trazo(K.x, pts.slice(0, Math.round(n / 2) + 2).reverse(), g.canto, 0.92 * tono, r, { entrada: 0.05, salida: 0.3, seco: 0.3 });
    trazo(K.x, pts.slice(Math.round(n / 2) - 1), g.canto, 0.92 * tono, r, { entrada: 0.05, salida: 0.3, seco: 0.3 });
  }
  // shachihoko: el pez de la punta de la cumbrera, con la cola levantada (sg: hacia dónde abre la cola)
  function shachi(K, px, py, s, sg, tono, r) {
    trazo(K.x, [[px - sg * s * 0.1, py + s * 0.12], [px + sg * s * 0.02, py - s * 0.3], [px + sg * s * 0.2, py - s * 0.68], [px + sg * s * 0.42, py - s * 0.9]], s * 0.34, 0.92 * tono, r, { entrada: 0.05, salida: 0.5, seco: 0.25 });
    trazo(K.x, [[px + sg * s * 0.36, py - s * 0.92], [px + sg * s * 0.56, py - s * 1.12], [px + sg * s * 0.46, py - s * 1.32]], s * 0.2, 0.85 * tono, r, { entrada: 0.2, salida: 0.5, seco: 0.3 });
    trazo(K.x, [[px + sg * s * 0.38, py - s * 0.9], [px + sg * s * 0.62, py - s * 0.98]], s * 0.12, 0.7 * tono, r, { entrada: 0.2, salida: 0.6 });
  }

  /* ------------------------------------------------------------------ una torre de pisos (torreón o yagura)
     def: cx, pie (y del pie del primer muro), S (escala), tono, pisos: [{ alto (muro, en S), a (semiancho, px), vuelo,
     tejado (alto de la superficie, en S), sori (en S), ventanas (0…1), hafu: [{ tipo: 'chidori' | 'kara', u (−1…1 a lo
     largo del alero), a, alto (en S) }] }], cima (cumbrera con shachihoko). Pinta en x; la tinta oscura va a su capa K. */
  function torre(x, w, h, def, pap, r) {
    var S = def.S, tono = def.tono == null ? 1 : def.tono, cx = def.cx, y = def.pie, P = [], n = def.pisos.length;
    var K = capa(w, h);
    def.pisos.forEach(function (p, i) {
      var yt = y - S * p.alto, canto = Math.max(1, S * (p.canto || 0.0095));
      var t = { cx: cx, y: yt, a: p.a * p.vuelo, punta: S * 0.016, sori: S * (p.sori || 0.02), alto: S * p.tejado, canto: canto };
      t.as = i < n - 1 ? def.pisos[i + 1].a * 1.02 : p.a * 0.6;
      P.push({ yb: y, yt: yt, a: p.a, aT: p.a * 0.965, t: t, p: p });
      y = yt - t.alto;
    });
    var ancho0 = def.pisos[0].a * def.pisos[0].vuelo + S * 0.05, caja = [cx - ancho0, y - S * 0.07, cx + ancho0, def.pie + 4];
    // 1 · los muros: papel; encima una aguada (el lado de la sombra y la sombra del vuelo)
    x.fillStyle = rgba(pap, 1);
    P.forEach(function (q) { x.beginPath(); x.moveTo(cx - q.a, q.yb + 2); x.lineTo(cx - q.aT, q.yt); x.lineTo(cx + q.aT, q.yt); x.lineTo(cx + q.a, q.yb + 2); x.closePath(); x.fill(); });
    aguada(x, w, h, function (c) {
      P.forEach(function (q) {
        var hh = q.yb - q.yt, g = c.createLinearGradient(cx - q.a, 0, cx + q.a, 0);
        g.addColorStop(0, 'rgba(0,0,0,0.04)'); g.addColorStop(0.45, 'rgba(0,0,0,0.06)'); g.addColorStop(0.72, 'rgba(0,0,0,0.2)'); g.addColorStop(1, 'rgba(0,0,0,0.42)');
        c.fillStyle = g; c.fillRect(cx - q.a, q.yt, q.a * 2, hh + 2);
        var g2 = c.createLinearGradient(0, q.yt, 0, q.yt + hh * 0.6); g2.addColorStop(0, 'rgba(0,0,0,0.7)'); g2.addColorStop(0.3, 'rgba(0,0,0,0.28)'); g2.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g2; c.fillRect(cx - q.a, q.yt, q.a * 2, hh * 0.6);
      });
    }, { gris: tono, nubes: 0.4, grano: 0.25, suave: Math.max(1, S * 0.006), borde: 0.2, semilla: sem(r) % 997, caja: caja });
    // las ventanas: manchitas oscuras en fila, alguna falta
    P.forEach(function (q) {
      if (!q.p.ventanas) return;
      var hh = q.yb - q.yt, vw = Math.max(1.2, S * 0.0105), vh = Math.max(1.6, S * 0.016), paso = S * 0.03, nv = Math.floor(q.a * 1.75 / paso), y0 = q.yt + hh * 0.56;
      for (var k = 0; k < nv; k++) {
        if (r() > q.p.ventanas) continue;
        var vx = cx + (k - (nv - 1) / 2) * paso + (k % 2 ? -1 : 1) * paso * 0.12, vy = y0 + (r() - 0.5) * S * 0.003, som = 0.65 + 0.35 * clamp((vx - cx) / q.a, 0, 1);
        x.fillStyle = rgba(TINTA, (0.55 + r() * 0.25) * tono * som); x.fillRect(vx - vw / 2, vy - vh / 2, vw * (0.9 + r() * 0.2), vh * (0.9 + r() * 0.2));
        if (vw > 3) { x.fillStyle = rgba(pap, 0.35); x.fillRect(vx - vw * 0.06, vy - vh * 0.4, vw * 0.12, vh * 0.8); }
      }
    });
    // los cantos de los muros: fino y a tramos a la luz, algo más oscuro en la sombra
    P.forEach(function (q) {
      if (r() < 0.5) recta(K.x, [cx - q.aT, q.yt + q.t.canto * 3], [cx - lerp(q.aT, q.a, 0.6), lerp(q.yt, q.yb, 0.6)], Math.max(0.5, S * 0.002), 0.18 * tono, r, { seco: 0.7 });
      recta(K.x, [cx + q.aT, q.yt + q.t.canto * 2], [cx + q.a, q.yb], Math.max(0.6, S * 0.0032), 0.42 * tono, r, { seco: 0.6, tramos: true });
    });
    // 2 · la sombra del vuelo (oscura) y la superficie de los tejados
    aguada(x, w, h, function (c) { P.forEach(function (q) { c.fillStyle = 'rgba(0,0,0,0.85)'; sombraVuelo(c, q.t, q.t.canto * 1.7, q.a / q.t.a); c.fill(); }); }, { gris: 0.62 * tono, nubes: 0.35, grano: 0.25, suave: Math.max(1, S * 0.005), borde: 0.5, semilla: sem(r) % 997, caja: caja });
    aguada(x, w, h, function (c) {
      P.forEach(function (q) {
        var t = q.t, g = c.createLinearGradient(0, t.y - t.alto, 0, t.y);
        g.addColorStop(0, 'rgba(0,0,0,0.38)'); g.addColorStop(0.6, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0.78)');
        c.fillStyle = g; c.beginPath(); formaTejado(c, t); c.closePath(); c.fill();
        var g2 = c.createLinearGradient(t.cx, 0, t.cx + t.a, 0); g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,0.25)');
        c.fillStyle = g2; c.beginPath(); formaTejado(c, t); c.closePath(); c.fill();
      });
    }, { gris: 0.62 * tono, nubes: 0.45, grano: 0.3, suave: Math.max(1, S * 0.0025), borde: 0.8, semilla: sem(r) % 997, caja: caja });
    P.forEach(function (q) { tejas(x, q.t, Math.max(1.6, S * 0.01), 0.12 * tono, r); });
    // las limas: blancas de yeso (como en Himeji) con su sombra
    P.forEach(function (q) {
      [-1, 1].forEach(function (sg) {
        var lp = limaPts(q.t, sg);
        trazo(K.x, lp.map(function (p) { return [p[0] - sg * 0.7, p[1] + 0.5]; }), Math.max(0.7, q.t.canto * 0.45), 0.65 * tono, r, { entrada: 0.1, salida: 0.2, seco: 0.5 });
        trazo(x, lp, Math.max(0.6, q.t.canto * 0.32), 0.85, r, { color: pap, entrada: 0.25, salida: 0.3, seco: 0.6 });
      });
    });
    // 3 · los hastiales, el alero de un trazo, la cumbrera con los shachihoko
    P.forEach(function (q, i) {
      var t = q.t;
      (q.p.hafu || []).forEach(function (g) {
        var gg = { cx: t.cx + g.u * t.a, y: t.y - t.canto * 0.8, a: S * g.a, alto: S * g.alto, canto: Math.max(0.8, t.canto * 0.8) };
        if (g.tipo === 'kara') { gg.y = t.y + t.canto * 0.1; karahafu(x, K, gg, tono, pap, r); }
        else chidori(x, K, gg, tono, pap, r);
      });
      trazoAlero(K.x, t, 0.94 * tono, r);
      if (i === n - 1 && def.cima) {
        var ya = t.y - t.alto, l = t.as * 1.15;
        trazo(K.x, [[t.cx - l, ya - t.canto * 0.35], [t.cx - l * 0.5, ya + t.canto * 0.05], [t.cx + l * 0.5, ya + t.canto * 0.05], [t.cx + l, ya - t.canto * 0.35]], t.canto * 1.15, 0.92 * tono, r, { entrada: 0.05, salida: 0.08, seco: 0.3 });
        shachi(K, t.cx - l * 0.97, ya - t.canto * 0.5, S * 0.021, -1, tono, r);
        shachi(K, t.cx + l * 0.97, ya - t.canto * 0.5, S * 0.021, 1, tono, r);
      }
    });
    conHalo(x, K, Math.max(1, S * 0.006), 0.35 * tono);
    return { arriba: y, P: P };
  }

  /* ------------------------------------------------------------------ la base de piedra (ishigaki)
     Lados cóncavos (el «abanico»: casi vertical arriba, abierta abajo). Aguada gris más oscura en la sombra, pincel seco
     que arrastra por la piedra, juntas sueltas (piedras irregulares), las esquinas trabadas (sangi-zumi) y el filo.
     b: cx, y0, y1, a0, a1 */
  function ishigaki(x, w, h, b, S, tono, pap, r) {
    function borde(sg, t) { return [b.cx + sg * (b.a0 + (b.a1 - b.a0) * Math.pow(t, 2.1)), lerp(b.y0, b.y1, t)]; }
    function forma(c) {
      c.beginPath(); var i;
      for (i = 0; i <= 24; i++) { var p = borde(-1, i / 24); if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }
      for (i = 24; i >= 0; i--) { var q = borde(1, i / 24); c.lineTo(q[0], q[1]); }
      c.closePath();
    }
    var K = capa(w, h), k, hh = b.y1 - b.y0;
    aguada(x, w, h, function (c) {
      var g = c.createLinearGradient(b.cx - b.a1, 0, b.cx + b.a1, 0);
      g.addColorStop(0, 'rgba(0,0,0,0.38)'); g.addColorStop(0.5, 'rgba(0,0,0,0.5)'); g.addColorStop(0.8, 'rgba(0,0,0,0.72)'); g.addColorStop(1, 'rgba(0,0,0,0.9)');
      c.fillStyle = g; forma(c); c.fill();
      var g2 = c.createLinearGradient(0, b.y0, 0, b.y0 + hh * 0.35); g2.addColorStop(0, 'rgba(0,0,0,0.6)'); g2.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g2; forma(c); c.fill();
    }, { gris: 0.54 * tono, nubes: 0.6, grano: 0.45, suave: Math.max(1, S * 0.004), borde: 0.6, semilla: sem(r) % 997, caja: [b.cx - b.a1 - 4, b.y0 - 4, b.cx + b.a1 + 4, b.y1 + 4] });
    // el pincel seco que arrastra por la piedra (oscuro) y el brillo (papel)
    x.save(); forma(x); x.clip();
    for (k = 0; k < 7; k++) {
      var yy = lerp(b.y0, b.y1, 0.08 + r() * 0.85), tt = (yy - b.y0) / hh, x0 = borde(-1, tt)[0], x1 = borde(1, tt)[0], ini = lerp(x0, x1, r() * 0.5), fin = lerp(ini, x1, 0.4 + r() * 0.6), osc = k < 4;
      trazo(x, [[ini, yy], [lerp(ini, fin, 0.5), yy + (r() - 0.5) * S * 0.01], [fin, yy + (r() - 0.5) * S * 0.01]], S * (0.012 + r() * 0.016), osc ? 0.3 * tono : 0.45, r, { color: osc ? TINTA : pap, rasgado: 0.85, seco: 0.8, entrada: 0.15, salida: 0.4 });
    }
    // las piedras: hiladas de alto variable; de cada piedra se marca a veces la junta de abajo y la de un lado,
    // y algunas son más oscuras o más claras (marcas baratas, en tres tonos: la luz, el centro y la sombra)
    var lista = [[], [], []], y = b.y0 + S * 0.003;
    while (y < b.y1) {
      var fila = S * (0.007 + r() * 0.009), t2 = (y - b.y0) / hh, xi = borde(-1, t2)[0], xd = borde(1, t2)[0], xx = xi - r() * S * 0.02;
      while (xx < xd) {
        var lp = S * (0.012 + r() * 0.034), u = clamp((xx - xi) / (xd - xi), 0, 1), cual = u < 0.5 ? 0 : u < 0.8 ? 1 : 2;
        var x1b = Math.min(xd, xx + lp), yb2 = y + fila + (r() - 0.5) * fila * 0.3;
        if (r() < 0.42 + 0.25 * u) lista[cual].push([xx, yb2, x1b, yb2 + (r() - 0.5) * fila * 0.3, (xx + x1b) / 2, yb2 + (r() - 0.35) * fila * 0.45]);
        if (r() < 0.38) lista[cual].push([x1b, yb2, x1b + (r() - 0.5) * fila * 0.4, y + r() * fila * 0.3, x1b + (r() - 0.5) * fila * 0.4, (y + yb2) / 2]);
        if (r() < 0.3) { x.fillStyle = r() < 0.55 ? rgba(TINTA, (0.06 + r() * 0.1) * tono) : rgba(pap, 0.1 + r() * 0.14); x.beginPath(); x.ellipse((xx + x1b) / 2, y + fila / 2, lp * 0.45, fila * 0.45, (r() - 0.5) * 0.2, 0, TAU); x.fill(); }
        xx = x1b;
      }
      y += fila;
    }
    marcas(x, lista[0], Math.max(0.5, S * 0.0016), TINTA, 0.24 * tono);
    marcas(x, lista[1], Math.max(0.5, S * 0.0019), TINTA, 0.34 * tono);
    marcas(x, lista[2], Math.max(0.5, S * 0.0023), TINTA, 0.5 * tono);
    x.restore();
    // las esquinas trabadas: bloques largos y cortos alternos, con su junta
    [-1, 1].forEach(function (sg) {
      var bl = [], nb = Math.max(6, Math.round(hh / (S * 0.02)));
      for (k = 0; k < nb; k++) {
        var p0 = borde(sg, k / nb), p1 = borde(sg, (k + 1) / nb), lb = S * (k % 2 ? 0.024 : 0.045) * (0.85 + r() * 0.3);
        bl.push([p1[0], p1[1], p1[0] - sg * lb, p1[1] + 0.4, p1[0] - sg * lb * 0.5, p1[1] + 0.8]);
        bl.push([p1[0] - sg * lb, p1[1], p0[0] - sg * lb, p0[1] + 1, p0[0] - sg * lb * 1.02, (p0[1] + p1[1]) / 2]);
      }
      marcas(x, bl, Math.max(0.6, S * 0.003), TINTA, (sg > 0 ? 0.6 : 0.42) * tono);
      var pts = []; for (k = 0; k <= 16; k++) pts.push(borde(sg, k / 16));
      trazo(K.x, pts, Math.max(1, S * (sg > 0 ? 0.008 : 0.0055)), (sg > 0 ? 0.8 : 0.6) * tono, r, { entrada: 0.03, salida: 0.5, seco: 0.75, rugoso: 0.35 });
    });
    recta(K.x, borde(-1, 0), borde(1, 0), Math.max(1, S * 0.005), 0.7 * tono, r, { seco: 0.4 });
    conHalo(x, K, Math.max(1, S * 0.005), 0.3 * tono);
  }

  /* ------------------------------------------------------------------ árboles de lejos */
  // un pino de lejos: tronco que se tuerce (a tramos) y almohadillas de agujas, irregulares, hechas de toques
  // horizontales sobre una mancha clara; a veces dos por piso, una a cada lado
  function pino(x, px, py, s, al, r) {
    var lean = (r() - 0.5) * 0.5, tx = px + lean * s * 0.6, ty = py - s, np = 2 + Math.floor(r() * 3), toques = [], manchas = [], k, j;
    recta(x, [px, py], [tx, ty + s * 0.18], Math.max(0.8, s * 0.05), al * 0.75, r, { temblor: s * 0.03, tramos: true, seco: 0.5, salida: 0.5 });
    for (k = 0; k < np; k++) {
      var f = np === 1 ? 1 : k / (np - 1), yy = lerp(py - s * 0.38, ty + s * 0.12, f), base = lerp(px, tx, f), lados2 = r() < 0.4 && f < 0.8 ? [-1, 1] : [(k % 2 ? 1 : -1)];
      lados2.forEach(function (sg) {
        var an = s * (0.3 - 0.13 * f) * (0.7 + r() * 0.6) / (lados2.length > 1 ? 1.5 : 1), xx = base + sg * an * (lados2.length > 1 ? 0.8 : 0.3) * r(), yj = yy + (r() - 0.5) * s * 0.05;
        manchas.push([xx, yj, an * 1.1, s * (0.05 + r() * 0.03)]);
        var nt = 5 + Math.floor(r() * 6);
        for (j = 0; j < nt; j++) {
          var dx = (r() - 0.5) * 2 * an, dy = (r() - 0.5) * s * 0.055 * (1 - Math.abs(dx) / an * 0.5) - s * 0.008, l2 = s * (0.035 + r() * 0.08);
          toques.push([xx + dx - l2, yj + dy, xx + dx + l2, yj + dy + (r() - 0.5) * s * 0.025, xx + dx, yj + dy - s * (0.008 + r() * 0.015)]);
        }
      });
    }
    manchas.forEach(function (m) { x.fillStyle = rgba(TINTA, al * 0.2); x.beginPath(); x.ellipse(m[0], m[1], m[2], m[3], 0, 0, TAU); x.fill(); });
    marcas(x, toques, Math.max(1, s * 0.06), TINTA, al * 0.72);
  }
  // una masa de árboles de hoja: manchas redondas grises que se pierden
  function bosquecillo(x, w, h, lista, tono, r, S) {
    aguada(x, w, h, function (c) {
      lista.forEach(function (b) {
        for (var i = 0; i < 6; i++) { var rx = b[2] * (0.35 + r() * 0.35); c.fillStyle = 'rgba(0,0,0,' + (0.4 + r() * 0.5).toFixed(3) + ')'; c.beginPath(); c.ellipse(b[0] + (r() - 0.5) * b[2] * 1.2, b[1] - r() * b[2] * 0.5, rx, rx * (0.7 + r() * 0.3), 0, 0, TAU); c.fill(); }
      });
    }, { gris: 0.5 * tono, nubes: 0.5, grano: 0.35, suave: Math.max(1, S * 0.008), borde: 0.5, semilla: sem(r) % 997 });
  }

  /* ------------------------------------------------------------------ el castillo
     Como el de Himeji visto de lejos sobre su colina: la base de piedra, el torreón de cinco tejados con hastiales
     triangulares y uno en campana, shachihoko en la cumbrera; detrás, el torreón pequeño del oeste, el pasillo y una
     torreta (más claros: la distancia); al pie, pinos, y la niebla que lo desenfoca y lo borra.
     op: semilla, tono (0…1), papel ([r,g,b] de los muros), colina (true), pinos (true). Anclajes: L.base (abajo en el
     centro del lienzo) y L.pie (donde la base de piedra toca la colina, antes de la niebla).
     Proporción buena: w ≈ 1,1–1,2 · h. */
  A.castilloPasos = function* (w, h, op) {
    op = op || {};
    var L = T.lienzo(w, h), x = L.x, r = T.azar(op.semilla || 51), pap = papelDe(op), tono = op.tono == null ? 1 : op.tono;
    var S = Math.min(h, w / 1.12), cx = w / 2, kx = cx + 0.06 * S, pie = h - 0.43 * S, k;
    yield 'castillo 1';
    // 1 · detrás, en su capa: luego se vela (la distancia) y el pie se pierde
    var F = prestado('atras', w, h), f = F.x, wx = kx - 0.34 * S, ex = kx + 0.31 * S;
    ishigaki(f, w, h, { cx: wx, y0: pie + 0.05 * S, y1: pie + 0.2 * S, a0: 0.1 * S, a1: 0.14 * S }, S, 0.8, pap, r);
    torre(f, w, h, { cx: wx, pie: pie + 0.05 * S, S: S, tono: 0.85, cima: true, pisos: [
      { alto: 0.062, a: 0.092 * S, vuelo: 1.24, tejado: 0.042, sori: 0.017, ventanas: 0.6, hafu: [{ tipo: 'chidori', u: 0.2, a: 0.042, alto: 0.05 }] },
      { alto: 0.05, a: 0.076 * S, vuelo: 1.26, tejado: 0.038, sori: 0.016, ventanas: 0.7 },
      { alto: 0.046, a: 0.062 * S, vuelo: 1.32, tejado: 0.048, sori: 0.017, ventanas: 0.8, hafu: [{ tipo: 'kara', u: 0, a: 0.03, alto: 0.018 }] }
    ] }, pap, r);
    yield 'castillo 1b';
    torre(f, w, h, { cx: kx - 0.18 * S, pie: pie + 0.035 * S, S: S, tono: 0.85, pisos: [{ alto: 0.055, a: 0.085 * S, vuelo: 1.14, tejado: 0.03, sori: 0.01, ventanas: 0.7 }] }, pap, r);
    ishigaki(f, w, h, { cx: ex, y0: pie + 0.075 * S, y1: pie + 0.2 * S, a0: 0.07 * S, a1: 0.1 * S }, S, 0.8, pap, r);
    torre(f, w, h, { cx: ex, pie: pie + 0.075 * S, S: S, tono: 0.85, cima: true, pisos: [
      { alto: 0.055, a: 0.066 * S, vuelo: 1.26, tejado: 0.036, sori: 0.015, ventanas: 0.6 },
      { alto: 0.044, a: 0.052 * S, vuelo: 1.32, tejado: 0.044, sori: 0.016, ventanas: 0.8 }
    ] }, pap, r);
    veladura(F, pap, 0.36);
    veladura(F, pap, [0, 0.75], pie + 0.02 * S, pie + 0.16 * S);
    x.drawImage(F.c, 0, 0, w, h, 0, 0, w, h);
    yield 'castillo 2';
    // 2 · la colina: aguada clara con una masa de árboles al fondo
    if (op.colina !== false) {
      aguada(x, w, h, function (c) {
        c.beginPath(); c.moveTo(-2, h + 2);
        for (var i = 0; i <= 40; i++) { var u = i / 40, xx = u * (w + 4) - 2, d = (xx - kx) / (S * 0.6); c.lineTo(xx, pie + S * 0.16 + S * 0.17 * (1 - 1 / (1 + d * d * 1.3)) + (T.fbm1(u * 6, 3, 3) - 0.5) * S * 0.03); }
        c.lineTo(w + 2, h + 2); c.closePath(); c.fill();
      }, { gris: 0.22 * tono, degradado: [1, 0.25], y0: pie + S * 0.14, y1: h, nubes: 0.5, grano: 0.3, suave: Math.max(1, S * 0.01), borde: 0.4, semilla: 13 });
      yield 'castillo 2b';
      var bq = [];
      for (k = 0; k < 16; k++) { var sg = k % 2 ? 1 : -1, bx = kx + sg * S * (0.17 + r() * 0.42); bq.push([bx, pie + S * (0.22 + Math.abs(bx - kx) / S * 0.1 + r() * 0.03), S * (0.045 + r() * 0.045)]); }
      bosquecillo(x, w, h, bq, 0.85 * tono, r, S);
    }
    yield 'castillo 3';
    // 3 · la base de piedra y el torreón: cinco tejados, hastiales y la cumbrera con sus peces
    ishigaki(x, w, h, { cx: kx, y0: pie, y1: pie + 0.25 * S, a0: 0.195 * S, a1: 0.29 * S }, S, tono, pap, r);
    yield 'castillo 3b';
    torre(x, w, h, { cx: kx, pie: pie, S: S, tono: tono, cima: true, pisos: [
      { alto: 0.072, a: 0.178 * S, vuelo: 1.22, tejado: 0.05, sori: 0.022, ventanas: 0.5, hafu: [{ tipo: 'chidori', u: -0.5, a: 0.048, alto: 0.06 }, { tipo: 'chidori', u: 0.46, a: 0.048, alto: 0.06 }] },
      { alto: 0.058, a: 0.156 * S, vuelo: 1.22, tejado: 0.045, sori: 0.021, ventanas: 0.6, hafu: [{ tipo: 'kara', u: 0.06, a: 0.05, alto: 0.026 }] },
      { alto: 0.054, a: 0.136 * S, vuelo: 1.24, tejado: 0.046, sori: 0.02, ventanas: 0.6, hafu: [{ tipo: 'chidori', u: -0.18, a: 0.068, alto: 0.072 }] },
      { alto: 0.05, a: 0.116 * S, vuelo: 1.26, tejado: 0.04, sori: 0.02, ventanas: 0.75, hafu: [{ tipo: 'chidori', u: 0.55, a: 0.035, alto: 0.04 }] },
      { alto: 0.054, a: 0.098 * S, vuelo: 1.32, tejado: 0.062, sori: 0.024, ventanas: 0.85, hafu: [{ tipo: 'chidori', u: 0, a: 0.05, alto: 0.05 }] }
    ] }, pap, r);
    yield 'castillo 4';
    // 4 · los pinos al pie: unos detrás de otros, los de delante más oscuros
    if (op.pinos !== false) {
      var pinos = [];
      for (k = 0; k < 20; k++) { var sg2 = k % 2 ? 1 : -1, px = kx + sg2 * S * (0.16 + r() * 0.42), py = pie + S * (0.27 + r() * 0.08) + Math.abs(px - kx) / S * S * 0.05; pinos.push([px, py, S * (0.07 + r() * 0.08)]); }
      pinos.sort(function (a2, b2) { return a2[1] - b2[1]; });
      for (var jp = 0; jp < pinos.length; jp++) { var q = pinos[jp]; pino(x, q[0], q[1], q[2], (0.5 + 0.4 * jp / pinos.length) * tono, r); if (jp % 7 === 6) yield 'castillo pinos'; }
    }
    yield 'castillo 5';
    // 5 · la niebla: el pie se pierde, los lados se funden
    difumina(L, pie + 0.26 * S, h, Math.max(2, S * 0.01));
    velo(L, pap, pie + 0.12 * S, pie + 0.3 * S, 5, 0.6, r);
    nieblaAbajo(L, h - 0.3 * h, h, r, { n: 10, a: 0.75 });
    lados(L, 0.08);
    L.base = [cx, h]; L.pie = [kx, pie + 0.25 * S];
    return L;
  };
  A.castillo = function (w, h, op) { return correr(A.castilloPasos(w, h, op)); };


  /* ------------------------------------------------------------------ la pagoda de cinco pisos
     En aguada gris, medio perdida en la niebla: cada piso, un cuerpo gris con su puerta y sus postes; encima, las alas
     oscuras del vuelo (las ménsulas y los cabios en sombra) y el alero de un solo trazo con las puntas muy levantadas;
     las barandillas de los balcones y, arriba, el sōrin: nueve anillos, la llama de agua y la joya.
     op: semilla, tono, papel, fondo (0…1: cuánto tapa lo de detrás). Anclajes: L.base (abajo en el centro) y L.pie
     (la plataforma, ya en la niebla). Proporción buena: w ≈ 0,6 · h. */
  A.pagodaPasos = function* (w, h, op) {
    op = op || {};
    var L = T.lienzo(w, h), x = L.x, r = T.azar(op.semilla || 61), pap = papelDe(op), tono = op.tono == null ? 1 : op.tono;
    var S = Math.min(h, w / 0.6), cx = w / 2, i, y = h - 0.03 * S, pisos = [], K = propia(w, h);
    var CUERPO = [0.09, 0.076, 0.071, 0.067, 0.063];
    var yPlat = y;
    for (i = 0; i < 5; i++) {
      var k = 1 - 0.09 * i, b = 0.096 * S * k, yb = y, yt = yb - CUERPO[i] * S, banda = 0.036 * S * k;
      var t = { cx: cx, y: yt - banda, a: 0.222 * S * k, punta: 0.04 * S * k, sori: 0.048 * S * k, alto: (i < 4 ? 0.033 : 0.072) * S, canto: Math.max(1, 0.0135 * S * (0.72 + 0.28 * k)) };
      t.as = i < 4 ? 0.096 * S * (1 - 0.09 * (i + 1)) * 1.32 : 0.012 * S;
      pisos.push({ b: b, yb: yb, yt: yt, t: t, i: i });
      y = t.y - t.alto;
    }
    var apice = y;
    // el ala del vuelo: el alero arriba y, debajo, rectas desde las puntas hasta lo alto del cuerpo
    function ala(c, p) {
      var al = aleroPts(p.t, 24); c.beginPath(); c.moveTo(al[0][0], al[0][1]);
      for (var j = 1; j < al.length; j++) c.lineTo(al[j][0], al[j][1]);
      c.lineTo(cx + p.b * 1.1, p.yt + 1); c.lineTo(cx - p.b * 1.1, p.yt + 1); c.closePath();
    }
    // 0 · el papel debajo: la pagoda tapa lo de detrás
    x.fillStyle = rgba(pap, op.fondo == null ? 0.92 : op.fondo);
    pisos.forEach(function (p) { x.fillRect(cx - p.b, p.yt, p.b * 2, p.yb - p.yt + 1); x.beginPath(); formaTejado(x, p.t); x.closePath(); x.fill(); ala(x, p); x.fill(); });
    x.fillRect(cx - 0.18 * S, yPlat, 0.36 * S, h - yPlat);
    yield 'pagoda 1';
    // 1 · los cuerpos: aguada gris, más oscura a la derecha y arriba (la sombra del vuelo); la plataforma
    aguada(x, w, h, function (c) {
      pisos.forEach(function (p) {
        var hh = p.yb - p.yt, g = c.createLinearGradient(cx - p.b, 0, cx + p.b, 0); g.addColorStop(0, 'rgba(0,0,0,0.3)'); g.addColorStop(0.55, 'rgba(0,0,0,0.38)'); g.addColorStop(1, 'rgba(0,0,0,0.72)');
        c.fillStyle = g; c.fillRect(cx - p.b, p.yt, p.b * 2, hh + 1);
        var g2 = c.createLinearGradient(0, p.yt, 0, p.yt + hh * 0.55); g2.addColorStop(0, 'rgba(0,0,0,0.75)'); g2.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g2; c.fillRect(cx - p.b, p.yt, p.b * 2, hh * 0.55);
        c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(cx - p.b * 0.17, p.yb - hh * 0.62, p.b * 0.34, hh * 0.62);   // la puerta
      });
      var g3 = c.createLinearGradient(cx - 0.18 * S, 0, cx + 0.18 * S, 0); g3.addColorStop(0, 'rgba(0,0,0,0.3)'); g3.addColorStop(1, 'rgba(0,0,0,0.7)');
      c.fillStyle = g3; c.beginPath(); c.moveTo(cx - 0.15 * S, yPlat); c.lineTo(cx + 0.15 * S, yPlat); c.lineTo(cx + 0.18 * S, h); c.lineTo(cx - 0.18 * S, h); c.closePath(); c.fill();
    }, { gris: 0.74 * tono, nubes: 0.5, grano: 0.35, suave: Math.max(1, S * 0.004), borde: 0.5, semilla: 17 });
    // los postes (finos, a tramos a la luz) y la barandilla del balcón
    pisos.forEach(function (p) {
      var hh = p.yb - p.yt, lw = Math.max(0.6, S * 0.0032);
      [-1, -0.36, 0.36, 1].forEach(function (f, k2) { var px = cx + f * (p.b - lw); recta(K.x, [px, p.yt + 1], [px, p.yb], lw * (k2 === 3 ? 1.5 : 1), (k2 === 3 ? 0.7 : 0.42) * tono, r, { temblor: 0.15, seco: 0.55, tramos: k2 < 2 }); });
      if (p.i > 0) {
        var bw = p.b * 1.3, by = p.yb - hh * 0.2, bal = [];
        x.fillStyle = rgba(pap, 0.9); x.fillRect(cx - bw, by, bw * 2, p.yb - by);
        x.fillStyle = rgba(TINTA, 0.22 * tono); x.fillRect(cx + bw * 0.25, by, bw * 0.75, p.yb - by);
        for (var bx = cx - bw + S * 0.004; bx <= cx + bw; bx += S * 0.0085) bal.push([bx, by, bx, p.yb, bx, (by + p.yb) / 2]);
        marcas(x, bal, Math.max(0.5, S * 0.0022), TINTA, 0.45 * tono);
        recta(K.x, [cx - bw, by], [cx + bw, by], Math.max(0.7, S * 0.0045), 0.82 * tono, r, { temblor: 0.2 });
      }
    });
    yield 'pagoda 2';
    // 2 · las alas del vuelo: casi negras junto al cuerpo, algo más claras hacia el alero, con los cabios en abanico
    aguada(x, w, h, function (c) {
      pisos.forEach(function (p) { var g = c.createLinearGradient(0, p.t.y - p.t.sori, 0, p.yt); g.addColorStop(0, 'rgba(0,0,0,0.75)'); g.addColorStop(0.6, 'rgba(0,0,0,0.95)'); g.addColorStop(1, 'rgba(0,0,0,1)'); c.fillStyle = g; ala(c, p); c.fill(); });
    }, { gris: 0.94 * tono, nubes: 0.35, grano: 0.25, suave: Math.max(1, S * 0.003), borde: 0.8, semilla: 23 });
    pisos.forEach(function (p) {
      var t = p.t, al = aleroPts(t, 26), l = [], mens = [];
      for (var k3 = 2; k3 < 25; k3++) { var u = -1 + 2 * k3 / 26, q = al[k3]; l.push([cx + u * p.b * 1.05, p.yt - 1, q[0], q[1] + t.canto * 0.8, lerp(cx + u * p.b * 1.05, q[0], 0.5), lerp(p.yt, q[1], 0.5)]); }
      marcas(x, l, Math.max(0.4, S * 0.0016), pap, 0.13);
      [-1, -0.33, 0.33, 1].forEach(function (f) { var mx = cx + f * p.b * 1.02; mens.push([mx - S * 0.008, p.yt - S * 0.006, mx + S * 0.008, p.yt - S * 0.006, mx, p.yt - S * 0.011]); });
      marcas(x, mens, Math.max(0.8, S * 0.006), TINTA, 0.9 * tono);
    });
    yield 'pagoda 3';
    // 3 · los tejados: superficie gris, tejas, limas y el alero de un trazo
    aguada(x, w, h, function (c) {
      pisos.forEach(function (p) {
        var t = p.t, g = c.createLinearGradient(0, t.y - t.alto, 0, t.y); g.addColorStop(0, 'rgba(0,0,0,0.3)'); g.addColorStop(1, 'rgba(0,0,0,0.62)');
        c.fillStyle = g; c.beginPath(); formaTejado(c, t); c.closePath(); c.fill();
        var g2 = c.createLinearGradient(t.cx, 0, t.cx + t.a, 0); g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,0.3)'); c.fillStyle = g2; c.beginPath(); formaTejado(c, t); c.closePath(); c.fill();
      });
    }, { gris: 0.66 * tono, nubes: 0.45, grano: 0.3, suave: Math.max(1, S * 0.002), borde: 0.8, semilla: 29 });
    pisos.forEach(function (p) { tejas(x, p.t, Math.max(1.5, S * 0.009), 0.14 * tono, r); });
    pisos.forEach(function (p) {
      [-1, 1].forEach(function (sg) { trazo(K.x, limaPts(p.t, sg), Math.max(0.7, p.t.canto * 0.45), 0.75 * tono, r, { entrada: 0.1, salida: 0.15, seco: 0.5 }); });
      trazoAlero(K.x, p.t, 0.95 * tono, r, { salida: 0.32, seco: 0.45 });
    });
    yield 'pagoda 4';
    // 4 · el sōrin: base, cuenco y loto; el mástil con nueve anillos; la llama de agua y la joya
    var sx = cx, s0 = apice, top = h - 0.985 * S, alto = s0 - top;
    K.x.fillStyle = rgba(TINTA, 0.85 * tono);
    K.x.fillRect(sx - S * 0.016, s0 - S * 0.012, S * 0.032, S * 0.013);
    K.x.beginPath(); K.x.ellipse(sx, s0 - S * 0.012, S * 0.014, S * 0.011, 0, Math.PI, TAU); K.x.fill();
    trazo(K.x, [[sx - S * 0.013, s0 - S * 0.026], [sx, s0 - S * 0.022], [sx + S * 0.013, s0 - S * 0.026]], Math.max(0.8, S * 0.006), 0.8 * tono, r, { entrada: 0.2, salida: 0.2 });
    trazo(K.x, [[sx, s0 - S * 0.02], [sx + (r() - 0.5) * S * 0.002, top + alto * 0.35], [sx, top + S * 0.012]], Math.max(0.8, S * 0.004), 0.85 * tono, r, { entrada: 0.02, salida: 0.2, seco: 0.3 });
    var a0 = s0 - S * 0.036, a1 = top + alto * 0.37;
    for (i = 0; i < 9; i++) {
      var ay = lerp(a0, a1, i / 8), aw = S * (0.0135 - i * 0.0005);
      trazo(K.x, [[sx - aw, ay + S * 0.001], [sx, ay - S * 0.0015], [sx + aw, ay + S * 0.001]], Math.max(0.9, S * 0.0062), (0.72 + r() * 0.2) * tono, r, { entrada: 0.25, salida: 0.3, seco: 0.35 });
    }
    // la llama de agua (suien): una llama calada, gris, con sus rizos oscuros
    var fy = top + alto * 0.24, fs = S * 0.028;
    aguada(K.x, w, h, function (c) { c.beginPath(); c.moveTo(sx, fy + fs * 0.5); c.bezierCurveTo(sx - fs * 0.9, fy + fs * 0.3, sx - fs * 0.6, fy - fs * 0.4, sx - fs * 0.15, fy - fs * 0.95); c.bezierCurveTo(sx - fs * 0.2, fy - fs * 0.5, sx + fs * 0.2, fy - fs * 0.5, sx + fs * 0.15, fy - fs * 0.95); c.bezierCurveTo(sx + fs * 0.6, fy - fs * 0.4, sx + fs * 0.9, fy + fs * 0.3, sx, fy + fs * 0.5); c.fill(); }, { gris: 0.45 * tono, nubes: 0.3, grano: 0.3, suave: 0.6, borde: 0.9, semilla: 31 });
    [-1, 1].forEach(function (sg) { trazo(K.x, [[sx, fy + fs * 0.45], [sx + sg * fs * 0.75, fy + fs * 0.1], [sx + sg * fs * 0.45, fy - fs * 0.45], [sx + sg * fs * 0.15, fy - fs * 0.95]], Math.max(0.6, S * 0.0035), 0.75 * tono, r, { entrada: 0.1, salida: 0.45, seco: 0.5 }); });
    K.x.fillStyle = rgba(TINTA, 0.85 * tono); K.x.beginPath(); K.x.arc(sx, top + alto * 0.1, S * 0.0048, 0, TAU); K.x.fill();
    K.x.beginPath(); K.x.moveTo(sx, top); K.x.quadraticCurveTo(sx + S * 0.009, top + S * 0.009, sx, top + S * 0.014); K.x.quadraticCurveTo(sx - S * 0.009, top + S * 0.009, sx, top); K.x.fill();
    conHalo(x, K, Math.max(1, S * 0.006), 0.35 * tono);
    yield 'pagoda 5';
    // 5 · la niebla: los pisos de abajo se desenfocan y se velan, una franja de jirones y el pie se pierde
    difumina(L, h * 0.42, h * 0.85, Math.max(2, S * 0.012));
    veladura(L, pap, [0, 0.3], h * 0.42, h * 0.8);
    desvanece(L, h * 0.45, h * 0.8, 0, 0.45);
    velo(L, pap, h * 0.48, h * 0.8, 6, 0.7, r, w * 0.45);
    nieblaAbajo(L, h * 0.76, h, r, { n: 8, a: 0.7 });
    L.base = [cx, h]; L.pie = [cx, yPlat];
    return L;
  };
  A.pagoda = function (w, h, op) { return correr(A.pagodaPasos(w, h, op)); };


  /* ------------------------------------------------------------------ el torii bermellón
     Dos pilares que se estrechan hacia arriba y se inclinan un poco hacia dentro, pintados con bermellón a pinceladas
     verticales (el pigmento se acumula en los bordes, vetas de pincel seco, la sombra a un lado y un brillo al otro); el
     kasagi negro de puntas levantadas y cortadas en bisel, apoyado en el shimaki rojo; el nuki que atraviesa los pilares,
     el gakuzuka con la placa negra de 神 en oro y las bases negras. op: semilla, color (bermellón), oro, papel.
     Anclaje: L.base (pie, en el centro); L.ancho (distancia entre los ejes de los pilares). Proporción buena: w ≈ 1,05 · h. */
  A.toriiPasos = function* (w, h, op) {
    op = op || {};
    var L = T.lienzo(w, h), x = L.x, r = T.azar(op.semilla || 71), pap = papelDe(op);
    var ROJO = op.color || T.color.rojo, OSC = T.color.rojoOscuro, ORO = op.oro || [218, 182, 98];
    var g = h - 1, Ht = h * 0.93, Sp = Math.min(w * 0.96 / 1.5, Ht / 1.12), Lk = Sp * 1.5, cx = w / 2;
    var d0 = Sp * 0.118, d1 = d0 * 0.86, incl = Ht * 0.012;
    var tK = d0 * 0.52, soriK = Ht * 0.055, yK = g - Ht + soriK, tS = d0 * 0.44, lS = Lk * 0.84, kh = d0 * 0.95;
    var K = propia(w, h), i;
    // lo que suben las vigas hacia las puntas (sori), y lo alto del shimaki, pegado bajo el kasagi
    function sube(xx) { var au = Math.min(1, Math.abs(xx - cx) / (Lk / 2)); return soriK * (0.8 * Math.pow(au, 2.6) + 0.2 * Math.pow(Math.max(0, au - 0.8) / 0.2, 2)); }
    function yShimaki(xx) { return yK + tK - sube(xx) - 0.8; }
    var yP = yShimaki(cx) + tS, yN = yP + Ht * 0.16, tN = d0 * 0.6, lN = Sp + d0 * 2.9;
    function temb(v, s) { return (T.fbm1(v * 0.04 + s, 7, 3) - 0.5) * Math.max(0.8, d0 * 0.045); }
    function pie(sg) { var xb = cx + sg * Sp / 2, xt = xb - sg * incl; return { xb: xb, xt: xt, yt: yShimaki(xt) + tS - 1 }; }
    // el contorno de un pilar (sg = −1 izquierda, 1 derecha), con el borde un poco irregular
    function pilar(c, sg, enc) {
      var p = pie(sg), n = 30, j, gb = g - kh * 0.85, e = enc || 0;
      c.beginPath();
      for (j = 0; j <= n; j++) { var t = j / n, yy = lerp(p.yt, gb, t), xx = lerp(p.xt, p.xb, t), hw = lerp(d1, d0, t) / 2 - e; if (j) c.lineTo(xx - hw + temb(yy, sg * 3), yy); else c.moveTo(xx - hw + temb(yy, sg * 3), yy); }
      for (j = n; j >= 0; j--) { var t2 = j / n, yy2 = lerp(p.yt, gb, t2), xx2 = lerp(p.xt, p.xb, t2), hw2 = lerp(d1, d0, t2) / 2 - e; c.lineTo(xx2 + hw2 + temb(yy2, sg * 5 + 1), yy2); }
      c.closePath();
    }
    // una viga: arriba sigue «arriba(x)», grosor t
    function viga(c, x0, x1, arriba, t, s) {
      var n = 40, j, xs = [];
      for (j = 0; j <= n; j++) xs.push(lerp(x0, x1, j / n));
      c.beginPath();
      xs.forEach(function (xx, j2) { var yy = arriba(xx) + temb(xx, s); if (j2) c.lineTo(xx, yy); else c.moveTo(xx, yy); });
      for (j = n; j >= 0; j--) c.lineTo(xs[j], arriba(xs[j]) + t + temb(xs[j], s + 9));
      c.closePath();
    }
    function arribaNuki() { return yN; }
    var VIGAS = [{ x0: cx - lN / 2, x1: cx + lN / 2, f: arribaNuki, t: tN, s: 41 }, { x0: cx - lS / 2, x1: cx + lS / 2, f: yShimaki, t: tS, s: 51 }];
    function rojo(forma, s2, cj) { aguadaColor(x, w, h, forma, ROJO, { gris: 0.9, nubes: 0.5, grano: 0.25, suave: 0.8, borde: 0.9, semilla: s2, caja: cj }); }
    yield 'torii 1';
    // 1 · el bermellón de fondo: nuki (detrás), pilares, gakuzuka y shimaki
    rojo(function (c) { var v = VIGAS[0]; viga(c, v.x0, v.x1, v.f, v.t, v.s); c.fill(); }, 3, [cx - lN / 2 - 4, yN - 4, cx + lN / 2 + 4, yN + tN + 6]);
    texturaViga(VIGAS[0], x);
    x.save(); x.globalCompositeOperation = 'destination-out'; pilar(x, -1, 1.2); x.fill(); pilar(x, 1, 1.2); x.fill(); x.restore();
    rojo(function (c) { pilar(c, -1); c.fill(); pilar(c, 1); c.fill(); }, 5, [cx - Sp / 2 - d0, yP - soriK - 4, cx + Sp / 2 + d0, g + 2]);
    rojo(function (c) { c.fillRect(cx - d0 * 0.24, yP - 2, d0 * 0.48, yN - yP + 3); var v = VIGAS[1]; viga(c, v.x0, v.x1, v.f, v.t, v.s); c.fill(); }, 7, [cx - lS / 2 - 4, yK - soriK, cx + lS / 2 + 4, yN + 4]);
    yield 'torii 2';
    // 2 · los pilares: el pigmento en los bordes, pinceladas de arriba abajo que se secan, la sombra y el brillo
    for (var ps = 0; ps < 2; ps++) {
      var sg = ps ? 1 : -1;
      var p = pie(sg), xb = p.xb, xt = p.xt, k;
      function vertical(f, y0, y1) { return [[lerp(xt, xb, y0) + f * lerp(d1, d0, y0), lerp(p.yt, g, y0)], [lerp(xt, xb, (y0 + y1) / 2) + f * lerp(d1, d0, (y0 + y1) / 2) + (r() - 0.5) * d0 * 0.04, lerp(p.yt, g, (y0 + y1) / 2)], [lerp(xt, xb, y1) + f * lerp(d1, d0, y1), lerp(p.yt, g, y1)]]; }
      x.save(); pilar(x, sg); x.clip();
      for (k = 0; k < 4; k++) trazo(x, vertical(-0.36 + k * 0.24 + (r() - 0.5) * 0.06, -0.02, 1.02), d0 * (0.26 + r() * 0.1), 0.3 + r() * 0.14, r, { color: k === 2 ? OSC : ROJO, seco: 0.7 + r() * 0.25, carga: 0.75 + r() * 0.25, entrada: 0.02, salida: 0.12, rugoso: 0.45, cerdas: 11 });
      trazo(x, vertical(-0.5, -0.02, 1.02), d0 * 0.16, 0.38, r, { color: OSC, seco: 0.6, carga: 0.9, entrada: 0.02, salida: 0.1, rugoso: 0.5, cerdas: 8 });
      trazo(x, vertical(0.5, -0.02, 1.02), d0 * 0.2, 0.6, r, { color: OSC, seco: 0.5, carga: 1, entrada: 0.02, salida: 0.1, rugoso: 0.5, cerdas: 8 });
      var gr = x.createLinearGradient(xb - d0 / 2, 0, xb + d0 / 2, 0); gr.addColorStop(0, rgba(OSC, 0)); gr.addColorStop(0.45, rgba(OSC, 0.05)); gr.addColorStop(0.75, rgba(OSC, 0.3)); gr.addColorStop(1, rgba(OSC, 0.62));
      x.fillStyle = gr; x.fillRect(xb - d0, p.yt, d0 * 2, g - p.yt);
      var gs = x.createLinearGradient(0, p.yt, 0, p.yt + d0 * 1.6); gs.addColorStop(0, rgba(OSC, 0.62)); gs.addColorStop(1, rgba(OSC, 0)); x.fillStyle = gs; x.fillRect(xb - d0, p.yt, d0 * 2, d0 * 1.6);
      var gn = x.createLinearGradient(0, yN + tN, 0, yN + tN + d0 * 1.2); gn.addColorStop(0, rgba(OSC, 0.5)); gn.addColorStop(1, rgba(OSC, 0)); x.fillStyle = gn; x.fillRect(xb - d0, yN + tN, d0 * 2, d0 * 1.2);
      var gb = x.createLinearGradient(0, g - d0 * 4.5, 0, g - kh); gb.addColorStop(0, rgba(OSC, 0)); gb.addColorStop(1, rgba(OSC, 0.4)); x.fillStyle = gb; x.fillRect(xb - d0, g - d0 * 4.5, d0 * 2, d0 * 4.5);
      // pincel seco: vetas oscuras y vetas claras (el papel que asoma), más en la mitad de abajo
      trazo(x, vertical(0.2, 0.08, 0.95), d0 * 0.2, 0.45, r, { color: OSC, rasgado: 0.8, seco: 0.85, entrada: 0.1, salida: 0.3 });
      trazo(x, vertical(-0.05, 0.35, 0.97), d0 * 0.14, 0.4, r, { color: OSC, rasgado: 0.9, seco: 0.9, entrada: 0.2, salida: 0.4 });
      trazo(x, vertical(-0.26, 0.04, 0.92), d0 * 0.14, 0.22, r, { color: pap, rasgado: 0.9, seco: 0.9, entrada: 0.2, salida: 0.4 });
      trazo(x, vertical(-0.1, 0.4, 0.98), d0 * 0.1, 0.2, r, { color: pap, rasgado: 0.92, seco: 0.9, entrada: 0.2, salida: 0.4 });
      x.restore();
      // el canto de la sombra, a tinta diluida y a tramos; el anillo de arriba (daiwa)
      recta(K.x, [xt + d1 / 2, p.yt + d0 * 0.3], [xb + d0 / 2, g - d0], Math.max(0.8, d0 * 0.06), 0.42, r, { seco: 0.7, tramos: true });
      recta(K.x, [xt - d1 / 2, yN + tN + d0 * 0.4], [xb - d0 / 2, g - d0 * 1.3], Math.max(0.6, d0 * 0.035), 0.2, r, { seco: 0.8, tramos: true });
      K.x.fillStyle = rgba(TINTA, 0.88); K.x.fillRect(xt - d1 * 0.56, p.yt, d1 * 1.12, Math.max(1, d0 * 0.14));
      // la base negra (kamaki), con su anillo, blanco volante y la tinta que se encharca al pie
      aguada(K.x, w, h, function (c) { c.beginPath(); c.moveTo(xb - d0 * 0.6, g - kh); c.lineTo(xb + d0 * 0.6, g - kh); c.lineTo(xb + d0 * 0.67, g); c.lineTo(xb - d0 * 0.67, g); c.closePath(); c.fill(); c.beginPath(); c.ellipse(xb + d0 * 0.05, g - d0 * 0.05, d0 * 0.95, d0 * 0.12, 0, 0, TAU); c.fill(); }, { gris: 0.92, nubes: 0.3, grano: 0.3, borde: 0.6, suave: 0.6, semilla: 61 + sg, caja: [xb - d0 * 1.2, g - kh - 4, xb + d0 * 1.2, h] });
      K.x.fillStyle = rgba(TINTA, 0.95); K.x.fillRect(xb - d0 * 0.64, g - kh - d0 * 0.09, d0 * 1.28, Math.max(1, d0 * 0.11));
      K.x.save(); K.x.globalCompositeOperation = 'destination-out';
      trazo(K.x, [[xb - d0 * 0.32, g - kh * 0.86], [xb - d0 * 0.36, g - kh * 0.15]], d0 * 0.14, 0.5, r, { rasgado: 0.85, seco: 0.85, entrada: 0.2, salida: 0.3 });
      trazo(K.x, [[xb - d0 * 0.1, g - kh * 0.8], [xb - d0 * 0.12, g - kh * 0.3]], d0 * 0.08, 0.35, r, { rasgado: 0.9, seco: 0.9, entrada: 0.2, salida: 0.3 });
      K.x.restore();
      yield 'torii pilar';
    }
    yield 'torii 3';
    // 3 · el shimaki: pinceladas horizontales, la sombra de abajo y el canto (el nuki ya se pintó, detrás de los pilares)
    texturaViga(VIGAS[1], K.x);
    function texturaViga(v, kc) {
      x.save(); viga(x, v.x0, v.x1, v.f, v.t, v.s); x.clip();
      for (var j = 0; j < 4; j++) {
        var pts = [], f2 = [0.15, 0.45, 0.78, 0.95][j];
        for (var i2 = 0; i2 <= 20; i2++) { var xx = lerp(v.x0 - 4, v.x1 + 4, i2 / 20); pts.push([xx, v.f(xx) + v.t * f2]); }
        trazo(x, j % 2 ? pts.reverse() : pts, v.t * (j === 3 ? 0.3 : 0.5), j === 3 ? 0.55 : 0.24, r, { color: j >= 2 ? OSC : ROJO, seco: 0.8, rasgado: j === 2 ? 0.7 : 0, entrada: 0.03, salida: 0.12, rugoso: 0.4, cerdas: j === 2 ? 0 : 9 });
      }
      var bt = []; for (var i3 = 0; i3 <= 20; i3++) { var x3 = lerp(v.x0, v.x1, i3 / 20); bt.push([x3, v.f(x3) + v.t * 0.25]); }
      trazo(x, bt, v.t * 0.12, 0.3, r, { color: pap, rasgado: 0.8, seco: 0.85, entrada: 0.2, salida: 0.3 });
      x.restore();
      var bb = []; for (var i4 = 0; i4 <= 16; i4++) { var x4 = lerp(v.x0, v.x1, i4 / 16); bb.push([x4, v.f(x4) + v.t]); }
      trazo(kc, bb, Math.max(0.8, v.t * 0.09), 0.35, r, { seco: 0.7, entrada: 0.05, salida: 0.2 });
    }
    // las cuñas (kusabi) del nuki, por fuera de los pilares
    [-1, 1].forEach(function (sg) { var kx = cx + sg * (Sp / 2 + d0 * 0.62); K.x.fillStyle = rgba(TINTA, 0.6); K.x.fillRect(kx - d0 * 0.07, yN + tN * 0.12, d0 * 0.14, tN * 0.76); });
    yield 'torii 4';
    // 4 · el kasagi: negro, de puntas levantadas y cortadas en bisel, con el blanco volante del pincel
    var nK = 60, top = [], bot = [];
    for (i = 0; i <= nK; i++) {
      var u = -1 + 2 * i / nK, xa = cx + u * Lk / 2, xb2 = cx + u * (Lk / 2 - tK * 0.5);
      top.push([xa, yK - sube(xa) + temb(xa, 71)]);
      bot.push([xb2, yK + tK * (1 + 0.18 * Math.pow(Math.abs(u), 3)) - sube(xb2) + temb(xb2, 79)]);
    }
    var Kk = capa(w, h, 'Kk');
    aguada(Kk.x, w, h, function (c) {
      c.beginPath(); top.forEach(function (p, j) { if (j) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); });
      for (var j2 = nK; j2 >= 0; j2--) c.lineTo(bot[j2][0], bot[j2][1]);
      c.closePath(); c.fill();
    }, { gris: 0.96, nubes: 0.22, grano: 0.22, suave: 0.6, borde: 0.8, semilla: 67, caja: [cx - Lk / 2 - 6, yK - soriK - 6, cx + Lk / 2 + 6, yK + tK * 1.4 + 6] });
    Kk.x.save(); Kk.x.globalCompositeOperation = 'destination-out';
    for (var v2 = 0; v2 < 7; v2++) {
      var lado = v2 % 2 ? 1 : -1, off = (r() - 0.5) * 0.6, ini = 0.08 + r() * 0.4, fin = Math.min(0.99, ini + 0.25 + r() * 0.45), tr = [];
      for (var q = 0; q <= 12; q++) { var uu = lado * lerp(ini, fin, q / 12), idx = Math.round((uu + 1) / 2 * nK); tr.push([lerp(top[idx][0], bot[idx][0], 0.5), lerp(top[idx][1], bot[idx][1], 0.5 + off)]); }
      trazo(Kk.x, tr, tK * (0.07 + r() * 0.12), 0.55, r, { rasgado: 0.9, seco: 0.85, entrada: 0.3, salida: 0.3 });
    }
    Kk.x.restore();
    trazo(Kk.x, top.slice(4, nK - 3).map(function (p) { return [p[0], p[1] + tK * 0.16]; }), Math.max(0.8, tK * 0.12), 0.22, r, { color: pap, rasgado: 0.55, seco: 0.7, entrada: 0.1, salida: 0.15 });
    K.x.drawImage(Kk.c, 0, 0, w + MG, h + MG, 0, 0, w + MG, h + MG);
    yield 'torii 5';
    // 5 · la placa (gaku): negra, con marco de oro y 神
    var ph = (yN - yP) * 0.84, pw = ph * 0.62, py = (yP + yN) / 2;
    aguada(K.x, w, h, function (c) { c.fillRect(cx - pw / 2, py - ph / 2, pw, ph); }, { gris: 0.95, nubes: 0.15, grano: 0.15, suave: 0.5, borde: 0.6, semilla: 73, caja: [cx - pw, py - ph, cx + pw, py + ph] });
    K.x.strokeStyle = rgba(ORO, 0.85); K.x.lineWidth = Math.max(0.8, pw * 0.05); K.x.strokeRect(cx - pw / 2 + pw * 0.1, py - ph / 2 + pw * 0.1, pw - pw * 0.2, ph - pw * 0.2);
    K.x.font = Math.round(pw * 0.6) + 'px "Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", serif'; K.x.textAlign = 'center'; K.x.textBaseline = 'middle';
    K.x.fillStyle = rgba(ORO, 0.95); K.x.fillText('神', cx, py + pw * 0.02);
    conHalo(x, K, Math.max(1, d0 * 0.07), 0.3);
    L.base = [cx, h]; L.ancho = Sp;
    return L;
  };
  A.torii = function (w, h, op) { return correr(A.toriiPasos(w, h, op)); };


  /* ------------------------------------------------------------------ la linterna de piedra (tōrō, estilo Kasuga)
     Piezas de piedra hexagonales, vistas un poco desde arriba: se ven tres caras (la izquierda a la luz, la de frente y la
     derecha en sombra) y la tapa de las de abajo. La base con pétalos vueltos, el fuste con su anillo, la plataforma de
     loto, la caja del fuego con la ventana de papel (y un ciervo y la luna en las caras), el tejado de puntas enroscadas
     (warabite) y la joya. Aguada moteada, contornos a pincel seco, liquen y musgo.
     op: semilla, tono, papel, luz (0…1: la ventana encendida y su halo). Anclaje: L.base. Proporción buena: w ≈ 0,6 · h. */
  A.linterna = function (w, h, op) {
    op = op || {};
    var L = T.lienzo(w, h), x = L.x, r = T.azar(op.semilla || 81), pap = papelDe(op), tono = op.tono == null ? 1 : op.tono;
    var S = Math.min(h, w / 0.6), cx = w / 2, b = h - 1, luz = op.luz || 0, K = capa(w, h), E = 0.16, i;
    function X(f) { return cx + f * S; }
    function Y(f) { return b - f * S; }
    // los cuatro vértices visibles de un hexágono de radio R a la altura f: lados (±R) y esquinas delanteras (±R/2, más abajo)
    function hexa(f, R) { var d = E * 0.866 * R * S; return [[X(-R), Y(f)], [X(-R / 2), Y(f) + d], [X(R / 2), Y(f) + d], [X(R), Y(f)]]; }
    function hexaAtras(f, R) { var d = E * 0.866 * R * S; return [[X(R / 2), Y(f) - d], [X(-R / 2), Y(f) - d]]; }
    // un tronco de prisma: caras [izquierda, frente, derecha] y la tapa (si se ve)
    function prisma(f0, f1, R0, R1) {
      var a = hexa(f0, R0), c = hexa(f1, R1), t = hexaAtras(f1, R1);
      return { caras: [[a[0], a[1], c[1], c[0]], [a[1], a[2], c[2], c[1]], [a[2], a[3], c[3], c[2]]], tapa: [c[0], c[1], c[2], c[3], t[0], t[1]], arriba: c, abajo: a };
    }
    function poli(c, p) { c.beginPath(); p.forEach(function (q, j) { if (j) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); }); c.closePath(); }
    var PZ = {
      kiso: prisma(0, 0.045, 0.21, 0.205), loto: prisma(0.045, 0.088, 0.19, 0.075),
      chudai: prisma(0.47, 0.535, 0.08, 0.19), losa: prisma(0.535, 0.562, 0.195, 0.195),
      caja: prisma(0.562, 0.715, 0.13, 0.13), joyaBase: prisma(0.85, 0.872, 0.045, 0.055)
    };
    var VAL = [0.32, 0.5, 0.82];   // izquierda, frente, derecha
    var ALE = 0.73, RK = 0.27, APX = 0.85;   // el tejado: alero, radio y ápice
    var eave = hexa(ALE, RK), apice = [X(0), Y(APX)];
    function caraTejado(j) { return [eave[j], eave[j + 1], apice]; }
    // la silueta entera como un camino (para el papel de debajo y para recortar motas, liquen y musgo)
    function silueta(c) {
      c.beginPath();
      function sub(p) { p.forEach(function (q, j) { if (j) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); }); c.closePath(); }
      ['kiso', 'loto', 'chudai', 'losa', 'caja', 'joyaBase'].forEach(function (k) { PZ[k].caras.forEach(sub); sub(PZ[k].tapa); });
      c.rect(X(-0.056), Y(0.47), S * 0.112, S * (0.47 - 0.085));
      for (var j = 0; j < 3; j++) sub(caraTejado(j));
      sub([eave[0], eave[1], eave[2], eave[3], [eave[3][0], eave[3][1] + S * 0.025], [eave[2][0], eave[2][1] + S * 0.025], [eave[1][0], eave[1][1] + S * 0.025], [eave[0][0], eave[0][1] + S * 0.025]]);
    }
    // 0 · el papel debajo (la piedra tapa)
    x.fillStyle = rgba(pap, 1); silueta(x); x.fill('nonzero');
    // 1 · la piedra: cada cara con su valor; el fuste redondo; la sombra bajo el tejado y bajo la losa
    aguada(x, w, h, function (c) {
      ['kiso', 'loto', 'chudai', 'losa', 'caja', 'joyaBase'].forEach(function (k) {
        PZ[k].caras.forEach(function (cara, j) { c.fillStyle = 'rgba(0,0,0,' + VAL[j] + ')'; poli(c, cara); c.fill(); });
        c.fillStyle = 'rgba(0,0,0,0.18)'; poli(c, PZ[k].tapa); c.fill();
      });
      var gf = c.createLinearGradient(X(-0.056), 0, X(0.056), 0); gf.addColorStop(0, 'rgba(0,0,0,0.3)'); gf.addColorStop(0.4, 'rgba(0,0,0,0.42)'); gf.addColorStop(1, 'rgba(0,0,0,0.85)');
      c.fillStyle = gf; c.fillRect(X(-0.056), Y(0.47), S * 0.112, S * (0.47 - 0.085));
      for (var j = 0; j < 3; j++) { c.fillStyle = 'rgba(0,0,0,' + [0.42, 0.56, 0.88][j] + ')'; poli(c, caraTejado(j)); c.fill(); }
      c.fillStyle = 'rgba(0,0,0,0.92)'; poli(c, [eave[0], eave[1], eave[2], eave[3], [eave[3][0], eave[3][1] + S * 0.025], [eave[2][0], eave[2][1] + S * 0.025], [eave[1][0], eave[1][1] + S * 0.025], [eave[0][0], eave[0][1] + S * 0.025]]); c.fill();
      var gs = c.createLinearGradient(0, Y(0.715), 0, Y(0.66)); gs.addColorStop(0, 'rgba(0,0,0,0.6)'); gs.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gs; c.fillRect(X(-0.14), Y(0.715), S * 0.28, S * 0.06);
      var gl = c.createLinearGradient(0, Y(0.47), 0, Y(0.43)); gl.addColorStop(0, 'rgba(0,0,0,0.6)'); gl.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gl; c.fillRect(X(-0.06), Y(0.47), S * 0.12, S * 0.05);
    }, { gris: 0.66 * tono, nubes: 0.6, grano: 0.5, suave: Math.max(0.6, S * 0.0035), borde: 0.7, semilla: 37 });
    // la piedra: motas oscuras, liquen claro y vetas de pincel seco
    x.save(); silueta(x); x.clip();
    var motas = [];
    for (i = 0; i < 60; i++) { var my = lerp(0.01, 0.84, r()), mx = (r() - 0.5) * (my > 0.72 ? 0.46 : my > 0.47 && my < 0.56 ? 0.34 : my < 0.09 ? 0.38 : 0.1); motas.push([X(mx), Y(my), X(mx) + S * 0.003, Y(my) + S * 0.002, X(mx), Y(my)]); }
    marcas(x, motas, Math.max(0.6, S * 0.006), TINTA, 0.35 * tono);
    for (i = 0; i < 8; i++) { var ly = lerp(0.03, 0.8, r()), lx = (r() - 0.65) * 0.14; x.fillStyle = rgba(pap, 0.15 + r() * 0.2); x.beginPath(); x.ellipse(X(lx), Y(ly), S * (0.01 + r() * 0.018), S * (0.006 + r() * 0.009), r() * 3, 0, TAU); x.fill(); }
    x.restore();
    x.save(); x.beginPath(); x.rect(X(-0.056), Y(0.47), S * 0.112, S * 0.385); x.clip();
    trazo(x, [[X(0.025), Y(0.46)], [X(0.03), Y(0.3)], [X(0.028), Y(0.1)]], S * 0.025, 0.35 * tono, r, { rasgado: 0.85, seco: 0.85, entrada: 0.1, salida: 0.3 });
    trazo(x, [[X(-0.03), Y(0.44)], [X(-0.028), Y(0.2)]], S * 0.016, 0.3, r, { color: pap, rasgado: 0.8, seco: 0.85, entrada: 0.2, salida: 0.4 });
    x.restore();
    // la ventana (hi-guchi) en la cara de frente: papel, o la luz con su halo
    var fc = PZ.caja.caras[1], vx0 = lerp(fc[0][0], fc[1][0], 0.24), vx1 = lerp(fc[0][0], fc[1][0], 0.76), vy1 = Y(0.592) + E * 0.866 * 0.13 * S, vy0 = Y(0.69) + E * 0.866 * 0.13 * S;
    if (luz) {
      var gl2 = x.createRadialGradient(cx, (vy0 + vy1) / 2, 0, cx, (vy0 + vy1) / 2, S * 0.4); gl2.addColorStop(0, 'rgba(255,212,140,' + (0.7 * luz).toFixed(3) + ')'); gl2.addColorStop(0.3, 'rgba(255,196,120,' + (0.28 * luz).toFixed(3) + ')'); gl2.addColorStop(1, 'rgba(255,196,120,0)');
      x.fillStyle = gl2; x.fillRect(0, 0, w, h);
      var gw = x.createLinearGradient(0, vy0, 0, vy1); gw.addColorStop(0, 'rgba(255,238,196,0.98)'); gw.addColorStop(1, 'rgba(255,192,104,0.98)'); x.fillStyle = gw;
    } else x.fillStyle = rgba(pap, 0.95);
    x.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
    x.fillStyle = rgba(TINTA, (luz ? 0.3 : 0.45) * tono); x.fillRect(vx0, vy0, vx1 - vx0, (vy1 - vy0) * 0.14); x.fillRect(vx1 - (vx1 - vx0) * 0.16, vy0, (vx1 - vx0) * 0.16, vy1 - vy0);
    // el ciervo (cara izquierda) y la luna (cara derecha), sugeridos
    var cl = PZ.caja.caras[0], cdr = PZ.caja.caras[2];
    var dx0 = lerp(cl[0][0], cl[1][0], 0.5), dy0 = Y(0.64);
    trazo(K.x, [[dx0 - S * 0.012, dy0 + S * 0.012], [dx0 - S * 0.004, dy0], [dx0 + S * 0.008, dy0 - S * 0.004], [dx0 + S * 0.012, dy0 - S * 0.02]], Math.max(0.6, S * 0.006), 0.5 * tono, r, { seco: 0.6 });
    K.x.fillStyle = rgba(pap, 0.55); K.x.beginPath(); K.x.arc(lerp(cdr[0][0], cdr[1][0], 0.5), Y(0.655), S * 0.014, 0, TAU); K.x.fill();
    // 2 · los cantos a pincel seco: las aristas entre caras, los bordes de las tapas y el contorno
    ['kiso', 'loto', 'chudai', 'losa', 'caja', 'joyaBase'].forEach(function (k) {
      var p = PZ[k], ar = p.arriba, ab = p.abajo, gros = Math.max(0.6, S * 0.006);
      for (var j = 0; j < 4; j++) recta(K.x, ab[j], ar[j], gros * (j === 3 ? 1.5 : j === 0 ? 0.8 : 1.1), (j === 3 ? 0.85 : j === 0 ? 0.45 : 0.65) * tono, r, { seco: 0.6, temblor: 0.2, tramos: j === 1 });
      for (var j2 = 0; j2 < 3; j2++) { recta(K.x, ar[j2], ar[j2 + 1], gros, 0.6 * tono, r, { seco: 0.6, temblor: 0.2 }); if (r() < 0.8) recta(K.x, ab[j2], ab[j2 + 1], gros * 0.9, 0.5 * tono, r, { seco: 0.7, temblor: 0.2 }); }
    });
    recta(K.x, [X(-0.056), Y(0.47)], [X(-0.056), Y(0.088)], Math.max(0.6, S * 0.005), 0.45 * tono, r, { seco: 0.6, tramos: true });
    recta(K.x, [X(0.056), Y(0.47)], [X(0.056), Y(0.088)], Math.max(0.7, S * 0.008), 0.8 * tono, r, { seco: 0.5 });
    // los pétalos: vueltos hacia abajo en la base, hacia arriba en la plataforma; el anillo del fuste
    var pet = [];
    [0, 1, 2].forEach(function (j) {
      var cb = PZ.loto.caras[j], cp = PZ.chudai.caras[j], nP = j === 1 ? 3 : 2;
      for (var k = 0; k < nP; k++) {
        var f = (k + 0.5) / nP, a1 = [lerp(cb[0][0], cb[1][0], f), lerp(cb[0][1], cb[1][1], f)], t1 = [lerp(cb[3][0], cb[2][0], f), lerp(cb[3][1], cb[2][1], f)], wp = Math.abs(cb[1][0] - cb[0][0]) / nP * 0.45;
        pet.push([a1[0] - wp, a1[1] - S * 0.004, a1[0] + wp, a1[1] - S * 0.004, lerp(a1[0], t1[0], 0.6), lerp(a1[1], t1[1], 0.75)]);
        var a2 = [lerp(cp[3][0], cp[2][0], f), lerp(cp[3][1], cp[2][1], f)], b2 = [lerp(cp[0][0], cp[1][0], f), lerp(cp[0][1], cp[1][1], f)], wq = Math.abs(cp[2][0] - cp[3][0]) / nP * 0.45;
        pet.push([a2[0] - wq, a2[1] + S * 0.004, a2[0] + wq, a2[1] + S * 0.004, lerp(a2[0], b2[0], 0.6), lerp(a2[1], b2[1], 0.8)]);
      }
    });
    marcas(K.x, pet, Math.max(0.6, S * 0.0045), TINTA, 0.5 * tono);
    recta(K.x, [X(-0.057), Y(0.285)], [X(0.057), Y(0.285)], Math.max(0.8, S * 0.008), 0.7 * tono, r, {});
    recta(K.x, [X(-0.057), Y(0.268)], [X(0.057), Y(0.268)], Math.max(0.6, S * 0.005), 0.5 * tono, r, {});
    // el tejado: el alero de un trazo por las tres caras, las limas hasta el ápice y las puntas enroscadas (warabite)
    var cant = Math.max(1, S * 0.016);
    for (i = 0; i < 3; i++) trazo(K.x, [eave[i], [lerp(eave[i][0], eave[i + 1][0], 0.5), lerp(eave[i][1], eave[i + 1][1], 0.5) + S * 0.004], eave[i + 1]], cant, 0.9 * tono, r, { entrada: 0.05, salida: 0.15, seco: 0.35, rugoso: 0.3 });
    for (i = 0; i < 4; i++) trazo(K.x, [eave[i], [lerp(eave[i][0], apice[0], 0.5) + (i < 2 ? 1 : -1) * S * 0.008, lerp(eave[i][1], apice[1], 0.5) + S * 0.01], apice], Math.max(0.7, S * (i === 3 ? 0.009 : 0.006)), (i === 3 ? 0.85 : 0.6) * tono, r, { seco: 0.5, entrada: 0.05, salida: 0.3 });
    eave.forEach(function (p, j) {
      var sg = j < 2 ? -1 : 1, lado2 = j === 0 || j === 3, s2 = S * (lado2 ? 1 : 0.75);
      trazo(K.x, [[p[0] - sg * s2 * 0.02, p[1] + s2 * 0.006], [p[0] + sg * s2 * 0.008, p[1] - s2 * 0.004], [p[0] + sg * s2 * 0.008, p[1] - s2 * 0.024], [p[0] - sg * s2 * 0.008, p[1] - s2 * 0.028], [p[0] - sg * s2 * 0.01, p[1] - s2 * 0.016]], Math.max(0.9, s2 * 0.012), 0.9 * tono, r, { entrada: 0.05, salida: 0.45, seco: 0.35 });
    });
    // la joya (hōju) sobre su flor
    var jy = Y(0.872), jb = S * 0.045;
    aguada(K.x, w, h, function (c) { c.beginPath(); c.moveTo(cx - jb, jy); c.bezierCurveTo(cx - jb * 1.35, jy - S * 0.045, cx - jb * 0.3, jy - S * 0.07, cx, jy - S * 0.105); c.bezierCurveTo(cx + jb * 0.3, jy - S * 0.07, cx + jb * 1.35, jy - S * 0.045, cx + jb, jy); c.closePath(); c.fill(); }, { gris: 0.5 * tono, nubes: 0.4, grano: 0.4, suave: 0.6, borde: 0.8, semilla: 41 });
    trazo(K.x, [[cx + jb * 0.95, jy - S * 0.002], [cx + jb * 1.05, jy - S * 0.04], [cx + jb * 0.2, jy - S * 0.085], [cx, jy - S * 0.105]], Math.max(0.6, S * 0.007), 0.8 * tono, r, { seco: 0.5, entrada: 0.05, salida: 0.4 });
    trazo(K.x, [[cx - jb * 0.95, jy - S * 0.002], [cx - jb * 1.05, jy - S * 0.04], [cx - jb * 0.2, jy - S * 0.085], [cx, jy - S * 0.105]], Math.max(0.5, S * 0.004), 0.45 * tono, r, { seco: 0.6, entrada: 0.05, salida: 0.4 });
    // 3 · el musgo: toques oscuros en las tapas (la base, la losa) y en el tejado, cerca del alero
    var mus = [];
    for (i = 0; i < 40; i++) {
      var zona = r(), mx2, my2;
      if (zona < 0.4) { var jj = Math.floor(r() * 3), e0 = eave[jj], e1 = eave[jj + 1], tt = r(); mx2 = lerp(e0[0], e1[0], tt); my2 = lerp(e0[1], e1[1], tt) - S * (0.008 + r() * 0.02); }
      else if (zona < 0.6) { mx2 = X((r() - 0.5) * 0.34); my2 = Y(0.562) + S * r() * 0.02; }
      else { mx2 = X((r() - 0.5) * 0.38); my2 = Y(0.045) + S * (r() * 0.03 - 0.005); }
      mus.push([mx2, my2, mx2 + S * (r() - 0.5) * 0.012, my2 + S * 0.003, mx2, my2 - S * 0.004]);
    }
    K.x.save(); silueta(K.x); K.x.clip();
    marcas(K.x, mus, Math.max(0.8, S * 0.009), TINTA, 0.55 * tono);
    K.x.restore();
    conHalo(x, K, Math.max(1, S * 0.006), 0.3 * tono);
    L.base = [cx, h];
    return L;
  };

  /* ------------------------------------------------------------------ el junco de guerra (la flota de 1281)
     De lado y de lejos: casco oscuro de popa alta y saliente, la caseta de popa, velas al tercio con sables (paneles de
     aguada que se hinchan entre las cañas, cañas oscuras), mástiles, cabos y banderolas. Se lee de pequeño (60–120 px).
     op: semilla, tono, papel, espejo (proa a la derecha), mastiles (2 o 3), bandera ([r,g,b]).
     Anclaje: L.linea (y de la línea de flotación; el casco no baja de ella). Proporción buena: cuadrado. */
  A.junco = function (w, h, op) {
    op = op || {};
    var L = T.lienzo(w, h), x = L.x, r = T.azar(op.semilla || 91), pap = papelDe(op), tono = op.tono == null ? 1 : op.tono;
    var lin = h * 0.86, x0 = w * 0.04, x1 = w * 0.96, lh = x1 - x0, S = Math.min(lh, h), K = capa(w, h);
    if (op.espejo) { x.setTransform(-1, 0, 0, 1, w, 0); K.x.setTransform(-1, 0, 0, 1, w, 0); }
    function X(f) { return x0 + f * lh; }
    function Y(f) { return lin + f * S; }
    var popa = 0.2 + r() * 0.04, proa = 0.125 + r() * 0.03, cint = 0.085 + r() * 0.015;
    // la borda, de proa a popa (en S, negativo = arriba): baja en el centro y sube mucho hacia la popa
    function regala(f) { return f < 0.45 ? -lerp(proa, cint, Math.pow(f / 0.45, 0.7)) : -lerp(cint, popa, Math.pow(Math.min(1, (f - 0.45) / 0.5), 1.7)); }
    var casco = [];
    for (var i = 0; i <= 20; i++) { var fi = 0.02 + i / 20 * 0.93; casco.push([fi, regala(fi)]); }
    casco.push([1.0, -popa - 0.012], [0.99, -popa * 0.6], [0.965, -0.035], [0.91, 0], [0.13, 0], [0.05, -proa * 0.35], [0.0, -proa * 0.95]);
    var nm = op.mastiles || (r() < 0.75 ? 3 : 2);
    var MAST = nm === 3 ? [{ f: 0.2, alto: 0.6, inc: -0.12, vw: 0.25, vh: 0.38 }, { f: 0.47, alto: 0.8, inc: 0, vw: 0.34, vh: 0.55 }, { f: 0.75, alto: 0.58, inc: 0.04, vw: 0.22, vh: 0.33 }]
      : [{ f: 0.3, alto: 0.74, inc: -0.06, vw: 0.32, vh: 0.5 }, { f: 0.68, alto: 0.62, inc: 0.03, vw: 0.26, vh: 0.38 }];
    MAST.forEach(function (m) { m.alto *= 0.92 + r() * 0.16; m.vh *= 0.92 + r() * 0.16; m.vw *= 0.92 + r() * 0.16; });
    // 1 · las velas: papel, aguada por paneles que se hinchan, las cañas oscuras y los bordes
    MAST.forEach(function (m, idx) {
      var bx = X(m.f), by = Y(regala(m.f)), tx = bx + Math.sin(m.inc) * m.alto * S, ty = Y(-m.alto);
      m.base = [bx, by]; m.cima = [tx, ty];
      var pie = by - S * (0.04 + 0.015 * (idx % 2)), vh = m.vh * S, vw = m.vw * S;
      // u: hacia popa (en vw), v: hacia arriba (en vh), desde el pie y junto al mástil
      function V(u, v) { var yy = pie - v * vh, kk = (by - yy) / (by - ty), mx = lerp(bx, tx, kk); return [mx + u * vw, yy]; }
      var nB = Math.max(4, Math.min(7, Math.round(vh / Math.max(4, S * 0.075)))), sables = [], i2;
      for (i2 = 0; i2 <= nB; i2++) { var f2 = i2 / nB; sables.push({ a: V(-0.14, f2 * 0.8), b: V(0.84 + 0.1 * Math.sin(Math.PI * f2) + 0.04 * f2, 0.04 + f2 * 0.96) }); }
      function forma(c) {
        c.beginPath(); c.moveTo(sables[0].a[0], sables[0].a[1]);
        for (var j = 0; j <= nB; j++) c.lineTo(sables[j].a[0], sables[j].a[1]);
        c.lineTo(sables[nB].b[0], sables[nB].b[1]);
        for (var j2 = nB; j2 > 0; j2--) { var p = sables[j2].b, q = sables[j2 - 1].b; c.quadraticCurveTo((p[0] + q[0]) / 2 + vw * 0.07, (p[1] + q[1]) / 2, q[0], q[1]); }
        c.closePath();
      }
      x.fillStyle = rgba(pap, 1); forma(x); x.fill();
      aguada(x, w, h, function (c) {
        forma(c); c.save(); c.clip();
        for (var j = 0; j < nB; j++) {
          var s0 = sables[j], s1 = sables[j + 1], gg = c.createLinearGradient(0, s1.b[1], 0, s0.a[1]);
          var base = 0.32 + 0.3 * T.h1(j * 7 + idx * 3 + 1);
          gg.addColorStop(0, 'rgba(0,0,0,' + (base * 0.6).toFixed(3) + ')'); gg.addColorStop(1, 'rgba(0,0,0,' + (base + 0.25).toFixed(3) + ')');
          c.fillStyle = gg; c.beginPath(); c.moveTo(s0.a[0] - 2, s0.a[1]); c.lineTo(s0.b[0] + vw * 0.2, s0.b[1]); c.lineTo(s1.b[0] + vw * 0.2, s1.b[1]); c.lineTo(s1.a[0] - 2, s1.a[1]); c.closePath(); c.fill();
        }
        var gs = c.createLinearGradient(bx, 0, bx + vw, 0); gs.addColorStop(0, 'rgba(0,0,0,0.25)'); gs.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gs; c.fillRect(bx - vw * 0.2, ty, vw * 1.3, by - ty);
        c.restore();
      }, { gris: 0.5 * tono, nubes: 0.45, grano: 0.35, suave: Math.max(0.5, S * 0.004), borde: 0.7, semilla: 43 + idx });
      for (i2 = 1; i2 < nB; i2++) trazo(K.x, [sables[i2].a, [lerp(sables[i2].a[0], sables[i2].b[0], 0.5), lerp(sables[i2].a[1], sables[i2].b[1], 0.5) + S * 0.004], sables[i2].b], Math.max(0.65, S * 0.0085), 0.8 * tono, r, { entrada: 0.05, salida: 0.2, seco: 0.35 });
      trazo(K.x, [sables[nB].a, [lerp(sables[nB].a[0], sables[nB].b[0], 0.5), lerp(sables[nB].a[1], sables[nB].b[1], 0.5) - S * 0.004], sables[nB].b], Math.max(0.8, S * 0.012), 0.9 * tono, r, { seco: 0.3, salida: 0.2 });
      trazo(K.x, [sables[0].a, sables[0].b], Math.max(0.8, S * 0.011), 0.85 * tono, r, { seco: 0.3 });
      trazo(K.x, sables.map(function (s) { return s.a; }), Math.max(0.6, S * 0.007), 0.6 * tono, r, { seco: 0.5 });
      var bal = []; for (i2 = nB; i2 >= 0; i2--) bal.push([sables[i2].b[0] + (i2 && i2 < nB ? vw * 0.035 : 0), sables[i2].b[1]]);
      trazo(K.x, bal, Math.max(0.5, S * 0.006), 0.5 * tono, r, { seco: 0.6 });
    });
    // 2 · los mástiles, los cabos y las banderolas (ondean hacia popa)
    MAST.forEach(function (m, idx) {
      trazo(K.x, [m.base, [lerp(m.base[0], m.cima[0], 0.5), lerp(m.base[1], m.cima[1], 0.5)], m.cima], Math.max(0.8, S * (idx === 1 || (nm === 2 && idx === 0) ? 0.014 : 0.011)), 0.92 * tono, r, { entrada: 0.02, salida: 0.25, seco: 0.3 });
      var fl = m.cima, fw = S * (0.07 + r() * 0.04), fh = S * 0.026, ond = (r() - 0.5) * S * 0.02;
      K.x.fillStyle = rgba(op.bandera || TINTA, 0.88 * tono); K.x.beginPath(); K.x.moveTo(fl[0], fl[1]);
      K.x.quadraticCurveTo(fl[0] + fw * 0.5, fl[1] - fh * 0.3 + ond, fl[0] + fw, fl[1] + fh * 0.35); K.x.quadraticCurveTo(fl[0] + fw * 0.5, fl[1] + fh * 0.8 + ond, fl[0], fl[1] + fh); K.x.closePath(); K.x.fill();
    });
    var mm = MAST[nm === 3 ? 1 : 0], cabos = [[mm.cima, [X(0.02), Y(-proa)]], [mm.cima, [X(0.985), Y(-popa)]], [MAST[0].cima, [X(0.0), Y(-proa * 0.9)]]];
    marcas(K.x, cabos.map(function (c) { return [c[0][0], c[0][1], c[1][0], c[1][1], lerp(c[0][0], c[1][0], 0.5), lerp(c[0][1], c[1][1], 0.5) + S * 0.01]; }), Math.max(0.45, S * 0.004), TINTA, 0.4 * tono);
    // 3 · el casco: aguada muy oscura, la caseta de popa con su tejadillo, el castillo de proa y el timón
    aguada(x, w, h, function (c) {
      c.beginPath(); casco.forEach(function (p, j) { if (j) c.lineTo(X(p[0]), Y(p[1])); else c.moveTo(X(p[0]), Y(p[1])); }); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(X(0.68), Y(regala(0.68) + 0.004)); c.lineTo(X(0.69), Y(regala(0.69) - 0.05)); c.lineTo(X(0.975), Y(-popa - 0.055)); c.lineTo(X(0.99), Y(-popa)); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(X(0.0), Y(-proa * 0.95)); c.lineTo(X(0.015), Y(-proa - 0.03)); c.lineTo(X(0.13), Y(regala(0.13) - 0.026)); c.lineTo(X(0.14), Y(regala(0.14))); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(X(0.955), Y(-0.07)); c.lineTo(X(1.01), Y(-0.05)); c.lineTo(X(0.995), Y(-0.004)); c.lineTo(X(0.945), Y(-0.004)); c.closePath(); c.fill();
    }, { gris: 0.9 * tono, nubes: 0.25, grano: 0.14, suave: Math.max(0.5, S * 0.003), borde: 0.6, semilla: 47 });
    // la cinta clara de la borda, las tablas (pincel seco claro y oscuro), la línea de agua
    function curvaCasco(dy, f0, f1) { var o = []; for (var j = 0; j <= 10; j++) { var f = lerp(f0, f1, j / 10); o.push([X(f), Y(lerp(regala(f), 0, dy))]); } return o; }
    trazo(x, curvaCasco(0.16, 0.03, 0.93), Math.max(0.7, S * 0.016), 0.4, r, { color: pap, seco: 0.6, rasgado: 0.45, entrada: 0.05, salida: 0.1 });
    trazo(K.x, curvaCasco(0.3, 0.05, 0.92), Math.max(0.6, S * 0.006), 0.7 * tono, r, { seco: 0.5, entrada: 0.05, salida: 0.2 });
    trazo(x, curvaCasco(0.55, 0.1, 0.9), Math.max(0.6, S * 0.01), 0.24, r, { color: pap, seco: 0.8, rasgado: 0.75, entrada: 0.1, salida: 0.2 });
    trazo(x, curvaCasco(0.78, 0.14, 0.88), Math.max(0.6, S * 0.009), 0.18, r, { color: pap, seco: 0.85, rasgado: 0.8, entrada: 0.1, salida: 0.2 });
    trazo(K.x, [[X(0.1), Y(-0.004)], [X(0.5), Y(0.002)], [X(0.91), Y(-0.004)]], Math.max(0.8, S * 0.012), 0.75 * tono, r, { seco: 0.5, entrada: 0.1, salida: 0.2 });
    // el tejadillo de la caseta de popa y sus ventanas
    trazo(K.x, [[X(0.665), Y(regala(0.69) - 0.058)], [X(0.83), Y(-popa - 0.035)], [X(1.0), Y(-popa - 0.07)]], Math.max(0.8, S * 0.014), 0.92 * tono, r, { entrada: 0.05, salida: 0.25, seco: 0.35 });
    x.fillStyle = rgba(pap, 0.62);
    for (var k = 0; k < 4; k++) { var vf = 0.74 + k * 0.055; x.fillRect(X(vf), Y(lerp(regala(vf), -popa - 0.05, 0.55)), Math.max(0.8, S * 0.012), Math.max(0.8, S * 0.014)); }
    if (op.espejo) x.setTransform(1, 0, 0, 1, 0, 0);   // K ya está pintada en espejo
    conHalo(x, K, Math.max(1, S * 0.006), 0.3 * tono);
    L.linea = lin;
    return L;
  };
})();
