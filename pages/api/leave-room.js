import { leaveRoom } from "../../lib/gameManager";

export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { roomId, playerId } = req.body;
  try {
    const result = leaveRoom(roomId, playerId);
    res.status(200).json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}
