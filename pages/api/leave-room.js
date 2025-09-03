import { leaveRoom } from "../../lib/gameManager";

export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { roomId, playerId } = req.body;

  try {
    const room = leaveRoom(roomId, playerId);
    return res.status(200).json(room);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}
