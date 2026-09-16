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
  weatherCard: document.getElementById("weather-card"),
  sunscreenForm: document.getElementById("sunscreen-form"),
  sunscreenPhoto: document.getElementById("sunscreen-photo"),
  sunscreenStatus: document.getElementById("sunscreen-status"),
  waterBtn: document.getElementById("water-btn"),
  waterStatus: document.getElementById("water-status"),
  tshirtForm: document.getElementById("tshirt-form"),
  tshirtSelect: document.getElementById("tshirt-select"),
  beachVoteList: document.getElementById("beach-vote-list"),
  countdownsList: document.getElementById("countdowns-list"),
  timetableList: document.getElementById("timetable-list"),
  addCountdownForm: document.getElementById("add-countdown-form"),
  newCountdownTitle: document.getElementById("new-countdown-title"),
  newCountdownTime: document.getElementById("new-countdown-time"),
  adminCountdownsList: document.getElementById("admin-countdowns-list"),
  addTimetableForm: document.getElementById("add-timetable-form"),
  newTimetableTime: document.getElementById("new-timetable-time"),
  newTimetableTitle: document.getElementById("new-timetable-title"),
  adminTimetableList: document.getElementById("admin-timetable-list"),
  addBeachForm: document.getElementById("add-beach-form"),
  beachSearchInput: document.getElementById("beach-search-input"),
  beachSearchResults: document.getElementById("beach-search-results"),
  beachSearchHint: document.getElementById("beach-search-hint"),
  addBeachSubmit: document.getElementById("add-beach-submit"),
  winningBeachNote: document.getElementById("winning-beach-note"),
  adminBeachList: document.getElementById("admin-beach-list"),
  eventDateForm: document.getElementById("event-date-form"),
  eventDateInput: document.getElementById("event-date-input"),
  playerProfileModal: document.getElementById("player-profile-modal"),
  playerProfileContent: document.getElementById("player-profile-content"),
  playerProfileClose: document.getElementById("player-profile-close"),
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

    const { data, error } = await sb.rpc("login_player", { p_name: name, p_pin: pin });
    const player = data && data[0];

    if (error || !player) {
      els.loginError.textContent = "No match for that name + PIN. Check with your admin.";
      els.loginError.hidden = false;
      return;
    }

    currentPlayer = player;
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
    els.adminTab.hidden = true; // reset so the next login on this device can't inherit admin access
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

  els.adminTab.hidden = true; // always start hidden; only unhidden below if this login is actually an admin
  if (currentPlayer.is_admin) {
    els.adminTab.hidden = false;
    await loadAdminData();
    await loadPendingTeams();
    await populateNominatePlayerSelect();
    await renderAwardsTally();
    await renderAdminCountdowns();
    await renderAdminTimetable();
    await renderAdminBeachOptions();
    await loadEventDateIntoAdminForm();
  }

  await loadEventSettings();
  await renderMyTeam();
  await loadTeamsList();
  await renderTeamLeaderboard();
  await populateCheerTeamSelect();
  await populateCheerPlayerSelect();
  await loadCheersFeed();
  await renderWeather();
  await renderWellbeingStatus();
  await renderMyDetails();
  await renderBeachVote();
  await renderSchedule();
}

