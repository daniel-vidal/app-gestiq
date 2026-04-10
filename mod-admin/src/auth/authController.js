const authService = require('./authService');

async function login(req, res) {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ erro: 'Email e senha são obrigatórios.' });
  }

  const usuario = await authService.buscarUsuarioPorEmail(email);

  if (!usuario) {
    return res.status(401).json({ erro: 'Credenciais inválidas.' });
  }

  if (!usuario.ativo) {
    return res.status(403).json({ erro: 'Usuário desativado.' });
  }

  const senhaValida = await authService.verificarSenha(senha, usuario.senha_hash);

  if (!senhaValida) {
    return res.status(401).json({ erro: 'Credenciais inválidas.' });
  }

  await authService.registrarLogin(usuario.id);

  const token = authService.gerarToken(usuario);

  return res.json({
    token,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      papel: usuario.papel,
    },
  });
}

async function me(req, res) {
  const usuario = await authService.buscarUsuarioPorId(req.usuario.id);

  if (!usuario) {
    return res.status(404).json({ erro: 'Usuário não encontrado.' });
  }

  return res.json({ usuario });
}

async function alterarSenha(req, res) {
  const { senha_atual, nova_senha } = req.body;

  if (!senha_atual || !nova_senha) {
    return res.status(400).json({ erro: 'Senha atual e nova senha são obrigatórias.' });
  }

  if (nova_senha.length < 6) {
    return res.status(400).json({ erro: 'Nova senha deve ter no mínimo 6 caracteres.' });
  }

  const usuario = await authService.buscarUsuarioPorEmail(req.usuario.email);

  if (!usuario) {
    return res.status(404).json({ erro: 'Usuário não encontrado.' });
  }

  const senhaValida = await authService.verificarSenha(senha_atual, usuario.senha_hash);

  if (!senhaValida) {
    return res.status(401).json({ erro: 'Senha atual incorreta.' });
  }

  await authService.atualizarSenha(usuario.id, nova_senha);

  return res.json({ mensagem: 'Senha alterada com sucesso.' });
}

module.exports = { login, me, alterarSenha };
