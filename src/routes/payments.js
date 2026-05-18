const express = require('express');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { auth } = require('../middleware/auth');
const { isStripeConfigured } = require('../lib/stripeClient');

const router = express.Router();

// Frontend provider id → DB method value (supabase_schema check constraint)
const METHOD_MAP = {
  stripe: 'stripe',
  orange: 'orange_money',
  mtn: 'mtn',
  wave: 'wave',
};

const allowMockStripe =
  process.env.ALLOW_MOCK_PAYMENTS === 'true' ||
  (process.env.NODE_ENV !== 'production' && !isStripeConfigured());

async function enrichPaymentsWithSessions(payments) {
  if (!payments?.length) return payments;

  const sessionIds = [...new Set(payments.map((p) => p.session_id).filter(Boolean))];
  if (!sessionIds.length) return payments;

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, subject, scheduled_at')
    .in('id', sessionIds);

  const byId = Object.fromEntries((sessions || []).map((s) => [s.id, s]));
  return payments.map((p) => ({
    ...p,
    sessions: byId[p.session_id] || null,
  }));
}

function supabaseErrorMessage(err) {
  if (!err) return 'Payment failed';
  return err.message || err.details || err.hint || 'Payment failed';
}

// POST /api/payments — mobile money / manual escrow (not Stripe Checkout)
router.post('/', auth, async (req, res) => {
  try {
    const { session_id, amount, method: rawMethod } = req.body;
    if (!session_id || amount == null || !rawMethod) {
      return res.status(400).json({ error: 'session_id, amount and method required' });
    }

    const method = METHOD_MAP[rawMethod];
    if (!method) {
      return res.status(400).json({
        error: `Unknown payment method: ${rawMethod}`,
        valid_methods: Object.keys(METHOD_MAP),
      });
    }

    if (method === 'stripe') {
      if (isStripeConfigured()) {
        return res.status(400).json({
          error: 'Card payments use Stripe Checkout. Please try again with Card / Stripe selected.',
          code: 'USE_STRIPE_CHECKOUT',
        });
      }
      if (!allowMockStripe) {
        return res.status(503).json({
          error: 'Card payments are not configured. Please contact the administrator.',
          code: 'STRIPE_NOT_CONFIGURED',
        });
      }
    }

    const parsedAmount = parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', session_id)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (session.student_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the student can pay for this session' });
    }
    if (session.status !== 'confirmed') {
      return res.status(400).json({ error: 'Session must be confirmed before payment' });
    }

    const { data: existingHeld } = await supabase
      .from('payments')
      .select('id')
      .eq('session_id', session_id)
      .eq('status', 'held')
      .limit(1);

    if (existingHeld?.length) {
      return res.status(409).json({
        error: 'A payment is already held for this session',
      });
    }

    const reference = `GND-${uuidv4().split('-')[0].toUpperCase()}`;

    const { data, error } = await supabase
      .from('payments')
      .insert({
        session_id,
        payer_id: req.user.id,
        tutor_id: session.tutor_id,
        amount: parsedAmount,
        method,
        status: 'held',
        reference,
      })
      .select()
      .single();

    if (error) {
      console.error('Payment insert error:', error);
      return res.status(400).json({ error: supabaseErrorMessage(error) });
    }

    await supabase.from('notifications').insert({
      user_id: session.tutor_id,
      type: 'payment_held',
      title: 'Payment Received',
      body: `Payment of £${parsedAmount} is held. Complete the session to receive it.`,
      data: { payment_id: data.id, session_id },
    });

    const message =
      method === 'stripe' && allowMockStripe
        ? 'Test payment recorded (Stripe not configured). Funds are held in escrow.'
        : 'Payment held securely. Will be released to tutor after session completion.';

    res.status(201).json({ payment: data, message });
  } catch (err) {
    console.error('Payment error:', err);
    res.status(500).json({ error: supabaseErrorMessage(err) });
  }
});

// GET /api/payments — get my payments
router.get('/', auth, async (req, res) => {
  try {
    const field = req.user.role === 'tutor' ? 'tutor_id' : 'payer_id';
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq(field, req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const payments = await enrichPaymentsWithSessions(data);
    res.json({ payments });
  } catch (err) {
    console.error('Fetch payments error:', err);
    res.status(500).json({ error: supabaseErrorMessage(err) });
  }
});

// PUT /api/payments/:id/release — admin or student confirms release
router.put('/:id/release', auth, async (req, res) => {
  try {
    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('id', req.params.id)
      .single();
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
      data: { payment_id: data.id },
    });

    res.json({ payment: data });
  } catch (err) {
    console.error('Release payment error:', err);
    res.status(500).json({ error: supabaseErrorMessage(err) });
  }
});

module.exports = router;
