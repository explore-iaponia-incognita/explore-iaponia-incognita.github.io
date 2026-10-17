/* El camino oculto · sonido
   Todo sintetizado con Web Audio, sin archivos:
   - viento (ruido filtrado que sigue al viento del rollo), olas cerca del mar y pájaros de vez en cuando;
   - un koto (cuerda pulsada, Karplus-Strong) que suelta notas sueltas de la escala in (miyako-bushi);
   - al descubrir un secreto, un golpe de taiko y un arpegio; cada escena con su sonido (el tajo, el trueno, la campana…);
   - el pincel suena al pintar y la gota de tinta, al caer.
   Empieza apagado: el botón ♪ lo enciende y se recuerda. Los navegadores solo dejan sonar después de un gesto. */
(function () {
  'use strict';
  var SA = window.SA, E = SA.motor, U = SA.util, CLAVE = 'camino-oculto.sonido';
  var S = SA.sonido = { activo: false };
  var ac = null, master, salaEnv, ruido, vientoF, vientoG, olasF, olasG, ksCache = {};
  // la escala in sobre re: re, mi bemol, sol, la, si bemol (dos octavas)
  var ESCALA = [293.66, 311.13, 392.0, 440.0, 466.16, 587.33, 622.25, 783.99, 880.0, 932.33];

  function crear() {
    var Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return false;
    ac = new Ctx();
    master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
    // la sala: una reverberación larga y suave (respuesta al impulso de ruido que se apaga)
    var conv = ac.createConvolver(); conv.buffer = impulso(3.2, 2.6);
    salaEnv = ac.createGain(); salaEnv.gain.value = 0.5; salaEnv.connect(conv); var rv = ac.createGain(); rv.gain.value = 0.42; conv.connect(rv); rv.connect(master);
    ruido = bufferRuido(4);
    // el viento: ruido rosa por un pasa-banda que se mueve
    var v = ac.createBufferSource(); v.buffer = ruido; v.loop = true;
    vientoF = ac.createBiquadFilter(); vientoF.type = 'bandpass'; vientoF.frequency.value = 420; vientoF.Q.value = 0.6;
    vientoG = ac.createGain(); vientoG.gain.value = 0;
    v.connect(vientoF); vientoF.connect(vientoG); vientoG.connect(master); vientoG.connect(salaEnv); v.start();
    // las olas: ruido grave que sube y baja (solo cerca del mar)
    var o = ac.createBufferSource(); o.buffer = ruido; o.loop = true; o.loopStart = 1.3;
    olasF = ac.createBiquadFilter(); olasF.type = 'lowpass'; olasF.frequency.value = 500;
    olasG = ac.createGain(); olasG.gain.value = 0;
    o.connect(olasF); olasF.connect(olasG); olasG.connect(master); o.start(0, 1.3);
    return true;
  }
  function bufferRuido(seg) {
    var n = Math.floor(ac.sampleRate * seg), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0), b0 = 0, b1 = 0, b2 = 0;
    for (var i = 0; i < n; i++) { var w = Math.random() * 2 - 1; b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
    return b;
  }
  function impulso(seg, caida) {
    var n = Math.floor(ac.sampleRate * seg), b = ac.createBuffer(2, n, ac.sampleRate);
    for (var c = 0; c < 2; c++) { var d = b.getChannelData(c); for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, caida); }
    return b;
  }
  // una cuerda pulsada (Karplus-Strong), con el ataque algo brillante y un cuerpo que se apaga
  function cuerda(f, seg) {
    var clave = Math.round(f * 10); if (ksCache[clave]) return ksCache[clave];
    var sr = ac.sampleRate, n = Math.floor(sr * seg), b = ac.createBuffer(1, n, sr), d = b.getChannelData(0), N = Math.max(2, Math.round(sr / f)), anillo = new Float32Array(N), k = 0;
    for (var i = 0; i < N; i++) anillo[i] = (Math.random() * 2 - 1) * (0.6 + 0.4 * Math.sin(Math.PI * i / N));
    for (var j = 0; j < n; j++) { var a = anillo[k], s = anillo[(k + 1) % N]; anillo[k] = (a * 0.48 + s * 0.52) * 0.9965; d[j] = a * Math.min(1, j / 40); k = (k + 1) % N; }
    return (ksCache[clave] = b);
  }
  function salida(nodo, vol, sala) { var g = ac.createGain(); g.gain.value = vol; nodo.connect(g); g.connect(master); if (sala) { var g2 = ac.createGain(); g2.gain.value = sala; g.connect(g2); g2.connect(salaEnv); } return g; }
  function koto(f, cuando, vol) { var s = ac.createBufferSource(); s.buffer = cuerda(f, 3.2); salida(s, vol == null ? 0.3 : vol, 0.9); s.start(cuando); }
  function arpegio(cuando, notas, paso, vol) { notas.forEach(function (i, k) { koto(ESCALA[i % ESCALA.length] * (i >= ESCALA.length ? 2 : 1), cuando + k * paso, vol); }); }
  // taiko: un golpe grave que baja de tono, con la piel (ruido) al principio
  function taiko(cuando, vol) {
    var o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(120, cuando); o.frequency.exponentialRampToValueAtTime(48, cuando + 0.35);
    g.gain.setValueAtTime(0.0001, cuando); g.gain.exponentialRampToValueAtTime(vol, cuando + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, cuando + 1.1);
    o.connect(g); g.connect(master); var g2 = ac.createGain(); g2.gain.value = 0.4; g.connect(g2); g2.connect(salaEnv); o.start(cuando); o.stop(cuando + 1.2);
    golpeRuido(cuando, 0.09, 380, vol * 0.5);
  }
  function golpeRuido(cuando, dur, frec, vol, tipo) {
    var s = ac.createBufferSource(); s.buffer = ruido; var f = ac.createBiquadFilter(); f.type = tipo || 'lowpass'; f.frequency.value = frec; f.Q.value = tipo === 'bandpass' ? 2 : 0.7;
    var g = ac.createGain(); g.gain.setValueAtTime(0.0001, cuando); g.gain.exponentialRampToValueAtTime(vol, cuando + Math.min(0.02, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, cuando + dur);
    s.connect(f); f.connect(g); g.connect(master); var g2 = ac.createGain(); g2.gain.value = 0.3; g.connect(g2); g2.connect(salaEnv);
    s.start(cuando, Math.random() * 2, dur + 0.05);
  }
  // el tajo: un silbido que barre (aire cortado) y el «shiiing» metálico de la hoja
  function tajo(cuando) {
    var s = ac.createBufferSource(); s.buffer = ruido; var f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3;
    f.frequency.setValueAtTime(900, cuando); f.frequency.exponentialRampToValueAtTime(5200, cuando + 0.16);
    var g = ac.createGain(); g.gain.setValueAtTime(0.0001, cuando); g.gain.exponentialRampToValueAtTime(0.5, cuando + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, cuando + 0.24);
    s.connect(f); f.connect(g); g.connect(master); s.start(cuando, Math.random(), 0.3);
    [2637, 3520, 4699].forEach(function (fr, i) {
      var o = ac.createOscillator(), go = ac.createGain(); o.frequency.value = fr * (1 + i * 0.003);
      go.gain.setValueAtTime(0.0001, cuando + 0.08); go.gain.exponentialRampToValueAtTime(0.06 / (i + 1), cuando + 0.1); go.gain.exponentialRampToValueAtTime(0.0001, cuando + 1.6);
      o.connect(go); go.connect(master); var g2 = ac.createGain(); g2.gain.value = 0.5; go.connect(g2); g2.connect(salaEnv); o.start(cuando + 0.08); o.stop(cuando + 1.7);
    });
  }
  // una campana de templo: parciales inarmónicos que se apagan despacio
  function campana(cuando, vol) {
    [[220, 1], [440.8, 0.5], [589, 0.35], [863, 0.2], [1192, 0.12]].forEach(function (p) {
      var o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = p[0];
      g.gain.setValueAtTime(0.0001, cuando); g.gain.exponentialRampToValueAtTime(vol * p[1], cuando + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, cuando + 6);
      o.connect(g); g.connect(master); var g2 = ac.createGain(); g2.gain.value = 0.6; g.connect(g2); g2.connect(salaEnv); o.start(cuando); o.stop(cuando + 6.2);
    });
  }
  // el trueno: ruido grave que retumba
  function trueno(cuando) { golpeRuido(cuando, 2.8, 160, 0.9); golpeRuido(cuando + 0.15, 1.6, 90, 0.7); }
  // un pájaro: dos o tres píos con barridos rápidos de tono
  function pajaro(cuando) {
    var n = 2 + Math.floor(Math.random() * 3), base = 2600 + Math.random() * 1600;
    for (var i = 0; i < n; i++) {
      var t0 = cuando + i * (0.09 + Math.random() * 0.05), o = ac.createOscillator(), g = ac.createGain();
      o.frequency.setValueAtTime(base, t0); o.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * 0.3), t0 + 0.04); o.frequency.exponentialRampToValueAtTime(base * 0.9, t0 + 0.08);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.035, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
      o.connect(g); g.connect(master); var g2 = ac.createGain(); g2.gain.value = 0.6; g.connect(g2); g2.connect(salaEnv); o.start(t0); o.stop(t0 + 0.1);
    }
  }
  // el shakuhachi: un tono soplado (seno + aire) que crece y se apaga
  function shakuhachi(f, cuando, dur, vol) {
    var o = ac.createOscillator(), g = ac.createGain(), vib = ac.createOscillator(), gv = ac.createGain();
    o.frequency.value = f; vib.frequency.value = 5; gv.gain.value = f * 0.006; vib.connect(gv); gv.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, cuando); g.gain.exponentialRampToValueAtTime(vol, cuando + dur * 0.3); g.gain.setValueAtTime(vol, cuando + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, cuando + dur);
    o.connect(g); g.connect(master); var g2 = ac.createGain(); g2.gain.value = 0.8; g.connect(g2); g2.connect(salaEnv);
    o.start(cuando); vib.start(cuando); o.stop(cuando + dur + 0.1); vib.stop(cuando + dur + 0.1);
    golpeRuido(cuando, dur, f * 2, vol * 0.25, 'bandpass');
  }

  /* --- lo que suena solo --- */
  var proxKoto = 4, proxPajaro = 6, ultimoPincel = 0;
  function actualizar() {
    if (!ac || !S.activo) return;
    var t = ac.currentTime, xc = E.xuDe(E.W / 2), vto = SA.paisaje && SA.paisaje.viento ? SA.paisaje.viento(xc, 0) : 0.2;
    vientoG.gain.setTargetAtTime(0.025 + Math.min(0.16, vto * 0.14), t, 0.4);
    vientoF.frequency.setTargetAtTime(260 + vto * 900, t, 0.6);
    var L = SA.paisaje && SA.paisaje.L, cerca = L ? U.clamp(1 - Math.abs(xc - (L.mar[0] + L.mar[1]) / 2) / 1.6, 0, 1) : 0;
    olasG.gain.setTargetAtTime(cerca * (0.05 + 0.05 * Math.sin(t * 0.7)) * (1 + (SA.paisaje ? SA.paisaje.estado.oleaje * 3 : 0)), t, 0.5);
    if (t > proxKoto && !E.escena) {
      var i = Math.floor(Math.random() * 7); koto(ESCALA[i], t, 0.16 + Math.random() * 0.08);
      if (Math.random() < 0.35) koto(ESCALA[i + 2 < ESCALA.length ? i + 2 : i], t + 0.35 + Math.random() * 0.3, 0.12);
      proxKoto = t + 4 + Math.random() * 7;
    }
    if (t > proxPajaro) { pajaro(t); proxPajaro = t + 7 + Math.random() * 12; }
  }
  setInterval(actualizar, 120);

  /* --- lo que suena cuando pasa algo --- */
  var ESCENAS = {
    sekigahara: function (t) { for (var i = 0; i < 6; i++) taiko(t + 0.5 + i * 0.42, i === 5 ? 0.9 : 0.55); arpegio(t + 4.6, [0, 2, 3, 4, 6], 0.18, 0.2); },
    ganryujima: function (t) { golpeRuido(t + 0.3, 3, 400, 0.12); tajo(t + 6.75); taiko(t + 6.8, 0.8); },
    ninja: function (t) { golpeRuido(t + 0.2, 0.35, 2400, 0.25, 'bandpass'); tajo(t + 1.6); },
    enso: function (t) { golpeRuido(t + 0.3, 2.1, 1200, 0.08, 'bandpass'); campana(t + 2.5, 0.12); },
    tameshigiri: function (t) { tajo(t + 0.02); golpeRuido(t + 0.9, 0.25, 300, 0.4); },
    kamikaze: function (t) { trueno(t + 5.25); trueno(t + 8.95); },
    bushido: function (t) { arpegio(t + 0.3, [0, 2, 3, 4, 5, 7, 8], 0.32, 0.22); },
    ronin: function (t) { campana(t + 0.8, 0.18); campana(t + 7.5, 0.12); },
    sakura: function (t) { arpegio(t + 1.8, [5, 4, 3, 2, 3, 5, 7], 0.42, 0.18); },
    'ultimo-samurai': function (t) { shakuhachi(293.66, t + 0.6, 4.5, 0.08); shakuhachi(261.63, t + 5.4, 5, 0.07); },
    final: function (t) { taiko(t + 0.2, 0.9); arpegio(t + 0.8, [0, 2, 3, 4, 5, 6, 7, 8, 9], 0.16, 0.22); campana(t + 2.6, 0.2); }
  };
  E.en('escena', function (d) {
    if (!ac || !S.activo || d.fase !== 'inicio') return;
    var t = ac.currentTime, f = ESCENAS[d.huevo && d.huevo.id];
    taiko(t, 0.7);
    if (f) f(t); else arpegio(t + 0.4, [0, 2, 4, 5], 0.2, 0.2);
  });
  // el pincel: un roce suave mientras se pinta, y la gota al caer
  var pinceladaOriginal = E.pincelada, gotaOriginal = E.gota;
  E.pincelada = function (x0, y0, x1, y1, ancho, a) {
    pinceladaOriginal.apply(this, arguments);
    if (ac && S.activo && ac.currentTime - ultimoPincel > 0.07) { ultimoPincel = ac.currentTime; golpeRuido(ultimoPincel, 0.12, 900 + Math.hypot(x1 - x0, y1 - y0) * 30, 0.05, 'bandpass'); }
  };
  E.gota = function (x, y, r, semilla) {
    gotaOriginal.apply(this, arguments);
    if (!ac || !S.activo) return;
    var t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(1400, t); o.frequency.exponentialRampToValueAtTime(520, t + 0.09);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g); g.connect(master); var g2 = ac.createGain(); g2.gain.value = 0.5; g.connect(g2); g2.connect(salaEnv); o.start(t); o.stop(t + 0.25);
  };

  /* --- encender y apagar --- */
  S.encender = function () {
    if (!ac && !crear()) return;
    if (ac.state === 'suspended') ac.resume();
    S.activo = true; master.gain.setTargetAtTime(0.9, ac.currentTime, 0.6);
    try { localStorage.setItem(CLAVE, '1'); } catch (e) { /* nada */ }
    pintarBoton();
  };
  S.apagar = function () {
    S.activo = false; if (ac) master.gain.setTargetAtTime(0, ac.currentTime, 0.25);
    try { localStorage.setItem(CLAVE, '0'); } catch (e) { /* nada */ }
    pintarBoton();
  };
  S.alternar = function () { if (S.activo) S.apagar(); else S.encender(); };
  function pintarBoton() { var b = document.getElementById('b-sonido'); if (b) { b.setAttribute('aria-pressed', S.activo ? 'true' : 'false'); b.classList.toggle('activo', S.activo); } }
  // si la última vez estaba encendido, se enciende en el primer gesto (los navegadores no dejan antes)
  var quiere = false; try { quiere = localStorage.getItem(CLAVE) === '1'; } catch (e) { /* nada */ }
  function primerGesto() { if (quiere && !S.activo) S.encender(); window.removeEventListener('pointerdown', primerGesto, true); window.removeEventListener('keydown', primerGesto, true); }
  window.addEventListener('pointerdown', primerGesto, true); window.addEventListener('keydown', primerGesto, true);
  document.addEventListener('DOMContentLoaded', function () {
    var b = document.getElementById('b-sonido'); if (b) b.addEventListener('click', function (ev) { ev.stopPropagation(); quiere = false; S.alternar(); });
    pintarBoton();
  });
})();
