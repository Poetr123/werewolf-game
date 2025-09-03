// lib/gameManager.js
import fs from "fs";
import path from "path";

const TMP = process.env.TMPDIR || process.env.TEMP || "/tmp";
const DATA_FILE = path.join(TMP, "werewolf_rooms.json");

function readRooms() {
  try {
    if (!fs.existsSync(DATA_FILE)) return {};
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error("readRooms error:", e);
    return {};
  }
}

function writeRooms(rooms) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(rooms, null, 2));
  } catch (e) {
    console.error("writeRooms error:", e);
  }
}

function makeId(len = 6) {
  return Math.random().toString(36).substring(2, 2 + len);
}

/* Simple deterministic mapping for 5..10 players (matches spec bounds)
  5 -> 3I,1N,1W
  6 -> 4I,1N,1W
  7 -> 5I,1N,1W
  8 -> 5I,2N,1W
  9 -> 6I,2N,1W
 10 -> 6I,2N,2W
*/
const ROLE_MAP = {
  5: { innocent: 3, neutral: 1, werewolf: 1 },
  6: { innocent: 4, neutral: 1, werewolf: 1 },
  7: { innocent: 5, neutral: 1, werewolf: 1 },
  8: { innocent: 5, neutral: 2, werewolf: 1 },
  9: { innocent: 6, neutral: 2, werewolf: 1 },
 10: { innocent: 6, neutral: 2, werewolf: 2 }
};

function shuffle(arr) {
  return arr.sort(() => Math.random() - 0.5);
}

function sanitizeForClient(room, viewerId = null) {
  // Compute timeLeft from phaseStartedAt & phaseDuration
  const now = Date.now();
  let timeLeft = 0;
  if (room.phaseStartedAt && room.phaseDuration != null) {
    const end = room.phaseStartedAt + room.phaseDuration * 1000;
    timeLeft = Math.max(0, Math.ceil((end - now) / 1000));
  }

  // Optionally mask other players' roles (for development we keep roles visible).
  // If you want to hide roles from other players, modify below to only reveal role for viewerId.
  const players = (room.players || []).map((p) => ({ ...p }));

  return {
    id: room.id,
    host: room.host,
    status: room.status,
    phase: room.phase,
    round: room.round,
    timeLeft,
    settings: room.settings,
    players,
    votes: room.votes || {},
    logs: room.logs || [],
    revoting: room.revoting || null,
    phaseStartedAt: room.phaseStartedAt || null
  };
}

/* Core functions exported */
export function createRoom(hostId, username) {
  const rooms = readRooms();
  const roomId = makeId(5);
  const host = hostId || makeId(6);
  rooms[roomId] = {
    id: roomId,
    host,
    players: [{ id: host, username, alive: true, role: null, meta: {} }],
    status: "waiting", // waiting | ready | playing | ended
    phase: "waiting", // waiting | night | morning | discussion | voting
    round: 0,
    phaseStartedAt: null,
    phaseDuration: 0, // seconds
    votes: {},
    logs: [{ t: Date.now(), text: `Room ${roomId} created by ${username}` }],
    settings: {
      discussionSeconds: 75,
      votingSeconds: 15,
      nightSeconds: 30,
      morningSeconds: 5
    },
    pendingActions: [],
    revoting: null
  };
  writeRooms(rooms);
  return { roomId, playerId: host };
}

export function joinRoom(roomId, playerId, username) {
  const rooms = readRooms();
  const room = rooms[roomId];
  if (!room) throw new Error("Room not found");
  if (room.status !== "waiting" && room.status !== "ready") {
    // allow join only if game hasn't started
    throw new Error("Game already started");
  }
  if (room.players.length >= 10) throw new Error("Room full");
  if (room.players.find((p) => p.username === username)) throw new Error("Username already taken in room");
  const pid = playerId || makeId(6);
  room.players.push({ id: pid, username, alive: true, role: null, meta: {} });
  room.logs.push({ t: Date.now(), text: `${username} joined the room.` });
  // if enough players, mark ready
  if (room.players.length >= 5) room.status = "ready";
  writeRooms(rooms);
  return { roomId, playerId: pid };
}

export function getRoom(roomId) {
  const rooms = readRooms();
  return rooms[roomId] || null;
}

export function assignRoles(roomId) {
  const rooms = readRooms();
  const room = rooms[roomId];
  if (!room) throw new Error("Room not found");
  const players = room.players;
  const n = players.length;
  if (n < 5 || n > 10) throw new Error("Player count must be between 5 and 10 to assign roles");

  const map = ROLE_MAP[n] || ROLE_MAP[5];
  const roles = [];
  for (let i = 0; i < map.innocent; i++) roles.push("innocent");
  for (let i = 0; i < map.neutral; i++) roles.push("neutral");
  for (let i = 0; i < map.werewolf; i++) roles.push("werewolf");
  shuffle(roles);

  players.forEach((p, idx) => {
    p.role = roles[idx];
    p.alive = true;
    p.meta = {};
  });

  // assign subroles for Innocent group (simple heuristic)
  const innocents = players.filter((p) => p.role === "innocent");
  shuffle(innocents);
  if (innocents.length >= 1) innocents[0].meta.subrole = "warga";
  if (innocents.length >= 2) innocents[1].meta.subrole = "penjaga";
  if (innocents.length >= 3) innocents[2].meta.subrole = "pemburu";
  if (innocents.length >= 4) {
    innocents[3].meta.subrole = "dukun";
    innocents[3].meta.dukunUses = 2;
  }
  for (let i = 4; i < innocents.length; i++) innocents[i].meta.subrole = "warga";

  // neutrals: if one neutral, randomly bandit or penyihir
  const neutrals = players.filter((p) => p.role === "neutral");
  shuffle(neutrals);
  if (neutrals.length === 1) {
    neutrals[0].meta.subrole = Math.random() < 0.5 ? "bandit" : "penyihir";
    if (neutrals[0].meta.subrole === "bandit") neutrals[0].meta.marksLeft = 2;
  } else {
    if (neutrals[0]) { neutrals[0].meta.subrole = "bandit"; neutrals[0].meta.marksLeft = 2; }
    if (neutrals[1]) { neutrals[1].meta.subrole = "penyihir"; neutrals[1].meta.revivesLeft = 1; }
    for (let i = 2; i < neutrals.length; i++) neutrals[i].meta.subrole = "bandit";
  }

  room.status = "ready";
  room.logs.push({ t: Date.now(), text: "Roles assigned." });
  writeRooms(rooms);
  return true;
}

function startPhase(room, phaseName, durationSec) {
  room.phase = phaseName;
  room.phaseStartedAt = Date.now();
  room.phaseDuration = durationSec;
  room.logs.push({ t: Date.now(), text: `Phase -> ${phaseName} (dur ${durationSec}s)` });
}

export function startGame(roomId) {
  const rooms = readRooms();
  const room = rooms[roomId];
  if (!room) throw new Error("Room not found");
  if (room.players.length < 5) throw new Error("Need at least 5 players to start");
  room.status = "playing";
  room.round = 1;
  startPhase(room, "night", room.setting
