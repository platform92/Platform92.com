const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  const sig = event.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
  } catch (err) {
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const m = session.metadata || {};

    const itemsText = await (async () => {
      const lines = await stripe.checkout.sessions.listLineItems(session.id);
      return lines.data.map(l => `${l.quantity}x ${l.description} — ${(l.amount_total/100)} kr`).join(' | ');
    })();

    const payload = {
      "1_ATT_GORA": "Betalning mottagen och bekräftad via Stripe. Ordern kan tillagas.",
      order_number: session.id,
      order_type: m.order_type || 'delivery',
      address: m.order_type === 'pickup'
        ? "Avhämtning — Stationsgatan 6A"
        : (m.customer_address || '') + ' (' + (m.customer_postcode || '') + ')',
      name: m.customer_name || '',
      phone: m.customer_phone || '',
      payment_method: 'stripe',
      payment_status: session.payment_status,
      items: itemsText,
      total: (session.amount_total / 100) + ' kr',
      notes: m.notes || '-'
    };

    try {
      await fetch('https://formspree.io/f/xjybbglr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e) { /* ignore */ }
  }

  return { statusCode: 200, body: 'ok' };
};
