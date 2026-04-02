const express = require('express');
const supabase = require('../config/supabase');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/messages/conversations — get all my conversations
router.get('/conversations', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:users!sender_id(id, full_name, avatar_url, role),
        receiver:users!receiver_id(id, full_name, avatar_url, role)
      `)
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Group into conversations
    const conversations = {};
    for (const msg of data) {
      const otherId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
      const otherUser = msg.sender_id === userId ? msg.receiver : msg.sender;
      if (!conversations[otherId]) {
        conversations[otherId] = {
          other_user: otherUser,
          last_message: msg,
          unread: 0
        };
      }
      if (!msg.is_read && msg.receiver_id === userId) {
        conversations[otherId].unread++;
      }
    }

    res.json({ conversations: Object.values(conversations) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// GET /api/messages/:userId — get thread with a user
router.get('/:userId', auth, async (req, res) => {
  try {
    const me = req.user.id;
    const other = req.params.userId;

    const { data, error } = await supabase
      .from('messages')
      .select(`*, sender:users!sender_id(id, full_name, avatar_url)`)
      .or(`and(sender_id.eq.${me},receiver_id.eq.${other}),and(sender_id.eq.${other},receiver_id.eq.${me})`)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Mark as read
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('receiver_id', me)
      .eq('sender_id', other)
      .eq('is_read', false);

    res.json({ messages: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST /api/messages — send a message
router.post('/', auth, async (req, res) => {
  try {
    const { receiver_id, content, session_id } = req.body;
    if (!receiver_id || !content?.trim()) {
      return res.status(400).json({ error: 'receiver_id and content required' });
    }

    // Contact hiding — never expose raw contact info in content
    const sanitized = content
      .replace(/(\+?\d[\d\s\-().]{7,}\d)/g, '[contact hidden]')
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email hidden]');

    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_id: req.user.id,
        receiver_id,
        content: sanitized,
        session_id: session_id || null
      })
      .select(`*, sender:users!sender_id(id, full_name, avatar_url)`)
      .single();

    if (error) throw error;

    // Notify receiver
    await supabase.from('notifications').insert({
      user_id: receiver_id,
      type: 'new_message',
      title: 'New Message',
      body: `${req.user.email} sent you a message`,
      data: { sender_id: req.user.id }
    });

    res.status(201).json({ message: data });
  } catch (err) {
    console.error('Message error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

module.exports = router;
