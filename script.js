/* ==========================================================
   Student Mental Health Score Predictor — script.js
   ========================================================== */

'use strict';

/* ---------------- Config (edit here) ---------------- */
const CONFIG = {
  API_BASE: 'http://127.0.0.1:8000', // your FastAPI server
  SCORE_MIN: 0,                      // gauge scale
  SCORE_MAX: 10,
  TIMEOUT_MS: 15000,                 // give up on the API after this long
  MIN_LOADING_MS: 800                // keep loader visible at least this long
};

/* Score bands: first band whose `max` is above the score wins. */
const BANDS = [
  { max: 5.5,      label: 'At Risk',   color: '#ff5468', tip: 'Below average score (< 5.5). Small adjustments such as prioritizing sleep, regular physical activity, and reducing high screen time can significantly improve mental well-being.' },
  { max: 7.5,      label: 'Moderate',  color: '#ffd84a', tip: 'A balanced score (5.5 – 7.5). Healthy daily routines, balanced study hours, and stress management can help push your score into the excellent zone.' },
  { max: Infinity, label: 'Excellent', color: '#2fe6a6', tip: 'Excellent score (> 7.5)! Your habits, sleep schedule, and lifestyle balance indicate very strong mental health.' }
];

const COUNTRIES = [
  'India', 'USA', 'UK', 'Canada', 'Australia', 'Germany', 'France', 'Mexico', 'Turkey', 'Japan',
  'China', 'South Korea', 'Brazil', 'Italy', 'Spain', 'Russia', 'Netherlands', 'Sweden', 'Norway',
  'Denmark', 'Ireland', 'Switzerland', 'Singapore', 'Malaysia', 'Indonesia', 'Thailand', 'Vietnam',
  'Philippines', 'Pakistan', 'Bangladesh', 'Sri Lanka', 'Nepal', 'UAE', 'Saudi Arabia', 'Egypt',
  'Nigeria', 'South Africa', 'Kenya', 'Argentina', 'Chile', 'Colombia', 'Poland', 'Ukraine',
  'Portugal', 'Greece', 'New Zealand', 'Israel', 'Other'
];

/* ---------------- DOM ---------------- */
const form        = document.getElementById('predictForm');
const submitBtn   = document.getElementById('submitBtn');
const resetBtn    = document.getElementById('resetBtn');
const retryBtn    = document.getElementById('retryBtn');
const resultCard  = document.getElementById('resultCard');
const gaugeArc    = document.getElementById('gaugeArc');
const needle      = document.getElementById('needle');
const scoreValue  = document.getElementById('scoreValue');
const verdictEl   = document.getElementById('verdict');
const tipEl       = document.getElementById('tip');
const errorTitle  = document.getElementById('errorTitle');
const errorMsg    = document.getElementById('errorMessage');
const errorList   = document.getElementById('errorList');
const toasts      = document.getElementById('toasts');
const apiStatus   = document.getElementById('apiStatus');
const apiStatusTx = document.getElementById('apiStatusText');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* ==========================================================
   1. Speedometer
   ========================================================== */
const GAUGE = { cx: 160, cy: 170 };
let countFrame = null;

function buildTicks() {
  const g = document.getElementById('gaugeTicks');
  const NS = 'http://www.w3.org/2000/svg';
  const steps = CONFIG.SCORE_MAX - CONFIG.SCORE_MIN;

  for (let i = 0; i <= steps; i++) {
    const angle = Math.PI - (i / steps) * Math.PI; // 180° → 0°
    const cos = Math.cos(angle), sin = Math.sin(angle);

    const tick = document.createElementNS(NS, 'line');
    tick.setAttribute('class', 'tick');
    tick.setAttribute('x1', GAUGE.cx + cos * 134);
    tick.setAttribute('y1', GAUGE.cy - sin * 134);
    tick.setAttribute('x2', GAUGE.cx + cos * 140);
    tick.setAttribute('y2', GAUGE.cy - sin * 140);
    g.appendChild(tick);

    const label = document.createElementNS(NS, 'text');
    label.setAttribute('class', 'tick-label');
    label.setAttribute('x', GAUGE.cx + cos * 152);
    label.setAttribute('y', GAUGE.cy - sin * 152);
    label.textContent = CONFIG.SCORE_MIN + i;
    g.appendChild(label);
  }
}

