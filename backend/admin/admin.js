const TOKEN_KEY = "st_admin_token";

const $ = (sel) => document.querySelector(sel);
const loginView = $("#login-view");
const appView = $("#app-view");
const toast = $("#toast");

let stations = [];
let alerts = [];

function token() {
  return localStorage.getItem(TOKEN_KEY);
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 2400);
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token()) headers.Authorization = `Bearer ${token()}`;
  const res = await fetch(path, { ...options, headers });
  if (res.status === 401) {
    logout();
    throw new Error("Session expired");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function logout() {
  localStorage.removeItem(TOKEN_KEY);
  appView.classList.add("hidden");
  loginView.classList.remove("hidden");
}

async function login() {
  const password = $("#login-password").value;
  const err = $("#login-error");
  err.classList.add("hidden");
  try {
    const { token: t } = await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    localStorage.setItem(TOKEN_KEY, t);
    loginView.classList.add("hidden");
    appView.classList.remove("hidden");
    await loadAll();
  } catch (e) {
    err.textContent = e.message || "Login failed";
    err.classList.remove("hidden");
  }
}

function switchTab(name) {
  document.querySelectorAll(".tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.tab === name);
  });
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.add("hidden"));
  $(`#tab-${name}`).classList.remove("hidden");
}

function updateStats(cfg) {
  $("#stat-stations").textContent = String(stations.length);
  $("#stat-alerts").textContent = String(alerts.length);
  const status = $("#stat-status");
  if (cfg?.maintenanceMode) {
    status.textContent = "Maint.";
    status.style.color = "#ff9500";
  } else {
    status.textContent = "Live";
    status.style.color = "#34c759";
  }
}

async function loadAll() {
  const data = await api("/api/admin/data");
  $("#last-updated").textContent = `Last saved: ${new Date(data.updatedAt).toLocaleString()}`;
  const cfg = data.appConfig;
  $("#cfg-appName").value = cfg.appName || "";
  $("#cfg-tagline").value = cfg.tagline || "";
  $("#cfg-announcement").value = cfg.announcement || "";
  $("#cfg-showBanner").checked = !!cfg.showAnnouncementBanner;
  $("#cfg-maintenance").checked = !!cfg.maintenanceMode;
  $("#cfg-maintenanceMessage").value = cfg.maintenanceMessage || "";
  $("#cfg-defaultTheme").value = cfg.defaultTheme || "dark";
  $("#cfg-allowUserTheme").checked = cfg.allowUserTheme !== false;
  $("#cfg-accentColor").value = cfg.accentColor || "#0079C1";
  $("#cfg-featureTripPlanner").checked = cfg.featureTripPlanner !== false;
  $("#cfg-featureMaps").checked = cfg.featureMaps !== false;
  $("#cfg-featureAlerts").checked = cfg.featureAlerts !== false;
  $("#cfg-featureFavourites").checked = cfg.featureFavourites !== false;
  $("#cfg-featureAiChat").checked = cfg.featureAiChat !== false;
  $("#cfg-alertsRefreshSec").value = cfg.alertsRefreshSec ?? 20;
  $("#cfg-departuresRefreshSec").value = cfg.departuresRefreshSec ?? 30;
  $("#cfg-tripPlanRefreshSec").value = cfg.tripPlanRefreshSec ?? 15;
  $("#cfg-linkTransportNsw").value = cfg.linkTransportNsw || "";
  $("#cfg-linkOpenData").value = cfg.linkOpenData || "";
  $("#cfg-aboutDisclaimer").value = cfg.aboutDisclaimer || "";
  $("#cfg-notificationsDefaultOn").checked = !!cfg.notificationsDefaultOn;
  if ($("#cfg-networkMapUrl")) $("#cfg-networkMapUrl").value = cfg.networkMapUrl || "";
  if ($("#cfg-settingsMapDescription")) $("#cfg-settingsMapDescription").value = cfg.settingsMapDescription || "";
  if ($("#cfg-appLogoUrl")) $("#cfg-appLogoUrl").value = cfg.appLogoUrl || "";
  updateLogoPreview(cfg);
  updateMapPreview(cfg);
  $("#cfg-notificationsHelpText").value = cfg.notificationsHelpText || "";
  $("#cfg-showWalkLegs").checked = !!cfg.showWalkLegsInTrips;
  stations = data.stations || [];
  alerts = data.alerts || [];
  updateStats(cfg);
  renderStations();
  renderAlerts();
}

