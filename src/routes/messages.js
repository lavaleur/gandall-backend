const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const supabase = require('../config/supabase');
const { filterMessage } = require('../lib/safeguardingFilter');

// GET /api/messages/conversations
router.get('/conversations', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*, sender:profiles!sender_id(id, full_name, avatar_url), receiver:profiles!receiver_id(id, full_name, avatar_url)')
      .or(`sender_id.eq.${req.user.id},receiver_id.eq.${req.user.id}`)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const seen = new Set();
    const conversations = (data || []).filter(m => {
      const key = [m.sender_id, m.receiver_id].sort().join('-');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    res.json({ conversations });
  } catch (err) {
    console.error('Conversations error:', err);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// GET /api/messages/:userId
router.get('/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { data, error } = await supabase
      .from('messages')
      .select('*, sender:profiles!sender_id(id, full_name, avatar_url)')
      .or(`and(sender_id.eq.${req.user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${req.user.id})`)
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json({ messages: data || [] });
  } catch (err) {
    console.error('Messages fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST /api/messages
router.post('/', auth, async (req, res) => {
  try {
    const { receiver_id, content, session_id } = req.body;
    if (!receiver_id || !content?.trim()) {
      return res.status(400).json({ error: 'receiver_id and content required' });
    }

    const sanitized = content
      .replace(/(\+?[\d\s\-()\\.]{7,})/g, '[contact hidden]')
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email hidden]');

    const filterResult = await filterMessage(sanitized);
    if (!filterResult.allowed) {
      return res.status(400).json({ error: filterResult.reason || 'Message not allowed.', blocked: true });
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({ sender_id: req.user.id, receiver_id, content: sanitized, session_id: session_id || null })
      .select('*, sender:profiles!sender_id(id, full_name, avatar_url)')
      .single();
    if (error) throw error;

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
