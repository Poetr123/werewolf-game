import { joinRoom } from "../../lib/gameManager";

export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { roomId, playerId, username } = req.body;

  if (!username || username.length < 3 || username.length > 10) {
    return res.status(400).json({ error: "Invalid username" });
  }

  try {
    const room = joinRoom(roomId, playerId, username);
    return res.status(200).json(room);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}
