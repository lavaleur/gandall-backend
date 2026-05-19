const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// POST /api/rooms/create
// Generates a Jitsi room name for a session
router.post('/create', auth, async (req, res) => {
  try {
    const { session_id, tutor_name, subject } = req.body;
    if (!session_id) {
      return res.status(400).json({ error: 'session_id required' });
    }
    // Room name: gandall-{first 8 chars of session_id}
    const shortId = session_id.replace(/-/g, '').substring(0, 8);
    const roomName = `gandall-${shortId}`;
    const roomUrl = `https://meet.jit.si/${roomName}`;

    res.json({
      room_name: roomName,
      room_url: roomUrl,
      session_id,
      tutor_name: tutor_name || 'Tutor',
      subject: subject || 'Session',
    });
  } catch (err) {
    console.error('Room create error:', err);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

module.exports = router;