function bandFor(score) {
  return BANDS.find(b => score < b.max);
}

function setGauge(score) {
  const pct = clamp((score - CONFIG.SCORE_MIN) / (CONFIG.SCORE_MAX - CONFIG.SCORE_MIN), 0, 1);
  gaugeArc.style.strokeDashoffset = 100 - pct * 100;
  needle.style.transform = `rotate(${-90 + pct * 180}deg)`;
}

function countUp(to, duration = 1500) {
  cancelAnimationFrame(countFrame);
  const start = performance.now();
  const tick = now => {
    const t = clamp((now - start) / duration, 0, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    scoreValue.textContent = (to * eased).toFixed(2);
    if (t < 1) countFrame = requestAnimationFrame(tick);
  };
  countFrame = requestAnimationFrame(tick);
}

function resetGauge() {
  cancelAnimationFrame(countFrame);
  gaugeArc.style.strokeDashoffset = 100;
  needle.style.transform = 'rotate(-90deg)';
  scoreValue.textContent = '–';
  resultCard.style.removeProperty('--band');
}

/* ==========================================================
   2. UI state helpers
   ========================================================== */
function setState(state) {
  resultCard.dataset.state = state;
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.classList.toggle('is-loading', isLoading);
  submitBtn.querySelector('.btn-text').textContent = isLoading ? 'Predicting…' : 'Predict score';
  if (isLoading) setState('loading');
}

function showResult(score) {
  const band = bandFor(score);
  resultCard.style.setProperty('--band', band.color);
  verdictEl.textContent = band.label;
  tipEl.textContent = band.tip;
  setState('result');
  setGauge(score);
  countUp(score);
}

function showError(title, message, details = []) {
  resetGauge();
  errorTitle.textContent = title;
  errorMsg.textContent = message;
  errorList.replaceChildren(...details.map(text => {
    const li = document.createElement('li');
    li.textContent = text;
    return li;
  }));
  setState('error');
}

function toast(message, ms = 5000) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  toasts.appendChild(el);
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 300);
  }, ms);
}

/* ==========================================================
   3. Form: sliders, errors, reading values
   ========================================================== */
function syncRange(input) {
  const pct = ((input.value - input.min) / (input.max - input.min)) * 100;
  input.style.setProperty('--pct', pct + '%');
  const out = input.closest('.field').querySelector('output');
  if (out) out.textContent = `${Number(input.value)} h`;
}

function setFieldError(name, message) {
  const holder = form.querySelector(`[data-error-for="${name}"]`);
  if (!holder) return;
  holder.textContent = message;
  holder.closest('.field').classList.toggle('has-error', Boolean(message));
}

function clearErrors() {
  form.querySelectorAll('.error').forEach(e => { e.textContent = ''; });
  form.querySelectorAll('.field.has-error').forEach(f => f.classList.remove('has-error'));
}

function readForm() {
  const d = new FormData(form);
  const num = k => (d.get(k) === null || d.get(k) === '' ? null : Number(d.get(k)));
  const str = k => (d.get(k) ?? '').toString().trim();

  return {
    gender: str('gender'),
    age: num('age'),
    country: str('country'),
    academic_level: str('academic_level'),
    most_used_platform: str('most_used_platform'),
    purpose_of_use: str('purpose_of_use'),
    avg_daily_usage_hours: num('avg_daily_usage_hours'),
    daily_unlocks: num('daily_unlocks'),
    study_hours: num('study_hours'),
    physical_activity_hours: num('physical_activity_hours'),
    sleep_hours_per_night: num('sleep_hours_per_night'),
    stress_level: str('stress_level')
  };
}

