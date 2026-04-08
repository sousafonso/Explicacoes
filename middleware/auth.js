function requireAdmin(req, res, next) {
  if (req.session?.isAdmin) return next();
  req.session.flash = { type: 'error', message: 'Tens de iniciar sessão para aceder ao painel.' };
  return res.redirect('/admin/login');
}
function redirectIfAuthenticated(req, res, next) {
  if (req.session?.isAdmin) return res.redirect('/admin');
  next();
}
module.exports = { requireAdmin, redirectIfAuthenticated };