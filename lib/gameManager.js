// lib/gameManager.js
// In-memory game manager. Works for demo (no external DB).
// WARNING: ephemeral storage in serverless.

const MAX_PLAYERS = 10;
const MIN_PLAYERS = 5;

const rooms = {}; // { roomId: { ... } }
const timers = {}; // intervals per room

function makeId(len = 6) {
  return Math.random().toString(36).substring(2, 2 + len);
}

/* Role assignment rules (interpretasi dari spec user + caps)
 Base for 5 players: 3 Innocent, 1 Neutral, 1 Werewolf
 For 6-7: each extra player adds +1 Innocent and +1 Neutral
 For 8-10: each extra player adds +2 Innocent and +1 Werewolf
 Final caps enforced: Innocent max 6, Neutral max 2, Werewolf max 2
 After calculating, we clamp and adjust so totals == playerCount.
*/
function computeRolesByCount(n) {
  if (n < MIN_PLAYERS || n > MAX_PLAYERS) throw new Error("invalid player count");
  let I = 3, N = 1, W = 1;
  if (n >= 6 && n <= 7) {
    const extra = n - 5;
    I += extra;
    N += extra;
  } else if (n >= 8) {
    // start from 5, add for 6-7 first
    I += 2; N += 2; // for 7
    let remaining = n - 7;
    // for each remaining up to 3 (8,9,10) add +2I and +1W
    I += remaining * 2;
    W += remaining * 1;
  }
  // apply caps
  I = Math.min(I, 6);
  N = Math.min(N, 2);
  W = Math.min(W, 2);

  // Ensure sum equals n: if short, add innocents; if over, reduce innocents
  let sum = I + N + W;
  if (sum < n) {
    I += (n - sum);
  } else if (sum > n) {
    // reduce innocents to match
    I -= (sum - n);
    if (I < 0) I = 0;
  }
  return { innocent: I, neutral: N, werewolf: W };
}

function shuffle(a) { return a.sort(() => Math.random() - 0.5); }

function createRoom(hostId, username) {
  const roomId = makeId(5);
  rooms[roomId] = {
    id: roomId,
    host: hostId,
    players: [{ id: hostId, username, alive: true, role: null, meta: {} }],
    status: "waiting", // waiting | playing | ended
    phase: "waiting", // night, morning, discussion, voting
    round: 0,
    timeLeft: 0,
    votes: {}, // { voterId: targetId }
    lastKill: null,
    logs: [],
    settings: {
      discussionSeconds: 75,
      votingSeconds: 15,
      nightSeconds: 30,
      morningSeconds: 5
    },
    // role-specific state
    banditMarks: {}, // { playerId: remainingMarks } (bandit player -> remaining)
    witchHelper: null, // { id: playerId (helper), by: witchId }
    witchRevivedPlayer: null,
    startedAt: null
  };
  return rooms[roomId];
}

function getRoom(roomId) {
  return rooms[roomId] || null;
}

function joinRoom(roomId, playerId, username) {
  const room = getRoom(roomId);
  if (!room) throw new Error("Room not found");
  if (room.players.length >= MAX_PLAYERS) throw new Error("Room full");
  if (room.status !== "waiting") throw new Error("Game already started");
  if (room.players.find(p => p.username === username)) throw new Error("Username taken in room");
  room.players.push({ id: playerId, username, alive: true, role: null, meta: {} });
  return room;
}

