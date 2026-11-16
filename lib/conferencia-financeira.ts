// Regras de leitura: nenhuma função deste módulo altera registros financeiros.
export function cobrancaCancelada(status: string | null | undefined) {
  return ["cancelado", "cancelada"].includes((status || "").trim().toLowerCase());
}

export function podeCancelarCobrancaComum(
  petId: string,
  ciclo: number | null,
  conversoes: readonly { pet_id: string; ciclo: number }[],
) {
  return ciclo !== null && !conversoes.some(c => c.pet_id === petId && c.ciclo === ciclo);
}

type Conversao = {
  id: string; pet_id: string; ciclo: number; valor_plano: number;
  credito_avulso: number; atendimento_original_id: string;
};
type Parcela = { conversao_id: string; valor: number };
type Pagamento = { pet_id: string; ciclo: number };
type Agendamento = { pet_id: string; ciclo: number | null; pagamento_status: string | null };
type Atendimento = { id: string; valor: number | null; forma_pagamento: string | null };

export function conferirConversoes(
  conversoes: readonly Conversao[], parcelas: readonly Parcela[],
  pagamentos: readonly Pagamento[], agendamentos: readonly Agendamento[],
  atendimentos: readonly Atendimento[],
) {
  return conversoes.flatMap(c => {
    const mensagens: string[] = [];
    const doCiclo = agendamentos.filter(a => a.pet_id === c.pet_id && a.ciclo === c.ciclo);
    const recebimentos = parcelas.filter(p => p.conversao_id === c.id);
    const totalParcelas = recebimentos.reduce((s, p) => s + Number(p.valor), 0);
    const original = atendimentos.find(a => a.id === c.atendimento_original_id);
    if (pagamentos.some(p => p.pet_id === c.pet_id && p.ciclo === c.ciclo)) {
      mensagens.push("Há pagamento comum e conversão no mesmo ciclo. Confira possível duplicidade; o pagamento comum não foi abatido automaticamente do saldo.");
    }
    if (doCiclo.some(a => cobrancaCancelada(a.pagamento_status))) {
      mensagens.push("Há cobrança comum marcada como cancelada neste ciclo convertido. Essa marcação não cancela o saldo da conversão, nem desfaz crédito ou parcelas.");
    }
    if (conversoes.filter(x => x.pet_id === c.pet_id && x.ciclo === c.ciclo).length > 1) {
      mensagens.push("Há mais de uma conversão para o mesmo ciclo. Confira os registros antes de receber novos valores.");
    }
    if (!doCiclo.length) mensagens.push("Agendamentos do ciclo convertido não localizados. Crédito e recebimentos foram preservados.");
    if (!original) {
      mensagens.push("Atendimento original da conversão não localizado. Confira a origem do crédito.");
    } else {
      const recebidoOriginal = original.forma_pagamento ? Number(original.valor) : 0;
      if (!Number.isFinite(recebidoOriginal) || Math.round(recebidoOriginal * 100) !== Math.round(Number(c.credito_avulso) * 100)) {
        mensagens.push("O crédito da conversão diverge do recebimento original disponível. Nenhum crédito foi corrigido automaticamente.");
      }
    }
    const valores = [Number(c.valor_plano), Number(c.credito_avulso), ...recebimentos.map(p => Number(p.valor))];
    if (valores.some(v => !Number.isFinite(v) || v < 0)) {
      mensagens.push("Há valores inválidos no plano, crédito ou parcelas. Confira os registros financeiros.");
    } else if (Math.round((Number(c.credito_avulso) + totalParcelas) * 100) > Math.round(Number(c.valor_plano) * 100)) {
      mensagens.push("Crédito e parcelas superam o valor do plano. Confira possível recebimento excedente.");
    }
    return mensagens.map((mensagem, i) => ({ chave: `${c.id}-${i}`, petId: c.pet_id, ciclo: c.ciclo, mensagem }));
  });
}
