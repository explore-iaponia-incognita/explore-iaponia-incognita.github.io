/* 04 · Ensō — dibujar un círculo de una sola pincelada (arrastrando).
   Sobre tu círculo aparece un ensō de caligrafía, con pincel seco al final, y un sello rojo. */
(function () {
  'use strict';
  var SA = window.SA, U = SA.util, C = SA.color, FX = SA.fx, TAU = Math.PI * 2;

  SA.registrar({
    id: 'enso', n: 4, nombre: 'Ensō', kanji: '円相', tipo: 'Gesto',
    pista: 'Un círculo de una sola pincelada, sin levantar el pincel ni corregirlo.',
    detectar: function (api) {
      api.en('trazo', function (d) {
        var c = SA.gestos.circulo(d.pts);
        if (c && c.ok) api.disparar({ cx: c.cx, cy: c.cy, r: c.r, xu: (c.cx + api.motor.camX) / api.motor.u });
      });
    },
    escena: function (E, datos) {
      var L = E.lectura, d = datos || { r: E.u * 0.16 }, xu = d.xu != null ? d.xu : (E.camX + E.W * 0.55) / E.u;
      var cy = d.cy || E.H * 0.42, r = Math.max(E.u * 0.12, Math.min(d.r || E.u * 0.16, E.u * 0.3)), rnd = U.azar(808);
      var cerdas = []; for (var b = 0; b < 22; b++) cerdas.push({ o: (b / 21 - 0.5), corte: 0.62 + rnd() * 0.36, a: 0.55 + rnd() * 0.4 });
      var A0 = Math.PI * 0.72, GIRO = TAU * 0.93;   // empieza abajo a la izquierda y no llega a cerrarse
      var cacheEnso = null;
      function trazoEnso() {
        if (cacheEnso) return cacheEnso;
        var T = SA.tinta, d = E.dpr, m = r * 1.35, Lz = T.lienzo(m * 2 * d, m * 2 * d), c = m * d, pts = [];
        for (var i = 0; i <= 120; i++) { var g = i / 120, ang = A0 + GIRO * g, rr = (r + Math.sin(g * 9) * r * 0.012) * d; pts.push([c + Math.cos(ang) * rr, c + Math.sin(ang) * rr, 1 - 0.35 * g]); }
        T.pincelada(Lz.x, pts, { ancho: E.u * 0.055 * d, alfa: 0.93, carga: 1, seco: 0.9, rasgado: 0.3, entrada: 0.06, salida: 0.22, gota: true, rugoso: 0.22, semilla: 808 });
        T.salpicar(Lz.x, pts[118][0], pts[118][1], E.u * 0.04 * d, { n: 9, dir: A0 + GIRO + Math.PI / 2, abre: 0.4, semilla: 81, max: E.u * 0.004 * d });
        cacheEnso = { c: Lz.c, m: m };
        return cacheEnso;
      }
      return {
        duracion: 11000 + L,
        tarjeta: {
          en: 3000, hasta: 10200 + L,
          titulo: 'Ensō',
          texto: 'Un círculo trazado de una sola pincelada, sin poder retocarlo. Los monjes zen lo pintaban a diario: no buscaban un círculo perfecto, sino uno sincero. En el trazo se ve cómo estaba la mente de quien lo hizo.',
          pie: '円相 · zen'
        },
        frente: function (ctx, t) {
          var cx = E.sx(xu), sal = 1 - U.tramo(t, 9800 + L, 10900 + L), prog = U.inOut(U.tramo(t, 300, 2300));
          if (prog <= 0) return;
          // el ensō: una sola pincelada con cerdas (pintada una vez) que se descubre siguiendo el giro del pincel
          var sp = trazoEnso();
          ctx.save(); ctx.beginPath(); ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, r * 1.6, A0 - 0.25, A0 + GIRO * prog + (prog >= 1 ? 0.6 : 0.02)); ctx.closePath(); ctx.clip();
          ctx.globalAlpha = sal; ctx.drawImage(sp.c, cx - sp.m, cy - sp.m, sp.m * 2, sp.m * 2); ctx.restore();
          // mientras pinta, la punta del pincel cargado va delante (y tapa el corte recto de lo que aún no se ve)
          if (prog < 1) {
            var ap = A0 + GIRO * prog, rp = r + Math.sin(prog * 9) * r * 0.012, ancho = E.u * 0.055 * (1 - 0.35 * prog) * Math.min(1, prog / 0.06) * (prog > 0.78 ? 1 - (prog - 0.78) / 0.22 * 0.7 : 1);
            ctx.fillStyle = U.rgba(C.tinta, 0.9 * sal); ctx.beginPath(); ctx.ellipse(cx + Math.cos(ap) * rp, cy + Math.sin(ap) * rp, ancho * 0.5, ancho * 0.42, ap, 0, Math.PI * 2); ctx.fill();
          }
          // el sello y la firma
          var s = U.rebote(U.tramo(t, 2500, 3100));
          if (s > 0) {
            FX.sello('円相', cx + r * 1.05, cy + r * 0.95, E.u * 0.05 * (1.6 - 0.6 * s), sal * U.tramo(t, 2500, 2700), 0.06);
            FX.vertical('一円相', cx + r * 1.3, cy - r * 0.9, E.u * 0.04, { a: 0.8 * sal, aparicion: U.tramo(t, 3000, 4200), mincho: true });
          }
        }
      };
    }
  });
})();
