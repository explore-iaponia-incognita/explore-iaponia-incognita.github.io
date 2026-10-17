/* 06 · Kamikaze — agitar el pincel de lado a lado sobre el mar (pasando por encima o pintando), como un vendaval.
   Se levanta el tifón: rachas de viento a pinceladas, olas enormes y la flota mongola que se hunde. */
(function () {
  'use strict';
  var SA = window.SA, U = SA.util, C = SA.color, FX = SA.fx, PA = SA.paisaje, TAU = Math.PI * 2;

  SA.registrar({
    id: 'kamikaze', n: 6, nombre: 'Kamikaze', kanji: '神風', tipo: 'Gesto',
    pista: 'Sopla sobre el mar, de un lado a otro, hasta que se levante el viento que salvó a Japón.',
    detectar: function (api) {
      var E = api.motor, pasos = [];
      // pasando por encima del mar: cuenta los cambios de sentido de los últimos 1,6 s
      api.en('mover', function (d) {
        if (!PA.esMar(d.x, d.y)) { pasos.length = 0; return; }
        pasos.push({ x: d.x, t: E.t }); while (pasos.length && pasos[0].t < E.t - 1600) pasos.shift();
        if (SA.gestos.vaivenes(pasos, E.u * 0.04) >= 6) { pasos.length = 0; api.disparar(); }
      });
      // o pintando en zigzag sobre el mar
      api.en('trazo', function (d) {
        var sobreMar = d.pts.filter(function (p) { return PA.esMar(p.x, p.y); }).length > d.pts.length * 0.6;
        if (sobreMar && SA.gestos.vaivenes(d.pts, E.u * 0.04) >= 6) api.disparar();
      });
    },
    escena: function (E) {
      var L = E.lectura, r = U.azar(1281), rafagas = [], T = SA.tinta, A = SA.arte;
      for (var i = 0; i < 18; i++) rafagas.push({ y: 0.1 + r() * 0.4, x: -0.1 + r() * 0.9, t0: 1400 + r() * 7600, l: 0.18 + r() * 0.22, s: 0.022 + r() * 0.02, v: 0.05 + r() * 0.06, a: 0.25 + r() * 0.2 });
      // los nubarrones (pintados una vez, a poca resolución: son difusos), y por dónde baja el rayo
      // los nubarrones: el taller los deja pintados de antemano (PA.pieza); si no, uno por fotograma (juntos serían un parón)
      function nubarrones(solo) { return { lejos: PA.pieza('nubarronLejos'), cerca: solo ? null : PA.pieza('nubarronCerca') }; }
      function fuerzaEn(t) { return U.meseta(t, 1000, 3200, 8800 + L * 0.5, 11800 + L); }
      // una ráfaga como en los grabados: una línea larga que ondula y acaba en un remolino
      function rizo(x, y, l, s) {
        var pts = [], k;
        for (k = 0; k <= 10; k++) pts.push([x + l * k / 10, y + Math.sin(k / 10 * Math.PI * 1.5) * s * 0.35]);
        var cx = x + l, cy = pts[10][1] - s;
        for (k = 1; k <= 22; k++) { var p = k / 22, th = Math.PI / 2 - p * Math.PI * 2 * 1.25, R = s * (1 - 0.72 * p); pts.push([cx + Math.cos(th) * R, cy + Math.sin(th) * R]); }
        return pts;
      }
      // el rayo: una línea quebrada (con una rama), blanca y con su halo, que baja de las nubes al mar
      function rayo(x0, y0, y1, sem) {
        var pts = [[x0, y0]], x = x0, k, n = 13;
        for (k = 1; k <= n; k++) { x += (U._h(sem + k * 3.1) - 0.5) * E.u * 0.075; pts.push([x, y0 + (y1 - y0) * k / n]); }
        var b0 = pts[5], rama = [b0.slice()], bx = b0[0];
        for (k = 1; k <= 5; k++) { bx += E.u * (0.025 + U._h(sem + k * 7.7) * 0.03); rama.push([bx, b0[1] + (y1 - y0) * 0.06 * k]); }
        return [pts, rama];
      }
      function pintaRayo(ctx, lineas, a) {
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        [[E.u * 0.03, 0.1], [E.u * 0.014, 0.25], [E.u * 0.005, 0.95]].forEach(function (p, i) {
          ctx.strokeStyle = U.rgba(i === 2 ? [255, 252, 244] : C.papel, p[1] * a); ctx.lineWidth = p[0];
          lineas.forEach(function (ln, j) { ctx.lineWidth = p[0] * (j ? 0.6 : 1); ctx.beginPath(); ln.forEach(function (q, k) { if (k) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.stroke(); });
        });
      }
      var RAYOS = [{ t: 5200, x: 0.66, sem: 3 }, { t: 8900, x: 0.3, sem: 11 }];
      return {
        duracion: 13500 + L,
        tarjeta: {
          en: 4800, hasta: 12000 + L,
          titulo: 'Kamikaze',
          texto: 'En 1274 y en 1281, las flotas del emperador mongol Kublai Kan intentaron invadir Japón. Los samuráis las frenaron en las playas de Kyūshū y, sobre todo la segunda vez, un tifón hundió buena parte de los barcos. Lo llamaron kamikaze, «viento divino».',
          pie: '元寇 · 1274 · 1281'
        },
        inicio: function () { E.irA(PA.L.barcos, 1500); },
        cuadro: function (t) {
          var fuerza = fuerzaEn(t);
          PA.estado.oleaje = fuerza; E.viento = Math.max(E.viento, fuerza * 0.9);
          PA.estado.hundir = U.inOut(U.tramo(t, 3600, 8200)) * (1 - U.tramo(t, 12400 + L, 13400 + L));
          E.noche = 0.2 * U.meseta(t, 1000, 3000, 9000 + L * 0.5, 12000 + L);
          // el sol se apaga ya detrás de las nubes (y vuelve cuando se van)
          PA.estado.sol = 1 - U.tramo(t, 2600, 4200) * (1 - U.tramo(t, 11000 + L, 12600 + L));
        },
        // las nubes del tifón: entran con el viento desde la izquierda, tapan el sol y se van al final
        cielo: function (ctx, t) {
          var nb = nubarrones(t < 380), entra = U.inOut(U.tramo(t, 400, 4200)), sale = U.inOut(U.tramo(t, 10200 + L * 0.5, 13200 + L)), a = U.meseta(t, 300, 1500, 11500 + L, 13300 + L);
          if (a <= 0) return;
          var deriva = t * E.u * 0.000012;
          ctx.save(); ctx.globalAlpha = a;
          var wl = E.W * 1.5, hl = E.H * 0.36, xl = U.lerp(-wl * 1.05, -E.W * 0.22, entra) + deriva + sale * E.W * 1.3;
          ctx.drawImage(nb.lejos.c, xl, E.H * 0.16, wl, hl);
          var wc = E.W * 1.8, hc = E.H * 0.46, xc = U.lerp(-wc * 1.1, -E.W * 0.38, U.inOut(U.tramo(t, 900, 4600))) + deriva * 1.6 + sale * E.W * 1.6;
          if (nb.cerca) ctx.drawImage(nb.cerca.c, xc, -E.H * 0.05, wc, hc);
          // los relámpagos iluminan las nubes por dentro
          RAYOS.forEach(function (ry) {
            var fl = U.tramo(t, ry.t, ry.t + 40) * (1 - U.tramo(t, ry.t + 90, ry.t + 600));
            if (fl > 0) FX.brillo(E.W * ry.x, E.H * 0.2, E.u * 0.55, [255, 250, 238], 0.5 * fl);
          });
          ctx.restore();
          // ráfagas: remolinos de pincel que se pintan, corren con el viento y se borran
          rafagas.forEach(function (q) {
            var f = (t - q.t0) / 1700; if (f < 0 || f > 1) return;
            var x = E.W * (q.x + f * q.v * 4), y = E.H * q.y, l = E.W * q.l, s = E.u * q.s;
            FX.trazo(rizo(x, y, l, s), E.u * 0.007, q.a * U.meseta(f, 0, 0.15, 0.6, 1), C.tinta, U.sale(U.tramo(f, 0, 0.5)));
          });
        },
        frente: function (ctx, t) {
          var fuerza = fuerzaEn(t);
          // la lluvia: una cortina lejana, fina y densa, y gotas cercanas, largas y oscuras, inclinadas por el viento
          if (fuerza > 0.02) {
            ctx.lineCap = 'round';
            [[220, 0.13, 0.0008, 0.02, 2.4], [70, 0.3, 0.0016, 0.05, 1.6]].forEach(function (cp, c) {
              ctx.strokeStyle = U.rgba(C.tinta, cp[1] * fuerza); ctx.lineWidth = Math.max(0.5, E.u * cp[2]); ctx.beginPath();
              var n = Math.round(cp[0] * fuerza);
              for (var g = 0; g < n; g++) {
                var h0 = g * 3.1 + c * 101, vy = cp[4] + U._h(h0) * 1.2, fase = ((t * 0.001 * vy + U._h(h0 + 1)) % 1), lg = E.u * (cp[3] + U._h(h0 + 5) * cp[3]);
                var gx = (U._h(h0 + 7.7) * 1.4 - 0.2) * E.W + fase * E.u * 0.4, gy = fase * E.H * 1.15 - E.H * 0.08;
                ctx.moveTo(gx, gy); ctx.lineTo(gx + lg * 0.5, gy + lg);
              }
              ctx.stroke();
            });
          }
          // el rayo: fogonazo y una línea quebrada, blanca, que baja de las nubes al mar
          RAYOS.forEach(function (ry) {
            var v = U.tramo(t, ry.t, ry.t + 50) * (1 - U.tramo(t, ry.t + 120, ry.t + 520)), eco = U.tramo(t, ry.t + 180, ry.t + 210) * (1 - U.tramo(t, ry.t + 230, ry.t + 330));
            v = Math.max(v, eco * 0.7); if (v <= 0) return;
            ctx.fillStyle = U.rgba([255, 251, 242], 0.32 * v); ctx.fillRect(0, 0, E.W, E.H);
            pintaRayo(ctx, rayo(E.W * ry.x, E.H * 0.22, E.H * 0.705, ry.sem), v);
          });
        },
        fin: function () { PA.estado.oleaje = 0; PA.estado.hundir = 0; E.noche = 0; }
      };
    }
  });
})();
