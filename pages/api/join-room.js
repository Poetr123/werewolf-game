// pages/api/join-room.js
import { joinRoom } from "../../lib/gameManager";

export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { roomId, username } = req.body;
  if (!username || typeof username !== "string" || username.length < 3 || username.length > 10) {
    return res.status(400).json({ error: "Username must be 3-10 characters" });
  }
  if (!roomId || typeof roomId !== "string") {
    return res.status(400).json({ error: "roomId required" });
  }
  try {
    const { playerId } = joinRoom(roomId, null, username);
    return res.status(200).json({ ok: true, playerId });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}
