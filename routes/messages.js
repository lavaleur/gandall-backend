const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');

router.post('/conversations', requireAuth, async (req, res) => {
  try {
    const { other_user_id } = req.body;
    const me = req.user.id;
    if (!other_user_id) return res.status(400).json({ error: 'other_user_id is required' });
    if (other_user_id === me) return res.status(400).json({ error: 'Cannot message yourself' });
    const { data: otherProfile } = await supabase.from('profiles').select('id, full_name, avatar_url, role').eq('id', other_user_id).single();
    if (!otherProfile) return res.status(404).json({ error: 'User not found' });
    const [p1, p2] = [me, other_user_id].sort();
    const { data: existing } = await supabase.from('conversations').select('*').eq('participant_one', p1).eq('participant_two', p2).single();
    if (existing) return res.json({ conversation: existing, other_user: otherProfile });
    const { data: newConv, error } = await supabase.from('conversations').insert({ participant_one: p1, participant_two: p2 }).select().single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ conversation: newConv, other_user: otherProfile });
  } catch (err) {
    console.error('Create conversation error:', err);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

router.get('/conversations', requireAuth, async (req, res) => {
  try {
    const me = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const { data: conversations, error } = await supabase.from('conversations').select('*').or(`participant_one.eq.${me},participant_two.eq.${me}`).order('last_message_at', { ascending: false, nullsFirst: false }).range(offset, offset + limit - 1);
    if (error) return res.status(400).json({ error: error.message });
    const enriched = await Promise.all(conversations.map(async (conv) => {
      const otherId = conv.participant_one === me ? conv.participant_two : conv.participant_one;
      const { data: other } = await supabase.from('profiles').select('id, full_name, avatar_url, role').eq('id', otherId).single();
      const { count: unread } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('conversation_id', conv.id).eq('is_read', false).neq('sender_id', me);
      return { ...conv, other_participant: other, unread_count: unread || 0 };
    }));
    res.json({ conversations: enriched, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('List conversations error:', err);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

router.get('/conversations/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const me = req.user.id;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    const { data: conv } = await supabase.from('conversations').select('*').eq('id', id).or(`participant_one.eq.${me},participant_two.eq.${me}`).single();
    if (!conv) return res.status(403).json({ error: 'Conversation not found or access denied' });
    const { data: messages, error } = await supabase.from('messages').select('id, content, message_type, media_url, is_read, created_at, sender:sender_id (id, full_name, avatar_url)').eq('conversation_id', id).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    if (error) return res.status(400).json({ error: error.message });
    await supabase.from('messages').update({ is_read: true }).eq('conversation_id', id).neq('sender_id', me).eq('is_read', false);
    res.json({ conversation: conv, messages: messages.reverse(), page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

router.post('/conversations/:id/send', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const me = req.user.id;
    const { content, message_type = 'text', media_url } = req.body;
    if (!content && !media_url) return res.status(400).json({ error: 'content or media_url is required' });
    const { data: conv } = await supabase.from('conversations').select('*').eq('id', id).or(`participant_one.eq.${me},participant_two.eq.${me}`).single();
    if (!conv) return res.status(403).json({ error: 'Conversation not found or access denied' });
    const { data: message, error } = await supabase.from('messages').insert({ conversation_id: id, sender_id: me, content: content || '', message_type, media_url }).select('id, content, message_type, media_url, is_read, created_at, sender:sender_id (id, full_name, avatar_url)').single();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ message });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.put('/:messageId/read', requireAuth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const me = req.user.id;
    const { error } = await supabase.from('messages').update({ is_read: true }).eq('id', messageId).neq('sender_id', me);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    const me = req.user.id;
    const { data: convs } = await supabase.from('conversations').select('id').or(`participant_one.eq.${me},participant_two.eq.${me}`);
    if (!convs?.length) return res.json({ unread_count: 0 });
    const convIds = convs.map((c) => c.id);
    const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true }).in('conversation_id', convIds).eq('is_read', false).neq('sender_id', me);
    res.json({ unread_count: count || 0 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

module.exports = router;
