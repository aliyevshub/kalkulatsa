// ==== Xodimlar hisoboti ====
const STORAGE_KEY = "xodimHisobotlari";

const $ = (id) => document.getElementById(id);
const form = $("reportForm");
const taskBody = $("taskBody");
const reportBody = $("reportBody");

const STATUSES = ["Bajarildi", "Jarayonda", "Bajarilmadi"];
let rating = 0;

// ---------- Saqlash (localStorage) ----------
function loadReports() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveReports(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    showToast("Ma'lumotni saqlab bo'lmadi");
  }
}

// ---------- Yordamchi funksiyalar ----------
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function formatDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function showToast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => t.classList.remove("show"), 2500);
}

function calcStats(tasks) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "Bajarildi").length;
  const hours = tasks.reduce((s, t) => s + (parseFloat(t.hours) || 0), 0);
  const percent = total ? Math.round((done / total) * 100) : 0;
  return { total, done, hours: Math.round(hours * 10) / 10, percent };
}

function percentBadge(p) {
  const cls = p >= 80 ? "high" : p >= 50 ? "mid" : "low";
  return `<span class="badge ${cls}">${p}%</span>`;
}

// ---------- Vazifalar jadvali ----------
function addTaskRow(task = { name: "", hours: "", status: "Bajarildi" }) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td class="num"></td>
    <td><input type="text" class="t-name" placeholder="Vazifa tavsifi" value="${escapeHtml(task.name)}"></td>
    <td><input type="number" class="t-hours" min="0" step="0.5" placeholder="0" value="${escapeHtml(task.hours)}"></td>
    <td>
      <select class="t-status">
        ${STATUSES.map((s) => `<option ${s === task.status ? "selected" : ""}>${s}</option>`).join("")}
      </select>
    </td>
    <td><button type="button" class="icon-btn del" title="O'chirish">✕</button></td>
  `;
  taskBody.appendChild(tr);
  renumberTasks();
  updateStats();
}

function renumberTasks() {
  [...taskBody.rows].forEach((r, i) => (r.querySelector(".num").textContent = i + 1));
}

function getTasks() {
  return [...taskBody.rows]
    .map((r) => ({
      name: r.querySelector(".t-name").value.trim(),
      hours: r.querySelector(".t-hours").value,
      status: r.querySelector(".t-status").value,
    }))
    .filter((t) => t.name);
}

function updateStats() {
  const s = calcStats(getTasks());
  $("statTotal").textContent = s.total;
  $("statDone").textContent = s.done;
  $("statHours").textContent = s.hours;
  $("statPercent").textContent = s.percent + "%";
  $("progressBar").style.width = s.percent + "%";
}

taskBody.addEventListener("input", updateStats);
taskBody.addEventListener("change", updateStats);
taskBody.addEventListener("click", (e) => {
  if (e.target.classList.contains("del")) {
    e.target.closest("tr").remove();
    if (!taskBody.rows.length) addTaskRow();
    renumberTasks();
    updateStats();
  }
});
$("addTask").addEventListener("click", () => addTaskRow());

// ---------- Reyting ----------
function setRating(v) {
  rating = v;
  document.querySelectorAll("#rating button").forEach((b) =>
    b.classList.toggle("active", +b.dataset.v <= v)
  );
}
$("rating").addEventListener("click", (e) => {
  if (e.target.dataset.v) setRating(+e.target.dataset.v === rating ? 0 : +e.target.dataset.v);
});

// ---------- Validatsiya ----------
function setError(el, msg) {
  el.classList.toggle("invalid", !!msg);
  const err = el.parentElement.querySelector(".error");
  if (err) err.textContent = msg || "";
}

function validate() {
  let ok = true;
  ["fullName", "position", "department", "dateFrom", "dateTo"].forEach((id) => {
    const el = $(id);
    if (!el.value.trim()) {
      setError(el, "Ushbu maydon to'ldirilishi shart");
      ok = false;
    } else setError(el, "");
  });

  const phone = $("phone");
  if (phone.value && !/^\+?[\d\s\-()]{7,20}$/.test(phone.value)) {
    setError(phone, "Telefon raqami noto'g'ri");
    ok = false;
  } else setError(phone, "");

  if ($("dateFrom").value && $("dateTo").value && $("dateFrom").value > $("dateTo").value) {
    setError($("dateTo"), "Tugash sanasi boshlanishdan oldin bo'lmasligi kerak");
    ok = false;
  }

  if (ok && !getTasks().length) {
    showToast("Kamida bitta vazifa kiriting");
    ok = false;
  }
  return ok;
}

form.addEventListener("input", (e) => {
  if (e.target.classList.contains("invalid")) setError(e.target, "");
});

// ---------- Forma ----------
function collectForm() {
  return {
    id: $("reportId").value || Date.now().toString(),
    fullName: $("fullName").value.trim(),
    position: $("position").value.trim(),
    department: $("department").value,
    phone: $("phone").value.trim(),
    reportType: $("reportType").value,
    dateFrom: $("dateFrom").value,
    dateTo: $("dateTo").value,
    tasks: getTasks(),
    achievements: $("achievements").value.trim(),
    problems: $("problems").value.trim(),
    plans: $("plans").value.trim(),
    rating,
    createdAt: new Date().toISOString(),
  };
}

function fillForm(r) {
  $("reportId").value = r.id;
  ["fullName", "position", "department", "phone", "reportType", "dateFrom", "dateTo",
   "achievements", "problems", "plans"].forEach((k) => ($(k).value = r[k] || ""));
  taskBody.innerHTML = "";
  (r.tasks.length ? r.tasks : [undefined]).forEach((t) => addTaskRow(t));
  setRating(r.rating || 0);
  $("formTitle").textContent = "Hisobotni tahrirlash";
  form.scrollIntoView({ behavior: "smooth" });
}

function resetForm() {
  form.reset();
  $("reportId").value = "";
  form.querySelectorAll(".invalid").forEach((el) => setError(el, ""));
  taskBody.innerHTML = "";
  addTaskRow();
  setRating(0);
  setDefaultDates();
  $("formTitle").textContent = "Yangi hisobot";
}

function setDefaultDates() {
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 6 * 864e5);
  const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  $("dateTo").value = iso(today);
  $("dateFrom").value = iso(weekAgo);
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!validate()) return;

  const report = collectForm();
  const list = loadReports();
  const idx = list.findIndex((r) => r.id === report.id);
  if (idx >= 0) list[idx] = report;
  else list.unshift(report);
  saveReports(list);

  showToast(idx >= 0 ? "Hisobot yangilandi" : "Hisobot saqlandi");
  resetForm();
  renderReports();
});

$("resetBtn").addEventListener("click", resetForm);

// ---------- Hisobotlar ro'yxati ----------
function renderReports() {
  const q = $("search").value.trim().toLowerCase();
  const list = loadReports().filter((r) =>
    !q || [r.fullName, r.department, r.position].some((v) => v.toLowerCase().includes(q))
  );

  reportBody.innerHTML = list.map((r) => {
    const s = calcStats(r.tasks);
    return `
      <tr>
        <td><b>${escapeHtml(r.fullName)}</b><br><small>${escapeHtml(r.position)}</small></td>
        <td>${escapeHtml(r.department)}</td>
        <td>${escapeHtml(r.reportType)}<br><small>${formatDate(r.dateFrom)} – ${formatDate(r.dateTo)}</small></td>
        <td>${s.done}/${s.total}</td>
        <td>${s.hours}</td>
        <td>${percentBadge(s.percent)}</td>
        <td>
          <button class="icon-btn" data-act="edit" data-id="${r.id}" title="Tahrirlash">✎</button>
          <button class="icon-btn" data-act="print" data-id="${r.id}" title="Chop etish">🖨</button>
          <button class="icon-btn del" data-act="delete" data-id="${r.id}" title="O'chirish">🗑</button>
        </td>
      </tr>`;
  }).join("");

  $("emptyMsg").style.display = list.length ? "none" : "block";
}

reportBody.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const list = loadReports();
  const report = list.find((r) => r.id === btn.dataset.id);
  if (!report) return;

  if (btn.dataset.act === "edit") fillForm(report);
  if (btn.dataset.act === "print") printReport(report);
  if (btn.dataset.act === "delete" && confirm(`${report.fullName} hisobotini o'chirasizmi?`)) {
    saveReports(list.filter((r) => r.id !== report.id));
    renderReports();
    showToast("Hisobot o'chirildi");
  }
});

