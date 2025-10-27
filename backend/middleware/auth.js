const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'verysecret';

module.exports = function auth(required = true) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      if (required) return res.status(401).json({ ok: false, error: 'Token requerido' });
      req.user = null;
      return next();
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.user = payload;
      return next();
    } catch (err) {
      console.error('JWT error', err);
      if (required) return res.status(401).json({ ok: false, error: 'Token invalido' });
      req.user = null;
      return next();
    }
  };
};
