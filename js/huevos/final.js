/* Final · El camino — al encontrar los diez secretos (y se puede volver a ver desde el libro).
   Los diez sellos se estampan uno a uno sobre el rollo, se pinta un gran 道 y el título pierde el «in» de incognita: Iaponia cognita. */
(function () {
  'use strict';
  var SA = window.SA, U = SA.util, C = SA.color, FX = SA.fx, TAU = Math.PI * 2;

  function duracion(ms) {
    if (!isFinite(ms) || ms <= 0) return 'un momento';
    var min = Math.round(ms / 60000);
    if (min < 1) return 'menos de un minuto';
    if (min < 60) return min + (min === 1 ? ' minuto' : ' minutos');
    var h = Math.floor(min / 60), m = min % 60;
    if (h < 48) return h + ' h' + (m ? ' ' + m + ' min' : '');
    var d = Math.floor(h / 24); return d + ' días y ' + (h % 24) + ' h';
  }

  SA.registrarFinal({
    escena: function (E, datos) {
      var huevos = datos.huevos || [], raiz = document.documentElement, r = U.azar(10);
      var sellos = huevos.map(function (h, i) { return { k: h.kanji, t0: 1400 + i * 420, rot: (r() - 0.5) * 0.3, col: i % 5, fila: Math.floor(i / 5) }; });
      // 道 a pincel (se pinta una vez por tamaño): la letra de caligrafía, con grano, vetas de pincel seco y gotas alrededor
      var cacheCamino = null;
      function camino() {
        var lado = Math.round(E.u * 0.42), d = E.dpr, clave = lado + 'x' + d;
        if (cacheCamino && cacheCamino.clave === clave) return cacheCamino;
        var T = SA.tinta, s = Math.round(lado * d), Lz = T.lienzo(s, s), x = Lz.x, rr = U.azar(77);
        x.fillStyle = U.rgba(C.tinta, 1); x.font = Math.round(s * 0.72) + 'px "Yuji Syuku", "Hiragino Mincho ProN", serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText('道', s / 2, s * 0.56);
        // las vetas secas: el pincel deja ver el papel en rayas finas, en la dirección del trazo
        x.save(); x.globalCompositeOperation = 'destination-out';
        for (var k = 0; k < 26; k++) {
          var y0 = s * (0.18 + rr() * 0.7), x0 = s * (0.12 + rr() * 0.6), l = s * (0.1 + rr() * 0.25), ang = (rr() - 0.5) * 0.5 + (rr() < 0.35 ? Math.PI / 2 : 0);
          T.pincelada(x, [[x0, y0], [x0 + Math.cos(ang) * l * 0.5, y0 + Math.sin(ang) * l * 0.5], [x0 + Math.cos(ang) * l, y0 + Math.sin(ang) * l]], { ancho: s * (0.004 + rr() * 0.006), alfa: 0.55, carga: 0.8, seco: 0.9, rasgado: 0.6, entrada: 0.3, salida: 0.4, semilla: 900 + k, cerdas: 4, soloCerdas: true });
        }
        var tg = T.textura('granulado', 256, 48, 2, 1.8, 9, false);
        x.globalAlpha = 0.28; x.fillStyle = x.createPattern(tg.c, 'repeat'); x.fillRect(0, 0, s, s);
        x.restore();
        // unas gotas donde el pincel se levantó
        T.salpicar(x, s * 0.78, s * 0.86, s * 0.08, { n: 12, dir: 0.3, abre: 0.9, semilla: 41, max: s * 0.012 });
        T.salpicar(x, s * 0.3, s * 0.2, s * 0.05, { n: 6, dir: -2.4, abre: 0.7, semilla: 43, max: s * 0.008 });
        cacheCamino = { c: Lz.c, clave: clave, lado: lado };
        return cacheCamino;
      }
      return {
        duracion: 16500,
        tarjeta: {
          en: 6200, hasta: 15200, kanji: '道',
          etiqueta: 'Los ' + SA.interfaz.palabra(huevos.length) + ' secretos', titulo: 'El camino',
          texto: 'Ya no queda nada oculto en este rollo. Lo has recorrido entero en ' + duracion(datos.hasta - datos.desde) + ', del primer secreto al último.',
          pie: '秘伝書 · ' + huevos.length + '/' + huevos.length
        },
        inicio: function () { raiz.classList.add('final-activo'); },
        cuadro: function (t) { if (t > 6000) raiz.classList.add('completo'); },
        frente: function (ctx, t) {
          var a = U.meseta(t, 0, 900, 15000, 16400);
          ctx.fillStyle = U.rgba(C.papel, 0.88 * a); ctx.fillRect(0, 0, E.W, E.H);
          // los diez sellos, en dos filas, estampándose uno tras otro
          var ancho = Math.min(E.W * 0.6, E.u * 1.1), x0 = E.W / 2 - ancho / 2, paso = ancho / 4, tam = Math.min(E.u * 0.06, paso * 0.4);
          sellos.forEach(function (s) {
            var f = U.tramo(t, s.t0, s.t0 + 260); if (f <= 0) return;
            var x = x0 + s.col * paso, y = E.H * (0.2 + s.fila * 0.17), esc = 1 + (1 - U.sale(f)) * 0.5;
            if (f < 1) FX.brillo(x, y, tam * 2.2, C.bermellon, 0.18 * (1 - f));
            FX.sello(s.k, x, y, tam * esc, a * Math.min(1, f * 2), s.rot);
          });
          // el gran 道, como pintado a pincel: tinta con grano y vetas secas, que aparece de arriba abajo (con el borde
          // blando, como el pincel al bajar) y, al acabar, salpica
          var d = U.tramo(t, 5600, 7800);
          if (d > 0) {
            var cd = camino(), cx = E.W / 2, cy = E.H * 0.66, lado = cd.lado;
            var V = SA.tinta.auxiliar('final-velo', cd.c.width, cd.c.height), vx = V.x, hh = cd.c.height;
            vx.drawImage(cd.c, 0, 0);
            var g = vx.createLinearGradient(0, hh * (d * 1.25 - 0.25), 0, hh * (d * 1.25));
            g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
            vx.globalCompositeOperation = 'destination-in'; vx.fillStyle = g; vx.fillRect(0, 0, V.w, V.h); vx.globalCompositeOperation = 'source-over';
            ctx.save(); ctx.globalAlpha = 0.92 * a; ctx.drawImage(V.c, 0, 0, V.w, V.h, cx - lado / 2, cy - lado * 0.62, lado, lado); ctx.restore();
          }
        },
        fin: function () { raiz.classList.remove('final-activo'); }
      };
    }
  });
})();