function assignRoles(roomId) {
  const room = getRoom(roomId);
  if (!room) throw new Error("Room not found");
  const players = room.players;
  const n = players.length;
  if (n < MIN_PLAYERS) throw new Error("Not enough players");
  const counts = computeRolesByCount(n);
  const roles = [];
  for (let i = 0; i < counts.innocent; i++) roles.push("innocent");
  for (let i = 0; i < counts.neutral; i++) roles.push("neutral");
  for (let i = 0; i < counts.werewolf; i++) roles.push("werewolf");
  shuffle(roles);
  players.forEach((p, i) => {
    p.role = roles[i];
    p.alive = true;
    p.meta = {
      // per-role extra states
      guardProtectedThisRound: false,
      dukunUsesLeft: p.role === "innocent" && false, // not all have dukun role; we'll assign special subroles later
      isHelper: false,
      banditMarksLeft: p.role === "neutral" ? 2 : 0 // but only BANDIT has this; we will distribute neutral subroles
    };
  });

  // Now we must assign *subroles* inside fraksi per spec:
  // For Innocent: could be Warga biasa, Penjaga, Pemburu, Dukun (some players)
  // For Neutral: Bandit, Penyihir
  // For Werewolf: Werewolf (one or more)
  // We'll assign subroles as follows to keep game interesting:
  const innocents = players.filter(p => p.role === "innocent");
  const neutrals = players.filter(p => p.role === "neutral");
  const werewolves = players.filter(p => p.role === "werewolf");

  // Innocent subroles distribution (prioritize 1 guard, 1 hunter, 1 dukun if possible)
  if (innocents.length > 0) {
    const picks = shuffle(innocents);
    // 1 Penjaga if at least 1 innocent
    picks[0].meta.subrole = "warga";
    if (picks.length >= 2) picks[1].meta.subrole = "penjaga";
    if (picks.length >= 3) picks[2].meta.subrole = "pemburu";
    if (picks.length >= 4) picks[3].meta.subrole = "dukun";
    for (let i = 4; i < picks.length; i++) picks[i].meta.subrole = "warga";
    // set dukun use count
    picks.slice(0,4).forEach(P => {
      if (P.meta.subrole === "dukun") P.meta.dukunUses = 2;
    });
  }

  // Neutral subroles: if neutrals.length>=1 assign 1 bandit, 1 penyihir (if >=2). If only 1 neutral, randomly choose.
  if (neutrals.length > 0) {
    if (neutrals.length === 1) {
      const n0 = neutrals[0];
      n0.meta.subrole = Math.random() < 0.5 ? "bandit" : "penyihir";
      if (n0.meta.subrole === "bandit") n0.meta.marksLeft = 2;
    } else {
      neutrals[0].meta.subrole = "bandit"; neutrals[0].meta.marksLeft = 2;
      neutrals[1].meta.subrole = "penyihir"; neutrals[1].meta.hasHelper = false;
      for (let i = 2; i < neutrals.length; i++) neutrals[i].meta.subrole = "bandit";
    }
  }

  // werewolf subroles: all are werewolves
  werewolves.forEach(w => w.meta.subrole = "werewolf");

  room.status = "ready";
  room.logs.push({ t: Date.now(), text: `Roles assigned. Players: ${players.map(p=>p.username).join(", ")}` });
  return room;
}

/* Game flow:
 * - startGame: initialize round = 0, phase = night (first)
 * - runPhase automatically via setInterval
 * - phases: night -> morning -> discussion -> voting -> back to night
 * - skills are provided via actions from clients: e.g. night actions: werewolf_kill, guard_protect, hunter_shoot, dukun_read, bandit_mark, witch_revive
 * - We collect actions in room.pendingActions then resolve at morning according to priority.
*/
function startGame(roomId) {
  const room = getRoom(roomId);
  if (!room) throw new Error("Room not found");
  if (room.status === "playing") throw new Error("already started");
  room.status = "playing";
  room.round = 0;
  room.phase = "night";
  room.pendingActions = []; // collected actions this night
  room.votes = {};
  room.startedAt = Date.now();
  stepRoomPhase(roomId);
  // set interval tick every second to countdown timeLeft
  if (timers[roomId]) clearInterval(timers[roomId]);
  timers[roomId] = setInterval(() => tick(roomId), 1000);
  return room;
}

