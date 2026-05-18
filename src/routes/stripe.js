const express = require('express');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { auth } = require('../middleware/auth');
const { getStripe, isStripeConfigured } = require('../lib/stripeClient');

const router = express.Router();

const paymentsNotConfigured = (res) =>
  res.status(503).json({
    error: 'Card payments are not configured. Please contact the administrator.',
    code: 'STRIPE_NOT_CONFIGURED',
  });

// POST /api/stripe/create-checkout — create Stripe checkout session
router.post('/create-checkout', auth, async (req, res) => {
  try {
    if (!isStripeConfigured()) return paymentsNotConfigured(res);

    const stripe = getStripe();
    const { session_id, amount, tutor_name, subject } = req.body;

    if (!session_id || !amount) {
      return res.status(400).json({ error: 'session_id and amount are required' });
    }

    const parsedAmount = parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    const { data: gandallSession } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', session_id)
      .single();

    if (!gandallSession) return res.status(404).json({ error: 'Session not found' });
    if (gandallSession.student_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the student can pay for this session' });
    }
    if (gandallSession.status !== 'confirmed') {
      return res.status(400).json({ error: 'Session must be confirmed before payment' });
    }

    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'gbp',
          product_data: {
            name: `${subject || gandallSession.subject || 'Tutoring'} Session`,
            description: `With ${tutor_name || 'your tutor'} via Gandall`,
          },
          unit_amount: Math.round(parsedAmount * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${frontendUrl}/payments?success=true&session_id=${session_id}`,
      cancel_url: `${frontendUrl}/payments?cancelled=true`,
      metadata: {
        gandall_session_id: session_id,
        payer_id: req.user.id,
      },
    });

    res.json({ url: session.url, stripe_session_id: session.id });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    res.status(500).json({
      error: err.message || 'Failed to create checkout session',
    });
  }
});

// Webhook handler — mount in index.js BEFORE express.json()
async function stripeWebhookHandler(req, res) {
  if (!isStripeConfigured()) {
    return res.status(503).json({ error: 'Stripe not configured' });
  }

  const stripe = getStripe();
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  if (event.type === 'checkout.session.completed') {
    const stripeSession = event.data.object;
    const { gandall_session_id, payer_id } = stripeSession.metadata || {};

    try {
      const { data: gandallSession } = await supabase
        .from('sessions')
        .select('tutor_id, subject')
        .eq('id', gandall_session_id)
        .single();

      if (gandallSession) {
        const reference = `GND-${uuidv4().split('-')[0].toUpperCase()}`;

        const { error: insertError } = await supabase.from('payments').insert({
          session_id: gandall_session_id,
          payer_id,
          tutor_id: gandallSession.tutor_id,
          amount: stripeSession.amount_total / 100,
          method: 'stripe',
          status: 'held',
          reference,
        });

        if (insertError) {
          console.error('Webhook payment insert error:', insertError);
        } else {
          await supabase.from('notifications').insert({
            user_id: gandallSession.tutor_id,
            type: 'payment_held',
            title: 'Payment Received',
            body: `Payment of £${stripeSession.amount_total / 100} is held. Complete the session to receive it.`,
            data: { session_id: gandall_session_id },
          });
        }
      }
    } catch (err) {
      console.error('Webhook processing error:', err);
    }
  }

  res.json({ received: true });
}

module.exports = router;
module.exports.stripeWebhookHandler = stripeWebhookHandler;
