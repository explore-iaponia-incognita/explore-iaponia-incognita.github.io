/* 02 · Ganryūjima — clic en la islita del mar.
   Una viñeta de cerca: Kojirō espera en la orilla con su espada larguísima; llega la barca de Musashi, tarde,
   con una espada de madera tallada de un remo; un solo tajo y Kojirō cae. */
(function () {
  'use strict';
  var SA = window.SA, U = SA.util, C = SA.color, FX = SA.fx, PA = SA.paisaje, TAU = Math.PI * 2;

  SA.registrar({
    id: 'ganryujima', n: 2, nombre: 'Ganryūjima', kanji: '巌流島', tipo: 'Lugar',
    pista: 'En una isla diminuta, alguien llegó tarde a propósito… y ganó.',
    lugar: function () { return PA.enMar(PA.posicion('isla')[0]) > 0 ? PA.posicion('isla') : null; }, radioKi: 0.3,
    detectar: function (api) {
      var E = api.motor;
      api.en('clic', function (d) {
        var q = PA.posicion('isla');
        if (PA.enMar(q[0]) > 0 && Math.abs(d.x - q[0]) < E.u * 0.11 && Math.abs(d.y - q[1]) < E.u * 0.05) api.disparar();
      });
    },
    escena: function (E) {
      // el escenario de la viñeta: el mar a tinta y la isla con sus pinos. Se pinta por pasos durante el primer segundo
      // de la escena (antes de que se vea la viñeta), unos milisegundos en cada fotograma; si hiciera falta antes, de golpe
      var cacheEsc = null, genEsc = null, claveGen = '';
      function medidas() { var w = Math.min(E.W * 0.5, E.u * 0.9); return [w, w * 0.56]; }
      function* escenarioPasos(w, h) {
        var d = E.dpr, T = SA.tinta, A = SA.arte, Lz = T.lienzo(w * d, h * d), k = h * d;
        yield* A.marPasos(Lz, 0, k, 0, { hz: 0.7, orilla: 1.02, a: -1, b: w / h + 1, fundido: 0.1, semilla: 9 });
        // la isla: una loma baja (aguada con el filo oscuro) que llega hasta el borde izquierdo
        T.aguada(Lz.x, Lz.w, Lz.h, function (c) {
          c.beginPath(); c.moveTo(0, 0.74 * k); c.lineTo(0, 0.6 * k);
          c.quadraticCurveTo(0.22 * w * d, 0.555 * k, 0.43 * w * d, 0.705 * k); c.lineTo(0.43 * w * d, 0.74 * k); c.closePath(); c.fill();
        }, { gris: 0.6, degradado: [1, 0.55], y0: 0.55 * k, y1: 0.74 * k, nubes: 0.4, grano: 0.25, borde: 0.9, semilla: 5 });
        yield;
        T.pincelada(Lz.x, [[0, 0.6 * k], [0.12 * w * d, 0.567 * k], [0.26 * w * d, 0.585 * k], [0.42 * w * d, 0.7 * k]], { ancho: 0.012 * k, alfa: 0.85, carga: 0.9, seco: 0.7, entrada: 0.05, salida: 0.4, semilla: 12, cerdas: 9 });
        for (var i = 0; i < 6; i++) A.arbolito(Lz.x, (0.03 + i * 0.05) * w * d, 0.575 * k + Math.abs(i - 2) * 0.004 * k, 0.05 * k * (0.7 + (i % 3) * 0.2), 0.75, T.azar(40 + i));
        return { c: Lz.c, clave: Math.round(w) + 'x' + Math.round(h) };
      }
      function escenario(w, h) {
        var clave = Math.round(w) + 'x' + Math.round(h);
        if (cacheEsc && cacheEsc.clave === clave) return cacheEsc;
        if (!genEsc || claveGen !== clave) { genEsc = escenarioPasos(w, h); claveGen = clave; }
        var p = genEsc.next(); while (!p.done) p = genEsc.next();
        genEsc = null; cacheEsc = p.value;
        return cacheEsc;
      }
      function adelantar(ms) {   // unos pasos del escenario (en el tiempo que sobra de cada fotograma)
        var m = medidas(), clave = Math.round(m[0]) + 'x' + Math.round(m[1]);
        if (cacheEsc && cacheEsc.clave === clave) return;
        if (!genEsc || claveGen !== clave) { genEsc = escenarioPasos(m[0], m[1]); claveGen = clave; }
        var t0 = performance.now();
        while (performance.now() - t0 < ms) { var p = genEsc.next(); SA.tinta.vaciar(); if (p.done) { cacheEsc = p.value; genEsc = null; return; } }
      }
      // una barca de pescador (sampán) de tinta: casco bajo de proa alta, la borda más clara y el reflejo en el agua
      function barca(bx, by, lw, a, inc) {
        var ctx = E.ctx;
        ctx.save(); ctx.translate(bx, by); ctx.rotate(inc || 0);
        ctx.fillStyle = U.rgba(C.tinta, 0.85 * a); ctx.beginPath();
        ctx.moveTo(-lw * 0.5, -lw * 0.075);
        ctx.quadraticCurveTo(-lw * 0.36, lw * 0.05, 0, lw * 0.055);
        ctx.quadraticCurveTo(lw * 0.36, lw * 0.05, lw * 0.56, -lw * 0.12);
        ctx.lineTo(lw * 0.5, -lw * 0.1);
        ctx.quadraticCurveTo(lw * 0.2, -lw * 0.02, 0, -lw * 0.015);
        ctx.quadraticCurveTo(-lw * 0.3, -lw * 0.02, -lw * 0.47, -lw * 0.06);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = U.rgba(C.papel, 0.35 * a); ctx.lineWidth = Math.max(1, lw * 0.012); ctx.beginPath();
        ctx.moveTo(-lw * 0.42, -lw * 0.035); ctx.quadraticCurveTo(0, lw * 0.012, lw * 0.46, -lw * 0.075); ctx.stroke();
        ctx.restore();
        ctx.fillStyle = U.rgba(C.tinta, 0.18 * a);
        for (var k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(bx + (k - 1.5) * lw * 0.22 + Math.sin(E.t * 0.002 + k) * lw * 0.03, by + lw * (0.09 + k % 2 * 0.035), lw * 0.12, lw * 0.008, 0, 0, TAU); ctx.fill(); }
      }
      var L = E.lectura;
      return {
        duracion: 13500 + L,
        tarjeta: {
          en: 5200, hasta: 12500 + L,
          titulo: 'Ganryūjima',
          texto: 'En 1612, en esta isla, Miyamoto Musashi se batió con Sasaki Kojirō y su larguísima espada. Musashi llegó tarde a propósito, con una espada de madera que había tallado de un remo, y lo venció de un solo golpe. Decía haber ganado más de sesenta duelos; al final de su vida escribió «El libro de los cinco anillos».',
          pie: '宮本武蔵 · 佐々木小次郎 · 1612'
        },
        inicio: function () { E.irA(PA.L.isla, 1600); },
        cuadro: function (t) { if (t < 1200) adelantar(7); },
        frente: function (ctx, t) {
          var a = U.meseta(t, 900, 1700, 12000 + L, 13300 + L); if (a <= 0) return;
          var md = medidas(), w = md[0], h = md[1], x = E.W - w - E.W * 0.07, y = E.H * 0.13;
          // la línea que une la viñeta con la isla
          var q = PA.posicion('isla'); ctx.strokeStyle = U.rgba(C.tinta, 0.35 * a); ctx.lineWidth = 1; ctx.setLineDash([2, 4]);
          ctx.beginPath(); ctx.moveTo(q[0], q[1] - 6); ctx.lineTo(x + w * 0.3, y + h); ctx.stroke(); ctx.setLineDash([]);
          FX.panel(x, y, w, h, a);
          FX.dentroPanel(x, y, w, h, function () {
            var mar = y + h * 0.7, orilla = x + w * 0.42;
            // el mar pintado a tinta (una vez por tamaño) y unas crestas que se mueven; la isla, una loma de tinta
            var fondo = escenario(w, h);
            ctx.save(); ctx.globalAlpha = a; ctx.drawImage(fondo.c, x, y, w, h); ctx.restore();
            ctx.fillStyle = U.rgba(C.tinta, 0.35 * a);
            for (var f = 0; f < 4; f++) {
              var yy = mar + h * (0.05 + f * 0.065), sp = w * (0.08 + f * 0.02), dz = (t * 0.012 * (1 + f * 0.4)) % sp;
              for (var xx = x + w * 0.35 - sp + dz; xx < x + w; xx += sp) { var al = h * 0.008 * (1 + f * 0.3), an = sp * 0.45; ctx.beginPath(); ctx.moveTo(xx, yy); ctx.quadraticCurveTo(xx + an * 0.5, yy - al * 2, xx + an, yy); ctx.quadraticCurveTo(xx + an * 0.5, yy - al * 1.2, xx, yy); ctx.fill(); }
            }
            // la barca de Musashi, que llega por la derecha (y, cuando él salta, se queda meciéndose y se aleja un poco)
            var llega = U.inOut(U.tramo(t, 1400, 6000)), deriva = U.inOut(U.tramo(t, 6400, 11000)) * w * 0.12;
            var bx = U.lerp(x + w * 1.15, orilla + w * 0.13, llega) + deriva, by = mar + h * 0.012 + Math.sin(t * 0.004) * h * 0.006, lw = w * 0.3;
            barca(bx, by, lw, a, Math.sin(t * 0.003) * 0.03);
            var salta = U.inOut(U.tramo(t, 6100, 6700)), golpe = U.tramo(t, 6750, 6950);
            var mx = U.lerp(bx + w * 0.02, orilla - w * 0.02, salta), my = U.lerp(by - 2, mar - h * 0.02, salta) - Math.sin(salta * Math.PI) * h * 0.18;
            var kx = x + w * 0.24, ky = mar - h * 0.07, alto = h * 0.42;
            // Kojirō: espera con la espada larga en alto; tras el golpe, cae
            var cae = U.sale(U.tramo(t, 7100, 8100));
            FX.figura(kx, ky, alto, { estilo: 'kojiro', arma: 'nodachi', espada: U.lerp(-2.2, -0.4, cae), largo: 0.95, agacha: 0.3 * (1 - cae), rot: cae * 1.35, a: a * (1 - 0.3 * cae) });
            // Musashi, con el remo-espada de madera
            FX.figura(mx, my, alto * 0.98, { estilo: 'musashi', arma: 'remo', espada: golpe > 0 ? U.lerp(-1.8, 2.6, U.sale(golpe)) : -1.9, largo: 0.62, agacha: salta > 0 && salta < 1 ? 0.5 : 0.25 + 0.2 * golpe, espejo: true, a: a });
            // el tajo: un arco de pincel que sigue la punta del remo (de arriba abajo, delante de Musashi) y se borra enseguida;
            // en el golpe, unas gotas de tinta
            var tj = U.meseta(t, 6750, 6820, 7050, 7500);
            if (tj > 0) {
              var hx = mx - alto * 0.02, hy = my - alto * 0.62, R = alto * 0.78, arco = [], fr = U.sale(U.tramo(t, 6750, 6950));
              for (var ka = 0; ka <= 14; ka++) { var an = Math.PI + 0.35 - ka / 14 * 2.1; arco.push([hx + Math.cos(an) * R, hy - Math.sin(an) * R]); }
              FX.trazo(arco, alto * 0.07, 0.75 * tj * a, C.tinta, fr);
              FX.trazo(arco.map(function (q) { return [hx + (q[0] - hx) * 0.93, hy + (q[1] - hy) * 0.93]; }), alto * 0.025, 0.5 * tj * a, C.papel, fr);
            }
            var gotas = U.tramo(t, 6900, 7400);
            if (gotas > 0 && gotas < 1) {
              ctx.fillStyle = U.rgba(C.tinta, 0.8 * (1 - gotas) * a);
              for (var kg = 0; kg < 9; kg++) { var ag = -2.4 + kg * 0.3, dg = alto * (0.08 + gotas * (0.2 + U._h(kg) * 0.25)); ctx.beginPath(); ctx.arc(kx + alto * 0.05 + Math.cos(ag) * dg, ky - alto * 0.62 + Math.sin(ag) * dg + gotas * gotas * alto * 0.2, alto * (0.012 + U._h(kg + 3) * 0.012), 0, TAU); ctx.fill(); }
            }
            var tarde = U.meseta(t, 2200, 2800, 5600, 6200);
            if (tarde > 0) FX.texto('LLEGA TARDE…', x + w * 0.7, y + h * 0.16, { tam: 13, a: 0.8 * tarde * a, espaciado: 2.5, alin: 'center' });
          });
          FX.vertical('巌流島', x + w + E.u * 0.04, y + 4, E.u * 0.05, { a: 0.85 * a, aparicion: U.tramo(t, 1400, 2400) });
        }
      };
    }
  });
})();
