const express = require('express');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { auth } = require('../middleware/auth');

const router = express.Router();

// POST /api/payments — initiate payment (held in escrow)
router.post('/', auth, async (req, res) => {
  try {
    const { session_id, amount, method } = req.body;
    if (!session_id || !amount || !method) {
      return res.status(400).json({ error: 'session_id, amount and method required' });
    }

    // Verify session exists and user is the student
    const { data: session } = await supabase
      .from('sessions').select('*').eq('id', session_id).single();
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.student_id !== req.user.id) return res.status(403).json({ error: 'Only the student can pay' });

    const reference = `GND-${uuidv4().split('-')[0].toUpperCase()}`;

    // Payment held in escrow — not released until session complete
    const { data, error } = await supabase
      .from('payments')
      .insert({
        session_id,
        payer_id: req.user.id,
        tutor_id: session.tutor_id,
        amount,
        method,
        status: 'held',
        reference
      })
      .select()
      .single();

    if (error) throw error;

    // Notify tutor
    await supabase.from('notifications').insert({
      user_id: session.tutor_id,
      type: 'payment_held',
      title: 'Payment Received',
      body: `Payment of £${amount} is held. Complete the session to receive it.`,
      data: { payment_id: data.id, session_id }
    });

    res.status(201).json({
      payment: data,
      message: 'Payment held securely. Will be released to tutor after session completion.'
    });
  } catch (err) {
    console.error('Payment error:', err);
    res.status(500).json({ error: 'Payment failed' });
  }
});

// GET /api/payments — get my payments
router.get('/', auth, async (req, res) => {
  try {
    const field = req.user.role === 'tutor' ? 'tutor_id' : 'payer_id';
    const { data, error } = await supabase
      .from('payments')
      .select(`*, sessions(subject, scheduled_at)`)
      .eq(field, req.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ payments: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// PUT /api/payments/:id/release — admin or student confirms release
router.put('/:id/release', auth, async (req, res) => {
  try {
    const { data: payment } = await supabase
      .from('payments').select('*').eq('id', req.params.id).single();
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    const canRelease = req.user.id === payment.payer_id || req.user.role === 'admin';
    if (!canRelease) return res.status(403).json({ error: 'Not authorised to release payment' });

    const { data, error } = await supabase
      .from('payments')
      .update({ status: 'released', released_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    await supabase.from('notifications').insert({
      user_id: payment.tutor_id,
      type: 'payment_released',
      title: 'Payment Released',
      body: `£${payment.amount} has been released to your account.`,
      data: { payment_id: data.id }
    });

    res.json({ payment: data });
  } catch (err) {
    res.status(500).json({ error: 'Release failed' });
  }
});

module.exports = router;