// Re-fetch this player's own row (their team_id / player_number may have
// changed) and keep localStorage in sync.
async function refreshCurrentPlayer() {
  const { data } = await sb
    .from("players")
    .select("id, name, team_id, player_number, tshirt_size, is_admin, created_at")
    .eq("id", currentPlayer.id)
    .maybeSingle();
  if (data) {
    currentPlayer = { ...data, pin: currentPlayer.pin }; // pin isn't readable via a normal select anymore — keep the one captured at login
    localStorage.setItem(SESSION_KEY, JSON.stringify(currentPlayer));
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

// ---------- PHASE 6: PLAYER PROFILE / STATS MODAL ----------
function wireClickableNames(container) {
  container.querySelectorAll(".clickable-name").forEach((el) => {
    el.addEventListener("click", () => showPlayerProfile(el.dataset.playerId));
  });
}

async function showPlayerProfile(playerId) {
  els.playerProfileContent.innerHTML = "Loading…";
  els.playerProfileModal.hidden = false;

  const { data: player } = await sb
    .from("players")
    .select("id, name, team_id, player_number, tshirt_size, is_admin, created_at")
    .eq("id", playerId)
    .maybeSingle();
  if (!player) {
    els.playerProfileContent.innerHTML = `<p class="card__sub">Couldn't find that player.</p>`;
    return;
  }

  let teamName = "No team";
  if (player.team_id) {
    const { data: team } = await sb.from("teams").select("name").eq("id", player.team_id).maybeSingle();
    if (team) teamName = team.name;
  }

  const [{ data: myPoints }, { data: cheersSent }, { data: cheersReceived }] = await Promise.all([
    sb.from("points_log").select("points, reason").eq("player_id", playerId),
    sb.from("cheers").select("id").eq("from_player_id", playerId),
    sb.from("cheers").select("id").eq("player_id", playerId),
  ]);

  const totalPoints = (myPoints || []).reduce((sum, p) => sum + p.points, 0);
  const sunscreenCount = (myPoints || []).filter((p) => p.reason === "sunscreen").length;
  const waterCount = (myPoints || []).filter((p) => p.reason === "water").length;

  els.playerProfileContent.innerHTML = `
    <h3 class="team-header__name">${escapeHtml(player.name)}</h3>
    <p class="card__sub">${escapeHtml(teamName)}${player.player_number != null ? ` · #${player.player_number}` : ""}</p>
    <div class="stat-grid">
      <div class="stat-box"><div class="stat-box__num">${totalPoints}</div><div class="stat-box__label">Points earned</div></div>
      <div class="stat-box"><div class="stat-box__num">${(cheersReceived || []).length}</div><div class="stat-box__label">Cheers received</div></div>
      <div class="stat-box"><div class="stat-box__num">${(cheersSent || []).length}</div><div class="stat-box__label">Cheers sent</div></div>
      <div class="stat-box"><div class="stat-box__num">${sunscreenCount}</div><div class="stat-box__label">Sunscreen logs</div></div>
      <div class="stat-box"><div class="stat-box__num">${waterCount}</div><div class="stat-box__label">Water logs</div></div>
      <div class="stat-box"><div class="stat-box__num">${player.tshirt_size || "—"}</div><div class="stat-box__label">T-shirt size</div></div>
    </div>`;
}

if (els.playerProfileClose) {
  els.playerProfileClose.addEventListener("click", () => (els.playerProfileModal.hidden = true));
}
if (els.playerProfileModal) {
  els.playerProfileModal.addEventListener("click", (e) => {
    if (e.target === els.playerProfileModal) els.playerProfileModal.hidden = true;
  });
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
    .select("id, name, team_id, player_number, tshirt_size, is_admin")
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
    leaderSectionHtml = `<p class="card__sub" style="margin-top:12px;">Team leader: <span class="clickable-name" data-player-id="${leader.id}">${escapeHtml(leader.name)}</span> <span class="leader-star">★</span></p>`;
  }

  const rosterHtml = (members || [])
    .map(
      (m) => `
      <div class="member-row">
        <span>${m.player_number != null ? `<span class="member-row__number">${m.player_number}</span>` : ""}<span class="clickable-name" data-player-id="${m.id}">${escapeHtml(m.name)}</span>${m.id === team.leader_id ? '<span class="leader-star">★</span>' : ""}</span>
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

  wireClickableNames(els.myTeamSection);

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
      .insert({ name, logo_url: logoUrl })
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
    const { data: members, count } = await sb
      .from("players")
      .select("id, name, player_number", { count: "exact" })
      .eq("team_id", team.id)
      .order("player_number", { ascending: true, nullsFirst: false });

    const wrapper = document.createElement("div");
    wrapper.className = "card";
    wrapper.innerHTML = `
      <div class="roster-row" style="cursor:pointer;" data-toggle-team="${team.id}">
        <span>${escapeHtml(team.name)}</span>
        <span class="roster-row__tag">${count || 0} member${count === 1 ? "" : "s"}</span>
      </div>
      <div class="team-roster-expand" id="team-roster-${team.id}" hidden>
        ${(members || [])
          .map(
            (m) => `<div class="member-row">${m.player_number != null ? `<span class="member-row__number">${m.player_number}</span>` : ""}<span class="clickable-name" data-player-id="${m.id}">${escapeHtml(m.name)}</span></div>`
          )
          .join("") || `<p class="card__sub">No members yet.</p>`}
      </div>`;
    els.teamsList.appendChild(wrapper);
  }

  document.querySelectorAll("[data-toggle-team]").forEach((row) => {
    row.addEventListener("click", () => {
      const panel = document.getElementById(`team-roster-${row.dataset.toggleTeam}`);
      panel.hidden = !panel.hidden;
    });
  });
  wireClickableNames(els.teamsList);
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
      const { error } = await sb.rpc("admin_set_team_status", { p_team_id: btn.dataset.id, p_status: "approved", p_admin_pin: currentPlayer.pin });
      if (error) { alert("Couldn't approve team: " + error.message); return; }
      await loadPendingTeams();
      await loadTeamsList();
    })
  );
  document.querySelectorAll(".reject-team-btn").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const { error } = await sb.rpc("admin_set_team_status", { p_team_id: btn.dataset.id, p_status: "rejected", p_admin_pin: currentPlayer.pin });
      if (error) { alert("Couldn't reject team: " + error.message); return; }
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

  const { data: players } = await sb.rpc("admin_list_players", { p_admin_pin: currentPlayer.pin });
  els.adminPlayerList.innerHTML = "";
  (players || []).forEach((p) => {
    const row = document.createElement("div");
    row.className = "roster-row";
    row.innerHTML = `
      <span><span class="clickable-name" data-player-id="${p.id}">${escapeHtml(p.name)}</span>${p.is_admin ? " (admin)" : ""}</span>
      <span style="display:flex;align-items:center;gap:6px;">
        <span class="roster-row__tag">PIN ${escapeHtml(p.pin)}</span>
        <button class="btn btn--secondary edit-pin-btn" data-id="${p.id}" data-name="${escapeHtml(p.name)}" style="padding:5px 10px;font-size:11px;">Edit</button>
        <button class="btn btn--secondary delete-player-btn" data-id="${p.id}" data-name="${escapeHtml(p.name)}" style="padding:5px 10px;font-size:11px;">Delete</button>
      </span>`;
    els.adminPlayerList.appendChild(row);
  });
  wireClickableNames(els.adminPlayerList);

  document.querySelectorAll(".edit-pin-btn").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const newPin = prompt(`New PIN for ${btn.dataset.name}:`);
      if (!newPin || !newPin.trim()) return;
      const { error } = await sb.rpc("admin_update_player_pin", {
        p_target_id: btn.dataset.id,
        p_new_pin: newPin.trim(),
        p_admin_pin: currentPlayer.pin,
      });
      if (error) {
        alert("Couldn't update PIN: " + error.message);
        return;
      }
      await loadAdminData();
    })
  );

  document.querySelectorAll(".delete-player-btn").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!confirm(`Delete ${btn.dataset.name}? This can't be undone.`)) return;
      const { error } = await sb.rpc("admin_delete_player", {
        p_target_id: btn.dataset.id,
        p_admin_pin: currentPlayer.pin,
      });
      if (error) {
        alert("Couldn't delete worker: " + error.message);
        return;
      }
      await loadAdminData();
      await loadTeamsList();
      await renderTeamLeaderboard();
    })
  );
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

    const { data: newTeam, error } = await sb.from("teams").insert({ name }).select().single();
    if (error) {
      alert("Couldn't add team: " + error.message);
      return;
    }
    await sb.rpc("admin_set_team_status", { p_team_id: newTeam.id, p_status: "approved", p_admin_pin: currentPlayer.pin });
    e.target.reset();
    await loadAdminData();
    await loadTeamsList();
  });
}

