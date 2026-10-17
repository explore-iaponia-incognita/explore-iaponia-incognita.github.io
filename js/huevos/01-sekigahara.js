/* 01 · Sekigahara — clic en la llanura entre montañas.
   Se levantan los estandartes de los dos ejércitos, chocan, un grupo de la colina cambia de bando y el oeste cae. */
(function () {
  'use strict';
  var SA = window.SA, U = SA.util, C = SA.color, FX = SA.fx, PA = SA.paisaje, TAU = Math.PI * 2;

  SA.registrar({
    id: 'sekigahara', n: 1, nombre: 'Sekigahara', kanji: '関ヶ原', tipo: 'Lugar',
    pista: 'En una llanura entre montañas, un día de otoño de 1600, el país cambió de manos.',
    lugar: function () { return PA.posicion('sekigahara'); }, radioKi: 0.35,
    detectar: function (api) {
      var E = api.motor;
      api.en('clic', function (d) {
        var q = PA.posicion('sekigahara');
        if (Math.abs(d.x - q[0]) < E.u * 0.2 && d.y > E.H * 0.7 && d.y < E.H * 0.83) api.disparar();
      });
    },
    escena: function (E) {
      var L = E.lectura, r = U.azar(1600), este = [], oeste = [], colina = [];
      // dos ejércitos en tres filas (las de atrás, más altas en el papel, más pequeñas y más claras), sin cuadrícula: cada
      // estandarte con su sitio, su alto y su inclinación; en la fila de delante, el ashigaru que lo lleva
      function ejercito(x0, n, extra) {
        var lista = [];
        for (var i = 0; i < n; i++) {
          var fila = i % 3, col = Math.floor(i / 3), b = { dx: x0 + (col + (fila === 1 ? 0.5 : fila === 2 ? 0.25 : 0)) * 0.05 + (r() - 0.5) * 0.028, fila: fila, alto: 0.85 + r() * 0.3, inc: (r() - 0.5) * 0.08, t0: 1200 + fila * 260 + r() * 1200, f: r() * TAU };
          if (extra) extra(b);
          lista.push(b);
        }
        return lista.sort(function (a, c) { return a.fila - c.fila; });
      }
      este = ejercito(-0.52, 27);
      oeste = ejercito(0.08, 27, function (b) { b.cae = 8200 + r() * 1400; b.lado = r() < 0.5 ? -1 : 1; });
      for (var k = 0; k < 8; k++) colina.push({ dx: 0.32 + (k % 4) * 0.035, fila: Math.floor(k / 4), t0: 1700 + r() * 900, f: r() * TAU, cambia: 6400 + k * 160 });
      var golpes = []; for (var g = 0; g < 14; g++) golpes.push({ dx: -0.06 + r() * 0.16, dy: r() * 0.05, t0: 3600 + r() * 2400, ang: r() * TAU, l: 0.03 + r() * 0.05 });
      var ESC = [0.7, 0.86, 1.05], ALFA = [0.62, 0.82, 1], DY = [-0.022, -0.004, 0.016];
      function pos(b, base) { var q = PA.posicion('sekigahara'); return [q[0] + b.dx * E.u, E.H * base + (b.fila == null ? 0 : DY[b.fila]) * E.u]; }
      // un estandarte con su ashigaru (solo en la fila de delante), ya en su sitio (0, 0) = el pie del mástil
      function estandarte(ctx, b, alto, col, t, sal, mira) {
        var e = b.fila == null ? 1 : ESC[b.fila], a = (b.fila == null ? 1 : ALFA[b.fila]) * sal;
        ctx.save(); ctx.rotate(b.inc + Math.sin(t * 0.0013 + b.f) * 0.02);
        PA.estandarte(ctx, 0, 0, alto * e * b.alto, col, Math.sin(t * 0.004 + b.f) * 3 * e, a);
        ctx.restore();
        if (b.fila === 2) FX.figura(alto * 0.05, 1, alto * 0.62, { estilo: 'ronin', arma: 'yari', espada: -1.4, largo: 0.95, cache: true, espejo: mira, a: a });
      }
      return {
        duracion: 13000 + L,
        tarjeta: {
          en: 4400, hasta: 12000 + L,
          titulo: 'Sekigahara',
          texto: 'El 21 de octubre de 1600, más de 150.000 samuráis se enfrentaron en esta llanura. A media batalla, Kobayakawa Hideaki se pasó al otro bando y decidió el día. Tokugawa Ieyasu ganó, fue nombrado shōgun en 1603 y su familia gobernó Japón durante más de 250 años de paz.',
          pie: '関ヶ原の戦い · 1600'
        },
        inicio: function () { E.irA(SA.paisaje.L.sekigahara[0] - 0.3, 1600); },   // la llanura a la derecha: la tarjeta va a la izquierda
        cuadro: function (t) { PA.estado.estandartes = U.tramo(t, 300, 1200) * (1 - U.tramo(t, 11500 + L, 12800 + L)); },
        frente: function (ctx, t) {
          var sal = 1 - U.tramo(t, 11500 + L, 12900 + L), alto = E.u * 0.075;
          // el este (tinta) y el oeste (bermellón)
          este.forEach(function (b) {
            var sube = U.sale(U.tramo(t, b.t0, b.t0 + 700)); if (sube <= 0) return;
            var p = pos(b, 0.775); ctx.save(); ctx.translate(p[0], p[1]); estandarte(ctx, b, alto * sube, C.tinta, t, sal, false); ctx.restore();
          });
          oeste.forEach(function (b) {
            var sube = U.sale(U.tramo(t, b.t0, b.t0 + 700)); if (sube <= 0) return;
            var p = pos(b, 0.775), c = U.tramo(t, b.cae, b.cae + 900);
            ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(c * 1.35 * b.lado);
            estandarte(ctx, b, alto * sube, C.bermellon, t, sal * (1 - c * 0.85), true);
            ctx.restore();
          });
          // la colina de Kobayakawa: empiezan con el oeste y se pasan al este
          colina.forEach(function (b) {
            var sube = U.sale(U.tramo(t, b.t0, b.t0 + 700)); if (sube <= 0) return;
            var p = pos(b, 0.745), c = U.tramo(t, b.cambia, b.cambia + 500);
            PA.estandarte(ctx, p[0], p[1], alto * 0.85 * sube, U.mezcla(C.bermellon, C.tinta, c), Math.sin(t * 0.004 + b.f) * 3, sal);
          });
          var et = U.meseta(t, 6200, 6800, 9200, 10000) * sal;
          if (et > 0) { var pc = pos(colina[1], 0.745); FX.texto('小早川 · KOBAYAKAWA CAMBIA DE BANDO', U.clamp(pc[0], E.W * 0.2, E.W - 210), pc[1] - alto - 16, { tam: 12, a: et, color: C.bermellon, espaciado: 1.4, alin: 'center' }); }
          // el choque: salpicaduras de tinta en el centro
          golpes.forEach(function (gp) {
            var f = U.tramo(t, gp.t0, gp.t0 + 260), q = PA.posicion('sekigahara'); if (f <= 0) return;
            var x = q[0] + gp.dx * E.u, y = E.H * (0.765 - gp.dy), l = gp.l * E.u * f;
            FX.trazo([[x, y], [x + Math.cos(gp.ang) * l * 0.5, y + Math.sin(gp.ang) * l * 0.5], [x + Math.cos(gp.ang) * l, y + Math.sin(gp.ang) * l]], E.u * 0.008, 0.75 * sal * (1 - U.tramo(t, 9000, 11000)));
          });
        },
        fin: function () { PA.estado.estandartes = 0; }
      };
    }
  });
})();
