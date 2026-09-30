import { AWARDS } from "./awards.js";

// ---------- Live day + date in navbar ----------
const navDay = document.getElementById("navDay");
const navDate = document.getElementById("navDate");
function updateDate() {
  const now = new Date();
  navDay.textContent = now.toLocaleDateString("en-IN", { weekday: "long" });
  navDate.textContent = now.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  navDate.dateTime = now.toISOString().slice(0, 10);
}
updateDate();
setInterval(updateDate, 30 * 1000); // rolls over automatically at midnight

// ---------- Populate award dropdown (from awards.js) ----------
const awardSelect = document.getElementById("award");
AWARDS.forEach(({ name }) => {
  const opt = document.createElement("option");
  opt.value = name;
  opt.textContent = name;
  awardSelect.appendChild(opt);
});

// ---------- Red toast popup ----------
const toast = document.getElementById("toast");
const toastText = document.getElementById("toastText");
let toastTimer;
function showToast(message) {
  toastText.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
}

// ---------- Validation ----------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Indian mobile: optional +91 / 91 / 0 prefix, then 10 digits starting 6-9
function isValidPhone(value) {
  const cleaned = value.replace(/[\s-]/g, "");
  return /^(?:\+91|91|0)?[6-9]\d{9}$/.test(cleaned);
}

const validators = {
  name: (v) => (v.trim() ? "" : "Name is required"),
  company: (v) => (v.trim() ? "" : "Company name is required"),
  email: (v) => {
    if (!v.trim()) return "Email is required";
    return EMAIL_RE.test(v.trim()) ? "" : "Please enter a valid email address";
  },
  phone: (v) => {
    if (!v.trim()) return "Phone number is required";
    return isValidPhone(v) ? "" : "Invalid number";
  },
  award: (v) => (AWARDS.some((a) => a.name === v) ? "" : "Please choose an award"),
};

function validateField(input) {
  const message = validators[input.name](input.value);
  const field = input.closest(".field");
  field.classList.toggle("is-invalid", !!message);
  field.querySelector(".error-msg").textContent = message;
  return message;
}

const form = document.getElementById("awardForm");
const inputs = Array.from(form.querySelectorAll("input, select"));

// Live re-validation once a field has been flagged
inputs.forEach((input) => {
  const evt = input.tagName === "SELECT" ? "change" : "input";
  input.addEventListener(evt, () => {
    if (input.closest(".field").classList.contains("is-invalid")) validateField(input);
  });
});

// Phone: only allow digits, +, space, hyphen; validate on blur with red popup
const phoneInput = document.getElementById("phone");
phoneInput.addEventListener("input", () => {
  phoneInput.value = phoneInput.value.replace(/[^\d+\s-]/g, "");
});
phoneInput.addEventListener("blur", () => {
  if (phoneInput.value.trim() && validateField(phoneInput)) {
    showToast("Invalid number! Please enter a valid 10-digit mobile number.");
  }
});

// ---------- Submit ----------
const modal = document.getElementById("modal");
const summary = document.getElementById("summary");

const submitBtn = form.querySelector('button[type="submit"]');
const submitBtnHtml = submitBtn.innerHTML;
function setSubmitting(on) {
  submitBtn.disabled = on;
  submitBtn.innerHTML = on ? "Submitting…" : submitBtnHtml;
}
submitBtn.disabled = false; // ready — the button starts disabled in index.html

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (submitBtn.disabled) return; // block double-submits

  const errors = inputs.map((input) => ({ input, msg: validateField(input) })).filter((r) => r.msg);

  if (errors.length) {
    const phoneError = errors.find((r) => r.input.name === "phone" && r.msg === "Invalid number");
    showToast(phoneError ? "Invalid number! Please enter a valid 10-digit mobile number." : "Please fill all required fields correctly.");
    errors[0].input.focus();
    return;
  }

  // Collect all field data
  const data = {
    name: form.name.value.trim(),
    company: form.company.value.trim(),
    email: form.email.value.trim(),
    phone: form.phone.value.replace(/[\s-]/g, ""),
    award: form.award.value,
  };

  toast.classList.remove("show");
  setSubmitting(true);

  // Save to Neon via the backend
  let result;
  try {
    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    result = await res.json().catch(() => ({ ok: false }));
    if (!res.ok || !result.ok) {
      // Show any field errors the server returned
      Object.entries(result.errors || {}).forEach(([field, msg]) => {
        const input = form.elements[field];
        if (!input) return;
        input.closest(".field").classList.add("is-invalid");
        input.closest(".field").querySelector(".error-msg").textContent = msg;
      });
      showToast(result.error || "Something went wrong. Please try again.");
      return;
    }
  } catch (_) {
    showToast("Network error — please check your connection and try again.");
    return;
  } finally {
    setSubmitting(false);
  }

  // Show summary of what was saved
  const labels = { name: "Name", company: "Company", email: "Email", phone: "Phone", award: "Award" };
  summary.innerHTML = "";
  Object.entries(labels).forEach(([key, label]) => {
    const row = summary.insertRow();
    const th = document.createElement("th");
    th.textContent = label;
    row.appendChild(th);
    row.insertCell().textContent = result.data[key];
  });
  modal.classList.add("show");
  startRedirect(result.data.award_link, result.data.award);
});

