const supabase = require('../config/supabase');

const BLOCKED_PHRASES = [
  "don't tell your parents", "dont tell your parents",
  "keep this between us", "our little secret", "keep it secret",
  "don't tell anyone", "dont tell anyone",
  "meet me outside", "meet outside class", "come alone",
  "meet in person", "meet up alone", "come by yourself",
  "whatsapp me", "text me on", "call me on",
  "add me on instagram", "add me on snapchat",
  "message me on telegram",
  "my number is", "here's my number", "heres my number",
  "send me a photo", "send me a picture", "send me a video",
  "what are you wearing",
  "i'll pay you extra", "ill pay you extra",
  "extra money if", "bonus if you",
];

const FLAG_PATTERNS = [
  /\b07\d{9}\b/,
  /\b\+44\d{10}\b/,
  /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/,
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
  /(instagram|snapchat|tiktok|telegram|discord)\s*(id|handle|username|@)?:?\s*\w+/i,
  /meet\s*(me\s*)?(at|in|outside|near|by)/i,
  /\b(alone|private|secret|hidden)\b/i,
];

async function aiAnalysis(content) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) return { flagged: false };
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: 'You are a child safeguarding system for an online tutoring platform. Analyse this message for grooming, inappropriate contact, or safeguarding concerns. Reply ONLY with JSON: {"flagged": true/false, "reason": "brief reason or null", "severity": "low/medium/high or null"}\n\nMessage: "' + content + '"',
        }],
      }),
    });
    const data = await response.json();
    const text = data.content?.[0]?.text || '{}';
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch (e) {
    return { flagged: false };
  }
}

async function logFlag({ content, senderId, receiverId, sessionId, tier, reason, severity, action }) {
  try {
    await supabase.from('flagged_messages').insert({
      content, sender_id: senderId, receiver_id: receiverId,
      session_id: sessionId || null, tier, reason, severity, action, reviewed: false,
    });
    await supabase.from('notifications').insert({
      user_id: senderId,
      type: 'safeguarding_flag',
      title: 'Message Flagged (' + severity + ')',
      body: 'A message was ' + action + ' - Tier ' + tier + ': ' + reason,
      data: { sender_id: senderId, receiver_id: receiverId, severity, action },
    });
  } catch (err) {
    console.error('Flag logging error:', err);
  }
}

async function filterMessage(content, senderId, receiverId, sessionId) {
  const lower = content.toLowerCase();

  for (const phrase of BLOCKED_PHRASES) {
    if (lower.includes(phrase)) {
      await logFlag({ content, senderId, receiverId, sessionId, tier: 1, reason: 'Blocked phrase: ' + phrase, severity: 'high', action: 'blocked' });
      return { allowed: false, reason: 'Message blocked for safeguarding reasons.', flagged: true, severity: 'high' };
    }
  }

  for (const pattern of FLAG_PATTERNS) {
    if (pattern.test(content)) {
      await logFlag({ content, senderId, receiverId, sessionId, tier: 2, reason: 'Pattern match: ' + pattern.toString(), severity: 'medium', action: 'flagged' });
      return { allowed: true, flagged: true, severity: 'medium', reason: 'Message flagged for review.' };
    }
  }

  const ai = await aiAnalysis(content);
  if (ai.flagged) {
    await logFlag({ content, senderId, receiverId, sessionId, tier: 3, reason: ai.reason, severity: ai.severity || 'medium', action: 'flagged' });
    return { allowed: true, flagged: true, severity: ai.severity, reason: 'Message flagged for review.' };
  }

  return { allowed: true, flagged: false };
}

module.exports = { filterMessage };
