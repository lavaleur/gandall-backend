const express = require('express');
const supabase = require('../config/supabase');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/parental — get my parental settings
router.get('/', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('parental_controls')
      .select(`*, child:users!child_id(id, full_name, avatar_url)`)
      .eq('parent_id', req.user.id);
    if (error) throw error;
    res.json({ controls: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch parental controls' });
  }
});

// POST /api/parental — link a child account
router.post('/', auth, async (req, res) => {
  try {
    const { child_id } = req.body;
    if (!child_id) return res.status(400).json({ error: 'child_id required' });

    const { data, error } = await supabase
      .from('parental_controls')
      .insert({ parent_id: req.user.id, child_id })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ control: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to link child' });
  }
});

// PUT /api/parental/:childId — update settings
router.put('/:childId', auth, async (req, res) => {
  try {
    const { require_booking_consent, chat_moderation, hide_contacts, payment_approval, weekly_reports } = req.body;

    const { data, error } = await supabase
      .from('parental_controls')
      .update({ require_booking_consent, chat_moderation, hide_contacts, payment_approval, weekly_reports })
      .eq('parent_id', req.user.id)
      .eq('child_id', req.params.childId)
      .select()
      .single();

    if (error) throw error;
    res.json({ control: data });
  } catch (err) {
    res.status(500).json({ error: 'Settings update failed' });
  }
});

module.exports = router;
