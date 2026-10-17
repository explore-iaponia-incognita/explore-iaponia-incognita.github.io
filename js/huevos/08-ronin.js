/* 08 · Los 47 rōnin — escribir «47».
   Se hace de noche y nieva; 47 siluetas cruzan el rollo en fila hacia una puerta, que se abre. */
(function () {
  'use strict';
  var SA = window.SA, U = SA.util, C = SA.color, FX = SA.fx, PA = SA.paisaje;

  SA.registrar({
    id: 'ronin', n: 8, nombre: 'Los 47 rōnin', kanji: '四十七士', tipo: 'Teclado',
    pista: 'Un número que todo Japón conoce: cuántos samuráis sin señor cruzaron la nieve aquella noche.',
    detectar: function (api) {
      var buf = '';
      api.en('tecla', function (d) {
        if (!d.key || d.key.length !== 1) return;
        buf = (buf + d.key).slice(-2);
        if (buf === '47') { buf = ''; api.disparar(); }
      });
    },
    escena: function (E) {
      var L = E.lectura, N = 47, r = U.azar(1703), fila = [];
      for (var i = 0; i < N; i++) fila.push({ d: i * 0.042 + r() * 0.012, arma: r() < 0.55 ? 'lanza' : 'espada', s: 0.9 + r() * 0.2 });
      var puertaX = function () { return E.W * 0.78; };
      // la puerta se pinta una vez (a la escala de la pantalla)
      var cachePuerta = null;
      function puerta(pw, ph) {
        if (cachePuerta && cachePuerta.pw === pw) return cachePuerta;
        var d = E.dpr, P = SA.arte.puerta(pw * d, ph * d);
        cachePuerta = { pw: pw, marco: P.marco, hoja: P.hoja, vano: P.vano / d, hw: P.hoja.w / d, hh: P.hoja.h / d };
        return cachePuerta;
      }
      function avance(t) { return U.tramo(t, 2200, 11800) * (N * 0.042 + 1.05); }   // cuánto ha andado la fila (en anchos de pantalla)
      return {
        duracion: 15500 + L,
        tarjeta: {
          en: 5600, hasta: 14000 + L,
          titulo: 'Los 47 rōnin',
          texto: 'En 1701 el señor Asano Naganori tuvo que hacerse el seppuku por desenvainar contra Kira Yoshinaka en el castillo de Edo. Casi dos años después, una noche de nieve, 47 de sus samuráis, ya sin señor, asaltaron la casa de Kira y lo mataron. Después se entregaron; 46 hicieron seppuku y están enterrados junto a su señor en el templo Sengaku-ji de Tokio.',
          pie: '赤穂浪士 · 30.01.1703'
        },
        heroeEncima: true,   // el rōnin, nítido sobre la noche: se arrodilla mientras pasan los 47
        inicio: function () { E.irA(4.15, 1600); if (PA.heroeAccion) PA.heroeAccion('reverencia', { dur: 13500 }); },   // campo abierto, lejos de la caligrafía del principio
        cuadro: function (t) {
          var n = U.meseta(t, 0, 2000, 13200 + L, 15200 + L); E.noche = n; E.nieve = n;
        },
        frente: function (ctx, t) {
          var a = U.meseta(t, 600, 2000, 13200 + L, 15000 + L); if (a <= 0) return;
          var suelo = E.H * 0.9, alto = E.u * 0.09, px = puertaX();
          // la puerta de la casa de Kira, pintada a tinta: las dos hojas se abren hacia dentro (se estrechan)
          var abre = U.inOut(U.tramo(t, 6800, 8200)), pw = E.u * 0.34, ph = E.u * 0.3, pz = puerta(pw, ph);
          ctx.save(); ctx.globalAlpha = a;
          var hw = pz.hw, hh = pz.hh, y0 = suelo - hh;
          ctx.drawImage(pz.hoja.c, px - pz.vano / 2, y0, hw * (1 - abre * 0.85), hh);
          ctx.drawImage(pz.hoja.c, px + pz.vano / 2 - hw * (1 - abre * 0.85), y0, hw * (1 - abre * 0.85), hh);
          ctx.drawImage(pz.marco.c, px - pw / 2, suelo - ph, pw, ph);
          ctx.restore();
          // la fila: entran por la izquierda y desaparecen por la puerta
          var av = avance(t), dentro = 0, vistos = 0;
          fila.forEach(function (f, i) {
            var x = (av - f.d - 0.08) * E.W; if (x < -40) return;
            vistos++;
            if (x > px - pw * 0.1) { dentro++; return; }
            // andan de verdad: cada uno en su fase del paso (fotogramas en caché)
            var fase = ((t * 0.0016 + i * 0.37) % 1 + 1) % 1;
            FX.figura(x, suelo, alto * f.s, { estilo: 'ronin47', arma: f.arma === 'lanza' ? 'yari' : 'katana', espada: f.arma === 'lanza' ? -1.35 : -0.9, largo: f.arma === 'lanza' ? 1.0 : 0.55, fase: fase, a: 0.92 * a, cache: true });
          });
          FX.texto(U.dos(Math.min(N, vistos)) + ' / 47', E.W * 0.08, E.H * 0.16, { tam: 18, a: 0.85 * a, color: C.papel, espaciado: 2, peso: 500 });
          if (dentro >= N) FX.sello('忠臣蔵', px, suelo - ph * 1.7, E.u * 0.05, a * U.tramo(t, 11800, 12400), 0.04);
        },
        fin: function () { E.noche = 0; E.nieve = 0; }
      };
    }
  });
})();
