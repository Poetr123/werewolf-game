import fs from "fs";
import path from "path";

const filePath = path.join("/tmp", "rooms.json");

function loadRooms() {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(data);
    }
    return {};
  } catch (e) {
    return {};
  }
}

function saveRooms(rooms) {
  fs.writeFileSync(filePath, JSON.stringify(rooms));
}

function createRoom(roomId, host, username) {
  const rooms = loadRooms();
  if (rooms[roomId]) throw new Error("Room already exists");

  rooms[roomId] = {
    host,
    players: [{ id: host, username, role: null, alive: true }],
    status: "waiting",
    round: 0,
    phase: "waiting",
    votes: {},
    rolesAssigned: false,
  };

  saveRooms(rooms);
  return rooms[roomId];
}

function joinRoom(roomId, playerId, username) {
  const rooms = loadRooms();
  if (!rooms[roomId]) throw new Error("Room not found");
  if (rooms[roomId].players.length >= 10) throw new Error("Room full");

  rooms[roomId].players.push({
    id: playerId,
    username,
    role: null,
    alive: true,
  });

  saveRooms(rooms);
  return rooms[roomId];
}

function assignRoles(roomId) {
  const rooms = loadRooms();
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

  roles = roles.sort(() => Math.random() - 0.5);
  players.forEach((p, i) => (p.role = roles[i]));
  room.rolesAssigned = true;

  saveRooms(rooms);
}

function getRoom(roomId) {
  const rooms = loadRooms();
  return rooms[roomId] || null;
}

export { createRoom, joinRoom, assignRoles, getRoom };
