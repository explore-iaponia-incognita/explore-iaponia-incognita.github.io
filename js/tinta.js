/* Iaponia Incognita · tinta
   El motor de pintura sumi-e: ruido, papel de arroz, pinceladas con cerdas (carga de tinta, pincel seco, colas afiladas),
   salpicaduras, aguadas moteadas con bordes húmedos, desenfoque y el «entintado» de siluetas (relleno negro con
   vetas de papel, grano y gotas). Todo se pinta en lienzos aparte, normalmente una sola vez al cargar. */
(function () {
  'use strict';
  var SA = window.SA = window.SA || {};
  var TAU = Math.PI * 2;

  /* ------------------------------------------------------------------ azar y ruido */
  function azar(semilla) { var s = (semilla | 0) || 1; return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }
  function h1(n) { var s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  function h2(x, y) { var s = Math.sin(x * 127.1 + y * 311.7 + 74.7) * 43758.5453; return s - Math.floor(s); }
  function ruido1(x, s) { var i = Math.floor(x), f = x - i; f = f * f * (3 - 2 * f); return h1(i + s * 57) * (1 - f) + h1(i + 1 + s * 57) * f; }
  function ruido2(x, y, s) {
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, o = (s || 0) * 31.7;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    var a = h2(ix + o, iy), b = h2(ix + 1 + o, iy), c = h2(ix + o, iy + 1), d = h2(ix + 1 + o, iy + 1);
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  }
  function fbm2(x, y, s, oct) { var v = 0, a = 0.5, f = 1; for (var o = 0; o < (oct || 4); o++) { v += ruido2(x * f, y * f, s + o * 13) * a; a *= 0.5; f *= 2.02; } return v; }
  function fbm1(x, s, oct) { var v = 0, a = 0.5, f = 1; for (var o = 0; o < (oct || 4); o++) { v += ruido1(x * f, s + o * 7) * a; a *= 0.5; f *= 2.03; } return v; }

  var T = SA.tinta = { azar: azar, h1: h1, h2: h2, ruido1: ruido1, ruido2: ruido2, fbm1: fbm1, fbm2: fbm2 };
  T.color = { tinta: [14, 13, 12], papel: [241, 238, 232], rojo: [178, 32, 28], rojoOscuro: [120, 18, 18] };
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a < 0 ? 0 : a > 1 ? 1 : a).toFixed(3) + ')'; }
  T.rgba = rgba;

  T.lienzo = function (w, h) {
    var c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
    var x = c.getContext('2d'); x.lineCap = 'round'; x.lineJoin = 'round';
    return { c: c, x: x, w: c.width, h: c.height };
  };

  // lienzos de trabajo reutilizados (crear y tirar lienzos grandes en cada pincelada provoca parones de memoria)
  var auxiliares = {};
  T.auxiliar = function (nombre, w, h) {
    w = Math.max(1, Math.ceil(w)); h = Math.max(1, Math.ceil(h));
    var L = auxiliares[nombre];
    if (!L || L.c.width < w || L.c.height < h) { L = auxiliares[nombre] = T.lienzo(Math.max(w, L ? L.c.width : 0), Math.max(h, L ? L.c.height : 0)); }
    L.x.setTransform(1, 0, 0, 1, 0, 0); L.x.globalAlpha = 1; L.x.globalCompositeOperation = 'source-over';
    L.x.clearRect(0, 0, w + 3, h + 3); L.w = w; L.h = h;   // (y un borde: el filtrado bilineal lee un píxel más allá)
    return L;
  };
  /* Espera a que WebKit haya pintado de verdad todo lo pedido hasta ahora. Safari no pinta los lienzos en el momento:
     apunta las órdenes y las pinta otro proceso (el de la GPU), a su ritmo; el JavaScript acaba enseguida y el trabajo
     se acumula detrás. Si se acumula demasiado, la página se queda colgada segundos (o del todo). Leer un píxel de un
     lienzo cualquiera obliga a esperar a que ese proceso termine todo lo anterior: así cada paso del taller cuesta lo
     que cuesta de verdad, y el reparto entre fotogramas funciona. (El argumento se ignora: la espera es para todo.) */
  var unPixel = null;
  T.vaciar = function () {
    if (!unPixel) unPixel = T.lienzo(1, 1);
    try { unPixel.x.fillRect(0, 0, 1, 1); unPixel.x.getImageData(0, 0, 1, 1); } catch (err) { /* nada */ }
  };

  /* ------------------------------------------------------------------ texturas de ruido (teselables) */
  var texturas = {};
  // textura de grano / moteado: alfa = ruido (0…1) con contraste, en blanco o negro
  T.textura = function (nombre, tam, escala, oct, contraste, semilla, negra) {
    var clave = nombre + tam;
    if (texturas[clave]) return texturas[clave];
    var L = T.lienzo(tam, tam), im = L.x.createImageData(tam, tam), d = im.data, n = escala;
    for (var y = 0; y < tam; y++) for (var x = 0; x < tam; x++) {
      // teselable: mezcla de las cuatro esquinas
      var u = x / tam, v = y / tam;
      var a = fbm2(u * n, v * n, semilla, oct), b = fbm2((u - 1) * n, v * n, semilla, oct), c = fbm2(u * n, (v - 1) * n, semilla, oct), e = fbm2((u - 1) * n, (v - 1) * n, semilla, oct);
      var val = (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + e * u) * v;
      val = Math.max(0, Math.min(1, (val - 0.5) * contraste + 0.5));
      var i = (y * tam + x) * 4, col = negra ? 0 : 255;
      d[i] = d[i + 1] = d[i + 2] = col; d[i + 3] = Math.round(val * 255);
    }
    L.x.putImageData(im, 0, 0);
    texturas[clave] = L;
    return L;
  };

  /* ------------------------------------------------------------------ papel de arroz */
  // papel claro, casi blanco, con fibras (kozo), manchas grises suaves y grano: como el de las láminas de tinta
  T.papel = function (tam, semilla) {
    var L = T.lienzo(tam, tam), x = L.x, r = azar(semilla || 7);
    x.fillStyle = rgba(T.color.papel, 1); x.fillRect(0, 0, tam, tam);
    // nubes grises muy suaves (el papel envejecido de las láminas)
    var im = x.getImageData(0, 0, tam, tam), d = im.data;
    for (var py = 0; py < tam; py++) for (var px = 0; px < tam; px++) {
      var u = px / tam, v = py / tam, n = 2.2;
      var a = fbm2(u * n, v * n, 3, 5), b = fbm2((u - 1) * n, v * n, 3, 5), c = fbm2(u * n, (v - 1) * n, 3, 5), e = fbm2((u - 1) * n, (v - 1) * n, 3, 5);
      var nube = (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + e * u) * v;
      var g = h2(px * 1.37, py * 2.11) - 0.5, osc = Math.max(0, nube - 0.47) * 70 + g * 9;
      var i = (py * tam + px) * 4; d[i] -= osc; d[i + 1] -= osc * 1.02; d[i + 2] -= osc * 1.06;
    }
    x.putImageData(im, 0, 0);
    // fibras largas y finas
    for (var f = 0; f < 520; f++) {
      var fx = r() * tam, fy = r() * tam, a2 = r() * TAU, l = 6 + r() * 46, cur = (r() - 0.5) * 1.2;
      x.strokeStyle = r() < 0.75 ? 'rgba(150,146,138,' + (0.08 + r() * 0.14).toFixed(3) + ')' : 'rgba(255,255,255,0.5)';
      x.lineWidth = 0.35 + r() * 0.6; x.beginPath(); x.moveTo(fx, fy);
      x.quadraticCurveTo(fx + Math.cos(a2 + cur) * l * 0.5, fy + Math.sin(a2 + cur) * l * 0.5, fx + Math.cos(a2) * l, fy + Math.sin(a2) * l); x.stroke();
    }
    return L;
  };

  /* ------------------------------------------------------------------ desenfoque (reduciendo y ampliando) */
  // desenfoque: reduce a la mitad varias veces y vuelve a ampliar paso a paso (cada paso con filtrado bilineal: queda un
  // difuminado suave, sin bloques). Con «destino» pinta ahí; si no, en un lienzo de trabajo que se reutiliza
  // (el resultado vale hasta la siguiente llamada).
  T.desenfocar = function (src, radio, destino) {
    var sw = src.w || src.width, sh = src.h || src.height, c = src.c || src;
    var L = destino || T.auxiliar('desenfoque', sw, sh);
    var pasos = Math.max(1, Math.round(Math.log(Math.max(1.5, radio)) / Math.LN2)), niveles = [], cur = c, cw = sw, ch = sh, i;
    for (i = 0; i < pasos; i++) {
      var nw = Math.max(1, Math.ceil(cw / 2)), nh = Math.max(1, Math.ceil(ch / 2)), A = T.auxiliar('desenfoque' + i, nw, nh);
      A.x.imageSmoothingEnabled = true; A.x.drawImage(cur, 0, 0, cw, ch, 0, 0, nw, nh);
      niveles.push([A, nw, nh]); cur = A.c; cw = nw; ch = nh;
    }
    for (i = pasos - 2; i >= 0; i--) {
      var N = niveles[i]; N[0].x.clearRect(0, 0, N[1], N[2]); N[0].x.imageSmoothingEnabled = true;
      N[0].x.drawImage(cur, 0, 0, cw, ch, 0, 0, N[1], N[2]); cur = N[0].c; cw = N[1]; ch = N[2];
    }
    L.x.imageSmoothingEnabled = true; L.x.drawImage(cur, 0, 0, cw, ch, 0, 0, sw, sh);
    return L;
  };

  /* ------------------------------------------------------------------ pinceladas */
  // remuestrea un camino [[x,y],…] a pasos de «paso» px y añade tangente, normal y progreso
  function remuestrear(pts, paso) {
    var o = [], acum = 0, total = 0, i;
    for (i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (total < 0.5) return [];
    var n = Math.max(2, Math.ceil(total / paso)), seg = 0, d0 = 0;
    for (var k = 0; k <= n; k++) {
      var objetivo = total * k / n;
      while (seg < pts.length - 2 && d0 + Math.hypot(pts[seg + 1][0] - pts[seg][0], pts[seg + 1][1] - pts[seg][1]) < objetivo) { d0 += Math.hypot(pts[seg + 1][0] - pts[seg][0], pts[seg + 1][1] - pts[seg][1]); seg++; }
      var a = pts[seg], b = pts[seg + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, t = Math.min(1, (objetivo - d0) / l);
      o.push({ x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, tx: (b[0] - a[0]) / l, ty: (b[1] - a[1]) / l, g: k / n, p: a[2] == null ? 1 : a[2] + ((b[2] == null ? 1 : b[2]) - a[2]) * t });
    }
    o.forEach(function (q) { q.nx = -q.ty; q.ny = q.tx; });
    return o;
  }
  T.remuestrear = remuestrear;
  // curva suave (Catmull-Rom) por una lista de puntos de control
  T.curva = function (ctrl, porTramo) {
    var o = [], n = porTramo || 10;
    for (var i = 0; i < ctrl.length - 1; i++) {
      var p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
      for (var k = 0; k < n; k++) {
        var t = k / n, t2 = t * t, t3 = t2 * t;
        var x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
        var y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
        var pr = p1[2] == null ? null : p1[2] + ((p2[2] == null ? p1[2] : p2[2]) - p1[2]) * t;
        o.push(pr == null ? [x, y] : [x, y, pr]);
      }
    }
    o.push(ctrl[ctrl.length - 1].slice());
    return o;
  };

  /* Una pincelada con cerdas.
     op: ancho, alfa (0…1), color, carga (tinta al empezar, 0…1), seco (cuánto se seca al final, 0…1),
         entrada / salida (fracción del trazo en que crece / se afila), cerdas (nº), semilla, gota (mancha al apoyar),
         salpica (gotas al final), rugoso (irregularidad del borde), soloCerdas (sin cuerpo: para vetas secas) */
  T.pincelada = function (ctx, pts, op) {
    op = op || {};
    var ancho = op.ancho || 10, r = azar(op.semilla || ((Math.random() * 1e9) | 0)), col = op.color || T.color.tinta, alfa = op.alfa == null ? 0.95 : op.alfa;
    var s = remuestrear(pts, op.paso || Math.max(0.6, ancho * 0.06)); if (s.length < 2) return;   // «paso»: muestreo más grueso para trazos finos y largos
    var entrada = op.entrada == null ? 0.06 : op.entrada, salida = op.salida == null ? 0.3 : op.salida, carga = op.carga == null ? 1 : op.carga, seco = op.seco == null ? 0.5 : op.seco;
    var semRuido = r() * 100, rug = op.rugoso == null ? 0.12 : op.rugoso;
    function anchoEn(q) {
      var g = q.g, f = g < entrada ? 0.35 + 0.65 * Math.sin(g / entrada * Math.PI / 2) : g > 1 - salida ? Math.pow(Math.max(0, (1 - g) / salida), 0.7) : 1;
      return ancho * Math.max(0.02, f) * q.p * (1 + (ruido1(g * 5, semRuido) - 0.5) * 0.22);
    }
    // dónde se acaba la tinta del cuerpo: con «seco» alto, el cuerpo se deshace en cerdas antes del final
    var finCuerpo = Math.min(1, carga * (1.08 - seco * 0.45));
    // «rasgado» (0…1): pincel seco de verdad, sin cuerpo: cerdas más gruesas que dejan huecos largos de papel a lo largo de todo el trazo
    var rasgado = op.rasgado || 0;
    if (!op.soloCerdas && !rasgado) {
      ctx.fillStyle = rgba(col, alfa); ctx.beginPath();
      var izq = [], der = [];
      s.forEach(function (q) {
        var w = anchoEn(q) / 2, k = q.g > finCuerpo ? Math.max(0, 1 - (q.g - finCuerpo) / 0.12) : 1; w *= k;
        var e1 = 1 + (ruido1(q.g * 30, semRuido + 3) - 0.5) * rug * 2, e2 = 1 + (ruido1(q.g * 30, semRuido + 9) - 0.5) * rug * 2;
        izq.push([q.x + q.nx * w * e1, q.y + q.ny * w * e1]); der.push([q.x - q.nx * w * e2, q.y - q.ny * w * e2]);
      });
      ctx.moveTo(izq[0][0], izq[0][1]);
      for (var i = 1; i < izq.length; i++) ctx.lineTo(izq[i][0], izq[i][1]);
      for (var j = der.length - 1; j >= 0; j--) ctx.lineTo(der[j][0], der[j][1]);
      ctx.closePath(); ctx.fill();
    }
    // las cerdas: cada una se queda sin tinta en un punto distinto (antes las de los bordes) y, al secarse, deja huecos largos
    var N = op.cerdas || (rasgado ? Math.max(6, Math.min(40, Math.round(ancho * (0.55 - 0.2 * rasgado)))) : Math.max(8, Math.min(60, Math.round(ancho * 1.3))));
    for (var b = 0; b < N; b++) {
      var off = (b + 0.5) / N - 0.5, borde = Math.abs(off) * 2;
      var vida = Math.min(1, carga * (1 - seco * (0.04 + 0.32 * r() + 0.3 * borde * borde)) + (op.soloCerdas || rasgado ? 0 : 0.03));
      var fase = r() * 50, frec = 1.5 + r() * 2.5, grosor = Math.max(0.45, ancho / N * (rasgado ? 1.2 + r() * 0.5 : 1.3 + r() * 0.9));
      var fase2 = r() * 90, frec2 = 1.1 + r() * 2.6, umbral = rasgado * (0.45 + 0.5 * borde) * 0.85;
      ctx.strokeStyle = rgba(col, alfa * (rasgado ? 0.78 + r() * 0.22 : 0.5 + r() * 0.5)); ctx.lineWidth = grosor;
      if (rasgado) {
        // cada cerda es una cinta de grosor variable que se afila al empezar y al acabar cada tramo con tinta
        var tramoC = [], fase3 = r() * 70, frec3 = 4 + r() * 8, ond = (r() - 0.5) * 0.3;
        ctx.fillStyle = rgba(col, alfa * (0.72 + r() * 0.28));
        var cerrar = function () {
          var n = tramoC.length; if (n < 2) { tramoC = []; return; }
          var L = [], R = [];
          for (var m = 0; m < n; m++) {
            var c = tramoC[m], ta = Math.pow(Math.min(1, (m + 0.5) / 3, (n - m - 0.5) / 3), 0.7), hw = c.hw * ta;
            L.push([c.x + c.nx * hw, c.y + c.ny * hw]); R.push([c.x - c.nx * hw, c.y - c.ny * hw]);
          }
          ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]);
          for (var m2 = 1; m2 < n; m2++) ctx.lineTo(L[m2][0], L[m2][1]);
          for (var m3 = n - 1; m3 >= 0; m3--) ctx.lineTo(R[m3][0], R[m3][1]);
          ctx.closePath(); ctx.fill(); tramoC = [];
        };
        for (var k2 = 0; k2 < s.length; k2++) {
          var q2 = s[k2], g2 = q2.g, hueco2 = Math.min(0.85, Math.pow(g2 / Math.max(0.05, vida), 3) * seco * 0.95);
          var dep2 = g2 < vida && ruido1(g2 * frec * 6 + fase, b) > hueco2 && ruido1(g2 * frec2 * 3 + fase2, b + 31) > umbral;
          var w2 = anchoEn(q2) / 2, desv = off * 2 + (ruido1(g2 * 3 + fase3, b + 7) - 0.5) * ond / N * 6;
          if (dep2 && w2 > 0.25) tramoC.push({ x: q2.x + q2.nx * desv * w2 * (op.pelo || 0.96), y: q2.y + q2.ny * desv * w2 * (op.pelo || 0.96), nx: q2.nx, ny: q2.ny, hw: grosor / 2 * (0.55 + 0.9 * ruido1(g2 * frec3 + fase3, b + 13)) * Math.min(1, w2 * 2 / ancho + 0.3) });
          else cerrar();
        }
        cerrar();
        continue;
      }
      ctx.beginPath(); var dentro = false;
      for (var k = 0; k < s.length; k++) {
        var q = s[k], g = q.g, hueco = Math.min(0.85, Math.pow(g / Math.max(0.05, vida), 3) * seco * 0.95);
        var deposita = g < vida && ruido1(g * frec * 6 + fase, b) > hueco;
        var w = anchoEn(q) / 2, ox = q.nx * off * 2 * w * (op.pelo || 0.96), oy = q.ny * off * 2 * w * (op.pelo || 0.96);
        if (deposita && w > 0.25) { if (!dentro) { ctx.moveTo(q.x + ox, q.y + oy); dentro = true; } else ctx.lineTo(q.x + ox, q.y + oy); }
        else dentro = false;
      }
      ctx.stroke();
    }
    // la mancha de apoyar el pincel (discreta)
    if (op.gota) {
      var q0 = s[0], rr = ancho * 0.36 * (0.85 + r() * 0.3);
      ctx.fillStyle = rgba(col, alfa); ctx.beginPath(); ctx.ellipse(q0.x + q0.tx * rr * 0.6, q0.y + q0.ty * rr * 0.6, rr, rr * 0.75, Math.atan2(q0.ty, q0.tx), 0, TAU); ctx.fill();
    }
    if (op.salpica) {
      var qf = s[Math.max(0, Math.floor(s.length * 0.85))];
      T.salpicar(ctx, qf.x + qf.tx * ancho * 1.5, qf.y + qf.ty * ancho * 1.5, ancho * (op.salpica === true ? 2.2 : op.salpica), { n: 12, dir: Math.atan2(qf.ty, qf.tx), abre: 0.5, color: col, alfa: alfa, semilla: r() * 1e6 });
    }
  };

  /* Salpicadura: gotas con distribución de tamaños tipo ley de potencias; algunas alargadas, con cola.
     op: n, dir (si se lanza en una dirección), abre (apertura del abanico), color, alfa, semilla, min, max */
  T.salpicar = function (ctx, x, y, radio, op) {
    op = op || {}; var r = azar(op.semilla || ((Math.random() * 1e9) | 0)), n = op.n || 20, col = op.color || T.color.tinta, alfa = op.alfa == null ? 0.95 : op.alfa;
    ctx.fillStyle = rgba(col, alfa);
    for (var i = 0; i < n; i++) {
      var ang = op.dir == null ? r() * TAU : op.dir + (r() - 0.5) * TAU * (op.abre || 0.5);
      var d = radio * Math.pow(r(), op.dir == null ? 0.6 : 0.4), tam = Math.min(op.max || radio * 0.22, (op.min || 0.6) / Math.pow(r() * 0.97 + 0.03, 0.55) * (radio / 40));
      var px = x + Math.cos(ang) * d, py = y + Math.sin(ang) * d;
      ctx.beginPath();
      if (r() < (op.dir == null ? 0.08 : 0.22) && tam > 1.2) {   // gota alargada con su colita
        var lx = Math.cos(ang), ly = Math.sin(ang), larg = tam * (1.6 + r() * 2);
        ctx.ellipse(px, py, larg, tam, ang, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(px + lx * (larg + tam * 1.6), py + ly * (larg + tam * 1.6), tam * 0.35, 0, TAU);
      } else ctx.arc(px, py, tam, 0, TAU);
      ctx.fill();
    }
  };

  /* Aguada: una forma pintada con tinta diluida. dibujarForma(ctx, L) la traza en negro.
     op: gris (alfa general), degradado [arriba, abajo] (multiplica el alfa de arriba abajo de la forma: niebla),
         grano (granulado fino, 0…1), nubes (variación grande, 0…1), suave (desenfoque, px), borde (borde húmedo, 0…1), semilla,
         y0 / y1 (dónde empieza y acaba el degradado; por defecto, todo el lienzo) */
  T.aguada = function (ctx, w, h, dibujarForma, op) {
    op = op || {};
    // op.caja = [x0, y0, x1, y1] (px de ctx): solo se trabaja en ese recuadro, con margen para el desenfoque (mucho más
    // barato si la forma es pequeña en un lienzo grande); el moteado queda exactamente donde quedaría sin caja
    var x0 = 0, y0 = 0, bw = w, bh = h;
    if (op.caja) {
      var mg = Math.ceil((op.suave || 0) * 2.5) + 3;
      x0 = Math.max(0, Math.floor(op.caja[0]) - mg); y0 = Math.max(0, Math.floor(op.caja[1]) - mg);
      bw = Math.min(w, Math.ceil(op.caja[2]) + mg) - x0; bh = Math.min(h, Math.ceil(op.caja[3]) + mg) - y0;
      if (bw <= 0 || bh <= 0) return null;
    }
    var F = T.auxiliar('aguada', bw, bh), x = F.x;
    x.setTransform(1, 0, 0, 1, -x0, -y0); x.fillStyle = '#000'; x.strokeStyle = '#000'; dibujarForma(x, F);
    if (op.degradado) {
      var g = x.createLinearGradient(0, op.y0 == null ? 0 : op.y0, 0, op.y1 == null ? h : op.y1);
      g.addColorStop(0, 'rgba(0,0,0,' + op.degradado[0] + ')'); g.addColorStop(1, 'rgba(0,0,0,' + op.degradado[1] + ')');
      x.globalCompositeOperation = 'destination-in'; x.fillStyle = g; x.fillRect(x0, y0, bw, bh); x.globalCompositeOperation = 'source-over';
    }
    // el moteado va pegado al mundo si se da «ox» (px del mundo en el borde izquierdo del lienzo): así dos teselas vecinas casan
    var desp = ((((op.ox || 0) + (op.semilla || 0) * 97) % 512) + 512) % 512;
    if (op.nubes) {
      var tn = T.textura('nubes', 512, 3, 4, 1.4, 21, false);
      x.save(); x.globalCompositeOperation = 'destination-out'; x.globalAlpha = op.nubes; x.fillStyle = x.createPattern(tn.c, 'repeat'); x.translate(-desp, 0); x.fillRect(desp + x0, y0, bw, bh); x.restore();
    }
    if (op.grano !== 0) {
      var tg = T.textura('granulado', 256, 48, 2, 1.8, 9, false);
      x.save(); x.globalCompositeOperation = 'destination-out'; x.globalAlpha = op.grano == null ? 0.22 : op.grano; x.fillStyle = x.createPattern(tg.c, 'repeat'); x.translate(-desp, 0); x.fillRect(desp + x0, y0, bw, bh); x.restore();
    }
    x.setTransform(1, 0, 0, 1, 0, 0);
    var S = op.suave ? T.desenfocar(F, op.suave) : F;
    var gris = op.gris == null ? 0.35 : op.gris;
    ctx.save();
    ctx.globalAlpha = gris; ctx.drawImage(S.c, 0, 0, bw, bh, x0, y0, bw, bh);
    if (op.borde) { ctx.globalAlpha = gris * op.borde * 0.6; ctx.drawImage(F.c, 0, 0, bw, bh, x0, y0, bw, bh); }
    ctx.restore();
    return F;
  };


  /* Entintar una silueta ya pintada en negro (en su propio lienzo L): vetas de papel (pincel seco), grano y gotas en el borde.
     op: vetas: [{pts, ancho}] trazos que «borran» tinta siguiendo la forma; grano (0…1); gotas (nº); semilla */
  T.entintar = function (L, op) {
    op = op || {}; var x = L.x, r = azar(op.semilla || 11);
    if (op.vetas) {
      x.save(); x.globalCompositeOperation = 'destination-out';
      op.vetas.forEach(function (v) { T.pincelada(x, v.pts, { ancho: v.ancho, alfa: v.alfa == null ? 0.95 : v.alfa, carga: v.carga == null ? 0.9 : v.carga, seco: v.seco == null ? 0.8 : v.seco, soloCerdas: v.solido ? false : true, cerdas: v.cerdas, semilla: r() * 1e6, entrada: 0.15, salida: 0.35 }); });
      x.restore();
    }
    if (op.grano) {
      var tex = T.textura('grano', 256, 70, 2, 2.6, 5, false);
      x.save(); x.globalCompositeOperation = 'destination-out'; x.globalAlpha = op.grano; x.fillStyle = x.createPattern(tex.c, 'repeat'); x.fillRect(0, 0, L.w, L.h); x.restore();
    }
    if (op.gotas) {
      // gotas alrededor del borde: se buscan píxeles de borde en una muestra del alfa
      var im = x.getImageData(0, 0, L.w, L.h).data, bordes = [], paso = Math.max(2, Math.round(Math.min(L.w, L.h) / 120));
      for (var py = paso; py < L.h - paso; py += paso) for (var px = paso; px < L.w - paso; px += paso) {
        var a = im[(py * L.w + px) * 4 + 3], b = im[(py * L.w + px + paso) * 4 + 3], c = im[((py + paso) * L.w + px) * 4 + 3];
        if ((a > 128) !== (b > 128) || (a > 128) !== (c > 128)) bordes.push([px, py]);
      }
      for (var g = 0; g < op.gotas && bordes.length; g++) {
        var e = bordes[Math.floor(r() * bordes.length)];
        T.salpicar(x, e[0], e[1], Math.min(L.w, L.h) * (0.02 + r() * 0.05), { n: 3 + Math.floor(r() * 6), semilla: r() * 1e6, alfa: 0.9 });
      }
    }
    return L;
  };
})();
