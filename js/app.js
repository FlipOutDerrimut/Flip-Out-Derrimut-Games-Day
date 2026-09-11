// ===== FLIP OUT GAMES DAY — APP.JS (Phase 1) =====
window.__appJsRan = true; // used by the on-page diagnostic strip in index.html

// Catch any error anywhere in the app and show it on screen instead of
// failing silently — this is what lets us debug without dev tools.
window.addEventListener("error", (e) => showFatalError(e.message));
window.addEventListener("unhandledrejection", (e) =>
  showFatalError((e.reason && e.reason.message) || String(e.reason))
);

function showFatalError(message) {
  let banner = document.getElementById("fatal-error-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "fatal-error-banner";
    banner.style.cssText =
      "position:fixed;top:0;left:0;right:0;z-index:9999;background:#FF509F;" +
      "color:#0F041D;font-family:sans-serif;font-size:13px;padding:12px 16px;" +
      "text-align:center;font-weight:bold;";
    document.body.prepend(banner);
  }
  banner.textContent = "Something went wrong: " + message;
}

// NOTE: named "sb", not "supabase" — Safari throws a page-wide SyntaxError
// if a top-level let/const shares a name with an existing global (the
// Supabase library itself creates window.supabase).
let sb = null;
try {
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (err) {
  showFatalError("Couldn't set up Supabase — check js/config.js. (" + err.message + ")");
}

const SESSION_KEY = "fo_games_day_session";

const els = {
  viewLogin: document.getElementById("view-login"),
  appShell: document.getElementById("app-shell"),
  loginForm: document.getElementById("login-form"),
  loginName: document.getElementById("login-name"),
  loginPin: document.getElementById("login-pin"),
  loginError: document.getElementById("login-error"),
  headerName: document.getElementById("header-name"),
  logoutBtn: document.getElementById("logout-btn"),
  homeWelcome: document.getElementById("home-welcome"),
  homeTeam: document.getElementById("home-team"),
  adminTab: document.getElementById("admin-tab"),
  addPlayerForm: document.getElementById("add-player-form"),
  addTeamForm: document.getElementById("add-team-form"),
  newPlayerTeamSelect: document.getElementById("new-player-team"),
  adminPlayerList: document.getElementById("admin-player-list"),
  teamsList: document.getElementById("teams-list"),
};

let currentPlayer = null;

// ---------- LOGIN ----------
if (els.loginForm) {
  els.loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    els.loginError.hidden = true;

    if (!sb) {
      els.loginError.textContent = "App isn't connected to the database yet — see the error banner above.";
      els.loginError.hidden = false;
      return;
    }

    const name = els.loginName.value.trim();
    const pin = els.loginPin.value.trim();
    if (!name || !pin) return;

    const { data, error } = await sb
      .from("players")
      .select("*")
      .ilike("name", name)
      .eq("pin", pin)
      .maybeSingle();

    if (error || !data) {
      els.loginError.textContent = "No match for that name + PIN. Check with your admin.";
      els.loginError.hidden = false;
      return;
    }

    currentPlayer = data;
    localStorage.setItem(SESSION_KEY, JSON.stringify(currentPlayer));
    await enterApp();
  });
} else {
  showFatalError("Couldn't find the login form in the page (id='login-form' missing).");
}

if (els.logoutBtn) {
  els.logoutBtn.addEventListener("click", () => {
    localStorage.removeItem(SESSION_KEY);
    currentPlayer = null;
    els.loginName.value = "";
    els.loginPin.value = "";
    showAppShell(false);
  });
}

// ---------- NAV ----------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    document.querySelectorAll(".view").forEach((v) => {
      if (v.id !== "view-login") v.hidden = true;
    });
    document.getElementById(`view-${btn.dataset.view}`).hidden = false;
  });
});

// ---------- VIEW SWITCHING ----------
function showAppShell(show) {
  els.viewLogin.hidden = show;
  els.viewLogin.style.display = show ? "none" : "flex";
  els.appShell.hidden = !show;
  els.appShell.style.display = show ? "flex" : "none";
}

// ---------- BOOT ----------
showAppShell(false);
init();

async function init() {
  if (!sb) return;
  const cached = localStorage.getItem(SESSION_KEY);
  if (cached) {
    try {
      currentPlayer = JSON.parse(cached);
      await enterApp();
    } catch (e) {
      localStorage.removeItem(SESSION_KEY);
    }
  }
}

// ---------- ENTER APP ----------
async function enterApp() {
  showAppShell(true);

  els.headerName.textContent = currentPlayer.name;
  els.homeWelcome.textContent = `Hey ${currentPlayer.name.split(" ")[0]}!`;

  if (currentPlayer.is_admin) {
    els.adminTab.hidden = false;
    await loadAdminData();
  }

  await loadHomeTeam();
  await loadTeamsList();
}

// ---------- HOME ----------
async function loadHomeTeam() {
  if (!currentPlayer.team_id) {
    els.homeTeam.textContent = "No team yet — ask your admin to assign you one.";
    return;
  }
  const { data } = await sb
    .from("teams")
    .select("name")
    .eq("id", currentPlayer.team_id)
    .maybeSingle();
  els.homeTeam.textContent = data ? `Team: ${data.name}` : "No team yet";
}

// ---------- TEAMS VIEW ----------
async function loadTeamsList() {
  const { data } = await sb.from("teams").select("*").order("created_at");
  els.teamsList.innerHTML = "";
  (data || []).forEach((team) => {
    const row = document.createElement("div");
    row.className = "roster-row";
    row.innerHTML = `<span>${team.name}</span><span class="roster-row__tag">${team.status}</span>`;
    els.teamsList.appendChild(row);
  });
  if (!data || data.length === 0) {
    els.teamsList.innerHTML = `<p class="card card--muted">No teams yet.</p>`;
  }
}

// ---------- ADMIN ----------
async function loadAdminData() {
  const { data: teams } = await sb.from("teams").select("*").order("created_at");
  els.newPlayerTeamSelect.innerHTML = `<option value="">No team yet</option>`;
  (teams || []).forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.name;
    els.newPlayerTeamSelect.appendChild(opt);
  });

  const { data: players } = await sb.from("players").select("*").order("created_at");
  els.adminPlayerList.innerHTML = "";
  (players || []).forEach((p) => {
    const row = document.createElement("div");
    row.className = "roster-row";
    row.innerHTML = `<span>${p.name}${p.is_admin ? " (admin)" : ""}</span><span class="roster-row__tag">PIN ${p.pin}</span>`;
    els.adminPlayerList.appendChild(row);
  });
}

if (els.addPlayerForm) {
  els.addPlayerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("new-player-name").value.trim();
    const pin = document.getElementById("new-player-pin").value.trim();
    const team_id = els.newPlayerTeamSelect.value || null;

    const { error } = await sb.from("players").insert({ name, pin, team_id });
    if (error) {
      alert("Couldn't add worker: " + error.message);
      return;
    }
    e.target.reset();
    await loadAdminData();
  });
}

if (els.addTeamForm) {
  els.addTeamForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("new-team-name").value.trim();

    const { error } = await sb.from("teams").insert({ name, status: "approved" });
    if (error) {
      alert("Couldn't add team: " + error.message);
      return;
    }
    e.target.reset();
    await loadAdminData();
    await loadTeamsList();
  });
}
