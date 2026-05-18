const express = require('express');
const supabase = require('../config/supabase');
const { auth } = require('../middleware/auth');

const router = express.Router();

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const extForMime = (mime) => {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return null;
};

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

// POST /api/users/avatar — upload via service role (app JWT is not a Supabase Auth token)
router.post('/avatar', auth, async (req, res) => {
  try {
    const { file: base64, contentType } = req.body;
    if (!base64 || typeof base64 !== 'string') {
      return res.status(400).json({ error: 'Image data is required' });
    }
    if (!contentType || !AVATAR_ALLOWED_TYPES.has(contentType)) {
      return res.status(400).json({ error: 'Use a JPG, PNG, or WebP image' });
    }

    const ext = extForMime(contentType);
    if (!ext) {
      return res.status(400).json({ error: 'Unsupported image type' });
    }

    let buffer;
    try {
      buffer = Buffer.from(base64, 'base64');
    } catch {
      return res.status(400).json({ error: 'Invalid image data' });
    }

    if (!buffer.length) {
      return res.status(400).json({ error: 'Image file is empty' });
    }
    if (buffer.length > AVATAR_MAX_BYTES) {
      return res.status(400).json({ error: 'Image must be under 5MB' });
    }

    const path = `${req.user.id}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, buffer, { upsert: true, contentType });

    if (uploadError) {
      console.error('Avatar storage upload:', uploadError);
      const msg = String(uploadError.message || '');
      if (/bucket.*not found/i.test(msg)) {
        return res.status(503).json({
          error: 'Avatar storage is not set up. Create a public "avatars" bucket in Supabase.',
        });
      }
      return res.status(500).json({ error: 'Could not upload photo. Please try again.' });
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
    res.json({ url: publicUrl });
  } catch (err) {
    console.error('Avatar upload error:', err);
    res.status(500).json({ error: 'Could not upload photo' });
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
