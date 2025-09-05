import { 
  supabase, 
  initializeDatabase, 
  createRoom, 
  joinRoom, 
  getPlayersInRoom, 
  getGameState, 
  updateGameState, 
  sendMessage, 
  getMessages, 
  subscribeToRoom, 
  updatePlayer 
} from './supabase.js';

// State aplikasi
let currentUser = null;
let currentRoom = null;
let gameState = null;
let players = [];
let messages = [];
let subscription = null;
let timerInterval = null;

// Elemen DOM
const loginPage = document.getElementById('login-page');
const lobbyPage = document.getElementById('lobby-page');
const gamePage = document.getElementById('game-page');
const usernameInput = document.getElementById('username-input');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const createRoomBtn = document.getElementById('create-room-btn');
const roomCodeInput = document.getElementById('room-code-input');
const joinRoomBtn = document.getElementById('join-room-btn');
const roomInfo = document.getElementById('room-info');
const roomCodeDisplay = document.getElementById('room-code');
const playerCount = document.getElementById('player-count');
const maxPlayers = document.getElementById('max-players');
const startGameBtn = document.getElementById('start-game-btn');
const playersList = document.getElementById('players-list');
const gameRoomCode = document.getElementById('game-room-code');
const gamePhase = document.getElementById('game-phase');
const timerDisplay = document.getElementById('timer');
const playerListGame = document.getElementById('player-list-game');
const actionSection = document.getElementById('action-section');
const actionButtons = document.getElementById('action-buttons');
const discussionSection = document.getElementById('discussion-section');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');
const votingSection = document.getElementById('voting-section');
const votingOptions = document.getElementById('voting-options');
const gameResult = document.getElementById('game-result');
const resultTitle = document.getElementById('result-title');
const resultDescription = document.getElementById('result-description');
const backToLobby = document.getElementById('back-to-lobby');

// Inisialisasi aplikasi
document.addEventListener('DOMContentLoaded', () => {
  initializeDatabase();
  setupEventListeners();
  checkExistingSession();
});

function setupEventListeners() {
  loginBtn.addEventListener('click', handleLogin);
  usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
  
  createRoomBtn.addEventListener('click', handleCreateRoom);
  joinRoomBtn.addEventListener('click', handleJoinRoom);
  startGameBtn.addEventListener('click', handleStartGame);
  
  sendChatBtn.addEventListener('click', handleSendMessage);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSendMessage();
  });
  
  backToLobby.addEventListener('click', handleBackToLobby);
}

function checkExistingSession() {
  const savedUser = localStorage.getItem('werewolf_username');
  if (savedUser && savedUser.length >= 3) {
    usernameInput.value = savedUser;
  }
}

async function handleLogin() {
  const username = usernameInput.value.trim();
  
  if (username.length < 3 || username.length > 10) {
    loginError.textContent = 'Username harus 3-10 karakter';
    return;
  }
  
  currentUser = username;
  localStorage.setItem('werewolf_username', username);
  
  loginError.textContent = '';
  showPage(lobbyPage);
}

async function handleCreateRoom() {
  const roomCode = generateRoomCode();
  const maxPlayers = 10; // Maksimal 10 pemain
  
  const room = await createRoom(roomCode, maxPlayers);
  if (!room) {
    alert('Gagal membuat room. Coba lagi.');
    return;
  }
  
  await joinRoomAsPlayer(roomCode);
}

async function handleJoinRoom() {
  const roomCode = roomCodeInput.value.trim().toUpperCase();
  
  if (!roomCode) {
    alert('Masukkan kode room');
    return;
  }
  
  await joinRoomAsPlayer(roomCode);
}

async function joinRoomAsPlayer(roomCode) {
  const player = await joinRoom(roomCode, currentUser);
  if (!player) {
    alert('Gagal bergabung dengan room. Mungkin room penuh atau tidak ada.');
    return;
  }
  
  currentRoom = roomCode;
  roomCodeDisplay.textContent = roomCode;
  gameRoomCode.textContent = roomCode;
  
  // Setup real-time subscription
  if (subscription) {
    subscription.unsubscribe();
  }
  
  subscription = subscribeToRoom(roomCode, handleRoomUpdate);
  
  // Tampilkan info room
  roomInfo.classList.remove('hidden');
  updateRoomInfo();
}