function tick(roomId) {
  const room = getRoom(roomId);
  if (!room) {
    clearInterval(timers[roomId]); delete timers[roomId]; return;
  }
  if (room.timeLeft > 0) {
    room.timeLeft -= 1;
  } else {
    // time ended for this phase -> advance
    advancePhase(roomId);
  }
}

function stepRoomPhase(roomId) {
  const room = getRoom(roomId);
  if (!room) return;
  if (room.phase === "waiting") return;
  if (room.phase === "night") {
    room.timeLeft = room.settings.nightSeconds;
  } else if (room.phase === "morning") {
    room.timeLeft = room.settings.morningSeconds;
  } else if (room.phase === "discussion") {
    room.timeLeft = room.settings.discussionSeconds;
  } else if (room.phase === "voting") {
    room.timeLeft = room.settings.votingSeconds;
    // reset votes map for this voting period (unless it's revote logic handled externally)
    room.votes = {};
  }
}

function advancePhase(roomId) {
  const room = getRoom(roomId);
  if (!room) return;
  if (room.phase === "night") {
    room.phase = "morning";
    resolveNightActions(roomId);
  } else if (room.phase === "morning") {
    room.phase = "discussion";
  } else if (room.phase === "discussion") {
    room.phase = "voting";
  } else if (room.phase === "voting") {
    // process voting
    const outcome = tallyVotes(roomId);
    if (outcome.tied && outcome.tiedPlayers.length > 0) {
      // Revote: tied players cannot vote (per spec)
      room.logs.push({ t: Date.now(), text: `Vote tie between ${outcome.tiedPlayers.map(p=>p.username).join(", ")}. Starting revote; tied players cannot vote.` });
      // prepare revote: restrict voters
      room.revoting = {
        active: true,
        candidates: outcome.tiedPlayers.map(p => p.id),
        excludedFromVoting: outcome.tiedPlayers.map(p => p.id)
      };
      room.phase = "voting"; // re-enter voting phase
      room.timeLeft = room.settings.votingSeconds;
      room.votes = {};
      return;
    } else if (outcome.kickedPlayer) {
      // eliminate the voted player (unless they are witch helper which is invulnerable)
      const p = room.players.find(x => x.id === outcome.kickedPlayer.id);
      if (p) {
        // If player is witch helper -> invulnerable; only witch dying kills helper
        if (room.witchHelper && room.witchHelper.id === p.id) {
          room.logs.push({ t: Date.now(), text: `${p.username} is protected as Witch's helper; cannot be voted out.` });
        } else {
          p.alive = false;
          room.logs.push({ t: Date.now(), text: `${p.username} was voted out.` });
        }
      }
    }
    // end revote flags if any
    room.revoting = null;
    room.phase = "night";
    room.round += 1;
  }
  // after switching, set countdown for new phase
  stepRoomPhase(roomId);
  // after some phase changes check win condition
  checkWin(roomId);
}

