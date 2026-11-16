import { cobrancaCancelada } from "./conferencia-financeira";

export type AgendamentoFinanceiro = {
  pet_id: string; ciclo: number | null; valor_total: number | null;
  pagamento_status: string | null; status?: string | null;
};
export type ConversaoFinanceira = {
  id: string; pet_id: string; ciclo: number; valor_plano: number; credito_avulso: number;
};
export type RecebimentoPlano = {
  pet_id: string; ciclo: number; valor: number; forma_pagamento?: string | null;
};
export type ParcelaConversao = { conversao_id: string; valor: number; forma_pagamento?: string | null };
export type AtendimentoFinanceiro = { valor: number | null; forma_pagamento: string | null };
export type ResumoFinanceiro = {
  valor: number | null; recebido: number; credito: number; saldo: number | null;
  estado: "pago" | "pendente" | "parcial" | "cancelado" | "conferir";
  forma: string | null; convertido: boolean;
};

export function centavos(valor: number | null | undefined): number | null {
  if (valor == null || !Number.isFinite(Number(valor)) || Number(valor) < 0) return null;
  const n = Math.round(Number(valor) * 100);
  return Number.isSafeInteger(n) ? n : null;
}

function formas(registros: readonly { forma_pagamento?: string | null }[]) {
  return [...new Set(registros.map(r => r.forma_pagamento?.trim()).filter(Boolean))].join(" / ") || null;
}

export function resumirCiclo(
  grupo: readonly AgendamentoFinanceiro[], pagamentos: readonly RecebimentoPlano[],
  conversoes: readonly ConversaoFinanceira[], parcelas: readonly ParcelaConversao[],
): ResumoFinanceiro {
  const primeiro = grupo[0];
  const cvs = conversoes.filter(c => c.pet_id === primeiro?.pet_id && c.ciclo === primeiro?.ciclo);
  const pg = pagamentos.filter(p => p.pet_id === primeiro?.pet_id && p.ciclo === primeiro?.ciclo);
  const cv = cvs[0];
  const pars = cv ? parcelas.filter(p => p.conversao_id === cv.id) : [];
  const valores = [...new Set(grupo.map(a => centavos(a.valor_total)))];
  const total = cv ? centavos(cv.valor_plano) : valores.length === 1 ? valores[0] : null;
  const credito = cv ? centavos(cv.credito_avulso) : 0;
  const registros = cv ? pars : pg;
  const montantes = registros.map(p => centavos(p.valor));
  const recebido = montantes.reduce<number>((s, n) => s + (n ?? 0), 0);
  const saldoBruto = total == null || credito == null ? null : total - credito - recebido;
  const cancelado = !cv && grupo.some(a => cobrancaCancelada(a.pagamento_status));
  const marcadoPago = grupo.some(a => (a.pagamento_status || "").trim().toLowerCase() === "pago");
  const inconsistente = !primeiro || total == null || credito == null || montantes.includes(null)
    || (saldoBruto != null && saldoBruto < 0) || cvs.length > 1 || Boolean(cv && pg.length)
    || (!cv && marcadoPago && !pg.length);
  return {
    valor: total == null ? null : total / 100,
    recebido: recebido / 100, credito: (credito ?? 0) / 100,
    saldo: saldoBruto == null ? null : cancelado ? 0 : Math.max(0, saldoBruto) / 100,
    estado: inconsistente ? "conferir" : cancelado ? "cancelado" : saldoBruto === 0 ? "pago"
      : recebido > 0 || (credito ?? 0) > 0 ? "parcial" : "pendente",
    forma: formas(registros), convertido: Boolean(cv),
  };
}

export function resumirAvulso(
  valorOriginal: number | null | undefined, atendimentos: readonly AtendimentoFinanceiro[],
  pagamentoStatus?: string | null,
): ResumoFinanceiro {
  const total = centavos(valorOriginal);
  const pagos = atendimentos.filter(a => Boolean(a.forma_pagamento?.trim()));
  const montantes = pagos.map(a => centavos(a.valor));
  const recebido = montantes.reduce<number>((s, n) => s + (n ?? 0), 0);
  const saldo = total == null ? null : total - recebido;
  const cancelado = cobrancaCancelada(pagamentoStatus);
  const conferir = total == null || montantes.includes(null) || atendimentos.length > 1 || (saldo != null && saldo < 0);
  return {
    valor: total == null ? null : total / 100, recebido: recebido / 100, credito: 0,
    saldo: saldo == null ? null : cancelado ? 0 : Math.max(0, saldo) / 100,
    estado: conferir ? "conferir" : cancelado ? "cancelado" : saldo === 0 ? "pago" : recebido > 0 ? "parcial" : "pendente",
    forma: formas(pagos), convertido: false,
  };
}

// O fluxo legado não tem contrato comprovado para novas parcelas comuns.
export function validarRecebimentoLegado(valor: number, saldo: number | null, jaRecebido = false) {
  const n = centavos(valor);
  if (n == null || n <= 0 || Math.abs(valor * 100 - n) > 0.000001) return "Informe um valor positivo com até duas casas decimais.";
  if (saldo == null) return "Valor da cobrança a conferir. Não registre recebimento sem confirmar o valor original.";
  if (jaRecebido || n !== centavos(saldo)) return "Parcelas, descontos e ajustes deste recebimento exigem o fluxo financeiro transacional ainda pendente. O valor original será preservado; não registre uma quitação por valor diferente.";
  return null;
}