async function handleRoomUpdate(payload) {
  // Update data berdasarkan perubahan
  await updateRoomInfo();
  
  // Jika game sudah mulai, update state game
  if (gameState && gameState.status === 'playing') {
    await updateGameUI();
  }
}

async function updateRoomInfo() {
  players = await getPlayersInRoom(currentRoom);
  const roomState = await getGameState(currentRoom);
  
  playerCount.textContent = players.length;
  playersList.innerHTML = '';
  
  players.forEach(player => {
    const playerEl = document.createElement('div');
    playerEl.className = 'player-item';
    playerEl.textContent = player.username;
    playersList.appendChild(playerEl);
  });
  
  // Enable/disable start game button berdasarkan jumlah pemain
  if (players.length >= 5 && players.length <= 10) {
    startGameBtn.disabled = false;
  } else {
    startGameBtn.disabled = true;
  }
  
  // Jika game sudah mulai, pindah ke halaman game
  if (roomState && roomState.status === 'playing' && !gamePage.classList.contains('active')) {
    gameState = roomState;
    showPage(gamePage);
    initializeGame();
  }
}

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

async function handleStartGame() {
  // Tentukan komposisi peran berdasarkan jumlah pemain
  const roles = determineRoles(players.length);
  
  // Acak peran untuk pemain
  const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
  
  for (let i = 0; i < shuffledPlayers.length; i++) {
    const player = shuffledPlayers[i];
    await updatePlayer(currentRoom, player.username, {
      role: roles[i].role,
      faction: roles[i].faction,
      is_alive: true
    });
  }
  
  // Buat state game baru
  gameState = await updateGameState(currentRoom, {
    status: 'playing',
    phase: 'night',
    day: 1,
    timer: 75,
    voted_players: {}
  });
  
  showPage(gamePage);
  initializeGame();
}

function determineRoles(playerCount) {
  const roles = [];
  
  // Tentukan komposisi berdasarkan jumlah pemain
  if (playerCount === 5) {
    // 3 Innocent, 1 Neutral, 1 Werewolf
    roles.push({ role: 'warga', faction: 'innocent' });
    roles.push({ role: 'warga', faction: 'innocent' });
    roles.push({ role: 'penjaga', faction: 'innocent' });
    roles.push({ role: 'bandit', faction: 'neutral' });
    roles.push({ role: 'werewolf', faction: 'werewolf' });
  } else if (playerCount >= 6 && playerCount <= 7) {
    // Tambah 1 Innocent dan 1 Neutral per pemain tambahan
    const innocentCount = 3 + (playerCount - 5);
    const neutralCount = 1 + (playerCount - 5);
    const werewolfCount = 1;
    
    for (let i = 0; i < innocentCount; i++) {
      if (i === 0) roles.push({ role: 'pemburu', faction: 'innocent' });
      else if (i === 1) roles.push({ role: 'dukun', faction: 'innocent' });
      else roles.push({ role: 'warga', faction: 'innocent' });
    }
    
    for (let i = 0; i < neutralCount; i++) {
      if (i === 0) roles.push({ role: 'bandit', faction: 'neutral' });
      else roles.push({ role: 'penyihir', faction: 'neutral' });
    }
    
    for (let i = 0; i < werewolfCount; i++) {
      roles.push({ role: 'werewolf', faction: 'werewolf' });
    }
  } else if (playerCount >= 8 && playerCount <= 10) {
    // Tambah 2 Innocent dan 1 Werewolf per 2 pemain tambahan
    const baseCount = 7;
    const additionalPlayers = playerCount - baseCount;
    const additionalInnocent = Math.floor(additionalPlayers / 2) * 2;
    const additionalWerewolf = Math.floor(additionalPlayers / 2);
    
    const innocentCount = 4 + additionalInnocent;
    const neutralCount = 2;
    const werewolfCount = 1 + additionalWerewolf;
    
    for (let i = 0; i < innocentCount; i++) {
      if (i === 0) roles.push({ role: 'pemburu', faction: 'innocent' });
      else if (i === 1) roles.push({ role: 'dukun', faction: 'innocent' });
      else if (i === 2) roles.push({ role: 'penjaga', faction: 'innocent' });
      else roles.push({ role: 'warga', faction: 'innocent' });
    }
    
    for (let i = 0; i < neutralCount; i++) {
      if (i === 0) roles.push({ role: 'bandit', faction: 'neutral' });
      else roles.push({ role: 'penyihir', faction: 'neutral' });
    }
    
    for (let i = 0; i < werewolfCount; i++) {
      roles.push({ role: 'werewolf', faction: 'werewolf' });
    }
  }
  
  return roles;
}

