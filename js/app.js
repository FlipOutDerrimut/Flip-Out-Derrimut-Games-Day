// ===== FLIP OUT GAMES DAY — APP.JS (Phase 1 + 2) =====
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
  myTeamSection: document.getElementById("my-team-section"),
  adminTab: document.getElementById("admin-tab"),
  addPlayerForm: document.getElementById("add-player-form"),
  addTeamForm: document.getElementById("add-team-form"),
  newPlayerTeamSelect: document.getElementById("new-player-team"),
  adminPlayerList: document.getElementById("admin-player-list"),
  pendingTeamsList: document.getElementById("pending-teams-list"),
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
    await loadPendingTeams();
  }

  await renderMyTeam();
  await loadTeamsList();
}

// Re-fetch this player's own row (their team_id / player_number may have
// changed) and keep localStorage in sync.
async function refreshCurrentPlayer() {
  const { data } = await sb.from("players").select("*").eq("id", currentPlayer.id).maybeSingle();
  if (data) {
    currentPlayer = data;
    localStorage.setItem(SESSION_KEY, JSON.stringify(currentPlayer));
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

// ---------- MY TEAM (Home tab) ----------
async function renderMyTeam() {
  await refreshCurrentPlayer();

  if (!currentPlayer.team_id) {
    await renderNoTeamState();
    return;
  }

  const { data: team } = await sb.from("teams").select("*").eq("id", currentPlayer.team_id).maybeSingle();
  if (!team) {
    await renderNoTeamState();
    return;
  }

  if (team.status === "pending") {
    els.myTeamSection.innerHTML = `
      <div class="card">
        <div class="team-header">
          ${team.logo_url ? `<img src="${escapeHtml(team.logo_url)}" class="team-header__logo" alt="">` : ""}
          <div>
            <p class="team-header__name">${escapeHtml(team.name)}</p>
            <span class="badge badge--pending">Awaiting admin approval</span>
          </div>
        </div>
        <p class="card__sub">You'll be able to pick a player number and see your team roster once your admin approves this team.</p>
      </div>`;
    return;
  }

  if (team.status === "rejected") {
    els.myTeamSection.innerHTML = `
      <div class="card">
        <div class="team-header">
          <div>
            <p class="team-header__name">${escapeHtml(team.name)}</p>
            <span class="badge badge--rejected">Not approved</span>
          </div>
        </div>
        <p class="card__sub">This team wasn't approved. Pick a different team below.</p>
        <button id="pick-again-btn" class="btn btn--secondary btn--block" style="margin-top:12px;">Choose a different team</button>
      </div>`;
    document.getElementById("pick-again-btn").addEventListener("click", async () => {
      await sb.from("players").update({ team_id: null }).eq("id", currentPlayer.id);
      await renderMyTeam();
    });
    return;
  }

  // approved
  const { data: members } = await sb
    .from("players")
    .select("*")
    .eq("team_id", team.id)
    .order("player_number", { ascending: true, nullsFirst: false });

  const leader = (members || []).find((m) => m.id === team.leader_id);

  let numberSectionHtml = "";
  if (currentPlayer.player_number == null) {
    numberSectionHtml = `
      <form id="pick-number-form" class="stack-form" style="margin-top:14px;">
        <label class="field">
          <span>Pick your player number</span>
          <input type="number" id="pick-number-input" min="0" required />
        </label>
        <p id="pick-number-error" class="login-error" hidden></p>
        <button type="submit" class="btn btn--primary btn--block">Save my number</button>
      </form>`;
  }

  let leaderSectionHtml = "";
  if (!team.leader_id) {
    leaderSectionHtml = `<button id="become-leader-btn" class="btn btn--secondary btn--block" style="margin-top:12px;">Become team leader</button>`;
  } else if (team.leader_id === currentPlayer.id) {
    leaderSectionHtml = `<p class="card__sub" style="margin-top:12px;">You're the team leader <span class="leader-star">★</span></p>`;
  } else if (leader) {
    leaderSectionHtml = `<p class="card__sub" style="margin-top:12px;">Team leader: ${escapeHtml(leader.name)} <span class="leader-star">★</span></p>`;
  }

  const rosterHtml = (members || [])
    .map(
      (m) => `
      <div class="member-row">
        <span>${m.player_number != null ? `<span class="member-row__number">${m.player_number}</span>` : ""}${escapeHtml(m.name)}${m.id === team.leader_id ? '<span class="leader-star">★</span>' : ""}</span>
      </div>`
    )
    .join("");

  els.myTeamSection.innerHTML = `
    <div class="card">
      <div class="team-header">
        ${team.logo_url ? `<img src="${escapeHtml(team.logo_url)}" class="team-header__logo" alt="">` : ""}
        <div>
          <p class="team-header__name">${escapeHtml(team.name)}</p>
          <span class="badge badge--approved">Approved</span>
        </div>
      </div>
      ${numberSectionHtml}
      ${leaderSectionHtml}
    </div>
    <div class="card">
      <h3 class="card__heading">Team roster</h3>
      <div class="stack">${rosterHtml || `<p class="card__sub">No members yet.</p>`}</div>
    </div>`;

  const numberForm = document.getElementById("pick-number-form");
  if (numberForm) {
    numberForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const numInput = document.getElementById("pick-number-input");
      const num = parseInt(numInput.value, 10);
      const errEl = document.getElementById("pick-number-error");
      errEl.hidden = true;

      const { error } = await sb.from("players").update({ player_number: num }).eq("id", currentPlayer.id);
      if (error) {
        errEl.textContent = error.code === "23505" ? "That number's taken on your team — try another." : "Couldn't save: " + error.message;
        errEl.hidden = false;
        return;
      }
      await renderMyTeam();
    });
  }

  const leaderBtn = document.getElementById("become-leader-btn");
  if (leaderBtn) {
    leaderBtn.addEventListener("click", async () => {
      await sb.from("teams").update({ leader_id: currentPlayer.id }).eq("id", team.id).is("leader_id", null);
      await renderMyTeam();
    });
  }
}

