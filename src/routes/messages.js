const express = require('express');
const supabase = require('../config/supabase');
const { auth } = require('../middleware/auth');

const router = express.Router();
const { filterMessage } = require('../lib/safeguardingFilter');

// GET /api/messages/conversations — get all my conversations
router.get('/conversations', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // ── SAFEGUARDING FILTER ──
    const filterResult = await filterMessage(sanitized, req.user.id, receiver_id, session_id);
    if (!filterResult.allowed) {
      return res.status(400).json({ error: filterResult.reason || 'Message not allowed.', blocked: true });
    }

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
