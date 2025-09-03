import { useState } from "react";
import { useRouter } from "next/router";

export default function Home() {
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  const router = useRouter();

  const createRoom = async () => {
    if (!username) return alert("Isi username dulu (3-10 huruf)");

    const id = Math.random().toString(36).substring(2, 8);
    const hostId = id + "-host";

    const res = await fetch("/api/create-room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: id, hostId, username }),
    });

    const data = await res.json();
    if (data.error) return alert(data.error);

    router.push(`/room/${id}?user=${username}`);
  };

  const joinRoom = async () => {
    if (!username) return alert("Isi username dulu (3-10 huruf)");
    if (!roomId) return alert("Isi Room ID");

    const playerId = Math.random().toString(36).substring(2, 8);

    const res = await fetch("/api/join-room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, playerId, username }),
    });

    const data = await res.json();
    if (data.error) return alert(data.error);

    router.push(`/room/${roomId}?user=${username}`);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="text-3xl font-bold">Werewolf Online</h1>

      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Username (3-10)"
        className="border p-2 rounded"
      />

      <button onClick={createRoom} className="bg-blue-500 text-white px-4 py-2 rounded">
        Create Room
      </button>

      <input
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
        placeholder="Room ID"
        className="border p-2 rounded"
      />
      <button onClick={joinRoom} className="bg-green-500 text-white px-4 py-2 rounded">
        Join Room
      </button>
    </div>
  );
}
