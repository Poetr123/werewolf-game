// pages/room/[id].js
import { useRouter } from "next/router";
import { useEffect, useState, useRef } from "react";

export default function RoomPage() {
  const router = useRouter();
  const { id } = router.query;
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joinName, setJoinName] = useState("");
  const [selectedTarget, setSelectedTarget] = useState("");
  const pollRef = useRef(null);

  const playerId = typeof window !== "undefined" ? localStorage.getItem("playerId") : null;
  const username = typeof window !== "undefined" ? localStorage.getItem("username") : null;

  useEffect(() => {
    if (!id) return;
    startPolling();
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function startPolling() {
    fetchRoom();
    pollRef.current = setInterval(fetchRoom, 1500);
  }
  function stopPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
  }

  async function fetchRoom() {
    try {
      const res = await fetch(`/api/game-action?roomId=${id}`);
      if (!res.ok) {
        setRoom(null);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setRoom(data);
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!joinName || joinName.length < 3 || joinName.length > 10) return alert("Username 3-10 chars");
    const res = await fetch("/api/join-room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: id, username: joinName })
    });
    const data = await res.json();
    if (data.error) return alert(data.error);
    localStorage.setItem("playerId", data.playerId);
    localStorage.setItem("username", joinName);
    // refresh
    fetchRoom();
  }

  async function handleAssignRoles() {
    await fetch("/api/game-action", { method: "POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ roomId: id, action: "assignRoles" }) });
    fetchRoom();
  }

  async function handleStartGame() {
    await fetch("/api/game-action", { method: "POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ roomId: id, action: "startGame" }) });
    fetchRoom();
  }

  async function sendCollectAction(type, targetId) {
    if (!playerId) return alert("You must join first (no playerId).");
    await fetch("/api/game-action", {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ roomId: id, action: "collectAction", actionObj: { type, actorId: playerId, targetId } })
    });
    fetchRoom();
  }

  async function sendVote(targetId) {
    if (!playerId) return alert("You must join first (no playerId).");
    await fetch("/api/game-action", {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ roomId: id, action: "vote", voterId: playerId, targetId })
    });
    fetchRoom();
  }

  if (!id) return <div>Loading...</div>;
  if (loading) return <div>Loading room...</div>;

  if (!room) return <div>Room not found. Check Room ID.</div>;

  // find my player object
  const me = room.players.find(p => p.id === playerId) || null;

  return (
    <div style={{ padding: 20 }}>
      <h2>Room {id}</h2>
      <div>Phase: {room.phase} | Round: {room.round} | Status: {room.status} | Time left: {room.timeLeft}s</div>

      <div style={{ display: "flex", gap: 20, marginTop: 12 }}>
        <div style={{ width: 340, border: "1px solid #ddd", padding: 12 }}>
          <h3>Players</h3>
          <ul>
            {room.players.map(p => (
              <li key={p.id} style={{ textDecoration: p.alive ? "none" : "line-through" }}>
                {p.username} {p.id === playerId ? "(You)" : ""} {p.role ? ` - ${p.role}${p.meta?.subrole ? `/${p.meta.subrole}` : ""}` : ""}
              </li>
            ))}
          </ul>

          {!playerId && (
            <div style={{ marginTop: 8 }}>
              <input placeholder="Enter name to join (3-10)" value={joinName} onChange={(e)=>setJoinName(e.target.value)} />
              <div style={{ marginTop: 6 }}>
                <button onClick={handleJoin}>Join Room</button>
              </div>
            </div>
          )}

          {room.status === "ready" && me && me.id === room.host && (
            <div style={{ marginTop: 10 }}>
              <button onClick={handleAssignRoles}>Assign Roles (host)</button>
              <button onClick={handleStartGame} style={{ marginLeft: 8 }}>Start Game (host)</button>
            </div>
          )}

          {/* Night actions (simple): allowed any player to press action button for demo */}
          {room.phase === "night" && (
            <div style={{ marginTop: 10 }}>
              <div>Night actions (choose target):</div>
              <select value={selectedTarget} onChange={(e)=>setSelectedTarget(e.target.value)}>
                <option value="">-- pilih target --</option>
                {room.players.filter(p => p.alive && p.id !== playerId).map(p => (<option key={p.id} value={p.id}>{p.username}</option>))}
              </select>
              <div style={{ marginTop: 8 }}>
                <button onClick={() => sendCollectAction("werewolf_kill", selectedTarget)}>Werewolf Kill</button>
                <button onClick={() => sendCollectAction("guard_protect", selectedTarget)} style={{ marginLeft: 6 }}>Guard Protect</button>
                <button onClick={() => sendCollectAction("hunter_shoot", selectedTarget)} style={{ marginLeft: 6 }}>Hunter Shoot</button>
                <button onClick={() => sendCollectAction("dukun_read", selectedTarget)} style={{ marginLeft: 6 }}>Dukun Read</button>
                <button onClick={() => sendCollectAction("bandit_mark", selectedTarget)} style={{ marginLeft: 6 }}>Bandit Mark</button>
                <button onClick={() => sendCollectAction("witch_revive", selectedTarget)} style={{ marginLeft: 6 }}>Penyihir Revive</button>
              </div>
            </div>
          )}

          {room.phase === "discussion" && (
            <div style={{ marginTop: 10 }}>
              <div>Discussion — chat is local demo (not server). Use UI to discuss.</div>
            </div>
          )}

          {room.phase === "voting" && (
            <div style={{ marginTop: 10 }}>
              <div>Voting:</div>
              <select value={selectedTarget} onChange={(e)=>setSelectedTarget(e.target.value)}>
                <option value="">-- pilih vote --</option>
                {room.players.filter(p => p.alive && p.id !== playerId).map(p => (<option key={p.id} value={p.id}>{p.username}</option>))}
              </select>
              <div style={{ marginTop: 8 }}>
                <button onClick={() => sendVote(selectedTarget)}>Vote</button>
              </div>
            </div>
          )}
        </div>

        <div style={{ flex: 1 }}>
          <h3>Game Log</h3>
          <div style={{ height: 420, overflow: "auto", border: "1px solid #ddd", padding: 8 }}>
            {room.logs.slice().reverse().map((l, i) => (<div key={i}>[{new Date(l.t).toLocaleTimeString()}] {l.text}</div>))}
          </div>
        </div>
      </div>
    </div>
  );
}
