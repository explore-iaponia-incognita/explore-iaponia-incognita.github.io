/* 05 · Tameshigiri — un tajo rápido y recto que atraviese una caña del bosque de bambú.
   Destella el filo, la caña se parte por el corte, la parte de arriba resbala y cae girando. */
(function () {
  'use strict';
  var SA = window.SA, U = SA.util, C = SA.color, FX = SA.fx, PA = SA.paisaje, TAU = Math.PI * 2;

  SA.registrar({
    id: 'tameshigiri', n: 5, nombre: 'Tameshigiri', kanji: '試し斬り', tipo: 'Gesto',
    pista: 'Así se probaba una espada: un corte limpio, rápido y recto, a través de una caña.',
    detectar: function (api) {
      var E = api.motor;
      api.en('trazo', function (d) {
        var tj = SA.gestos.tajo(d.pts, d.dur); if (!tj || !tj.ok) return;
        // ¿atraviesa alguna caña? (son casi verticales: basta con mirar su x a la altura del tajo)
        var mejor = null;
        PA.bambu.forEach(function (b, i) {
          var x = E.sx(b.xu); if ((tj.a.x - x) * (tj.b.x - x) > 0) return;
          var k = (x - tj.a.x) / ((tj.b.x - tj.a.x) || 1), y = tj.a.y + (tj.b.y - tj.a.y) * k, y0 = PA.suelo(b.xu);
          if (y < E.H * 0.08 || y > y0 - E.u * 0.04) return;
          if (!mejor || Math.abs(k - 0.5) < Math.abs(mejor.k - 0.5)) mejor = { i: i, y: y, k: k, dx: tj.b.x > tj.a.x ? 1 : -1, a: tj.a, b: tj.b };
        });
        if (mejor) api.disparar(mejor);
      });
    },
    escena: function (E, datos) {
      var L = E.lectura, d = datos;
      if (!d) {   // repetición desde el libro: una caña del centro del bosque
        var i0 = Math.floor(PA.bambu.length / 2), b0 = PA.bambu[i0] || { xu: 2.7 };
        E.camX = Math.max(0, Math.min(E.maxCam(), b0.xu * E.u - E.W / 2));
        var x0 = E.sx(b0.xu), y0 = E.H * 0.45;
        d = { i: i0, y: y0, dx: 1, a: { x: x0 - E.u * 0.18, y: y0 + E.u * 0.05 }, b: { x: x0 + E.u * 0.18, y: y0 - E.u * 0.05 } };
      }
      var b = PA.bambu[d.i], y0 = PA.suelo(b.xu), alto = E.H * 1.02, k = U.clamp((y0 - d.y) / alto, 0.1, 0.9);
      var hojas = [], r = U.azar(55); for (var j = 0; j < 14; j++) hojas.push({ x: r(), v: 0.3 + r() * 0.7, g: r() * TAU });
      return {
        duracion: 10500 + L,
        tarjeta: {
          en: 2800, hasta: 9800 + L,
          titulo: 'Tameshigiri',
          texto: 'Así se probaban las katanas: cortando cañas de bambú o haces de paja enrollada. La hoja se forjaba con tamahagane, un acero que se obtenía fundiendo arena de hierro; se plegaba una y otra vez y se templaba cubierta de arcilla, para que el filo quedara duro y el lomo, flexible.',
          pie: '刀 · katana'
        },
        inicio: function () { PA.estado.corte = { i: d.i, k: k, dx: d.dx, f: 0, giro: d.dx * (1.2 + Math.random() * 0.6) }; if (PA.heroeAccion) PA.heroeAccion('iai', { hacia: E.sx(b.xu) }); },
        cuadro: function (t) { if (PA.estado.corte) PA.estado.corte.f = U.entra(U.tramo(t, 250, 1900)); if (t > 9600 + L) PA.estado.corte = null; },
        frente: function (ctx, t) {
          // el destello del filo, a lo largo del tajo
          var f = U.meseta(t, 0, 60, 220, 650);
          if (f > 0) {
            var ax = d.a.x - (d.b.x - d.a.x) * 0.2, ay = d.a.y - (d.b.y - d.a.y) * 0.2, bx = d.b.x + (d.b.x - d.a.x) * 0.2, by = d.b.y + (d.b.y - d.a.y) * 0.2;
            // un tajo de papel (el brillo de la hoja) con el filo de tinta debajo, afilado en los extremos
            FX.trazo([[ax, ay + 3], [(ax + bx) / 2, (ay + by) / 2 + 3], [bx, by + 3]], E.u * 0.012, 0.55 * f);
            FX.trazo([[ax, ay], [(ax + bx) / 2, (ay + by) / 2], [bx, by]], E.u * 0.016, f, C.papel);
          }
          // hojas que caen tras el golpe
          var h = U.tramo(t, 300, 4800);
          if (h > 0 && h < 1) {
            ctx.fillStyle = U.rgba(C.tinta, 0.7 * (1 - h));
            hojas.forEach(function (q) {
              var x = E.sx(b.xu) + (q.x - 0.5) * E.u * 0.4 + Math.sin(t * 0.004 + q.g) * 12, y = d.y - E.u * 0.1 + h * E.H * 0.5 * q.v;
              ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 0.005 + q.g) * 0.9); ctx.beginPath(); ctx.ellipse(0, 0, E.u * 0.018, E.u * 0.004, 0, 0, TAU); ctx.fill(); ctx.restore();
            });
          }
          // el kanji del corte, escrito de arriba abajo junto a la caña
          FX.vertical('斬', E.sx(b.xu) + E.u * 0.1 * d.dx, E.H * 0.18, E.u * 0.11, { a: 0.85 * (1 - U.tramo(t, 9000 + L, 10300 + L)), aparicion: U.tramo(t, 900, 1500) });
        },
        fin: function () { PA.estado.corte = null; }
      };
    }
  });
})();
