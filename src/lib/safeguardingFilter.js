const BLOCKED = [
  // GROOMING & SECRECY
  'dont tell your parents', 'dont tell your mum', 'dont tell your dad',
  'don\'t tell anyone', 'keep this between us', 'our little secret',
  'this is our secret', 'just between you and me', 'no one needs to know',
  'promise you wont tell', 'swear you wont tell', 'delete this message',
  'delete our chat', 'clear your history',

  // CONTACT EXTRACTION
  'whatsapp me', 'add me on whatsapp', 'my number is', 'text me on',
  'call me on', 'message me on', 'snap me', 'add me on snapchat',
  'add me on instagram', 'dm me', 'my instagram is', 'my snapchat is',
  'my telegram is', 'find me on', 'contact me outside', 'reach me at',
  'email me directly', 'my personal email', 'my private email',

  // MEETING REQUESTS
  'meet me outside', 'come alone', 'meet me in person', 'lets meet up',
  'come to my house', 'come to my place', 'come to my flat',
  'i can pick you up', 'ill pick you up', 'i will collect you',
  'meet me after class', 'meet me later',

  // SEXUAL / INAPPROPRIATE
  'send me a photo', 'send me a picture', 'send me a selfie',
  'send me a video', 'what are you wearing', 'are you alone',
  'are you by yourself', 'you are so mature', 'you are so grown up',
  'you seem older than', 'you look older',

  // COERCION & MANIPULATION
  'i wont tell anyone', 'this is normal', 'everyone does this',
  'its our special', 'i thought you trusted me', 'dont you trust me',
  'if you tell anyone', 'you will get in trouble',
  'no one will believe you', 'i can help you more',

  // PLATFORM BYPASS
  'off this app', 'off this platform', 'off gandall', 'outside of gandall',
  'lets talk somewhere else', 'use a different app', 'talk privately',
  'private chat', 'better platform',
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
