/* =============================================================
   Performance Tools — shared runtime
   Exposes window.Tools. No dependencies. Single IIFE, no build.
   Load in <head> (synchronously) so theme is applied pre-paint.
   ============================================================= */
(function () {
  'use strict';

  const Tools = {};

  /* ---------------------------------------------------------
     Tools.theme — three-state cycle (light → dark → system)
     --------------------------------------------------------- */
  const THEME_KEY = 'theme';
  const THEMES = ['light', 'dark', 'system'];
  const ICONS  = { light: '☀', dark: '☾', system: '◐' };
  const mql    = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: light)')
    : null;

  function getStored() {
    const v = (typeof localStorage !== 'undefined') && localStorage.getItem(THEME_KEY);
    return THEMES.indexOf(v) >= 0 ? v : 'dark';
  }

  function resolved(setting) {
    if (setting !== 'system') return setting;
    return (mql && mql.matches) ? 'light' : 'dark';
  }

  function apply(setting) {
    const html = document.documentElement;
    html.classList.remove('light', 'dark');
    html.classList.add(resolved(setting));
    try { localStorage.setItem(THEME_KEY, setting); } catch (e) { /* ignore */ }
    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
      btn.dataset.themeState = setting;
      const iconEl = btn.querySelector('[data-theme-icon]');
      if (iconEl) iconEl.textContent = ICONS[setting];
      btn.setAttribute('aria-label', 'theme: ' + setting + ' (click to cycle)');
      btn.title = 'theme: ' + setting;
    });
  }

  function cycle() {
    const current = getStored();
    const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
    apply(next);
  }

  function attach() {
    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
      if (btn.__themeWired) return;
      btn.__themeWired = true;
      btn.addEventListener('click', cycle);
    });
    apply(getStored());
  }

  if (mql && typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', function () {
      if (getStored() === 'system') apply('system');
    });
  }

  // Apply immediately so there is no flash-of-wrong-theme
  apply(getStored());

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attach);
  } else {
    attach();
  }

  Tools.theme = { apply: apply, cycle: cycle, get: getStored, attach: attach };

  /* ---------------------------------------------------------
     Tools.fmt — number formatters
     --------------------------------------------------------- */
  const fmt = {};

  fmt.fixed = function (n, digits) {
    if (!isFinite(n)) return '—';
    return Number(n).toFixed(digits == null ? 2 : digits);
  };

  fmt.int = function (n) {
    if (!isFinite(n)) return '—';
    return Math.round(n).toString();
  };

  fmt.pct = function (n, digits) {
    if (!isFinite(n)) return '—';
    return fmt.fixed(n * 100, digits == null ? 1 : digits) + '%';
  };

  fmt.pace = function (totalMinutes) {
    if (!isFinite(totalMinutes) || totalMinutes <= 0) return '—';
    const mins = Math.floor(totalMinutes);
    const secs = Math.round((totalMinutes - mins) * 60);
    return mins + ':' + String(secs).padStart(2, '0');
  };

  fmt.duration = function (seconds) {
    if (!isFinite(seconds) || seconds < 0) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds - m * 60;
    return m > 0 ? m + ':' + s.toFixed(2).padStart(5, '0') : s.toFixed(2) + 's';
  };

  Tools.fmt = fmt;

  /* ---------------------------------------------------------
     Tools.csv — parse, dropzone, download
     --------------------------------------------------------- */
  const csv = {};

  // Minimal RFC-4180-ish parser. Handles quoted fields, embedded
  // commas/newlines, \r\n or \n. Auto-detects delimiter (, ; \t).
  csv.parse = function (text) {
    if (!text) return { columns: [], rows: [] };
    const clean = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const firstLine = clean.split('\n', 1)[0];
    const delim = (function () {
      const counts = { ',': 0, ';': 0, '\t': 0 };
      let inQ = false;
      for (let i = 0; i < firstLine.length; i++) {
        const c = firstLine[i];
        if (c === '"') inQ = !inQ;
        else if (!inQ && counts.hasOwnProperty(c)) counts[c]++;
      }
      let best = ',', bestN = counts[','];
      if (counts[';']  > bestN) { best = ';';  bestN = counts[';'];  }
      if (counts['\t'] > bestN) { best = '\t'; bestN = counts['\t']; }
      return best;
    })();

    const rows = [];
    let field = '';
    let record = [];
    let inQ = false;

    for (let i = 0; i < clean.length; i++) {
      const c = clean[i];
      if (inQ) {
        if (c === '"') {
          if (clean[i + 1] === '"') { field += '"'; i++; }
          else { inQ = false; }
        } else {
          field += c;
        }
      } else {
        if (c === '"') {
          inQ = true;
        } else if (c === delim) {
          record.push(field); field = '';
        } else if (c === '\n') {
          record.push(field); field = '';
          rows.push(record); record = [];
        } else {
          field += c;
        }
      }
    }
    if (field.length > 0 || record.length > 0) {
      record.push(field);
      rows.push(record);
    }

    // Drop trailing empty rows
    while (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') {
      rows.pop();
    }
    if (rows.length === 0) return { columns: [], rows: [] };

    const columns = rows[0].map(function (h) { return String(h).trim(); });
    const data = rows.slice(1).map(function (r) {
      const obj = {};
      columns.forEach(function (col, idx) { obj[col] = r[idx] != null ? r[idx] : ''; });
      return obj;
    });
    return { columns: columns, rows: data };
  };

  csv.toText = function (data, opts) {
    opts = opts || {};
    const delim = opts.delimiter || ',';
    let columns, rows;

    if (data && Array.isArray(data.columns) && Array.isArray(data.rows)) {
      columns = data.columns;
      rows = data.rows.map(function (r) {
        return columns.map(function (c) { return r[c] == null ? '' : r[c]; });
      });
    } else if (Array.isArray(data)) {
      const set = {};
      data.forEach(function (o) { Object.keys(o).forEach(function (k) { set[k] = true; }); });
      columns = Object.keys(set);
      rows = data.map(function (r) {
        return columns.map(function (c) { return r[c] == null ? '' : r[c]; });
      });
    } else {
      columns = []; rows = [];
    }

    const escape = function (v) {
      const s = String(v);
      if (/[",\n\r]/.test(s) || s.indexOf(delim) >= 0) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };

    const lines = [columns.map(escape).join(delim)];
    rows.forEach(function (r) { lines.push(r.map(escape).join(delim)); });
    return lines.join('\n');
  };

  csv.download = function (filename, data) {
    const text = csv.toText(data);
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  };

  csv.dropzone = function (el, onParsed) {
    if (!el) return;
    const handleText = function (text) {
      try { onParsed(csv.parse(text)); } catch (e) { onParsed(null, e); }
    };
    el.addEventListener('paste', function (ev) {
      const text = ev.clipboardData && ev.clipboardData.getData('text');
      if (text) { ev.preventDefault(); handleText(text); }
    });
    el.addEventListener('dragover', function (ev) {
      ev.preventDefault();
      el.classList.add('is-dragging');
    });
    el.addEventListener('dragleave', function () {
      el.classList.remove('is-dragging');
    });
    el.addEventListener('drop', function (ev) {
      ev.preventDefault();
      el.classList.remove('is-dragging');
      const file = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function (e) { handleText(String(e.target.result)); };
      reader.readAsText(file);
    });
  };

  Tools.csv = csv;

  /* ---------------------------------------------------------
     Tools.stats — small numeric helpers
     --------------------------------------------------------- */
  const stats = {};

  stats.mean = function (xs) {
    if (!xs.length) return NaN;
    let s = 0;
    for (let i = 0; i < xs.length; i++) s += xs[i];
    return s / xs.length;
  };

  stats.sd = function (xs, sample) {
    if (xs.length < 2) return NaN;
    const m = stats.mean(xs);
    let s = 0;
    for (let i = 0; i < xs.length; i++) s += (xs[i] - m) * (xs[i] - m);
    return Math.sqrt(s / (sample === false ? xs.length : xs.length - 1));
  };

  stats.linreg = function (xs, ys) {
    const n = Math.min(xs.length, ys.length);
    if (n < 2) return { slope: NaN, intercept: NaN, r2: NaN };
    let sx = 0, sy = 0;
    for (let i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; }
    const mx = sx / n, my = sy / n;
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < n; i++) {
      const ex = xs[i] - mx;
      const ey = ys[i] - my;
      num += ex * ey;
      dx += ex * ex;
      dy += ey * ey;
    }
    const slope = dx === 0 ? NaN : num / dx;
    const intercept = my - slope * mx;
    const r2 = (dx === 0 || dy === 0) ? NaN : (num * num) / (dx * dy);
    return { slope: slope, intercept: intercept, r2: r2 };
  };

  stats.ewma = function (xs, lambda, seed) {
    if (!xs.length) return [];
    const out = new Array(xs.length);
    let prev = seed == null ? xs[0] : seed;
    for (let i = 0; i < xs.length; i++) {
      const v = isFinite(xs[i]) ? xs[i] : 0;
      prev = lambda * v + (1 - lambda) * prev;
      out[i] = prev;
    }
    return out;
  };

  stats.rollingMean = function (xs, window) {
    const out = new Array(xs.length).fill(NaN);
    for (let i = 0; i < xs.length; i++) {
      const start = Math.max(0, i - window + 1);
      let s = 0, n = 0;
      for (let j = start; j <= i; j++) {
        if (isFinite(xs[j])) { s += xs[j]; n++; }
      }
      out[i] = n ? s / n : NaN;
    }
    return out;
  };

  stats.rollingSd = function (xs, window) {
    const out = new Array(xs.length).fill(NaN);
    for (let i = 0; i < xs.length; i++) {
      const start = Math.max(0, i - window + 1);
      const slice = [];
      for (let j = start; j <= i; j++) {
        if (isFinite(xs[j])) slice.push(xs[j]);
      }
      out[i] = slice.length >= 2 ? stats.sd(slice, true) : NaN;
    }
    return out;
  };

  Tools.stats = stats;

  /* ---------------------------------------------------------
     Tools.chart — minimal hand-rolled SVG charts
     --------------------------------------------------------- */
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function svg(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    return el;
  }

  function mkScale(domain, range) {
    const d0 = domain[0], d1 = domain[1], r0 = range[0], r1 = range[1];
    const span = d1 - d0 || 1;
    return function (v) { return r0 + (v - d0) * (r1 - r0) / span; };
  }

  function niceTicks(min, max, count) {
    if (min === max) return [min];
    const span = max - min;
    const step0 = span / Math.max(1, count);
    const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const norm = step0 / mag;
    const step = mag * (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10);
    const start = Math.ceil(min / step) * step;
    const out = [];
    for (let v = start; v <= max + 1e-9; v += step) {
      out.push(Number(v.toPrecision(10)));
    }
    return out;
  }

  function clearSvg(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function ensureSvg(container) {
    let root = container.querySelector('svg');
    if (!root) { root = svg('svg'); container.appendChild(root); }
    clearSvg(root);
    return root;
  }

  function viewport(container) {
    const r = container.getBoundingClientRect();
    const w = Math.max(280, r.width || 560);
    const h = Math.max(160, r.height || 315);
    return { w: w, h: h };
  }

  const chart = {};

  /* Line chart
     series: array of { x: number[], y: number[], dashed?: bool, color?: string, label?: string }
     opts:
       xLabel, yLabel (strings)
       bands: [{ y0, y1, variant }]    variant: 'warn' | 'danger' | default accent
       yDomain, xDomain (optional override)
  */
  chart.line = function (container, series, opts) {
    opts = opts || {};
    const vp = viewport(container);
    const pad = { l: 44, r: 16, t: 12, b: 30 };
    const root = ensureSvg(container);
    root.setAttribute('viewBox', '0 0 ' + vp.w + ' ' + vp.h);
    root.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    const allX = [], allY = [];
    series.forEach(function (s) {
      for (let i = 0; i < s.x.length; i++) if (isFinite(s.x[i])) allX.push(s.x[i]);
      for (let i = 0; i < s.y.length; i++) if (isFinite(s.y[i])) allY.push(s.y[i]);
    });
    if (opts.bands) {
      opts.bands.forEach(function (b) {
        if (isFinite(b.y0)) allY.push(b.y0);
        if (isFinite(b.y1)) allY.push(b.y1);
      });
    }
    if (!allX.length || !allY.length) return root;

    const xDom = opts.xDomain || [Math.min.apply(null, allX), Math.max.apply(null, allX)];
    const yMin = Math.min.apply(null, allY);
    const yMax = Math.max.apply(null, allY);
    const yPad = (yMax - yMin) * 0.08 || 1;
    const yDom = opts.yDomain || [yMin - yPad, yMax + yPad];

    const sx = mkScale(xDom, [pad.l, vp.w - pad.r]);
    const sy = mkScale(yDom, [vp.h - pad.b, pad.t]);

    // bands
    (opts.bands || []).forEach(function (b) {
      const y0 = sy(Math.max(b.y0, yDom[0]));
      const y1 = sy(Math.min(b.y1, yDom[1]));
      const cls = 'chart-band' + (b.variant ? ' chart-band--' + b.variant : '');
      root.appendChild(svg('rect', {
        x: pad.l, y: Math.min(y0, y1),
        width: vp.w - pad.l - pad.r, height: Math.abs(y0 - y1),
        'class': cls
      }));
    });

    // y gridlines + ticks
    const yTicks = niceTicks(yDom[0], yDom[1], 4);
    yTicks.forEach(function (t) {
      const y = sy(t);
      root.appendChild(svg('line', {
        x1: pad.l, x2: vp.w - pad.r, y1: y, y2: y, 'class': 'chart-grid'
      }));
      const label = svg('text', {
        x: pad.l - 6, y: y + 3, 'text-anchor': 'end', 'class': 'chart-label'
      });
      label.textContent = Tools.fmt.fixed(t, Math.abs(t) >= 100 ? 0 : 2);
      root.appendChild(label);
    });

    // x ticks
    const xTicks = niceTicks(xDom[0], xDom[1], Math.min(6, Math.floor(vp.w / 80)));
    xTicks.forEach(function (t) {
      const x = sx(t);
      const label = svg('text', {
        x: x, y: vp.h - pad.b + 14, 'text-anchor': 'middle', 'class': 'chart-label'
      });
      label.textContent = opts.xTickFmt ? opts.xTickFmt(t) : Tools.fmt.fixed(t, Math.abs(t) >= 100 ? 0 : 1);
      root.appendChild(label);
    });

    // axes
    root.appendChild(svg('line', {
      x1: pad.l, x2: pad.l, y1: pad.t, y2: vp.h - pad.b, 'class': 'chart-axis'
    }));
    root.appendChild(svg('line', {
      x1: pad.l, x2: vp.w - pad.r, y1: vp.h - pad.b, y2: vp.h - pad.b, 'class': 'chart-axis'
    }));

    // series
    series.forEach(function (s, idx) {
      let d = '';
      for (let i = 0; i < s.x.length; i++) {
        const x = s.x[i], y = s.y[i];
        if (!isFinite(x) || !isFinite(y)) continue;
        d += (d ? ' L' : 'M') + sx(x) + ' ' + sy(y);
      }
      const path = svg('path', {
        d: d,
        'class': 'chart-series' + (s.dashed || idx > 0 ? ' chart-series--secondary' : '')
      });
      if (s.color) path.setAttribute('style', 'stroke:' + s.color);
      root.appendChild(path);
    });

    // axis labels
    if (opts.xLabel) {
      const t = svg('text', {
        x: (pad.l + vp.w - pad.r) / 2, y: vp.h - 4,
        'text-anchor': 'middle', 'class': 'chart-label'
      });
      t.textContent = opts.xLabel;
      root.appendChild(t);
    }
    if (opts.yLabel) {
      const t = svg('text', {
        x: 10, y: vp.h / 2,
        'text-anchor': 'middle', 'class': 'chart-label',
        transform: 'rotate(-90 10 ' + (vp.h / 2) + ')'
      });
      t.textContent = opts.yLabel;
      root.appendChild(t);
    }

    return root;
  };

  /* Scatter chart with optional regression line
     points: { x: number[], y: number[] }
     opts: xLabel, yLabel, regression: bool, yDomain, xDomain
  */
  chart.scatter = function (container, points, opts) {
    opts = opts || {};
    const vp = viewport(container);
    const pad = { l: 44, r: 16, t: 12, b: 30 };
    const root = ensureSvg(container);
    root.setAttribute('viewBox', '0 0 ' + vp.w + ' ' + vp.h);
    root.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    const xs = points.x.filter(isFinite);
    const ys = points.y.filter(isFinite);
    if (!xs.length || !ys.length) return root;

    const xDom = opts.xDomain || [Math.min.apply(null, xs), Math.max.apply(null, xs)];
    const yDom = opts.yDomain || (function () {
      const mn = Math.min.apply(null, ys), mx = Math.max.apply(null, ys);
      const p = (mx - mn) * 0.1 || 1;
      return [mn - p, mx + p];
    })();
    const xPad = (xDom[1] - xDom[0]) * 0.05 || 1;
    const xDomP = [xDom[0] - xPad, xDom[1] + xPad];

    const sx = mkScale(xDomP, [pad.l, vp.w - pad.r]);
    const sy = mkScale(yDom, [vp.h - pad.b, pad.t]);

    // gridlines + y ticks
    const yTicks = niceTicks(yDom[0], yDom[1], 4);
    yTicks.forEach(function (t) {
      const y = sy(t);
      root.appendChild(svg('line', {
        x1: pad.l, x2: vp.w - pad.r, y1: y, y2: y, 'class': 'chart-grid'
      }));
      const label = svg('text', {
        x: pad.l - 6, y: y + 3, 'text-anchor': 'end', 'class': 'chart-label'
      });
      label.textContent = Tools.fmt.fixed(t, 2);
      root.appendChild(label);
    });
    const xTicks = niceTicks(xDomP[0], xDomP[1], 5);
    xTicks.forEach(function (t) {
      const x = sx(t);
      const label = svg('text', {
        x: x, y: vp.h - pad.b + 14, 'text-anchor': 'middle', 'class': 'chart-label'
      });
      label.textContent = Tools.fmt.fixed(t, Math.abs(t) >= 100 ? 0 : 1);
      root.appendChild(label);
    });

    // axes
    root.appendChild(svg('line', {
      x1: pad.l, x2: pad.l, y1: pad.t, y2: vp.h - pad.b, 'class': 'chart-axis'
    }));
    root.appendChild(svg('line', {
      x1: pad.l, x2: vp.w - pad.r, y1: vp.h - pad.b, y2: vp.h - pad.b, 'class': 'chart-axis'
    }));

    // regression line (drawn before points)
    if (opts.regression) {
      const fit = stats.linreg(points.x, points.y);
      if (isFinite(fit.slope)) {
        const y0 = fit.slope * xDomP[0] + fit.intercept;
        const y1 = fit.slope * xDomP[1] + fit.intercept;
        root.appendChild(svg('line', {
          x1: sx(xDomP[0]), y1: sy(y0),
          x2: sx(xDomP[1]), y2: sy(y1),
          'class': 'chart-series'
        }));
      }
    }

    // points
    const n = Math.min(points.x.length, points.y.length);
    for (let i = 0; i < n; i++) {
      if (!isFinite(points.x[i]) || !isFinite(points.y[i])) continue;
      root.appendChild(svg('circle', {
        cx: sx(points.x[i]), cy: sy(points.y[i]),
        r: 3.5, 'class': 'chart-dot'
      }));
    }

    if (opts.xLabel) {
      const t = svg('text', {
        x: (pad.l + vp.w - pad.r) / 2, y: vp.h - 4,
        'text-anchor': 'middle', 'class': 'chart-label'
      });
      t.textContent = opts.xLabel;
      root.appendChild(t);
    }
    if (opts.yLabel) {
      const t = svg('text', {
        x: 10, y: vp.h / 2,
        'text-anchor': 'middle', 'class': 'chart-label',
        transform: 'rotate(-90 10 ' + (vp.h / 2) + ')'
      });
      t.textContent = opts.yLabel;
      root.appendChild(t);
    }

    return root;
  };

  /* Radar chart
     axes: string[]
     values: number[]        (parallel to axes, scaled 0..max)
     opts: max (default 100), rings (default 4), comparison: number[] for second ring
  */
  chart.radar = function (container, axes, values, opts) {
    opts = opts || {};
    const max = opts.max || 100;
    const rings = opts.rings || 4;
    const vp = viewport(container);
    const root = ensureSvg(container);
    root.setAttribute('viewBox', '0 0 ' + vp.w + ' ' + vp.h);
    root.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    const cx = vp.w / 2, cy = vp.h / 2;
    const r  = Math.min(cx, cy) - 40;
    const n  = axes.length;
    if (n < 3) return root;

    const angleFor = function (i) { return (Math.PI * 2 * i) / n - Math.PI / 2; };
    const point = function (i, value) {
      const a = angleFor(i);
      const rad = (value / max) * r;
      return { x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad };
    };

    // rings
    for (let k = 1; k <= rings; k++) {
      let d = '';
      for (let i = 0; i < n; i++) {
        const p = point(i, (max / rings) * k);
        d += (i === 0 ? 'M' : 'L') + p.x + ' ' + p.y;
      }
      d += 'Z';
      root.appendChild(svg('path', { d: d, 'class': 'chart-grid' }));
    }

    // spokes + labels
    for (let i = 0; i < n; i++) {
      const outer = point(i, max);
      root.appendChild(svg('line', {
        x1: cx, y1: cy, x2: outer.x, y2: outer.y, 'class': 'chart-grid'
      }));
      const a = angleFor(i);
      const lx = cx + Math.cos(a) * (r + 14);
      const ly = cy + Math.sin(a) * (r + 14) + 3;
      const anchor = Math.abs(Math.cos(a)) < 0.3 ? 'middle' : (Math.cos(a) > 0 ? 'start' : 'end');
      const t = svg('text', { x: lx, y: ly, 'text-anchor': anchor, 'class': 'chart-label' });
      t.textContent = axes[i];
      root.appendChild(t);
    }

    const drawShape = function (vals, cls, dotted) {
      let d = '';
      for (let i = 0; i < n; i++) {
        const p = point(i, Math.max(0, Math.min(max, vals[i] || 0)));
        d += (i === 0 ? 'M' : 'L') + p.x + ' ' + p.y;
      }
      d += 'Z';
      const path = svg('path', { d: d, 'class': cls });
      if (dotted) path.setAttribute('stroke-dasharray', '3 3');
      root.appendChild(path);

      for (let i = 0; i < n; i++) {
        const p = point(i, Math.max(0, Math.min(max, vals[i] || 0)));
        root.appendChild(svg('circle', { cx: p.x, cy: p.y, r: 2.5, 'class': 'chart-dot' }));
      }
    };

    if (opts.comparison) drawShape(opts.comparison, 'chart-series--secondary', true);
    drawShape(values, 'chart-series');

    return root;
  };

  Tools.chart = chart;

  /* ---------------------------------------------------------
     Expose
     --------------------------------------------------------- */
  window.Tools = Tools;
})();