/* Mirrors the rules in the Pydantic StudentData model. */
function validate(p) {
  const errors = {};

  if (!p.gender) errors.gender = 'Choose a gender.';

  if (p.age === null) errors.age = 'Enter the student\'s age.';
  else if (!Number.isInteger(p.age)) errors.age = 'Age must be a whole number.';
  else if (p.age < 10 || p.age > 100) errors.age = 'Age must be between 10 and 100.';

  if (!p.country) errors.country = 'Enter a country.';
  if (!p.academic_level) errors.academic_level = 'Select an academic level.';
  if (!p.most_used_platform) errors.most_used_platform = 'Select a platform.';
  if (!p.purpose_of_use) errors.purpose_of_use = 'Select a purpose.';

  if (p.daily_unlocks === null) errors.daily_unlocks = 'Enter the number of unlocks per day.';
  else if (!Number.isInteger(p.daily_unlocks)) errors.daily_unlocks = 'Unlocks must be a whole number.';
  else if (p.daily_unlocks < 0) errors.daily_unlocks = 'Unlocks cannot be negative.';

  if (!p.stress_level) errors.stress_level = 'Choose a stress level.';

  ['avg_daily_usage_hours', 'study_hours', 'physical_activity_hours', 'sleep_hours_per_night'].forEach(k => {
    if (p[k] === null || p[k] < 0 || p[k] > 24) errors[k] = 'Must be between 0 and 24 hours.';
  });

  if (!errors.sleep_hours_per_night && p.sleep_hours_per_night + p.study_hours + p.physical_activity_hours > 24) {
    errors.sleep_hours_per_night = 'Sleep, study and activity together exceed 24 hours.';
  }

  return errors;
}

/* ==========================================================
   4. API
   ========================================================== */
class ApiError extends Error {
  constructor(status, body) {
    super(`API error ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function callApi(path, options = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CONFIG.TIMEOUT_MS);
  try {
    return await fetch(`${CONFIG.API_BASE}${path}`, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function requestPrediction(payload) {
  const res = await callApi('/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  let body = null;
  try { body = await res.json(); } catch { /* non-JSON response */ }

  if (!res.ok) throw new ApiError(res.status, body);

  const score = body && Number(body.predicted_mental_health_score);
  if (!Number.isFinite(score)) throw new Error('bad-response');
  return score;
}

/* Turns FastAPI 422 details into { field: message } */
function parseValidationDetail(detail) {
  const fields = {};
  const general = [];
  if (!Array.isArray(detail)) return { fields, general };

  detail.forEach(item => {
    const loc = Array.isArray(item.loc) ? item.loc : [];
    const name = loc[loc.length - 1];
    const msg = item.msg || 'Invalid value';
    if (typeof name === 'string' && form.querySelector(`[data-error-for="${name}"]`)) {
      fields[name] = msg;
    } else {
      general.push(msg);
    }
  });
  return { fields, general };
}

async function checkApi() {
  apiStatus.dataset.state = 'checking';
  apiStatusTx.textContent = 'Checking API…';
  try {
    const res = await callApi('/');
    if (!res.ok) throw new Error();
    apiStatus.dataset.state = 'online';
    apiStatusTx.textContent = 'API online';
  } catch {
    apiStatus.dataset.state = 'offline';
    apiStatusTx.textContent = 'API offline';
  }
}

/* ==========================================================
   5. Submit
   ========================================================== */
async function handleSubmit(event) {
  event.preventDefault();
  clearErrors();

  const payload = readForm();
  const errors = validate(payload);
  const names = Object.keys(errors);

  if (names.length) {
    names.forEach(n => setFieldError(n, errors[n]));
    const first = form.querySelector(`[data-field="${names[0]}"]`);
    first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast(`Please fix ${names.length} field${names.length > 1 ? 's' : ''} and try again.`);
    return;
  }

  setLoading(true);
  resetGauge();

  try {
    const [score] = await Promise.all([requestPrediction(payload), sleep(CONFIG.MIN_LOADING_MS)]);
    setLoading(false);
    showResult(score);
  } catch (err) {
    await sleep(300);
    setLoading(false);
    handleFailure(err);
  }
}

function handleFailure(err) {
  // Server rejected the input (FastAPI / Pydantic validation)
  if (err instanceof ApiError && err.status === 422) {
    const { fields, general } = parseValidationDetail(err.body?.detail);
    Object.entries(fields).forEach(([k, v]) => setFieldError(k, v));
    const list = [...Object.entries(fields).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`), ...general];
    showError('Some inputs were rejected', 'The server could not accept these values. Please correct them and try again.', list);
    toast('The server rejected some inputs.');
    return;
  }

  // Server-side failure (500 etc.)
  if (err instanceof ApiError) {
    const detail = typeof err.body?.detail === 'string' ? err.body.detail : '';
    showError(
      `Server error (${err.status})`,
      'The prediction failed on the server. Check the uvicorn terminal for the traceback.',
      detail ? [detail] : []
    );
    toast(`Server error ${err.status}.`);
    return;
  }

  // Timeout
  if (err.name === 'AbortError') {
    showError('The request timed out', `No response from ${CONFIG.API_BASE} within ${CONFIG.TIMEOUT_MS / 1000} seconds. Try again.`);
    toast('Request timed out.');
    checkApi();
    return;
  }

  // Unexpected payload
  if (err.message === 'bad-response') {
    showError('Unexpected response', 'The API replied, but the response did not contain a valid score.');
    toast('Unexpected response from the API.');
    return;
  }

  // Network failure / server not running / CORS
  showError(
    'Cannot reach the API',
    `Nothing is answering at ${CONFIG.API_BASE}. Start the backend with: uvicorn main:app --port 8000`
  );
  toast('Could not connect to the API.');
  checkApi();
}