// ---------- PHASE 3: TEAM LEADERBOARD ----------
let partyDateMs = null;

async function loadEventSettings() {
  const { data } = await sb.from("event_settings").select("party_date").eq("id", 1).maybeSingle();
  if (data) partyDateMs = new Date(data.party_date).getTime();
  renderPartyCountdownBanner();
}

async function renderTeamLeaderboard() {
  const { data: teams } = await sb.from("teams").select("id, name").eq("status", "approved");
  const { data: allPoints } = await sb.from("points_log").select("team_id, points, reason");

  const eventHasStarted = partyDateMs != null && Date.now() >= partyDateMs;

  const totals = {};
  (allPoints || []).forEach((p) => {
    if (!p.team_id) return;
    if (!eventHasStarted && p.reason !== "cheer") return; // sunscreen/water don't count until party day
    totals[p.team_id] = (totals[p.team_id] || 0) + p.points;
  });

  const ranked = (teams || [])
    .map((t) => ({ name: t.name, score: totals[t.id] || 0 }))
    .sort((a, b) => b.score - a.score);

  const noteHtml = eventHasStarted
    ? ""
    : `<p class="card__sub" style="margin-top:10px;">Cheers count now — sunscreen &amp; water points start counting on party day, keep logging so it's ready to go!</p>`;

  els.teamLeaderboard.innerHTML =
    (ranked.length
      ? ranked
          .map(
            (t, i) => `
      <div class="rank-row">
        <span class="rank-row__place">${i + 1}</span>
        <span class="rank-row__name">${escapeHtml(t.name)}</span>
        <span class="rank-row__score">${t.score} pts</span>
      </div>`
          )
          .join("")
      : `<p class="card__sub">No approved teams yet.</p>`) + noteHtml;
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
    await sb.from("points_log").insert({ player_id: currentPlayer.id, team_id, points: 10, reason: "cheer" });

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

// ---------- PHASE 4: WEATHER & SUNSCREEN TIP ----------
// Derrimut, VIC coordinates — overridden automatically by the winning beach vote if one is set.
let VENUE_LAT = -37.7838;
let VENUE_LON = 144.7502;
let lastKnownUvIndex = null;

async function renderWeather() {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${VENUE_LAT}&longitude=${VENUE_LON}&current=temperature_2m,uv_index&timezone=Australia%2FMelbourne`;
    const res = await fetch(url);
    const data = await res.json();
    const temp = data.current && data.current.temperature_2m;
    const uv = data.current && data.current.uv_index;
    lastKnownUvIndex = typeof uv === "number" ? uv : null;

    const tip = sunscreenTipFor(lastKnownUvIndex, temp);
    els.weatherCard.innerHTML = `
      <div class="weather-row">
        <span class="weather-row__temp">${temp != null ? Math.round(temp) + "°C" : "—"}</span>
        ${lastKnownUvIndex != null ? `<span class="card__sub">UV index ${lastKnownUvIndex.toFixed(1)}</span>` : ""}
      </div>
      <div class="weather-tip">${tip}</div>`;
  } catch (e) {
    els.weatherCard.innerHTML = `<p class="card__sub">Couldn't load weather right now.</p>`;
  }
}

