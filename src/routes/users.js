const express = require('express');
const supabase = require('../config/supabase');
const { auth } = require('../middleware/auth');
const router = express.Router();

// GET /api/users/me
router.get('/me', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*, tutor_profile:tutor_profiles(*)')
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
    const { avatar_url, location, bio } = req.body;
    const updates = {};
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    if (location !== undefined) updates.location = location;

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from('users').update(updates).eq('id', req.user.id);
      if (error) throw error;
    }

    if (bio !== undefined) {
      const { error } = await supabase
        .from('tutor_profiles').update({ bio }).eq('user_id', req.user.id);
      if (error) throw error;
    }

    res.json({ message: 'Profile updated' });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Update failed' });
  }
});

module.exports = router;
