import { getRoom, assignRoles } from "../../lib/gameManager";

export default function handler(req, res) {
  const { roomId } = req.query;

  if (req.method === "GET") {
    const room = getRoom(roomId);
    if (!room) return res.status(404).json({ error: "Room not found" });
    return res.status(200).json(room);
  }

  if (req.method === "POST") {
    const { action, voter, target } = req.body;
    const room = getRoom(roomId);
    if (!room) return res.status(404).json({ error: "Room not found" });

    if (action === "assignRoles") {
      assignRoles(roomId);
    } else if (action === "vote") {
      room.votes[voter] = target;
    }

    return res.status(200).json(room);
  }
}
