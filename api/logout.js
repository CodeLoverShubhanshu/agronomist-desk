const { clearSession, send, route } = require('../lib/auth');
module.exports = route(async (req, res) => { clearSession(req, res); send(res, 200, { ok: true }) });
