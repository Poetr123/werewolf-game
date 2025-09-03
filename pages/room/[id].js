import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function RoomPage() {
  const router = useRouter();
  const { id } = router.query; // roomId
  const username = router.query.user; // dari query string

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [playerId, setPlayerId] = useState(null);

  // Simpan playerId di localStorage supaya konsisten
  useEffect(() => {
    if (!username) return;
    let pid = localStorage.getItem("playerId");
    if (!pid) {
      pid = Math.random().toString(36).substring(2, 8);
      localStorage.setItem("playerId", pid);
    }
    setPlayerId(pid);
  }, [username]);

  // Ambil data room setiap 2 detik (polling)
  useEffect(() => {
    if (!id) return;

    const fetchRoom = async () => {
      const res = await fetch(`/api/game-action?roomId=${id}`);
      const data = await res.json();
      if (!data.error) setRoom(data);
      setLoading(false);
    };

    fetchRoom();
    const interval = setInterval(fetchRoom, 2000);
    return () => clearInterval(interval);
  }, [id]);

  // Auto-disconnect saat tab ditutup
  useEffect(() => {
    if (!id || !playerId) return;

    const leave = async () => {
      await fetch("/api/leave-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: id, playerId }),
      });
    };

    // Jalankan saat tab ditutup / reload
    window.addEventListener("beforeunload", leave);

    return () => {
      leave();
      window.removeEventListener("beforeunload", leave);
    };
  }, [id, playerId]);

  if (loading) return <p className="text-center mt-10">Loading room...</p>;
  if (!room) return <p className="text-center mt-10">Room not found</p>;

  return (
    <div className="flex flex-col items-center min-h-screen p-6">
      <h1 className="text-2xl font-bold mb-4">Room: {room.id}</h1>
      <p className="mb-2">Host: {room.host}</p>
      <p className="mb-6">Status: {room.status}</p>

      <h2 className="text-xl font-semibold mb-2">Players</h2>
      <ul className="border rounded p-4 w-64">
        {room.players.map((p, i) => (
          <li
            key={i}
            className={`flex justify-between mb-2 p-2 rounded ${
              p.username === username ? "bg-green-200" : "bg-gray-100"
            }`}
          >
            <span>{p.username}</span>
            <span className="text-sm text-gray-600">
              {p.alive ? "Alive" : "Dead"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
