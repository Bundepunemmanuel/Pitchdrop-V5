// api/generate.js — PitchDrop V4 — 4-Stage AI Pipeline
// Uses export default (ES module) — same as working V2 pattern

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { url, preferences, manualContext } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    const selling = preferences?.selling || 'a B2B service';
    const goal = preferences?.goal || 'book a call';
    const length = preferences?.length || 'Short';
    const role = preferences?.role || 'CEO';

    // ── FETCH WEBSITE ──
    let rawContent = '';
    let fetchedOk = false;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 7000);
      const r = await fetch(`https://r.jina.ai/${url}`, {
        headers: { 'Accept': 'text/plain' },
        signal: ctrl.signal
      });
      clearTimeout(t);
      rawContent = (await r.text()).slice(0, 3500);
      fetchedOk = rawContent.length > 120;
    } catch (_) {}

    const domain = url.replace(/https?:\/\/(www\.)?/, '').split('/')[0];
    const companyGuess = domain.split('.')[0].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    if (!fetchedOk && !manualContext) {
      rawContent = `Company domain: ${domain}. Generate based on domain name only.`;
    }
    if (manualContext) rawContent += `\n\nUSER-PROVIDED CONTEXT:\n${manualContext}`;

    // ── STAGE 1: INTELLIGENCE EXTRACTION ──
    const s1 = `You are a ruthless, extremely precise B2B sales intelligence analyst. Extract ONLY real, specific, verifiable signals from this website. Never guess, never hallucinate, never add generic fluff.

WEBSITE: ${url}
CONTENT:
${rawContent}

Answer exactly these questions. Return null or [] if not clearly stated.

1. Exact company name as written on site
2. One crisp sentence: what does this company do?
3. Any recent change, expansion, launch, funding, or milestone (exact numbers/dates if available)
4. Specific metrics mentioned (fleet size, countries, employees, customers, warehouses, deliveries)
5. CEO or founder name (if mentioned)
6. Direct quote from CEO/founder (exact words only)
7. Customer types or industries they serve
8. Pain points their customers face that they solve
9. Technologies or tools they mention
10. Hiring signals (specific roles they're hiring)
11. Partnerships, alliances, memberships
12. Sustainability or ESG messaging
13. Brand tone from their writing (formal/casual/bold/technical/friendly)
14. Single most interesting unique fact about this company
15. Why NOW is a good time to reach out (expansion, new launch, hiring surge, etc.)

Signal tiers:
TIER1 (highest reply value): recent change + specific number + CEO name
TIER2: hiring signals + pain points + scale metrics
TIER3: tech/tools + partnerships + values

Return ONLY valid JSON starting with {. No markdown, no explanation:
{"companyName":"","whatTheyDo":"","recentChange":null,"specificMetrics":[],"ceoName":null,"ceoQuote":null,"customerTypes":[],"painPoints":[],"technologies":[],"hiringSignals":[],"partnerships":[],"brandTone":"professional","mostInteresting":null,"timingTrigger":null,"signals":{"tier1":[],"tier2":[],"tier3":[]},"lowPersonalization":false}`;

    const s1raw = await groq(s1, 900, 0.2);
    let brief;
    try {
      const c = s1raw.replace(/```json|```/g, '').trim();
      brief = JSON.parse(c.slice(c.indexOf('{'), c.lastIndexOf('}') + 1));
    } catch (_) {
      brief = { companyName: companyGuess, whatTheyDo: `Company at ${url}`, signals: { tier1: [], tier2: [], tier3: [] }, specificMetrics: [], customerTypes: [], painPoints: [], ceoName: null, recentChange: null, timingTrigger: null, brandTone: 'professional', mostInteresting: null, lowPersonalization: true };
    }

    const t1 = brief.signals?.tier1?.length || 0;
    const t2 = brief.signals?.tier2?.length || 0;
    brief.lowPersonalization = (t1 + t2) < 2;

    const allSigs = [...(brief.signals?.tier1 || []), ...(brief.signals?.tier2 || []), ...(brief.signals?.tier3 || [])].filter(Boolean).join(', ') || brief.companyName;
    const nums = (brief.specificMetrics || []).join(', ') || 'none found';

    // ── STAGE 2: SDR REASONING ──
    const s2 = `You are a top 1% B2B SDR with a 22% reply rate. Think before writing.

COMPANY: ${brief.companyName}
DOES: ${brief.whatTheyDo}
SIGNALS: ${allSigs}
NUMBERS: ${nums}
RECENT CHANGE: ${brief.recentChange || 'none'}
CEO: ${brief.ceoName || 'unknown'}
PAIN POINTS: ${(brief.painPoints || []).join(', ') || 'not specified'}
TIMING: ${brief.timingTrigger || 'general outreach'}
INTERESTING: ${brief.mostInteresting || 'none'}
SELLER OFFERS: ${selling}
GOAL: ${goal}
TARGET ROLE: ${role}

Answer before writing:
Q1: ONE strongest hook connecting a real signal to what seller offers (specific, not generic)
Q2: Specific pain this company faces RIGHT NOW
Q3: Why NOW is the right time to reach out
Q4: Professional opening — specific observation, peer-to-peer, data-oriented
Q5: Casual opening — punchy, skips warmup, jumps straight to value
Q6: Bold opening — counterintuitive or provocative statement about their situation

Return ONLY valid JSON starting with {:
{"hook":"","pain":"","timing":"","professionalOpen":"","casualOpen":"","boldOpen":""}`;

    const s2raw = await groq(s2, 500, 0.45);
    let strategy;
    try {
      const c = s2raw.replace(/```json|```/g, '').trim();
      strategy = JSON.parse(c.slice(c.indexOf('{'), c.lastIndexOf('}') + 1));
    } catch (_) {
      strategy = { hook: `${brief.companyName}'s growth`, pain: 'scaling challenges', timing: brief.timingTrigger || 'now', professionalOpen: `${brief.companyName} caught my attention`, casualOpen: `Quick thought on ${brief.companyName}`, boldOpen: `Most companies in your space are leaving something on the table` };
    }

    // ── STAGE 3: EMAIL WRITING ──
    const lenGuide = length === 'Short'
      ? '55-85 words. 3 paragraphs: (1) specific hook, (2) your value in their context, (3) one soft ask.'
      : length === 'Medium'
      ? '90-130 words. 4 paragraphs: opening, pain, solution, ask.'
      : '140-180 words. 5 paragraphs with depth.';

    const s3 = `You are Alex Chen, a top B2B salesperson with 18-25% cold email reply rates in 2026. You write like a sharp busy professional — never like AI.

COMPANY: ${brief.companyName} — ${brief.whatTheyDo}
SIGNALS: ${allSigs}
NUMBERS: ${nums}
CEO: ${brief.ceoName || 'unknown'}
RECENT: ${brief.recentChange || 'none'}
SELLING: ${selling} | GOAL: ${goal} | ROLE: ${role}
HOOK: ${strategy.hook}
PAIN: ${strategy.pain}
TIMING: ${strategy.timing}

LENGTH: ${lenGuide}

STRICT RULES — break any = failed email:
- First sentence MUST reference 1-2 SPECIFIC real signals from above
- NEVER start the email with "I"
- FORBIDDEN WORDS: "hope this finds you", "wanted to reach out", "came across", "touch base", "circle back", "synergy", "leverage", "game-changer", "cutting-edge", "innovative", "seamless", "I'd love to", "value proposition", "streamline", "robust", "scalable"
- Use contractions: you're, we've, it's, that's, didn't
- Mix short (5-10 word) and medium (12-18 word) sentences
- End with ONE soft curious question — never a pushy statement
- Sign off: Alex

GOOD EXAMPLES to match quality:

EXAMPLE 1 (Professional):
John,

Expanding to 50 countries while managing 1,000 trucks is either running perfectly or creating visibility gaps your team patches manually every day.

We've helped 3 carriers at your scale cut cross-border exceptions by 30% in 3 weeks.

Worth 20 minutes to see if the numbers make sense for Hastenway?

Alex

EXAMPLE 2 (Casual):
Your pricing page has three tiers but no FAQ — which usually means your sales team answers the same five questions every demo.

We cut that back-and-forth by 40% for SaaS companies your size.

Mind if I show you how?

Alex

EXAMPLE 3 (Bold):
Most e-commerce companies at 500K monthly orders still treat returns as a cost center. The ones growing fastest don't.

Curious if that's something you've been rethinking at ${brief.companyName}.

Alex

Write 3 GENUINELY DIFFERENT variants. Different structure + different angle + different opening — not just tone words.

VARIANT 1 PROFESSIONAL — start with EXACTLY: "${strategy.professionalOpen}"
Structure: observation → implication → value → ask

VARIANT 2 CASUAL — start with EXACTLY: "${strategy.casualOpen}"
Structure: jump to problem → fix → quick ask

VARIANT 3 BOLD — start with EXACTLY: "${strategy.boldOpen}"
Structure: counterintuitive opener → connect to their situation → ask

Return ONLY valid JSON starting with {:
{"variants":[{"type":"Professional","body":"email with \\n for line breaks"},{"type":"Casual","body":"email with \\n for line breaks"},{"type":"Bold","body":"email with \\n for line breaks"}]}`;

    const s3raw = await groq(s3, 1200, 0.82);
    let emailData;
    try {
      const c = s3raw.replace(/```json|```/g, '').trim();
      emailData = JSON.parse(c.slice(c.indexOf('{'), c.lastIndexOf('}') + 1));
    } catch (_) {
      throw new Error('Email generation failed to parse. Please try again.');
    }
    if (!emailData?.variants || emailData.variants.length < 3) throw new Error('Incomplete generation. Please try again.');

    // ── STAGE 4A: SUBJECT LINES ──
    const s4 = `Write 3 subject lines for each of these 3 cold emails targeting ${brief.companyName}.

EMAIL 1 (Professional): ${emailData.variants[0].body.slice(0, 160)}
EMAIL 2 (Casual): ${emailData.variants[1].body.slice(0, 160)}
EMAIL 3 (Bold): ${emailData.variants[2].body.slice(0, 160)}

SIGNALS: ${allSigs}
CEO: ${brief.ceoName || 'unknown'}

RULES per subject:
- Under 7 words
- Reference something SPECIFIC to ${brief.companyName} (name, metric, recent event)
- Create genuine curiosity — not clickbait
- FORBIDDEN: "Quick question", "Following up", "Checking in", "Growth opportunity", "Partnership", "Introduction"

Return ONLY valid JSON starting with {:
{"subjects":[["p1","p2","p3"],["c1","c2","c3"],["b1","b2","b3"]]}`;

    const s4raw = await groq(s4, 300, 0.70);
    let subjectData;
    try {
      const c = s4raw.replace(/```json|```/g, '').trim();
      subjectData = JSON.parse(c.slice(c.indexOf('{'), c.lastIndexOf('}') + 1));
    } catch (_) {
      subjectData = { subjects: [[`${brief.companyName}'s growth`, `Noticed ${domain}`, `${role} at ${brief.companyName}`], [`${domain} — one thought`, `${brief.companyName} caught my eye`, `Quick thought for ${role}`], [`Most companies get this wrong`, `${brief.companyName} is different`, `Counterintuitive take`]] };
    }

    // ── STAGE 4B: ALGORITHMIC SCORING ──
    const SPAM = ['free','guaranteed','act now','limited time','click here','make money','no obligation','exclusive offer','buy now','winner','amazing deal','100%','risk free'];
    const AI_PHRASES = ['hope this finds you','wanted to reach out','came across your','touch base','circle back','synergy','leverage','game-changer','value proposition','innovative solution'];
    const BAD_SUBS = ['quick question','following up','checking in','growth opportunity','partnership','introduction','collaboration'];

    const scored = emailData.variants.map((v, i) => {
      const bl = v.body.toLowerCase();
      const wc = v.body.split(/\s+/).filter(Boolean).length;
      const subs = subjectData.subjects?.[i] || [`Subject ${i+1}A`, `Subject ${i+1}B`, `Subject ${i+1}C`];

      let pers = 3;
      if (t1 > 0) pers += 14;
      if (t2 > 0) pers += 8;
      if ((brief.specificMetrics || []).some(m => v.body.includes(m.split(' ')[0]))) pers += 5;
      if (brief.ceoName && bl.includes(brief.ceoName.toLowerCase())) pers += 5;
      if (brief.lowPersonalization) pers = Math.min(pers, 12);
      pers = Math.min(30, pers);

      const spamF = SPAM.filter(w => bl.includes(w)).length;
      const spamS = Math.max(0, 20 - spamF * 7);
      const aiF = AI_PHRASES.filter(p => bl.includes(p)).length;
      const humanS = Math.max(0, 15 - aiF * 8);

      let lenS = 8;
      const callGoal = goal.toLowerCase().includes('call') || goal.toLowerCase().includes('demo');
      if (callGoal) { lenS = wc >= 50 && wc <= 100 ? 20 : wc >= 40 && wc <= 130 ? 14 : 7; }
      else { lenS = wc >= 30 && wc <= 80 ? 20 : wc <= 110 ? 14 : 8; }

      const subStr = subs.join(' ').toLowerCase();
      let subS = 15;
      if (BAD_SUBS.some(b => subStr.includes(b))) subS -= 9;
      if (subs[0].split(' ').length > 8) subS -= 4;
      if (subs.some(s => s.toLowerCase().includes((brief.companyName || '').toLowerCase().split(' ')[0]))) subS = Math.min(15, subS + 3);
      subS = Math.max(0, subS);

      const total = Math.min(100, pers + spamS + humanS + lenS + subS);
      return {
        type: v.type, body: v.body, subjects: subs, replyScore: total,
        scoreBreakdown: { personalization: pers, spamSafety: spamS, humanPatterns: humanS, lengthVsGoal: lenS, subjectStrength: subS, note: total >= 82 ? 'Strong personalization with specific signals.' : total >= 70 ? 'Good. Could reference more specific details.' : 'More company context would boost this score.' },
        spamSafe: spamF === 0,
        spamIssues: SPAM.filter(w => bl.includes(w)),
        benchmarkNote: total >= 82 ? 'Top 10% — industry avg reply rate is 3.4%' : total >= 70 ? 'Above average — industry avg is 3.4%' : 'Near average — add more signals to boost'
      };
    });

    const displaySigs = [...(brief.signals?.tier1 || []), ...(brief.signals?.tier2 || []).slice(0, 2), ...(brief.specificMetrics || []).slice(0, 2)].filter(Boolean).slice(0, 6);

    return res.status(200).json({
      success: true,
      data: {
        variants: scored,
        extractedSignals: displaySigs,
        companyName: brief.companyName,
        lowPersonalization: brief.lowPersonalization,
        deliverabilityTips: [
          'Send max 30-50 cold emails/day per inbox to avoid spam filters',
          'Add a one-click unsubscribe link — required by Gmail & Yahoo since 2024',
          'Wait 3-5 business days before following up — not 24 hours'
        ]
      }
    });

  } catch (error) {
    console.error('Generate error:', error.message);
    return res.status(500).json({ error: error.message || 'Generation failed. Please try again.' });
  }
}

async function groq(prompt, maxTokens, temp) {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens, temperature: temp })
  });
  if (!r.ok) throw new Error(`Groq error ${r.status}: ${(await r.text()).slice(0, 100)}`);
  const d = await r.json();
  const t = d.choices?.[0]?.message?.content?.trim();
  if (!t) throw new Error('Empty AI response. Please try again.');
  return t;
}