function logoSourceLabel(cfg) {
  if (cfg?.appLogoHasUpload || cfg?.appLogoUpdatedAt) return "Uploaded image";
  if (cfg?.appLogoUrl?.trim()) return "Custom URL";
  return "Default bundled logo";
}

function updateLogoPreview(cfg) {
  const label = $("#logo-source-label");
  const preview = $("#logo-preview");
  if (!label || !preview) return;
  label.textContent = `Current: ${logoSourceLabel(cfg)}`;
  preview.innerHTML = "";
  let src = "";
  if (cfg?.appLogoHasUpload || cfg?.appLogoUpdatedAt) {
    const v = cfg.appLogoUpdatedAt || "upload";
    src = `/api/app-logo?v=${encodeURIComponent(v)}`;
  } else if (cfg?.appLogoUrl?.trim()) {
    src = cfg.appLogoUrl.trim();
  }
  if (src) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "App logo preview";
    preview.appendChild(img);
  } else {
    preview.textContent = "Using default logo in the app until you upload.";
  }
}

function mapSourceLabel(cfg) {
  if (cfg?.networkMapHasUpload || cfg?.networkMapUpdatedAt) return "Uploaded image";
  if (cfg?.networkMapUrl?.trim()) return "Custom URL";
  return "Default bundled map";
}

function updateMapPreview(cfg) {
  const label = $("#map-source-label");
  const preview = $("#map-preview");
  if (!label || !preview) return;
  label.textContent = `Current: ${mapSourceLabel(cfg)}`;
  preview.innerHTML = "";
  let src = "";
  if (cfg?.networkMapHasUpload || cfg?.networkMapUpdatedAt) {
    const v = cfg.networkMapUpdatedAt || "upload";
    src = `/api/network-map?v=${encodeURIComponent(v)}`;
  } else if (cfg?.networkMapUrl?.trim()) {
    src = cfg.networkMapUrl.trim();
  }
  if (src) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "Network map preview";
    preview.appendChild(img);
  } else {
    preview.textContent = "Using default map in the app until you upload.";
  }
}

function renderStations(filter = "") {
  const q = filter.toLowerCase();
  const root = $("#stations-list");
  root.innerHTML = "";
  const list = stations.filter(
    (s) =>
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q) ||
      (s.code || "").toLowerCase().includes(q)
  );

  list.slice(0, 60).forEach((s) => {
    const div = document.createElement("div");
    div.className = "station-card";
    div.innerHTML = `
      <header>
        <div>
          <h3>${escapeHtml(s.name)}</h3>
          <code>${escapeHtml(s.id)}</code>
        </div>
        <button class="btn danger-outline small" type="button" data-del="${escapeAttr(s.id)}">Delete</button>
      </header>
      <div class="fields">
        <label>Name <input data-f="name" data-id="${escapeAttr(s.id)}" value="${escapeAttr(s.name)}" /></label>
        <label>Mode
          <select data-f="mode" data-id="${escapeAttr(s.id)}">
            ${["train", "metro", "ferry", "lightrail", "bus"]
              .map((m) => `<option value="${m}" ${s.mode === m ? "selected" : ""}>${m}</option>`)
              .join("")}
          </select>
        </label>
        <div class="row-2">
          <label>Lat <input data-f="lat" data-id="${escapeAttr(s.id)}" type="number" step="0.0001" value="${s.lat}" /></label>
          <label>Lon <input data-f="lon" data-id="${escapeAttr(s.id)}" type="number" step="0.0001" value="${s.lon}" /></label>
        </div>
        <label class="checkbox"><input data-f="disabled" data-id="${escapeAttr(s.id)}" type="checkbox" ${s.disabled ? "checked" : ""} /> Hidden from app</label>
      </div>
    `;
    root.appendChild(div);
  });

  if (list.length > 60) {
    const note = document.createElement("p");
    note.className = "muted";
    note.style.textAlign = "center";
    note.textContent = `Showing 60 of ${list.length} — refine search to see more.`;
    root.appendChild(note);
  }

  root.querySelectorAll("input,select").forEach((el) => {
    el.addEventListener("change", onStationFieldChange);
  });
  root.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", () => deleteStation(btn.dataset.del));
  });
}

