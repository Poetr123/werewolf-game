import { createClient } from 'https://unpkg.com/@supabase/supabase-js@2.7.1/dist/index.mjs'

const SUPABASE_URL = 'https://nmcwvlaytdxivfmbzsnl.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tY3d2bGF5dGR4aXZmbWJ6c25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwODcxNTMsImV4cCI6MjA3MjY2MzE1M30.Z6qBoi5L8E3pPjD-U8Er0pDLIRvipkL0lXOem0Gz8cE'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Fungsi untuk inisialisasi database
export async function initializeDatabase() {
  // Membuat tabel rooms jika belum ada
  const { error: roomsError } = await supabase
    .from('rooms')
    .insert({ id: 'init' })
    .select()
    .maybeSingle()
  
  if (roomsError && roomsError.code !== '23505') {
    console.error('Error initializing rooms table:', roomsError)
  }

  // Membuat tabel players jika belum ada
  const { error: playersError } = await supabase
    .from('players')
    .insert({ id: 'init', room_id: 'init', username: 'init' })
    .select()
    .maybeSingle()
  
  if (playersError && playersError.code !== '23505') {
    console.error('Error initializing players table:', playersError)
  }

  // Membuat tabel game_state jika belum ada
  const { error: gameStateError } = await supabase
    .from('game_state')
    .insert({ id: 'init', room_id: 'init' })
    .select()
    .maybeSingle()
  
  if (gameStateError && gameStateError.code !== '23505') {
    console.error('Error initializing game_state table:', gameStateError)
  }

  // Membuat tabel messages jika belum ada
  const { error: messagesError } = await supabase
    .from('messages')
    .insert({ id: 'init', room_id: 'init', username: 'init', message: 'init' })
    .select()
    .maybeSingle()
  
  if (messagesError && messagesError.code !== '23505') {
    console.error('Error initializing messages table:', messagesError)
  }
}

// Fungsi untuk membuat room baru
export async function createRoom(roomCode, maxPlayers) {
  const { data, error } = await supabase
    .from('rooms')
    .insert([
      { 
        id: roomCode, 
        max_players: maxPlayers,
        status: 'waiting'
      }
    ])
    .select()
    .single()
  
  if (error) {
    console.error('Error creating room:', error)
    return null
  }
  
  return data
}

// Fungsi untuk bergabung dengan room
export async function joinRoom(roomCode, username) {
  const { data, error } = await supabase
    .from('players')
    .insert([
      { 
        room_id: roomCode, 
        username: username,
        is_alive: true,
        role: null,
        faction: null
      }
    ])
    .select()
    .single()
  
  if (error) {
    console.error('Error joining room:', error)
    return null
  }
  
  return data
}

// Fungsi untuk mendapatkan daftar pemain di room
export async function getPlayersInRoom(roomCode) {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('room_id', roomCode)
    .order('created_at', { ascending: true })
  
  if (error) {
    console.error('Error getting players:', error)
    return []
  }
  
  return data
}

// Fungsi untuk mendapatkan status game
export async function getGameState(roomCode) {
  const { data, error } = await supabase
    .from('game_state')
    .select('*')
    .eq('room_id', roomCode)
    .single()
  
  if (error) {
    console.error('Error getting game state:', error)
    return null
  }
  
  return data
}

// Fungsi untuk mengupdate status game
export async function updateGameState(roomCode, updates) {
  const { data, error } = await supabase
    .from('game_state')
    .update(updates)
    .eq('room_id', roomCode)
    .select()
    .single()
  
  if (error) {
    console.error('Error updating game state:', error)
    return null
  }
  
  return data
}

// Fungsi untuk mengirim pesan chat
export async function sendMessage(roomCode, username, message) {
  const { data, error } = await supabase
    .from('messages')
    .insert([
      { 
        room_id: roomCode, 
        username: username,
        message: message
      }
    ])
    .select()
    .single()
  
  if (error) {
    console.error('Error sending message:', error)
    return null
  }
  
  return data
}

// Fungsi untuk mendapatkan pesan chat
export async function getMessages(roomCode) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('room_id', roomCode)
    .order('created_at', { ascending: true })
  
  if (error) {
    console.error('Error getting messages:', error)
    return []
  }
  
  return data
}

// Fungsi untuk real-time updates
export function subscribeToRoom(roomCode, callback) {
  return supabase
    .channel('room_changes')
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'players',
        filter: `room_id=eq.${roomCode}`
      }, 
      callback
    )
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'game_state',
        filter: `room_id=eq.${roomCode}`
      }, 
      callback
    )
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'messages',
        filter: `room_id=eq.${roomCode}`
      }, 
      callback
    )
    .subscribe()
}

// Fungsi untuk mengupdate status pemain
export async function updatePlayer(roomCode, username, updates) {
  const { data, error } = await supabase
    .from('players')
    .update(updates)
    .eq('room_id', roomCode)
    .eq('username', username)
    .select()
    .single()
  
  if (error) {
    console.error('Error updating player:', error)
    return null
  }
  
  return data
}
