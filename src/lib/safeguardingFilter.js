cat > /Users/salioudiallo/Downloads/gandall/backend/src/lib/safeguardingFilter.js << 'EOF'
const supabase = require('../config/supabase');

const BLOCKED_PHRASES = [
  "don't tell your parents", "dont tell your parents",
  "keep this between us", "our little secret",
  "don't tell anyone", "dont tell anyone",
  "meet me outside", "come alone", "meet in person",
  "whatsapp me", "my number is", "heres my number",
  "send me a photo", "what are you wearing",
];

async function filterMessage(content, senderId, receiverId, sessionId) {
  const lower = content.toLowerCase();

  for (const phrase of BLOCKED_PHRASES) {
    if (lower.includes(phrase)) {
      try {
        await supabase.from('flagged_messages').insert({
          content, sender_id: senderId, receiver_id: receiverId,
          session_id: sessionId || null, tier: 1,
          reason: 'Blocked phrase: ' + phrase,
          severity: 'high', action: 'blocked', reviewed: false,
        });
      } catch (e) { console.error('Flag error:', e); }
      return { allowed: false, reason: 'Message blocked for safeguarding reasons.', flagged: true };
    }
  }

  const phonePattern = /\b07\d{9}\b|\b\+44\d{10}\b/;
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

  if (phonePattern.test(content) || emailPattern.test(content)) {
    try {
      await supabase.from('flagged_messages').insert({
        content, sender_id: senderId, receiver_id: receiverId,
        session_id: sessionId || null, tier: 2,
        reason: 'Contact info detected',
        severity: 'medium', action: 'flagged', reviewed: false,
      });
    } catch (e) { console.error('Flag error:', e); }
    return { allowed: true, flagged: true, severity: 'medium' };
  }

  return { allowed: true, flagged: false };
}

module.exports = { filterMessage };
EOF