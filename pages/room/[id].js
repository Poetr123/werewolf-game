useEffect(() => {
  if (!id || !username) return;
  const playerId = localStorage.getItem("playerId");

  const leave = async () => {
    await fetch("/api/leave-room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: id, playerId }),
    });
  };

  // disconnect saat tab ditutup / refresh
  window.addEventListener("beforeunload", leave);

  return () => {
    leave();
    window.removeEventListener("beforeunload", leave);
  };
}, [id, username]);
