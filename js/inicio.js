/* Iaponia Incognita · arranque
   Con ?prueba en la dirección, el libro deja probar todos los secretos (sin apuntarlos) y #id-del-secreto lo lanza al cargar.
   SA.debug sirve para probar desde la consola. */
(function () {
  'use strict';
  var SA = window.SA, E = SA.motor, I = SA.interfaz;
  I.iniciar();
  E.iniciar(document.getElementById('lienzo'));
  // lo primero que se ve se pinta del tirón (aprox. un segundo): antes se deja ver el aviso de carga
  setTimeout(function () {
    var t0 = performance.now();
    SA.paisaje.preparar && SA.paisaje.preparar();
    if (SA.tinta) SA.tinta.vaciar();   // (que esté pintado de verdad antes de quitar el aviso: si no, los primeros fotogramas pagan)
    SA.debug.tPreparar = Math.round(performance.now() - t0);
    var c = document.getElementById('cargando');
    if (c) { c.classList.add('fuera'); setTimeout(function () { c.hidden = true; }, 800); }
  }, 30);
  // en la entrada: un ensō de pincel detrás del 侍 (una sola pincelada, abierta, con la cola seca y un sello)
  var enso = document.getElementById('intro-enso');
  if (enso && SA.tinta && !document.getElementById('intro').hidden) {
    var T = SA.tinta, d = Math.min(window.devicePixelRatio || 1, 2), lado = 230 * d, pts = [], A0 = Math.PI * 0.62;
    enso.width = enso.height = lado;
    for (var i = 0; i <= 110; i++) { var g = i / 110, a = A0 + Math.PI * 2 * 0.9 * g, r = lado * (0.4 + Math.sin(g * 7) * 0.006); pts.push([lado / 2 + Math.cos(a) * r, lado / 2 + Math.sin(a) * r, 1 - 0.3 * g]); }
    T.pincelada(enso.getContext('2d'), pts, { ancho: lado * 0.07, alfa: 0.2, carga: 1, seco: 0.85, entrada: 0.05, salida: 0.25, gota: true, rugoso: 0.25, semilla: 77 });
    setTimeout(function () { enso.classList.add('listo'); }, 60);
  }
  // la caligrafía se pinta en el lienzo: cuando llegan las fuentes japonesas, se rehacen las piezas fijas
  if (document.fonts && document.fonts.load) {
    Promise.all([document.fonts.load('40px "Yuji Syuku"', '侍'), document.fonts.load('40px "Shippori Mincho"', '神')]).then(function () { SA.paisaje.reiniciar(['torii']); SA.fx.olvidarLetras(); });
  }

  function buscar(id) { var h = null; I.huevos().forEach(function (x) { if (x.id === id) h = x; }); return h; }
  SA.debug = {
    disparar: function (id, datos) {
      if (id === 'final') { I.verFinal(); return true; }
      if (id === 'creditos') { I.mostrarCreditos(); return true; }
      var h = buscar(id); return h ? I.disparar(h, datos, { prueba: true }) : false;
    },
    congelar: E.congelar, paso: E.paso,
    ir: function (xu) { E.camX = Math.max(0, Math.min(E.maxCam(), xu * E.u - E.W / 2)); E.camObj = null; },
    puntero: function (x, y) { E.puntero.x = x; E.puntero.y = y; E.puntero.sobre = true; E.puntero.tipo = 'mouse'; },
    ids: function () { return I.huevos().map(function (h) { return h.id; }); }
  };
  if (location.hash.length > 1) {
    var id = decodeURIComponent(location.hash.slice(1));
    setTimeout(function () { SA.debug.disparar(id); }, 700);
  }
})();
