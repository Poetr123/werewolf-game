// Simpan state sementara di memory (hanya bertahan di server)
let rooms = {};

function createRoom(roomId, hostId, username) {
  if (rooms[roomId]) throw new Error("Room already exists");

  rooms[roomId] = {
    id: roomId,
    host: hostId,
    players: [{ id: hostId, username, role: null, alive: true }],
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

  // jangan double masuk
  if (rooms[roomId].players.find(p => p.id === playerId)) {
    return rooms[roomId];
  }

  rooms[roomId].players.push({
    id: playerId,
    username,
    role: null,
    alive: true
  });

  return rooms[roomId];
}

function assignRoles(roomId) {
  const room = rooms[roomId];
  if (!room) throw new Error("Room not found");

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

  // acak
  roles = roles.sort(() => Math.random() - 0.5);
  players.forEach((p, i) => (p.role = roles[i]));
  room.rolesAssigned = true;

  return room;
}

function getRoom(roomId) {
  return rooms[roomId] || null;
}

// 🆕 Tambahan: handle player keluar
function leaveRoom(roomId, playerId) {
  const room = rooms[roomId];
  if (!room) throw new Error("Room not found");

  // hapus player
  room.players = room.players.filter((p) => p.id !== playerId);

  // jika host keluar
  if (room.host === playerId) {
    if (room.players.length > 0) {
      room.host = room.players[0].id; // alihkan host ke player pertama
    } else {
      delete rooms[roomId]; // hapus room kalau kosong
      return null;
    }
  }

  return room;
}

module.exports = { createRoom, joinRoom, assignRoles, getRoom, leaveRoom };
