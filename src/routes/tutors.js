const express = require('express');
const supabase = require('../config/supabase');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/tutors — search tutors
router.get('/', async (req, res) => {
  try {
    const { subject, location, min_rate, max_rate, online_only } = req.query;

    let query = supabase
      .from('tutor_profiles')
      .select(`
        *,
        users!inner(id, full_name, email, location, avatar_url)
      `);

    if (subject) {
      query = query.contains('subjects', [subject]);
    }
    if (online_only === 'true') {
      query = query.eq('is_online', true);
    }
    if (min_rate) query = query.gte('hourly_rate', parseFloat(min_rate));
    if (max_rate) query = query.lte('hourly_rate', parseFloat(max_rate));

    const { data, error } = await query.order('rating', { ascending: false });
    if (error) throw error;
    res.json({ tutors: data });
  } catch (err) {
    console.error('Tutor search error:', err);
    res.status(500).json({ error: 'Failed to fetch tutors' });
  }
});

// GET /api/tutors/:id — single tutor profile
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('tutor_profiles')
      .select(`*, users!inner(id, full_name, location, avatar_url, created_at)`)
      .eq('user_id', req.params.id)
      .single();
    if (error || !data) return res.status(404).json({ error: 'Tutor not found' });
    res.json({ tutor: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tutor' });
  }
});

// PUT /api/tutors/profile — tutor updates own profile
router.put('/profile', auth, async (req, res) => {
  try {
    if (req.user.role !== 'tutor') return res.status(403).json({ error: 'Tutors only' });
    const { subjects, bio, hourly_rate, experience_years, is_dbs_checked, is_online, languages, availability } = req.body;

    const { data, error } = await supabase
      .from('tutor_profiles')
      .update({ subjects, bio, hourly_rate, experience_years, is_dbs_checked, is_online, languages, availability })
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ profile: data });
  } catch (err) {
    res.status(500).json({ error: 'Profile update failed' });
  }
});

// GET /api/tutors/:id/reviews
router.get('/:id/reviews', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select(`*, users!reviewer_id(full_name, avatar_url)`)
      .eq('tutor_id', req.params.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ reviews: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

module.exports = router;
