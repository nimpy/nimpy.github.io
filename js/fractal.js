// Julia Set — WebGL fragment shader renderer
(function () {
  var canvas = document.getElementById('fractal-canvas');
  if (!canvas) return;

  var gl = canvas.getContext('webgl');
  if (!gl) {
    canvas.style.background = '#faf9f7';
    return;
  }

  var vertSrc = [
    'attribute vec2 a_pos;',
    'varying vec2 v_uv;',
    'void main() {',
    '  v_uv = a_pos * 0.5 + 0.5;',
    '  gl_Position = vec4(a_pos, 0.0, 1.0);',
    '}'
  ].join('\n');

  var fragSrc = [
    'precision highp float;',
    'varying vec2 v_uv;',
    'uniform vec2 u_resolution;',
    'uniform vec2 u_c;',
    'uniform float u_zoom;',
    '',
    'vec3 palette(float s) {',
    '  float t = fract(s) * 5.0;',
    '  vec3 c0 = vec3(0.98, 0.96, 0.94);',
    '  vec3 c1 = vec3(0.88, 0.82, 0.90);',
    '  vec3 c2 = vec3(0.72, 0.62, 0.78);',
    '  vec3 c3 = vec3(0.58, 0.52, 0.64);',
    '  vec3 c4 = vec3(0.84, 0.80, 0.82);',
    '  vec3 c5 = vec3(0.98, 0.96, 0.94);',
    '  vec3 col = c0;',
    '  col = mix(col, c1, clamp(t, 0.0, 1.0));',
    '  col = mix(col, c2, clamp(t - 1.0, 0.0, 1.0));',
    '  col = mix(col, c3, clamp(t - 2.0, 0.0, 1.0));',
    '  col = mix(col, c4, clamp(t - 3.0, 0.0, 1.0));',
    '  col = mix(col, c5, clamp(t - 4.0, 0.0, 1.0));',
    '  return col;',
    '}',
    '',
    'void main() {',
    '  float aspect = u_resolution.x / u_resolution.y;',
    '  float range = 3.5 / u_zoom;',
    '  float x = (v_uv.x - 0.5) * range * aspect;',
    '  float y = (v_uv.y - 0.5) * range;',
    '',
    '  int iter = 0;',
    '  const int MAX_ITER = 200;',
    '  for (int i = 0; i < 200; i++) {',
    '    float x2 = x * x;',
    '    float y2 = y * y;',
    '    if (x2 + y2 > 4.0) break;',
    '    float xnew = x2 - y2 + u_c.x;',
    '    y = 2.0 * x * y + u_c.y;',
    '    x = xnew;',
    '    iter = i + 1;',
    '  }',
    '',
    '  if (iter == MAX_ITER) {',
    '    gl_FragColor = vec4(0.98, 0.96, 0.94, 1.0);',
    '  } else {',
    '    float s = float(iter) - log2(log2(x*x + y*y)) + 4.0;',
    '    vec3 col = palette(s * 0.04);',
    '    gl_FragColor = vec4(col, 1.0);',
    '  }',
    '}'
  ].join('\n');

  function compileShader(src, type) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      console.error('Shader error:', gl.getShaderInfoLog(s));
    return s;
  }

  var prog = gl.createProgram();
  gl.attachShader(prog, compileShader(vertSrc, gl.VERTEX_SHADER));
  gl.attachShader(prog, compileShader(fragSrc, gl.FRAGMENT_SHADER));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
    console.error('Link error:', gl.getProgramInfoLog(prog));
  gl.useProgram(prog);

  var quadBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  var aPos = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  var uRes = gl.getUniformLocation(prog, 'u_resolution');
  var uC = gl.getUniformLocation(prog, 'u_c');
  var uZoom = gl.getUniformLocation(prog, 'u_zoom');

  // State
  var cx = -0.7269, cy = 0.1889;
  var targetCx = cx, targetCy = cy;
  var zoom = 1.0, targetZoom = 1.0;
  var animating = true;
  var animFrame;
  var isStatic = false;

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function render() {
    cx += (targetCx - cx) * 0.08;
    cy += (targetCy - cy) * 0.08;
    zoom += (targetZoom - zoom) * 0.04;

    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform2f(uC, cx, cy);
    gl.uniform1f(uZoom, zoom);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    if (animating) animFrame = requestAnimationFrame(render);
  }

  // Mouse → morph the Julia c parameter
  if (window.innerWidth >= 768) {
    document.addEventListener('mousemove', function (e) {
      if (isStatic) return;
      var nx = e.clientX / window.innerWidth;
      var ny = e.clientY / window.innerHeight;
      targetCx = -0.8 + nx * 0.3;
      targetCy = -0.2 + ny * 0.4;
    });
  }

  // Scroll → zoom into the fractal
  window.addEventListener('scroll', function () {
    if (isStatic) return;
    var frac = window.scrollY / (document.body.scrollHeight - window.innerHeight || 1);
    targetZoom = 1 + frac * 3.5;
    if (!animating) render();
  });

  // Ж fractal dividers
  function createZhFractalSVG() {
    var dividers = document.querySelectorAll('.zh-divider');
    dividers.forEach(function (el) {
      var lines = '';
      var PI = Math.PI;

      function arm(cx, cy, angle, len) {
        return { x: cx + Math.sin(angle) * len, y: cy - Math.cos(angle) * len };
      }

      function zh(cx, cy, len, angle, depth) {
        if (depth <= 0 || len < 0.3) return;
        var opacity = 0.06 + depth * 0.05;
        var sw = 0.3 + depth * 0.3;

        function line(ex, ey) {
          lines += '<line x1="'+cx.toFixed(1)+'" y1="'+cy.toFixed(1)+
            '" x2="'+ex.toFixed(1)+'" y2="'+ey.toFixed(1)+
            '" stroke="rgba(90,80,65,'+opacity.toFixed(2)+')" stroke-width="'+sw.toFixed(2)+'" stroke-linecap="round"/>';
        }

        // vertical arms along current axis (no recursion)
        var up = arm(cx, cy, angle, len);
        var dn = arm(cx, cy, angle + PI, len);
        line(up.x, up.y);
        line(dn.x, dn.y);

        // 4 diagonal arms at ±35° from axis (recurse, rotating axis)
        var branchA = 35 * PI / 180;
        var da = [angle - branchA, angle + branchA, angle + PI - branchA, angle + PI + branchA];
        for (var i = 0; i < da.length; i++) {
          var tip = arm(cx, cy, da[i], len);
          line(tip.x, tip.y);
          zh(tip.x, tip.y, len * 0.35, da[i], depth - 1);
        }
      }

      zh(100, 55, 48, 0, 4);
      el.innerHTML = '<svg viewBox="-5 -5 210 120" preserveAspectRatio="xMidYMid meet" style="width:100%;height:70px;opacity:0.6">' + lines + '</svg>';
    });
  }

  // Reveal on scroll
  function setupReveal() {
    var els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (e) { e.classList.add('visible'); });
      return;
    }
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    els.forEach(function (e) { obs.observe(e); });
  }

  // Mode toggle (light / lighter)
  function initModeToggle() {
    var saved = localStorage.getItem('niaki-mode');
    if (saved === 'lighter') document.body.classList.add('lighter');
    var btn = document.getElementById('mode-toggle');
    if (btn) {
      updateModeLabel(btn);
      btn.addEventListener('click', function () {
        document.body.classList.toggle('lighter');
        localStorage.setItem('niaki-mode',
          document.body.classList.contains('lighter') ? 'lighter' : 'light');
        updateModeLabel(btn);
      });
    }
  }
  function updateModeLabel(btn) {
    var isLighter = document.body.classList.contains('lighter');
    btn.textContent = isLighter ? 'lighter' : 'light';
    btn.classList.toggle('toggle-active', isLighter);
  }

  // GPU toggle
  function initGpuToggle() {
    var saved = localStorage.getItem('niaki-gpu');
    if (saved === 'off') animating = false;
    var btn = document.getElementById('gpu-toggle');
    if (btn) {
      updateGpuLabel(btn);
      btn.addEventListener('click', function () {
        animating = !animating;
        localStorage.setItem('niaki-gpu', animating ? 'on' : 'off');
        updateGpuLabel(btn);
        if (animating) render();
      });
    }
  }
  function updateGpuLabel(btn) {
    var isLighter = !animating;
    btn.textContent = isLighter ? 'lighter on the gpu' : 'light on the gpu';
    btn.classList.toggle('toggle-active', isLighter);
  }

  // Active nav link — highlights current page and section on scroll
  function initActiveNav() {
    var navLinks = document.querySelectorAll('.nav-links a');
    var path = window.location.pathname;

    // Mark current page link as active
    navLinks.forEach(function (link) {
      var href = link.getAttribute('href');
      // if ((href === 'photos.html' || href === '../photos.html') && path.indexOf('photos') !== -1) {
      //   link.classList.add('active');
      // } else
      if ((href === 'latent-space.html' || href === '../latent-space.html') && path.indexOf('latent-space') !== -1) {
        link.classList.add('active');
      } else if ((href === '../index.html#work' || href === 'index.html#work') && path.indexOf('projects') !== -1) {
        link.classList.add('active');
      }
    });

    // Scroll spy for sections on the main page
    var sections = document.querySelectorAll('section[id]');
    if (sections.length > 0) {
      window.addEventListener('scroll', function () {
        var scrollPos = window.scrollY + 150;
        var found = false;
        for (var i = sections.length - 1; i >= 0; i--) {
          if (scrollPos >= sections[i].offsetTop) {
            var id = sections[i].getAttribute('id');
            navLinks.forEach(function (link) {
              var href = link.getAttribute('href');
              var isMatch = href === '#' + id;
              link.classList.toggle('active', isMatch);
            });
            found = true;
            break;
          }
        }
        if (!found) {
          navLinks.forEach(function (link) { link.classList.remove('active'); });
        }
      });
    }
  }

  // Init
  resize();
  initModeToggle();
  initGpuToggle();
  initActiveNav();
  render();
  createZhFractalSVG();
  setupReveal();
  window.addEventListener('resize', function () { resize(); if (!animating) render(); });

  // Static mode for sub-pages
  window.fractalSetStatic = function (c1, c2, z) {
    isStatic = true;
    targetCx = cx = c1;
    targetCy = cy = c2;
    targetZoom = zoom = z || 1;
    if (!animating) render();
  };
})();
