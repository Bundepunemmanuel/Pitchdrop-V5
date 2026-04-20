// api/followup.js — PitchDrop V4
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { originalEmail, prospectUrl, daysSince, originalSubject, action } = req.body;

    // REWRITE MODE
    if (action === 'rewrite') {
      if (!originalEmail) return res.status(400).json({ error: 'Email required' });
      const prompt = `Rewrite this cold email to sound like a real busy professional wrote it quickly after researching the prospect.

Requirements:
- 55-75 words max
- Use contractions: you're, we've, it's, that's, didn't
- Mix short and medium sentences
- Keep the strongest specific company signals — do not remove what makes it personal
- Remove robotic corporate phrases
- Never start with "I"
- End with one gentle curious question

Original:
${originalEmail}

Return ONLY the rewritten email. No explanation. No subject line. Just the email body.`;

      const rewritten = await groq(prompt, 350, 0.72);
      return res.status(200).json({ success: true, rewritten: rewritten.trim() });
    }

    // FOLLOW-UP MODE
    if (!originalEmail) return res.status(400).json({ error: 'Email required' });
    const days = daysSince || 4;

    const prompt = `You are Alex Chen, Senior AE. You sent this cold email ${days} days ago with no reply:

ORIGINAL EMAIL:
${originalEmail}

${originalSubject ? `ORIGINAL SUBJECT: ${originalSubject}` : ''}
PROSPECT: ${prospectUrl || 'unknown'}

Write 2 follow-up variants. Absolute rules:

FORBIDDEN — instant fail:
"Just following up", "Checking in", "Circling back", "Bumping this up", "Per my last email", "As I mentioned", "Hope you had a chance to", "Wanted to follow up"

REQUIREMENTS:
- Max 2-3 sentences total — shorter than original
- Each adds ONE new angle not in the first email
- Different approach per variant
- Soft confident close
- Use contractions
- Never start with "I"
- Sign off: Alex

VARIANT 1 — NEW VALUE: Add a specific insight or reference not in the first email.
VARIANT 2 — REFRAME: Ask a simpler question that's easier to say yes to.

Return ONLY valid JSON starting with {:
{"followups":[{"subjects":["Re: original","fresh 1","fresh 2"],"body":"followup\\n\\nAlex","angle":"what new value this adds"},{"subjects":["Re: original","fresh 1","fresh 2"],"body":"followup\\n\\nAlex","angle":"what reframe this uses"}]}`;

    const raw = await groq(prompt, 700, 0.72);
    const c = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(c.slice(c.indexOf('{'), c.lastIndexOf('}') + 1));
    return res.status(200).json({ success: true, data: parsed });

  } catch (e) {
    console.error('Followup error:', e.message);
    return res.status(500).json({ error: e.message || 'Request failed. Try again.' });
  }
}

async function groq(prompt, maxTokens, temp) {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens, temperature: temp })
  });
  if (!r.ok) throw new Error(`Groq error ${r.status}`);
  const d = await r.json();
  const t = d.choices?.[0]?.message?.content?.trim();
  if (!t) throw new Error('Empty AI response');
  return t;
}

