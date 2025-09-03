// pages/api/game-action.js
import { getRoomForClient, assignRoles, startGame, collectAction, submitVote } from "../../lib/gameManager";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const { roomId } = req.query;
    if (!roomId) return res.status(400).json({ error: "roomId required" });
    const room = getRoomForClient(roomId);
    if (!room) return res.status(404).json({ error: "Room not found" });
    return res.status(200).json(room);
  }

  if (req.method === "POST") {
    const { roomId, action } = req.body;
    if (!roomId || !action) return res.status(400).json({ error: "roomId & action required" });

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
        const { actionObj } = req.body;
        if (!actionObj) return res.status(400).json({ error: "actionObj required" });
        collectAction(roomId, actionObj);
        return res.status(200).json({ ok: true });
      }
      if (action === "vote") {
        const { voterId, targetId } = req.body;
        if (!voterId || !targetId) return res.status(400).json({ error: "voterId & targetId required" });
        submitVote(roomId, voterId, targetId);
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ error: "Unknown action" });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
  }

  return res.status(405).end();
}
