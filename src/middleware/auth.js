const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

const decodeBearerPayload = (token) => {
  if (!token) throw new Error('no_token');

  // Prefer Supabase Auth JWT when configured (HS256, JWT Secret from Supabase dashboard).
  if (process.env.SUPABASE_JWT_SECRET) {
    try {
      return jwt.verify(token, process.env.SUPABASE_JWT_SECRET, { algorithms: ['HS256'] });
    } catch {
      /* fall through to legacy app JWT */
    }
  }

  if (!process.env.JWT_SECRET) {
    throw new Error('jwt_not_configured');
  }

  return jwt.verify(token, process.env.JWT_SECRET);
};

const auth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  let payload;
  try {
    payload = decodeBearerPayload(token);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const userId = payload.sub || payload.id;
  if (!userId) {
    return res.status(401).json({ error: 'Invalid token payload' });
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

module.exports = { auth, adminOnly };
