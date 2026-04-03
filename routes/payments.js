const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');

let stripe;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

const MOBILE_MONEY_PROVIDERS = {
  orange_money: { name: 'Orange Money', currency: 'GNF' },
  mtn_momo:     { name: 'MTN MoMo',     currency: 'GNF' },
  wave:         { name: 'Wave',          currency: 'XOF' },
};

router.post('/stripe/intent', requireAuth, async (req, res) => {
  try {
    if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });
    const { amount, currency = 'eur', purpose = 'session', metadata = {} } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount is required' });
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: currency.toLowerCase(),
      metadata: { user_id: req.user.id, purpose, ...metadata },
    });
    const { data: payment } = await supabase.from('payments').insert({
      user_id: req.user.id, provider: 'stripe', provider_reference: paymentIntent.id,
      amount, currency: currency.toUpperCase(), status: 'pending', purpose,
      metadata: { stripe_client_secret: paymentIntent.client_secret },
    }).select().single();
    res.json({ client_secret: paymentIntent.client_secret, payment_intent_id: paymentIntent.id, payment_id: payment?.id });
  } catch (err) {
    console.error('Stripe intent error:', err);
    res.status(500).json({ error: err.message || 'Payment intent creation failed' });
  }
});

router.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });
    const sig = req.headers['stripe-signature'];
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      return res.status(400).json({ error: `Webhook signature failed: ${err.message}` });
    }
    if (event.type === 'payment_intent.succeeded') {
      await supabase.from('payments').update({ status: 'completed' }).eq('provider_reference', event.data.object.id);
    } else if (event.type === 'payment_intent.payment_failed') {
      await supabase.from('payments').update({ status: 'failed' }).eq('provider_reference', event.data.object.id);
    }
    res.json({ received: true });
  } catch (err) {
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

router.post('/mobile-money/initiate', requireAuth, async (req, res) => {
  try {
    const { provider, phone_number, amount, currency, purpose = 'session' } = req.body;
    if (!provider || !MOBILE_MONEY_PROVIDERS[provider]) {
      return res.status(400).json({ error: 'Invalid provider', valid_providers: Object.keys(MOBILE_MONEY_PROVIDERS) });
    }
    if (!phone_number || !amount) return res.status(400).json({ error: 'phone_number and amount are required' });
    const providerConfig = MOBILE_MONEY_PROVIDERS[provider];
    const txCurrency = currency || providerConfig.currency;
    const internalRef = `GANDALL-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const { data: payment } = await supabase.from('payments').insert({
      user_id: req.user.id, provider, provider_reference: internalRef,
      amount, currency: txCurrency, status: 'processing', purpose,
      metadata: { phone_number, internal_ref: internalRef },
    }).select().single();
    res.status(201).json({
      message: `${providerConfig.name} payment initiated. Approve on your phone.`,
      payment_id: payment?.id, reference: internalRef, status: 'processing',
    });
  } catch (err) {
    console.error('Mobile money error:', err);
    res.status(500).json({ error: 'Mobile money payment failed' });
  }
});

router.get('/mobile-money/status/:ref', requireAuth, async (req, res) => {
  try {
    const { data: payment } = await supabase.from('payments').select('*').eq('provider_reference', req.params.ref).eq('user_id', req.user.id).single();
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    res.json({ payment });
  } catch (err) {
    res.status(500).json({ error: 'Status check failed' });
  }
});

router.get('/history', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, provider } = req.query;
    const offset = (page - 1) * limit;
    let query = supabase.from('payments').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    if (status) query = query.eq('status', status);
    if (provider) query = query.eq('provider', provider);
    const { data: payments, error } = await query;
    if (error) return res.status(400).json({ error: error.message });
    res.json({ payments, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payment history' });
  }
});

module.exports = router;
