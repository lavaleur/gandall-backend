const supabase = require("../config/supabase");

const BLOCKED = [
  "dont tell your parents",
  "keep this between us",
  "our little secret",
  "dont tell anyone",
  "meet me outside",
  "come alone",
  "whatsapp me",
  "my number is",
  "send me a photo",
  "what are you wearing",
];

async function filterMessage(content, senderId, receiverId, sessionId) {
  const lower = content.toLowerCase().replace(/[^a-z0-9 ]/g, "");
  for (const phrase of BLOCKED) {
    if (lower.includes(phrase)) {
      try {
        await supabase.from("flagged_messages").insert({
          content, sender_id: senderId, receiver_id: receiverId,
          session_id: sessionId || null, tier: 1,
          reason: "Blocked: " + phrase,
          severity: "high", action: "blocked", reviewed: false,
        });
      } catch (e) { console.error(e); }
      return { allowed: false, reason: "Message blocked for safeguarding reasons." };
    }
  }
  return { allowed: true, flagged: false };
}

module.exports = { filterMessage };
