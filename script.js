// ==== Xodimlar hisoboti ====
const STORAGE_KEY = "xodimHisobotlari";

const $ = (id) => document.getElementById(id);
const form = $("reportForm");
const taskBody = $("taskBody");
const reportBody = $("reportBody");

const STATUSES = ["Bajarildi", "Jarayonda", "Bajarilmadi"];
const PRIORITIES = ["Yuqori", "O'rta", "Past"];

// Formadagi oddiy maydonlar (id = saqlanadigan kalit)
const TEXT_FIELDS = [
  "fullName", "position", "department", "phone", "employeeId", "email", "hireDate", "manager",
  "reportType", "dateFrom", "dateTo",
  "achievements", "problems", "plans", "training", "suggestions", "resources",
  "managerGrade", "managerComment",
];
const NUMBER_FIELDS = ["workDays", "presentDays", "sickDays", "vacationDays", "lateCount", "overtime"];

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

function todayIso() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
}

function showToast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => t.classList.remove("show"), 2500);
}

function isOverdue(task, refDate) {
  return task.deadline && task.status !== "Bajarildi" && task.deadline < refDate;
}

function calcStats(tasks, refDate = todayIso()) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "Bajarildi").length;
  const inProgress = tasks.filter((t) => t.status === "Jarayonda").length;
  const overdue = tasks.filter((t) => isOverdue(t, refDate)).length;
  const hours = tasks.reduce((s, t) => s + (parseFloat(t.hours) || 0), 0);
  const percent = total ? Math.round((done / total) * 100) : 0;
  return { total, done, inProgress, overdue, hours: Math.round(hours * 10) / 10, percent };
}

// Davomat: sababli yo'qliklar (kasallik, ta'til) ish kunlaridan chiqariladi
function calcAttendance(r) {
  const work = +r.workDays || 0;
  const present = +r.presentDays || 0;
  const excused = (+r.sickDays || 0) + (+r.vacationDays || 0);
  const required = Math.max(work - excused, 0);
  const absent = Math.max(required - present, 0);
  const percent = required ? Math.min(Math.round((present / required) * 100), 100) : null;
  return { percent, absent };
}

function percentBadge(p) {
  if (p === null || p === undefined) return `<span class="badge neutral">—</span>`;
  const cls = p >= 80 ? "high" : p >= 50 ? "mid" : "low";
  return `<span class="badge ${cls}">${p}%</span>`;
}

function gradeBadge(g) {
  if (!g) return `<span class="badge neutral">—</span>`;
  const cls = { "A'lo": "high", "Yaxshi": "high", "Qoniqarli": "mid", "Qoniqarsiz": "low" }[g];
  return `<span class="badge ${cls}">${escapeHtml(g)}</span>`;
}

