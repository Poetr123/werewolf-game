// pages/api/create-room.js
import { createRoom } from "../../lib/gameManager";

export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { hostId, username } = req.body;
  if (!username || username.length < 3 || username.length > 10) return res.status(400).json({ error: "Username 3-10 chars" });
  try {
    const room = createRoom(hostId || (Math.random().toString(36).slice(2)), username);
    return res.status(200).json({ roomId: room.id });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
