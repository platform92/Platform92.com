const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const DELIVERY_FEE = 49;
const FREE_DELIVERY_THRESHOLD = 300;

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const { items, customer, orderType, notes } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Empty cart' }) };
    }

    const line_items = items.map(item => ({
      price_data: {
        currency: 'sek',
        product_data: { name: String(item.name).slice(0, 250) },
        unit_amount: Math.round(Number(item.price) * 100)
      },
      quantity: parseInt(item.quantity, 10)
    }));

    // Delivery fee (same rule as the website): added here so Stripe charges the full amount
    const subtotal = items.reduce((s, i) => s + Number(i.price) * parseInt(i.quantity, 10), 0);
    if (orderType === 'delivery' && subtotal > 0 && subtotal < FREE_DELIVERY_THRESHOLD) {
      line_items.push({
        price_data: {
          currency: 'sek',
          product_data: { name: 'Leveransavgift' },
          unit_amount: DELIVERY_FEE * 100
        },
        quantity: 1
      });
    }

    const origin = event.headers.origin || event.headers.Origin || process.env.URL;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      success_url: `${origin}/tack.html`,
      cancel_url: `${origin}/`,
      metadata: {
        customer_name: String(customer.name || '').slice(0, 450),
        customer_phone: String(customer.phone || '').slice(0, 450),
        customer_address: String(customer.address || '').slice(0, 450),
        customer_postcode: String(customer.postcode || '').slice(0, 450),
        order_type: String(orderType || 'delivery'),
        notes: String(notes || '').slice(0, 450)
      }
    });

    return { statusCode: 200, body: JSON.stringify({ url: session.url }) };
  } catch (err) {
    console.error('create-checkout error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
