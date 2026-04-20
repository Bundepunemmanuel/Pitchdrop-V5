// api/create-payment.js — PitchDrop V5
// Creates a NOWPayments hosted invoice — opens their payment page like the screenshot

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { userId, plan } = req.body;
    if (!userId || !plan) return res.status(400).json({ error: 'userId and plan required' });

    // Updated prices — minimum $10 for NOWPayments
    const PRICES = { starter: 10, pro: 20, lifetime: 99 };
    const price = PRICES[plan];
    if (!price) return res.status(400).json({ error: 'Invalid plan. Use: starter, pro, or lifetime' });

    const orderId = `${userId}_${plan}_${Date.now()}`;
    const siteUrl = process.env.SITE_URL || `https://${req.headers.host}`;

    // Use NOWPayments INVOICE API — creates hosted payment page like the screenshot
    const invoiceRes = await fetch('https://api.nowpayments.io/v1/invoice', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.NOWPAYMENTS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        price_amount: price,
        price_currency: 'usd',
        pay_currency: 'usdttrc20',
        order_id: orderId,
        order_description: `PitchDrop ${plan} plan — ${price} USD`,
        ipn_callback_url: `${siteUrl}/api/ipn`,
        success_url: `${siteUrl}/pricing.html?status=success&plan=${plan}`,
        cancel_url: `${siteUrl}/pricing.html`,
        is_fixed_rate: false,
        is_fee_paid_by_user: false
      })
    });

    const invoiceText = await invoiceRes.text();
    let invoiceData;
    try { invoiceData = JSON.parse(invoiceText); }
    catch (_) { throw new Error('Invalid response from NOWPayments'); }

    if (!invoiceRes.ok) {
      console.error('NOWPayments invoice error:', invoiceData);
      throw new Error(invoiceData.message || invoiceData.error || `NOWPayments error (${invoiceRes.status})`);
    }

    if (!invoiceData.invoice_url) {
      throw new Error('No invoice URL returned from NOWPayments');
    }

    return res.status(200).json({
      success: true,
      invoiceUrl: invoiceData.invoice_url,
      invoiceId: invoiceData.id,
      orderId
    });

  } catch (err) {
    console.error('create-payment error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

