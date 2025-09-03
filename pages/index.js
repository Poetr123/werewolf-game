// pages/index.js
import { useState } from "react";
import { useRouter } from "next/router";

export default function Home() {
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  const router = useRouter();

  async function handleCreate() {
    if (!username || username.length < 3 || username.length > 10) return alert("Username 3-10 chars");
    const res = await fetch("/api/create-room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username })
    });
    const data = await res.json();
    if (data.error) return alert(data.error);
    localStorage.setItem("playerId", data.playerId);
    localStorage.setItem("username", username);
    router.push(`/room/${data.roomId}`);
  }

  async function handleJoin() {
    if (!username || username.length < 3 || username.length > 10) return alert("Username 3-10 chars");
    if (!roomId) return alert("Masukkan Room ID");
    const res = await fetch("/api/join-room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, username })
    });
    const data = await res.json();
    if (data.error) return alert(data.error);
    localStorage.setItem("playerId", data.playerId);
    localStorage.setItem("username", username);
    router.push(`/room/${roomId}`);
  }

  return (
    <div style={{ padding: 30 }}>
      <h1>Werewolf Online (Demo)</h1>
      <div style={{ marginTop: 12 }}>
        <input placeholder="Username (3-10)" value={username} onChange={(e) => setUsername(e.target.value)} />
      </div>
      <div style={{ marginTop: 10 }}>
        <button onClick={handleCreate}>Create Room</button>
      </div>

      <hr style={{ margin: "20px 0" }} />

      <div>
        <input placeholder="Room ID" value={roomId} onChange={(e) => setRoomId(e.target.value)} />
      </div>
      <div style={{ marginTop: 10 }}>
        <button onClick={handleJoin}>Join Room</button>
      </div>
    </div>
  );
}
