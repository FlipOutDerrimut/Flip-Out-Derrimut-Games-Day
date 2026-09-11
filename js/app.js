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
  teamLeaderboard: document.getElementById("team-leaderboard"),
  sendCheerForm: document.getElementById("send-cheer-form"),
  cheerTargetType: document.getElementById("cheer-target-type"),
  cheerTeamField: document.getElementById("cheer-team-field"),
  cheerTeamSelect: document.getElementById("cheer-team-select"),
  cheerPlayerField: document.getElementById("cheer-player-field"),
  cheerPlayerSelect: document.getElementById("cheer-player-select"),
  cheerMessage: document.getElementById("cheer-message"),
  cheersFeed: document.getElementById("cheers-feed"),
  nominateForm: document.getElementById("nominate-form"),
  nominateCategory: document.getElementById("nominate-category"),
  nominatePlayer: document.getElementById("nominate-player"),
  awardsTally: document.getElementById("awards-tally"),
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
    await populateNominatePlayerSelect();
    await renderAwardsTally();
  }

  await renderMyTeam();
  await loadTeamsList();
  await renderTeamLeaderboard();
  await populateCheerTeamSelect();
  await populateCheerPlayerSelect();
  await loadCheersFeed();
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

// ---------- PHASE 3: TEAM LEADERBOARD ----------
async function renderTeamLeaderboard() {
  const { data: teams } = await sb.from("teams").select("id, name").eq("status", "approved");
  const { data: allCheers } = await sb.from("cheers").select("team_id");

  const counts = {};
  (allCheers || []).forEach((c) => {
    counts[c.team_id] = (counts[c.team_id] || 0) + 1;
  });

  const ranked = (teams || [])
    .map((t) => ({ name: t.name, score: counts[t.id] || 0 }))
    .sort((a, b) => b.score - a.score);

  els.teamLeaderboard.innerHTML = ranked.length
    ? ranked
        .map(
          (t, i) => `
      <div class="rank-row">
        <span class="rank-row__place">${i + 1}</span>
        <span class="rank-row__name">${escapeHtml(t.name)}</span>
        <span class="rank-row__score">${t.score} cheer${t.score === 1 ? "" : "s"}</span>
      </div>`
        )
        .join("")
    : `<p class="card__sub">No approved teams yet.</p>`;
}

