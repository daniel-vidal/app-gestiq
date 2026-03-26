function parseHora(horaStr) {
  if (!horaStr) return null;

  const partes = String(horaStr).split(':').map(Number);
  const [hora = 0, minuto = 0, segundo = 0] = partes;

  if (
    !Number.isInteger(hora) || hora < 0 || hora > 23 ||
    !Number.isInteger(minuto) || minuto < 0 || minuto > 59 ||
    !Number.isInteger(segundo) || segundo < 0 || segundo > 59
  ) {
    return null;
  }

  return { hora, minuto, segundo };
}

function clonarData(data) {
  return new Date(data.getTime());
}

function aplicarHora(data, horaStr) {
  const dt = clonarData(data);
  const hora = parseHora(horaStr);

  if (!hora) {
    return dt;
  }

  dt.setHours(hora.hora, hora.minuto, hora.segundo, 0);
  return dt;
}

function inicioDoDia(data) {
  const dt = clonarData(data);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function diaPermitido(data, diasSemana) {
  if (!Array.isArray(diasSemana) || diasSemana.length === 0) {
    return true;
  }

  const dia = data.getDay();
  return diasSemana.includes(dia);
}

function dentroDaJanelaHorario(data, horaInicio, horaFim) {
  if (!horaInicio && !horaFim) {
    return true;
  }

  const atualSegundos =
    data.getHours() * 3600 +
    data.getMinutes() * 60 +
    data.getSeconds();

  const ini = parseHora(horaInicio);
  const fim = parseHora(horaFim);

  const iniSegundos = ini
    ? ini.hora * 3600 + ini.minuto * 60 + ini.segundo
    : null;

  const fimSegundos = fim
    ? fim.hora * 3600 + fim.minuto * 60 + fim.segundo
    : null;

  if (iniSegundos != null && atualSegundos < iniSegundos) {
    return false;
  }

  if (fimSegundos != null && atualSegundos > fimSegundos) {
    return false;
  }

  return true;
}

function ajustarParaJanelaHorario(data, horaInicio, horaFim) {
  let dt = clonarData(data);

  const ini = parseHora(horaInicio);
  const fim = parseHora(horaFim);

  if (!ini && !fim) {
    return dt;
  }

  const atualSegundos =
    dt.getHours() * 3600 +
    dt.getMinutes() * 60 +
    dt.getSeconds();

  const iniSegundos = ini
    ? ini.hora * 3600 + ini.minuto * 60 + ini.segundo
    : null;

  const fimSegundos = fim
    ? fim.hora * 3600 + fim.minuto * 60 + fim.segundo
    : null;

  if (iniSegundos != null && atualSegundos < iniSegundos) {
    dt.setHours(ini.hora, ini.minuto, ini.segundo, 0);
    return dt;
  }

  if (fimSegundos != null && atualSegundos > fimSegundos) {
    dt.setDate(dt.getDate() + 1);

    if (ini) {
      dt.setHours(ini.hora, ini.minuto, ini.segundo, 0);
    } else {
      dt.setHours(0, 0, 0, 0);
    }

    return dt;
  }

  return dt;
}

function proximoDiaPermitido(data, diasSemana, horaInicio) {
  let dt = clonarData(data);

  for (let i = 0; i < 14; i++) {
    if (diaPermitido(dt, diasSemana)) {
      return horaInicio ? aplicarHora(dt, horaInicio) : dt;
    }

    dt.setDate(dt.getDate() + 1);
    dt = inicioDoDia(dt);

    if (horaInicio) {
      dt = aplicarHora(dt, horaInicio);
    }
  }

  throw new Error('Não foi possível encontrar um próximo dia permitido.');
}

function ajustarParaRestricoes(data, rotina) {
  let dt = clonarData(data);

  dt = ajustarParaJanelaHorario(dt, rotina.hora_inicio, rotina.hora_fim);

  if (!diaPermitido(dt, rotina.dias_semana)) {
    dt = proximoDiaPermitido(dt, rotina.dias_semana, rotina.hora_inicio);
  }

  if (!dentroDaJanelaHorario(dt, rotina.hora_inicio, rotina.hora_fim)) {
    dt = ajustarParaJanelaHorario(dt, rotina.hora_inicio, rotina.hora_fim);

    if (!diaPermitido(dt, rotina.dias_semana)) {
      dt = proximoDiaPermitido(dt, rotina.dias_semana, rotina.hora_inicio);
    }
  }

  return dt;
}

function calcularBaseInicial(rotina, referencia) {
  const frequenciaTipo = rotina.frequencia_tipo;
  const frequenciaValor = Number(rotina.frequencia_valor || 1);
  const base = clonarData(referencia);

  switch (frequenciaTipo) {
    case 'minutos':
      base.setMinutes(base.getMinutes() + frequenciaValor);
      return base;

    case 'horas':
      base.setHours(base.getHours() + frequenciaValor);
      return base;

    case 'diaria':
      base.setDate(base.getDate() + frequenciaValor);
      return rotina.hora_inicio ? aplicarHora(base, rotina.hora_inicio) : base;

    case 'semanal':
      base.setDate(base.getDate() + (7 * frequenciaValor));
      return rotina.hora_inicio ? aplicarHora(base, rotina.hora_inicio) : base;

    case 'mensal':
      base.setMonth(base.getMonth() + frequenciaValor);
      return rotina.hora_inicio ? aplicarHora(base, rotina.hora_inicio) : base;

    default:
      throw new Error(`frequencia_tipo inválido: ${frequenciaTipo}`);
  }
}

function calcularProximaExecucao(rotina, referencia = new Date()) {
  if (!rotina) {
    throw new Error('Rotina não informada.');
  }

  const base = calcularBaseInicial(rotina, referencia);
  const ajustada = ajustarParaRestricoes(base, rotina);

  return ajustada;
}

module.exports = { calcularProximaExecucao };