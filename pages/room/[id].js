// pages/room/[id].js
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function RoomPage() {
  const router = useRouter();
  const { id } = router.query;
  const query = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const username = query ? query.get("user") : "";

  const [room, setRoom] = useState(null);
  const [playerId] = useState(() => Math.random().toString(36).slice(2)); // local temp id
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState(null);

  useEffect(() => {
    if (!id) return;
    const iv = setInterval(async () => {
      const res = await fetch(`/api/game-action?roomId=${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setRoom(data);
    }, 1500);
    return () => clearInterval(iv);
  }, [id]);

  const assignRoles = async () => {
    await fetch("/api/game-action", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ roomId: id, action: "assignRoles" })
    });
  };

  const startGame = async () => {
    await fetch("/api/game-action", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ roomId: id, action: "startGame" })
    });
  };

  const sendCollectAction = async (type, targetId) => {
    await fetch("/api/game-action", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({
        roomId: id,
        action: "collectAction",
        actionObj: { type, actorId: playerId, targetId }
      })
    });
  };

  const sendVote = async (targetId) => {
    await fetch("/api/game-action", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ roomId: id, action: "vote", voterId: playerId, targetId })
    });
  };

  if (!room) return <div>Loading room...</div>;

  // find this player's full info
  const me = room.players.find(p => p.username === username) || { username, id: playerId };

  return (
    <div style={{padding:20}}>
      <h2>Room {id}</h2>
      <div>Phase: {room.phase} | Round: {room.round} | Status: {room.status}</div>

      <div style={{display:"flex", gap:20, marginTop:10}}>
        <div style={{width:300, border:"1px solid #ddd", padding:10}}>
          <h3>Players</h3>
          <ul>
            {room.players.map(p => (
              <li key={p.id} style={{textDecoration: p.alive ? "none" : "line-through"}}>
                {p.username} {p.username===username && "(You)"} {p.meta && p.meta.subrole ? ` - ${p.meta.subrole}` : ""}
              </li>
            ))}
          </ul>

          <div style={{marginTop:10}}>
            {room.status === "waiting" && (
              <>
                <button onClick={assignRoles}>Assign Roles (Host)</button>
                <button onClick={startGame} style={{marginLeft:8}}>Start Game (Host)</button>
              </>
            )}
            {room.phase === "night" && (
              <div>
                <div>Night actions (choose target):</div>
                <select onChange={(e)=>setSelectedTarget(e.target.value)} value={selectedTarget || ""}>
                  <option value="">-- pilih target --</option>
                  {room.players.filter(p => p.alive && p.username !== username).map(p => (
                    <option key={p.id} value={p.id}>{p.username}</option>
                  ))}
                </select>
                <div style={{marginTop:6}}>
                  <button onClick={()=>sendCollectAction("werewolf_kill", selectedTarget)}>Werewolf Kill</button>
                  <button onClick={()=>sendCollectAction("guard_protect", selectedTarget)} style={{marginLeft:6}}>Guard Protect</button>
                  <button onClick={()=>sendCollectAction("hunter_shoot", selectedTarget)} style={{marginLeft:6}}>Hunter Shoot</button>
                  <button onClick={()=>sendCollectAction("dukun_read", selectedTarget)} style={{marginLeft:6}}>Dukun Read</button>
                  <button onClick={()=>sendCollectAction("bandit_mark", selectedTarget)} style={{marginLeft:6}}>Bandit Mark</button>
                  <button onClick={()=>sendCollectAction("witch_revive", selectedTarget)} style={{marginLeft:6}}>Penyihir Revive</button>
                </div>
              </div>
            )}
            {room.phase === "discussion" && (
              <div>
                <textarea rows={3} value={message} onChange={e=>setMessage(e.target.value)} />
                <button onClick={()=>{ setChat(c=>[...c, {user: username, text: message}]); setMessage(""); }}>Kirim</button>
                <div style={{height:150, overflow:"auto", border:"1px solid #eee", marginTop:8}}>
                  {chat.map((m,i)=>(<div key={i}><b>{m.user}:</b> {m.text}</div>))}
                </div>
              </div>
            )}
            {room.phase === "voting" && (
              <div>
                <select onChange={(e)=>setSelectedTarget(e.target.value)} value={selectedTarget||""}>
                  <option value="">-- pilih vote --</option>
                  {room.players.filter(p=>p.alive && p.username!==username).map(p=>(<option key={p.id} value={p.id}>{p.username}</option>))}
                </select>
                <button onClick={()=>sendVote(selectedTarget)} style={{marginLeft:6}}>Vote</button>
              </div>
            )}
          </div>
        </div>

        <div style={{flex:1}}>
          <h3>Game Log</h3>
          <div style={{height:400, overflow:"auto", border:"1px solid #ddd", padding:8}}>
            {room.logs.slice().reverse().map((l,i)=>(<div key={i}>[{new Date(l.t).toLocaleTimeString()}] {l.text}</div>))}
          </div>
        </div>
      </div>
    </div>
  );
}
