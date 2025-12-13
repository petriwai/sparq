import { supabase } from '@/lib/supabase'

export type ChatMessage = {
  id: string
  ride_id: string
  sender_id: string
  message_type: 'text' | 'voice'
  content: string
  created_at: string
  read_at: string | null
}

export async function sendText(rideId: string, text: string) {
  const { data: userRes, error: userErr } = await supabase.auth.getUser()
  if (userErr) throw userErr
  const user = userRes.user
  if (!user) throw new Error('Not signed in')

  const { error } = await supabase.from('messages').insert({
    ride_id: rideId,
    sender_id: user.id,
    message_type: 'text',
    content: text,
  })
  if (error) throw error
}

export async function sendVoice(rideId: string, audioBlob: Blob) {
  const { data: userRes } = await supabase.auth.getUser()
  const user = userRes.user
  if (!user) throw new Error('Not signed in')

  // Use a PRIVATE bucket called "chat-audio"
  const fileName = `voice_${Date.now()}.webm`
  const path = `${rideId}/${user.id}/${fileName}`

  const up = await supabase.storage.from('chat-audio').upload(path, audioBlob, {
    contentType: 'audio/webm',
    upsert: false,
  })
  if (up.error) throw up.error

  const { error } = await supabase.from('messages').insert({
    ride_id: rideId,
    sender_id: user.id,
    message_type: 'voice',
    content: path, // store storage path, not a public URL
  })
  if (error) throw error
}

export async function markRead(rideId: string) {
  const { error } = await supabase.rpc('mark_messages_read', { p_ride_id: rideId })
  if (error) throw error
}

export async function signedVoiceUrl(path: string, ttlSeconds = 60 * 10) {
  const { data, error } = await supabase.storage.from('chat-audio').createSignedUrl(path, ttlSeconds)
  if (error) throw error
  return data.signedUrl
}

export async function getMessages(rideId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('ride_id', rideId)
    .order('created_at', { ascending: true })
  
  if (error) throw error
  return (data || []) as ChatMessage[]
}

export function subscribeToMessages(
  rideId: string,
  onMessage: (msg: ChatMessage) => void,
  onTyping: () => void
) {
  const channel = supabase
    .channel(`chat:${rideId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `ride_id=eq.${rideId}` },
      (payload) => {
        onMessage(payload.new as ChatMessage)
      }
    )
    .on('broadcast', { event: 'typing' }, () => {
      onTyping()
    })
    .subscribe()

  return channel
}

export function broadcastTyping(channel: ReturnType<typeof supabase.channel>) {
  channel.send({ type: 'broadcast', event: 'typing' })
}
