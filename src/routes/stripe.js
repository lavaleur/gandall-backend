const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const supabase = require('../config/supabase');
const { auth } = require('../middleware/auth');
const router = express.Router();

// POST /api/stripe/create-checkout — create Stripe checkout session
router.post('/create-checkout', auth, async (req, res) => {
  try {
    const { session_id, amount, tutor_name, subject } = req.body;

    if (!session_id || !amount) {
      return res.status(400).json({ error: 'session_id and amount are required' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'gbp',
          product_data: {
            name: `${subject || 'Tutoring'} Session`,
            description: `With ${tutor_name || 'your tutor'} via Gandall`,
          },
          unit_amount: Math.round(parseFloat(amount) * 100), // pence
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/payments?success=true&session_id=${session_id}`,
      cancel_url: `${process.env.FRONTEND_URL}/payments?cancelled=true`,
      metadata: {
        gandall_session_id: session_id,
        payer_id: req.user.id,
      },
    });

    res.json({ url: session.url, stripe_session_id: session.id });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// POST /api/stripe/webhook — Stripe calls this after payment
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  if (event.type === 'checkout.session.completed') {
    const stripeSession = event.data.object;
    const { gandall_session_id, payer_id } = stripeSession.metadata;

    try {
      // Get session details
      const { data: gandallSession } = await supabase
        .from('sessions')
        .select('tutor_id, subject')
        .eq('id', gandall_session_id)
        .single();

      if (gandallSession) {
        const { v4: uuidv4 } = require('uuid');
        const reference = `GND-${uuidv4().split('-')[0].toUpperCase()}`;

        await supabase.from('payments').insert({
          session_id: gandall_session_id,
          payer_id,
          tutor_id: gandallSession.tutor_id,
          amount: stripeSession.amount_total / 100,
          method: 'stripe',
          status: 'held',
          reference,
        });

        // Notify tutor
        await supabase.from('notifications').insert({
          user_id: gandallSession.tutor_id,
          type: 'payment_held',
          title: 'Payment Received',
          body: `Payment of £${stripeSession.amount_total / 100} is held. Complete the session to receive it.`,
          data: { session_id: gandall_session_id },
        });
      }
    } catch (err) {
      console.error('Webhook processing error:', err);
    }
  }

  res.json({ received: true });
});

module.exports = router;