function resolveNightActions(roomId) {
  const room = getRoom(roomId);
  if (!room) return;
  // pendingActions contains objects like { type, actorId, targetId, extra }
  const actions = room.pendingActions || [];
  room.pendingActions = [];

  // We'll implement priority:
  // 1. Guard protect (prevents kills)
  // 2. Bandit mark (applies mark that affects skill usage)
  // 3. Werewolf kill (one or many)
  // 4. Hunter shoot (immediate)
  // 5. Dukun read (just info)
  // 6. Witch revive (revive dead; revives into helper neutral)
  // Implementation is simplified but follows spec.

  // Build quick maps
  const playersById = {};
  room.players.forEach(p => playersById[p.id] = p);

  // collect protections
  const protectedIds = new Set();
  actions.filter(a => a.type === "guard_protect").forEach(a => {
    if (playersById[a.targetId] && playersById[a.actorId].alive) protectedIds.add(a.targetId);
    room.logs.push({ t: Date.now(), text: `${playersById[a.actorId].username} protects ${playersById[a.targetId].username}` });
  });

  // apply bandit marks
  actions.filter(a => a.type === "bandit_mark").forEach(a => {
    const bandit = playersById[a.actorId];
    if (!bandit || !bandit.alive) return;
    if (!bandit.meta.marksLeft) bandit.meta.marksLeft = 2;
    bandit.meta.marksLeft = Math.max(0, bandit.meta.marksLeft - 1);
    const target = playersById[a.targetId];
    if (target) {
      // mark flag
      if (!target.meta) target.meta = {};
      target.meta.markedBy = bandit.id;
      room.logs.push({ t: Date.now(), text: `${bandit.username} marks ${target.username}. Marks left: ${bandit.meta.marksLeft}` });
    }
  });

  // werewolf kills: if multiple werewolves choose, pick most voted target or first specified; for simplicity, choose first target among actions
  const werewolfActions = actions.filter(a => a.type === "werewolf_kill" && playersById[a.actorId] && playersById[a.actorId].alive);
  if (werewolfActions.length > 0) {
    const targetId = werewolfActions[0].targetId;
    const target = playersById[targetId];
    if (target && !protectedIds.has(targetId)) {
      // If target is witch helper -> invulnerable
      if (room.witchHelper && room.witchHelper.id === targetId) {
        room.logs.push({ t: Date.now(), text: `${target.username} was targeted by werewolves but is Witch's helper (invulnerable).` });
      } else {
        target.alive = false;
        room.lastKill = { by: "werewolf", id: targetId };
        room.logs.push({ t: Date.now(), text: `${target.username} was killed by werewolves.` });
      }
    } else if (target) {
      room.logs.push({ t: Date.now(), text: `${target.username} was attacked but protected.` });
    }
  }

  // hunter shoot
  const hunterActions = actions.filter(a => a.type === "hunter_shoot" && playersById[a.actorId] && playersById[a.actorId].alive);
  hunterActions.forEach(a => {
    const hunter = playersById[a.actorId];
    const target = playersById[a.targetId];
    if (!hunter || !target) return;
    if (!protectedIds.has(target.id)) {
      // hunter dies together with target if target is innocent (spec): 
      // spec says: if the shot target is fraksi Innocent then hunter will also die together with target.
      const targetRole = target.role;
      target.alive = false;
      room.logs.push({ t: Date.now(), text: `${hunter.username} shot ${target.username}. ${target.username} died.` });
      if (targetRole === "innocent") {
        hunter.alive = false;
        room.logs.push({ t: Date.now(), text: `${hunter.username} died together with their target (friendly fire).` });
      }
    } else {
      room.logs.push({ t: Date.now(), text: `${hunter.username} tried to shoot ${target.username} but they were protected.` });
    }
  });

  // dukun reads (we'll store result in room.lastDukunRead)
  actions.filter(a => a.type === "dukun_read" && playersById[a.actorId] && playersById[a.actorId].alive).forEach(a => {
    const target = playersById[a.targetId];
    if (target) {
      room.lastDukunRead = { reader: a.actorId, targetId: a.targetId, role: target.role };
      room.logs.push({ t: Date.now(), text: `${playersById[a.actorId].username} read ${target.username} (result stored).` });
      const reader = playersById[a.actorId];
      if (reader.meta && typeof reader.meta.dukunUses === "number") {
        reader.meta.dukunUses = Math.max(0, reader.meta.dukunUses - 1);
      }
    }
  });

  // witch revive (penyihir)
  actions.filter(a => a.type === "witch_revive" && playersById[a.actorId] && playersById[a.actorId].alive).forEach(a => {
    const witch = playersById[a.actorId];
    const deadPlayer = room.players.find(p => p.id === a.targetId && !p.alive);
    if (deadPlayer && !room.witchHelper) {
      // revive: player becomes alive and becomes witch helper (neutral helper)
      deadPlayer.alive = true;
      deadPlayer.role = "neutral";
      deadPlayer.meta.subrole = "witch_helper";
      room.witchHelper = { id: deadPlayer.id, by: witch.id };
      room.logs.push({ t: Date.now(), text: `${witch.username} revived ${deadPlayer.username} as their helper (neutral).` });
    }
  });

  // apply bandit mark consequences:
  // If someone marked uses a special skill this night (e.g., hunter_shoot, dukun_read, witch_revive, werewolf_kill?), they die.
  const skillUsingPlayers = new Set(actions.filter(a => ["hunter_shoot","dukun_read","witch_revive"].includes(a.type)).map(a=>a.actorId));
  room.players.forEach(p => {
    if (p.meta && p.meta.markedBy && skillUsingPlayers.has(p.id)) {
      // target dies
      // But per spec: "Warga bisa ditandai ... tetapi mereka tidak akan bisa mati, karena tidak memiliki skill khusus"
      // So if p.role === 'innocent' and p has no special skill, they won't be killed. We check p.meta.subrole.
      if (p.role === "innocent" && (!p.meta.subrole || p.meta.subrole === "warga")) {
        // innocent "warga" does not die due to mark
        room.logs.push({ t: Date.now(), text: `${p.username} was marked but had no special skill, so mark had no effect.` });
      } else {
        // die
        p.alive = false;
        room.logs.push({ t: Date.now(), text: `${p.username} died due to being marked and using skill.` });
        // bandit gains 1 mark-usage bonus
        const banditId = p.meta.markedBy;
        const bandit = playersById[banditId];
        if (bandit) {
          bandit.meta.marksLeft = (bandit.meta.marksLeft || 0) + 1;
          room.logs.push({ t: Date.now(), text: `${bandit.username} gains +1 mark chance for successful kill.` });
        }
      }
      // clear mark
      delete p.meta.markedBy;
    }
  });

  // bandit dies if marksLeft == 0?
  room.players.forEach(p => {
    if (p.meta && p.meta.subrole === "bandit") {
      if ((p.meta.marksLeft || 0) <= 0) {
        // per spec: "Jika kesempatan Bandit habis, maka ia akan mati."
        p.alive = false;
        room.logs.push({ t: Date.now(), text: `${p.username} (Bandit) ran out of marks and died.` });
      }
    }
  });

  // After resolution, clear lastKill if needed and housekeeping
  // Reset protection flags
  room.players.forEach(p => { p.meta.guardProtectedThisRound = false; });

  // finally check win condition
  checkWin(roomId);
}

