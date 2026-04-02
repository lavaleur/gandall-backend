const express = require('express');
const supabase = require('../config/supabase');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/sessions — get my sessions
router.get('/', auth, async (req, res) => {
  try {
    const isStudent = req.user.role === 'student';
    const field = isStudent ? 'student_id' : 'tutor_id';

    const { data, error } = await supabase
      .from('sessions')
      .select(`
        *,
        student:users!student_id(id, full_name, avatar_url),
        tutor:users!tutor_id(id, full_name, avatar_url)
      `)
      .eq(field, req.user.id)
      .order('scheduled_at', { ascending: true });

    if (error) throw error;
    res.json({ sessions: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// POST /api/sessions — book a session
router.post('/', auth, async (req, res) => {
  try {
    const { tutor_id, subject, scheduled_at, duration_minutes, notes } = req.body;
    if (!tutor_id || !subject || !scheduled_at) {
      return res.status(400).json({ error: 'tutor_id, subject and scheduled_at are required' });
    }

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        student_id: req.user.id,
        tutor_id,
        subject,
        scheduled_at,
        duration_minutes: duration_minutes || 60,
        notes,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    // Notify tutor
    await supabase.from('notifications').insert({
      user_id: tutor_id,
      type: 'booking_request',
      title: 'New Booking Request',
      body: `A student wants to book a ${subject} session`,
      data: { session_id: data.id }
    });

    res.status(201).json({ session: data });
  } catch (err) {
    console.error('Booking error:', err);
    res.status(500).json({ error: 'Booking failed' });
  }
});

// PUT /api/sessions/:id/status — confirm/cancel/complete
router.put('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['confirmed', 'cancelled', 'completed', 'in_progress'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const { data: session } = await supabase
      .from('sessions').select('*').eq('id', req.params.id).single();

    if (!session) return res.status(404).json({ error: 'Session not found' });

    const isParticipant = session.student_id === req.user.id || session.tutor_id === req.user.id;
    if (!isParticipant) return res.status(403).json({ error: 'Not your session' });

    const { data, error } = await supabase
      .from('sessions')
      .update({ status })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    // If completed — release payment
    if (status === 'completed') {
      await supabase
        .from('payments')
        .update({ status: 'released', released_at: new Date().toISOString() })
        .eq('session_id', req.params.id)
        .eq('status', 'held');
    }

    res.json({ session: data });
  } catch (err) {
    res.status(500).json({ error: 'Status update failed' });
  }
});

// GET /api/sessions/:id — single session
router.get('/:id', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select(`
        *,
        student:users!student_id(id, full_name, avatar_url),
        tutor:users!tutor_id(id, full_name, avatar_url)
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Session not found' });
    const isParticipant = data.student_id === req.user.id || data.tutor_id === req.user.id;
    if (!isParticipant) return res.status(403).json({ error: 'Access denied' });
    res.json({ session: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

module.exports = router;
