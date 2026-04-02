const express = require('express');
const supabase = require('../config/supabase');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/hifz — get my hifz progress
router.get('/', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('hifz_progress')
      .select('*')
      .eq('user_id', req.user.id)
      .order('surah_number');
    if (error) throw error;
    res.json({ progress: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch Hifz progress' });
  }
});

// PUT /api/hifz/:surahNumber — update a surah status
router.put('/:surahNumber', auth, async (req, res) => {
  try {
    const surah_number = parseInt(req.params.surahNumber);
    const { status, notes, surah_name } = req.body;
    const validStatuses = ['not_started', 'in_progress', 'memorised'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updateData = {
      user_id: req.user.id,
      surah_number,
      surah_name: surah_name || `Surah ${surah_number}`,
      status,
      notes,
      updated_at: new Date().toISOString()
    };

    if (status === 'in_progress') updateData.started_at = new Date().toISOString();
    if (status === 'memorised') updateData.completed_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('hifz_progress')
      .upsert(updateData, { onConflict: 'user_id,surah_number' })
      .select()
      .single();

    if (error) throw error;
    res.json({ progress: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update Hifz progress' });
  }
});

// GET /api/hifz/stats — summary stats
router.get('/stats', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('hifz_progress')
      .select('status')
      .eq('user_id', req.user.id);
    if (error) throw error;
    const memorised = data.filter(r => r.status === 'memorised').length;
    const in_progress = data.filter(r => r.status === 'in_progress').length;
    res.json({ memorised, in_progress, total: 114, percentage: Math.round((memorised / 114) * 100) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
