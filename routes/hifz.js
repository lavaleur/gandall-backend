const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');

const SURAHS = [
  {number:1,name_arabic:'الفاتحة',name_english:'Al-Fatihah',ayahs:7},
  {number:2,name_arabic:'البقرة',name_english:'Al-Baqarah',ayahs:286},
  {number:3,name_arabic:'آل عمران',name_english:'Aal-Imran',ayahs:200},
  {number:4,name_arabic:'النساء',name_english:'An-Nisa',ayahs:176},
  {number:5,name_arabic:'المائدة',name_english:'Al-Maidah',ayahs:120},
  {number:6,name_arabic:'الأنعام',name_english:'Al-Anam',ayahs:165},
  {number:7,name_arabic:'الأعراف',name_english:'Al-Araf',ayahs:206},
  {number:8,name_arabic:'الأنفال',name_english:'Al-Anfal',ayahs:75},
  {number:9,name_arabic:'التوبة',name_english:'At-Tawbah',ayahs:129},
  {number:10,name_arabic:'يونس',name_english:'Yunus',ayahs:109},
  {number:11,name_arabic:'هود',name_english:'Hud',ayahs:123},
  {number:12,name_arabic:'يوسف',name_english:'Yusuf',ayahs:111},
  {number:13,name_arabic:'الرعد',name_english:'Ar-Rad',ayahs:43},
  {number:14,name_arabic:'إبراهيم',name_english:'Ibrahim',ayahs:52},
  {number:15,name_arabic:'الحجر',name_english:'Al-Hijr',ayahs:99},
  {number:16,name_arabic:'النحل',name_english:'An-Nahl',ayahs:128},
  {number:17,name_arabic:'الإسراء',name_english:'Al-Isra',ayahs:111},
  {number:18,name_arabic:'الكهف',name_english:'Al-Kahf',ayahs:110},
  {number:19,name_arabic:'مريم',name_english:'Maryam',ayahs:98},
  {number:20,name_arabic:'طه',name_english:'Ta-Ha',ayahs:135},
  {number:78,name_arabic:'النبأ',name_english:'An-Naba',ayahs:40},
  {number:79,name_arabic:'النازعات',name_english:'An-Naziat',ayahs:46},
  {number:80,name_arabic:'عبس',name_english:'Abasa',ayahs:42},
  {number:81,name_arabic:'التكوير',name_english:'At-Takwir',ayahs:29},
  {number:82,name_arabic:'الانفطار',name_english:'Al-Infitar',ayahs:19},
  {number:83,name_arabic:'المطففين',name_english:'Al-Mutaffifin',ayahs:36},
  {number:84,name_arabic:'الانشقاق',name_english:'Al-Inshiqaq',ayahs:25},
  {number:85,name_arabic:'البروج',name_english:'Al-Buruj',ayahs:22},
  {number:86,name_arabic:'الطارق',name_english:'At-Tariq',ayahs:17},
  {number:87,name_arabic:'الأعلى',name_english:'Al-Ala',ayahs:19},
  {number:88,name_arabic:'الغاشية',name_english:'Al-Ghashiyah',ayahs:26},
  {number:89,name_arabic:'الفجر',name_english:'Al-Fajr',ayahs:30},
  {number:90,name_arabic:'البلد',name_english:'Al-Balad',ayahs:20},
  {number:91,name_arabic:'الشمس',name_english:'Ash-Shams',ayahs:15},
  {number:92,name_arabic:'الليل',name_english:'Al-Layl',ayahs:21},
  {number:93,name_arabic:'الضحى',name_english:'Ad-Duha',ayahs:11},
  {number:94,name_arabic:'الشرح',name_english:'Ash-Sharh',ayahs:8},
  {number:95,name_arabic:'التين',name_english:'At-Tin',ayahs:8},
  {number:96,name_arabic:'العلق',name_english:'Al-Alaq',ayahs:19},
  {number:97,name_arabic:'القدر',name_english:'Al-Qadr',ayahs:5},
  {number:98,name_arabic:'البينة',name_english:'Al-Bayyinah',ayahs:8},
  {number:99,name_arabic:'الزلزلة',name_english:'Az-Zalzalah',ayahs:8},
  {number:100,name_arabic:'العاديات',name_english:'Al-Adiyat',ayahs:11},
  {number:101,name_arabic:'القارعة',name_english:'Al-Qariah',ayahs:11},
  {number:102,name_arabic:'التكاثر',name_english:'At-Takathur',ayahs:8},
  {number:103,name_arabic:'العصر',name_english:'Al-Asr',ayahs:3},
  {number:104,name_arabic:'الهمزة',name_english:'Al-Humazah',ayahs:9},
  {number:105,name_arabic:'الفيل',name_english:'Al-Fil',ayahs:5},
  {number:106,name_arabic:'قريش',name_english:'Quraysh',ayahs:4},
  {number:107,name_arabic:'الماعون',name_english:'Al-Maun',ayahs:7},
  {number:108,name_arabic:'الكوثر',name_english:'Al-Kawthar',ayahs:3},
  {number:109,name_arabic:'الكافرون',name_english:'Al-Kafirun',ayahs:6},
  {number:110,name_arabic:'النصر',name_english:'An-Nasr',ayahs:3},
  {number:111,name_arabic:'المسد',name_english:'Al-Masad',ayahs:5},
  {number:112,name_arabic:'الإخلاص',name_english:'Al-Ikhlas',ayahs:4},
  {number:113,name_arabic:'الفلق',name_english:'Al-Falaq',ayahs:5},
  {number:114,name_arabic:'الناس',name_english:'An-Nas',ayahs:6},
];