function collectAction(roomId, action) {
  const room = getRoom(roomId);
  if (!room) throw new Error("Room not found");
  if (!room.pendingActions) room.pendingActions = [];
  room.pendingActions.push(action);
  // also log
  room.logs.push({ t: Date.now(), text: `Action collected: ${action.type} by ${action.actorId}` });
}

function tallyVotes(roomId) {
  const room = getRoom(roomId);
  if (!room) return {};
  // room.votes: { voterId: targetId }
  // If revoting is active and we have excluded voters, they can't vote
  const votes = {};
  Object.entries(room.votes).forEach(([voter, target]) => {
    // exclude self votes if voter is excluded from voting on revote stage
    if (room.revoting && room.revoting.excludedFromVoting && room.revoting.excludedFromVoting.includes(voter)) {
      // skip
      return;
    }
    if (!votes[target]) votes[target] = 0;
    votes[target] += 1;
  });
  // find max
  let max = 0;
  Object.values(votes).forEach(v => { if (v > max) max = v; });
  const top = Object.keys(votes).filter(k => votes[k] === max);
  if (top.length === 0) return { tied: false, kickedPlayer: null, tiedPlayers: [] };
  if (top.length > 1) {
    // tie -> return tied player objects
    const tiedPlayers = room.players.filter(p => top.includes(p.id) && p.alive);
    return { tied: true, tiedPlayers, votes };
  } else {
    const id = top[0];
    const kicked = room.players.find(p => p.id === id);
    return { tied: false, kickedPlayer: kicked, votes };
  }
}

