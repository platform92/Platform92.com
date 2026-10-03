const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const FORMSPREE_URL = 'https://formspree.io/f/xjybbglr';

exports.handler = async (event) => {
  const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // Stripe needs the exact raw body
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const m = session.metadata || {};

    try {
      const lines = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
      const itemsText = lines.data
        .map(l => `${l.quantity}x ${l.description} — ${l.amount_total / 100} kr`)
        .join(' | ');

      const payload = {
        "1_ATT_GORA": "Betalning mottagen och bekräftad via Stripe. Ordern kan tillagas.",
        order_number: session.id.slice(-8).toUpperCase(),
        order_type: m.order_type || 'delivery',
        address: m.order_type === 'pickup'
          ? "Avhämtning — Stationsgatan 6A"
          : (m.customer_address || '') + ' (' + (m.customer_postcode || '') + ')',
        name: m.customer_name || '',
        phone: m.customer_phone || '',
        payment_method: 'stripe (kort)',
        payment_status: session.payment_status,
        items: itemsText,
        total: (session.amount_total / 100) + ' kr',
        notes: m.notes || '-'
      };

      const res = await fetch(FORMSPREE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': process.env.URL || '',
          'Referer': (process.env.URL || '') + '/'
        },
        body: JSON.stringify(payload)
      });

      const text = await res.text();
      console.log('Formspree status:', res.status, text);

      if (!res.ok) {
        // Non-200 makes Stripe retry the webhook automatically
        return { statusCode: 500, body: 'Formspree failed: ' + text };
      }
    } catch (e) {
      console.error('Order email failed:', e);
      return { statusCode: 500, body: 'Order email failed' };
    }
  }

  return { statusCode: 200, body: 'ok' };
};