// ---------- Vazifalar jadvali ----------
function addTaskRow(task = {}) {
  const t = { name: "", priority: "O'rta", deadline: "", hours: "", status: "Bajarildi", ...task };
  const options = (list, sel) => list.map((s) => `<option ${s === sel ? "selected" : ""}>${s}</option>`).join("");
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td class="num"></td>
    <td><input type="text" class="t-name" placeholder="Vazifa tavsifi" value="${escapeHtml(t.name)}"></td>
    <td><select class="t-priority">${options(PRIORITIES, t.priority)}</select></td>
    <td><input type="date" class="t-deadline" value="${escapeHtml(t.deadline)}"></td>
    <td><input type="number" class="t-hours" min="0" step="0.5" placeholder="0" value="${escapeHtml(t.hours)}"></td>
    <td><select class="t-status">${options(STATUSES, t.status)}</select></td>
    <td><button type="button" class="icon-btn del" title="O'chirish">✕</button></td>
  `;
  taskBody.appendChild(tr);
  renumberTasks();
  updateStats();
}

function renumberTasks() {
  [...taskBody.rows].forEach((r, i) => (r.querySelector(".num").textContent = i + 1));
}

function readRow(r) {
  return {
    name: r.querySelector(".t-name").value.trim(),
    priority: r.querySelector(".t-priority").value,
    deadline: r.querySelector(".t-deadline").value,
    hours: r.querySelector(".t-hours").value,
    status: r.querySelector(".t-status").value,
  };
}

function getTasks() {
  return [...taskBody.rows].map(readRow).filter((t) => t.name);
}

function updateStats() {
  const ref = $("dateTo").value || todayIso();
  const s = calcStats(getTasks(), ref);
  $("statTotal").textContent = s.total;
  $("statDone").textContent = s.done;
  $("statHours").textContent = s.hours;
  $("statPercent").textContent = s.percent + "%";
  $("statProgress").textContent = s.inProgress;
  $("statOverdue").textContent = s.overdue;
  $("progressBar").style.width = s.percent + "%";
  [...taskBody.rows].forEach((r) => r.classList.toggle("overdue", !!isOverdue(readRow(r), ref)));

  const att = calcAttendance(Object.fromEntries(NUMBER_FIELDS.map((k) => [k, $(k).value])));
  $("statAttendance").textContent = att.percent === null ? "—" : att.percent + "%";
  $("statAbsent").textContent = att.absent;
}

taskBody.addEventListener("click", (e) => {
  if (e.target.classList.contains("del")) {
    e.target.closest("tr").remove();
    if (!taskBody.rows.length) addTaskRow();
    renumberTasks();
    updateStats();
  }
});
$("addTask").addEventListener("click", () => addTaskRow());
form.addEventListener("input", updateStats);
form.addEventListener("change", updateStats);

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
  const fail = (el, msg) => { setError(el, msg); ok = false; };

  ["fullName", "position", "department", "dateFrom", "dateTo"].forEach((id) => {
    const el = $(id);
    if (!el.value.trim()) fail(el, "Ushbu maydon to'ldirilishi shart");
    else setError(el, "");
  });

  const phone = $("phone");
  if (phone.value && !/^\+?[\d\s\-()]{7,20}$/.test(phone.value)) fail(phone, "Telefon raqami noto'g'ri");
  else setError(phone, "");

  const email = $("email");
  if (email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) fail(email, "Elektron pochta noto'g'ri");
  else setError(email, "");

  const hire = $("hireDate");
  if (hire.value && hire.value > todayIso()) fail(hire, "Sana kelajakda bo'lishi mumkin emas");
  else setError(hire, "");

  if ($("dateFrom").value && $("dateTo").value && $("dateFrom").value > $("dateTo").value) {
    fail($("dateTo"), "Tugash sanasi boshlanishdan oldin bo'lmasligi kerak");
  }

  NUMBER_FIELDS.forEach((id) => {
    if ($(id).value !== "" && +$(id).value < 0) fail($(id), "Manfiy bo'lmasligi kerak");
  });
  const work = +$("workDays").value || 0;
  if ($("presentDays").value !== "" && work && +$("presentDays").value > work) {
    fail($("presentDays"), "Ish kunlaridan ko'p bo'lmasligi kerak");
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
  const r = { id: $("reportId").value || Date.now().toString() };
  TEXT_FIELDS.forEach((k) => (r[k] = $(k).value.trim()));
  NUMBER_FIELDS.forEach((k) => (r[k] = $(k).value));
  r.tasks = getTasks();
  r.rating = rating;
  r.createdAt = new Date().toISOString();
  return r;
}

function fillForm(r) {
  $("reportId").value = r.id;
  [...TEXT_FIELDS, ...NUMBER_FIELDS].forEach((k) => ($(k).value = r[k] ?? ""));
  taskBody.innerHTML = "";
  (r.tasks.length ? r.tasks : [{}]).forEach((t) => addTaskRow(t));
  setRating(r.rating || 0);
  updateStats();
  $("formTitle").textContent = "Hisobotni tahrirlash";
  form.scrollIntoView({ behavior: "smooth" });
}

function resetForm() {
  form.reset();
  $("reportId").value = "";
  form.querySelectorAll(".invalid").forEach((el) => setError(el, ""));
  taskBody.innerHTML = "";
  setDefaultDates();
  addTaskRow();
  setRating(0);
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
    !q || [r.fullName, r.department, r.position, r.employeeId, r.manager]
      .some((v) => (v || "").toLowerCase().includes(q))
  );

  reportBody.innerHTML = list.map((r) => {
    const s = calcStats(r.tasks, r.dateTo);
    const att = calcAttendance(r);
    return `
      <tr>
        <td><b>${escapeHtml(r.fullName)}</b><br><small>${escapeHtml(r.position)}${r.employeeId ? " · №" + escapeHtml(r.employeeId) : ""}</small></td>
        <td>${escapeHtml(r.department)}</td>
        <td>${escapeHtml(r.reportType)}<br><small>${formatDate(r.dateFrom)} – ${formatDate(r.dateTo)}</small></td>
        <td>${s.done}/${s.total}${s.overdue ? `<br><small class="req">${s.overdue} muddati o'tgan</small>` : ""}</td>
        <td>${s.hours}</td>
        <td>${percentBadge(s.percent)}</td>
        <td>${percentBadge(att.percent)}</td>
        <td>${gradeBadge(r.managerGrade)}</td>
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
  const s = calcStats(r.tasks, r.dateTo);
  const att = calcAttendance(r);
  const block = (title, text) =>
    text ? `<h3>${title}</h3><p>${escapeHtml(text).replace(/\n/g, "<br>")}</p>` : "";
  const line = (label, value) => (value ? `<b>${label}:</b> ${escapeHtml(value)}<br>` : "");
  const hasAttendance = NUMBER_FIELDS.some((k) => r[k] !== undefined && r[k] !== "");

  $("printArea").innerHTML = `
    <h1>XODIM HISOBOTI</h1>
    <p class="sub">${escapeHtml(r.reportType)} hisobot: ${formatDate(r.dateFrom)} – ${formatDate(r.dateTo)}</p>
    <p>
      ${line("F.I.Sh.", r.fullName)}
      ${line("Tabel raqami", r.employeeId)}
      ${line("Lavozimi", r.position)}
      ${line("Bo'lim", r.department)}
      ${line("Bevosita rahbar", r.manager)}
      ${line("Ishga kirgan sana", formatDate(r.hireDate))}
      ${line("Telefon", r.phone)}
      ${line("Elektron pochta", r.email)}
    </p>
    ${hasAttendance ? `
    <h3>Davomat</h3>
    <table>
      <thead><tr><th>Ish kunlari</th><th>Ishda bo'lgan</th><th>Kasallik</th><th>Ta'til</th><th>Kechikish</th><th>Qo'shimcha soat</th><th>Davomat</th></tr></thead>
      <tbody><tr>
        <td>${+r.workDays || 0}</td><td>${+r.presentDays || 0}</td><td>${+r.sickDays || 0}</td>
        <td>${+r.vacationDays || 0}</td><td>${+r.lateCount || 0}</td><td>${+r.overtime || 0}</td>
        <td>${att.percent === null ? "—" : att.percent + "%"}</td>
      </tr></tbody>
    </table>` : ""}
    <h3>Vazifalar</h3>
    <table>
      <thead><tr><th>#</th><th>Vazifa</th><th>Muhimlik</th><th>Muddat</th><th>Soat</th><th>Holati</th></tr></thead>
      <tbody>
        ${r.tasks.map((t, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(t.name)}</td><td>${escapeHtml(t.priority || "—")}</td><td>${formatDate(t.deadline) || "—"}</td><td>${escapeHtml(t.hours || 0)}</td><td>${escapeHtml(t.status)}${isOverdue(t, r.dateTo) ? " (muddati o'tgan)" : ""}</td></tr>`).join("")}
      </tbody>
    </table>
    <p><b>Jami:</b> ${s.total} ta vazifa, ${s.done} tasi bajarildi (${s.percent}%), ${s.inProgress} tasi jarayonda, ${s.overdue} tasining muddati o'tgan, ${s.hours} soat.</p>
    ${block("Erishilgan natijalar", r.achievements)}
    ${block("Muammolar", r.problems)}
    ${block("Keyingi rejalar", r.plans)}
    ${block("Malaka oshirish va o'qishlar", r.training)}
    ${block("Takliflar", r.suggestions)}
    ${block("Kerakli resurslar", r.resources)}
    ${r.rating ? `<p><b>O'z ishiga baho:</b> ${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</p>` : ""}
    ${r.managerGrade || r.managerComment ? `<h3>Rahbar xulosasi</h3>
      <p>${line("Baho", r.managerGrade)}${escapeHtml(r.managerComment || "").replace(/\n/g, "<br>")}</p>` : ""}
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

  const header = ["F.I.Sh.", "Tabel raqami", "Lavozim", "Bo'lim", "Rahbar", "Ishga kirgan", "Telefon", "Email",
    "Turi", "Boshlanish", "Tugash",
    "Ish kunlari", "Ishda bo'lgan", "Kasallik", "Ta'til", "Kechikish", "Qo'shimcha soat", "Davomat %",
    "Vazifalar", "Bajarildi", "Jarayonda", "Muddati o'tgan", "Soat", "Bajarilish %",
    "Natijalar", "Muammolar", "Rejalar", "Malaka oshirish", "Takliflar", "Resurslar",
    "O'z bahosi", "Rahbar bahosi", "Rahbar izohi"];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = list.map((r) => {
    const s = calcStats(r.tasks, r.dateTo);
    const att = calcAttendance(r);
    return [r.fullName, r.employeeId, r.position, r.department, r.manager, formatDate(r.hireDate), r.phone, r.email,
      r.reportType, formatDate(r.dateFrom), formatDate(r.dateTo),
      r.workDays, r.presentDays, r.sickDays, r.vacationDays, r.lateCount, r.overtime, att.percent ?? "",
      s.total, s.done, s.inProgress, s.overdue, s.hours, s.percent,
      r.achievements, r.problems, r.plans, r.training, r.suggestions, r.resources,
      r.rating || "", r.managerGrade, r.managerComment].map(esc).join(";");
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
