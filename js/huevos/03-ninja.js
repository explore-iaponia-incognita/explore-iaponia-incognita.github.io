/* 03 · El ninja — en el pino del acantilado, de vez en cuando, se abren dos ojos. Clic en ellos.
   El ninja salta del árbol hacia ti, aterriza, lanza tres shuriken que se clavan en el papel y desaparece en humo de tinta. */
(function () {
  'use strict';
  var SA = window.SA, U = SA.util, C = SA.color, FX = SA.fx, PA = SA.paisaje, TAU = Math.PI * 2;
  var CICLO = 6500, ABIERTOS = 320;

  SA.registrar({
    id: 'ninja', n: 3, nombre: 'El ninja', kanji: '忍者', tipo: 'Mirada',
    pista: 'Alguien te observa desde un pino. Solo parpadea de vez en cuando.',
    lugar: function () { return PA.posicion('ninja'); }, radioKi: 0.22,
    detectar: function (api) {
      var E = api.motor;
      api.en('clic', function (d) { var q = PA.posicion('ninja'); if (Math.hypot(d.x - q[0], d.y - q[1]) < Math.max(18, E.u * 0.03)) api.disparar(); });
      // los ojos: se abren un momento cada pocos segundos (y siguen abiertos si el pincel anda cerca)
      api.capa(function (ctx, t) {
        var q = PA.posicion('ninja'); if (q[0] < -40 || q[0] > E.W + 40) return;
        var f = t % CICLO, abierto = f < ABIERTOS, p = E.puntero, cerca = p.sobre && Math.hypot(p.x - q[0], p.y - q[1]) < E.u * 0.06;
        if (!abierto && !cerca) return;
        var s = E.u * 0.006;
        ctx.fillStyle = U.rgba(C.papel, 0.95); ctx.beginPath();
        ctx.ellipse(q[0] - s * 1.6, q[1], s, s * 0.45, 0.1, 0, TAU); ctx.ellipse(q[0] + s * 1.6, q[1], s, s * 0.45, -0.1, 0, TAU); ctx.fill();
        ctx.fillStyle = U.rgba(C.tinta, 1); ctx.beginPath(); ctx.arc(q[0] - s * 1.5, q[1], s * 0.35, 0, TAU); ctx.arc(q[0] + s * 1.7, q[1], s * 0.35, 0, TAU); ctx.fill();
      });
    },
    escena: function (E) {
      var L = E.lectura, inicio = null, destino = null, r = U.azar(33), humo = [], estrellas = [];
      for (var i = 0; i < 18; i++) humo.push({ a: r() * TAU, d: 0.3 + r() * 0.8, s: 0.4 + r() * 0.8 });
      for (var k = 0; k < 3; k++) estrellas.push({ t0: 3900 + k * 260, x: 0.52 + k * 0.13 + r() * 0.04, y: 0.3 + r() * 0.25, giro: 8 + r() * 4 });
      return {
        duracion: 11500 + L,
        tarjeta: {
          en: 5200, hasta: 11000 + L,
          titulo: 'El ninja',
          texto: 'Los shinobi existieron: los de Iga y Kōka eran famosos como espías y saboteadores. Pero el traje negro seguramente viene del teatro kabuki, donde los tramoyistas vestían de negro para que el público hiciera como que no estaban. Un ninja que aparecía así, de la nada, sorprendía el doble.',
          pie: '伊賀 · 甲賀 · Iga y Kōka'
        },
        inicio: function () { inicio = PA.posicion('ninja'); destino = [E.W * 0.42, PA.suelo(E.xuDe(E.W * 0.42)) + 2]; },   // cae en el camino, delante del rōnin
        cuadro: function (t) { if (t > 1900 && !this.desenvaino && PA.heroeAccion) { this.desenvaino = true; PA.heroeAccion('iai', { hacia: destino[0] }); } },
        frente: function (ctx, t) {
          var q = PA.posicion('ninja'); inicio = q;
          var salto = U.tramo(t, 500, 2100), sal = 1 - U.tramo(t, 10400 + L, 11300 + L);
          // el salto: una parábola desde el pino hasta el primer plano, creciendo según se acerca
          if (salto > 0 && t < 6200) {
            var e = U.inOut(salto), x = U.lerp(inicio[0], destino[0], e), y = U.lerp(inicio[1], destino[1], e) - Math.sin(e * Math.PI) * E.H * 0.3;
            var alto = U.lerp(E.u * 0.05, E.u * 0.2, e * e), agacha = U.meseta(t, 2000, 2200, 3300, 3700);
            var lanza = U.tramo(t, 3700, 4400);
            FX.figura(x, y, alto * (1 - 0.18 * agacha), { ninja: true, espada: lanza > 0 ? U.lerp(-2.6, -0.2, U.sale(lanza)) : (salto < 1 ? -2.2 + e * 0.6 : -1.5), largo: 0.5, rot: salto < 1 ? Math.sin(e * Math.PI) * 0.5 : 0, a: 1 - U.tramo(t, 5200, 5800) });
          }
          // los shuriken: vuelan girando y se clavan en el papel
          estrellas.forEach(function (s) {
            var f = U.tramo(t, s.t0, s.t0 + 380); if (f <= 0) return;
            var x0 = destino[0] + E.u * 0.06, y0 = destino[1] - E.u * 0.25, x1 = E.W * s.x, y1 = E.H * s.y;
            var x = U.lerp(x0, x1, f), y = U.lerp(y0, y1, f) - Math.sin(f * Math.PI) * E.u * 0.05;
            if (f >= 1) { FX.brillo(x1, y1, E.u * 0.035, C.tinta, 0.18 * sal); }
            FX.shuriken(x, y, E.u * 0.022, f < 1 ? t * 0.03 : s.giro, sal);
          });
          // humo de tinta: el ninja desaparece
          var h = U.tramo(t, 5000, 7200);
          if (h > 0 && h < 1) humo.forEach(function (m) {
            var rr = E.u * 0.05 * m.s * (0.4 + h * 1.6), x = destino[0] + Math.cos(m.a) * m.d * E.u * 0.12 * h, y = destino[1] - E.u * 0.15 + Math.sin(m.a) * m.d * E.u * 0.1 * h;
            FX.brillo(x, y, rr, C.tinta, 0.35 * (1 - h));
          });
        }
      };
    }
  });
})();