function sunscreenTipFor(uv, temp) {
  if (uv != null) {
    if (uv >= 8) return "UV is extreme today — reapply sunscreen every 1.5–2 hours.";
    if (uv >= 6) return "UV is high — reapply sunscreen every 2 hours.";
    if (uv >= 3) return "UV is moderate — reapply sunscreen every 3 hours.";
    return "UV is low right now, but still worth reapplying every 3–4 hours.";
  }
  if (temp != null && temp >= 30) return "It's a hot one — reapply sunscreen every 2 hours.";
  return "Reapply sunscreen every 2–3 hours to stay safe out there.";
}

function reapplyIntervalMinutes() {
  if (lastKnownUvIndex != null) {
    if (lastKnownUvIndex >= 8) return 90;
    if (lastKnownUvIndex >= 6) return 120;
    return 180;
  }
  return 150;
}

// ---------- PHASE 4: SUNSCREEN & WATER LOGGING ----------
function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

async function renderWellbeingStatus() {
  const { data: todaysLogs } = await sb
    .from("points_log")
    .select("*")
    .eq("player_id", currentPlayer.id)
    .gte("created_at", startOfTodayIso())
    .order("created_at", { ascending: false });

  const sunscreenLogs = (todaysLogs || []).filter((l) => l.reason === "sunscreen");
  const waterLogs = (todaysLogs || []).filter((l) => l.reason === "water");

  let reminderHtml = "";
  if (sunscreenLogs.length === 0) {
    els.sunscreenStatus.textContent = "You haven't logged sunscreen yet today.";
    reminderHtml = `<div class="reminder-banner">☀️ Don't forget your first sunscreen application!</div>`;
  } else {
    const lastTime = new Date(sunscreenLogs[0].created_at);
    const minsAgo = Math.round((Date.now() - lastTime.getTime()) / 60000);
    els.sunscreenStatus.textContent = `Last applied ${lastTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} (${sunscreenLogs.length} time${sunscreenLogs.length === 1 ? "" : "s"} today).`;
    if (minsAgo >= reapplyIntervalMinutes()) {
      reminderHtml = `<div class="reminder-banner">☀️ Time to reapply sunscreen — it's been ${minsAgo} minutes!</div>`;
    }
  }
  const existingBanner = document.querySelector("#view-wellbeing .reminder-banner");
  if (existingBanner) existingBanner.remove();
  if (reminderHtml) els.weatherCard.parentElement.insertAdjacentHTML("beforebegin", reminderHtml);

  els.waterStatus.textContent =
    waterLogs.length === 0 ? "You haven't logged water today." : `${waterLogs.length} water break${waterLogs.length === 1 ? "" : "s"} logged today.`;
}