async function renderNoTeamState() {
  const { data: approvedTeams } = await sb.from("teams").select("*").eq("status", "approved").order("name");

  const joinListHtml = (approvedTeams || [])
    .map(
      (t) => `
      <div class="roster-row">
        <span>${escapeHtml(t.name)}</span>
        <button class="btn btn--secondary join-team-btn" data-team-id="${t.id}" style="padding:8px 14px;font-size:13px;">Join</button>
      </div>`
    )
    .join("");

  els.myTeamSection.innerHTML = `
    <div class="card">
      <h3 class="card__heading">Create a team</h3>
      <form id="create-team-form" class="stack-form">
        <label class="field">
          <span>Team name</span>
          <input type="text" id="create-team-name" required />
        </label>
        <label class="file-field">
          <span>Team logo (optional)</span>
          <input type="file" id="create-team-logo" accept="image/*" />
        </label>
        <p id="create-team-error" class="login-error" hidden></p>
        <button type="submit" class="btn btn--primary btn--block">Create team (needs admin approval)</button>
      </form>
    </div>
    <div class="card">
      <h3 class="card__heading">Or join an existing team</h3>
      <div class="stack">${joinListHtml || `<p class="card__sub">No approved teams yet.</p>`}</div>
    </div>`;

  document.getElementById("create-team-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("create-team-name").value.trim();
    const fileInput = document.getElementById("create-team-logo");
    const errEl = document.getElementById("create-team-error");
    errEl.hidden = true;

    let logoUrl = null;
    const file = fileInput.files[0];
    if (file) {
      const path = `${Date.now()}-${file.name}`;
      const { error: uploadError } = await sb.storage.from("team-logos").upload(path, file);
      if (uploadError) {
        errEl.textContent = "Couldn't upload logo: " + uploadError.message;
        errEl.hidden = false;
        return;
      }
      logoUrl = sb.storage.from("team-logos").getPublicUrl(path).data.publicUrl;
    }

    const { data: newTeam, error } = await sb
      .from("teams")
      .insert({ name, logo_url: logoUrl, status: "pending" })
      .select()
      .single();
    if (error) {
      errEl.textContent = "Couldn't create team: " + error.message;
      errEl.hidden = false;
      return;
    }

    await sb.from("players").update({ team_id: newTeam.id }).eq("id", currentPlayer.id);
    await renderMyTeam();
    await loadTeamsList();
    if (currentPlayer.is_admin) await loadPendingTeams();
  });

  document.querySelectorAll(".join-team-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await sb.from("players").update({ team_id: btn.dataset.teamId }).eq("id", currentPlayer.id);
      await renderMyTeam();
    });
  });
}

// ---------- TEAMS TAB (browse approved teams) ----------
async function loadTeamsList() {
  const { data } = await sb.from("teams").select("*").eq("status", "approved").order("name");
  els.teamsList.innerHTML = "";

  if (!data || data.length === 0) {
    els.teamsList.innerHTML = `<p class="card card--muted">No approved teams yet.</p>`;
    return;
  }

  for (const team of data) {
    const { count } = await sb.from("players").select("*", { count: "exact", head: true }).eq("team_id", team.id);
    const row = document.createElement("div");
    row.className = "roster-row";
    row.innerHTML = `<span>${escapeHtml(team.name)}</span><span class="roster-row__tag">${count || 0} member${count === 1 ? "" : "s"}</span>`;
    els.teamsList.appendChild(row);
  }
}

// ---------- ADMIN: PENDING TEAM APPROVALS ----------
async function loadPendingTeams() {
  if (!els.pendingTeamsList) return;
  const { data } = await sb.from("teams").select("*").eq("status", "pending").order("created_at");
  els.pendingTeamsList.innerHTML = "";

  if (!data || data.length === 0) {
    els.pendingTeamsList.innerHTML = `<p class="card__sub">No teams waiting on approval.</p>`;
    return;
  }

  data.forEach((team) => {
    const row = document.createElement("div");
    row.className = "roster-row";
    row.innerHTML = `
      <span>${escapeHtml(team.name)}</span>
      <span>
        <button class="btn btn--primary approve-team-btn" data-id="${team.id}" style="padding:6px 12px;font-size:12px;">Approve</button>
        <button class="btn btn--secondary reject-team-btn" data-id="${team.id}" style="padding:6px 12px;font-size:12px;">Reject</button>
      </span>`;
    els.pendingTeamsList.appendChild(row);
  });

  document.querySelectorAll(".approve-team-btn").forEach((btn) =>
    btn.addEventListener("click", async () => {
      await sb.from("teams").update({ status: "approved" }).eq("id", btn.dataset.id);
      await loadPendingTeams();
      await loadTeamsList();
    })
  );
  document.querySelectorAll(".reject-team-btn").forEach((btn) =>
    btn.addEventListener("click", async () => {
      await sb.from("teams").update({ status: "rejected" }).eq("id", btn.dataset.id);
      await loadPendingTeams();
    })
  );
}

// ---------- ADMIN: WORKERS & TEAMS (Phase 1, kept as-is) ----------
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
    row.innerHTML = `<span>${escapeHtml(p.name)}${p.is_admin ? " (admin)" : ""}</span><span class="roster-row__tag">PIN ${escapeHtml(p.pin)}</span>`;
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