function handleReset() {
  form.reset();
  clearErrors();
  form.querySelectorAll('input[type="range"]').forEach(syncRange);
  resetGauge();
  setState('idle');
}

/* ==========================================================
   6. Background: drifting neural network
   ========================================================== */
function initBackground() {
  const canvas = document.getElementById('bg');
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LINK_DIST = 150;
  let w, h, nodes = [];

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.round(clamp((w * h) / 15000, 30, 100));
    nodes = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.28,
      vy: (Math.random() - 0.5) * 0.28,
      r: 1 + Math.random() * 1.8,
      hue: Math.random() < 0.5 ? '60, 230, 195' : '143, 123, 255'
    }));
    if (reduceMotion) draw();
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);

    for (const n of nodes) {
      if (!reduceMotion) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < -10) n.x = w + 10; else if (n.x > w + 10) n.x = -10;
        if (n.y < -10) n.y = h + 10; else if (n.y > h + 10) n.y = -10;
      }
    }

    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.hypot(dx, dy);
        if (dist < LINK_DIST) {
          ctx.strokeStyle = `rgba(130, 190, 255, ${(1 - dist / LINK_DIST) * 0.22})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    for (const n of nodes) {
      ctx.fillStyle = `rgba(${n.hue}, 0.85)`;
      ctx.shadowColor = `rgba(${n.hue}, 0.9)`;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    if (!reduceMotion) requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  resize();
  if (!reduceMotion) draw();
}

/* ==========================================================
   7. Init
   ========================================================== */
function init() {
  // Country suggestions
  const list = document.getElementById('countryList');
  COUNTRIES.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    list.appendChild(opt);
  });

  buildTicks();
  resetGauge();

  // Sliders
  form.querySelectorAll('input[type="range"]').forEach(r => {
    syncRange(r);
    r.addEventListener('input', () => { syncRange(r); setFieldError(r.name, ''); });
  });

  // Clear a field's error as soon as the user edits it
  form.addEventListener('input', e => e.target.name && setFieldError(e.target.name, ''));
  form.addEventListener('change', e => e.target.name && setFieldError(e.target.name, ''));

  form.addEventListener('submit', handleSubmit);
  resetBtn.addEventListener('click', handleReset);
  retryBtn.addEventListener('click', () => { setState('idle'); form.requestSubmit(); });

  initBackground();
  checkApi();
}

document.addEventListener('DOMContentLoaded', init);
