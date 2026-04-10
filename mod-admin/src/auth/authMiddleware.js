const authService = require('./authService');

// Hierarquia de papéis: admin > gerente > operador
const HIERARQUIA = { admin: 3, gerente: 2, operador: 1 };

/**
 * Middleware que exige autenticação via JWT.
 * Popula req.usuario com { id, email, papel }.
 */
function autenticar(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Token não fornecido.' });
  }

  const token = header.slice(7);

  try {
    const payload = authService.verificarToken(token);
    req.usuario = { id: payload.id, email: payload.email, papel: payload.papel };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ erro: 'Token expirado.' });
    }
    return res.status(401).json({ erro: 'Token inválido.' });
  }
}

/**
 * Retorna um middleware que exige papel mínimo.
 * Ex: autorizar('gerente') permite admin e gerente, bloqueia operador.
 */
function autorizar(papelMinimo) {
  const nivelMinimo = HIERARQUIA[papelMinimo];

  if (nivelMinimo === undefined) {
    throw new Error(`Papel desconhecido: ${papelMinimo}`);
  }

  return function (req, res, next) {
    const nivelUsuario = HIERARQUIA[req.usuario.papel];

    if (nivelUsuario === undefined || nivelUsuario < nivelMinimo) {
      return res.status(403).json({ erro: 'Acesso negado. Permissão insuficiente.' });
    }

    next();
  };
}

module.exports = { autenticar, autorizar };
