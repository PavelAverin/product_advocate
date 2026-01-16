const STORAGE_KEY = "expiry_items_v1";
const SOON_DAYS = 3;

const $ = (id) => document.getElementById(id);

function loadItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveItems(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function formatDateRU(isoDateStr) {
  // isoDateStr: YYYY-MM-DD
  const [y, m, d] = isoDateStr.split("-");
  return `${d}.${m}.${y}`;
}

function toISODate(d) {
  // d: Date -> YYYY-MM-DD
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseISODate(s) {
  // s: YYYY-MM-DD -> Date (локальная дата)
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addShelfLife(startDate, value, unit) {
  const d = new Date(startDate.getTime());
  if (unit === "days") d.setDate(d.getDate() + value);
  if (unit === "weeks") d.setDate(d.getDate() + value * 7);
  if (unit === "months") d.setMonth(d.getMonth() + value);
  return d;
}

function dayDiff(from, to) {
  // Считаем разницу по календарным дням, без часов
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  const ms = b - a;
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function getStatus(expiryDate) {
  const today = new Date();
  const left = dayDiff(today, expiryDate);

  if (left < 0) return { kind: "danger", label: "Просрочено", left };
  if (left === 0) return { kind: "danger", label: "Истекает сегодня", left };
  if (left <= SOON_DAYS) return { kind: "warn", label: "Скоро истекает", left };
  return { kind: "ok", label: "Ок", left };
}

function formatLeft(left) {
  if (left < 0) return `${Math.abs(left)} дн. назад`;
  return `${left} дн.`;
}

function createId() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

let items = loadItems();

function render() {
  const filter = $("filter").value;
  const tbody = $("tbody");
  tbody.innerHTML = "";

  const now = new Date();

  const rows = items
    .map((it) => {
      const start = parseISODate(it.startDate);
      const expiry = parseISODate(it.expiryDate);
      const status = getStatus(expiry);
      return { ...it, start, expiry, status };
    })
    .filter((row) => {
      if (filter === "all") return true;
      if (filter === "expired") return row.status.left <= 0; // сегодня тоже считаем критичным
      if (filter === "soon")
        return row.status.left > 0 && row.status.left <= SOON_DAYS;
      return true;
    })
    .sort((a, b) => a.expiry - b.expiry);

  for (const row of rows) {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>
        <div style="font-weight:600">${escapeHtml(row.name)}</div>
        ${
          row.note
            ? `<div class="muted small">${escapeHtml(row.note)}</div>`
            : ""
        }
      </td>
      <td>${formatDateRU(row.startDate)}</td>
      <td>${formatDateRU(row.expiryDate)}</td>
      <td>${formatLeft(row.status.left)}</td>
      <td><span class="badge ${row.status.kind}">${row.status.label}</span></td>
      <td><button class="iconBtn" data-del="${
        row.id
      }" type="button">Удалить</button></td>
    `;

    tbody.appendChild(tr);
  }

  // bind delete
  tbody.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-del");
      items = items.filter((x) => x.id !== id);
      saveItems(items);
      render();
    });
  });
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

$("addForm").addEventListener("submit", (e) => {
  e.preventDefault();

  const name = $("name").value.trim();
  const startDateStr = $("startDate").value;
  const lifeValue = Number($("lifeValue").value);
  const lifeUnit = $("lifeUnit").value;
  const note = $("note").value.trim();

  if (!name || !startDateStr || !Number.isFinite(lifeValue) || lifeValue <= 0)
    return;

  const start = parseISODate(startDateStr);
  const expiry = addShelfLife(start, lifeValue, lifeUnit);

  const item = {
    id: createId(),
    name,
    startDate: startDateStr,
    expiryDate: toISODate(expiry),
    lifeValue,
    lifeUnit,
    note: note || "",
  };

  items.push(item);
  saveItems(items);

  e.target.reset();
  $("lifeValue").value = 7;
  $("lifeUnit").value = "days";

  render();
});

$("filter").addEventListener("change", render);

$("clearAll").addEventListener("click", () => {
  items = [];
  saveItems(items);
  render();
});

// default start date = today
$("startDate").value = toISODate(new Date());

render();
