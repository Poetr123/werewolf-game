// pages/api/create-room.js
import { createRoom } from "../../lib/gameManager";

export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { username } = req.body;
  if (!username || typeof username !== "string" || username.length < 3 || username.length > 10) {
    return res.status(400).json({ error: "Username must be 3-10 characters" });
  }
  try {
    const { roomId, playerId } = createRoom(null, username);
    return res.status(200).json({ roomId, playerId });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