router.get('/surahs', (req, res) => {
  res.json({ surahs: SURAHS, total: SURAHS.length });
});

router.get('/progress', requireAuth, async (req, res) => {
  try {
    const { data: progress } = await supabase.from('hifz_progress').select('*').eq('user_id', req.user.id).order('surah_number', { ascending: true });
    const enriched = SURAHS.map((surah) => {
      const p = progress?.find((r) => r.surah_number === surah.number);
      return {
        surah_number: surah.number, surah_name_arabic: surah.name_arabic,
        surah_name_english: surah.name_english, total_ayahs: surah.ayahs,
        memorised_ayahs: p?.memorised_ayahs || 0, status: p?.status || 'not_started',
        last_reviewed_at: p?.last_reviewed_at || null,
        progress_percent: p ? Math.round((p.memorised_ayahs / surah.ayahs) * 100) : 0,
        id: p?.id || null,
      };
    });
    res.json({ progress: enriched });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

router.get('/progress/:surahNum', requireAuth, async (req, res) => {
  try {
    const surahNum = parseInt(req.params.surahNum);
    if (isNaN(surahNum) || surahNum < 1 || surahNum > 114) return res.status(400).json({ error: 'surahNum must be 1-114' });
    const surah = SURAHS.find((s) => s.number === surahNum);
    if (!surah) return res.status(400).json({ error: 'Surah not found' });
    const { data: progress } = await supabase.from('hifz_progress').select('*').eq('user_id', req.user.id).eq('surah_number', surahNum).single();
    res.json({
      surah_number: surah.number, surah_name_arabic: surah.name_arabic,
      surah_name_english: surah.name_english, total_ayahs: surah.ayahs,
      memorised_ayahs: progress?.memorised_ayahs || 0, status: progress?.status || 'not_started',
      last_reviewed_at: progress?.last_reviewed_at || null,
      progress_percent: progress ? Math.round((progress.memorised_ayahs / surah.ayahs) * 100) : 0,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch surah progress' });
  }
});

router.put('/progress/:surahNum', requireAuth, async (req, res) => {
  try {
    const surahNum = parseInt(req.params.surahNum);
    if (isNaN(surahNum) || surahNum < 1 || surahNum > 114) return res.status(400).json({ error: 'surahNum must be 1-114' });
    const surah = SURAHS.find((s) => s.number === surahNum);
    if (!surah) return res.status(400).json({ error: 'Surah not found' });
    const { memorised_ayahs, status, last_reviewed_at } = req.body;
    const updateData = { surah_name: surah.name_english, total_ayahs: surah.ayahs };
    if (memorised_ayahs !== undefined) {
      const clamped = Math.min(Math.max(0, memorised_ayahs), surah.ayahs);
      updateData.memorised_ayahs = clamped;
      if (!status) updateData.status = clamped === 0 ? 'not_started' : clamped === surah.ayahs ? 'memorised' : 'in_progress';
    }
    if (status) updateData.status = status;
    updateData.last_reviewed_at = last_reviewed_at || new Date().toISOString();
    const { data, error } = await supabase.from('hifz_progress').upsert({ user_id: req.user.id, surah_number: surahNum, ...updateData }, { onConflict: 'user_id,surah_number' }).select().single();
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Progress updated', progress: { ...data, progress_percent: Math.round((data.memorised_ayahs / surah.ayahs) * 100) } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

router.post('/sessions', requireAuth, async (req, res) => {
  try {
    const { surah_number, ayah_from, ayah_to, duration_minutes, quality_rating, notes, session_date } = req.body;
    if (!surah_number || !ayah_from || !ayah_to) return res.status(400).json({ error: 'surah_number, ayah_from, ayah_to are required' });
    const surah = SURAHS.find((s) => s.number === surah_number);
    if (!surah) return res.status(400).json({ error: 'Invalid surah_number' });
    const { data: session, error } = await supabase.from('hifz_sessions').insert({ user_id: req.user.id, surah_number, ayah_from, ayah_to, duration_minutes, quality_rating, notes, session_date: session_date || new Date().toISOString().split('T')[0] }).select().single();
    if (error) return res.status(400).json({ error: error.message });
    await supabase.from('hifz_progress').upsert({ user_id: req.user.id, surah_number, surah_name: surah.name_english, total_ayahs: surah.ayahs, memorised_ayahs: ayah_to, status: ayah_to >= surah.ayahs ? 'memorised' : 'in_progress', last_reviewed_at: new Date().toISOString() }, { onConflict: 'user_id,surah_number' });
    res.status(201).json({ message: 'Session logged', session });
  } catch (err) {
    res.status(500).json({ error: 'Failed to log session' });
  }
});

router.get('/sessions', requireAuth, async (req, res) => {
  try {
    const { surah_number, page = 1, limit = 30 } = req.query;
    const offset = (page - 1) * limit;
    let query = supabase.from('hifz_sessions').select('*').eq('user_id', req.user.id).order('session_date', { ascending: false }).range(offset, offset + limit - 1);
    if (surah_number) query = query.eq('surah_number', parseInt(surah_number));
    const { data: sessions, error } = await query;
    if (error) return res.status(400).json({ error: error.message });
    res.json({ sessions, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

router.get('/stats', requireAuth, async (req, res) => {
  try {
    const { data: progress } = await supabase.from('hifz_progress').select('*').eq('user_id', req.user.id);
    const { data: sessions } = await supabase.from('hifz_sessions').select('session_date, duration_minutes, quality_rating').eq('user_id', req.user.id).order('session_date', { ascending: false });
    const memorised = progress?.filter((p) => p.status === 'memorised').length || 0;
    const inProgress = progress?.filter((p) => p.status === 'in_progress').length || 0;
    const totalAyahs = progress?.reduce((acc, p) => acc + (p.memorised_ayahs || 0), 0) || 0;
    let currentStreak = 0;
    if (sessions?.length) {
      const dates = [...new Set(sessions.map((s) => s.session_date))].sort().reverse();
      let checkDate = new Date().toISOString().split('T')[0];
      for (const date of dates) {
        if (date === checkDate) {
          currentStreak++;
          const prev = new Date(checkDate);
          prev.setDate(prev.getDate() - 1);
          checkDate = prev.toISOString().split('T')[0];
        } else break;
      }
    }
    const totalMinutes = sessions?.reduce((acc, s) => acc + (s.duration_minutes || 0), 0) || 0;
    res.json({
      summary: { surahs_memorised: memorised, surahs_in_progress: inProgress, total_ayahs_memorised: totalAyahs, quran_completion_percent: Math.round((totalAyahs / 6236) * 100) },
      streak: { current_streak_days: currentStreak },
      sessions: { total_sessions: sessions?.length || 0, total_minutes: totalMinutes, total_hours: Math.round(totalMinutes / 60) },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