// ---------- Redirect bar → chosen award's page ----------
const REDIRECT_MS = 4000;
const redirectBar = document.getElementById("redirectBar");
const redirectCount = document.getElementById("redirectCount");
const redirectAward = document.getElementById("redirectAward");
const redirectNow = document.getElementById("redirectNow");
let redirectTimer, redirectFrame;

function startRedirect(url, awardName) {
  // The link comes from the server's award list; only ever leave for mcciapune.com.
  if (!/^https:\/\/mcciapune\.com\//.test(url || "")) return;
  redirectAward.textContent = awardName;
  redirectNow.href = url;

  const start = performance.now();
  const tick = (now) => {
    const elapsed = Math.min(now - start, REDIRECT_MS);
    redirectBar.style.transform = `scaleX(${elapsed / REDIRECT_MS})`;
    redirectCount.textContent = `${Math.ceil((REDIRECT_MS - elapsed) / 1000)}s`;
    if (elapsed < REDIRECT_MS) redirectFrame = requestAnimationFrame(tick);
  };
  redirectFrame = requestAnimationFrame(tick);
  // setTimeout (not the animation frame) triggers the redirect, so it still fires in a background tab.
  redirectTimer = setTimeout(() => window.location.assign(url), REDIRECT_MS);
}

// Coming back with the browser's Back button restores this page from cache — start fresh.
window.addEventListener("pageshow", (e) => {
  if (!e.persisted) return;
  clearTimeout(redirectTimer);
  cancelAnimationFrame(redirectFrame);
  redirectBar.style.transform = "scaleX(0)";
  modal.classList.remove("show");
  form.reset();
  inputs.forEach((i) => {
    i.closest(".field").classList.remove("is-invalid");
    i.closest(".field").querySelector(".error-msg").textContent = "";
  });
});

// ---------- Animated background grid ----------
(function initGrid() {
  const canvas = document.getElementById("bgGrid");
  const ctx = canvas.getContext("2d");
  const CELL = 45, SPEED = 0.4, TRAIL = 6;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let w, h, offset = 0, mouse = null, trail = [];

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", (e) => { mouse = { x: e.clientX, y: e.clientY }; });
  window.addEventListener("pointerleave", () => { mouse = null; });

  function draw() {
    ctx.clearRect(0, 0, w, h);
    const o = offset % CELL;

    // Hovered cell + fading trail
    if (mouse) {
      const cx = Math.floor((mouse.x - o) / CELL);
      const cy = Math.floor((mouse.y - o) / CELL);
      const last = trail[trail.length - 1];
      if (!last || last.cx !== cx || last.cy !== cy) {
        trail.push({ cx, cy });
        if (trail.length > TRAIL) trail.shift();
      }
    }
    trail.forEach((c, i) => {
      ctx.fillStyle = `rgba(0, 63, 138, ${0.06 * ((i + 1) / trail.length)})`;
      ctx.fillRect(c.cx * CELL + o, c.cy * CELL + o, CELL, CELL);
    });

    // Grid lines
    ctx.strokeStyle = "rgba(0, 63, 138, 0.04)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = o - CELL; x < w + CELL; x += CELL) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); }
    for (let y = o - CELL; y < h + CELL; y += CELL) { ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); }
    ctx.stroke();

    if (!reduceMotion) {
      // Diagonal drift; shift the trail with the grid so it stays aligned
      const before = Math.floor(offset / CELL);
      offset += SPEED;
      if (Math.floor(offset / CELL) !== before) trail.forEach((c) => { c.cx++; c.cy++; });
      requestAnimationFrame(draw);
    }
  }

  resize();
  draw();
})();