async function logPoints(reason, points, photoFile) {
  let photo_url = null;
  if (photoFile) {
    const path = `${currentPlayer.id}-${Date.now()}-${photoFile.name}`;
    const { error: uploadError } = await sb.storage.from("proof-photos").upload(path, photoFile);
    if (!uploadError) {
      photo_url = sb.storage.from("proof-photos").getPublicUrl(path).data.publicUrl;
    }
  }
  await sb.from("points_log").insert({
    player_id: currentPlayer.id,
    team_id: currentPlayer.team_id,
    points,
    reason,
    photo_url,
  });
  await renderWellbeingStatus();
  await renderTeamLeaderboard();
}

if (els.sunscreenForm) {
  els.sunscreenForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = els.sunscreenPhoto.files[0] || null;
    await logPoints("sunscreen", 10, file);
    els.sunscreenForm.reset();
  });
}

if (els.waterBtn) {
  els.waterBtn.addEventListener("click", async () => {
    await logPoints("water", 5, null);
  });
}

// ---------- PHASE 5: T-SHIRT SIZE ----------
async function renderMyDetails() {
  if (els.tshirtSelect) els.tshirtSelect.value = currentPlayer.tshirt_size || "";
}

if (els.tshirtForm) {
  els.tshirtForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const size = els.tshirtSelect.value;
    if (!size) return;
    await sb.from("players").update({ tshirt_size: size }).eq("id", currentPlayer.id);
    currentPlayer.tshirt_size = size;
    localStorage.setItem(SESSION_KEY, JSON.stringify(currentPlayer));
  });
}

