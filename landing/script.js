// ── Mobile Menu Toggle ──────────────────────────────────────────────────
const menuBtn = document.getElementById('menuBtn');
const mobileMenu = document.getElementById('mobileMenu');

if (menuBtn && mobileMenu) {
  menuBtn.addEventListener('click', () => {
    mobileMenu.classList.toggle('open');
  });

  // Close on link click
  mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      mobileMenu.classList.remove('open');
    });
  });
}

// ── Navbar background on scroll ─────────────────────────────────────────
const nav = document.getElementById('nav');
let lastScroll = 0;

window.addEventListener('scroll', () => {
  const scrollY = window.scrollY;
  if (nav) {
    nav.style.borderBottomColor = scrollY > 10 ? '' : 'transparent';
  }
  lastScroll = scrollY;
}, { passive: true });

// ── Smooth scroll for anchor links ──────────────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const href = this.getAttribute('href');
    if (!href || href === '#') return;

    const target = document.querySelector(href);
    if (target) {
      e.preventDefault();
      const offset = 64; // nav height
      const pos = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: pos, behavior: 'smooth' });
    }
  });
});

// ── Animate elements on scroll (intersection observer) ──────────────────
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -40px 0px',
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

// Observe all animated elements
document.querySelectorAll('.feature-card, .step, .price-card').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  observer.observe(el);
});

// ── Stat counter animation ──────────────────────────────────────────────
const statObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const el = entry.target;
      const target = parseInt(el.textContent, 10);
      if (isNaN(target)) return;

      let current = 0;
      const duration = 1200;
      const step = Math.ceil(target / (duration / 16));
      const timer = setInterval(() => {
        current += step;
        if (current >= target) {
          current = target;
          clearInterval(timer);
        }
        el.textContent = current;
      }, 16);

      statObserver.unobserve(el);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('.stat-number').forEach(el => {
  statObserver.observe(el);
});

