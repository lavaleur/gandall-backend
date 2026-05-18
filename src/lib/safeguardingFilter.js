const supabase = require('../config/supabase');

// ── TIER 1: INSTANT BLOCK LIST ──────────────────────────────
const BLOCKED_PHRASES = [
  // Grooming - secrecy
  "don't tell your parents", "dont tell your parents",
  "keep this between us", "our little secret", "keep it secret",
  "don't tell anyone", "dont tell anyone",
  "don't show your mum", "dont show your mum",
  "don't show your dad", "dont show your dad",
  // Grooming - isolation
  "meet me outside", "meet outside class", "come alone",
  "meet in person", "meet up alone", "come by yourself",
  // Grooming - contact moving off-platform
  "whatsapp me", "text me on", "call me on",
  "add me on instagram", "add me on snapchat",
  "message me on telegram", "find me on",
  "my number is", "here's my number", "heres my number",
  // Inappropriate
  "send me a photo", "send me a picture", "send me a video",
  "s manipulation
  "i'll pay you extra", "ill pay you extra",
  "extra money if", "bonus if you",
];

// ── TIER 2: PATTERN FLAGS (reviewed, not blocked) ───────────
const FLAG_PATTERNS = [
  /\b07\d{9}\b/,                          // UK mobile numbers
  /\b\+44\d{10}\b/,                       // UK intl format
  /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/,     // Any phone pattern
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // Email
  /(instagram|snapchat|tiktok|telegram|discord)\s*(id|handle|username|@)?:?\s*\w+/i,
  /meet\s*(me\s*)?(at|in|outside|near|by)/i,
  /\b(alone|private|secret|hidden)\b/i,
];

// ── TIER 3: AI ANALYSIS ─────────────────────────────────────
async function aiAnalysis(content) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) return { flagged: false };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Ty: '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: `You are a child safeguarding system for an online tutoring platform. Analyse this message for grooming, inappropriate contact, or safeguarding concerns. Reply ONLY with JSON: {"flagged": true/false, "reason": "brief reason or null", "severity": "low/medium/high or null"}

Message: "${content}"`,
        }],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return { flagged: false };
  }
}

// ── MAIN FILTER FUNCTION ─────────────────────────────────────
async function filterMessage(content, senderId, receiverId, sessionId) {
  const lower = content.toLowerCase();

  // Tier 1 — instan) {
      await logFlag({
        content, senderId, receiverId, sessionId,
        tier: 1, reason: `Blocked phrase: "${phrase}"`, severity: 'high', action: 'blocked',
      });
      return { allowed: false, reason: 'Message blocked for safeguarding reasons.', flagged: true, severity: 'high' };
    }
  }

  // Tier 2 — pattern flag
  for (const pattern of FLAG_PATTERNS) {
    if (pattern.test(content)) {
      await logFlag({
        content, senderId, receiverId, sessionId,
        tier: 2, reason: `Pattern match: ${pattern}`, severity: 'medium', action: 'flagged',
      });
      // Allow but flag for review
      return { allowed: true, flagged: true, severity: 'medium', reason: 'Message flagged for review.' };
    }
  }

  // Tier 3 — AI analysis (async, non-blocking for speed)
  const ai = await aiAnalysis(content);
  if (ai.flagged) {
    await logFlag({
      content, senderId, receiverId, sessionId,
      tier: 3, reason: ai.reason, severity: ai.severity || 'medium', action: 'flagged',
    }); return { allowed: true, flagged: true, severity: ai.severity, reason: 'Message flagged for review.' };
  }

  return { allowed: true, flagged: false };
}

// ── LOG FLAG TO SUPABASE ─────────────────────────────────────
async function logFlag({ content, senderId, receiverId, sessionId, tier, reason, severity, action }) {
  try {
    await supabase.from('flagged_messages').insert({
      content,
      sender_id: senderId,
      receiver_id: receiverId,
      session_id: sessionId || null,
      tier,
      reason,
      severity,
      action,
      reviewed: false,
    });

    // Notify admin via notification table
    await supabase.from('notifications').insert({
      user_id: senderId, // admin would need a fixed admin ID here
      type: 'safeguarding_flag',
      title: `⚠️ Message Flagged (${severity})`,
      body: `A message was ${action} — Tier ${tier}: ${reason}`,
      data: { sender_id: senderId, receiver_id: rging error:', err);
  }
}

module.exports = { filterMessage };