// ---------- PHASE 5/6: BEACH VOTE ----------
async function renderBeachVote() {
  const { data: options } = await sb.from("beach_options").select("*").order("created_at");
  const { data: votes } = await sb.from("beach_votes").select("beach_id, player_id");

  const counts = {};
  (votes || []).forEach((v) => (counts[v.beach_id] = (counts[v.beach_id] || 0) + 1));
  const myVote = (votes || []).find((v) => v.player_id === currentPlayer.id);

  if (!options || options.length === 0) {
    els.beachVoteList.innerHTML = `<p class="card__sub">No beach options yet — search above to suggest one!</p>`;
    els.winningBeachNote.hidden = true;
    return;
  }

  els.beachVoteList.innerHTML = options
    .map(
      (o) => `
      <div class="beach-option ${myVote && myVote.beach_id === o.id ? "is-selected" : ""}" data-beach-id="${o.id}">
        <span>${escapeHtml(o.name)}</span>
        <span class="roster-row__tag">${counts[o.id] || 0} vote${(counts[o.id] || 0) === 1 ? "" : "s"}</span>
      </div>`
    )
    .join("");

  document.querySelectorAll(".beach-option").forEach((el) => {
    el.addEventListener("click", async () => {
      await sb.from("beach_votes").upsert({ player_id: currentPlayer.id, beach_id: el.dataset.beachId }, { onConflict: "player_id" });
      await renderBeachVote();
    });
  });

  // Winning beach (most votes) drives the Wellbeing weather location, if it has coordinates.
  let winner = null;
  let bestCount = 0;
  options.forEach((o) => {
    const c = counts[o.id] || 0;
    if (c > bestCount) {
      bestCount = c;
      winner = o;
    }
  });

  if (winner && bestCount > 0 && winner.lat != null && winner.lng != null) {
    VENUE_LAT = winner.lat;
    VENUE_LON = winner.lng;
    els.winningBeachNote.hidden = false;
    els.winningBeachNote.textContent = `🏆 ${winner.name} is winning — the Wellbeing tab's weather now uses this location.`;
    await renderWeather();
  } else {
    els.winningBeachNote.hidden = true;
  }
}

// ---------- PHASE 6: BEACH SEARCH (free OpenStreetMap/Nominatim lookup — no API key, no cost) ----------
let selectedBeachResult = null;
let beachSearchDebounce = null;

if (els.beachSearchInput) {
  els.beachSearchInput.addEventListener("input", () => {
    selectedBeachResult = null;
    els.addBeachSubmit.disabled = true;
    clearTimeout(beachSearchDebounce);
    const query = els.beachSearchInput.value.trim();
    if (query.length < 3) {
      els.beachSearchResults.innerHTML = "";
      return;
    }
    beachSearchDebounce = setTimeout(() => searchBeaches(query), 600);
  });
}

