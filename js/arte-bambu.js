/* El camino oculto · arte · bambú
   El bosque de bambú a la manera sumi-e, en piezas que se pintan una vez y se montan en cada fotograma con drawImage:
   · tramos de caña (entrenudos): un solo trazo de abajo arriba con el pincel cargado de lado (un borde más oscuro); cada
     cerda deja su veta y se seca a su manera, y donde se seca queda el papel (blanco volante);
   · nudos muy oscuros sobre un hilo de papel: un «一» caído (⌣), dos ganchos (八) o un apoyo fuerte en un borde;
   · ramitas en zigzag con sus nudillos y grupos de hojas «de pez» (gruesas a un tercio, punta de aguja que se abre seca),
     en dos tonos: cerca (negras, alguna gris o a medio tono detrás) y lejos (grises).
   A.dibujarBambu monta una caña (se mece, las hojas se van con el viento y se puede cortar) sin pintar ni una cerda por
   fotograma: unas 17 drawImage por caña. A.bambuFondo pinta un bosquecillo gris fijo, perdido en la niebla. */
(function () {
  'use strict';
  var SA = window.SA, T = SA.tinta, A = SA.arte, TAU = Math.PI * 2;
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function suave(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  var TINTA = T.color.tinta;

  /* ------------------------------------------------------------------ utilidades de trazo */
  // un lienzo auxiliar reutilizable (se pinta opaco y se pasa con su alfa: así un trazo no se oscurece donde se pisa)
  var aux = null;
  function auxiliar(w, h) {
    if (!aux || aux.w < w || aux.h < h) aux = T.lienzo(Math.max(w, aux ? aux.w : 0), Math.max(h, aux ? aux.h : 0));
    aux.x.setTransform(1, 0, 0, 1, 0, 0); aux.x.globalCompositeOperation = 'source-over'; aux.x.globalAlpha = 1;
    aux.x.clearRect(0, 0, w, h);
    return aux;
  }
  function pasar(x, S, w, h, alfa) { x.save(); x.globalAlpha = alfa; x.drawImage(S.c, 0, 0, w, h, 0, 0, w, h); x.restore(); }
  // contorno cerrado alrededor de las muestras s (T.remuestrear) con semianchos izq(g) y der(g)
  function contorno(x, s, izq, der, rug, sem) {
    var L = [], R = [], i;
    for (i = 0; i < s.length; i++) {
      var q = s[i], e1 = 1 + (T.ruido1(q.g * 13, sem) - 0.5) * rug, e2 = 1 + (T.ruido1(q.g * 13, sem + 5) - 0.5) * rug;
      var a = izq(q.g) * e1, b = der(q.g) * e2;
      L.push(q.x + q.nx * a, q.y + q.ny * a); R.push(q.x - q.nx * b, q.y - q.ny * b);
    }
    x.beginPath(); x.moveTo(L[0], L[1]);
    for (i = 2; i < L.length; i += 2) x.lineTo(L[i], L[i + 1]);
    for (i = R.length - 2; i >= 0; i -= 2) x.lineTo(R[i], R[i + 1]);
    x.closePath();
  }
  // recorta un lienzo a lo pintado (con un margen de 2 px): devuelve el lienzo nuevo y el desplazamiento (px del original)
  function recortar(c) {
    var w = c.width, h = c.height, dt = c.getContext('2d').getImageData(0, 0, w, h).data, x0 = w, y0 = h, x1 = -1, y1 = -1, x, y;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) if (dt[(y * w + x) * 4 + 3] > 1) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; y1 = y; }
    if (x1 < 0) return { c: c, ox: 0, oy: 0 };
    x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2); x1 = Math.min(w - 1, x1 + 2); y1 = Math.min(h - 1, y1 + 2);
    var L = T.lienzo(x1 - x0 + 1, y1 - y0 + 1); L.x.drawImage(c, -x0, -y0);
    return { c: L.c, ox: x0, oy: y0 };
  }
  // puntos de una Bézier cúbica
  function bezier(P0, P1, P2, P3, n) {
    var o = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n, m = 1 - t, a = m * m * m, b = 3 * m * m * t, c = 3 * m * t * t, d = t * t * t;
      o.push([a * P0[0] + b * P1[0] + c * P2[0] + d * P3[0], a * P0[1] + b * P1[1] + c * P2[1] + d * P3[1]]);
    }
    return o;
  }
  // vetas de pincel seco: líneas que borran tinta a lo largo de un trazo (de g0 a g1, a una fracción «off» del semiancho)
  function vetas(x, s, semi, n, op, r) {
    x.save(); x.globalCompositeOperation = 'destination-out'; x.lineCap = 'round';
    for (var k = 0; k < n; k++) {
      var off = (r() * 2 - 1) * (op.abre || 0.7), g0 = lerp(op.g0[0], op.g0[1], r()), g1 = lerp(op.g1[0], op.g1[1], r());
      x.strokeStyle = 'rgba(0,0,0,' + lerp(op.alfa[0], op.alfa[1], r()).toFixed(3) + ')';
      x.lineWidth = lerp(op.ancho[0], op.ancho[1], r()); x.beginPath(); var dentro = false;
      for (var i = 0; i < s.length; i++) {
        var q = s[i]; if (q.g < g0 || q.g > g1) continue;
        var w = semi(q.g) * off, px = q.x + q.nx * w, py = q.y + q.ny * w;
        if (!dentro) { x.moveTo(px, py); dentro = true; } else x.lineTo(px, py);
      }
      x.stroke();
    }
    x.restore();
  }

  /* ------------------------------------------------------------------ el tramo de caña (entrenudo)
     Se pinta píxel a píxel, de pie, como un trazo de abajo arriba con el pincel cargado de lado (el borde oscuro a la
     derecha; quien lo pone lo voltea si la caña tiene la luz al otro lado). El pincel son NB cerdas: cada una deja su veta
     (más o menos cargada) y se va secando a su manera, en grupos, antes por el lado claro y hacia el final del trazo; donde
     se seca queda el papel, con los extremos afilados. El perfil tiene la cintura y las puntas de hueso; el borde, fibras.
     wc, lc: ancho y largo (px css); d: densidad. Devuelve el lienzo con el eje (ax) y las dos puntas (y0 abajo, y1 arriba). */
  function pintarTramo(wc, lc, d, sem, op) {
    op = op || {};
    var r = T.azar(sem), W = Math.max(4, wc * d), Lp = Math.max(8, lc * d);
    var mx = Math.ceil(W * 0.25 + 3), my = Math.ceil(W * 0.22 + 3);
    var Lz = T.lienzo(W + 2 * mx, Lp + 2 * my), cw = Lz.w, ch = Lz.h;
    var im = Lz.x.createImageData(cw, ch), dd = im.data, cx = cw / 2, yb = my + Lp;
    var claro = op.claro == null ? 0.44 + r() * 0.16 : op.claro, oscuro = 0.95 + r() * 0.05, seco = op.seco == null ? 0.25 + r() * 0.45 : op.seco, carga = (r() - 0.5) * 0.16;
    var ancho0 = 0.55 + r() * 0.3;   // cuánto ocupa el lado oscuro
    var cin = 0.015 + r() * 0.03, cb = (r() - 0.6) * 0.03 * W, ct = r() * 0.025 * W, tb = (r() - 0.5) * 0.06 * W, tt = (r() - 0.5) * 0.06 * W;
    var s1 = r() * 100, s2 = r() * 100, s3 = r() * 100, s4 = r() * 100, asp = Lp / W, py, px, b;
    // las cerdas
    var NB = Math.max(6, Math.round(W / (1.7 + r() * 0.5))), NB2 = NB + 2;
    var dens = new Float32Array(NB2), fin = new Float32Array(NB2), G = new Float32Array(NB2 * ch), P = new Float32Array(NB2 * ch);
    var grupo = 2 + Math.floor(r() * 3);
    for (b = 0; b < NB2; b++) { dens[b] = 0.8 + r() * 0.4; fin[b] = (r() - 0.5) * 0.05 * W; }
    for (b = 0; b < NB2; b++) {
      var fr = (1.4 + r() * 2.6) * Math.max(0.6, asp / 8), fa = r() * 100, gb = Math.floor(b / grupo);
      for (py = 0; py < ch; py++) {
        var vv = (yb - py - 0.5) / Lp;
        G[b * ch + py] = T.ruido1(vv * fr * 0.8 + gb * 3.7, gb + s3) * 0.55 + T.ruido1(vv * fr + fa, b + s1) * 0.3 + T.ruido1(vv * fr * 3.3 + fa, b + s2) * 0.15;
        P[b * ch + py] = (T.ruido1(vv * asp * 0.35 + gb * 1.9, gb + s4) - 0.5) * 0.3;   // charcos: la tinta se acumula a ratos
      }
    }
    // lo que sólo depende de la altura (v)
    var HW = new Float32Array(ch), EL = new Float32Array(ch), ER = new Float32Array(ch), SEC = new Float32Array(ch), TV = new Float32Array(ch), WB = new Float32Array(ch);
    var fw = 2 + r() * 3, fwa = r() * TAU;
    for (py = 0; py < ch; py++) {
      var vc = clamp((yb - py - 0.5) / Lp, 0, 1), vp = vc * Lp;
      HW[py] = 1 - cin * Math.sin(Math.PI * vc) + 0.07 * Math.exp(-vp / (W * 0.4)) + 0.05 * Math.exp(-(Lp - vp) / (W * 0.3));
      EL[py] = (T.fbm1(vc * asp * 0.8, s1, 3) - 0.5) * 0.06 + (T.ruido1(vp * 0.45, s1 + 3) - 0.5) * 0.025;
      ER[py] = (T.fbm1(vc * asp * 0.8, s2, 3) - 0.5) * 0.06 + (T.ruido1(vp * 0.45, s2 + 3) - 0.5) * 0.025;
      // se seca a partir de la mitad, pero al acabar el pincel vuelve a apoyar y carga el borde del nudo
      SEC[py] = seco * (0.03 + 0.97 * suave(0.12, 0.62, vc) * (1 - 0.75 * suave(0.74, 0.97, vc)));
      TV[py] = 0.12 * Math.exp(-vp / (W * 0.5)) + 0.12 * Math.exp(-(Lp - vp) / (W * 0.3)) - 0.08 * vc;
      WB[py] = 0.35 * Math.sin(vc * fw * TAU / 4 + fwa) + 0.15 * Math.sin(vc * fw * 2.3 + fwa * 2);
    }
    for (py = 0; py < ch; py++) {
      var v = (yb - py - 0.5) / Lp;
      for (px = 0; px < cw; px++) {
        var acc = 0, halo = 0;
        for (var ss = 0; ss < 2; ss++) {
          var u = (px + 0.25 + ss * 0.5 - cx) / (W / 2), au = u < 0 ? -u : u;
          var lim = HW[py] * (1 + (u < 0 ? EL[py] : ER[py]));
          var lu = u / lim, bu = (lu + 1) / 2 * NB + WB[py], bi = Math.floor(bu), f = bu - bi;
          if (bi < 0) { bi = 0; f = 0; } else if (bi > NB - 1) { bi = NB - 1; f = 1; }
          var dE = (lim - au) * W / 2, dB = v * Lp - (cb * (1 - u * u) + tb * u), dT = (1 - v) * Lp - (ct * (1 - u * u) + tt * u) + fin[bi];
          var cov = Math.min(dE, dB, dT) + 0.5;
          if (cov <= 0) { if (dE > -1.6 && dB > 0 && dT > 0) halo += (1 + dE / 1.6); continue; }
          if (cov > 1) cov = 1;
          var side = clamp((lu + 1) / 2, 0, 1), prof = Math.sin(Math.PI * f), al = lu < 0 ? -lu : lu;
          var dn = dens[bi] * (1 - f) + dens[bi + 1] * f, k0 = bi * ch + py, k1 = k0 + ch;
          var thr = SEC[py] * (0.5 + 0.38 * (1 - side) + 0.3 * al * al * al * al);
          var tinta = suave(thr - 0.018, thr + 0.018, G[k0] - (1 - prof) * 0.09);
          var lad = suave(1 - ancho0 * 1.1, 1 - ancho0 * 0.1, side);   // el lado oscuro, ancho y de borde blando
          var tono = claro + carga + (oscuro - claro) * lad + TV[py] + 0.18 * suave(0.8, 0.97, lu) + 0.2 * suave(0.82, 0.97, -lu) + P[k0] * (1 - f) + P[k1] * f;
          acc += cov * clamp(tono * dn * (0.9 + 0.1 * prof), 0, 1) * tinta;
        }
        var a = acc / 2 * (0.93 + 0.07 * T.h2(px, py)) + halo * 0.045 * T.h2(px * 1.3, py * 0.7);
        if (a <= 0.004) continue;
        var i = (py * cw + px) * 4;
        dd[i] = TINTA[0]; dd[i + 1] = TINTA[1]; dd[i + 2] = TINTA[2]; dd[i + 3] = Math.round(Math.min(1, a) * 255);
      }
    }
    Lz.x.putImageData(im, 0, 0);
    return { c: Lz.c, w: cw / d, h: ch / d, ax: cx / d, y0: yb / d, y1: my / d, ancho: wc, largo: lc };
  }

  /* ------------------------------------------------------------------ el nudo
     Muy oscuro, sobre el hueco entre dos tramos (centrado en (cx, cy) = el centro del hueco), de tres maneras:
     0 · un trazo corto como un «一» de caligrafía algo caído (⌣): cabeza apoyada en diagonal, cuerpo más fino y cola que
         vuelve a apoyar y se levanta;
     1 · dos ganchos, uno en cada borde (八): apoyan fuera y se afilan hacia dentro; en medio queda el papel del hueco;
     2 · un apoyo fuerte en un borde que cruza la caña afilándose, y un toque pequeño en el otro.
     A veces, un ⌒ corto y fino encima, en un lado (el principio del tramo de arriba). */
  function pintarNudo(wc, d, sem, tipo) {
    var r = T.azar(sem), W = wc * d, cw = Math.ceil(W * 1.7 + 8), ch = Math.ceil(W * 0.8 + 8);
    var Lz = T.lienzo(cw, ch), cx = cw / 2, cy = ch / 2, S = auxiliar(cw, ch), x = S.x, i;
    var dir = r() < 0.5 ? 1 : -1, e = W * (0.56 + r() * 0.07), pr = W * (0.012 + r() * 0.028), y0 = cy + W * (0.012 + r() * 0.012);
    var g0 = W * (0.078 + r() * 0.022), gm = g0 * (0.66 + r() * 0.16), gc = g0 * (0.85 + r() * 0.3), N = 24;
    var cola = W * (0.02 + r() * 0.04), ladeo = (r() < 0.5 ? -1 : 1) * W * (0.015 + r() * 0.03);
    x.fillStyle = '#000';
    // un trazo de (xa) a (xb) con su perfil y una gota donde apoya
    function trazoNudo(xa, xb, perfil, caida, gota) {
      var pts = [];
      for (var j = 0; j <= N; j++) { var f = j / N; pts.push([lerp(xa, xb, f), y0 + caida(f) + ladeo * (lerp(xa, xb, f) - cx) / e + (r() - 0.5) * W * 0.004]); }
      var s = T.remuestrear(pts, 0.5);
      contorno(x, s, perfil, perfil, 0.35, r() * 100); x.fill();
      if (gota) { var q = s[0]; x.beginPath(); x.ellipse(q.x + q.tx * gota * 0.4, q.y - gota * 0.12, gota * 1.3, gota * 0.95, Math.atan2(q.ty, q.tx) + (r() - 0.5) * 0.5, 0, TAU); x.fill(); }
      return s;
    }
    if (tipo === 1) {
      [-1, 1].forEach(function (sg) {
        var g = g0 * (0.9 + r() * 0.25), dentro = e * (0.22 + r() * 0.2);
        trazoNudo(cx + sg * e, cx + sg * dentro, function (gg) { return g * (1 - 0.72 * Math.pow(gg, 0.8)); }, function (f) { return pr * 1.6 * f * f; }, g);
      });
    } else if (tipo === 2) {
      var g2 = g0 * (1.05 + r() * 0.2);
      trazoNudo(cx + dir * e, cx - dir * e * (0.35 + r() * 0.3), function (gg) { return g2 * (1 - 0.7 * Math.pow(gg, 0.9)); }, function (f) { return pr * Math.sin(f * Math.PI * 0.8); }, g2);
      trazoNudo(cx - dir * e, cx - dir * e * 0.72, function (gg) { return g0 * 0.7 * (1 - 0.6 * gg); }, function () { return 0; }, g0 * 0.75);
    } else {
      var s0 = trazoNudo(cx - dir * e, cx + dir * e, function (g) { return g < 0.15 ? lerp(g0 * 0.75, g0, g / 0.15) : g < 0.5 ? lerp(g0, gm, (g - 0.15) / 0.35) : g < 0.88 ? lerp(gm, gc, (g - 0.5) / 0.38) : gc * (1 - Math.pow((g - 0.88) / 0.12, 2) * 0.55); },
        function (f) { return pr * Math.sin(f * Math.PI) - cola * Math.pow(f, 6); }, g0);
      var q1 = s0[s0.length - 1];   // la cola: vuelve a apoyar, redondeada
      x.beginPath(); x.ellipse(q1.x - q1.tx * gc * 0.3, q1.y, gc * 1.05, gc * 0.9, Math.atan2(q1.ty, q1.tx), 0, TAU); x.fill();
    }
    if (r() < 0.4) {   // el ⌒ corto
      var lado = r() < 0.5 ? -1 : 1, e2 = W * (0.2 + r() * 0.14), ya = cy - W * (0.055 + r() * 0.02), pts2 = [];
      for (i = 0; i <= 12; i++) { var f2 = i / 12; pts2.push([cx + lado * (e * 0.95 - f2 * e2 * 1.6), ya - W * 0.03 * Math.sin(f2 * Math.PI * 0.9) + W * 0.018 * f2]); }
      var s2 = T.remuestrear(pts2, 0.5), g3 = W * (0.03 + r() * 0.015);
      contorno(x, s2, function (g) { return g3 * (1 - g * 0.8); }, function (g) { return g3 * (1 - g * 0.8); }, 0.2, r() * 100);
      x.fill();
    }
    pasar(Lz.x, S, cw, ch, 1);
    var rc = recortar(Lz.c);
    return { c: rc.c, w: rc.c.width / d, h: rc.c.height / d, cx: (cx - rc.ox) / d, cy: (cy - rc.oy) / d, ancho: wc, tipo: tipo || 0 };
  }

  /* ------------------------------------------------------------------ la hoja
     Un solo toque de pincel con forma de pez: entra fina (la punta del pincel), se ensancha hasta un tercio y se afila en
     una aguja larga; la punta, seca, se abre en cerdas. Se pinta opaca en un lienzo auxiliar. */
  function hoja(x, bx, by, ang, largo, ancho, op, r) {
    var dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx, c1 = op.c1 || 0, c2 = op.c2 || 0, c3 = op.c3 || 0;
    var pts = bezier([bx, by], [bx + dx * largo * 0.33 + nx * c1 * largo, by + dy * largo * 0.33 + ny * c1 * largo],
      [bx + dx * largo * 0.67 + nx * c2 * largo, by + dy * largo * 0.67 + ny * c2 * largo], [bx + dx * largo + nx * c3 * largo, by + dy * largo + ny * c3 * largo], 28);
    var s = T.remuestrear(pts, Math.max(0.5, ancho * 0.06)), v0 = op.vientre || 0.3, asim = op.asim || 0, hw = ancho / 2;
    function semi(g) {
      if (g < v0) { var a = g / v0; return hw * (0.07 + 0.93 * Math.pow(Math.sin(a * Math.PI / 2), 1.2)); }
      var t = (g - v0) / (1 - v0); return hw * Math.pow(1 - t, 1.35) * (1 + 0.3 * t * (1 - t));
    }
    function izq(g) { return semi(g) * (1 + asim * Math.sin(Math.PI * g)); }
    function der(g) { return semi(g) * (1 - asim * Math.sin(Math.PI * g)); }
    contorno(x, s, izq, der, 0.08, r() * 100);
    x.fillStyle = '#000'; x.fill();
    // el apoyo del pincel en la base
    x.beginPath(); x.ellipse(bx + dx * hw * 0.2, by + dy * hw * 0.2, hw * 0.36, hw * 0.26, ang, 0, TAU); x.fill();
    // la tinta se acaba hacia la punta
    x.save(); x.globalCompositeOperation = 'destination-out';
    var gr = x.createLinearGradient(bx, by, bx + dx * largo, by + dy * largo);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.6, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,' + (0.05 + (op.seco || 0.5) * 0.15).toFixed(3) + ')');
    x.fillStyle = gr; contorno(x, s, function (g) { return izq(g) + 2; }, function (g) { return der(g) + 2; }, 0, 1); x.fill();
    x.restore();
    // la punta seca se abre en cerdas; a veces, un hilo de papel por el centro (el vientre del pincel)
    var seco = op.seco == null ? 0.5 : op.seco;
    vetas(x, s, semi, Math.round(1 + seco * 4), { g0: [0.55 + (1 - seco) * 0.2, 0.92], g1: [1, 1], alfa: [0.75, 1], ancho: [Math.max(0.45, ancho * 0.04), Math.max(0.6, ancho * 0.085)], abre: 0.7 }, r);
    if (r() < 0.35) vetas(x, s, semi, 1, { g0: [0.15, 0.25], g1: [0.45, 0.7], alfa: [0.3, 0.55], ancho: [Math.max(0.45, ancho * 0.04), Math.max(0.6, ancho * 0.07)], abre: 0.2 }, r);
  }

  /* ------------------------------------------------------------------ el grupo de hojas
     Cuelga de la punta de una ramita (el pivote, a la izquierda) y mira hacia +x (+y es «abajo» cuando se pone): un
     tallito con tres puntos de donde salen de cuatro a seis hojas en abanico caído, una más larga que las demás, curvadas
     por su peso; a veces una gris detrás y alguna a medio tono. lejos: grises, menos y más finas (fondo y cañas lejanas). */
  function pintarRacimo(Lh, d, sem, lejos) {
    var r = T.azar(sem), Lp = Lh * d, n = lejos ? 3 + Math.floor(r() * 2) : 4 + Math.floor(r() * 3);
    var m = Math.ceil(Lp * 0.1 + 4), cw = Math.ceil(Lp * 1.22 + 2 * m), ch = Math.ceil(Lp * 1.5 + 2 * m);
    var Lz = T.lienzo(cw, ch), px0 = m, py0 = Math.round(ch * 0.4);
    var tl = Lp * (0.1 + r() * 0.12), tc = (r() - 0.2) * 0.25;
    var P = [[px0 + tl * 0.3, py0 + tl * 0.3 * tc], [px0 + tl * 0.65, py0 + tl * 0.65 * tc * 1.3], [px0 + tl, py0 + tl * tc * 1.6]];
    var dom = Math.floor(r() * n), lista = [], i;
    var a0 = -0.42 + r() * 0.15, a1 = 0.5 + r() * 0.3;
    for (i = 0; i < n; i++) {
      var f = n > 1 ? i / (n - 1) : 0.5, lar = Lp * (i === dom ? 0.95 + r() * 0.1 : 0.62 + r() * 0.3), ang = lerp(a0, a1, f) + (r() - 0.5) * 0.12;
      var peso = 0.02 + r() * 0.05 + Math.max(0, -ang) * 0.07;
      lista.push({
        ang: ang, lar: lar, an: lar * (lejos ? 0.095 + r() * 0.02 : 0.105 + r() * 0.03), en: P[i === dom ? 2 : Math.floor(r() * 3)], gris: lejos, medio: !lejos && i !== dom && r() < 0.22, seco: 0.25 + r() * 0.6,
        c1: (r() - 0.5) * 0.04, c2: peso * 0.8 + (r() - 0.5) * 0.03, c3: peso * 1.7 + (r() - 0.5) * 0.05, vientre: 0.28 + r() * 0.12, asim: (r() - 0.5) * 0.36
      });
    }
    if (!lejos && r() < 0.6) lista.unshift({ ang: (r() < 0.5 ? a0 - 0.25 : a1 + 0.2) + (r() - 0.5) * 0.2, lar: Lp * (0.6 + r() * 0.3), an: Lp * 0.07, en: P[0], gris: true, seco: 0.6, c1: 0, c2: 0.03, c3: 0.07, vientre: 0.3, asim: 0 });
    // el tallito
    var S = auxiliar(cw, ch), st = T.remuestrear([[px0, py0], P[0], P[1], P[2]], 0.5), gt = Math.max(0.55, Lp * 0.009);
    contorno(S.x, st, function (g) { return gt * (1 - g * 0.45); }, function (g) { return gt * (1 - g * 0.45); }, 0.1, 3);
    S.x.fillStyle = '#000'; S.x.fill();
    pasar(Lz.x, S, cw, ch, lejos ? 0.45 : 0.9);
    lista.forEach(function (h) {
      // sólo se borra y se pasa el recuadro de la hoja
      var ex = Math.cos(h.ang) * h.lar, ey = Math.sin(h.ang) * h.lar, mg = h.an + h.lar * 0.2 + 4;
      var x0 = Math.max(0, Math.floor(Math.min(h.en[0], h.en[0] + ex) - mg)), y0 = Math.max(0, Math.floor(Math.min(h.en[1], h.en[1] + ey) - mg));
      var x1 = Math.min(cw, Math.ceil(Math.max(h.en[0], h.en[0] + ex) + mg)), y1 = Math.min(ch, Math.ceil(Math.max(h.en[1], h.en[1] + ey) + mg));
      S.x.clearRect(x0, y0, x1 - x0, y1 - y0);
      hoja(S.x, h.en[0], h.en[1], h.ang, h.lar, h.an, h, r);
      Lz.x.save(); Lz.x.globalAlpha = lejos ? 0.38 + r() * 0.2 : h.gris ? 0.3 + r() * 0.14 : h.medio ? 0.6 + r() * 0.12 : 0.9 + r() * 0.08;
      Lz.x.drawImage(S.c, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0); Lz.x.restore();
    });
    var rc = recortar(Lz.c);
    return { c: rc.c, w: rc.c.width / d, h: rc.c.height / d, px: (px0 - rc.ox) / d, py: (py0 - rc.oy) / d, largo: Lh };
  }

  /* ------------------------------------------------------------------ la ramita
     Fina, en zigzag (se quiebra un poco en cada nudillo), de la base (pivote) hacia +x y más fina al final; en cada nudillo,
     un engrosamiento y a veces la vaina: un toque corto hacia fuera. Devuelve la punta y los nudillos (para colgar hojas). */
  function pintarRamita(Lt, Wt, d, sem) {
    var r = T.azar(sem), Lp = Lt * d, Wp = Math.max(1.3, Wt * d), nseg = 2 + Math.floor(r() * 3);
    var m = Math.ceil(Wp * 2 + Lp * 0.12 + 4), cw = Math.ceil(Lp * 1.05 + 2 * m), ch = Math.ceil(Lp * 0.6 + 2 * m);
    var Lz = T.lienzo(cw, ch), S = auxiliar(cw, ch), p0 = [m, ch * 0.6], p = p0, a = -0.06 + (r() - 0.5) * 0.1, nudillos = [];
    var largos = [], tot = 0, i, zig = r() < 0.5 ? -1 : 1;
    for (i = 0; i < nseg; i++) { largos.push(0.65 + r() * 0.7); tot += largos[i]; }
    S.x.fillStyle = '#000';
    for (i = 0; i < nseg; i++) {
      var l = Lp * largos[i] / tot, q = [p[0] + Math.cos(a) * l, p[1] + Math.sin(a) * l];
      var w0 = Wp * (1 - 0.55 * i / nseg) / 2, w1 = Wp * (1 - 0.55 * (i + 1) / nseg) / 2 * 0.85;
      var mid = [lerp(p[0], q[0], 0.5) - Math.sin(a) * l * 0.03 * (r() - 0.5), lerp(p[1], q[1], 0.5) + Math.cos(a) * l * 0.03 * (r() - 0.5)];
      var s = T.remuestrear([p, mid, q], 0.5);
      contorno(S.x, s, function (g) { return lerp(w0, w1, g) * (g < 0.08 ? 1.25 : 1); }, function (g) { return lerp(w0, w1, g); }, 0.15, r() * 100);
      S.x.fill();
      if (i < nseg - 1) {
        S.x.beginPath(); S.x.ellipse(q[0], q[1], w1 * 1.6, w1 * 1.2, a, 0, TAU); S.x.fill();
        if (r() < 0.6) {   // la vaina
          var va = a + zig * (0.5 + r() * 0.3), vl = Lp * (0.06 + r() * 0.06), pv = [q[0] + Math.cos(va) * vl, q[1] + Math.sin(va) * vl];
          var sv = T.remuestrear([q, [lerp(q[0], pv[0], 0.5), lerp(q[1], pv[1], 0.5)], pv], 0.5);
          contorno(S.x, sv, function (g) { return w1 * 0.9 * (1 - g); }, function (g) { return w1 * 0.9 * (1 - g); }, 0.1, r() * 100); S.x.fill();
        }
        nudillos.push([q[0] / d, q[1] / d, a]);
      }
      p = q; a += zig * (0.12 + r() * 0.16); zig = -zig;
    }
    pasar(Lz.x, S, cw, ch, 0.8);
    var rc = recortar(Lz.c), ox = rc.ox / d, oy = rc.oy / d;
    nudillos.forEach(function (q) { q[0] -= ox; q[1] -= oy; });
    return { c: rc.c, w: rc.c.width / d, h: rc.c.height / d, px: p0[0] / d - ox, py: p0[1] / d - oy, punta: [p[0] / d - ox, p[1] / d - oy], nudillos: nudillos, largo: Lt };
  }

  /* ------------------------------------------------------------------ piezas compuestas
     Para montar con menos llamadas por fotograma: el tramo con el nudo de su punta de arriba (se ponen de arriba abajo, así
     cada nudo queda encima del principio del tramo siguiente) y la ramita con el grupo de hojas de su primer nudillo. */
  function conNudo(p, N, an, d) {
    var hx = p.ax - N.cx, hy = p.y1 - an * 0.025 - N.cy;
    var x0 = Math.min(0, hx), y0 = Math.min(0, hy), x1 = Math.max(p.w, hx + N.w), y1 = Math.max(p.h, hy + N.h);
    var L = T.lienzo((x1 - x0) * d, (y1 - y0) * d);
    L.x.drawImage(p.c, -x0 * d, -y0 * d); L.x.drawImage(N.c, (hx - x0) * d, (hy - y0) * d);
    return { c: L.c, w: L.w / d, h: L.h / d, ax: p.ax - x0, y0: p.y0 - y0, y1: p.y1 - y0, ancho: p.ancho, largo: p.largo };
  }
  function conHojas(rm, g, d, r) {
    var q = rm.nudillos[0] || rm.punta, th = 1.35 + r() * 0.7, e = 0.62 + r() * 0.16;
    var G = Math.ceil(Math.hypot(g.w, g.h) * e * d) + 4, L = T.lienzo(rm.c.width + 2 * G, rm.c.height + 2 * G);
    L.x.drawImage(rm.c, G, G);
    L.x.save(); L.x.translate(G + q[0] * d, G + q[1] * d); L.x.rotate(th); L.x.scale(e, e); L.x.drawImage(g.c, -g.px * d, -g.py * d); L.x.restore();
    var rc = recortar(L.c), ox = (rc.ox - G) / d, oy = (rc.oy - G) / d;
    return { c: rc.c, w: rc.c.width / d, h: rc.c.height / d, px: rm.px - ox, py: rm.py - oy, punta: [rm.punta[0] - ox, rm.punta[1] - oy], nudillos: rm.nudillos.map(function (n) { return [n[0] - ox, n[1] - oy, n[2]]; }), largo: rm.largo };
  }

  /* ------------------------------------------------------------------ el juego de piezas
     Para cañas de «alto» px (css). op: dpr (densidad del lienzo; 1 por defecto), semilla.
     Devuelve { alto, dpr, ancho (el ancho nominal de los tramos), largos: [tramos largos], cortos: [tramos cortos],
     nudos, ramitas, hojas: { cerca, lejos }, y las compuestas: largosN, cortosN (tramo + nudo), ramas, ramasLejos
     (ramita + hojas) }. Se guarda en caché por alto, densidad y semilla. */
  var CACHE = {};
  A.bambuPiezas = function (alto, op) { var g = A.bambuPiezasPasos(alto, op), p = g.next(); while (!p.done) p = g.next(); return p.value; };
  // (por pasos: unas pocas piezas en cada uno)
  A.bambuPiezasPasos = function* (alto, op) {
    op = op || {};
    var d = op.dpr || 1, sem = op.semilla || 5, clave = Math.round(alto) + '·' + d + '·' + sem;
    if (CACHE[clave]) return CACHE[clave];
    var an = alto * 0.016, i, pz = { alto: alto, dpr: d, ancho: an, largos: [], cortos: [], nudos: [], ramitas: [], hojas: { cerca: [], lejos: [] } };
    var r = T.azar(sem * 131 + 7), rn = T.azar(sem * 137 + 11), rr = T.azar(sem * 139 + 13), rh = T.azar(sem * 149 + 17), rc = T.azar(sem * 151 + 19);   // un azar por familia
    for (i = 0; i < 7; i++) { pz.largos.push(pintarTramo(an, alto * 0.125, d, Math.floor(r() * 1e9) + 1)); if (i % 2) yield 'piezas'; }
    yield 'piezas';
    for (i = 0; i < 4; i++) pz.cortos.push(pintarTramo(an, alto * 0.06, d, Math.floor(r() * 1e9) + 1, { seco: 0.15 + r() * 0.3 }));
    yield 'piezas';
    for (i = 0; i < 7; i++) pz.nudos.push(pintarNudo(an, d, Math.floor(rn() * 1e9) + 1, [0, 1, 0, 2, 1, 0, 1][i]));
    yield 'piezas';
    for (i = 0; i < 6; i++) pz.ramitas.push(pintarRamita(alto * (0.022 + rr() * 0.018), an * 0.17, d, Math.floor(rr() * 1e9) + 1));
    yield 'piezas';
    for (i = 0; i < 10; i++) { pz.hojas.cerca.push(pintarRacimo(alto * 0.09, d, Math.floor(rh() * 1e9) + 1, false)); if (i % 3 === 2) yield 'piezas'; }
    for (i = 0; i < 6; i++) { pz.hojas.lejos.push(pintarRacimo(alto * 0.08, d, Math.floor(rh() * 1e9) + 1, true)); if (i % 3 === 2) yield 'piezas'; }
    pz.largosN = pz.largos.map(function (p, j) { return conNudo(p, pz.nudos[j % pz.nudos.length], an, d); });
    pz.cortosN = pz.cortos.map(function (p, j) { return conNudo(p, pz.nudos[(j + 3) % pz.nudos.length], an, d); });
    yield 'piezas';
    pz.ramas = pz.ramitas.map(function (rm, j) { return conHojas(rm, pz.hojas.cerca[(j * 3 + 1) % pz.hojas.cerca.length], d, rc); });
    pz.ramasLejos = pz.ramitas.map(function (rm, j) { return conHojas(rm, pz.hojas.lejos[j % pz.hojas.lejos.length], d, rc); });
    CACHE[clave] = pz;
    return pz;
  };

  /* ------------------------------------------------------------------ cómo es cada caña (por su semilla)
     Los nudos (fracciones del alto: más juntos abajo), qué pieza va en cada tramo (con su nudo) y dónde salen ramitas
     con hojas (más arriba, alternando los lados; algunas por detrás de la caña; la copa siempre tiene). */
  var DISPOS = {};
  function disposicion(sem) {
    var clave = '' + sem;
    if (DISPOS[clave]) return DISPOS[clave];
    var r = T.azar(Math.floor(T.h1(sem * 1.37 + 0.5) * 1e9) + 3), nodos = [-0.015], k = -0.015, i = 0, base = 0.108 + r() * 0.028;
    while (k < 0.99) { k += base * (0.4 + 0.6 * suave(0, 4, i)) * (0.88 + r() * 0.24); nodos.push(k); i++; }
    var D = { lado: r() < 0.5 ? -1 : 1, nodos: nodos, tramos: [], racimos: [] }, ladoR = r() < 0.5 ? -1 : 1;
    for (i = 0; i < nodos.length - 1; i++) D.tramos.push({ corto: nodos[i + 1] - nodos[i] < 0.085, v: Math.floor(r() * 7) });
    for (i = 2; i < nodos.length; i++) {
      var kk = nodos[i], p = kk > 0.86 ? 1 : 0.06 + 0.86 * suave(0.34, 0.8, kk);   // la copa siempre tiene hojas
      if (r() > p) {   // sin hojas: a veces, una ramita pelada
        if (r() < 0.3 && kk > 0.2) D.racimos.push({ k: kk, lado: (ladoR = -ladoR), ramita: Math.floor(r() * 6), phi: 0.75 + r() * 0.4, esc: 0.5 + r() * 0.25, hojas: [], detras: false, fase: r() * TAU });
        continue;
      }
      ladoR = r() < 0.8 ? -ladoR : ladoR;
      var rc = { k: kk, lado: ladoR, ramita: Math.floor(r() * 6), phi: 0.6 + r() * 0.42, esc: 0.8 + r() * 0.45, hojas: [], detras: r() < 0.22, fase: r() * TAU, conHojas: r() < 0.6 };
      rc.hojas.push({ v: Math.floor(r() * 10), theta: 0.12 + r() * 0.4, esc: 0.85 + r() * 0.3, fase: r() * TAU });
      D.racimos.push(rc);
    }
    DISPOS[clave] = D;
    return D;
  }

  /* ------------------------------------------------------------------ montar una caña en el fotograma
     ctx: el contexto (con la transformación que tenga, p. ej. la de dpr); (x0, y0): la raíz en el suelo; alto, ancho en px;
     ang, curva: la flexión (el punto a la fracción k está a un ángulo a(k) = ang·k² + curva·k de la vertical);
     piezas: A.bambuPiezas(…) (si no se dan, las de la caché para este alto y la densidad del contexto).
     op: viento (≈0…1, + hacia la derecha), t (ms), tono (0,4…1; se multiplica por el globalAlpha que traiga el contexto),
     semilla (cada caña la suya), lejos (hojas grises), corte: { k, dx, f, giro } (la parte de arriba resbala y cae como en
     el secreto), u, H (px; para el corte). */
  var M0 = [1, 0, 0, 1, 0, 0];
  function mul(m, n) {   // m · n (afines 2D)
    return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  }
  // pone una pieza (lienzo img de w×h css) con su pivote (pvx, pvy) en (X, Y), girada th y escalada (sx, sy), bajo la matriz M
  // (absoluta; o relativa a la transformación que ya tiene el contexto si rel, cuando no hay getTransform)
  function poner(ctx, M, rel, img, w, h, pvx, pvy, X, Y, th, sx, sy) {
    var co = Math.cos(th), si = Math.sin(th), a = co * sx, b = si * sx, c = -si * sy, dd = co * sy;
    var e = X - (a * pvx + c * pvy), f = Y - (b * pvx + dd * pvy);
    var A0 = M[0] * a + M[2] * b, B0 = M[1] * a + M[3] * b, C0 = M[0] * c + M[2] * dd, D0 = M[1] * c + M[3] * dd, E0 = M[0] * e + M[2] * f + M[4], F0 = M[1] * e + M[3] * f + M[5];
    if (rel) { ctx.save(); ctx.transform(A0, B0, C0, D0, E0, F0); ctx.drawImage(img, 0, 0, w, h); ctx.restore(); }
    else { ctx.setTransform(A0, B0, C0, D0, E0, F0); ctx.drawImage(img, 0, 0, w, h); }
  }
  function anguloHacia(th, obj, s) { var dl = obj - th; while (dl > Math.PI) dl -= TAU; while (dl < -Math.PI) dl += TAU; return th + dl * s; }

  A.dibujarBambu = function (ctx, x0, y0, alto, ancho, ang, curva, pz, op) {
    op = op || {};
    var D = disposicion(op.semilla || 1), tono = (op.tono == null ? 1 : op.tono) * ctx.globalAlpha, vi = clamp(op.viento || 0, -1.6, 1.6), t = op.t || 0;
    var H = op.H || alto / 1.02, u = op.u || H, corte = op.corte, lado = D.lado, Hc = corte ? 1e9 : H;
    // la transformación que trae el contexto (dpr…): se compone con la de cada pieza; sin getTransform, se trabaja en relativo
    var tr = ctx.getTransform ? ctx.getTransform() : null, B = tr ? [tr.a, tr.b, tr.c, tr.d, tr.e, tr.f] : null, rel = !B;
    function abs(M) { return B ? mul(B, M) : M; }
    pz = pz || A.bambuPiezas(alto, { dpr: B ? Math.max(1, Math.round(Math.hypot(B[0], B[1]) * 2) / 2) : 1 });
    var ka = alto / pz.alto, hojas = op.lejos ? pz.hojas.lejos : pz.hojas.cerca, nodos = D.nodos, hueco = ancho * 0.05;
    function aK(k) { return ang * k * k + curva * k; }
    function px(k) { return x0 + Math.sin(aK(k)) * alto * k; }
    function py(k) { return y0 - Math.cos(aK(k)) * alto * k; }
    function anchoEn(k) { return ancho * (1.04 - 0.16 * clamp(k, 0, 1) - 0.3 * suave(0.86, 1.02, k)); }
    function visible(y) { return y > -alto * 0.14; }   // (las hojas cuelgan: un nudo por encima de la pantalla aún se ve)
    // la ramita de un nudo y sus hojas
    function racimo(M, rc, alfa) {
      var k = rc.k, a = aK(k), X = px(k), Y = py(k); if (!visible(Y)) return;
      var rm = (rc.conHojas ? (op.lejos ? pz.ramasLejos : pz.ramas) : pz.ramitas)[rc.ramita], s = rc.lado, w2 = anchoEn(k) * 0.4;
      var bx = X + Math.cos(a) * w2 * s, by = Y + Math.sin(a) * w2 * s - hueco;
      var esc = rc.esc * ka, fl = Math.sin(t * 0.0021 + rc.fase) * (0.012 + 0.025 * Math.abs(vi));
      var phiW = (s > 0 ? -rc.phi : Math.PI + rc.phi) + a + vi * 0.08 + fl;
      ctx.globalAlpha = alfa;
      poner(ctx, M, rel, rm.c, rm.w, rm.h, rm.px, rm.py, bx, by, phiW, esc, s * esc);
      var co = Math.cos(phiW), si = Math.sin(phiW);
      for (var j = 0; j < rc.hojas.length; j++) {
        var hj = rc.hojas[j], hp = hojas[hj.v % hojas.length], q = rm.punta;
        var lx = (q[0] - rm.px) * esc, ly = (q[1] - rm.py) * esc * s, hx = bx + co * lx - si * ly, hy = by + si * lx + co * ly;
        var th0 = s > 0 ? hj.theta + a : Math.PI - hj.theta + a, sw = clamp(Math.abs(vi) * 0.5, 0, 0.72);
        var th = anguloHacia(th0, vi >= 0 ? 0.22 : Math.PI - 0.22, sw);
        th += (Math.sin(t * 0.0031 + hj.fase) * 0.6 + Math.sin(t * 0.0077 + hj.fase * 1.7) * 0.4) * (0.03 + 0.07 * Math.abs(vi));
        var eh = hj.esc * ka;
        poner(ctx, M, rel, hp.c, hp.w, hp.h, hp.px, hp.py, hx, hy, th, eh, (s > 0 ? 1 : -1) * eh * (1 - 0.3 * sw));
      }
    }
    function tramo(M, i) {
      var k0 = nodos[i], k1 = nodos[i + 1], X0 = px(k0), Y0 = py(k0), X1 = px(k1), Y1 = py(k1);
      if (Math.max(Y0, Y1) < -2 || Math.min(Y0, Y1) > Hc + 2) return;
      var dx = X1 - X0, dy = Y1 - Y0, l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l, T0 = D.tramos[i];
      var p = T0.corto ? pz.cortosN[T0.v % pz.cortosN.length] : pz.largosN[T0.v % pz.largosN.length];
      var sy = (l - hueco) / (p.y0 - p.y1), sx = anchoEn((k0 + k1) / 2) / p.ancho * lado;
      poner(ctx, M, rel, p.c, p.w, p.h, p.ax, p.y0, X0 + ux * hueco / 2, Y0 + uy * hueco / 2, Math.atan2(dy, dx) + Math.PI / 2, sx, sy);
    }
    // una parte de la caña (entre k0 y k1), bajo la matriz M (ya compuesta con la del contexto); el tramo cortado, recortado
    // por el plano del tajo
    function parte(M, k0, k1, recorte) {
      var i, n = nodos.length, rc;
      for (i = 0; i < D.racimos.length; i++) { rc = D.racimos[i]; if (rc.detras && rc.k >= k0 && rc.k < k1) racimo(M, rc, tono * 0.5); }
      ctx.globalAlpha = tono;
      for (i = n - 2; i >= 0; i--) {   // de arriba abajo: el nudo de cada tramo queda encima del siguiente
        if (nodos[i + 1] <= k0 || nodos[i] >= k1) continue;
        if (recorte && nodos[i] < recorte.k && nodos[i + 1] > recorte.k) { ctx.save(); recorte.clip(); tramo(M, i); ctx.restore(); ctx.globalAlpha = tono; }
        else tramo(M, i);
      }
      for (i = 0; i < D.racimos.length; i++) { rc = D.racimos[i]; if (!rc.detras && rc.k >= k0 && rc.k < k1) racimo(M, rc, tono); }
    }
    ctx.save();
    if (!corte) parte(abs(M0), -1, 2, null);
    else {
      var kc = corte.k, qx = px(kc), qy = py(kc), ac = aK(kc), dvx = 1, dvy = -0.4 * (corte.dx || 1), dl = Math.hypot(dvx, dvy); dvx /= dl; dvy /= dl;
      var R = alto, nx = -dvy, ny = dvx;   // la normal hacia la raíz (abajo)
      var semi = anchoEn(kc) / 2 / Math.max(0.3, Math.abs(dvx * Math.cos(ac) + dvy * Math.sin(ac)));
      // el medio plano a un lado del tajo (sg 1: el de la raíz), con la matriz relativa F de la parte; los puntos se pasan
      // por F aquí y el camino se traza con la transformación del contexto
      var plano = function (F, sg) {
        return { k: kc, clip: function () {
          if (B) ctx.setTransform(B[0], B[1], B[2], B[3], B[4], B[5]);
          var P = [[qx - dvx * R, qy - dvy * R], [qx + dvx * R, qy + dvy * R], [qx + dvx * R + nx * R * sg, qy + dvy * R + ny * R * sg], [qx - dvx * R + nx * R * sg, qy - dvy * R + ny * R * sg]];
          ctx.beginPath();
          P.forEach(function (p, i) { var X = F[0] * p[0] + F[2] * p[1] + F[4], Y = F[1] * p[0] + F[3] * p[1] + F[5]; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); });
          ctx.closePath(); ctx.clip();
        } };
      };
      // la cara del corte: una tira de papel (la pared de la caña) con su filo de tinta y, dentro, el hueco oscuro; nada más
      // cortar es sólo un hilo, y se abre a medida que las dos partes se separan
      var abre = clamp((corte.f || 0) * 7, 0, 1);
      var cara = function (F, sg, alfa) {
        ctx.save();
        if (B) { var M = mul(B, F); ctx.setTransform(M[0], M[1], M[2], M[3], M[4], M[5]); } else ctx.transform(F[0], F[1], F[2], F[3], F[4], F[5]);
        var th = Math.atan2(dvy, dvx), aw = anchoEn(kc), gr = aw * (0.025 + 0.06 * abre);
        ctx.globalAlpha = alfa; ctx.fillStyle = T.rgba((SA.color && SA.color.papel) || T.color.papel, 1);
        ctx.beginPath(); ctx.ellipse(qx, qy, semi, gr, th, 0, TAU); ctx.fill();
        if (abre > 0.3) { ctx.fillStyle = T.rgba(TINTA, 0.7 * (abre - 0.3) / 0.7); ctx.beginPath(); ctx.ellipse(qx + dvx * semi * 0.04 * sg, qy + dvy * semi * 0.04 * sg, semi * 0.7, gr * 0.55, th, 0, TAU); ctx.fill(); }
        ctx.globalAlpha = alfa * (sg > 0 ? 1 : abre); ctx.strokeStyle = T.rgba(TINTA, 0.85); ctx.lineWidth = Math.max(0.8, aw * 0.07);
        ctx.beginPath(); ctx.ellipse(qx, qy, semi, gr, th, sg > 0 ? 0 : Math.PI, sg > 0 ? Math.PI : TAU); ctx.stroke();
        ctx.restore();
      };
      parte(abs(M0), -1, kc, plano(M0, 1));
      cara(M0, 1, tono);
      var f = corte.f || 0, F = [1, 0, 0, 1, qx, qy];
      F = mul(F, [1, 0, 0, 1, (corte.dx || 1) * f * u * 0.25, f * f * H * 0.9]);
      var g = f * (corte.giro || 0); F = mul(F, [Math.cos(g), Math.sin(g), -Math.sin(g), Math.cos(g), 0, 0]); F = mul(F, [1, 0, 0, 1, -qx, -qy]);
      var fade = 1 - clamp((f - 0.75) / 0.25, 0, 1);
      if (fade > 0) {
        tono *= fade;
        parte(abs(F), kc, 2, plano(F, -1));
        cara(F, -1, tono);
      }
    }
    ctx.restore();
  };

  /* ------------------------------------------------------------------ el bosquecillo del fondo
     Cañas grises, más finas, en dos términos que se pierden en la niebla: el de más atrás, muy desenfocado; el de en medio,
     algo blando. La niebla sube del suelo, cruza en una franja y se come la tinta a jirones; los lados se funden con el papel.
     w, h en px css; op: dpr, semilla, n (cañas), suelo (fracción de h donde nacen), alto (px; 1,02·h), tono, viento,
     piezas (las de las cañas vivas, si ya están: así no se pintan dos veces). Devuelve { c, w, h, d } (w, h en css). */
  A.bambuFondo = function (w, h, op) { var g = A.bambuFondoPasos(w, h, op), p = g.next(); while (!p.done) p = g.next(); return p.value; };
  A.bambuFondoPasos = function* (w, h, op) {
    op = op || {};
    var d = op.dpr || 1, L = T.lienzo(w * d, h * d), r = T.azar(op.semilla || 71), n = op.n || 18;
    var suelo = (op.suelo == null ? 0.86 : op.suelo) * h, alto = op.alto || h * 1.02, pz = op.piezas || A.bambuPiezas(alto, { dpr: d });
    var tonos = [op.tono == null ? 0.22 : op.tono * 0.6, op.tono == null ? 0.38 : op.tono], nub = T.textura('nubes', 512, 3, 4, 1.4, 21, false);
    for (var capa = 0; capa < 2; capa++) {
      var C = T.lienzo(w * d, h * d), m = capa ? Math.round(n * 0.45) : n - Math.round(n * 0.45), x = C.x;
      x.setTransform(d, 0, 0, d, 0, 0);
      for (var i = 0; i < m; i++) {
        var xx = w * (i + 0.15 + r() * 0.7) / m, an = alto * (capa ? 0.0105 : 0.0075) * (0.75 + r() * 0.5);
        A.dibujarBambu(x, xx, suelo - h * (capa ? 0.012 : 0.03), alto, an, (r() - 0.5) * 0.03, (r() - 0.5) * 0.07, pz, { semilla: 300 + capa * 50 + i, tono: 0.75 + r() * 0.25, viento: op.viento == null ? 0.15 : op.viento, t: i * 700, lejos: true, H: h });
        if (i % 3 === 2) yield 'bambu';
      }
      x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'destination-out';
      // la niebla del suelo, que sube
      var g = x.createLinearGradient(0, suelo * d, 0, (suelo - h * (capa ? 0.42 : 0.58)) * d);
      g.addColorStop(0, 'rgba(0,0,0,0.97)'); g.addColorStop(0.45, 'rgba(0,0,0,0.62)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, C.w, C.h);
      // una franja de niebla que cruza el bosque
      var yb = h * (capa ? 0.36 : 0.5) * d, ab = h * 0.12 * d, g2 = x.createLinearGradient(0, yb - ab, 0, yb + ab);
      g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(0.5, 'rgba(0,0,0,' + (capa ? 0.35 : 0.5) + ')'); g2.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g2; x.fillRect(0, 0, C.w, C.h);
      // jirones: la textura de nubes se come la tinta a manchas
      x.globalAlpha = capa ? 0.45 : 0.4; x.fillStyle = x.createPattern(nub.c, 'repeat');
      x.save(); x.translate(-r() * 512, 0); x.fillRect(0, 0, C.w + 512, C.h); x.restore();
      // los lados se funden con el papel
      x.globalAlpha = 1;
      var gl = x.createLinearGradient(0, 0, C.w, 0);
      gl.addColorStop(0, 'rgba(0,0,0,1)'); gl.addColorStop(0.1, 'rgba(0,0,0,0)'); gl.addColorStop(0.9, 'rgba(0,0,0,0)'); gl.addColorStop(1, 'rgba(0,0,0,1)');
      x.fillStyle = gl; x.fillRect(0, 0, C.w, C.h);
      x.globalCompositeOperation = 'source-over';
      var S = T.desenfocar(C, (capa ? 1.4 : 2.6) * d);
      L.x.globalAlpha = tonos[capa]; L.x.drawImage(S.c, 0, 0);
      if (capa) { L.x.globalAlpha = tonos[capa] * 0.45; L.x.drawImage(C.c, 0, 0); }   // algo de nitidez en el término de en medio
      yield 'bambu';
    }
    L.x.globalAlpha = 1;
    return { c: L.c, w: w, h: h, d: d };
  };
})();