function escapeAttr(v) {
  return String(v).replace(/"/g, "&quot;");
}

function escapeHtml(v) {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function onStationFieldChange(e) {
  const id = e.target.dataset.id;
  const field = e.target.dataset.f;
  const s = stations.find((x) => x.id === id);
  if (!s) return;
  if (field === "disabled") s.disabled = e.target.checked;
  else if (field === "lat" || field === "lon") s[field] = parseFloat(e.target.value);
  else s[field] = e.target.value;
}

async function saveStations() {
  await api("/api/admin/stations", { method: "PUT", body: JSON.stringify(stations) });
  showToast("Stations saved");
  await loadAll();
}

async function deleteStation(id) {
  if (!confirm(`Hide station ${id} from the app?`)) return;
  await api(`/api/admin/stations/${encodeURIComponent(id)}`, { method: "DELETE" });
  showToast("Station hidden");
  await loadAll();
}

function renderAlerts() {
  const root = $("#alerts-list");
  root.innerHTML = "";
  alerts.forEach((a, idx) => {
    const div = document.createElement("div");
    div.className = "alert-card";
    div.innerHTML = `
      <label>Title <input data-a="title" data-idx="${idx}" value="${escapeAttr(a.title)}" /></label>
      <label>Description <textarea data-a="description" data-idx="${idx}" rows="2">${escapeAttr(a.description || "")}</textarea></label>
      <label>Severity
        <select data-a="severity" data-idx="${idx}">
          ${["info", "warning", "critical"]
            .map((m) => `<option value="${m}" ${a.severity === m ? "selected" : ""}>${m}</option>`)
            .join("")}
        </select>
      </label>
      <label>Line <input data-a="affectedLine" data-idx="${idx}" value="${escapeAttr(a.affectedLine || "")}" /></label>
      <button class="btn danger-outline small" type="button" data-rm="${idx}">Remove</button>
    `;
    root.appendChild(div);
  });
  root.querySelectorAll("[data-a]").forEach((el) => {
    el.addEventListener("change", (e) => {
      const idx = Number(e.target.dataset.idx);
      const key = e.target.dataset.a;
      if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") {
        alerts[idx][key] = e.target.value;
      } else {
        alerts[idx][key] = e.target.value;
      }
    });
    el.addEventListener("input", (e) => {
      const idx = Number(e.target.dataset.idx);
      const key = e.target.dataset.a;
      alerts[idx][key] = e.target.value;
    });
  });
  root.querySelectorAll("[data-rm]").forEach((btn) => {
    btn.addEventListener("click", () => {
      alerts.splice(Number(btn.dataset.rm), 1);
      renderAlerts();
    });
  });
}

$("#login-btn").addEventListener("click", login);
$("#login-password").addEventListener("keydown", (e) => {
  if (e.key === "Enter") login();
});
$("#logout-btn").addEventListener("click", logout);
$("#reset-btn").addEventListener("click", async () => {
  if (!confirm("Reset all admin data to defaults?")) return;
  await api("/api/admin/reset", { method: "POST" });
  showToast("Reset complete");
  await loadAll();
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => switchTab(tab.dataset.tab));
});

$("#config-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  await api("/api/admin/app-config", {
    method: "PUT",
    body: JSON.stringify({
      appName: $("#cfg-appName").value,
      tagline: $("#cfg-tagline").value,
      announcement: $("#cfg-announcement").value,
      showAnnouncementBanner: $("#cfg-showBanner").checked,
      maintenanceMode: $("#cfg-maintenance").checked,
      maintenanceMessage: $("#cfg-maintenanceMessage").value,
      defaultTheme: $("#cfg-defaultTheme").value,
      allowUserTheme: $("#cfg-allowUserTheme").checked,
      accentColor: $("#cfg-accentColor").value,
      featureTripPlanner: $("#cfg-featureTripPlanner").checked,
      featureMaps: $("#cfg-featureMaps").checked,
      featureAlerts: $("#cfg-featureAlerts").checked,
      featureFavourites: $("#cfg-featureFavourites").checked,
      featureAiChat: $("#cfg-featureAiChat").checked,
      alertsRefreshSec: Number($("#cfg-alertsRefreshSec").value),
      departuresRefreshSec: Number($("#cfg-departuresRefreshSec").value),
      tripPlanRefreshSec: Number($("#cfg-tripPlanRefreshSec").value),
      linkTransportNsw: $("#cfg-linkTransportNsw").value,
      linkOpenData: $("#cfg-linkOpenData").value,
      aboutDisclaimer: $("#cfg-aboutDisclaimer").value,
      notificationsDefaultOn: $("#cfg-notificationsDefaultOn").checked,
      notificationsHelpText: $("#cfg-notificationsHelpText").value,
      showWalkLegsInTrips: $("#cfg-showWalkLegs").checked,
    }),
  });
  showToast("Settings saved");
  await loadAll();
});