async function initializeGame() {
  // Update data pemain
  players = await getPlayersInRoom(currentRoom);
  
  // Tampilkan pemain
  renderPlayers();
  
  // Mulai fase game
  startGamePhase();
}

function renderPlayers() {
  playerListGame.innerHTML = '';
  
  players.forEach(player => {
    const playerCard = document.createElement('div');
    playerCard.className = `player-card ${!player.is_alive ? 'dead' : ''} ${player.username === currentUser ? 'self' : ''}`;
    
    const playerName = document.createElement('div');
    playerName.textContent = player.username;
    
    playerCard.appendChild(playerName);
    
    // Tampilkan role jika pemain sudah mati atau adalah diri sendiri
    if (!player.is_alive || player.username === currentUser) {
      const roleBadge = document.createElement('div');
      roleBadge.className = 'role-badge';
      roleBadge.textContent = getRoleAbbreviation(player.role);
      roleBadge.title = `${player.role} (${player.faction})`;
      playerCard.appendChild(roleBadge);
    }
    
    playerListGame.appendChild(playerCard);
  });
}

function getRoleAbbreviation(role) {
  const abbreviations = {
    'warga': 'W',
    'penjaga': 'PJ',
    'pemburu': 'PB',
    'dukun': 'D',
    'bandit': 'B',
    'penyihir': 'PS',
    'werewolf': 'WW'
  };
  
  return abbreviations[role] || '?';
}

async function startGamePhase() {
  // Hentikan timer sebelumnya
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  
  // Sembunyikan semua section
  actionSection.classList.add('hidden');
  discussionSection.classList.add('hidden');
  votingSection.classList.add('hidden');
  gameResult.classList.add('hidden');
  
  // Update UI berdasarkan fase
  gamePhase.textContent = gameState.phase;
  
  switch (gameState.phase) {
    case 'night':
      startNightPhase();
      break;
    case 'morning':
      startMorningPhase();
      break;
    case 'day':
      startDayPhase();
      break;
    case 'evening':
      startEveningPhase();
      break;
    case 'ended':
      showGameResult();
      break;
  }
  
  // Mulai timer
  let timeLeft = gameState.timer;
  updateTimerDisplay(timeLeft);
  
  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerDisplay(timeLeft);
    
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      nextPhase();
    }
  }, 1000);
}

