const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const { items, customer, orderType, notes } = body;

    const line_items = items.map(item => ({
      price_data: {
        currency: 'sek',
        product_data: { name: item.name },
        unit_amount: item.price * 100
      },
      quantity: item.quantity
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      success_url: `${event.headers.origin}/tack.html`,
      cancel_url: `${event.headers.origin}/`,
      metadata: {
        customer_name: customer.name,
        customer_phone: customer.phone,
        customer_address: customer.address || '',
        customer_postcode: customer.postcode || '',
        order_type: orderType,
        notes: notes || ''
      }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
