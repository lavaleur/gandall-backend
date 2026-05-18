const express = require('express');
const supabase = require('../config/supabase');
const { auth } = require('../middleware/auth');
const router = express.Router();

// GET /api/users/me
router.get('/me', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();
    if (error) throw error;
    res.json({ user: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PUT /api/users/profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { full_name, location, phone, bio, subjects, hourly_rate } = req.body;
    const { data, error } = await supabase
      .from('profiles')
      .update({ full_name, location, phone, bio, subjects, hourly_rate, updated_at: new Date().toISOString() })
      .eq('id', req.user.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ user: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// POST /api/users/avatar
router.post('/avatar', auth, async (req, res) => {
  try {
    const { avatar_url } = req.body;
    if (!avatar_url) return res.status(400).json({ error: 'avatar_url is required' });
    const { data, error } = await supabase
      .from('profiles')
      .update({ avatar_url, updated_at: new Date().toISOString() })
      .eq('id', req.user.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ user: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update avatar' });
  }
});

module.exports = router;