function updateTimerDisplay(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  timerDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function startNightPhase() {
  actionSection.classList.remove('hidden');
  actionButtons.innerHTML = '';
  
  // Dapatkan data pemain saat ini
  const currentPlayer = players.find(p => p.username === currentUser);
  
  if (!currentPlayer.is_alive) {
    actionButtons.innerHTML = '<p>Kamu sudah mati dan tidak bisa melakukan aksi.</p>';
    return;
  }
  
  // Tampilkan aksi berdasarkan role
  switch (currentPlayer.role) {
    case 'penjaga':
      renderGuardActions();
      break;
    case 'pemburu':
      renderHunterActions();
      break;
    case 'dukun':
      renderSeerActions();
      break;
    case 'bandit':
      renderBanditActions();
      break;
    case 'penyihir':
      renderWitchActions();
      break;
    case 'werewolf':
      renderWerewolfActions();
      break;
    default:
      actionButtons.innerHTML = '<p>Kamu tidak memiliki aksi khusus malam ini.</p>';
  }
}

function renderGuardActions() {
  actionButtons.innerHTML = '<p>Pilih pemain untuk dilindungi:</p>';
  
  players.forEach(player => {
    if (player.is_alive && player.username !== currentUser) {
      const button = document.createElement('button');
      button.className = 'action-btn';
      button.textContent = player.username;
      button.addEventListener('click', () => performGuardAction(player.username));
      actionButtons.appendChild(button);
    }
  });
  
  // Tambahkan opsi untuk melindungi diri sendiri
  const selfButton = document.createElement('button');
  selfButton.className = 'action-btn';
  selfButton.textContent = 'Diri Sendiri';
  selfButton.addEventListener('click', () => performGuardAction(currentUser));
  actionButtons.appendChild(selfButton);
}

function renderHunterActions() {
  actionButtons.innerHTML = '<p>Pilih pemain untuk ditembak:</p>';
  
  players.forEach(player => {
    if (player.is_alive && player.username !== currentUser) {
      const button = document.createElement('button');
      button.className = 'action-btn';
      button.textContent = player.username;
      button.addEventListener('click', () => performHunterAction(player.username));
      actionButtons.appendChild(button);
    }
  });
}

function renderSeerActions() {
  // Cek apakah masih memiliki kesempatan meramal
  const currentPlayer = players.find(p => p.username === currentUser);
  const seerChances = currentPlayer.seer_chances || 2;
  
  if (seerChances <= 0) {
    actionButtons.innerHTML = '<p>Kesempatan meramal kamu sudah habis.</p>';
    return;
  }
  
  actionButtons.innerHTML = `<p>Kesempatan meramal: ${seerChances}. Pilih pemain untuk diramal:</p>`;
  
  players.forEach(player => {
    if (player.is_alive && player.username !== currentUser) {
      const button = document.createElement('button');
      button.className = 'action-btn';
      button.textContent = player.username;
      button.addEventListener('click', () => performSeerAction(player.username));
      actionButtons.appendChild(button);
    }
  });
}

function renderBanditActions() {
  // Cek apakah masih memiliki kesempatan memberi tanda
  const currentPlayer = players.find(p => p.username === currentUser);
  const banditChances = currentPlayer.bandit_chances || 2;
  const banditKills = currentPlayer.bandit_kills || 0;
  
  if (banditChances <= 0) {
    actionButtons.innerHTML = '<p>Kesempatan memberi tanda sudah habis.</p>';
    return;
  }
  
  actionButtons.innerHTML = `<p>Kesempatan memberi tanda: ${banditChances}. Target membunuh: ${banditKills}/3. Pilih pemain untuk diberi tanda:</p>`;
  
  players.forEach(player => {
    if (player.is_alive && player.username !== currentUser) {
      const button = document.createElement('button');
      button.className = 'action-btn';
      button.textContent = player.username;
      button.addEventListener('click', () => performBanditAction(player.username));
      actionButtons.appendChild(button);
    }
  });
}

function renderWitchActions() {
  // Cek apakah ada pemain yang mati dan bisa dihidupkan
  const deadPlayers = players.filter(p => !p.is_alive && p.faction !== 'neutral');
  const hasReviveChance = true; // Asumsi penyihir bisa menghidupkan sekali per game
  
  if (deadPlayers.length === 0 || !hasReviveChance) {
    actionButtons.innerHTML = '<p>Tidak ada aksi yang bisa dilakukan saat ini.</p>';
    return;
  }
  
  actionButtons.innerHTML = '<p>Pilih pemain yang mati untuk dihidupkan:</p>';
  
  deadPlayers.forEach(player => {
    const button = document.createElement('button');
    button.className = 'action-btn';
    button.textContent = player.username;
    button.addEventListener('click', () => performWitchAction(player.username));
    actionButtons.appendChild(button);
  });
}

function renderWerewolfActions() {
  actionButtons.innerHTML = '<p>Pilih pemain untuk dibunuh:</p>';
  
  players.forEach(player => {
    if (player.is_alive && player.faction !== 'werewolf') {
      const button = document.createElement('button');
      button.className = 'action-btn';
      button.textContent = player.username;
      button.addEventListener('click', () => performWerewolfAction(player.username));
      actionButtons.appendChild(button);
    }
  });
}

async function performGuardAction(target) {
  // Simpan aksi penjaga
  await updatePlayer(currentRoom, currentUser, {
    guard_target: target
  });
  
  actionButtons.innerHTML = `<p>Kamu akan melindungi ${target} malam ini.</p>`;
}

async function performHunterAction(target) {
  // Simpan aksi pemburu
  await updatePlayer(currentRoom, currentUser, {
    hunter_target: target
  });
  
  actionButtons.innerHTML = `<p>Kamu akan menembak ${target} malam ini.</p>`;
}

async function performSeerAction(target) {
  // Kurangi kesempatan meramal
  const currentPlayer = players.find(p => p.username === currentUser);
  const newChances = (currentPlayer.seer_chances || 2) - 1;
  
  // Dapatkan role target
  const targetPlayer = players.find(p => p.username === target);
  
  // Simpan aksi dukun
  await updatePlayer(currentRoom, currentUser, {
    seer_target: target,
    seer_chances: newChances
  });
  
  actionButtons.innerHTML = `<p>Kamu meramal ${target}. Role mereka adalah: ${targetPlayer.role} (${targetPlayer.faction}).</p>`;
}

async function performBanditAction(target) {
  // Kurangi kesempatan memberi tanda
  const currentPlayer = players.find(p => p.username === currentUser);
  const newChances = (currentPlayer.bandit_chances || 2) - 1;
  
  // Simpan aksi bandit
  await updatePlayer(currentRoom, currentUser, {
    bandit_target: target,
    bandit_chances: newChances
  });
  
  actionButtons.innerHTML = `<p>Kamu memberi tanda pada ${target}. Jika mereka menggunakan skill malam ini, mereka akan mati.</p>`;
}

async function performWitchAction(target) {
  // Hidupkan pemain dan ubah menjadi neutral
  await updatePlayer(currentRoom, target, {
    is_alive: true,
    faction: 'neutral',
    role: 'pembantu_penyihir',
    revived_by: currentUser
  });
  
  actionButtons.innerHTML = `<p>Kamu menghidupkan ${target}. Sekarang mereka adalah pembantumu.</p>`;
}

async function performWerewolfAction(target) {
  // Simpan aksi werewolf
  await updatePlayer(currentRoom, currentUser, {
    werewolf_target: target
  });
  
  actionButtons.innerHTML = `<p>Kamu memilih untuk membunuh ${target} malam ini.</p>`;
}

async function startMorningPhase() {
  // Proses hasil aksi malam
  await processNightActions();
  
  // Tampilkan hasil aksi malam
  actionSection.classList.remove('hidden');
  actionButtons.innerHTML = '<p>Memproses hasil aksi malam...</p>';
  
  // Ambil data terbaru
  players = await getPlayersInRoom(currentRoom);
  renderPlayers();
  
  // Tampilkan siapa yang mati
  const deadPlayers = players.filter(p => !p.is_alive && p.died_last_night);
  if (deadPlayers.length > 0) {
    const deadNames = deadPlayers.map(p => p.username).join(', ');
    actionButtons.innerHTML += `<p>Pemain yang mati malam ini: ${deadNames}</p>`;
  } else {
    actionButtons.innerHTML += '<p>Tidak ada yang mati malam ini.</p>';
  }
}

async function processNightActions() {
  // Reset status mati semalam
  for (const player of players) {
    if (player.died_last_night) {
      await updatePlayer(currentRoom, player.username, {
        died_last_night: false
      });
    }
  }
  
  // Proses aksi werewolf
  const werewolves = players.filter(p => p.faction === 'werewolf' && p.is_alive);
  const werewolfTargets = {};
  
  for (const werewolf of werewolves) {
    if (werewolf.werewolf_target) {
      werewolfTargets[werewolf.werewolf_target] = (werewolfTargets[werewolf.werewolf_target] || 0) + 1;
    }
  }
  
  // Tentukan target werewolf (yang paling banyak dipilih)
  let mainTarget = null;
  let maxVotes = 0;
  
  for (const [target, votes] of Object.entries(werewolfTargets)) {
    if (votes > maxVotes) {
      mainTarget = target;
      maxVotes = votes;
    }
  }
  
  // Proses aksi penjaga
  const guards = players.filter(p => p.role === 'penjaga' && p.is_alive);
  let guardedPlayer = null;
  
  for (const guard of guards) {
    if (guard.guard_target) {
      guardedPlayer = guard.guard_target;
      break;
    }
  }
  
  // Jika target werewolf dilindungi, batalkan pembunuhan
  if (mainTarget && mainTarget !== guardedPlayer) {
    await updatePlayer(currentRoom, mainTarget, {
      is_alive: false,
      died_last_night: true
    });
  }
  
  // Proses aksi bandit
  const bandits = players.filter(p => p.role === 'bandit' && p.is_alive);
  
  for (const bandit of bandits) {
    if (bandit.bandit_target) {
      const targetPlayer = players.find(p => p.username === bandit.bandit_target);
      
      // Jika target menggunakan skill, target mati dan bandit dapat kesempatan tambahan
      if (targetPlayer && (targetPlayer.werewolf_target || targetPlayer.guard_target || 
          targetPlayer.hunter_target || targetPlayer.seer_target || targetPlayer.bandit_target)) {
        
        await updatePlayer(currentRoom, bandit.bandit_target, {
          is_alive: false,
          died_last_night: true
        });
        
        // Tambah kesempatan bandit dan tambah kill count
        const newChances = (bandit.bandit_chances || 0) + 1;
        const newKills = (bandit.bandit_kills || 0) + 1;
        
        await updatePlayer(currentRoom, bandit.username, {
          bandit_chances: newChances,
          bandit_kills: newKills
        });
      }
    }
  }
  
  // Proses aksi pemburu
  const hunters = players.filter(p => p.role === 'pemburu' && p.is_alive);
  
  for (const hunter of hunters) {
    if (hunter.hunter_target) {
      const targetPlayer = players.find(p => p.username === hunter.hunter_target);
      
      if (targetPlayer) {
        // Jika target adalah innocent, pemburu juga mati
        if (targetPlayer.faction === 'innocent') {
          await updatePlayer(currentRoom, hunter.username, {
            is_alive: false,
            died_last_night: true
          });
        }
        
        // Target mati
        await updatePlayer(currentRoom, hunter.hunter_target, {
          is_alive: false,
          died_last_night: true
        });
      }
    }
  }
}

function startDayPhase() {
  discussionSection.classList.remove('hidden');
  
  // Muat pesan chat
  loadMessages();
  
  // Set timer diskusi
  gameState.timer = 75;
  updateTimerDisplay(gameState.timer);
}

function startEveningPhase() {
  votingSection.classList.remove('hidden');
  votingOptions.innerHTML = '';
  
  // Dapatkan pemain yang masih hidup
  const alivePlayers = players.filter(p => p.is_alive);
  
  // Tampilkan opsi voting
  votingOptions.innerHTML = '<p>Pilih pemain untuk dieliminasi:</p>';
  
  alivePlayers.forEach(player => {
    if (player.username !== currentUser) {
      const button = document.createElement('button');
      button.className = 'vote-btn';
      button.textContent = player.username;
      button.addEventListener('click', () => castVote(player.username));
      votingOptions.appendChild(button);
    }
  });
  
  // Tambahkan opsi untuk tidak memilih
  const abstainButton = document.createElement('button');
  abstainButton.className = 'vote-btn';
  abstainButton.textContent = 'Tidak Memilih';
  abstainButton.addEventListener('click', () => castVote(null));
  votingOptions.appendChild(abstainButton);
  
  // Set timer voting
  gameState.timer = 15;
  updateTimerDisplay(gameState.timer);
}

async function castVote(target) {
  // Simpan vote
  const currentVotes = gameState.voted_players || {};
  currentVotes[currentUser] = target;
  
  await updateGameState(currentRoom, {
    voted_players: currentVotes
  });
  
  votingOptions.innerHTML = `<p>Kamu memilih ${target || 'tidak memilih'}.</p>`;
}

async function nextPhase() {
  switch (gameState.phase) {
    case 'night':
      await updateGameState(currentRoom, {
        phase: 'morning',
        timer: 10
      });
      break;
    case 'morning':
      await updateGameState(currentRoom, {
        phase: 'day',
        timer: 75
      });
      break;
    case 'day':
      await updateGameState(currentRoom, {
        phase: 'evening',
        timer: 15,
        voted_players: {}
      });
      break;
    case 'evening':
      await processVoting();
      break;
  }
  
  // Update game state
  gameState = await getGameState(currentRoom);
  startGamePhase();
}

async function processVoting() {
  const votes = gameState.voted_players || {};
  const voteCount = {};
  
  // Hitung suara
  for (const [voter, target] of Object.entries(votes)) {
    if (target) {
      voteCount[target] = (voteCount[target] || 0) + 1;
    }
  }
  
  // Cari pemain dengan suara terbanyak
  let maxVotes = 0;
  let eliminatedPlayer = null;
  let tie = false;
  
  for (const [player, count] of Object.entries(voteCount)) {
    if (count > maxVotes) {
      maxVotes = count;
      eliminatedPlayer = player;
      tie = false;
    } else if (count === maxVotes) {
      tie = true;
    }
  }
  
  if (tie) {
    // Jika ada tie, lakukan voting ulang dengan pemain yang tie tidak bisa voting
    await updateGameState(currentRoom, {
      phase: 'evening',
      timer: 15,
      voted_players: {},
      tie_players: Object.keys(voteCount).filter(player => voteCount[player] === maxVotes)
    });
  } else if (eliminatedPlayer) {
    // Eliminasi pemain
    await updatePlayer(currentRoom, eliminatedPlayer, {
      is_alive: false
    });
    
    // Lanjut ke hari berikutnya atau akhiri game
    await checkGameEnd();
    
    if (gameState.status !== 'ended') {
      await updateGameState(currentRoom, {
        phase: 'night',
        timer: 75,
        day: gameState.day + 1
      });
    }
  } else {
    // Tidak ada yang dipilih, lanjut ke malam
    await updateGameState(currentRoom, {
      phase: 'night',
      timer: 75,
      day: gameState.day + 1
    });
  }
}

async function checkGameEnd() {
  players = await getPlayersInRoom(currentRoom);
  
  // Hitung jumlah pemain per fraksi yang masih hidup
  const innocentCount = players.filter(p => p.is_alive && p.faction === 'innocent').length;
  const werewolfCount = players.filter(p => p.is_alive && p.faction === 'werewolf').length;
  const neutralCount = players.filter(p => p.is_alive && p.faction === 'neutral').length;
  
  // Cek kemenangan Werewolf
  if (werewolfCount >= innocentCount + neutralCount) {
    await endGame('werewolf', 'Werewolf menang! Mereka berhasil menguasai desa.');
    return;
  }
  
  // Cek kemenangan Innocent
  if (werewolfCount === 0) {
    await endGame('innocent', 'Penduduk desa menang! Mereka berhasil mengusir semua werewolf.');
    return;
  }
  
  // Cek kemenangan individual untuk peran netral
  const bandits = players.filter(p => p.role === 'bandit' && p.is_alive);
  for (const bandit of bandits) {
    if (bandit.bandit_kills >= 3) {
      await endGame('bandit', `${bandit.username} (Bandit) menang! Berhasil membunuh 3 target.`);
      return;
    }
  }
  
  const witches = players.filter(p => p.role === 'penyihir' && p.is_alive);
  const witchHelpers = players.filter(p => p.role === 'pembantu_penyihir' && p.is_alive);
  
  if (witches.length > 0 && witchHelpers.length > 0 && innocentCount + werewolfCount === 0) {
    await endGame('witch', `${witches[0].username} (Penyihir) menang! Berhasil menguasai desa dengan pembantunya.`);
    return;
  }
}

async function endGame(winner, message) {
  await updateGameState(currentRoom, {
    status: 'ended',
    phase: 'ended',
    winner: winner,
    winner_message: message
  });
}

function showGameResult() {
  gameResult.classList.remove('hidden');
  resultTitle.textContent = `Game Over - ${gameState.winner} Menang!`;
  resultDescription.textContent = gameState.winner_message;
}

async function handleSendMessage() {
  const message = chatInput.value.trim();
  
  if (message) {
    await sendMessage(currentRoom, currentUser, message);
    chatInput.value = '';
  }
}

async function loadMessages() {
  messages = await getMessages(currentRoom);
  chatMessages.innerHTML = '';
  
  messages.forEach(msg => {
    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${msg.username === 'system' ? 'system' : 'player'}`;
    
    if (msg.username === 'system') {
      messageEl.textContent = msg.message;
    } else {
      messageEl.textContent = `${msg.username}: ${msg.message}`;
    }
    
    chatMessages.appendChild(messageEl);
  });
  
  // Scroll ke bawah
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showPage(page) {
  // Sembunyikan semua halaman
  loginPage.classList.remove('active');
  lobbyPage.classList.remove('active');
  gamePage.classList.remove('active');
  
  // Tampilkan halaman yang dipilih
  page.classList.add('active');
}

async function handleBackToLobby() {
  // Reset state
  currentRoom = null;
  gameState = null;
  
  // Berhenti subscribe
  if (subscription) {
    subscription.unsubscribe();
    subscription = null;
  }
  
  // Hentikan timer
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  
  // Kembali ke lobi
  showPage(lobbyPage);
  roomInfo.classList.add('hidden');
}
