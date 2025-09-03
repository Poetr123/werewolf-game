<button
  onClick={async () => {
    if (!username) return alert("Isi username dulu");

    const res = await fetch("/api/join-room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId,
        playerId: Math.random().toString(36).substring(2, 8),
        username,
      }),
    });

    const data = await res.json();
    if (data.error) return alert(data.error);

    router.push(`/room/${roomId}?user=${username}`);
  }}
  className="bg-green-500 text-white px-4 py-2 rounded"
>
  Join Room
</button>
