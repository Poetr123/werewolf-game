import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export default function Room() {
  const router = useRouter();
  const { id, user } = router.query;

  const [room, setRoom] = useState(null);
  const [phase, setPhase] = useState("waiting"); // night | morning | discussion | voting
  const [time, setTime] = useState(0);
  const [messages, setMessages] = useState([]);
  const [inputMsg, setInputMsg] = useState("");
  const [voteTarget, setVoteTarget] = useState(null);

  // Fetch room data tiap 2 detik
  useEffect(() => {
    if (!id) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/game-action?roomId=${id}`);
      const data = await res.json();
      setRoom(data);
      setPhase(data.phase);
      setTime(data.timeLeft);
    }, 2000);
    return () => clearInterval(interval);
  }, [id]);

  const sendMessage = () => {
    if (!inputMsg) return;
    setMessages((prev) => [...prev, { user, text: inputMsg }]);
    setInputMsg("");
  };

  const sendVote = async () => {
    if (!voteTarget) return alert("Pilih target vote!");
    await fetch("/api/game-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: id, action: "vote", voter: user, target: voteTarget })
    });
    setVoteTarget(null);
  };

  if (!room) return <div>Loading room...</div>;

  return (
    <div className="flex flex-col p-4 min-h-screen bg-gray-100">
      <h1 className="text-2xl font-bold mb-2">Room {id}</h1>
      <h2 className="text-lg">Phase: {phase} | Time: {time}s</h2>

      {/* Players */}
      <div className="my-4">
        <h3 className="font-semibold">Players:</h3>
        <ul>
          {room.players.map((p) => (
            <li key={p.id} className={`${p.alive ? "text-black" : "text-red-500 line-through"}`}>
              {p.username} {p.username === user && "(You)"}
            </li>
          ))}
        </ul>
      </div>

      {/* Voting */}
      {phase === "voting" && (
        <div className="my-4">
          <h3 className="font-semibold">Voting:</h3>
          <select value={voteTarget || ""} onChange={(e) => setVoteTarget(e.target.value)}>
            <option value="">-- pilih pemain --</option>
            {room.players.filter((p) => p.alive && p.username !== user).map((p) => (
              <option key={p.id} value={p.username}>{p.username}</option>
            ))}
          </select>
          <button onClick={sendVote} className="bg-blue-500 text-white px-3 py-1 rounded ml-2">
            Vote
          </button>
        </div>
      )}

      {/* Chat */}
      <div className="flex-1 border p-2 bg-white overflow-y-auto mb-2">
        {messages.map((m, i) => (
          <div key={i}><b>{m.user}:</b> {m.text}</div>
        ))}
      </div>
      {phase === "discussion" && (
        <div className="flex">
          <input
            value={inputMsg}
            onChange={(e) => setInputMsg(e.target.value)}
            placeholder="Ketik pesan..."
            className="border p-2 flex-1"
          />
          <button onClick={sendMessage} className="bg-green-500 text-white px-3 ml-2 rounded">
            Kirim
          </button>
        </div>
      )}
    </div>
  );
}
