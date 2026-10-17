/* 09 · Sakura — no tocar nada durante 40 segundos (con el libro cerrado).
   El cerezo florece de golpe, una ráfaga se lleva los pétalos y aparece el refrán «花は桜木 人は武士». */
(function () {
  'use strict';
  var SA = window.SA, U = SA.util, C = SA.color, FX = SA.fx, PA = SA.paisaje;
  var ESPERA = 40000;

  SA.registrar({
    id: 'sakura', n: 9, nombre: 'Sakura', kanji: '桜', tipo: 'Espera',
    pista: 'Hay una flor que solo se abre si dejas el rollo en paz un buen rato.',
    detectar: function (api) {
      api.en('cuadro', function (d) {
        if (d.inactivo > ESPERA && !document.hidden && !document.documentElement.classList.contains('cuaderno-abierto')) { api.motor.ultimoInput = api.motor.t; api.disparar(); }
      });
    },
    escena: function (E) {
      var L = E.lectura;
      return {
        duracion: 14500 + L,
        tarjeta: {
          en: 5600, hasta: 13200 + L,
          titulo: 'Sakura',
          texto: '«Entre las flores, el cerezo; entre los hombres, el guerrero». El refrán sale de una obra de teatro de 1748 sobre los 47 rōnin. El cerezo florece de golpe y sus pétalos caen en plena belleza, sin marchitarse: por eso era la flor de los samuráis.',
          pie: '花は桜木人は武士 · Kanadehon Chūshingura · 1748'
        },
        inicio: function () { E.irA(PA.L.cerezo + 0.25, 2200); },
        cuadro: function (t) {
          PA.estado.florecer = U.sale(U.tramo(t, 1800, 5200)) * (1 - U.tramo(t, 13000 + L, 14400 + L));
          var rafaga = U.meseta(t, 6600, 7200, 9000, 11000); E.viento = Math.max(E.viento, rafaga * 0.85);
        },
        frente: function (ctx, t) {
          var a = U.meseta(t, 3600, 4600, 12800 + L, 14300 + L); if (a <= 0) return;
          var x = E.W * 0.9, tam = E.u * 0.085;
          FX.vertical('花は桜木', x, E.H * 0.1, tam, { a: 0.9 * a, aparicion: U.tramo(t, 3600, 5600) });
          FX.vertical('人は武士', x - tam * 1.35, E.H * 0.1 + tam * 0.6, tam, { a: 0.9 * a, aparicion: U.tramo(t, 5000, 7000) });
        },
        fin: function () { PA.estado.florecer = 0; }
      };
    }
  });
})();
