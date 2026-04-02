const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { auth } = require('../middleware/auth');

const router = express.Router();

const signToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, full_name, role = 'student', phone, location } = req.body;
    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'Email, password and full name are required' });
    }
    if (!['student', 'tutor', 'parent'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Check if user exists
    const { data: existing } = await supabase
      .from('users').select('id').eq('email', email).single();
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const password_hash = await bcrypt.hash(password, 12);

    const { data: user, error } = await supabase
      .from('users')
      .insert({ email, password_hash, full_name, role, phone, location })
      .select()
      .single();

    if (error) throw error;

    // Create role-specific profile
    if (role === 'tutor') {
      await supabase.from('tutor_profiles').insert({ user_id: user.id });
    } else if (role === 'student') {
      await supabase.from('student_profiles').insert({ user_id: user.id });
    }

    const token = signToken(user);
    const { password_hash: _, ...safeUser } = user;
    res.status(201).json({ token, user: safeUser });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const { data: user, error } = await supabase
      .from('users').select('*').eq('email', email).single();

    if (error || !user) return res.status(401).json({ error: 'Invalid credentials' });
    if (!user.is_active) return res.status(403).json({ error: 'Account deactivated' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken(user);
    const { password_hash: _, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users').select('*').eq('id', req.user.id).single();
    if (error || !user) return res.status(404).json({ error: 'User not found' });
    const { password_hash: _, ...safeUser } = user;
    res.json({ user: safeUser });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PUT /api/auth/profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { full_name, phone, location, avatar_url } = req.body;
    const { data, error } = await supabase
      .from('users')
      .update({ full_name, phone, location, avatar_url })
      .eq('id', req.user.id)
      .select()
      .single();
    if (error) throw error;
    const { password_hash: _, ...safeUser } = data;
    res.json({ user: safeUser });
  } catch (err) {
    res.status(500).json({ error: 'Profile update failed' });
  }
});

module.exports = router;
