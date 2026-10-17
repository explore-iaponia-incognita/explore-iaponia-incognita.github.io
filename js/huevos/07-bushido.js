/* 07 · Bushidō — escribir «bushido».
   Se pintan, de derecha a izquierda como se lee en vertical, las siete virtudes con su traducción. */
(function () {
  'use strict';
  var SA = window.SA, U = SA.util, C = SA.color, FX = SA.fx;
  var PALABRA = 'bushido';
  var VIRTUDES = [['義', 'Rectitud'], ['勇', 'Valor'], ['仁', 'Benevolencia'], ['礼', 'Respeto'], ['誠', 'Sinceridad'], ['名誉', 'Honor'], ['忠義', 'Lealtad']];

  SA.registrar({
    id: 'bushido', n: 7, nombre: 'Bushidō', kanji: '武士道', tipo: 'Teclado',
    pista: 'Escribe el nombre del camino del guerrero.',
    detectar: function (api) {
      var buf = '';
      api.en('tecla', function (d) {
        if (!d.key || d.key.length !== 1) return;
        buf = (buf + d.key.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')).slice(-PALABRA.length);
        if (buf === PALABRA) { buf = ''; api.disparar(); }
      });
    },
    escena: function (E) {
      var L = E.lectura;
      return {
        duracion: 14500 + L,
        tarjeta: {
          en: 6600, hasta: 13500 + L,
          titulo: 'Bushidō',
          texto: '«El camino del guerrero». Estas siete virtudes las hizo famosas Nitobe Inazō en 1900, con un libro escrito en inglés para explicar Japón a Occidente, cuando los samuráis ya no existían. Buena parte de ese código ideal es más moderna que los propios samuráis.',
          pie: '新渡戸稲造 · Bushido, el alma de Japón · 1900'
        },
        fondo: function () {},
        frente: function (ctx, t) {
          var a = U.meseta(t, 0, 900, 13000 + L, 14400 + L);
          ctx.fillStyle = U.rgba(C.papel, 0.9 * a); ctx.fillRect(0, 0, E.W, E.H);   // un velo de papel para leer
          var n = VIRTUDES.length, ancho = Math.min(E.W * 0.82, E.u * 1.5), paso = ancho / n, x0 = E.W / 2 + ancho / 2 - paso / 2, tam = Math.min(E.u * 0.11, paso * 0.7);
          VIRTUDES.forEach(function (v, i) {
            var t0 = 900 + i * 650, f = U.tramo(t, t0, t0 + 800); if (f <= 0) return;
            var x = x0 - i * paso, y = E.H * 0.12;
            FX.vertical(v[0], x, y, tam, { a: 0.92 * a, aparicion: f });
            var yb = y + tam * 2.4;
            FX.texto(v[1].toUpperCase(), x, yb, { tam: 10.5, alin: 'center', a: 0.7 * a * U.tramo(t, t0 + 500, t0 + 1100), espaciado: 1.6 });
            if (i === 0) FX.sello('武士道', x + paso * 0.42, E.H * 0.1, E.u * 0.045, a * U.tramo(t, 5600, 6000), -0.05);
          });
        }
      };
    }
  });
})();
