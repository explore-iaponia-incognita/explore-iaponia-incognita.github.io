/* Iaponia Incognita · motor
   Un rollo de papel japonés (emakimono) que se recorre en horizontal: cámara con inercia, capas con paralaje,
   papel, un pincel que pinta y se seca, la entrada (rueda, arrastre, táctil, teclado) y las escenas de los secretos.
   Todo en píxeles CSS. La unidad de diseño «u» es la altura de la pantalla: las posiciones del rollo van en u. */
(function () {
  'use strict';
  var SA = window.SA = window.SA || {};
  var TAU = Math.PI * 2;

  /* ------------------------------------------------------------------ utilidades */
  var U = SA.util = {
    clamp: function (x, a, b) { return x < a ? a : x > b ? b : x; },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    tramo: function (t, a, b) { return U.clamp((t - a) / (b - a), 0, 1); },
    suave: function (t) { t = U.clamp(t, 0, 1); return t * t * (3 - 2 * t); },
    entra: function (t) { t = U.clamp(t, 0, 1); return t * t * t; },
    sale: function (t) { t = U.clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); },
    inOut: function (t) { t = U.clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    rebote: function (t) { t = U.clamp(t, 0, 1); var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    meseta: function (t, a, b, c, d) { return t < a || t > d ? 0 : t < b ? U.suave((t - a) / (b - a)) : t > c ? 1 - U.suave((t - c) / (d - c)) : 1; },
    azar: function (semilla) { var s = (semilla | 0) || 1; return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; },
    rgba: function (c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a < 0 ? 0 : a > 1 ? 1 : a).toFixed(3) + ')'; },
    mezcla: function (a, b, t) { return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)]; },
    num: function (x, dec) {
      var s = Math.abs(x).toFixed(dec || 0).split('.'), ent = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      return (x < 0 ? '−' : '') + ent + (s[1] ? ',' + s[1] : '');
    },
    dos: function (n) { return (n < 10 ? '0' : '') + n; },
    // ruido de valor en 1D (suave) y su suma en octavas
    ruido: function (x, semilla) {
      var i = Math.floor(x), f = x - i, a = U._h(i + (semilla | 0) * 131), b = U._h(i + 1 + (semilla | 0) * 131);
      f = f * f * (3 - 2 * f); return a + (b - a) * f;
    },
    _h: function (n) { var s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); },
    fbm: function (x, semilla, oct) { var v = 0, a = 0.5, f = 1; for (var o = 0; o < (oct || 4); o++) { v += U.ruido(x * f, semilla + o * 7) * a; a *= 0.5; f *= 2.03; } return v; }
  };

  SA.color = {
    papel: [238, 230, 212],
    papel2: [226, 215, 193],
    tinta: [27, 24, 21],
    bermellon: [196, 52, 32],
    acento: [196, 52, 32],
    sakura: [226, 150, 150],
    noche: [44, 50, 66]
  };
  var C = SA.color;

  /* ------------------------------------------------------------------ el motor */
  var E = SA.motor = {
    t: 0, W: 800, H: 600, u: 600, dpr: 1,
    largo: 10.6,              // largo del rollo, en u
    camX: 0, velX: 0, empuje: 0, camObj: null,   // camObj: adonde va la cámara (la rueda la mueve y la cámara la sigue con suavidad)
    puntero: { x: -999, y: -999, sobre: false, tipo: 'mouse', vx: 0, vy: 0, velocidad: 0 },
    viento: 0, senal: 0, noche: 0, nieve: 0,
    escena: null, bloqueado: false, ligero: false, lectura: 5000,
    ultimoInput: 0, pincel: true,  // en móvil se puede cambiar a «mover»
    oyentes: {}, capas: []
  };
  var cv, ctx, raf = window.requestAnimationFrame.bind(window), ultimoRaf = null, congelado = false, cam = null, mediaDt = 16, nMedidos = 0;

  E.en = function (n, fn) { (E.oyentes[n] = E.oyentes[n] || []).push(fn); };
  function emitir(n, d) { var l = E.oyentes[n]; if (!l) return; for (var i = 0; i < l.length; i++) { try { l[i](d); } catch (err) { console.error(err); } } }
  E.emitir = emitir;

  /* ---------- coordenadas: x de pantalla de algo que está en xu (u) en una capa de profundidad p ---------- */
  E.sx = function (xu, p) { p = p == null ? 1 : p; return E.W / 2 + (xu * E.u - E.W / 2 - E.camX) * p; };
  E.xuDe = function (sx) { return (sx + E.camX) / E.u; };    // en la capa cercana (p = 1)
  E.maxCam = function () { return Math.max(0, E.largo * E.u - E.W); };
  E.irA = function (xu, ms, ease) {   // centra la cámara en xu
    cam = { x0: E.camX, x1: U.clamp(xu * E.u - E.W / 2, 0, E.maxCam()), t0: E.t, dur: ms || 1400, ease: ease || U.inOut };
    E.velX = 0; E.camObj = null;
  };
  E.camaraActiva = function () { return !!cam; };

  /* ---------- tamaño ---------- */
  var tinta, ctxTinta, tmp, ctxTmp;
  function medir() {
    var w = window.innerWidth, h = window.innerHeight;
    var proporcion = E.u ? E.camX / E.u : 0;
    E.W = w; E.H = h; E.u = h;
    E.dpr = E.ligero ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(w * E.dpr); cv.height = Math.round(h * E.dpr);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    [tinta, tmp].forEach(function (c) { c.width = cv.width; c.height = cv.height; });
    E.camX = U.clamp(proporcion * E.u, 0, E.maxCam()); E.camObj = null;
    papelPatron = null;
  }

  /* ---------- el papel: una tesela de washi con fibras, pintada una vez ---------- */
  var papelPatron = null;
  function papel() {
    if (papelPatron) return papelPatron;
    var s = 420, c = document.createElement('canvas'); c.width = c.height = s;
    var x = c.getContext('2d'), r = U.azar(23);
    x.fillStyle = U.rgba(C.papel, 1); x.fillRect(0, 0, s, s);
    // manchas suaves
    for (var i = 0; i < 26; i++) {
      var gx = r() * s, gy = r() * s, gr = 30 + r() * 90, g = x.createRadialGradient(gx, gy, 0, gx, gy, gr);
      g.addColorStop(0, U.rgba(C.papel2, 0.18 + r() * 0.15)); g.addColorStop(1, U.rgba(C.papel2, 0));
      x.fillStyle = g; x.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
    }
    // fibras: trazos finos y curvos, como el kozo
    for (var f = 0; f < 340; f++) {
      var fx = r() * s, fy = r() * s, a = r() * TAU, l = 8 + r() * 40, cur = (r() - 0.5) * 0.9;
      x.strokeStyle = r() < 0.7 ? U.rgba([196, 182, 156], 0.18 + r() * 0.2) : U.rgba([255, 252, 244], 0.35);
      x.lineWidth = 0.4 + r() * 0.7; x.beginPath(); x.moveTo(fx, fy);
      x.quadraticCurveTo(fx + Math.cos(a + cur) * l * 0.5, fy + Math.sin(a + cur) * l * 0.5, fx + Math.cos(a) * l, fy + Math.sin(a) * l); x.stroke();
    }
    // grano
    var im = x.getImageData(0, 0, s, s), d = im.data;
    for (var k = 0; k < d.length; k += 4) { var v = (r() - 0.5) * 14; d[k] += v; d[k + 1] += v; d[k + 2] += v; }
    x.putImageData(im, 0, 0);
    papelPatron = ctx.createPattern(c, 'repeat');
    return papelPatron;
  }

  /* ---------- la capa de tinta: lo que pinta el pincel; va pegada al rollo y se seca poco a poco ---------- */
  var camTinta = 0;
  // (si no hay nada pintado, no se toca: copiar, secar y dibujar un lienzo de pantalla entera cuesta en cada fotograma)
  E.tintaLimpia = true;
  function desplazarTinta() {
    if (E.tintaLimpia) { camTinta = E.camX; return; }
    var dx = Math.round((E.camX - camTinta) * E.dpr);
    if (!dx) return;
    ctxTmp.setTransform(1, 0, 0, 1, 0, 0); ctxTmp.clearRect(0, 0, tmp.width, tmp.height); ctxTmp.drawImage(tinta, 0, 0);
    ctxTinta.setTransform(1, 0, 0, 1, 0, 0); ctxTinta.clearRect(0, 0, tinta.width, tinta.height); ctxTinta.drawImage(tmp, -dx, 0);
    camTinta += dx / E.dpr;
  }
  var secado = 0;
  function secarTinta(dt) {
    if (E.tintaLimpia) { secado = 0; return; }
    secado += dt;
    if (secado < 50) return;
    // lo que queda casi seco no llega nunca a cero (redondeo de 8 bits): si hace rato que no se pinta, se limpia del todo
    if (E.t - (E.ultimoTrazo || 0) > 9000) { E.limpiarTinta(); E.tintaLimpia = true; secado = 0; return; }
    ctxTinta.setTransform(1, 0, 0, 1, 0, 0);
    ctxTinta.globalCompositeOperation = 'destination-out';
    ctxTinta.fillStyle = 'rgba(0,0,0,' + (0.012 * secado / 50).toFixed(4) + ')';
    ctxTinta.fillRect(0, 0, tinta.width, tinta.height);
    ctxTinta.globalCompositeOperation = 'source-over';
    secado = 0;
  }
  // una pincelada entre dos puntos (pantalla): el ancho depende de la velocidad, con cerdas secas a los lados
  E.pincelada = function (x0, y0, x1, y1, ancho, a) {
    E.tintaLimpia = false; E.ultimoTrazo = E.t;
    var c = ctxTinta; c.setTransform(E.dpr, 0, 0, E.dpr, 0, 0);
    var col = C.tinta, d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(d / 1.5));
    c.fillStyle = U.rgba(col, a == null ? 0.82 : a);
    c.beginPath();
    for (var i = 0; i <= n; i++) { var k = i / n, x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k; c.moveTo(x + ancho / 2, y); c.arc(x, y, ancho / 2, 0, TAU); }
    c.fill();
    // cerdas: líneas finas un poco desplazadas, más claras
    var nx = -(y1 - y0) / (d || 1), ny = (x1 - x0) / (d || 1);
    c.strokeStyle = U.rgba(col, 0.25); c.lineWidth = 0.6;
    c.beginPath();
    for (var b = -1; b <= 1; b += 2) { var o = ancho * (0.55 + Math.random() * 0.25) * b; c.moveTo(x0 + nx * o, y0 + ny * o); c.lineTo(x1 + nx * o, y1 + ny * o); }
    c.stroke();
  };
  // una gota de tinta que cae: mancha irregular con salpicaduras
  E.gota = function (x, y, r, semilla) {
    E.tintaLimpia = false; E.ultimoTrazo = E.t;
    var c = ctxTinta, rr = U.azar(semilla || (Math.random() * 1e9) | 0); c.setTransform(E.dpr, 0, 0, E.dpr, 0, 0);
    c.fillStyle = U.rgba(C.tinta, 0.85); c.beginPath();
    var n = 22;
    for (var i = 0; i <= n; i++) { var a = i / n * TAU, k = r * (0.75 + rr() * 0.5); i ? c.lineTo(x + Math.cos(a) * k, y + Math.sin(a) * k) : c.moveTo(x + Math.cos(a) * k, y + Math.sin(a) * k); }
    c.closePath(); c.fill();
    var g = c.createRadialGradient(x, y, r * 0.6, x, y, r * 2.2); g.addColorStop(0, U.rgba(C.tinta, 0.18)); g.addColorStop(1, U.rgba(C.tinta, 0));
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 2.2, 0, TAU); c.fill();
    c.fillStyle = U.rgba(C.tinta, 0.75);
    for (var s = 0; s < 9; s++) { var aa = rr() * TAU, dd = r * (1.3 + rr() * 1.8), ss = 0.6 + rr() * r * 0.18; c.beginPath(); c.arc(x + Math.cos(aa) * dd, y + Math.sin(aa) * dd, ss, 0, TAU); c.fill(); }
  };
  E.limpiarTinta = function () { ctxTinta.setTransform(1, 0, 0, 1, 0, 0); ctxTinta.clearRect(0, 0, tinta.width, tinta.height); };

  /* ---------- ayudas de dibujo ---------- */
  // una letra de caligrafía como pintada a pincel (en caché por letra y tamaño): la letra, un halo de tinta corrida, vetas
  // de pincel seco y grano de papel
  var letras = {}, nLetras = 0;
  function letraPincel(ch, tam) {
    var d = E.dpr, clave = ch + '|' + Math.round(tam * d), L = letras[clave];
    if (L) return L;
    if (nLetras > 140) { letras = {}; nLetras = 0; }
    var T = SA.tinta, S = Math.ceil(tam * 1.4 * d), m = Math.round(tam * 0.2 * d), Lz = T.lienzo(S, S), x = Lz.x, r = U.azar(ch.charCodeAt(0) * 31 + Math.round(tam));
    x.font = Math.round(tam * d) + 'px "Yuji Syuku", "Hiragino Mincho ProN", "Yu Mincho", serif'; x.textAlign = 'center'; x.textBaseline = 'top';
    x.fillStyle = U.rgba(C.tinta, 1); x.fillText(ch, S / 2, m);
    var H = T.desenfocar(Lz, Math.max(1.5, tam * d * 0.025)), R = T.lienzo(S, S);
    R.x.globalAlpha = 0.22; R.x.drawImage(H.c, 0, 0, S, S, 0, 0, S, S); R.x.globalAlpha = 1;
    x.save(); x.globalCompositeOperation = 'destination-out';
    // vetas secas: rayas finas y rotas (grupos de dos o tres, como las cerdas de un pincel que se queda sin tinta)
    x.lineCap = 'round';
    for (var k = 0, nv = Math.round(3 + tam / 20); k < nv; k++) {
      var y0 = S * (0.2 + r() * 0.6), x0 = S * (0.2 + r() * 0.5), l = S * (0.06 + r() * 0.12), an = (r() - 0.5) * 0.3 + (r() < 0.55 ? Math.PI / 2 : 0), nc = 2 + Math.floor(r() * 2);
      for (var c = 0; c < nc; c++) {
        var off = (c - (nc - 1) / 2) * S * 0.007, ox = -Math.sin(an) * off, oy = Math.cos(an) * off, t0 = r() * 0.25, t1 = 0.55 + r() * 0.45;
        x.strokeStyle = 'rgba(0,0,0,' + (0.16 + r() * 0.2).toFixed(2) + ')'; x.lineWidth = Math.max(0.5, S * (0.002 + r() * 0.003));
        x.beginPath(); x.moveTo(x0 + ox + Math.cos(an) * l * t0, y0 + oy + Math.sin(an) * l * t0); x.lineTo(x0 + ox + Math.cos(an) * l * t1, y0 + oy + Math.sin(an) * l * t1); x.stroke();
      }
    }
    var tg = T.textura('granulado', 256, 48, 2, 1.8, 9, false);
    x.globalAlpha = 0.22; x.fillStyle = x.createPattern(tg.c, 'repeat'); x.fillRect(0, 0, S, S);
    x.restore();
    R.x.drawImage(Lz.c, 0, 0);
    L = letras[clave] = { c: R.c, S: S / d, m: m / d }; nLetras++;
    return L;
  }
  var FX = SA.fx = {
    texto: function (s, x, y, op) {
      op = op || {};
      var fam = op.kanji ? '"Yuji Syuku", "Hiragino Mincho ProN", "Yu Mincho", serif' : op.mincho ? '"Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", serif' : op.serif ? '"Instrument Serif", Georgia, serif' : '"IBM Plex Mono", ui-monospace, Menlo, monospace';
      ctx.font = (op.cursiva ? 'italic ' : '') + (op.peso || 400) + ' ' + (op.tam || 11) + 'px ' + fam;
      ctx.textAlign = op.alin || 'left'; ctx.textBaseline = op.base || 'middle';
      ctx.fillStyle = U.rgba(op.color || C.tinta, op.a == null ? 0.85 : op.a);
      if (op.espaciado && 'letterSpacing' in ctx) ctx.letterSpacing = op.espaciado + 'px';
      ctx.fillText(s, x, y);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    },
    // texto japonés en vertical (de arriba abajo). La caligrafía (en tinta, de cierto tamaño) va como pintada a pincel:
    // cada letra, en caché, con vetas secas, grano y un halo de tinta corrida; y aparece de arriba abajo con el borde
    // blando, como el pincel al bajar
    vertical: function (s, x, y, tam, op) {
      op = op || {}; var chars = Array.from(s), pincel = !op.mincho && !op.color && tam >= 20 && SA.tinta;
      for (var i = 0; i < chars.length; i++) {
        var a = op.aparicion ? U.clamp(op.aparicion * chars.length - i, 0, 1) : 1;
        if (a <= 0) continue;
        var yy = y + i * tam * (op.interlineado || 1.05), alfa = op.a == null ? 0.9 : op.a;
        if (!pincel) { FX.texto(chars[i], x, yy, { kanji: !op.mincho, mincho: op.mincho, tam: tam, alin: 'center', base: 'top', a: alfa * a, color: op.color }); continue; }
        var L = letraPincel(chars[i], tam);
        ctx.save(); ctx.globalAlpha = alfa;
        if (a >= 1) ctx.drawImage(L.c, x - L.S / 2, yy - L.m, L.S, L.S);
        else {
          var V = SA.tinta.auxiliar('letra-velo', L.c.width, L.c.height), hh = L.c.height;
          V.x.drawImage(L.c, 0, 0);
          var g = V.x.createLinearGradient(0, hh * (a * 1.3 - 0.3), 0, hh * a * 1.3);
          g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
          V.x.globalCompositeOperation = 'destination-in'; V.x.fillStyle = g; V.x.fillRect(0, 0, V.w, V.h); V.x.globalCompositeOperation = 'source-over';
          ctx.drawImage(V.c, 0, 0, V.w, V.h, x - L.S / 2, yy - L.m, L.S, L.S);
        }
        ctx.restore();
      }
    },
    olvidarLetras: function () { letras = {}; nLetras = 0; },
    // sello rojo (hanko) con kanji dentro
    sello: function (s, x, y, tam, a, rot) {
      a = a == null ? 1 : a; var chars = Array.from(s), n = chars.length, lado = tam * (n > 1 ? 1.15 : 1.25), alto = n > 2 ? lado * Math.ceil(n / 2) / 1.6 : lado;
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0);
      ctx.fillStyle = U.rgba(C.bermellon, 0.9 * a); ctx.fillRect(-lado / 2, -alto / 2, lado, alto);
      ctx.strokeStyle = U.rgba(C.papel, 0.9 * a); ctx.lineWidth = Math.max(1, tam * 0.06); ctx.strokeRect(-lado / 2 + tam * 0.08, -alto / 2 + tam * 0.08, lado - tam * 0.16, alto - tam * 0.16);
      if (n === 1) FX.texto(chars[0], 0, tam * 0.03, { kanji: true, tam: tam * 0.82, alin: 'center', color: C.papel, a: a });
      else {
        var t2 = n > 2 ? tam * 0.42 : tam * 0.5, cols = n > 2 ? 2 : 1, filas = Math.ceil(n / cols);
        for (var i = 0; i < n; i++) {
          var col = cols === 2 ? (i < filas ? 0.5 : -0.5) : 0, fila = i % filas;   // se lee de arriba abajo, de derecha a izquierda
          FX.texto(chars[i], col * t2 * 1.05, (fila - (filas - 1) / 2) * t2 * 1.05, { kanji: true, tam: t2, alin: 'center', color: C.papel, a: a });
        }
      }
      ctx.restore();
    },
    brillo: function (x, y, r, col, a) {
      var g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, U.rgba(col, a)); g.addColorStop(1, U.rgba(col, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    },
    // trazo de pincel a lo largo de una lista de puntos [[x, y], …]: entra con fuerza, se afila al final y deja unas cerdas
    // secas; el borde tiembla un poco. fr (0…1) = cuánto se ha pintado ya (para animarlo)
    trazo: function (pts, ancho, a, col, fr) {
      fr = fr == null ? 1 : U.clamp(fr, 0, 1); if (pts.length < 2 || fr <= 0) return;
      var m = [], i, L = 0;
      for (i = 0; i < pts.length - 1; i++) {   // remuestreo: 24 puntos por tramo
        for (var k = 0; k < 24; k++) { var t = k / 24; m.push([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t]); }
      }
      m.push(pts[pts.length - 1].slice());
      var n = Math.max(2, Math.floor(m.length * fr)), izq = [], der = [], sem = Math.round(pts[0][0] * 7 + pts[0][1] * 13);
      for (i = 0; i < n; i++) {
        var p0 = m[Math.max(0, i - 1)], p1 = m[Math.min(m.length - 1, i + 1)], dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dx, dy) || 1;
        var g = i / (m.length - 1), w = ancho * (g < 0.08 ? 0.55 + 0.45 * g / 0.08 : Math.pow(Math.max(0.02, 1 - (g - 0.08) / 0.92), 0.6)) * 0.5;
        var e1 = 1 + (U.ruido(g * 22, sem) - 0.5) * 0.35, e2 = 1 + (U.ruido(g * 22, sem + 5) - 0.5) * 0.35;
        izq.push([m[i][0] - dy / l * w * e1, m[i][1] + dx / l * w * e1]); der.push([m[i][0] + dy / l * w * e2, m[i][1] - dx / l * w * e2]);
      }
      ctx.fillStyle = U.rgba(col || C.tinta, a == null ? 0.9 : a); ctx.beginPath(); ctx.moveTo(izq[0][0], izq[0][1]);
      for (i = 1; i < izq.length; i++) ctx.lineTo(izq[i][0], izq[i][1]);
      for (i = der.length - 1; i >= 0; i--) ctx.lineTo(der[i][0], der[i][1]);
      ctx.closePath(); ctx.fill();
      // las cerdas secas de la cola
      if (fr > 0.6) {
        ctx.strokeStyle = U.rgba(col || C.tinta, (a == null ? 0.9 : a) * 0.7); ctx.lineWidth = Math.max(0.6, ancho * 0.05); ctx.beginPath();
        var c0 = Math.floor(m.length * 0.55), c1 = n;
        for (var b = 0; b < 5; b++) {
          var off = (b - 2) * ancho * 0.12, fin = Math.min(c1, c0 + Math.floor((c1 - c0) * (0.7 + U._h(sem + b) * 0.5)));
          for (i = c0; i < fin; i++) {
            var q0 = m[Math.max(0, i - 1)], q1 = m[Math.min(m.length - 1, i + 1)], ddx = q1[0] - q0[0], ddy = q1[1] - q0[1], ll = Math.hypot(ddx, ddy) || 1;
            var px = m[i][0] - ddy / ll * off, py = m[i][1] + ddx / ll * off;
            if (i === c0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
        }
        ctx.stroke();
      }
    }
  };

  // una figura de samurái en tinta (SA.figura). (x, y) = los pies; alto en px.
  // op: espada (ángulo de la hoja en rad, −π/2 = hacia arriba; sin ella, la mano en la vaina), largo (de la hoja, en altos),
  //     estilo ('ronin' | 'ninja' | 'musashi' | 'kojiro' | 'ronin47' | 'ultimo'), arma ('katana' | 'nodachi' | 'remo' | 'yari' | 'ninjato'),
  //     agacha (0…1), fase (andar), rot (toda la figura, alrededor de los pies), espejo (mira a la izquierda), ninja, a (opacidad),
  //     cache (para muchas figuras iguales: se pinta una vez y se reutiliza)
  var cacheFig = {}, nCache = 0;
  FX.figura = function (x, y, alto, op) {
    op = op || {}; var F = SA.figura; if (!F) return;
    var a = op.a == null ? 1 : op.a; if (a <= 0.01 || alto < 2) return;
    var estilo = op.estilo || (op.ninja ? 'ninja' : 'ronin'), arma = op.arma || (op.ninja ? 'ninjato' : 'katana'), t = E.t * 0.001;
    var vto = 0.25 + E.viento * 0.6, P;
    if (op.espada == null) P = op.fase != null ? F.andar(op.fase, { viento: vto, t: t }) : F.quieto(op.cache ? 0.5 : t, { viento: vto });
    else P = F.guardia({ ang: op.espada, largo: op.largo || 0.6, arma: arma, agacha: op.agacha || 0, viento: vto, t: op.cache ? 0.5 : t, fase: op.fase });
    ctx.save(); ctx.translate(x, y); if (op.rot) ctx.rotate(op.rot);
    if (op.cache) {
      var clave = estilo + arma + Math.round((op.espada || 0) * 20) + '|' + Math.round(alto) + '|' + (op.fase != null ? Math.round(op.fase * 8) : '');
      var sp = cacheFig[clave];
      if (!sp) { if (nCache > 160) { cacheFig = {}; nCache = 0; } sp = cacheFig[clave] = F.sprite(P, estilo, Math.round(alto * E.dpr)); nCache++; }
      F.poner(ctx, sp, 0, 0, alto, op.espejo, a);
    } else F.dibujar(ctx, P, estilo, alto, 0, 0, op.espejo, a);
    ctx.restore();
  };
  FX.shuriken = function (x, y, r, rot, a) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.fillStyle = U.rgba(C.tinta, 0.92 * (a == null ? 1 : a)); ctx.beginPath();
    for (var i = 0; i < 8; i++) { var rr = i % 2 ? r * 0.28 : r, ang = i * Math.PI / 4; i ? ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr) : ctx.moveTo(rr, 0); }
    ctx.closePath(); ctx.fill(); ctx.fillStyle = U.rgba(C.papel, 0.9 * (a == null ? 1 : a)); ctx.beginPath(); ctx.arc(0, 0, r * 0.12, 0, TAU); ctx.fill(); ctx.restore();
  };
  // una viñeta de papel (como los recuadros de los emakimono) para ver algo de cerca; dibujar dentro con FX.dentroPanel
  var marcosPanel = {};
  FX.panel = function (x, y, w, h, a) {
    ctx.fillStyle = 'rgba(90,64,40,' + (0.14 * a).toFixed(3) + ')'; ctx.fillRect(x + 7, y + 9, w, h);
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = papel(); ctx.translate(x, y); ctx.fillRect(0, 0, w, h); ctx.restore();
    // el marco: cuatro pinceladas secas que se pasan un poco de las esquinas (se pinta una vez por tamaño)
    var clave = Math.round(w) + 'x' + Math.round(h), mc = marcosPanel[clave];
    if (!mc && SA.tinta) {
      var d = E.dpr, mg = 14, Lz = SA.tinta.lienzo((w + mg * 2) * d, (h + mg * 2) * d), T = SA.tinta;
      var lados = [[[mg - 6, mg], [mg + w + 6, mg]], [[mg + w, mg - 6], [mg + w, mg + h + 6]], [[mg + w + 6, mg + h], [mg - 6, mg + h]], [[mg, mg + h + 6], [mg, mg - 6]]];
      lados.forEach(function (l, i) {
        var p0 = [l[0][0] * d, l[0][1] * d], p1 = [l[1][0] * d, l[1][1] * d], pm = [(p0[0] + p1[0]) / 2 + (i % 2 ? 1.2 : -1.2) * d, (p0[1] + p1[1]) / 2 + (i % 2 ? -1 : 1.2) * d];
        T.pincelada(Lz.x, [p0, pm, p1], { ancho: 2.8 * d, alfa: 0.85, carga: 1, seco: 0.35, entrada: 0.04, salida: 0.08, semilla: 300 + i, cerdas: 7, rugoso: 0.22 });
      });
      T.pincelada(Lz.x, [[(mg + 5) * d, (mg + 5) * d], [(mg + w - 5) * d, (mg + 5.5) * d]], { ancho: 0.9 * d, alfa: 0.35, carga: 0.8, seco: 0.5, salida: 0.1, semilla: 310, cerdas: 3 });
      mc = marcosPanel[clave] = { c: Lz.c, mg: mg };
    }
    if (mc) { ctx.save(); ctx.globalAlpha = a; ctx.drawImage(mc.c, x - mc.mg, y - mc.mg, w + mc.mg * 2, h + mc.mg * 2); ctx.restore(); }
    else { ctx.strokeStyle = U.rgba(C.tinta, 0.75 * a); ctx.lineWidth = 1.2; ctx.strokeRect(x, y, w, h); }
  };
  FX.dentroPanel = function (x, y, w, h, dibujo) { ctx.save(); ctx.beginPath(); ctx.rect(x + 5, y + 5, w - 10, h - 10); ctx.clip(); try { dibujo(); } finally { ctx.restore(); } };

  /* ---------- reconocer gestos en un trazo del pincel ---------- */
  SA.gestos = {
    // ¿es un círculo de una sola pincelada? centro, radio y cuánto se parece
    circulo: function (pts) {
      if (pts.length < 12) return null;
      var cx = 0, cy = 0, i; pts.forEach(function (p) { cx += p.x; cy += p.y; }); cx /= pts.length; cy /= pts.length;
      var rs = pts.map(function (p) { return Math.hypot(p.x - cx, p.y - cy); }), r = rs.reduce(function (a, b) { return a + b; }, 0) / rs.length;
      var desv = Math.sqrt(rs.reduce(function (a, b) { return a + (b - r) * (b - r); }, 0) / rs.length) / (r || 1);
      var giro = 0, a0 = Math.atan2(pts[0].y - cy, pts[0].x - cx);
      for (i = 1; i < pts.length; i++) { var a1 = Math.atan2(pts[i].y - cy, pts[i].x - cx), d = a1 - a0; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; giro += d; a0 = a1; }
      var cierre = Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) / (r || 1);
      return { cx: cx, cy: cy, r: r, desv: desv, giro: Math.abs(giro), cierre: cierre, ok: r > E.u * 0.05 && desv < 0.24 && Math.abs(giro) > Math.PI * 1.7 && cierre < 0.6 };
    },
    // ¿es un tajo rápido y recto?
    tajo: function (pts, dur) {
      if (pts.length < 3) return null;
      var a = pts[0], b = pts[pts.length - 1], cuerda = Math.hypot(b.x - a.x, b.y - a.y), largo = 0;
      for (var i = 1; i < pts.length; i++) largo += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      return { a: a, b: b, cuerda: cuerda, recto: cuerda / (largo || 1), ok: dur < 480 && cuerda > E.u * 0.14 && cuerda / (largo || 1) > 0.85 };
    },
    // cuántas veces cambia de sentido en horizontal (con un mínimo de amplitud)
    vaivenes: function (pts, minimo) {
      var n = 0, dir = 0, ext = pts.length ? pts[0].x : 0;
      for (var i = 1; i < pts.length; i++) {
        var dx = pts[i].x - ext;
        if (dir >= 0 && dx < -minimo) { if (dir > 0) n++; dir = -1; ext = pts[i].x; }
        else if (dir <= 0 && dx > minimo) { if (dir < 0) n++; dir = 1; ext = pts[i].x; }
        else if ((dir > 0 && pts[i].x > ext) || (dir < 0 && pts[i].x < ext)) ext = pts[i].x;
      }
      return n;
    }
  };

  /* ---------- dibujar un fotograma ---------- */
  function dibujar() {
    ctx.setTransform(E.dpr, 0, 0, E.dpr, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    var esc = E.escena, s = esc && esc.s, t = esc ? esc.t : 0;
    // el papel, que se mueve con el rollo
    ctx.save(); ctx.translate(-(E.camX % 420), 0); ctx.fillStyle = papel(); ctx.fillRect(0, 0, E.W + 420, E.H); ctx.restore();
    if (s && s.fondo) s.fondo(ctx, t);
    SA.paisaje && SA.paisaje.dibujar(ctx);
    // la noche (47 rōnin) oscurece el papel con un velo
    if (E.noche > 0.001) { ctx.fillStyle = U.rgba(C.noche, 0.55 * E.noche); ctx.fillRect(0, 0, E.W, E.H); }
    // lo pintado con el pincel
    if (!E.tintaLimpia) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 0.92; ctx.drawImage(tinta, 0, 0); ctx.globalAlpha = 1; }
    ctx.setTransform(E.dpr, 0, 0, E.dpr, 0, 0);
    SA.paisaje && SA.paisaje.dibujarParticulas && SA.paisaje.dibujarParticulas(ctx);
    if (!s) for (var i = 0; i < E.capas.length; i++) { try { E.capas[i](ctx, E.t); } catch (err) { console.error(err); } }
    if (s && s.frente) s.frente(ctx, t);
    if (s && s.heroeEncima && SA.paisaje && SA.paisaje.dibujarHeroeEncima) SA.paisaje.dibujarHeroeEncima(ctx);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    // (la viñeta de los bordes es CSS, .vineta: la compone la GPU y no cuesta nada al lienzo)
    // al empezar, el rollo se desenrolla de izquierda a derecha: papel en blanco con el rodillo en el borde
    if (E.desenrollo != null) {
      var rx = E.W * U.inOut(E.desenrollo), w = E.u * 0.03;
      ctx.save(); ctx.translate(-(E.camX % 420), 0); ctx.fillStyle = papel(); ctx.fillRect(rx + (E.camX % 420), 0, E.W - rx + 420, E.H); ctx.restore();
      // la sombra del papel enrollado sobre lo ya desenrollado, y el rodillo de madera (un cilindro con su brillo)
      var gs = ctx.createLinearGradient(rx - E.u * 0.05, 0, rx, 0);
      gs.addColorStop(0, 'rgba(60,40,20,0)'); gs.addColorStop(1, 'rgba(60,40,20,0.22)');
      ctx.fillStyle = gs; ctx.fillRect(rx - E.u * 0.05, 0, E.u * 0.05, E.H);
      var g2 = ctx.createLinearGradient(rx, 0, rx + w, 0);
      g2.addColorStop(0, 'rgba(46,30,18,0.97)'); g2.addColorStop(0.3, 'rgba(112,78,48,0.97)'); g2.addColorStop(0.42, 'rgba(168,128,86,0.97)');
      g2.addColorStop(0.55, 'rgba(118,82,50,0.97)'); g2.addColorStop(1, 'rgba(34,22,13,0.97)');
      ctx.fillStyle = g2; ctx.fillRect(rx, 0, w, E.H);
      // la veta de la madera
      ctx.strokeStyle = 'rgba(30,18,10,0.18)'; ctx.lineWidth = 1; ctx.beginPath();
      for (var vk = 0; vk < 5; vk++) { var vx = rx + w * (0.18 + vk * 0.16); ctx.moveTo(vx, 0); ctx.lineTo(vx + Math.sin(vk * 2.3) * 2, E.H); }
      ctx.stroke();
    }
  }

  /* ---------- un paso del reloj ---------- */
  function actualizar(dt) {
    E.t += dt;
    var esc = E.escena, antes = E.camX;
    if (cam) {
      var k = U.clamp((E.t - cam.t0) / cam.dur, 0, 1); E.camX = U.lerp(cam.x0, cam.x1, cam.ease(k)); if (k >= 1) cam = null;
    } else if (!esc) {
      if (Math.abs(E.velX) > 0.001) { E.camX += E.velX * dt; E.velX *= Math.pow(0.92, dt / 16); }
      // la cámara persigue su objetivo con un muelle crítico (unos 110 ms): la rueda deja de dar saltos
      if (E.camObj != null) {
        E.camX += (E.camObj - E.camX) * (1 - Math.exp(-dt / 110));
        if (Math.abs(E.camObj - E.camX) < 0.25) { E.camX = E.camObj; E.camObj = null; }
      }
    }
    E.camX = U.clamp(E.camX, 0, E.maxCam());
    document.documentElement.classList.toggle('oscuro', E.noche > 0.45);
    if (E.desenrollo != null && E.desenrollo > 0) { E.desenrollo += dt / 1900; if (E.desenrollo >= 1) E.desenrollo = null; }
    // viento: lo que mueve el ratón (rápido = ráfaga), que se calma solo
    var p = E.puntero;
    E.viento = E.viento * Math.pow(0.94, dt / 16) + U.clamp(p.velocidad / 2.5, 0, 1) * 0.08;
    p.velocidad *= Math.pow(0.8, dt / 16);
    desplazarTinta();
    secarTinta(dt);
    if (esc) {
      esc.t += dt;
      var sc = esc.s, ta = sc.tarjeta;
      if (ta && !esc.tv && esc.t >= ta.en) { esc.tv = true; SA.interfaz && SA.interfaz.tarjeta(ta); }
      if (ta && esc.tv && !esc.tq && esc.t >= ta.hasta) { esc.tq = true; SA.interfaz && SA.interfaz.tarjeta(null); }
      if (sc.cuadro) { try { sc.cuadro(esc.t, dt); } catch (err) { console.error(err); } }
      if (esc.t >= esc.dur) terminarEscena(false);
    }
    SA.paisaje && SA.paisaje.actualizar(dt);
    if (!esc && !E.bloqueado) emitir('cuadro', { t: E.t, dt: dt, inactivo: E.t - E.ultimoInput, movido: E.camX - antes });
  }
  function paso(dt) { actualizar(dt); dibujar(); }
  function bucle(ahora) {
    if (congelado) return;
    var dt = ultimoRaf === null ? 16 : Math.min(50, ahora - ultimoRaf); ultimoRaf = ahora;
    paso(dt);
    // si el equipo no llega (de media más de 28 ms por fotograma), se pasa a modo ligero (resolución 1×). Solo se mide con el
    // taller parado y sin entrada ni escena: el taller usa a propósito el tiempo libre y no debe confundirse con lentitud
    var midiendo = !E.ligero && E.desenrollo == null && !E.escena && !(SA.paisaje && SA.paisaje.ocupado && SA.paisaje.ocupado());
    if (midiendo) { mediaDt = mediaDt * 0.95 + dt * 0.05; if (++nMedidos > 120 && mediaDt > 28) { E.ligero = true; medir(); } }
    raf(bucle);
  }

  /* ---------- escenas ---------- */
  E.reproducir = function (h, alTerminar) {
    if (E.escena) return false;
    var s = h.escena(E) || {};
    E.escena = { h: h, s: s, t: 0, dur: s.duracion || 8000, fin: alTerminar };
    E.velX = 0; cam = null; arrastre = null; E.camObj = null;
    document.documentElement.classList.add('en-escena');
    if (s.inicio) { try { s.inicio(); } catch (err) { console.error(err); } }
    emitir('escena', { fase: 'inicio', huevo: h });
    return true;
  };
  function terminarEscena(saltada) {
    var e = E.escena; if (!e) return;
    try { e.s.fin && e.s.fin(saltada); } catch (err) { console.error(err); }
    E.escena = null; cam = null;
    SA.interfaz && SA.interfaz.tarjeta(null);
    document.documentElement.classList.remove('en-escena');
    E.ultimoInput = E.t;
    emitir('escena', { fase: 'fin', huevo: e.h, saltada: saltada });
    if (e.fin) e.fin(saltada);
  }
  E.saltar = function () { terminarEscena(true); };

  /* ---------- entrada ----------
     Rueda / trackpad / flechas / minimapa: avanzar por el rollo. Arrastrar: pintar con el pincel
     (en pantallas táctiles, según el botón Pincel / Mover). Clic sin moverse: una gota de tinta. */
  var arrastre = null, punteros = {}, dosDedos = null;
  function libre() { return !E.escena && !E.bloqueado; }
  function marcar() { E.ultimoInput = E.t; }
  function datos(x, y) { return { x: x, y: y, xu: E.xuDe(x), yu: y / E.u }; }
  E.puntoTrazo = null;

  function alBajar(ev) {
    marcar();
    var p = E.puntero; p.x = ev.clientX; p.y = ev.clientY; p.sobre = true; p.tipo = ev.pointerType || 'mouse';
    if (!libre()) return;
    punteros[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
    try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* nada */ }
    if (Object.keys(punteros).length === 2) { arrastre = null; dosDedos = { x: (ev.clientX), cam: E.camX }; return; }
    var mover = p.tipo !== 'mouse' && !E.pincel;
    arrastre = { modo: mover ? 'mover' : 'pintar', x: ev.clientX, y: ev.clientY, x0: ev.clientX, y0: ev.clientY, t0: E.t, cam0: E.camX, movido: 0, pts: [[ev.clientX, ev.clientY, E.t, E.camX]] };
    cam = null; E.velX = 0; E.camObj = null;
    emitir('bajar', datos(ev.clientX, ev.clientY));
  }
  function alMover(ev) {
    marcar();
    var p = E.puntero, dx = ev.clientX - p.x, dy = ev.clientY - p.y;
    if (p.sobre && E.t - (p.tm || 0) > 0) { var v = Math.hypot(dx, dy) / Math.max(1, E.t - (p.tm || E.t - 16)); p.velocidad = Math.max(p.velocidad, v); p.vx = dx; }
    p.x = ev.clientX; p.y = ev.clientY; p.sobre = ev.target === cv || !!arrastre; p.tm = E.t; p.tipo = ev.pointerType || p.tipo;
    if (punteros[ev.pointerId]) { punteros[ev.pointerId].x = ev.clientX; punteros[ev.pointerId].y = ev.clientY; }
    if (!libre()) return;
    if (dosDedos) {
      var ids = Object.keys(punteros); if (ids.length < 2) return;
      var mx = (punteros[ids[0]].x + punteros[ids[1]].x) / 2;
      if (dosDedos.ultimo != null) E.camX = U.clamp(E.camX - (mx - dosDedos.ultimo), 0, E.maxCam());
      dosDedos.ultimo = mx; return;
    }
    var A = arrastre;
    if (A) {
      var d = Math.hypot(ev.clientX - A.x, ev.clientY - A.y); A.movido += d;
      if (A.modo === 'mover') { E.camX = U.clamp(A.cam0 - (ev.clientX - A.x0), 0, E.maxCam()); A.pts.push([ev.clientX, ev.clientY, E.t, E.camX]); return; }
      // pintar: ancho según la velocidad (deprisa = fino, despacio = grueso)
      var ult = A.pts[A.pts.length - 1], dtm = Math.max(1, E.t - ult[2] || 16), vel = d / dtm;
      var ancho = U.clamp(13 - vel * 6, 2.2, 13) * (E.u / 900 * 0.6 + 0.4);
      A.ancho = A.ancho == null ? ancho : A.ancho * 0.7 + ancho * 0.3;
      if (d > 0.5) { E.pincelada(A.x, A.y, ev.clientX, ev.clientY, A.ancho); E.ultimoTrazo = E.t; E.tintaLimpia = false; }
      A.x = ev.clientX; A.y = ev.clientY;
      A.pts.push([ev.clientX, ev.clientY, E.t, E.camX]);
    } else emitir('mover', datos(ev.clientX, ev.clientY));
  }
  function alSubir(ev) {
    marcar();
    delete punteros[ev.pointerId];
    if (dosDedos) { if (Object.keys(punteros).length < 2) dosDedos = null; arrastre = null; return; }
    var A = arrastre; arrastre = null;
    if (!A || !libre()) return;
    if (A.modo === 'mover') {   // inercia
      var n = A.pts.length; if (n > 2) { var a = A.pts[Math.max(0, n - 5)], b = A.pts[n - 1]; E.velX = -(b[0] - a[0]) / Math.max(16, b[2] - a[2]); }
      return;
    }
    var dur = E.t - A.t0, d = datos(A.x0, A.y0);
    if (A.movido < 6 && dur < 600) {
      E.gota(A.x0, A.y0, 5 + Math.random() * 3); E.ultimoTrazo = E.t; E.tintaLimpia = false;
      emitir('clic', d);
    } else {
      // el trazo completo, en coordenadas del rollo (para los gestos)
      var pts = A.pts.map(function (q) { return { x: q[0], y: q[1], t: q[2], xu: (q[0] + q[3]) / E.u, yu: q[1] / E.u }; });
      emitir('trazo', { pts: pts, dur: dur, movido: A.movido });
    }
  }

  E.iniciar = function (lienzo) {
    cv = lienzo; ctx = cv.getContext('2d', { alpha: false }); E.ctx = ctx;
    tinta = document.createElement('canvas'); ctxTinta = tinta.getContext('2d');
    tmp = document.createElement('canvas'); ctxTmp = tmp.getContext('2d');
    medir();
    window.addEventListener('resize', medir);
    cv.addEventListener('pointerdown', alBajar);
    window.addEventListener('pointermove', function (ev) { if (ev.target === cv || arrastre || dosDedos) alMover(ev); else { E.puntero.sobre = false; marcar(); } });
    window.addEventListener('pointerup', alSubir);
    window.addEventListener('pointercancel', function (ev) { delete punteros[ev.pointerId]; arrastre = null; dosDedos = null; });
    cv.addEventListener('pointerleave', function (ev) { if (ev.pointerType === 'mouse' && !arrastre) E.puntero.sobre = false; });
    cv.addEventListener('wheel', function (ev) {
      ev.preventDefault(); marcar();
      if (!libre()) return;
      var d = (Math.abs(ev.deltaX) > Math.abs(ev.deltaY) ? ev.deltaX : ev.deltaY) * (ev.deltaMode === 1 ? 16 : 1);
      cam = null;
      var antes = E.camObj != null ? E.camObj : E.camX; E.camObj = U.clamp(antes + d, 0, E.maxCam());
      if (d > 0 && antes >= E.maxCam() - 0.5) E.empujarFin(d);
      E.velX = 0;
    }, { passive: false });
    window.addEventListener('keydown', function (ev) {
      marcar();
      if (ev.key === 'Escape' && E.escena) { E.saltar(); return; }
      if (!libre() || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      var t = ev.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
        ev.preventDefault(); cam = null;
        var dir = ev.key === 'ArrowRight' ? 1 : -1;
        if (dir > 0 && E.camX >= E.maxCam() - 0.5) E.empujarFin(120);
        E.velX = dir * 1.6;
      }
      emitir('tecla', { key: ev.key });
    });
    document.addEventListener('visibilitychange', function () { ultimoRaf = null; marcar(); });
    raf(bucle);
  };
  // empujar más allá del final: se acumula mientras sigas empujando (si paras 0,7 s, vuelve a cero)
  E.empujarFin = function (d) { if (E.t - (E.ultimoEmpuje || -1e9) > 700) E.empuje = 0; E.ultimoEmpuje = E.t; E.empuje += d; emitir('empujar', { d: d, total: E.empuje }); };

  /* ---------- pruebas: pasos manuales ---------- */
  E.congelar = function (si) { congelado = si !== false; if (!congelado) { ultimoRaf = null; raf(bucle); } };
  // (para las pruebas: cada fotograma simulado espera a que WebKit lo pinte, como haría la pantalla; si no, el trabajo
  // de cientos de fotogramas se acumula y la página se cuelga)
  E.paso = function (ms, trozos) { trozos = trozos || Math.max(1, Math.round(ms / 16)); for (var i = 0; i < trozos; i++) { paso(ms / trozos); if (SA.tinta) SA.tinta.vaciar(); } };
})();