// ── Shield Protection Background Animation ───────────────────────────────
(function () {
  const canvas = document.getElementById('bgCanvas');
  if (!canvas) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const ctx = canvas.getContext('2d');
  let width, height, dpr;
  let shieldCenter, shieldRadius;
  let threats = [];
  let safeParticles = [];
  let ripples = [];
  let floatingLocks = [];
  let time = 0;

  // Colors
  const GREEN = { r: 22, g: 163, b: 74 };
  const RED = { r: 220, g: 38, b: 38 };
  const AMBER = { r: 245, g: 158, b: 11 };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    shieldCenter = { x: width / 2, y: height * 0.42 };
    shieldRadius = Math.min(width, height) * 0.32;
  }

  // ── Shield shape (pointed bottom, like a real crest shield) ──
  function getShieldPath(cx, cy, r) {
    const pts = [];
    pts.push({ x: cx, y: cy - r });                        // top center
    pts.push({ x: cx + r * 0.9, y: cy - r * 0.55 });      // top right
    pts.push({ x: cx + r * 0.85, y: cy + r * 0.15 });     // mid right
    pts.push({ x: cx + r * 0.45, y: cy + r * 0.65 });     // lower right
    pts.push({ x: cx, y: cy + r });                        // bottom point
    pts.push({ x: cx - r * 0.45, y: cy + r * 0.65 });     // lower left
    pts.push({ x: cx - r * 0.85, y: cy + r * 0.15 });     // mid left
    pts.push({ x: cx - r * 0.9, y: cy - r * 0.55 });      // top left
    return pts;
  }

  function traceShieldPath(pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const cpx = (prev.x + curr.x) / 2;
      const cpy = (prev.y + curr.y) / 2;
      ctx.quadraticCurveTo(prev.x, prev.y, cpx, cpy);
    }
    ctx.quadraticCurveTo(
      pts[pts.length - 1].x, pts[pts.length - 1].y,
      pts[0].x, pts[0].y
    );
    ctx.closePath();
  }

  function isInsideShield(x, y) {
    const dx = x - shieldCenter.x;
    const dy = y - shieldCenter.y;
    return Math.sqrt(dx * dx + dy * dy) < shieldRadius * 0.85;
  }

  // ── Threat particles (approach from edges, get blocked) ──
  function spawnThreat() {
    if (threats.length > 12) return;
    const side = Math.floor(Math.random() * 4);
    let x, y;
    switch (side) {
      case 0: x = Math.random() * width; y = -20; break;
      case 1: x = width + 20; y = Math.random() * height; break;
      case 2: x = Math.random() * width; y = height + 20; break;
      default: x = -20; y = Math.random() * height; break;
    }
    const angle = Math.atan2(shieldCenter.y - y, shieldCenter.x - x);
    const jitter = (Math.random() - 0.5) * 0.6;
    threats.push({
      x, y,
      vx: Math.cos(angle + jitter) * (0.4 + Math.random() * 0.5),
      vy: Math.sin(angle + jitter) * (0.4 + Math.random() * 0.5),
      radius: 2 + Math.random() * 2,
      life: 1,
      blocked: false,
      blockedTime: 0,
    });
  }

  // ── Safe particles (float gently inside shield) ──
  function initSafeParticles() {
    safeParticles = [];
    const count = Math.max(10, Math.round(18 * (width / 1920)));
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * shieldRadius * 0.65;
      safeParticles.push({
        x: shieldCenter.x + Math.cos(angle) * dist,
        y: shieldCenter.y + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        radius: 1.5 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  // ── Floating lock icons (inside shield, slow drift) ──
  function initLocks() {
    floatingLocks = [];
    const count = Math.max(3, Math.round(5 * (width / 1920)));
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * shieldRadius * 0.5;
      floatingLocks.push({
        x: shieldCenter.x + Math.cos(angle) * dist,
        y: shieldCenter.y + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 0.08,
        vy: (Math.random() - 0.5) * 0.08,
        size: 8 + Math.random() * 6,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  function drawLock(x, y, size, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = `rgb(${GREEN.r},${GREEN.g},${GREEN.b})`;
    ctx.lineWidth = 1.2;
    ctx.lineJoin = 'round';
    // Shackle (arc)
    ctx.beginPath();
    ctx.arc(x, y - size * 0.2, size * 0.32, Math.PI, 0);
    ctx.stroke();
    // Body (rounded rect)
    const bw = size * 0.7;
    const bh = size * 0.5;
    const bx = x - bw / 2;
    const by = y;
    const cr = 2;
    ctx.beginPath();
    ctx.moveTo(bx + cr, by);
    ctx.lineTo(bx + bw - cr, by);
    ctx.arcTo(bx + bw, by, bx + bw, by + cr, cr);
    ctx.lineTo(bx + bw, by + bh - cr);
    ctx.arcTo(bx + bw, by + bh, bx + bw - cr, by + bh, cr);
    ctx.lineTo(bx + cr, by + bh);
    ctx.arcTo(bx, by + bh, bx, by + bh - cr, cr);
    ctx.lineTo(bx, by + cr);
    ctx.arcTo(bx, by, bx + cr, by, cr);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  // ── Hexagonal grid pattern (subtle, inside shield) ──
  function drawHexGrid(alpha) {
    const hexSize = 28;
    const rowH = hexSize * Math.sqrt(3);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = `rgb(${GREEN.r},${GREEN.g},${GREEN.b})`;
    ctx.lineWidth = 0.4;

    const startX = shieldCenter.x - shieldRadius;
    const endX = shieldCenter.x + shieldRadius;
    const startY = shieldCenter.y - shieldRadius;
    const endY = shieldCenter.y + shieldRadius;

    let row = 0;
    for (let y = startY; y < endY; y += rowH * 0.75) {
      const offset = (row % 2) * hexSize * 1.5;
      for (let x = startX + offset; x < endX; x += hexSize * 3) {
        if (!isInsideShield(x, y)) continue;
        ctx.beginPath();
        for (let a = 0; a < 6; a++) {
          const ang = (Math.PI / 3) * a - Math.PI / 6;
          const px = x + hexSize * Math.cos(ang);
          const py = y + hexSize * Math.sin(ang);
          if (a === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
      row++;
    }
    ctx.restore();
  }

  // ── Ripple effect when threat is blocked ──
  function addRipple(x, y) {
    ripples.push({ x, y, radius: 0, maxRadius: 30 + Math.random() * 20, life: 1 });
  }

  // ── Main draw loop ──
  function animate() {
    time += 0.008;
    ctx.clearRect(0, 0, width, height);

    const pulse = 0.5 + Math.sin(time * 1.2) * 0.15;

    // 1) Hex grid (very subtle)
    drawHexGrid(0.04 + Math.sin(time * 0.8) * 0.015);

    // 2) Shield glow (radial gradient)
    const grad = ctx.createRadialGradient(
      shieldCenter.x, shieldCenter.y, shieldRadius * 0.1,
      shieldCenter.x, shieldCenter.y, shieldRadius
    );
    grad.addColorStop(0, `rgba(${GREEN.r},${GREEN.g},${GREEN.b},${0.04 * pulse})`);
    grad.addColorStop(0.7, `rgba(${GREEN.r},${GREEN.g},${GREEN.b},${0.02 * pulse})`);
    grad.addColorStop(1, 'rgba(22,163,74,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // 3) Shield outline (pulsing)
    const shieldPts = getShieldPath(shieldCenter.x, shieldCenter.y, shieldRadius);
    ctx.save();
    ctx.globalAlpha = 0.08 + pulse * 0.06;
    traceShieldPath(shieldPts);
    ctx.strokeStyle = `rgb(${GREEN.r},${GREEN.g},${GREEN.b})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Inner shield line
    const innerPts = getShieldPath(shieldCenter.x, shieldCenter.y, shieldRadius * 0.92);
    ctx.save();
    ctx.globalAlpha = 0.04 + pulse * 0.02;
    traceShieldPath(innerPts);
    ctx.strokeStyle = `rgb(${GREEN.r},${GREEN.g},${GREEN.b})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 8]);
    ctx.stroke();
    ctx.restore();

    // 4) Safe particles inside shield
    for (const p of safeParticles) {
      p.x += p.vx;
      p.y += p.vy;
      // Soft boundary — bounce back toward center
      const dx = p.x - shieldCenter.x;
      const dy = p.y - shieldCenter.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > shieldRadius * 0.7) {
        p.vx -= dx * 0.0003;
        p.vy -= dy * 0.0003;
      }
      const a = 0.15 + Math.sin(time * 2 + p.phase) * 0.08;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${GREEN.r},${GREEN.g},${GREEN.b},${a})`;
      ctx.fill();

      // Soft glow
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${GREEN.r},${GREEN.g},${GREEN.b},${a * 0.1})`;
      ctx.fill();
    }

    // 5) Floating locks
    for (const lock of floatingLocks) {
      lock.x += lock.vx;
      lock.y += lock.vy;
      const dx = lock.x - shieldCenter.x;
      const dy = lock.y - shieldCenter.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > shieldRadius * 0.55) {
        lock.vx -= dx * 0.0002;
        lock.vy -= dy * 0.0002;
      }
      const a = 0.1 + Math.sin(time * 1.5 + lock.phase) * 0.05;
      drawLock(lock.x, lock.y, lock.size, a);
    }

    // 6) Threats approaching from outside
    if (Math.random() < 0.025) spawnThreat();

    for (let i = threats.length - 1; i >= 0; i--) {
      const t = threats[i];

      if (!t.blocked) {
        t.x += t.vx;
        t.y += t.vy;

        // Check if hit shield boundary
        const dx = t.x - shieldCenter.x;
        const dy = t.y - shieldCenter.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < shieldRadius * 0.9) {
          t.blocked = true;
          t.blockedTime = 0;
          addRipple(t.x, t.y);
        }

        // Draw threat (red/amber)
        const color = Math.random() > 0.5 ? RED : AMBER;
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},0.5)`;
        ctx.fill();
        // Trail
        ctx.beginPath();
        ctx.arc(t.x - t.vx * 3, t.y - t.vy * 3, t.radius * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},0.2)`;
        ctx.fill();
      } else {
        // Blocked: flash green then fade
        t.blockedTime += 0.02;
        const fade = 1 - t.blockedTime;
        if (fade <= 0) { threats.splice(i, 1); continue; }

        ctx.beginPath();
        ctx.arc(t.x, t.y, t.radius * (1 + t.blockedTime * 2), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${GREEN.r},${GREEN.g},${GREEN.b},${fade * 0.6})`;
        ctx.fill();
      }
    }

    // 7) Ripples at block points
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.radius += 1.2;
      r.life -= 0.025;
      if (r.life <= 0) { ripples.splice(i, 1); continue; }

      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${GREEN.r},${GREEN.g},${GREEN.b},${r.life * 0.3})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // 8) Scanning beam (rotates slowly around shield)
    const beamAngle = time * 0.6;
    const beamX = shieldCenter.x + Math.cos(beamAngle) * shieldRadius * 0.85;
    const beamY = shieldCenter.y + Math.sin(beamAngle) * shieldRadius * 0.85;
    const beamGrad = ctx.createRadialGradient(beamX, beamY, 0, beamX, beamY, 40);
    beamGrad.addColorStop(0, `rgba(${GREEN.r},${GREEN.g},${GREEN.b},0.12)`);
    beamGrad.addColorStop(1, 'rgba(22,163,74,0)');
    ctx.fillStyle = beamGrad;
    ctx.fillRect(beamX - 40, beamY - 40, 80, 80);

    requestAnimationFrame(animate);
  }

  resize();
  initSafeParticles();
  initLocks();
  animate();

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resize();
      initSafeParticles();
      initLocks();
      threats = [];
      ripples = [];
    }, 200);
  });
})();
