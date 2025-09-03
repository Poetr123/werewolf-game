// pages/api/join-room.js
import { joinRoom, getRoom } from "../../lib/gameManager";

export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { roomId, playerId, username } = req.body;
  if (!username || username.length < 3 || username.length > 10) return res.status(400).json({ error: "Username 3-10 chars" });
  try {
    const room = getRoom(roomId);
    if (!room) return res.status(404).json({ error: "Room not found" });
    joinRoom(roomId, playerId || Math.random().toString(36).slice(2), username);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}
