let stripeInstance = null;

function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function getStripe() {
  if (!isStripeConfigured()) return null;
  if (!stripeInstance) {
    stripeInstance = require('stripe')(process.env.STRIPE_SECRET_KEY);
  }
  return stripeInstance;
}

module.exports = { getStripe, isStripeConfigured };
