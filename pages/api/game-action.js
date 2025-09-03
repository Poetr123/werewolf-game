// pages/api/game-action.js
import { getRoom, assignRoles, startGame, collectAction, submitVote } from "../../lib/gameManager";

export default function handler(req, res) {
  if (req.method === "GET") {
    const { roomId } = req.query;
    const room = getRoom(roomId);
    if (!room) return res.status(404).json({ error: "Room not found" });
    // send sanitized room info
    const safe = JSON.parse(JSON.stringify(room));
    // hide sensitive info (roles) except to each player — for brevity, return full roles (for dev). In prod, mask other players roles.
    return res.status(200).json(safe);
  }

  if (req.method === "POST") {
    const { roomId, action, actorId, targetId, voterId } = req.body;
    const room = getRoom(roomId);
    if (!room) return res.status(404).json({ error: "Room not found" });

    try {
      if (action === "assignRoles") {
        assignRoles(roomId);
        return res.status(200).json({ ok: true });
      }
      if (action === "startGame") {
        startGame(roomId);
        return res.status(200).json({ ok: true });
      }
      if (action === "collectAction") {
        // body must contain type and actorId etc.
        collectAction(roomId, req.body.actionObj);
        return res.status(200).json({ ok: true });
      }
      if (action === "vote") {
        submitVote(roomId, voterId, targetId);
        return res.status(200).json({ ok: true });
      }
      return res.status(400).json({ error: "Unknown action" });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  }
}
