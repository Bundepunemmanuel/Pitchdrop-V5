// api/ipn.js — PitchDrop V4
import { createClient } from '@supabase/supabase-js';

const PLAN_CREDITS = { starter: 50, pro: 150, lifetime: 999999 };

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  try {
    const payment = req.body;
    console.log('IPN:', payment.payment_status, payment.order_id);

    if (!['confirmed', 'finished'].includes(payment.payment_status)) {
      return res.status(200).json({ message: 'Not confirmed yet' });
    }

    const parts = (payment.order_id || '').split('_');
    if (parts.length < 2) return res.status(400).json({ error: 'Invalid order_id' });

    const userId = parts[0];
    const plan = parts[1];
    const credits = PLAN_CREDITS[plan];
    if (!credits) return res.status(400).json({ error: `Unknown plan: ${plan}` });

    const { data: user, error: ue } = await sb.from('users').select('credits').eq('id', userId).single();
    if (ue || !user) return res.status(404).json({ error: 'User not found' });

    const newCredits = plan === 'lifetime' ? 999999 : (user.credits || 0) + credits;
    await sb.from('users').update({ credits: newCredits, plan }).eq('id', userId);

    try {
      await sb.from('payments').insert({
        user_id: userId,
        payment_id: String(payment.payment_id),
        plan, credits,
        amount: payment.actually_paid || payment.pay_amount,
        currency: payment.pay_currency,
        status: payment.payment_status,
        order_id: payment.order_id
      });
    } catch (_) { /* ignore duplicate payment records */ }

    console.log(`✅ ${credits} credits → user ${userId}`);
    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('IPN error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