async function searchBeaches(query) {
  els.beachSearchHint.textContent = "Searching…";
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query + " beach")}`;
    const res = await fetch(url);
    const results = await res.json();

    if (!results.length) {
      els.beachSearchResults.innerHTML = "";
      els.beachSearchHint.textContent = "No matches — try a different spelling or add the suburb/state.";
      return;
    }

    els.beachSearchHint.textContent = "Tap the correct beach:";
    els.beachSearchResults.innerHTML = results
      .map(
        (r, i) => `<div class="beach-result" data-index="${i}">${escapeHtml(r.display_name)}</div>`
      )
      .join("");

    document.querySelectorAll(".beach-result").forEach((el, i) => {
      el.addEventListener("click", () => {
        document.querySelectorAll(".beach-result").forEach((r) => r.classList.remove("is-selected"));
        el.classList.add("is-selected");
        selectedBeachResult = results[i];
        els.addBeachSubmit.disabled = false;
        els.beachSearchHint.textContent = "Selected — tap \"Add this beach\" below.";
      });
    });
  } catch (e) {
    els.beachSearchHint.textContent = "Couldn't search right now — check your connection and try again.";
  }
}

if (els.addBeachForm) {
  els.addBeachForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!selectedBeachResult) return;

    const shortName = els.beachSearchInput.value.trim();
    await sb.from("beach_options").insert({
      name: shortName,
      lat: parseFloat(selectedBeachResult.lat),
      lng: parseFloat(selectedBeachResult.lon),
    });

    els.beachSearchInput.value = "";
    els.beachSearchResults.innerHTML = "";
    els.beachSearchHint.textContent = "Search and tap a result to select it before adding.";
    els.addBeachSubmit.disabled = true;
    selectedBeachResult = null;

    await renderBeachVote();
    if (currentPlayer.is_admin) await renderAdminBeachOptions();
  });
}

// ---------- PHASE 5: SCHEDULE (countdowns + timetable, public view) ----------
let countdownTickHandle = null;

async function renderSchedule() {
  const { data: countdowns } = await sb.from("countdowns").select("*").order("target_time");
  els.countdownsList.innerHTML = (countdowns && countdowns.length)
    ? countdowns
        .map((c) => `<div class="countdown-item" data-target="${c.target_time}"><div class="countdown-item__title">${escapeHtml(c.title)}</div><div class="countdown-item__time">—</div></div>`)
        .join("")
    : `<p class="card__sub">No countdowns set yet.</p>`;

  const { data: items } = await sb.from("timetable_items").select("*").order("sort_order").order("created_at");
  els.timetableList.innerHTML = (items && items.length)
    ? items.map((i) => `<div class="timetable-item"><span class="timetable-item__time">${escapeHtml(i.time_label)}</span><span>${escapeHtml(i.title)}</span></div>`).join("")
    : `<p class="card__sub">No timetable items yet.</p>`;

  tickCountdowns();
  if (!countdownTickHandle) {
    countdownTickHandle = setInterval(tickCountdowns, 1000);
  }
}

function tickCountdowns() {
  document.querySelectorAll("#countdowns-list .countdown-item").forEach((el) => {
    const target = new Date(el.dataset.target).getTime();
    const diff = target - Date.now();
    const timeEl = el.querySelector(".countdown-item__time");
    if (diff <= 0) {
      timeEl.textContent = "Now!";
      return;
    }
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    timeEl.textContent = `${h}h ${m}m ${s}s`;
  });

  const partyEl = document.querySelector(".party-countdown");
  if (partyEl && partyEl.dataset.target) {
    const diff = new Date(partyEl.dataset.target).getTime() - Date.now();
    const timeEl = partyEl.querySelector(".party-countdown__time");
    if (diff <= 0) {
      timeEl.textContent = "It's party time! 🎉";
    } else {
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      timeEl.textContent = `${d}d ${h}h ${m}m ${s}s`;
    }
  }
}

// ---------- EVENT SETTINGS: PARTY COUNTDOWN + ADMIN CONTROL ----------
function renderPartyCountdownBanner() {
  const partyEl = document.querySelector(".party-countdown");
  if (partyEl && partyDateMs != null) {
    partyEl.dataset.target = new Date(partyDateMs).toISOString();
  }
  tickCountdowns();
  if (!countdownTickHandle) {
    countdownTickHandle = setInterval(tickCountdowns, 1000);
  }
}

async function loadEventDateIntoAdminForm() {
  if (!els.eventDateInput) return;
  const { data } = await sb.from("event_settings").select("party_date").eq("id", 1).maybeSingle();
  if (data) {
    const local = new Date(data.party_date);
    local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
    els.eventDateInput.value = local.toISOString().slice(0, 16);
  }
}

if (els.eventDateForm) {
  els.eventDateForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const value = els.eventDateInput.value;
    if (!value) return;
    await sb.from("event_settings").update({ party_date: new Date(value).toISOString() }).eq("id", 1);
    await loadEventSettings();
    renderPartyCountdownBanner();
    await renderTeamLeaderboard();
    alert("Party date updated!");
  });
}

// ---------- PHASE 5: ADMIN — COUNTDOWNS ----------
async function renderAdminCountdowns() {
  if (!els.adminCountdownsList) return;
  const { data } = await sb.from("countdowns").select("*").order("target_time");
  els.adminCountdownsList.innerHTML = (data || [])
    .map(
      (c) => `<div class="roster-row"><span>${escapeHtml(c.title)} — ${new Date(c.target_time).toLocaleString()}</span><button class="btn btn--secondary delete-countdown-btn" data-id="${c.id}" style="padding:6px 12px;font-size:12px;">Delete</button></div>`
    )
    .join("");
  document.querySelectorAll(".delete-countdown-btn").forEach((btn) =>
    btn.addEventListener("click", async () => {
      await sb.from("countdowns").delete().eq("id", btn.dataset.id);
      await renderAdminCountdowns();
      await renderSchedule();
    })
  );
}

if (els.addCountdownForm) {
  els.addCountdownForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = els.newCountdownTitle.value.trim();
    const targetLocal = els.newCountdownTime.value;
    if (!title || !targetLocal) return;
    await sb.from("countdowns").insert({ title, target_time: new Date(targetLocal).toISOString() });
    e.target.reset();
    await renderAdminCountdowns();
    await renderSchedule();
  });
}

// ---------- PHASE 5: ADMIN — TIMETABLE ----------
async function renderAdminTimetable() {
  if (!els.adminTimetableList) return;
  const { data } = await sb.from("timetable_items").select("*").order("sort_order").order("created_at");
  els.adminTimetableList.innerHTML = (data || [])
    .map(
      (i) => `<div class="roster-row"><span>${escapeHtml(i.time_label)} — ${escapeHtml(i.title)}</span><button class="btn btn--secondary delete-timetable-btn" data-id="${i.id}" style="padding:6px 12px;font-size:12px;">Delete</button></div>`
    )
    .join("");
  document.querySelectorAll(".delete-timetable-btn").forEach((btn) =>
    btn.addEventListener("click", async () => {
      await sb.from("timetable_items").delete().eq("id", btn.dataset.id);
      await renderAdminTimetable();
      await renderSchedule();
    })
  );
}

if (els.addTimetableForm) {
  els.addTimetableForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const time_label = els.newTimetableTime.value.trim();
    const title = els.newTimetableTitle.value.trim();
    if (!time_label || !title) return;
    await sb.from("timetable_items").insert({ time_label, title });
    e.target.reset();
    await renderAdminTimetable();
    await renderSchedule();
  });
}

// ---------- PHASE 5: ADMIN — BEACH OPTIONS (management/delete only — adding happens on the public Beach tab) ----------
async function renderAdminBeachOptions() {
  if (!els.adminBeachList) return;
  const { data } = await sb.from("beach_options").select("*").order("created_at");
  els.adminBeachList.innerHTML = (data || [])
    .map(
      (b) => `<div class="roster-row"><span>${escapeHtml(b.name)}</span><button class="btn btn--secondary delete-beach-btn" data-id="${b.id}" style="padding:6px 12px;font-size:12px;">Delete</button></div>`
    )
    .join("");
  document.querySelectorAll(".delete-beach-btn").forEach((btn) =>
    btn.addEventListener("click", async () => {
      await sb.from("beach_options").delete().eq("id", btn.dataset.id);
      await renderAdminBeachOptions();
      await renderBeachVote();
    })
  );
}