$("search").addEventListener("input", renderReports);

// ---------- Chop etish ----------
function printReport(r) {
  const s = calcStats(r.tasks);
  const block = (title, text) =>
    text ? `<h3>${title}</h3><p>${escapeHtml(text).replace(/\n/g, "<br>")}</p>` : "";

  $("printArea").innerHTML = `
    <h1>XODIM HISOBOTI</h1>
    <p class="sub">${escapeHtml(r.reportType)} hisobot: ${formatDate(r.dateFrom)} – ${formatDate(r.dateTo)}</p>
    <p><b>F.I.Sh.:</b> ${escapeHtml(r.fullName)}<br>
       <b>Lavozimi:</b> ${escapeHtml(r.position)}<br>
       <b>Bo'lim:</b> ${escapeHtml(r.department)}
       ${r.phone ? `<br><b>Telefon:</b> ${escapeHtml(r.phone)}` : ""}</p>
    <table>
      <thead><tr><th>#</th><th>Vazifa</th><th>Soat</th><th>Holati</th></tr></thead>
      <tbody>
        ${r.tasks.map((t, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(t.name)}</td><td>${escapeHtml(t.hours || 0)}</td><td>${t.status}</td></tr>`).join("")}
      </tbody>
    </table>
    <p><b>Jami:</b> ${s.total} ta vazifa, ${s.done} tasi bajarildi (${s.percent}%), ${s.hours} soat.</p>
    ${block("Erishilgan natijalar", r.achievements)}
    ${block("Muammolar", r.problems)}
    ${block("Keyingi rejalar", r.plans)}
    ${r.rating ? `<p><b>O'z ishiga baho:</b> ${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</p>` : ""}
    <div class="sign">
      <span>Xodim: ____________________</span>
      <span>Rahbar: ____________________</span>
    </div>`;
  window.print();
}

// ---------- CSV eksport ----------
$("exportCsv").addEventListener("click", () => {
  const list = loadReports();
  if (!list.length) return showToast("Eksport qilish uchun hisobot yo'q");

  const header = ["F.I.Sh.", "Lavozim", "Bo'lim", "Telefon", "Turi", "Boshlanish", "Tugash",
    "Vazifalar", "Bajarildi", "Soat", "Bajarilish %", "Natijalar", "Muammolar", "Rejalar", "Baho"];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = list.map((r) => {
    const s = calcStats(r.tasks);
    return [r.fullName, r.position, r.department, r.phone, r.reportType,
      formatDate(r.dateFrom), formatDate(r.dateTo), s.total, s.done, s.hours, s.percent,
      r.achievements, r.problems, r.plans, r.rating].map(esc).join(";");
  });

  const csv = "﻿" + [header.map(esc).join(";"), ...rows].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "xodimlar_hisoboti.csv" });
  a.click();
  URL.revokeObjectURL(url);
});

// ---------- Boshlash ----------
resetForm();
renderReports();
