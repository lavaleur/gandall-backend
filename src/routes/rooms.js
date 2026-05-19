const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const supabase = require('../config/supabase');
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// POST /api/rooms/create
router.post('/create', auth, async (req, res) => {
  try {
    const { session_id, tutor_name, subject } = req.body;
    if (!session_id) return res.status(400).json({ error: 'session_id required' });

    const shortId = session_id.replace(/-/g, '').substring(0, 8);
    const roomName = `gandall-${shortId}`;
    const roomUrl = `https://meet.jit.si/${roomName}`;

    // Log session start
    await supabase.from('session_logs').insert({
      session_id,
      user_id: req.user.id,
      event: 'joined',
      room_name: roomName,
    }).select().maybeSingle();

    // Alert parent if linked
    try {
      const { data: parentLink } = await supabase
        .from('parental_controls')
        .select('parent_id')
        .eq('child_id', req.user.id)
        .maybeSingle();

      if (parentLink?.parent_id) {
        const { data: parent } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', parentLink.parent_id)
          .maybeSingle();

        const { data: child } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', req.user.id)
          .maybeSingle();

        if (parent?.email) {
          await resend.emails.send({
            from: 'Gandall Safety <safety@gandall.co.uk>',
            to: parent.email,
            subject: `🎥 ${child?.full_name || 'Your child'} just joined a session`,
            html: `
              <div style="font-family:sans-serif;max-width:600px;margin:auto">
                <h2 style="color:#1a1a1a">Session Started 🎓</h2>
                <p><strong>${child?.full_name || 'Your child'}</strong> has joined a <strong>${subject || 'tutoring'}</strong> session${tutor_name ? ` with <strong>${tutor_name}</strong>` : ''}.</p>
                <div style="background:#f0f9f0;border-left:4px solid #4caf50;padding:16px;margin:16px 0;border-radius:4px">
                  <p style="margin:0">🔒 This session is monitored by Gandall. Contact sharing is blocked.</p>
                </div>
                <p style="color:#666;font-size:14px">If you have concerns, contact us at support@gandall.co.uk</p>
                <p style="color:#999;font-size:12px">Gandall — Southampton's Guinean community learning platform</p>
              </div>
            `,
          });
          console.log('[PARENTAL ALERT] Email sent to:', parent.email);
        }
      }
    } catch (alertErr) {
      console.error('[PARENTAL ALERT] Non-critical error:', alertErr.message);
    }

    res.json({ room_name: roomName, room_url: roomUrl, session_id, tutor_name, subject });
  } catch (err) {
    console.error('Room create error:', err);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// GET /api/rooms/logs — parent sees child session history
router.get('/logs/:childId', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('session_logs')
      .select('*, session:sessions(subject, scheduled_at)')
      .eq('user_id', req.params.childId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    res.json({ logs: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch session logs' });
  }
});

module.exports = router;