function checkWin(roomId) {
  const room = getRoom(roomId);
  if (!room) return;
  // determine alive counts by fraksi and special cases
  const alive = room.players.filter(p => p.alive);
  const count = { innocent: 0, neutral: 0, werewolf: 0 };
  alive.forEach(p => {
    // helper counts as neutral for counting, but note helper invulnerable rule
    if (room.witchHelper && room.witchHelper.id === p.id) count.neutral++;
    else count[p.role] = (count[p.role] || 0) + 1;
  });

  // Determine winners according to spec:
  // - Werewolf win if number of werewolves >= number of innocents+? (common rule: when werewolves equal or outnumber innocents -> win)
  // We'll interpret: Werewolves win when their count >= innocents.
  // - Innocent win when no werewolves alive
  // - Neutral roles win individually (Bandit or Witch) when their objective met:
  //   * Bandit objective: kill 3 by their method (we will track bandit.meta.kills)
  //   * Witch objective: survive until only them + helper? Spec says witch aims to eliminate all until only them two or equal number with innocents? To keep it simple: Witch wins if witch alive and everyone else dead except possibly helper OR if witch remains last alive.
  // For simplicity implement:
  // - If werewolves count > 0 and werewolves >= innocents -> werewolves win
  // - Else if werewolves count === 0 -> innocents win
  // - Neutral wins: bandit if bandit.meta.kills >= 3 (then bandit wins individually)
  // - Witch wins if witch alive and all others dead except helper (helper also alive) OR witch alone survivor

  // Check bandit individual win
  const bandit = room.players.find(p => p.meta && p.meta.subrole === "bandit");
  if (bandit && bandit.meta && (bandit.meta.kills || 0) >= 3 && bandit.alive) {
    room.status = "ended";
    room.winner = { type: "bandit", id: bandit.id };
    room.logs.push({ t: Date.now(), text: `${bandit.username} (Bandit) fulfilled objective and wins individually.` });
    return;
  }

  const witch = room.players.find(p => p.meta && p.meta.subrole === "penyihir");
  if (witch && witch.alive) {
    // check helper presence
    if (room.witchHelper && room.witchHelper.id) {
      const helper = room.players.find(p => p.id === room.witchHelper.id);
      // if only witch and helper remain (no werewolves/innocents alive), witch wins
      const othersAlive = room.players.filter(p => p.alive && p.id !== witch.id && p.id !== room.witchHelper.id);
      if (othersAlive.length === 0) {
        room.status = "ended";
        room.winner = { type: "witch", id: witch.id };
        room.logs.push({ t: Date.now(), text: `${witch.username} (Penyihir) and helper are last; Penyihir wins.` });
        return;
      }
    }
  }

  // Werewolf win check
  if ((count.werewolf || 0) > 0 && (count.werewolf >= (count.innocent || 0))) {
    room.status = "ended";
    room.winner = { type: "werewolf" };
    room.logs.push({ t: Date.now(), text: `Werewolves win.` });
    return;
  }

  // Innocent win check
  if ((count.werewolf || 0) === 0) {
    room.status = "ended";
    room.winner = { type: "innocent" };
    room.logs.push({ t: Date.now(), text: `Innocents win.` });
    return;
  }

  // else continue
}

// API level actions helpers:

function submitVote(roomId, voterId, targetId) {
  const room = getRoom(roomId);
  if (!room) throw new Error("Room not found");
  const voter = room.players.find(p => p.id === voterId && p.alive);
  if (!voter) throw new Error("Voter not found or dead");
  // revote exclusions
  if (room.revoting && room.revoting.excludedFromVoting && room.revoting.excludedFromVoting.includes(voterId)) {
    throw new Error("You are excluded from voting this revote");
  }
  room.votes[voterId] = targetId;
  return room;
}

module.exports = {
  createRoom,
  joinRoom,
  assignRoles,
  startGame,
  getRoom,
  collectAction,
  submitVote,
  rooms // exported for debug
};