// ---------- PHASE 3: SEND A CHEER ----------
async function populateCheerTeamSelect() {
  const { data: teams } = await sb.from("teams").select("id, name").eq("status", "approved").order("name");
  els.cheerTeamSelect.innerHTML = (teams || [])
    .map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`)
    .join("");
}

async function populateCheerPlayerSelect() {
  const { data: players } = await sb.from("players").select("id, name, team_id").not("team_id", "is", null).order("name");
  const { data: teams } = await sb.from("teams").select("id, name");
  const teamNameById = {};
  (teams || []).forEach((t) => (teamNameById[t.id] = t.name));

  els.cheerPlayerSelect.innerHTML = (players || [])
    .map(
      (p) =>
        `<option value="${p.id}" data-team-id="${p.team_id}">${escapeHtml(p.name)} (${escapeHtml(teamNameById[p.team_id] || "no team")})</option>`
    )
    .join("");
}

if (els.cheerTargetType) {
  els.cheerTargetType.addEventListener("change", () => {
    const isPlayer = els.cheerTargetType.value === "player";
    els.cheerTeamField.hidden = isPlayer;
    els.cheerPlayerField.hidden = !isPlayer;
  });
}

if (els.sendCheerForm) {
  els.sendCheerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const isPlayer = els.cheerTargetType.value === "player";
    const message = els.cheerMessage.value.trim() || null;

    let team_id, player_id;
    if (isPlayer) {
      const opt = els.cheerPlayerSelect.selectedOptions[0];
      if (!opt) return;
      player_id = opt.value;
      team_id = opt.dataset.teamId;
    } else {
      team_id = els.cheerTeamSelect.value;
      player_id = null;
      if (!team_id) return;
    }

    const { error } = await sb.from("cheers").insert({
      from_player_id: currentPlayer.id,
      team_id,
      player_id,
      message,
    });
    if (error) {
      alert("Couldn't send cheer: " + error.message);
      return;
    }

    els.cheerMessage.value = "";
    await renderTeamLeaderboard();
    await loadCheersFeed();
  });
}

async function loadCheersFeed() {
  const { data: cheersData } = await sb.from("cheers").select("*").order("created_at", { ascending: false }).limit(20);
  els.cheersFeed.innerHTML = "";

  if (!cheersData || cheersData.length === 0) {
    els.cheersFeed.innerHTML = `<p class="card__sub">No cheers yet — be the first!</p>`;
    return;
  }

  const playerIds = new Set();
  const teamIds = new Set();
  cheersData.forEach((c) => {
    if (c.from_player_id) playerIds.add(c.from_player_id);
    if (c.player_id) playerIds.add(c.player_id);
    if (c.team_id) teamIds.add(c.team_id);
  });

  const [{ data: players }, { data: teams }] = await Promise.all([
    sb.from("players").select("id, name").in("id", Array.from(playerIds)),
    sb.from("teams").select("id, name").in("id", Array.from(teamIds)),
  ]);
  const playerNameById = {};
  (players || []).forEach((p) => (playerNameById[p.id] = p.name));
  const teamNameById = {};
  (teams || []).forEach((t) => (teamNameById[t.id] = t.name));

  els.cheersFeed.innerHTML = cheersData
    .map((c) => {
      const fromName = playerNameById[c.from_player_id] || "Someone";
      const target = c.player_id ? playerNameById[c.player_id] || "a player" : teamNameById[c.team_id] || "a team";
      const time = new Date(c.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      return `
      <div class="cheer-item">
        <div>🎉 <strong>${escapeHtml(fromName)}</strong> cheered for <strong>${escapeHtml(target)}</strong>${c.message ? `: "${escapeHtml(c.message)}"` : ""}</div>
        <div class="cheer-item__meta">${time}</div>
      </div>`;
    })
    .join("");
}

// ---------- PHASE 3: ADMIN-ONLY DAILY AWARDS ----------
async function populateNominatePlayerSelect() {
  const { data: players } = await sb.from("players").select("id, name").order("name");
  els.nominatePlayer.innerHTML = (players || [])
    .map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`)
    .join("");
}

if (els.nominateForm) {
  els.nominateForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const category = els.nominateCategory.value;
    const player_id = els.nominatePlayer.value;
    if (!player_id) return;

    const { error } = await sb.from("category_awards").insert({
      category,
      player_id,
      nominated_by: currentPlayer.id,
    });
    if (error) {
      alert("Couldn't add nomination: " + error.message);
      return;
    }
    await renderAwardsTally();
  });
}

async function renderAwardsTally() {
  if (!els.awardsTally) return;
  const { data: awards } = await sb.from("category_awards").select("category, player_id");
  const { data: players } = await sb.from("players").select("id, name");
  const nameById = {};
  (players || []).forEach((p) => (nameById[p.id] = p.name));

  const byCategory = {};
  (awards || []).forEach((a) => {
    byCategory[a.category] = byCategory[a.category] || {};
    byCategory[a.category][a.player_id] = (byCategory[a.category][a.player_id] || 0) + 1;
  });

  const categories = Object.keys(byCategory);
  if (categories.length === 0) {
    els.awardsTally.innerHTML = `<p class="card__sub">No nominations yet.</p>`;
    return;
  }

  els.awardsTally.innerHTML = categories
    .map((cat) => {
      const ranked = Object.entries(byCategory[cat])
        .map(([playerId, count]) => ({ name: nameById[playerId] || "Unknown", count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      const rows = ranked
        .map((r) => `<div class="roster-row"><span>${escapeHtml(r.name)}</span><span class="roster-row__tag">${r.count} vote${r.count === 1 ? "" : "s"}</span></div>`)
        .join("");
      return `<p class="card__heading" style="margin-top:14px;">${escapeHtml(cat)}</p>${rows}`;
    })
    .join("");
}
