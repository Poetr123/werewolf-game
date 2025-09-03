let rooms = {}; // state room sementara

export function createRoom(hostId, username) {
  const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
  rooms[roomId] = {
    id: roomId,
    host: hostId,
    players: [{ id: hostId, username, alive: true }],
    status: "waiting",
  };
  return rooms[roomId];
}

export function joinRoom(roomId, playerId, username) {
  const room = rooms[roomId];
  if (!room) throw new Error("Room not found");

  if (room.players.find((p) => p.id === playerId)) return room;

  room.players.push({ id: playerId, username, alive: true });
  return room;
}

export function getRoom(roomId) {
  return rooms[roomId] || null;
}

export function leaveRoom(roomId, playerId) {
  const room = rooms[roomId];
  if (!room) throw new Error("Room not found");

  // hapus player
  room.players = room.players.filter((p) => p.id !== playerId);

  // kalau host keluar
  if (room.host === playerId) {
    if (room.players.length > 0) {
      // pindah host ke player pertama
      room.host = room.players[0].id;
    } else {
      // hapus room kalau kosong
      delete rooms[roomId];
      return { deleted: true };
    }
  }

  return room;
}
