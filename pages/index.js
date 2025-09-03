// pages/index.js
import { useState } from "react";
import { useRouter } from "next/router";

export default function Home() {
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  const router = useRouter();

  const createRoom = async () => {
    if (username.length < 3 || username.length > 10) return alert("Username 3-10 chars");
    const res = await fetch("/api/create-room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username })
    });
    const data = await res.json();
    if (data.error) return alert(data.error);
    router.push(`/room/${data.roomId}?user=${encodeURIComponent(username)}`);
  };

  const joinRoom = async () => {
    if (username.length < 3 || username.length > 10) return alert("Username 3-10 chars");
    if (!roomId) return alert("Masukkan Room ID");
    const res = await fetch("/api/join-room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, username })
    });
    const data = await res.json();
    if (data.error) return alert(data.error);
    router.push(`/room/${roomId}?user=${encodeURIComponent(username)}`);
  };

  return (
    <div style={{display:"flex", flexDirection:"column", alignItems:"center", padding:40}}>
      <h1>Werewolf Online</h1>
      <input placeholder="Username (3-10)" value={username} onChange={(e)=>setUsername(e.target.value)} />
      <div style={{marginTop:10}}>
        <button onClick={createRoom}>Create Room</button>
      </div>
      <hr style={{width:"300px", margin:"20px 0"}} />
      <input placeholder="Room ID" value={roomId} onChange={(e)=>setRoomId(e.target.value)} />
      <div style={{marginTop:10}}>
        <button onClick={joinRoom}>Join Room</button>
      </div>
    </div>
  );
}
