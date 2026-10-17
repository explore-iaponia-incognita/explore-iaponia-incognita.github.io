/* 10 · El último samurái — al llegar al final del rollo, seguir empujando hacia la derecha.
   Atardece sobre la colina de Shiroyama: un sol enorme se pone tras el samurái, que deja su espada en el suelo. */
(function () {
  'use strict';
  var SA = window.SA, U = SA.util, C = SA.color, FX = SA.fx, PA = SA.paisaje;
  var EMPUJE = 1100;

  SA.registrar({
    id: 'ultimo-samurai', n: 10, nombre: 'El último samurái', kanji: '最後の侍', tipo: 'Distancia',
    pista: 'Al final del rollo alguien espera. Sigue avanzando cuando ya no se pueda.',
    detectar: function (api) {
      api.en('empujar', function (d) { if (d.total > EMPUJE) { api.motor.empuje = 0; api.disparar(); } });
    },
    escena: function (E) {
      var L = E.lectura;
      function cima() { return [E.sx(PA.L.samurai[0], PA.P.shiroyama), E.H * 0.6]; }
      return {
        duracion: 14500 + L,
        heroeEncima: true,   // el rōnin, arrodillado al pie de la colina, por delante de ella
        tarjeta: {
          en: 5600, hasta: 13200 + L,
          titulo: 'El último samurái',
          texto: 'En 1876 un decreto prohibió llevar espada por la calle, y los samuráis dejaron de cobrar su paga. Un año después, Saigō Takamori se levantó con los samuráis de Satsuma. El 24 de septiembre de 1877 cayó en la colina de Shiroyama, y se le suele llamar el último samurái.',
          pie: '西郷隆盛 · 城山 · 1877'
        },
        inicio: function () { E.irA(E.largo, 1200); if (PA.heroeAccion) PA.heroeAccion('reverencia', { dur: 13500 }); },
        cuadro: function (t) { PA.estado.sol = 1 - U.meseta(t, 0, 900, 13000 + L, 14400 + L); },   // el sol de siempre se aparta: este es otro
        fondo: function (ctx, t) {
          // el sol grande que se pone detrás de la colina
          var q = cima(), a = U.meseta(t, 600, 2400, 13000 + L, 14400 + L); if (a <= 0) return;
          var r = E.u * 0.26, y = q[1] - r * 0.35 + U.entra(U.tramo(t, 6000, 12500 + L)) * r * 1.5;
          FX.brillo(q[0], y, r * 2.4, C.bermellon, 0.18 * a);
          ctx.fillStyle = U.rgba(C.bermellon, 0.82 * a); ctx.beginPath(); ctx.arc(q[0], y, r, 0, Math.PI * 2); ctx.fill();
        },
        frente: function (ctx, t) {
          var q = cima(), a = U.meseta(t, 1200, 2600, 13000 + L, 14400 + L); if (a <= 0) return;
          // (la colina ya tapa el sol en su sitio: el paisaje la pinta opaca, por delante de lo lejano y detrás del camino)
          // el samurái, grande contra el sol; deja la espada en el suelo
          var deja = U.inOut(U.tramo(t, 6500, 8200)), alto = E.u * 0.2;
          FX.figura(q[0], q[1] + 1, alto, { estilo: 'ultimo', espada: U.lerp(-0.25, 1.3, deja), largo: 0.6, a: a, rot: -0.06 * deja });
          if (deja >= 1) { ctx.strokeStyle = U.rgba(C.tinta, a); ctx.lineWidth = alto * 0.018; ctx.beginPath(); ctx.moveTo(q[0] + alto * 0.12, q[1] - 1); ctx.lineTo(q[0] + alto * 0.62, q[1] - 2); ctx.stroke(); }
        },
        fin: function () { E.empuje = 0; PA.estado.sol = 1; }
      };
    }
  });
})();