$("#station-search").addEventListener("input", (e) => renderStations(e.target.value));
$("#add-station-btn").addEventListener("click", async () => {
  const id = prompt("Station ID (e.g. NEWTOWN_T):");
  const name = prompt("Station name:");
  if (!id || !name) return;
  stations.push({
    id: id.trim(),
    name: name.trim(),
    lat: -33.87,
    lon: 151.2,
    mode: "train",
    code: "",
    disabled: false,
  });
  await saveStations();
});

$("#save-stations-btn").addEventListener("click", () => saveStations());
$("#save-alerts-btn").addEventListener("click", async () => {
  await api("/api/admin/alerts", { method: "PUT", body: JSON.stringify(alerts) });
  showToast("Alerts saved");
  await loadAll();
});

$("#logo-upload-btn")?.addEventListener("click", async () => {
  const file = $("#logo-file")?.files?.[0];
  if (!file) {
    showToast("Choose an image first");
    return;
  }
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const data = String(reader.result ?? "");
      const base64 = data.includes(",") ? data.split(",").pop() : data;
      await api("/api/admin/app-logo", {
        method: "POST",
        body: JSON.stringify({ imageBase64: base64 }),
      });
      showToast("Logo uploaded");
      await loadAll();
    } catch (e) {
      showToast(e.message || "Upload failed");
    }
  };
  reader.readAsDataURL(file);
});

$("#logo-reset-btn")?.addEventListener("click", async () => {
  if (!confirm("Reset to default logo?")) return;
  await api("/api/admin/app-logo", { method: "DELETE" });
  await api("/api/admin/app-config", {
    method: "PUT",
    body: JSON.stringify({ appLogoUrl: "" }),
  });
  showToast("Logo reset");
  await loadAll();
});

$("#logo-save-settings-btn")?.addEventListener("click", async () => {
  await api("/api/admin/app-config", {
    method: "PUT",
    body: JSON.stringify({
      appLogoUrl: $("#cfg-appLogoUrl")?.value?.trim() ?? "",
    }),
  });
  showToast("Logo settings saved");
  await loadAll();
});

$("#map-upload-btn")?.addEventListener("click", async () => {
  const file = $("#map-file")?.files?.[0];
  if (!file) {
    showToast("Choose an image first");
    return;
  }
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const data = String(reader.result ?? "");
      const base64 = data.includes(",") ? data.split(",").pop() : data;
      await api("/api/admin/network-map", {
        method: "POST",
        body: JSON.stringify({ imageBase64: base64 }),
      });
      showToast("Map uploaded");
      await loadAll();
    } catch (e) {
      showToast(e.message || "Upload failed");
    }
  };
  reader.readAsDataURL(file);
});

$("#map-reset-btn")?.addEventListener("click", async () => {
  if (!confirm("Reset to default map?")) return;
  await api("/api/admin/network-map", { method: "DELETE" });
  await api("/api/admin/app-config", {
    method: "PUT",
    body: JSON.stringify({ networkMapUrl: "" }),
  });
  showToast("Map reset");
  await loadAll();
});

$("#map-save-settings-btn")?.addEventListener("click", async () => {
  await api("/api/admin/app-config", {
    method: "PUT",
    body: JSON.stringify({
      networkMapUrl: $("#cfg-networkMapUrl")?.value?.trim() ?? "",
      settingsMapDescription: $("#cfg-settingsMapDescription")?.value ?? "",
    }),
  });
  showToast("Map settings saved");
  await loadAll();
});

$("#add-alert-btn").addEventListener("click", () => {
  alerts.unshift({
    id: `alert_${Date.now()}`,
    title: "New alert",
    description: "",
    mode: "train",
    severity: "info",
    affectedLine: "T1",
    updatedAt: new Date().toISOString(),
  });
  renderAlerts();
  updateStats({ maintenanceMode: $("#cfg-maintenance").checked });
});

if (token()) {
  loginView.classList.add("hidden");
  appView.classList.remove("hidden");
  loadAll().catch(logout);
}
