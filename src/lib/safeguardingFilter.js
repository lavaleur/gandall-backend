const BLOCKED = [
  'dont tell your parents',
  'keep this between us',
  'our little secret',
  'dont tell anyone',
  'meet me outside',
  'come alone',
  'whatsapp me',
  'my number is',
  'send me a photo',
  'what are you wearing',
];

async function filterMessage(content) {
  try {
    const lower = (content || '').toLowerCase();
    for (const phrase of BLOCKED) {
      if (lower.includes(phrase)) {
        console.warn('[SAFEGUARDING] Blocked message containing:', phrase);
        return { allowed: false, reason: 'Message blocked for safeguarding reasons.' };
      }
    }
    return { allowed: true, flagged: false };
  } catch (err) {
    console.error('[SAFEGUARDING] Filter error:', err);
    return { allowed: true, flagged: false };
  }
}

module.exports = { filterMessage };
