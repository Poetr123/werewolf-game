// State game disimpan di memory
let rooms = {};

function createRoom(roomId, host, username) {
  rooms[roomId] = {
    host,
    players: [{ id: host, username, role: null, alive: true }],
    status: "waiting", // waiting | playing | ended
    round: 0,
    phase: "waiting",  // night | morning | discussion | voting
    votes: {},
    rolesAssigned: false
  };
  return rooms[roomId];
}

function joinRoom(roomId, playerId, username) {
  if (!rooms[roomId]) throw new Error("Room not found");
  if (rooms[roomId].players.length >= 10) throw new Error("Room full");

  rooms[roomId].players.push({ id: playerId, username, role: null, alive: true });
  return rooms[roomId];
}

function assignRoles(roomId) {
  const room = rooms[roomId];
  const players = room.players;
  const total = players.length;

  let roles = [];

  if (total === 5) {
    roles = ["innocent", "innocent", "innocent", "neutral", "werewolf"];
  } else if (total <= 7) {
    roles = ["werewolf", "neutral"];
    roles.push(...Array(total - 2).fill("innocent"));
  } else {
    roles = ["werewolf", "werewolf", "neutral", "neutral"];
    roles.push(...Array(total - 4).fill("innocent"));
  }

  // Shuffle roles
  roles = roles.sort(() => Math.random() - 0.5);

  players.forEach((p, i) => (p.role = roles[i]));
  room.rolesAssigned = true;
}

function getRoom(roomId) {
  return rooms[roomId] || null;
}

module.exports = { createRoom, joinRoom, assignRoles, getRoom };
