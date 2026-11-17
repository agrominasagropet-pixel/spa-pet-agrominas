"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { associarDadosAgenda, CAMPOS_PETS_AGENDA, confirmarLeituraAgenda, ErroLeituraAgenda } from "@/lib/agenda-dados";
import { paginar } from "@/lib/paginacao";
import { resumirCiclo, resumirAvulso, type ConversaoFinanceira, type ParcelaConversao } from "@/lib/financeiro";
import MenuLateral from "@/app/components/MenuLateral";

type Turno = "Manhã" | "Tarde";
type Frequencia = "Avulso" | "Quinzenal" | "Mensal";

type Cliente = {
  id: string;
  nome: string;
  whatsapp: string | null;
  telefone: string | null;
};

type Pet = {
  id: string;
  nome: string;
  cliente_id: string;
  sexo: string | null;
  raca: string | null;
  whatsapp: string;
  tutorNome: string;
};

type Servico = {
  id: string;
  nome: string;
  preco: number | null;
  duracao_minutos: number | null;
};

type Atendimento = {
  id: string;
  agendamento_id: string | null;
  pet_id: string | null;
  data: string;
  valor: number | null;
  forma_pagamento: string | null;
};

type PagamentoPlano = {
  id: string;
  pet_id: string;
  ciclo: number;
  valor: number;
  forma_pagamento: string;
  data_pagamento: string;
};

type Agendamento = {
  id: string;
  pet_id: string;
  servico_id: string | null;
  data: string;
  horario: string | null;
  status: string | null;
  observacoes: string | null;
  valor_total: number | null;
  servico_nome: string | null;
  plano: string | null;
  numero_banho: number | null;
  ciclo: number | null;
  pagamento_status: string | null;
  forma_pagamento_plano: string | null;
  petNome?: string;
  tutorNome?: string;
  whatsapp?: string;
};

// Nomes padronizados apenas na interface; preserva IDs e dados históricos.
const NOMES_SERVICOS: Record<string, string> = {
  "Banho": "Banho Completo",
  "Banho + Tosa": "Banho com Tosa Completa",
  "Tosa higiênica": "Banho com Tosa Higiênica",
  "Banho + Tosa Higiênica": "Banho com Tosa Higiênica",
  "Banho + Tosa Completa": "Banho com Tosa Completa",
  "Tosa Máquina": "Tosa na Máquina",
  "Tosa Bebê": "Tosa Estilo Bebê",
  "Tosa Tesoura": "Tosa na Tesoura",
  "Tosa Raça": "Tosa Padrão da Raça",
  "Acerto de Saia": "Acabamento de Saia",
  "Carding": "Remoção de Subpelo (Carding)",
  "Trimming": "Trimming — Acabamento Técnico",
  "Corte/Lixamento Unhas": "Corte e Lixamento de Unhas",
  "Botinha": "Acabamento Estilo Botinha",
  "Arredondamento Patinha": "Acabamento de Patinhas",
};

function nomeServicoPadronizado(nome: string | null | undefined) {
  const original = (nome || "").trim();
  if (!original) return "Banho e tosa";
  const chave = Object.keys(NOMES_SERVICOS).find(
    (item) => item.toLocaleLowerCase("pt-BR") === original.toLocaleLowerCase("pt-BR")
  );
  return chave ? NOMES_SERVICOS[chave] : original;
}

function escaparHTMLComprovante(valor: string) {
  return valor.replace(/[&<>"']/g, (caractere) => {
    const mapa: Record<string, string> = {
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    };
    return mapa[caractere];
  });
}

function formatarDataLocal(data: string) {
  if (!data) return "";

  const partes = data.split("-");

  return partes.length === 3
    ? `${partes[2]}/${partes[1]}/${partes[0]}`
    : data;
}

function formatarHorario(horario: string | null | undefined) {
  if (!horario) return "08:00";

  const partes = horario.trim().split(":");

  if (partes.length >= 2) {
    return `${partes[0].padStart(2, "0")}:${partes[1].padStart(2, "0")}`;
  }

  return horario;
}

function obterDataLocal() {
  const hoje = new Date();

  return `${hoje.getFullYear()}-${String(
    hoje.getMonth() + 1
  ).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
}

function formatarValor(valor: number | null | undefined) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function normalizarTelefone(numero: string) {
  const digitos = (numero || "").replace(/\D/g, "");

  if (!digitos) return "";

  // Evita adicionar o código do Brasil duas vezes.
  return digitos.startsWith("55") ? digitos : `55${digitos}`;
}

const NOME_JANELA_WHATSAPP = "AGROMINAS_WHATSAPP";

function obterArtigoPet(sexo: string | null) {
  const valor = (sexo || "").toLowerCase().trim();

  return ["fêmea", "femea", "f"].includes(valor) ? "a" : "o";
}

function ajustarServicoPorBanho(servico: string | null | undefined, plano: string | null | undefined, numero: number) {
  const nome = nomeServicoPadronizado(servico);
  if ((plano === "Mensal" || plano === "Quinzenal") && numero > 1) {
    return nome.replace(/banho\s*(?:\+|com)\s*tosa\s*higi[eê]nica/gi, "Banho");
  }
  return nome;
}

function abrirMensagemWhatsApp(numero: string, mensagem: string) {
  const telefone = normalizarTelefone(numero);
  if (!telefone) { alert("Tutor sem WhatsApp cadastrado."); return; }
  const parametros = new URLSearchParams({ phone: telefone, text: mensagem });
  const janela = window.open(`https://web.whatsapp.com/send/?${parametros.toString()}`, NOME_JANELA_WHATSAPP);
  if (janela) janela.focus();
  else alert("Permita pop-ups para abrir o WhatsApp.");
}

function obterIdentificacaoBanho(agendamento: Agendamento) {
  if (!agendamento.numero_banho) return "";

  let texto = `${agendamento.numero_banho}º banho`;

  if (
    agendamento.plano &&
    agendamento.plano !== "Avulso" &&
    agendamento.ciclo &&
    agendamento.ciclo > 1
  ) {
    texto += ` • Ciclo ${agendamento.ciclo}`;
  }

  return texto;
}

function adicionarDias(data: string, quantidade: number) {
  const [ano, mes, dia] = data.split("-").map(Number);
  const novaData = new Date(ano, mes - 1, dia);

  novaData.setDate(novaData.getDate() + quantidade);

  return `${novaData.getFullYear()}-${String(
    novaData.getMonth() + 1
  ).padStart(2, "0")}-${String(novaData.getDate()).padStart(2, "0")}`;
}

function diferencaDias(origem: string, destino: string) {
  const [a1, m1, d1] = origem.split("-").map(Number);
  const [a2, m2, d2] = destino.split("-").map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000);
}

function statusNormalizado(status: string | null | undefined) {
  return (status || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function estaCancelado(agendamento: Agendamento) {
  return ["cancelado", "cancelada"].includes(statusNormalizado(agendamento.status));
}

function dataValida(data: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(data) && adicionarDias(data, 0) === data;
}

function abrirWhatsApp(
  tipo: "lembrete" | "pronto",
  numero: string,
  petNome: string,
  tutorNome: string,
  horario: string,
  sexo: string | null,
  servicoNome: string,
  data: string
) {
  const telefone = normalizarTelefone(numero);

  if (!telefone) {
    alert("Este cliente não possui WhatsApp cadastrado.");
    return;
  }

  const patas = String.fromCodePoint(0x1F43E);
  const cachorro = String.fromCodePoint(0x1F436);
  const coracao = String.fromCodePoint(0x1F49A);
  const calendario = String.fromCodePoint(0x1F4C5);
  const relogio = String.fromCodePoint(0x23F0);
  const banho = String.fromCodePoint(0x1F6C1);
  const sorriso = String.fromCodePoint(0x1F60A);

  const nomeTutor = (tutorNome || "cliente").trim();
  const nomePet = (petNome || "Pet").trim();
  const horarioFormatado = formatarHorario(horario);
  const dataFormatada = formatarDataLocal(data);
  const artigo = obterArtigoPet(sexo);

  const mensagem =
    tipo === "lembrete"
      ? [
          `Olá, ${nomeTutor}! ${patas}`,
          "",
          `Passando para lembrar do agendamento d${artigo} ${nomePet} no SPA PET AGROMINAS. ${cachorro}${coracao}`,
          "",
          `${calendario} Data: ${dataFormatada}`,
          `${relogio} Horário: ${horarioFormatado}`,
          `${banho} Serviço: ${servicoNome}`,
          "",
          `Esperamos vocês! ${sorriso}`,
        ].join("\n")
      : [
          `Olá, ${nomeTutor}! ${patas}`,
          "",
          `Temos uma ótima notícia! ${sorriso}`,
          "",
          `${artigo === "a" ? "A" : "O"} ${nomePet} já está ${artigo === "a" ? "prontinha" : "prontinho"} no SPA PET AGROMINAS. ${cachorro}${coracao}`,
          "",
          `O banho e tosa foram concluídos e ${artigo === "a" ? "ela" : "ele"} já pode ser ${artigo === "a" ? "retirada" : "retirado"}.`,
          "",
          `Obrigado pela confiança! ${patas}`,
        ].join("\n");

  // URLSearchParams codifica a mensagem em UTF-8, incluindo os emojis.
  const parametros = new URLSearchParams({
    phone: telefone,
    text: mensagem,
  });
  const url = `https://web.whatsapp.com/send/?${parametros.toString()}`;

  // Reutiliza a mesma janela do WhatsApp Web.
  const janela = window.open(url, NOME_JANELA_WHATSAPP);

  if (janela) {
    janela.focus();
  } else {
    alert("O navegador bloqueou a janela do WhatsApp. Permita pop-ups para este site e tente novamente.");
  }
}

function avisarPetsProntos(numero: string, tutor: string, itens: { nome: string; sexo: string | null }[]) {
  const nomes = itens.map(item => item.nome);
  const lista = nomes.map(nome => `🐾 ${nome}`).join("\n");
  const feminino = itens.length === 1 && obterArtigoPet(itens[0].sexo) === "a";
  const todasFemeas = itens.length > 1 && itens.every(item => obterArtigoPet(item.sexo) === "a");
  const mensagem = [
    `Olá, ${tutor}! 🐾`, "",
    "Temos uma ótima notícia! 😊", "",
    nomes.length === 1 ? `${feminino ? "A" : "O"} ${nomes[0]} já está ${feminino ? "prontinha" : "prontinho"}! 🐶💚` : `${todasFemeas ? "Suas pets já estão prontinhas" : "Seus pets já estão prontinhos"}! 🐶💚`,
    nomes.length > 1 ? lista : "", "",
    "Todos os atendimentos foram concluídos e os pets já estão disponíveis para retirada.", "",
    "Obrigado pela confiança! 🐾", "SPA PET AGROMINAS"
  ].filter((linha, i, arr) => linha !== "" || arr[i - 1] !== "").join("\n");
  abrirMensagemWhatsApp(numero, mensagem);
}

  function abrirWhatsAppGrupo(
  numero: string,
  tutorNome: string,
  data: string,
  horario: string,
  itens: {
    petNome: string;
    servicoNome: string;
    sexo: string | null;
  }[]
) {
  const telefone = normalizarTelefone(numero);

  if (!telefone) {
    alert("Este cliente não possui WhatsApp cadastrado.");
    return;
  }

  const patas = String.fromCodePoint(0x1F43E);
  const cachorro = String.fromCodePoint(0x1F436);
  const coracao = String.fromCodePoint(0x1F49A);
  const calendario = String.fromCodePoint(0x1F4C5);
  const relogio = String.fromCodePoint(0x23F0);
  const sorriso = String.fromCodePoint(0x1F60A);

  const horarioFormatado = formatarHorario(horario || "08:00");
  const listaPets = itens
    .map((item) => `${patas} ${item.petNome} — ${item.servicoNome}`)
    .join("\n");

  const mensagem = [
    `Olá, ${(tutorNome || "cliente").trim()}! ${patas}`,
    "",
    `Passando para lembrar dos agendamentos no SPA PET AGROMINAS. ${cachorro}${coracao}`,
    "",
    `${calendario} Data: ${formatarDataLocal(data)}`,
    `${relogio} Horário: ${horarioFormatado}`,
    "",
    listaPets,
    "",
    `Esperamos vocês! ${sorriso}`,
  ].join("\n");

  // Codificação UTF-8 para preservar acentos, quebras de linha e emojis.
  const parametros = new URLSearchParams({
    phone: telefone,
    text: mensagem,
  });
  const url = `https://web.whatsapp.com/send/?${parametros.toString()}`;

  const janela = window.open(url, NOME_JANELA_WHATSAPP);

  if (janela) {
    janela.focus();
  } else {
    alert("O navegador bloqueou a janela do WhatsApp. Permita pop-ups para este site e tente novamente.");
  }
}
// Impressão térmica AGROMINAS: valores de ciclos só são exibidos quando confiáveis.
type DadosPagamentoComprovante = {
  pago: boolean;
  forma: string | null;
  valor?: number | null;
  recebido?: number;
  credito?: number;
  saldo?: number | null;
  texto?: string;
};

type ExtraComprovante = { id: string; agendamento_id?: string; valor: number; pagamento_status: string; nome_servico: string };

type ItemComprovanteGrupo = {
  petNome: string;
  servicoNome: string;
  identificacao: string;
  valor: number | null;
  pago: boolean;
  forma: string | null;
  plano: boolean;
  tipoPlano: string | null;
  ciclo: number | null;
  petId: string;
  recebido?: number;
  credito?: number;
  saldo?: number | null;
  texto?: string;
  extras?: ExtraComprovante[];
};

function valorComprovante(valor: number | null | undefined) {
  return valor !== null && valor !== undefined && Number.isFinite(Number(valor))
    ? formatarValor(Number(valor))
    : "A CONFERIR";
}

function documentoComprovante(conteudo: string, titulo: string) {
  const janela = window.open("", "_blank", "width=420,height=740");
  if (!janela) {
    alert("Não foi possível abrir a impressão. Permita pop-ups e tente novamente.");
    return;
  }
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8" />
    <title>${escaparHTMLComprovante(titulo)} - SPA PET AGROMINAS</title>
    <style>
      @page { size: 80mm auto; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body { width: 80mm; padding: 5mm 4mm 7mm; color: #000; background: #fff;
             font: 11px/1.45 Arial, Helvetica, sans-serif; overflow-wrap: anywhere; }
      .logo-impressao { display: block; width: 47mm; max-height: 42mm; height: auto; object-fit: contain; margin: 0 auto 2mm; }
      .marca { text-align: center; font-size: 15px; font-weight: 900; letter-spacing: .6px; }
      .documento { text-align: center; font-size: 11px; font-weight: 800; margin: 10px 0; }
      .separador { border: 0; border-top: 1px dashed #000; margin: 10px 0; }
      .linha { display: flex; gap: 5px; margin: 5px 0; align-items: baseline; }
      .linha .rotulo { flex-shrink: 0; font-weight: 700; }
      .linha .valor { text-align: left; min-width: 0; }
      .pet { padding: 7px 0; border-bottom: 1px dashed #888; break-inside: avoid; }
      .pet:last-child { border-bottom: 0; }
      .nome-pet { font-size: 13px; font-weight: 800; }
      .detalhe { font-size: 10px; margin-top: 3px; }
      .etiqueta { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; }
      .montante { text-align: center; font-size: 21px; font-weight: 900; margin: 2px 0 5px; }
      .pagamento { border: 1.5px solid #000; padding: 7px; text-align: center; margin: 9px 0; }
      .pagamento strong { display: block; font-size: 13px; letter-spacing: .6px; }
      .observacao { font-size: 9px; line-height: 1.4; margin-top: 6px; }
      .rodape { text-align: center; font-size: 10px; margin-top: 16px; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    </style></head><body>
    <img class="logo-impressao" src="/logo-agrominas-impressao.png" alt="Logo AGROMINAS" />
    <div class="marca">SPA PET AGROMINAS</div>
    <hr class="separador" />
    <div class="documento">${escaparHTMLComprovante(titulo)}</div>
    ${conteudo}
    <hr class="separador" />
    <div class="rodape">Obrigado pela confiança!<br />SPA PET AGROMINAS</div>
    </body></html>`;
  janela.document.open();
  janela.document.write(html);
  janela.document.close();
  janela.focus();
  // Aguarda a logo carregar antes de abrir a janela de impressão.
  const imagemLogo = janela.document.querySelector<HTMLImageElement>(".logo-impressao");
  let impressaoIniciada = false;
  const iniciarImpressao = () => {
    if (impressaoIniciada || janela.closed) return;
    impressaoIniciada = true;
    janela.focus();
    janela.print();
  };
  if (imagemLogo?.complete) {
    setTimeout(iniciarImpressao, 250);
  } else if (imagemLogo) {
    imagemLogo.addEventListener("load", () => setTimeout(iniciarImpressao, 250), { once: true });
    imagemLogo.addEventListener("error", () => {
      iniciarImpressao();
    }, { once: true });
  } else {
    setTimeout(iniciarImpressao, 250);
  }
}

function imprimirComprovante(
  agendamento: Agendamento,
  servicoNome: string,
  pagamento: DadosPagamentoComprovante,
  extras: ExtraComprovante[] = []
) {
  const plano = Boolean(agendamento.plano && agendamento.plano !== "Avulso");
  // Nos planos desta Agenda, valor_total representa o pacote inteiro,
  // repetido em cada agendamento do mesmo ciclo.
  const valor = pagamento.valor === undefined ? agendamento.valor_total : pagamento.valor;
  const nome = escaparHTMLComprovante;
  const identificacao = obterIdentificacaoBanho(agendamento);
  const extrasAtivos = extras.filter(extra => extra.pagamento_status !== "Cancelado");
  const extrasRecebidos = extrasAtivos.filter(extra => extra.pagamento_status === "Pago").reduce((total, extra) => total + Number(extra.valor), 0);
  const extrasPendentes = extrasAtivos.filter(extra => extra.pagamento_status !== "Pago").reduce((total, extra) => total + Number(extra.valor), 0);
  const dados = `
    <div class="linha"><span class="rotulo">Tutor</span><span class="valor">${nome(agendamento.tutorNome || "Tutor não informado")}</span></div>
    <div class="linha"><span class="rotulo">Pet</span><span class="valor">${nome(agendamento.petNome || "Pet")}</span></div>
    <div class="linha"><span class="rotulo">Data</span><span class="valor">${nome(formatarDataLocal(agendamento.data))}</span></div>
    <div class="linha"><span class="rotulo">Horário</span><span class="valor">${nome(formatarHorario(agendamento.horario))}</span></div>
    <hr class="separador" />
    <div class="nome-pet">${nome(agendamento.petNome || "Pet")}</div>
    <div>${nome(servicoNome)}</div>
    ${plano ? `<div class="detalhe">Plano ${nome(agendamento.plano || "")} ${agendamento.ciclo !== null ? `• Ciclo ${agendamento.ciclo}` : ""}</div>` : `<div class="detalhe">Atendimento avulso</div>`}
    ${identificacao ? `<div class="detalhe">${nome(identificacao)}</div>` : ""}
    <hr class="separador" />
    <div class="etiqueta" style="text-align:center">${plano ? "VALOR TOTAL DO CICLO" : "VALOR DO ATENDIMENTO"}</div>
    <div class="montante">${nome(valorComprovante(valor))}</div>
    <div class="linha"><span class="rotulo">VALORES JÁ PAGOS</span><span class="valor">${nome(valorComprovante(pagamento.recebido ?? (pagamento.pago ? valor : 0)))}</span></div>
    <div class="linha"><span class="rotulo">CRÉDITO AVULSO REGISTRADO</span><span class="valor">${nome(formatarValor(pagamento.credito ?? 0))}</span></div>
    <div class="linha"><span class="rotulo">${plano ? "SALDO DO PLANO" : "SALDO DO ATENDIMENTO"}</span><span class="valor">${nome(valorComprovante(pagamento.saldo === undefined ? (pagamento.pago ? 0 : valor) : pagamento.saldo))}</span></div>
    ${extrasAtivos.map(extra => `<div class="linha"><span class="rotulo">Extra: ${nome(extra.nome_servico)} (${nome(extra.pagamento_status)})</span><span class="valor">${nome(formatarValor(extra.valor))}</span></div>`).join("")}
    <div class="linha"><span class="rotulo">EXTRAS RECEBIDOS</span><span class="valor">${nome(formatarValor(extrasRecebidos))}</span></div>
    <div class="linha"><span class="rotulo">EXTRAS PENDENTES</span><span class="valor">${nome(formatarValor(extrasPendentes))}</span></div>
    <div class="pagamento"><strong>${pagamento.pago ? "PAGO" : "PENDENTE / A CONFERIR"}</strong>${pagamento.pago && pagamento.forma ? `<span>${nome(pagamento.forma)}</span>` : ""}</div>
    ${plano ? `<div class="observacao">O valor indicado refere-se ao ciclo completo do plano, não apenas ao banho desta data.${valor === null || valor === undefined ? " Confira o valor total do plano no cadastro antes de cobrar." : ""}</div>` : ""}`;
  documentoComprovante(dados, "COMPROVANTE DE ATENDIMENTO");
}

function imprimirComprovanteGrupo(
  tutorNome: string,
  data: string,
  horario: string,
  itens: ItemComprovanteGrupo[]
) {
  if (itens.length === 0) return;
  const nome = escaparHTMLComprovante;
  const ciclosContabilizados = new Set<string>();
  let totalPago = 0;
  let totalPendente = 0;
  let totalCredito = 0;
  let totalGeral = 0;
  const extrasContabilizados = new Set<string>();
  let faltamValores = false;
  const linhas = itens.map((item, indice) => {
    // Não agrupar ciclos antigos sem identificador: podem ser ciclos diferentes.
    const chave = item.plano && item.ciclo !== null
      ? `${item.petId}|${item.ciclo}` : `item-${indice}`;
    const repetido = ciclosContabilizados.has(chave);
    ciclosContabilizados.add(chave);
    if (!repetido) {
      if (item.valor === null || !Number.isFinite(item.valor) || item.texto === "A CONFERIR" || item.saldo === null) faltamValores = true;
      totalGeral += Number(item.valor || 0);
      totalPago += item.recebido ?? (item.pago ? Number(item.valor || 0) : 0);
      totalCredito += item.credito ?? 0;
      totalPendente += item.saldo === undefined ? (item.pago ? 0 : Number(item.valor || 0)) : Number(item.saldo || 0);
    }
    const extras = (item.extras || []).filter(extra => extra.pagamento_status !== "Cancelado" && !extrasContabilizados.has(extra.id));
    for (const extra of extras) {
      extrasContabilizados.add(extra.id);
      totalGeral += Number(extra.valor);
      if (extra.pagamento_status === "Pago") totalPago += Number(extra.valor);
      else totalPendente += Number(extra.valor);
    }
    const tipo = item.plano ? `Plano ${item.tipoPlano || ""}${item.ciclo !== null ? ` • Ciclo ${item.ciclo}` : ""}` : "Atendimento avulso";
    return `<div class="pet">
      <div class="nome-pet">${nome(item.petNome)}</div>
      <div>${nome(item.servicoNome)}</div>
      <div class="detalhe">${nome(tipo)}</div>
      ${item.identificacao ? `<div class="detalhe">${nome(item.identificacao)}</div>` : ""}
      <div class="linha"><span class="rotulo">${item.plano ? "Total do ciclo" : "Valor"}</span><span class="valor"><strong>${nome(valorComprovante(item.valor))}</strong></span></div>
      <div class="detalhe"><strong>${item.pago ? "PAGO" : "PENDENTE"}</strong>${item.pago && item.forma ? ` • ${nome(item.forma)}` : ""}</div>
      ${repetido ? `<div class="observacao">Mesmo ciclo: valor contabilizado uma única vez.</div>` : ""}
      ${extras.map(extra => `<div class="detalhe">Extra: ${nome(extra.nome_servico)} • ${nome(extra.pagamento_status)} • ${nome(formatarValor(extra.valor))}</div>`).join("")}
    </div>`;
  }).join("");
  const dados = `
    <div class="linha"><span class="rotulo">Tutor</span><span class="valor">${nome(tutorNome)}</span></div>
    <div class="linha"><span class="rotulo">Data</span><span class="valor">${nome(formatarDataLocal(data))}</span></div>
    <div class="linha"><span class="rotulo">Horário</span><span class="valor">${nome(formatarHorario(horario))}</span></div>
    <div class="linha"><span class="rotulo">Pets</span><span class="valor">${itens.length}</span></div>
    <hr class="separador" />
    ${linhas}
    <hr class="separador" />
    <div class="linha"><span class="rotulo">VALORES JÁ PAGOS</span><span class="valor"><strong>${formatarValor(totalPago)}</strong></span></div>
    <div class="linha"><span class="rotulo">CRÉDITO AVULSO REGISTRADO</span><span class="valor"><strong>${formatarValor(totalCredito)}</strong></span></div>
    <div class="linha"><span class="rotulo">TOTAL GERAL</span><span class="valor"><strong>${faltamValores ? "A CONFERIR" : formatarValor(totalGeral)}</strong></span></div>
    <div class="etiqueta" style="text-align:center;margin-top:10px">TOTAL PENDENTE${faltamValores ? " CONHECIDO" : ""}</div>
    <div class="montante">${formatarValor(totalPendente)}</div>
    ${faltamValores ? `<div class="observacao"><strong>ATENÇÃO:</strong> Há valores de ciclos/serviços a conferir. O total acima está incompleto; não utilize como valor final de cobrança.</div>` : ""}
    <div class="observacao">Planos: os valores são referentes ao ciclo completo e cada ciclo identificado é somado apenas uma vez.</div>`;
  documentoComprovante(dados, "COMPROVANTE CONJUNTO");
}

export default function AgendaPage() {
  const [, setClientes] = useState<Cliente[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [pagamentosPlanos, setPagamentosPlanos] = useState<PagamentoPlano[]>([]);
  const [conversoes, setConversoes] = useState<ConversaoFinanceira[]>([]);
  const [parcelas, setParcelas] = useState<ParcelaConversao[]>([]);
  const [extrasComprovantes, setExtrasComprovantes] = useState<ExtraComprovante[]>([]);
  const [servicoExtraId, setServicoExtraId] = useState("");
  const [valorExtra, setValorExtra] = useState("");
  const [salvandoExtra, setSalvandoExtra] = useState(false);
  const [renovacao, setRenovacao] = useState<Agendamento | null>(null);
  const [renovacoesGrupo, setRenovacoesGrupo] = useState<Agendamento[]>([]);
  const [dataInicioRenovacao, setDataInicioRenovacao] = useState("");
  const [horarioRenovacao, setHorarioRenovacao] = useState("08:00");
  const [salvandoRenovacao, setSalvandoRenovacao] = useState(false);
  const [erroExtra, setErroExtra] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState("");
  const [mesAtual, setMesAtual] = useState(new Date());
  const [dataSelecionada, setDataSelecionada] = useState(obterDataLocal());

  const [modalAgendamento, setModalAgendamento] = useState(false);
  const [agendamentoSelecionado, setAgendamentoSelecionado] =
    useState<Agendamento | null>(null);

  const [petSelecionado, setPetSelecionado] = useState("");
  const [buscaPet, setBuscaPet] = useState("");
  const [mostrarSugestoesPet, setMostrarSugestoesPet] = useState(false);
  const [frequenciaAgendamento, setFrequenciaAgendamento] =
    useState<Frequencia>("Avulso");
  const [servicoSelecionado, setServicoSelecionado] = useState("");
  const [dataAgendamento, setDataAgendamento] = useState("");
  const [horarioAgendamento, setHorarioAgendamento] = useState("08:00");
  const [observacoes, setObservacoes] = useState("");
  const [valorAgendamento, setValorAgendamento] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [salvandoValor, setSalvandoValor] = useState(false);
  const registroAtendimentoEmAndamento = useRef(false);
  const [modoReagendamento, setModoReagendamento] = useState<"unico" | "ciclo">("unico");
  const [buscaAgenda, setBuscaAgenda] = useState("");
  const [perfilUsuario, setPerfilUsuario] = useState<"admin" | "operacional" | null>(null);
  const ehAdmin = perfilUsuario === "admin";

  useEffect(() => {
    void carregarDados();
  }, []);

  async function carregarDados() {
    setCarregando(true);
    setErroCarregamento("");

    try {
      const { data: usuarioR, error: erroUsuario } = await supabase.auth.getUser();
      if (erroUsuario || !usuarioR.user) throw new Error("Faça login para acessar a Agenda.");
      const { data: perfilR, error: erroPerfil } = await supabase
        .from("perfis").select("perfil").eq("id", usuarioR.user.id).single();
      if (erroPerfil || !["admin", "operacional"].includes(perfilR?.perfil || "")) {
        throw new Error("Seu perfil não está autorizado a acessar a Agenda.");
      }
      const administrador = perfilR!.perfil === "admin";
      setPerfilUsuario(administrador ? "admin" : "operacional");

      const [
        clientesR,
        petsR,
        servicosR,
        agendamentosR,
        atendimentosR,
        pagamentosR,
        conversoesR,
        parcelasR,
        extrasR,
      ] = await Promise.all([
        paginar<Cliente>((inicio, fim) => supabase
          .from("clientes")
          .select("id, nome, whatsapp, telefone")
          .order("nome").order("id").range(inicio, fim), "clientes"),
        paginar<Pick<Pet, "id" | "nome" | "cliente_id" | "sexo" | "raca">>((inicio, fim) => supabase
          .from("pets")
          .select(CAMPOS_PETS_AGENDA)
          .order("nome").order("id").range(inicio, fim), "pets"),
        paginar<Servico>((inicio, fim) => supabase
          .from("servicos")
          .select("id, nome, preco, duracao_minutos")
          .order("nome").order("id").range(inicio, fim), "serviços"),
        paginar<Agendamento>((inicio, fim) => supabase
          .from("agendamentos")
          .select(
            "id, pet_id, servico_id, data, horario, status, observacoes, valor_total, servico_nome, plano, numero_banho, ciclo, pagamento_status, forma_pagamento_plano"
          )
          .order("data")
          .order("horario").order("id").range(inicio, fim), "agendamentos"),
        administrador
          ? paginar<Atendimento>((inicio, fim) => supabase
              .from("atendimentos")
              .select("id, agendamento_id, pet_id, data, valor, forma_pagamento")
              .order("data").order("id").range(inicio, fim), "atendimentos")
          : paginar<Pick<Atendimento, "id" | "agendamento_id" | "pet_id" | "data">>((inicio, fim) => supabase
              .from("atendimentos")
              .select("id, agendamento_id, pet_id, data")
              .order("data").order("id").range(inicio, fim), "atendimentos"),
        administrador
          ? paginar<PagamentoPlano>((inicio, fim) => supabase.from("pagamentos_planos")
              .select("id, pet_id, ciclo, valor, forma_pagamento, data_pagamento")
              .order("data_pagamento").order("id").range(inicio, fim), "pagamentos")
          : Promise.resolve({ data: [] as PagamentoPlano[], error: null }),
        administrador ? paginar<ConversaoFinanceira>((inicio, fim) => supabase.from("conversoes_avulso_plano")
          .select("id,pet_id,ciclo,valor_plano,credito_avulso").order("id").range(inicio, fim), "conversões")
          : Promise.resolve({ data: [] as ConversaoFinanceira[], error: null }),
        administrador ? paginar<ParcelaConversao>((inicio, fim) => supabase.from("recebimentos_parciais_planos")
          .select("id,conversao_id,valor,forma_pagamento").order("id").range(inicio, fim), "parcelas")
          : Promise.resolve({ data: [] as ParcelaConversao[], error: null }),
        administrador ? paginar<ExtraComprovante>((inicio, fim) => supabase.from("servicos_extras_agendamento")
          .select("id,agendamento_id,nome_servico,valor,pagamento_status").order("id").range(inicio, fim), "extras")
          : Promise.resolve({ data: [] as ExtraComprovante[], error: null }),
      ]);

      for (const [resposta, entidade] of [
        [clientesR, "clientes"], [petsR, "pets"], [servicosR, "serviços"],
        [agendamentosR, "agendamentos"], [atendimentosR, "atendimentos"],
        [pagamentosR, "pagamentos"],
        [conversoesR, "conversões"], [parcelasR, "parcelas"], [extrasR, "extras"],
      ] as const) {
        confirmarLeituraAgenda(resposta, entidade);
      }

      const listaClientes = (clientesR.data || []) as Cliente[];
      const listaPetsBanco = petsR.data || [];
      const listaServicos = (servicosR.data || []) as Servico[];
      const listaAgendamentos = (agendamentosR.data || []) as Agendamento[];
      const listaAtendimentos: Atendimento[] = (atendimentosR.data || []).map(
        (item) => ({
          id: item.id,
          agendamento_id: item.agendamento_id,
          pet_id: item.pet_id,
          data: item.data,
          valor: "valor" in item ? (item.valor as number | null) : null,
          forma_pagamento:
            "forma_pagamento" in item
              ? (item.forma_pagamento as string | null)
              : null,
        })
      );
      const listaPagamentos = (pagamentosR.data || []) as PagamentoPlano[];

      const { petsFormatados, agendamentosFormatados } = associarDadosAgenda(
        listaClientes, listaPetsBanco, listaAgendamentos,
      );

      setClientes(listaClientes);
      setPets(petsFormatados);
      setServicos(listaServicos);
      setAgendamentos(agendamentosFormatados);
      setAtendimentos(listaAtendimentos);
      setPagamentosPlanos(listaPagamentos);
      setConversoes(conversoesR.data);
      setParcelas(parcelasR.data);
      setExtrasComprovantes(extrasR.data);
    } catch (erro) {
      setPerfilUsuario(null);
      setClientes([]); setPets([]); setServicos([]);
      setAgendamentos([]); setAtendimentos([]); setPagamentosPlanos([]);
      setConversoes([]); setParcelas([]); setExtrasComprovantes([]);
      console.error("Erro ao carregar a agenda:", erro);
      setErroCarregamento(erro instanceof ErroLeituraAgenda
        ? erro.message
        : "Não foi possível carregar a Agenda. Verifique sua sessão, conexão e permissões de leitura e tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  function obterNomeServico(agendamento: Agendamento) {
    return nomeServicoPadronizado(
      agendamento.servico_nome ||
      servicos.find((item) => item.id === agendamento.servico_id)?.nome
    );
  }

  function obterTurno(horario: string | null): Turno {
    return formatarHorario(horario) < "13:30" ? "Manhã" : "Tarde";
  }

  function ehPlano(agendamento: Agendamento) {
    return Boolean(
      agendamento.plano &&
        agendamento.plano !== "Avulso" &&
        agendamento.ciclo !== null &&
        agendamento.ciclo !== undefined
    );
  }

  function obterPagamentoDoCiclo(agendamento: Agendamento) {
    const resumo = ehPlano(agendamento)
      ? resumirCiclo(agendamentos.filter(item => item.pet_id === agendamento.pet_id && item.ciclo === agendamento.ciclo), pagamentosPlanos, conversoes, parcelas)
      : resumirAvulso(agendamento.valor_total, atendimentos.filter(item => item.agendamento_id === agendamento.id), agendamento.pagamento_status);
    const textos = { pago: "PAGO", pendente: "PENDENTE", parcial: "PARCIAL", cancelado: "CANCELADO", conferir: "A CONFERIR" };
    return {
      ...resumo,
      pago: resumo.estado === "pago",
      texto: textos[resumo.estado],
      saldo: resumo.estado === "conferir" ? null : resumo.saldo,
    };
  }

  // Renovação manual, atômica no banco, sem alterar o histórico dos ciclos anteriores.
  function podeRenovarCiclo(ag: Agendamento) {
    if (estaCancelado(ag) || !ehPlano(ag) || ag.ciclo === null) return false;
    const quantidade = ag.plano === "Quinzenal" ? 2 : ag.plano === "Mensal" ? 4 : 0;
    if (!quantidade || Number(ag.numero_banho) !== quantidade) return false;
    const ciclos = agendamentos.filter(a => a.pet_id === ag.pet_id && a.ciclo !== null && !estaCancelado(a));
    if (Number(ag.ciclo) !== Math.max(0, ...ciclos.map(a => Number(a.ciclo) || 0))) return false;
    const doCiclo = ciclos.filter(a => Number(a.ciclo) === Number(ag.ciclo));
    return doCiclo.every(estaConcluido) && Array.from({length: quantidade}, (_, i) => i + 1)
      .every(n => doCiclo.some(a => Number(a.numero_banho) === n && estaConcluido(a)));
  }

  function abrirRenovacaoGrupo(grupo: GrupoTutor) {
    const elegiveis = grupo.agendamentos.filter(podeRenovarCiclo);
    const unicos = elegiveis.filter((a, i) => elegiveis.findIndex(b => b.pet_id === a.pet_id) === i);
    if (!unicos.length) return;
    const primeiro = unicos[0];
    setRenovacoesGrupo(unicos);
    setRenovacao(primeiro);
    setDataInicioRenovacao(adicionarDias(primeiro.data, primeiro.plano === "Quinzenal" ? 14 : 7));
    setHorarioRenovacao(formatarHorario(primeiro.horario) < "13:30" ? "08:00" : "13:30");
  }

  async function confirmarRenovacao() {
    if (!renovacao || salvandoRenovacao || !perfilUsuario) return;
    const selecionados = renovacoesGrupo.length ? renovacoesGrupo : [renovacao];
    if (!selecionados.every(podeRenovarCiclo)) { alert("Conclua os banhos dos ciclos atuais antes de renovar."); return; }
    if (!dataValida(dataInicioRenovacao) || !["08:00", "13:30"].includes(horarioRenovacao)) {
      alert("Informe data e turno válidos."); return;
    }
    const planos = selecionados.map(ag => ({
      ag, ciclo: Number(ag.ciclo) + 1,
      datas: Array.from({ length: ag.plano === "Quinzenal" ? 2 : 4 }, (_, i) =>
        adicionarDias(dataInicioRenovacao, i * (ag.plano === "Quinzenal" ? 14 : 7)))
    }));
    if (planos.some(item => dataInicioRenovacao <= item.ag.data)) {
      alert("O novo ciclo precisa começar depois do último banho do ciclo anterior."); return;
    }
    const previa = planos.map(item => `${item.ag.petNome || "Pet"} — ${item.ag.plano} (ciclo ${item.ciclo})\n` +
      item.datas.map((data, i) => `${i + 1}º banho: ${formatarDataLocal(data)} às ${horarioRenovacao}`).join("\n")).join("\n\n");
    if (!window.confirm(`Confirmar renovação?\n\n${previa}\n\nO pagamento ficará pendente.`)) return;
    setSalvandoRenovacao(true);
    try {
      for (const item of planos) {
        const { data: existentes, error } = await supabase.from("agendamentos")
          .select("id, ciclo, data, numero_banho, status").eq("pet_id", item.ag.pet_id);
        if (error) throw error;
        const ativos = (existentes || []).filter(a => !["cancelado", "cancelada"].includes(statusNormalizado(a.status)));
        if (ativos.some(a => a.ciclo !== null && Number(a.ciclo) >= item.ciclo))
          throw new Error(`Já existe ciclo posterior para ${item.ag.petNome}.`);
        if (ativos.some(a => item.datas.includes(a.data)))
          throw new Error(`Já existe banho agendado nessas datas para ${item.ag.petNome}.`);
        const origem = ativos.filter(a => Number(a.ciclo) === Number(item.ag.ciclo));
        const concluido = (a: typeof origem[number]) => ["concluido", "finalizado"].includes(statusNormalizado(a.status)) ||
          atendimentos.some(at => at.agendamento_id === a.id);
        if (origem.some(a => !concluido(a)) ||
          !item.datas.every((_, i) => origem.some(a => Number(a.numero_banho) === i + 1 && concluido(a))))
          throw new Error(`O ciclo de ${item.ag.petNome} não está completamente concluído.`);
      }
      const registros = planos.flatMap(item => {
        const primeiro = agendamentos.find(a => a.pet_id === item.ag.pet_id && a.ciclo === item.ag.ciclo && a.numero_banho === 1);
        const servicoBase = primeiro?.servico_nome || item.ag.servico_nome ||
          servicos.find(s => s.id === item.ag.servico_id)?.nome || null;
        const valor = primeiro?.valor_total ?? item.ag.valor_total;
        return item.datas.map((data, i) => ({
          pet_id: item.ag.pet_id, servico_id: item.ag.servico_id,
          servico_nome: ajustarServicoPorBanho(servicoBase, item.ag.plano, i + 1),
          observacoes: item.ag.observacoes, valor_total: valor, data,
          horario: horarioRenovacao, status: "Agendado", plano: item.ag.plano,
          numero_banho: i + 1, ciclo: item.ciclo,
          pagamento_status: "Pendente", forma_pagamento_plano: null
        }));
      });
      const { data: inseridos, error } = await supabase.rpc("renovar_ciclos_agrominas", {
        p_registros: registros, p_atualizacao_pet: null
      });
      if (error) throw error;
      if (Number(inseridos) !== registros.length) throw new Error("Não foi possível confirmar todos os registros. Confira a Agenda.");
      setRenovacao(null);
      setRenovacoesGrupo([]);
      await carregarDados();
      alert(`${planos.length} ciclo(s) renovado(s)! ${registros.length} banhos agendados.`);
      const telefone = renovacao.whatsapp || "";
      if (telefone && window.confirm("Deseja enviar as novas datas pelo WhatsApp?")) {
        abrirMensagemWhatsApp(telefone, `Olá! Os novos banhos foram agendados no SPA PET AGROMINAS.\n\n${previa}\n\nO pagamento do novo ciclo está pendente.`);
      }
    } catch (erro) {
      console.error("Erro na renovação:", erro);
      alert(erro instanceof Error ? erro.message : "Não foi possível renovar o ciclo.");
      await carregarDados();
    } finally { setSalvandoRenovacao(false); }
  }

  function banhosDoMesmoCiclo(ag: Agendamento) {
    if (!ehPlano(ag)) return ag.plano && ag.plano !== "Avulso" ? (identificarCiclo(ag) || []) : [ag];
    return agendamentos.filter(a => a.pet_id === ag.pet_id &&
      a.plano === ag.plano && a.ciclo === ag.ciclo && !estaCancelado(a));
  }

  function valorSugerido(ag: Agendamento) {
    if (ag.valor_total !== null && Number(ag.valor_total) > 0) return Number(ag.valor_total);
    const outros = banhosDoMesmoCiclo(ag).find(a =>
      a.valor_total !== null && Number(a.valor_total) > 0);
    if (outros) return Number(outros.valor_total);
    // Preço de serviço não é usado como preço de pacote: pode ser por banho.
    if (!ehPlano(ag)) {
      const preco = servicos.find(s => s.id === ag.servico_id)?.preco;
      if (preco !== null && preco !== undefined && preco > 0) return preco;
    }
    return ag.valor_total;
  }

  async function salvarCorrecaoValor(ag: Agendamento, textoDigitado: string) {
    if (!ehAdmin || salvandoValor || salvando) return false;
    const texto = textoDigitado.trim();
    const valor = Number(texto.replace(",", "."));
    if (!texto || !/^\d+(?:[,.]\d{1,2})?$/.test(texto) || !Number.isFinite(valor)) {
      alert("Informe um valor válido, por exemplo 180,00."); return false;
    }
    if (conversoes.some(c => c.pet_id === ag.pet_id && c.ciclo === ag.ciclo)) { alert("Este ciclo foi convertido. Confira o valor na página Pagamentos para preservar o crédito e as parcelas."); return false; }
    const registros = banhosDoMesmoCiclo(ag);
    if (registros.length === 0) { alert("Não foi possível identificar o ciclo."); return false; }
    const pago = ehPlano(ag) && pagamentosPlanos.some(p =>
      p.pet_id === ag.pet_id && p.ciclo === ag.ciclo);
    const aviso = pago
      ? "\nATENÇÃO: existe pagamento registrado. O valor do pagamento NÃO será alterado."
      : "\nOs pagamentos já registrados NÃO serão alterados.";
    if (!window.confirm(`Confirmar valor de ${formatarValor(valor)} para ${ag.petNome}?\n` +
      (ehPlano(ag) ? `Serão atualizados ${registros.length} banhos deste ciclo.` : "Será atualizado este agendamento.") + aviso)) return false;
    setSalvandoValor(true);
    try {
      const ids = registros.map(a => a.id);
      const resposta = await supabase.from("agendamentos")
        .update({ valor_total: valor }).in("id", ids).select("id");
      if (resposta.error) throw resposta.error;
      if (resposta.data?.length !== ids.length) throw new Error("Nem todos os registros foram confirmados. Atualize a Agenda e confira os valores.");
      const conjunto = new Set(ids);
      setAgendamentos(anteriores => anteriores.map(a =>
        conjunto.has(a.id) ? { ...a, valor_total: valor } : a));
      return true;
    } catch (erro: unknown) {
      console.error("Erro ao corrigir valor:", erro);
      alert((erro instanceof Error ? erro.message : null) || "Não foi possível corrigir o valor.");
      await carregarDados();
      return false;
    } finally { setSalvandoValor(false); }
  }

  function ehPrimeiroBanhoDeRenovacao(ag: Agendamento) {
    return !estaCancelado(ag) && ehPlano(ag) &&
      Number(ag.numero_banho) === 1;
  }

  function avisarRenovacaoWhatsApp(grupo: GrupoTutor) {
    const candidatos = grupo.agendamentos.filter(ehPrimeiroBanhoDeRenovacao);
    const unicos = candidatos.filter((a, i) => candidatos.findIndex(b => b.pet_id === a.pet_id) === i);
    if (!unicos.length) return;
    if (!grupo.whatsapp) { alert("Este tutor não possui WhatsApp cadastrado."); return; }

    const artigos = unicos.map(ag => {
      const sexo = pets.find(p => p.id === ag.pet_id)?.sexo || null;
      const normalizado = (sexo || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      const artigo = ["femea", "f", "feminino"].includes(normalizado) ? "da" :
        ["macho", "m", "masculino"].includes(normalizado) ? "do" : "para";
      return `${artigo} ${ag.petNome || "pet"}`;
    });
    const nomes = artigos.length === 1 ? artigos[0] :
      `${artigos.slice(0, -1).join(", ")} e ${artigos[artigos.length - 1]}`;

    const valores = unicos.map(ag => {
      const resumo = ehAdmin ? obterPagamentoDoCiclo(ag) : null;
      const valor = resumo?.estado === "conferir" ? null : resumo?.valor ?? valorSugerido(ag);
      return valor === null || valor === undefined || !Number.isFinite(Number(valor)) || Number(valor) <= 0
        ? null : Number(valor);
    });
    const todosComValor = valores.every(v => v !== null);
    const total = valores.reduce<number>((soma, valor) => soma + (valor ?? 0), 0);
    const linhas = unicos.flatMap((ag, indice) => {
      const datasCiclo = agendamentos.filter(a =>
        a.pet_id === ag.pet_id && a.ciclo === ag.ciclo &&
        !estaCancelado(a) && Number(a.numero_banho) > 0
      ).sort((a, b) => Number(a.numero_banho) - Number(b.numero_banho));
      const datas = datasCiclo.map(a =>
        `📅 ${a.numero_banho}º banho: ${formatarDataLocal(a.data)} às ${formatarHorario(a.horario)}`);
      return [
        `🐾 ${ag.petNome || "Pet"} — Plano ${ag.plano}`,
        ...datas,
        `💰 Valor do pacote: ${valores[indice] === null ? "A confirmar" : formatarValor(valores[indice])}`,
        ""
      ];
    });
    const mensagem = [
      `Olá, ${grupo.tutorNome}! 🐾💚`, "",
      `Passando para lembrar que hoje é dia de renovação ${unicos.length === 1 ? "do pacote de banho" : "dos pacotes de banho"} ${nomes} aqui no SPA PET AGROMINAS! 🐶🛁`, "",
      "📅 Confira abaixo as datas programadas para este ciclo de cuidados:", "",
      ...linhas,
      `💚 Valor total: ${todosComValor ? formatarValor(total) : "A confirmar (há pacote sem valor cadastrado)"}`,
      "", "Agradecemos pela confiança e esperamos vocês! 💚🐾"
    ].join("\n");
    abrirMensagemWhatsApp(grupo.whatsapp, mensagem);
  }

  function abrirNovoAgendamento(data?: string) {
    setAgendamentoSelecionado(null);
    setPetSelecionado("");
    setBuscaPet("");
    setMostrarSugestoesPet(false);
    setFrequenciaAgendamento("Avulso");
    setServicoSelecionado("");
    setDataAgendamento(data || dataSelecionada);
    setHorarioAgendamento("08:00");
    setObservacoes("");
    setValorAgendamento("");
    setModoReagendamento("unico");
    setModalAgendamento(true);
  }

  function abrirEdicao(agendamento: Agendamento) {
    setAgendamentoSelecionado(agendamento);
    setServicoExtraId("");
    setValorExtra("");
    setErroExtra("");
    setPetSelecionado(agendamento.pet_id);

    const pet = pets.find((item) => item.id === agendamento.pet_id);

    setBuscaPet(pet ? `${pet.nome} — ${pet.tutorNome}` : "");
    setMostrarSugestoesPet(false);

    setFrequenciaAgendamento(
      agendamento.plano === "Quinzenal" || agendamento.plano === "Mensal"
        ? agendamento.plano
        : "Avulso"
    );

    setServicoSelecionado(agendamento.servico_id || "");
    setDataAgendamento(agendamento.data);
    setHorarioAgendamento(formatarHorario(agendamento.horario));
    setObservacoes(agendamento.observacoes || "");

    setValorAgendamento(
      agendamento.valor_total !== null
        ? String(agendamento.valor_total).replace(".", ",")
        : ""
    );

    setModoReagendamento("unico");
    setModalAgendamento(true);
  }

  // Adicionais pertencem ao banho, sem modificar o preço ou o pagamento do ciclo.
  async function adicionarExtraAgendamento() {
    const ag = agendamentoSelecionado;
    if (!ehAdmin || !ag || salvandoExtra) return;
    const servico = servicos.find(item => item.id === servicoExtraId);
    const texto = valorExtra.trim().replace(",", ".");
    const valor = Number(texto);
    if (!servico || !texto || !Number.isFinite(valor) || valor < 0) {
      setErroExtra("Selecione o serviço e informe um valor válido.");
      return;
    }
    setSalvandoExtra(true);
    setErroExtra("");
    try {
      const { error } = await supabase.from("servicos_extras_agendamento").insert({
        agendamento_id: ag.id, pet_id: ag.pet_id, servico_id: servico.id,
        nome_servico: servico.nome, valor, pagamento_status: "Pendente",
      });
      if (error) throw error;
      setServicoExtraId("");
      setValorExtra("");
      await carregarDados();
    } catch (erro) {
      setErroExtra(erro instanceof Error ? erro.message : "Não foi possível salvar o adicional.");
    } finally {
      setSalvandoExtra(false);
    }
  }

  async function cancelarExtraAgendamento(extra: ExtraComprovante) {
    if (!ehAdmin || !agendamentoSelecionado || salvandoExtra || extra.pagamento_status !== "Pendente") return;
    if (!window.confirm(`Cancelar o adicional "${extra.nome_servico}"? O registro permanecerá no histórico.`)) return;
    setSalvandoExtra(true);
    setErroExtra("");
    try {
      const { data, error } = await supabase.from("servicos_extras_agendamento")
        .update({ pagamento_status: "Cancelado" })
        .eq("id", extra.id).eq("agendamento_id", agendamentoSelecionado.id)
        .eq("pagamento_status", "Pendente").select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("O adicional não está mais pendente. Atualize a Agenda.");
      await carregarDados();
    } catch (erro) {
      setErroExtra(erro instanceof Error ? erro.message : "Não foi possível cancelar o adicional.");
    } finally {
      setSalvandoExtra(false);
    }
  }

  function fecharModalAgendamento() {
    if (salvando || salvandoValor) return;

    setModalAgendamento(false);
    setAgendamentoSelecionado(null);
    setMostrarSugestoesPet(false);
  }

  const petsFiltrados = useMemo(() => {
    const termo = buscaPet.trim().toLocaleLowerCase("pt-BR");

    if (!termo) return pets.slice(0, 12);

    return pets
      .filter((pet) =>
        `${pet.nome} ${pet.tutorNome}`
          .toLocaleLowerCase("pt-BR")
          .includes(termo)
      )
      .slice(0, 12);
  }, [pets, buscaPet]);

  function selecionarPet(pet: Pet) {
    setPetSelecionado(pet.id);
    setBuscaPet(`${pet.nome} — ${pet.tutorNome}`);
    setMostrarSugestoesPet(false);
  }

  // Um ciclo antigo pode ter ciclo=null. Nesse caso só aceitamos grupos
  // identificáveis sem ambiguidade por banhos 1,2,3,4 em ordem cronológica.
  function identificarCiclo(agendamento: Agendamento): Agendamento[] | null {
    if (!ehPlano(agendamento) || !agendamento.numero_banho) return null;
    const quantidade = agendamento.plano === "Quinzenal" ? 2 : 4;
    const mesmos = agendamentos.filter(a =>
      a.pet_id === agendamento.pet_id && a.plano === agendamento.plano &&
      statusNormalizado(a.status) !== "cancelado"
    );
    if (agendamento.ciclo !== null && agendamento.ciclo !== undefined) {
      const grupo = mesmos.filter(a => a.ciclo === agendamento.ciclo);
      const numeros = grupo.map(a => a.numero_banho);
      if (grupo.length !== quantidade || new Set(numeros).size !== quantidade ||
          !Array.from({length: quantidade}, (_, i) => i + 1).every(n => numeros.includes(n))) return null;
      return grupo.sort((a,b) => (a.numero_banho || 0) - (b.numero_banho || 0));
    }
    const antigos = mesmos.filter(a => a.ciclo === null || a.ciclo === undefined)
      .sort((a,b) => a.data.localeCompare(b.data) || (a.numero_banho || 0) - (b.numero_banho || 0));
    const grupos: Agendamento[][] = [];
    let atual: Agendamento[] = [];
    for (const item of antigos) {
      if (item.numero_banho === 1) {
        if (atual.length) grupos.push(atual);
        atual = [item];
      } else if (atual.length) atual.push(item);
    }
    if (atual.length) grupos.push(atual);
    const grupo = grupos.find(g => g.some(a => a.id === agendamento.id));
    if (!grupo || grupo.length !== quantidade ||
      !grupo.every((a,i) => a.numero_banho === i + 1)) return null;
    return grupo;
  }

  const banhoEditado = agendamentoSelecionado;
  const cicloIdentificado = banhoEditado ? identificarCiclo(banhoEditado) : null;
  const alteracoesCiclo = banhoEditado && cicloIdentificado && dataValida(dataAgendamento)
    ? cicloIdentificado.map(a => ({
        agendamento: a,
        novaData: adicionarDias(a.data, diferencaDias(banhoEditado.data, dataAgendamento)),
        novoHorario: formatarHorario(horarioAgendamento),
      })) : [];
  const cicloTemConcluidos = alteracoesCiclo.some(a => estaConcluido(a.agendamento));

  async function salvarAgendamento() {
    if (!perfilUsuario) {
      alert("Aguarde a validação do seu perfil.");
      return;
    }
    if (!petSelecionado) {
      alert("Pesquise e selecione um pet na lista.");
      return;
    }

    if (!dataAgendamento) {
      alert("Selecione a data.");
      return;
    }

    if (!dataValida(dataAgendamento)) {
      alert("Informe uma data válida.");
      return;
    }

    if (!horarioAgendamento) {
      alert("Selecione o horário.");
      return;
    }

    if (agendamentoSelecionado && estaConcluido(agendamentoSelecionado)) {
      alert("Um banho concluído não pode ser reagendado.");
      return;
    }
    if (agendamentoSelecionado && modoReagendamento === "ciclo") {
      if (!cicloIdentificado) {
        alert("Não foi possível identificar todos os banhos deste ciclo com segurança. Altere apenas este banho ou confira o cadastro do plano.");
        return;
      }
      if (cicloTemConcluidos) {
        alert("O ciclo contém banho(s) já concluído(s). Para preservar o histórico, escolha alterar somente este banho.");
        return;
      }
    }

    if (agendamentoSelecionado && modoReagendamento === "ciclo" &&
      !window.confirm(`Confirmar a alteração das datas de ${alteracoesCiclo.length} banhos do ciclo de ${agendamentoSelecionado.petNome}?`)) return;

    setSalvando(true);

    try {
      const servico = servicos.find(
        (item) => item.id === servicoSelecionado
      );

      const valor =
        !ehAdmin && !agendamentoSelecionado
          ? (servico?.preco ?? null)
          : valorAgendamento.trim() === ""
            ? null
            : Number(valorAgendamento.replace(",", "."));

      if (valor !== null && (!Number.isFinite(valor) || valor < 0)) {
        alert("Informe um valor válido.");
        return;
      }

      const dadosBase = {
        pet_id: petSelecionado,
        servico_id: servicoSelecionado || null,
        horario: formatarHorario(horarioAgendamento),
        status: agendamentoSelecionado
          ? agendamentoSelecionado.status || "Agendado"
          : "Agendado",
        observacoes: observacoes || null,
        ...(!agendamentoSelecionado ? { valor_total: valor } : {}),
        servico_nome:
          agendamentoSelecionado && agendamentoSelecionado.servico_id === servicoSelecionado
            ? agendamentoSelecionado.servico_nome || servico?.nome || null
            : servico?.nome || agendamentoSelecionado?.servico_nome || null,
      };

      if (agendamentoSelecionado) {
        if (modoReagendamento === "ciclo" && cicloIdentificado) {
          // Salva os demais banhos sem alterar seus serviços, valores ou observações.
          // Se algum update falhar, tenta desfazer os anteriores.
          const realizados: {id:string; data:string; horario:string|null}[] = [];
          try {
            for (const item of alteracoesCiclo) {
              const original = item.agendamento;
              const dados = original.id === agendamentoSelecionado.id
                ? {...dadosBase, data: item.novaData, horario: item.novoHorario}
                : {data: item.novaData, horario: item.novoHorario};
              const {data: confirmados, error} = await supabase.from("agendamentos")
                .update(dados).eq("id", original.id).select("id");
              if (error) throw error;
              if (!confirmados?.length) throw new Error("Atualização não confirmada pelo banco.");
              realizados.push({id: original.id, data: original.data, horario: original.horario});
            }
          } catch (erro) {
            let reversaoFalhou = false;
            for (const item of realizados.reverse()) {
              const {error} = await supabase.from("agendamentos")
                .update({data:item.data, horario:item.horario}).eq("id",item.id);
              if (error) reversaoFalhou = true;
            }
            if (reversaoFalhou) throw new Error("Falha ao reagendar e ao desfazer algumas alterações. Confira as datas na agenda antes de continuar.");
            throw erro;
          }
        } else {
          const resposta = await supabase.from("agendamentos")
            .update({...dadosBase, data: dataAgendamento})
            .eq("id", agendamentoSelecionado.id).select("id");
          if (resposta.error) throw resposta.error;
          if (!resposta.data?.length) throw new Error("O banco não confirmou a alteração.");
        }
      } else {
        const registros: Record<string, unknown>[] = [];

        if (frequenciaAgendamento === "Avulso") {
          registros.push({
            ...dadosBase,
            data: dataAgendamento,
            plano: "Avulso",
            numero_banho: null,
            ciclo: null,
          });
        } else {
          const quantidade =
            frequenciaAgendamento === "Quinzenal" ? 2 : 4;
          const ciclosExistentes = agendamentos
            .filter(a => a.pet_id === petSelecionado && a.ciclo !== null)
            .map(a => Number(a.ciclo) || 0);
          const novoCiclo = Math.max(0, ...ciclosExistentes) + 1;

          for (let i = 0; i < quantidade; i++) {
            const intervalo =
              frequenciaAgendamento === "Quinzenal" ? 14 : 7;

            const data = adicionarDias(dataAgendamento, i * intervalo);

            registros.push({
              ...dadosBase,
              servico_nome: ajustarServicoPorBanho(dadosBase.servico_nome, frequenciaAgendamento, i + 1),
              data,
              plano: frequenciaAgendamento,
              numero_banho: i + 1,
              ciclo: novoCiclo,
            });
          }
        }

        const resposta = await supabase
          .from("agendamentos")
          .insert(registros);

        if (resposta.error) throw resposta.error;
      }

      setModalAgendamento(false);
      setAgendamentoSelecionado(null);
      setMostrarSugestoesPet(false);

      await carregarDados();

      if (!agendamentoSelecionado && frequenciaAgendamento !== "Avulso") {
        const quantidade =
          frequenciaAgendamento === "Quinzenal" ? 2 : 4;

        alert(
          `Pacote ${frequenciaAgendamento.toLowerCase()} criado com sucesso! ${quantidade} agendamentos foram registrados.`
        );
      }
    } catch (erro: unknown) {
      console.error("Erro ao salvar agendamento:", erro);

      alert(
        "Não foi possível salvar o agendamento.\n\n" +
          ((erro instanceof Error ? erro.message : null) || "Verifique os dados e tente novamente.")
      );
    } finally {
      setSalvando(false);
    }
  }

  async function excluirAgendamento(agendamento: Agendamento) {
    if (!perfilUsuario) return;
    if (estaConcluido(agendamento)) {
      alert("Não é possível excluir um banho concluído pela agenda.");
      return;
    }
    if (
      !window.confirm(
        `Deseja realmente excluir o agendamento de ${agendamento.petNome || "Pet"}?`
      )
    ) {
      return;
    }

    const resposta = await supabase
      .from("agendamentos")
      .delete()
      .eq("id", agendamento.id);

    if (resposta.error) {
      console.error(resposta.error);
      alert("Não foi possível excluir o agendamento.");
      return;
    }

    await carregarDados();
  }

  // Corrige uma confirmação acidental sem modificar cobranças ou outros banhos.
  async function desfazerComparecimento(ag: Agendamento) {
    if (!ehAdmin || salvando || !estaConcluido(ag)) return;
    if (!window.confirm(
      `Desfazer o comparecimento de ${ag.petNome || "este pet"} em ${formatarDataLocal(ag.data)}?\n\n` +
      "O banho voltará a ficar agendado. Esta ação só é permitida sem pagamento registrado."
    )) return;

    setSalvando(true);
    try {
      const { data: atual, error: erroAtual } = await supabase
        .from("agendamentos")
        .select("id, status, pagamento_status, forma_pagamento_plano, pet_id, ciclo")
        .eq("id", ag.id).single();
      if (erroAtual || !atual) throw erroAtual || new Error("Agendamento não encontrado.");
      if (!["concluido", "finalizado"].includes(statusNormalizado(atual.status))) {
        throw new Error("O banho já não está confirmado. Atualize a Agenda.");
      }
      if (statusNormalizado(atual.pagamento_status) === "pago" || atual.forma_pagamento_plano) {
        throw new Error("Existe informação de pagamento neste agendamento. Não é possível desfazer.");
      }
      if (atual.ciclo !== null) {
        const { data: planos, error: erroPlanos } = await supabase
          .from("pagamentos_planos").select("id")
          .eq("pet_id", atual.pet_id).eq("ciclo", atual.ciclo).limit(1);
        if (erroPlanos) throw erroPlanos;
        if (planos?.length) throw new Error("O ciclo possui pagamento registrado. Não é possível desfazer.");
      }
      const { data: registros, error: erroRegistros } = await supabase
        .from("atendimentos").select("id, forma_pagamento")
        .eq("agendamento_id", ag.id);
      if (erroRegistros) throw erroRegistros;
      if ((registros || []).some(r => Boolean(r.forma_pagamento))) {
        throw new Error("O atendimento possui pagamento registrado. Não é possível desfazer.");
      }
      if ((registros || []).length > 1) {
        throw new Error("Há mais de um registro de atendimento. Solicite uma revisão antes de desfazer.");
      }
      const { data: alterados, error: erroStatus } = await supabase
        .from("agendamentos").update({ status: "Agendado" })
        .eq("id", ag.id).eq("status", atual.status).select("id");
      if (erroStatus) throw erroStatus;
      if (alterados?.length !== 1) throw new Error("O agendamento mudou. Atualize a Agenda e tente novamente.");
      if (registros?.length) {
        const { data: removidos, error: erroRemocao } = await supabase
          .from("atendimentos").delete()
          .eq("id", registros[0].id).is("forma_pagamento", null).select("id");
        if (erroRemocao || removidos?.length !== 1) {
          // Se o registro não puder ser removido, tenta restaurar o status original.
          await supabase.from("agendamentos").update({ status: atual.status })
            .eq("id", ag.id).eq("status", "Agendado");
          throw erroRemocao || new Error("O atendimento não pôde ser removido. Confira a Agenda.");
        }
      }
      setModalAgendamento(false);
      setAgendamentoSelecionado(null);
      await carregarDados();
      alert("Comparecimento desfeito. O banho voltou para Agendado.");
    } catch (erro: unknown) {
      console.error("Erro ao desfazer comparecimento:", erro);
      alert((erro instanceof Error ? erro.message : null) || "Não foi possível desfazer o comparecimento.");
      await carregarDados();
    } finally {
      setSalvando(false);
    }
  }

  // Um clique registra a conclusão, sem solicitar valor ou forma de pagamento.
  async function salvarAtendimento(ag: Agendamento) {
    if (!perfilUsuario) return;
    if (registroAtendimentoEmAndamento.current) return;
    if (estaCancelado(ag)) {
      alert("Não é possível registrar um atendimento cancelado.");
      return;
    }
    if (estaConcluido(ag)) {
      alert("Este atendimento já está concluído.");
      return;
    }
    registroAtendimentoEmAndamento.current = true;
    setSalvando(true);
    try {
      const existente = await supabase.from("atendimentos")
        .select("id").eq("agendamento_id", ag.id).limit(1);
      if (existente.error) throw existente.error;
      if (existente.data?.length) {
        // Preserva dados financeiros já registrados; não os sobrescreve na Agenda.
        throw new Error("Já existe um atendimento registrado para este banho. Atualize a agenda antes de continuar.");
      }
      const insercao = await supabase.from("atendimentos").insert({
        agendamento_id: ag.id,
        pet_id: ag.pet_id,
        data: ag.data,
        valor: ag.valor_total ?? 0,
        forma_pagamento: null,
      }).select("id");
      if (insercao.error) throw insercao.error;
      if (!insercao.data?.length) throw new Error("O banco não confirmou o atendimento.");
      const atualizacao = await supabase.from("agendamentos")
        .update({ status: "Concluído" }).eq("id", ag.id);
      if (atualizacao.error) {
        throw new Error("O atendimento foi registrado, mas o status não foi atualizado. Atualize a página e confira antes de tentar novamente.");
      }
      await carregarDados();
    } catch (erro: unknown) {
      console.error("Erro ao concluir atendimento:", erro);
      alert((erro instanceof Error ? erro.message : null) || "Não foi possível concluir o atendimento.");
      await carregarDados();
    } finally {
      registroAtendimentoEmAndamento.current = false;
      setSalvando(false);
    }
  }

  function irParaDiaAnterior() {
    const [ano, mes, dia] = dataSelecionada.split("-").map(Number);
    const data = new Date(ano, mes - 1, dia - 1);

    setDataSelecionada(
      `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`
    );

    setMesAtual(new Date(data.getFullYear(), data.getMonth(), 1));
  }

  function irParaProximoDia() {
    const [ano, mes, dia] = dataSelecionada.split("-").map(Number);
    const data = new Date(ano, mes - 1, dia + 1);

    setDataSelecionada(
      `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`
    );

    setMesAtual(new Date(data.getFullYear(), data.getMonth(), 1));
  }

  function irParaHoje() {
    const hoje = obterDataLocal();

    setDataSelecionada(hoje);

    const [ano, mes] = hoje.split("-").map(Number);

    setMesAtual(new Date(ano, mes - 1, 1));
  }

  function mudarMes(direcao: number) {
    const novoMes = new Date(mesAtual);

    novoMes.setMonth(novoMes.getMonth() + direcao);

    setMesAtual(novoMes);
  }

  function selecionarDia(dia: number) {
    const ano = mesAtual.getFullYear();
    const mes = String(mesAtual.getMonth() + 1).padStart(2, "0");

    setDataSelecionada(`${ano}-${mes}-${String(dia).padStart(2, "0")}`);
  }

  const diasDoMes = useMemo(() => {
    const ano = mesAtual.getFullYear();
    const mes = mesAtual.getMonth();
    const primeiroDia = new Date(ano, mes, 1).getDay();
    const quantidadeDias = new Date(ano, mes + 1, 0).getDate();

    const dias: (number | null)[] = [];

    for (let i = 0; i < primeiroDia; i++) {
      dias.push(null);
    }

    for (let dia = 1; dia <= quantidadeDias; dia++) {
      dias.push(dia);
    }

    return dias;
  }, [mesAtual]);

  const agendamentosDoDia = agendamentos
    .filter(
      (item) =>
        item.data === dataSelecionada &&
        `${item.petNome || ""} ${item.tutorNome || ""}`.toLocaleLowerCase("pt-BR").includes(buscaAgenda.trim().toLocaleLowerCase("pt-BR"))
    )
    .sort((a, b) =>
      formatarHorario(a.horario).localeCompare(formatarHorario(b.horario))
    );

  const agendamentosManha = agendamentosDoDia.filter(
    (item) => obterTurno(item.horario) === "Manhã"
  );

  const agendamentosTarde = agendamentosDoDia.filter(
    (item) => obterTurno(item.horario) === "Tarde"
  );

  function existeAgendamentoNoDia(dia: number) {
    const data = `${mesAtual.getFullYear()}-${String(
      mesAtual.getMonth() + 1
    ).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

    return agendamentos.some(
      (item) =>
        item.data === data && !estaCancelado(item)
    );
  }

  function estaConcluido(agendamento: Agendamento) {
    const status = (agendamento.status || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

    return (
      status === "concluido" ||
      status === "finalizado" ||
      atendimentos.some(
        (item) => item.agendamento_id === agendamento.id
      )
    );
  }

  type GrupoTutor = {
    chave: string;
    tutorNome: string;
    whatsapp: string;
    horario: string;
    data: string;
    agendamentos: Agendamento[];
  };

  function agruparPorTutor(lista: Agendamento[]): GrupoTutor[] {
    const grupos: GrupoTutor[] = [];

    lista.forEach((agendamento) => {
      const chave = `${agendamento.tutorNome || "Tutor"}|${agendamento.whatsapp || ""}|${agendamento.data || ""}|${formatarHorario(agendamento.horario)}`;

      const existente = grupos.find(
        (grupo) => grupo.chave === chave
      );

      if (existente) {
        existente.agendamentos.push(agendamento);
      } else {
        grupos.push({
          chave,
          tutorNome: agendamento.tutorNome || "Tutor",
          whatsapp: agendamento.whatsapp || "",
          horario: formatarHorario(agendamento.horario),
          data: agendamento.data,
          agendamentos: [agendamento],
        });
      }
    });

    return grupos;
  }

  async function compartilharAgendaImagem() {
    const lista = agendamentos
      .filter((a) => a.data === dataSelecionada && !estaCancelado(a))
      .sort((a, b) =>
        formatarHorario(a.horario).localeCompare(formatarHorario(b.horario)) ||
        (a.tutorNome || "").localeCompare(b.tutorNome || "", "pt-BR") ||
        (a.petNome || "").localeCompare(b.petNome || "", "pt-BR")
      );

    if (!lista.length) {
      alert("Não há pets agendados nesta data para compartilhar.");
      return;
    }

    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
      alert("Abra a Agenda no Chrome em localhost ou HTTPS para copiar a imagem.");
      return;
    }

    // A logo oficial já é utilizada na impressão térmica do sistema.
    const logo = new Image();
    const logoCarregada = await new Promise<boolean>((resolve) => {
      let terminou = false;
      const finalizar = (ok: boolean) => {
        if (!terminou) { terminou = true; resolve(ok); }
      };
      logo.onload = () => finalizar(true);
      logo.onerror = () => finalizar(false);
      logo.src = "/logo-agrominas-impressao.png";
      if (logo.complete) finalizar(logo.naturalWidth > 0);
    });

    const largura = 1500;
    const margem = 42;
    const larguraTabela = largura - margem * 2;
    const larguras = [46, 245, 170, 180, 440, 335];
    const titulos = ["#", "TUTOR", "PET", "PLANO / BANHO", "SERVIÇO A REALIZAR", "OBSERVAÇÕES"];
    const ctxMedida = document.createElement("canvas").getContext("2d");
    if (!ctxMedida) { alert("Não foi possível preparar a imagem."); return; }

    const linhasTexto = (ctx: CanvasRenderingContext2D, texto: string, larguraMax: number) => {
      const palavras = (texto || "—").trim().split(/\s+/);
      const linhas: string[] = [];
      let linha = "";
      for (const palavra of palavras) {
        const proposta = linha ? `${linha} ${palavra}` : palavra;
        if (ctx.measureText(proposta).width > larguraMax && linha) {
          linhas.push(linha);
          linha = palavra;
        } else {
          linha = proposta;
        }
      }
      if (linha) linhas.push(linha);
      return linhas.length ? linhas : ["—"];
    };

    type LinhaAgenda = { ag: Agendamento; altura: number; textos: string[][] };
    type TurnoAgenda = { titulo: string; horario: string; linhas: LinhaAgenda[] };
    const turnos: TurnoAgenda[] = [
      { titulo: "MANHÃ", horario: "08:00", linhas: [] },
      { titulo: "TARDE", horario: "13:30", linhas: [] },
    ];

    for (const ag of lista) {
      const raca = pets.find((pet) => pet.id === ag.pet_id)?.raca?.trim();
      const nomePetComRaca = `${ag.petNome || "Pet"} (${raca || "Raça não informada"})`;
      const plano = ag.plano === "Mensal" || ag.plano === "Quinzenal" ? ag.plano : "Avulso";
      const banho = ag.numero_banho ? `${ag.numero_banho}º${ag.ciclo && ag.ciclo > 1 ? ` / C${ag.ciclo}` : ""}` : "1º";
      const textosBase = ["", ag.tutorNome || "Tutor não informado", nomePetComRaca,
        `${plano} • ${banho}`, obterNomeServico(ag), ag.observacoes?.trim() || "—"];
      const textos = textosBase.map((texto, i) => {
        ctxMedida.font = `${i === 1 || i === 2 ? "bold " : ""}22px Arial, sans-serif`;
        return linhasTexto(ctxMedida, texto, larguras[i] - 22);
      });
      const maiorNumeroLinhas = Math.max(1, ...textos.map((item) => item.length));
      const altura = Math.max(68, maiorNumeroLinhas * 30 + 24);
      turnos[obterTurno(ag.horario) === "Manhã" ? 0 : 1].linhas.push({ ag, altura, textos });
    }

    const alturaCabecalho = 180;
    const alturaTituloTurno = 70;
    const alturaCabecalhoTabela = 46;
    const espacoTurnos = 18;
    const alturaRodape = 120;
    const alturaTotal = alturaCabecalho + 28 + turnos.reduce((soma, turno) =>
      soma + alturaTituloTurno + alturaCabecalhoTabela +
      (turno.linhas.length ? turno.linhas.reduce((acc, linha) => acc + linha.altura, 0) : 70) +
      espacoTurnos, 0) + alturaRodape;

    // Não corta informações: se a imagem ultrapassar o limite de altura, informa o usuário.
    if (alturaTotal > 14000) {
      alert("A agenda deste dia é grande demais para copiar em uma única imagem. Entre em contato para habilitar a divisão em páginas.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = alturaTotal;
    const ctx = canvas.getContext("2d");
    if (!ctx) { alert("Não foi possível desenhar a imagem."); return; }

    const bloco = (x: number, y: number, w: number, h: number, cor: string) => {
      ctx.fillStyle = cor;
      ctx.fillRect(x, y, w, h);
    };
    const escrever = (texto: string, x: number, y: number, cor: string, fonte: string) => {
      ctx.fillStyle = cor;
      ctx.font = fonte;
      ctx.fillText(texto, x, y);
    };
    const arredondado = (x: number, y: number, w: number, h: number, raio: number, cor: string) => {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, raio);
      ctx.fillStyle = cor;
      ctx.fill();
    };

    bloco(0, 0, largura, alturaTotal, "#f8fbfa");
    bloco(0, 0, largura, alturaCabecalho, "#064e3b");

    // A logo original é mantida em seu fundo branco, sem modificar suas cores.
    if (logoCarregada) {
      arredondado(margem, 24, 155, 132, 14, "#ffffff");
      const escala = Math.min(139 / logo.naturalWidth, 119 / logo.naturalHeight);
      const w = logo.naturalWidth * escala;
      const h = logo.naturalHeight * escala;
      ctx.drawImage(logo, margem + (155 - w) / 2, 24 + (132 - h) / 2, w, h);
    } else {
      escrever("AG", margem + 24, 105, "#ffffff", "bold 55px Arial, sans-serif");
    }
    escrever("AGROMINAS", 220, 83, "#ffffff", "bold 53px Arial, sans-serif");
    escrever("BANHO E TOSA", 223, 121, "#a7f3d0", "bold 25px Arial, sans-serif");
    bloco(650, 36, 2, 107, "#6ee7b7");
    escrever("AGENDA DO DIA", 690, 80, "#ffffff", "bold 48px Arial, sans-serif");
    escrever(formatarDataLocal(dataSelecionada), 692, 121, "#d1fae5", "26px Arial, sans-serif");
    escrever("PROGRAMAÇÃO DA EQUIPE DO SPA", 692, 151, "#a7f3d0", "bold 18px Arial, sans-serif");

    let y = alturaCabecalho + 28;
    for (const turno of turnos) {
      arredondado(margem, y, larguraTabela, 60, 12, "#d1fae5");
      escrever(`${turno.titulo}  •  ${turno.horario}`, margem + 20, y + 40, "#064e3b", "bold 30px Arial, sans-serif");
      const totalTurno = `${turno.linhas.length} ${turno.linhas.length === 1 ? "PET" : "PETS"}`;
      ctx.font = "bold 23px Arial, sans-serif";
      const larguraSelo = Math.max(125, ctx.measureText(totalTurno).width + 42);
      arredondado(largura - margem - larguraSelo - 15, y + 10, larguraSelo, 40, 20, "#059669");
      escrever(totalTurno, largura - margem - larguraSelo + 6, y + 38, "#ffffff", "bold 23px Arial, sans-serif");
      y += alturaTituloTurno;

      bloco(margem, y, larguraTabela, alturaCabecalhoTabela, "#065f46");
      let x = margem;
      titulos.forEach((titulo, i) => {
        escrever(titulo, x + 10, y + 31, "#ffffff", "bold 17px Arial, sans-serif");
        x += larguras[i];
      });
      y += alturaCabecalhoTabela;

      if (!turno.linhas.length) {
        bloco(margem, y, larguraTabela, 70, "#ffffff");
        escrever("Nenhum pet agendado neste turno", margem + 20, y + 45, "#64748b", "23px Arial, sans-serif");
        y += 70;
      }
      turno.linhas.forEach((linha, indice) => {
        bloco(margem, y, larguraTabela, linha.altura, indice % 2 ? "#eef5f3" : "#ffffff");
        bloco(margem, y + linha.altura - 1, larguraTabela, 1, "#dbe8e3");
        let x = margem;
        larguras.forEach((larguraColuna, coluna) => {
          if (coluna) bloco(x, y, 1, linha.altura, "#e2e8e5");
          if (coluna === 0) {
            escrever(String(indice + 1), x + 15, y + 36, "#334155", "bold 22px Arial, sans-serif");
          } else {
            linha.textos[coluna].forEach((texto, indiceTexto) => {
              escrever(texto, x + 10, y + 33 + indiceTexto * 30,
                coluna === 2 ? "#065f46" : coluna === 4 ? "#0f172a" : coluna === 5 && texto !== "—" ? "#065f46" : "#334155",
                `${coluna === 1 || coluna === 2 || coluna === 4 || (coluna === 5 && texto !== "—") ? "bold " : ""}22px Arial, sans-serif`);
            });
          }
          x += larguraColuna;
        });
        y += linha.altura;
      });
      y += espacoTurnos;
    }

    arredondado(margem, y + 10, 345, 78, 13, "#d1fae5");
    escrever("TOTAL DO DIA", margem + 20, y + 40, "#065f46", "bold 22px Arial, sans-serif");
    escrever(`${lista.length} ${lista.length === 1 ? "PET" : "PETS"}`, margem + 20, y + 75, "#064e3b", "bold 34px Arial, sans-serif");
    escrever("AGROMINAS  •  USO INTERNO DA EQUIPE", 820, y + 61, "#64748b", "bold 21px Arial, sans-serif");

    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("A imagem não pôde ser gerada.");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      alert("Agenda copiada! Abra o grupo das meninas no WhatsApp, pressione Ctrl + V e envie.");
    } catch (erro) {
      console.error("Erro ao copiar agenda:", erro);
      alert("Não foi possível copiar a agenda. Confira a permissão da área de transferência no Chrome.");
    }
  }

  function renderPetDoGrupo(agendamento: Agendamento) {
    const extrasDoBanho = extrasComprovantes.filter(e => e.agendamento_id === agendamento.id && e.pagamento_status !== "Cancelado");
    const totalExtrasBanho = extrasDoBanho.reduce((t, e) => t + Number(e.valor || 0), 0);
    const concluido = estaConcluido(agendamento);
    const cancelado = estaCancelado(agendamento);
    const pagamento = ehAdmin ? obterPagamentoDoCiclo(agendamento) : null;
    const rotuloPagamento = !pagamento ? null : pagamento.texto === "PAGO" ? "Pago" : pagamento.texto === "A CONFERIR" ? "A conferir" : pagamento.estado === "pendente" ? "Pendente" : pagamento.texto;

    const pet = pets.find(
      (item) => item.id === agendamento.pet_id
    );

    const identificacao = obterIdentificacaoBanho(agendamento);

    return (
      <div
        key={agendamento.id}
        className={`rounded-2xl border-l-4 p-4 shadow-sm transition hover:shadow-md ${cancelado ? "border-rose-400 bg-rose-50/70 opacity-80" : concluido ? "border-emerald-500 bg-emerald-50/60" : "border-amber-400 bg-white"}`}
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-lg text-emerald-700">
              🐾
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-semibold text-emerald-950">
                  {agendamento.petNome || "Pet"}
                </h4>
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${agendamento.plano === "Mensal" ? "border-violet-200 bg-violet-50 text-violet-700" : agendamento.plano === "Quinzenal" ? "border-sky-200 bg-sky-50 text-sky-700" : "border-slate-200 bg-slate-100 text-slate-700"}`}>
                  {agendamento.plano === "Mensal" || agendamento.plano === "Quinzenal" ? agendamento.plano : "Avulso"}
                </span>

                <span
                  className={
                    cancelado
                      ? "rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-800"
                      : concluido
                        ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800"
                        : "rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800"
                  }
                >
                  {cancelado ? "Cancelado" : concluido ? "Compareceu" : "Ainda não veio"}
                </span>
                {rotuloPagamento && (
                  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${pagamento?.texto === "PAGO" ? "border-emerald-200 bg-emerald-100 text-emerald-800" : pagamento?.texto === "A CONFERIR" ? "border-yellow-300 bg-yellow-50 text-yellow-900" : "border-orange-200 bg-orange-100 text-orange-800"}`}>
                    {pagamento?.texto === "PAGO" ? "✓ " : pagamento?.texto === "A CONFERIR" ? "⚠ " : "○ "}{rotuloPagamento}
                  </span>
                )}
              </div>

              <p className="mt-1 text-sm text-gray-500">{pet?.raca?.trim() ? `Raça: ${pet.raca.trim()}` : "Raça não informada"}</p>
              {identificacao && (
                <p className="mt-1 text-sm font-semibold text-emerald-700">
                  🛁 {identificacao}
                </p>
              )}

              <p className="mt-1 text-sm text-gray-600">🛁 {obterNomeServico(agendamento)}</p>
              {ehAdmin && <p className="mt-1 text-sm text-slate-600">{ehPlano(agendamento) ? "Valor do ciclo" : "Valor do atendimento"}: <strong>{pagamento?.valor == null ? "A conferir" : formatarValor(pagamento.valor)}</strong></p>}
              {pagamento && <p className="mt-1 text-sm text-slate-600">Recebido: {formatarValor(pagamento.recebido)} • Crédito: {formatarValor(pagamento.credito)} • Saldo: {valorComprovante(pagamento.saldo)}</p>}
              {ehAdmin && extrasDoBanho.length > 0 && (
                <div className="mt-1 space-y-1 text-sm text-slate-600">
                  {extrasDoBanho.map(extra => (
                    <p key={extra.id}>
                      + {extra.nome_servico}: <strong>{formatarValor(Number(extra.valor))}</strong>
                      <span className="text-xs text-slate-500"> · {extra.pagamento_status}</span>
                    </p>
                  ))}
                  <p className="font-semibold text-slate-700">
                    Total geral: <strong>{pagamento?.valor == null ? "A conferir" : formatarValor(Number(pagamento.valor) + totalExtrasBanho)}</strong>
                  </p>
                </div>
              )}
              {agendamento.observacoes?.trim() && (
                <p className="mt-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-700">📝 {agendamento.observacoes.trim()}</p>
              )}

            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!agendamento.whatsapp || cancelado || !concluido}
              onClick={() => abrirWhatsApp("pronto", agendamento.whatsapp || "", agendamento.petNome || "Pet", agendamento.tutorNome || "Tutor", formatarHorario(agendamento.horario), pet?.sexo || null, obterNomeServico(agendamento), agendamento.data)}
              className="rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">🐶 Pet pronto</button>
            {ehAdmin && pagamento && <button
              type="button"
              disabled={cancelado}
              onClick={() =>
                imprimirComprovante(
                  agendamento,
                  obterNomeServico(agendamento),
                  pagamento,
                  extrasDoBanho
                )
              }
              className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
            >
              🖨️ Imprimir
            </button>}

            <button
              type="button"
              onClick={() => abrirEdicao(agendamento)}
              disabled={cancelado || (concluido && !ehAdmin)}
              className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Editar / Reagendar
            </button>
            {!concluido && !cancelado && (
              <button
                type="button"
                onClick={() => void salvarAtendimento(agendamento)}
                disabled={salvando}
                className="rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
              >
                Registrar atendimento
              </button>
            )}

            {!concluido && !cancelado && <button
              type="button"
              onClick={() => void excluirAgendamento(agendamento)}
              className="rounded-xl px-3 py-2 text-sm font-medium text-rose-500 transition hover:bg-rose-50 hover:text-rose-700"
            >
              Excluir
            </button>}
          </div>
        </div>
      </div>
    );
  }

  function renderGrupoTutor(grupo: GrupoTutor): ReactNode {
    const itensWhatsApp = grupo.agendamentos.filter(a => !estaCancelado(a)).map((agendamento) => {
      const pet = pets.find(
        (item) => item.id === agendamento.pet_id
      );

      return {
        petNome: agendamento.petNome || "Pet",
        servicoNome: obterNomeServico(agendamento),
        sexo: pet?.sexo || null,
      };
    });

    return (
      <div
        key={grupo.chave}
        className="rounded-3xl border border-emerald-100 bg-emerald-50/40 p-5 shadow-sm"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-xl shadow-sm">
              👤
            </div>

            <div>
              <h4 className="font-semibold text-emerald-950">
                {grupo.tutorNome}
              </h4>

              <p className="text-sm text-gray-500">
                {grupo.horario} • {grupo.agendamentos.length}{" "}
                {grupo.agendamentos.length === 1 ? "pet" : "pets"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!grupo.whatsapp || !grupo.agendamentos.some(a => !estaCancelado(a)) || !grupo.agendamentos.filter(a => !estaCancelado(a)).every(estaConcluido)}
              onClick={() => avisarPetsProntos(grupo.whatsapp, grupo.tutorNome, grupo.agendamentos.filter(a => !estaCancelado(a)).map(a => ({ nome: a.petNome || "Pet", sexo: pets.find(p => p.id === a.pet_id)?.sexo || null })))}
              className="rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">🐾 Avisar pets prontos</button>

            {perfilUsuario && grupo.agendamentos.some(podeRenovarCiclo) && (
              <button type="button" disabled={salvandoRenovacao}
                onClick={() => abrirRenovacaoGrupo(grupo)}
                className="rounded-xl border border-emerald-600 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50">
                🔄 Renovar ciclo
              </button>
            )}
            {grupo.agendamentos.some(a => ehPlano(a) && Number(a.numero_banho) === 1 && !estaCancelado(a)) && (
              <button type="button" disabled={!grupo.whatsapp}
                onClick={() => avisarRenovacaoWhatsApp(grupo)}
                className="rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-semibold text-sky-800 disabled:opacity-40">
                📲 Enviar renovação
              </button>
            )}
            {!ehAdmin && grupo.agendamentos.filter(a => !estaCancelado(a)).length > 1 && <button type="button"
              onClick={() => documentoComprovante(
                '<div class="nome-pet">' + escaparHTMLComprovante(grupo.tutorNome) + '</div><div>' + escaparHTMLComprovante(formatarDataLocal(grupo.data) + ' • ' + grupo.horario) + '</div>' +
                grupo.agendamentos.filter(a => !estaCancelado(a)).map(a => '<div class="pet"><strong>' + escaparHTMLComprovante(a.petNome || "Pet") + '</strong><div>' + escaparHTMLComprovante(obterNomeServico(a)) + '</div><div>' + escaparHTMLComprovante(obterIdentificacaoBanho(a)) + '</div></div>').join(''), "COMPROVANTE CONJUNTO")}
              className="rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">🖨️ Imprimir todos</button>}
            {ehAdmin && grupo.agendamentos.filter(a => !estaCancelado(a)).length > 1 && (
              <button
                type="button"
                onClick={() => imprimirComprovanteGrupo(
                  grupo.tutorNome,
                  grupo.data,
                  grupo.horario,
                  grupo.agendamentos.filter(a => !estaCancelado(a)).map((agendamento) => {
                    const pagamento = obterPagamentoDoCiclo(agendamento);
                    const plano = Boolean(agendamento.plano && agendamento.plano !== "Avulso");
                    return {
                      petNome: agendamento.petNome || "Pet",
                      servicoNome: obterNomeServico(agendamento),
                      identificacao: obterIdentificacaoBanho(agendamento),
                      valor: pagamento.valor,
                      recebido: pagamento.recebido,
                      credito: pagamento.credito,
                      saldo: pagamento.saldo,
                      texto: pagamento.texto,
                      extras: extrasComprovantes.filter(extra => extra.agendamento_id === agendamento.id),
                      pago: pagamento.pago,
                      forma: pagamento.forma,
                      plano,
                      tipoPlano: agendamento.plano,
                      ciclo: agendamento.ciclo,
                      petId: agendamento.pet_id,
                    };
                  })
                )}
                className="rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
              >
                🖨️ Imprimir todos
              </button>
            )}
          <button
            type="button"
            onClick={() =>
              abrirWhatsAppGrupo(
                grupo.whatsapp,
                grupo.tutorNome,
                grupo.data,
                grupo.horario,
                itensWhatsApp
              )
            }
            disabled={!grupo.whatsapp || itensWhatsApp.length === 0}
            className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            📅 Lembrar agendamento
          </button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {grupo.agendamentos.map(renderPetDoGrupo)}
        </div>
      </div>
    );
  }

  const gruposManha = agruparPorTutor(agendamentosManha);
  const gruposTarde = agruparPorTutor(agendamentosTarde);

  const nomeMes = mesAtual.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const ativosDia = agendamentos.filter(a => a.data === dataSelecionada && !estaCancelado(a));
  const indicadores = [
    { titulo: "Pets do dia", valor: ativosDia.length },
    { titulo: "Compareceram", valor: ativosDia.filter(estaConcluido).length },
    { titulo: "Ainda não vieram", valor: ativosDia.filter(a => !estaConcluido(a)).length },
    { titulo: "Em planos", valor: ativosDia.filter(a => a.plano === "Mensal" || a.plano === "Quinzenal").length },
    ...(ehAdmin ? [
      { titulo: "Pagos", valor: ativosDia.filter(a => obterPagamentoDoCiclo(a).estado === "pago").length },
      { titulo: "Pendentes / parciais", valor: ativosDia.filter(a => ["pendente", "parcial"].includes(obterPagamentoDoCiclo(a).estado)).length },
      { titulo: "A conferir", valor: ativosDia.filter(a => obterPagamentoDoCiclo(a).estado === "conferir").length },
    ] : []),
  ];

  return (
    <main className="min-h-screen bg-[#f3f8f5]">
      <div className="flex min-h-screen">
        <MenuLateral />

        <section className="min-w-0 flex-1 p-4 md:p-8">
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold tracking-wide text-emerald-800">🐾 SPA PET AGROMINAS</div>
              <h2 className="text-3xl font-extrabold tracking-tight text-emerald-950">
                Agenda
              </h2>

              <p className="mt-1 text-gray-500">
                Banhos, planos, reagendamentos e atendimentos em um só lugar.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 lg:justify-end">
            <button type="button" disabled={carregando || Boolean(erroCarregamento) || !perfilUsuario} onClick={() => void compartilharAgendaImagem()} className="rounded-xl border border-emerald-300 bg-white px-5 py-3 font-semibold text-emerald-800 disabled:opacity-50">📷 Compartilhar Agenda como imagem</button>
            <button
              type="button"
              disabled={carregando || Boolean(erroCarregamento) || !perfilUsuario}
              onClick={() => abrirNovoAgendamento()}
              className="rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-emerald-800"
            >
              + Novo agendamento
            </button>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {indicadores.map(item => <div key={item.titulo} className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm"><p className="text-sm text-slate-600">{item.titulo}</p><p className="mt-1 text-2xl font-bold text-emerald-950">{carregando || erroCarregamento ? "—" : item.valor}</p></div>)}
          </div>
          <div className="grid gap-6 lg:grid-cols-[330px_minmax(0,1fr)]">
            <div className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
              <div className="mb-5 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => mudarMes(-1)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-gray-100"
                  aria-label="Mês anterior"
                >
                  ←
                </button>

                <h3 className="font-bold capitalize text-emerald-950">
                  {nomeMes}
                </h3>

                <button
                  type="button"
                  onClick={() => mudarMes(1)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-gray-100"
                  aria-label="Próximo mês"
                >
                  →
                </button>
              </div>

              <div className="mb-2 grid grid-cols-7 text-center text-xs font-medium text-gray-400">
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(
                  (dia) => (
                    <span key={dia}>{dia}</span>
                  )
                )}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {diasDoMes.map((dia, index) => {
                  if (dia === null) {
                    return (
                      <div
                        key={`vazio-${index}`}
                        className="h-10"
                      />
                    );
                  }

                  const data = `${mesAtual.getFullYear()}-${String(
                    mesAtual.getMonth() + 1
                  ).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

                  const selecionado = data === dataSelecionada;
                  const hoje = data === obterDataLocal();
                  const temAgendamento = existeAgendamentoNoDia(dia);

                  return (
                    <button
                      key={data}
                      type="button"
                      onClick={() => selecionarDia(dia)}
                      className={
                        "relative flex h-10 items-center justify-center rounded-lg text-sm " +
                        (selecionado
                          ? "bg-emerald-700 font-semibold text-white shadow-sm"
                          : hoje
                            ? "bg-emerald-50 font-semibold text-emerald-800"
                            : "text-gray-700 hover:bg-emerald-50")
                      }
                    >
                      {dia}

                      {temAgendamento && (
                        <span
                          className={
                            "absolute bottom-1 h-1 w-1 rounded-full " +
                            (selecionado ? "bg-emerald-300" : "bg-emerald-600")
                          }
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={irParaHoje}
                className="mt-5 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Ir para hoje
              </button>
            </div>

            <div className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm md:p-6">
              <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm text-gray-500">
                    Dia selecionado
                  </p>

                  <h3 className="mt-1 text-2xl font-extrabold text-emerald-950">
                    {formatarDataLocal(dataSelecionada)}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={irParaDiaAnterior}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                    aria-label="Dia anterior"
                  >
                    ←
                  </button>

                  <button
                    type="button"
                    onClick={irParaHoje}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
                  >
                    Hoje
                  </button>

                  <button
                    type="button"
                    onClick={irParaProximoDia}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                    aria-label="Próximo dia"
                  >
                    →
                  </button>
                </div>
              </div>

              <label htmlFor="busca-agenda" className="mb-2 block text-sm font-medium text-gray-700">Buscar pet ou tutor neste dia</label>
              <input id="busca-agenda" type="search" value={buscaAgenda} onChange={e => setBuscaAgenda(e.target.value)} placeholder="Nome do pet ou tutor..." className="mb-6 w-full rounded-xl border border-emerald-200 bg-emerald-50/30 px-4 py-3 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
              {erroCarregamento ? (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  <p>{erroCarregamento}</p>
                  <button type="button" onClick={() => void carregarDados()} className="mt-3 rounded-lg border border-red-300 px-3 py-2 font-semibold">
                    Tentar novamente
                  </button>
                </div>
              ) : carregando ? (
                <div className="rounded-xl bg-gray-50 p-10 text-center text-gray-500">
                  Carregando agenda...
                </div>
              ) : (
                <div className="space-y-8">
                  <section>
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-emerald-950">
                          ☀️ Manhã
                        </h4>

                        <p className="text-sm text-gray-500">
                          08:00 às 12:00
                        </p>
                      </div>

                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                        {agendamentosManha.length}{" "}
                        {agendamentosManha.length === 1 ? "pet" : "pets"}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {gruposManha.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
                          <p className="text-sm text-gray-500">
                            Nenhum pet agendado pela manhã.
                          </p>
                        </div>
                      ) : (
                        gruposManha.map(renderGrupoTutor)
                      )}
                    </div>
                  </section>

                  <section>
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-emerald-950">
                          🌤️ Tarde
                        </h4>

                        <p className="text-sm text-gray-500">
                          13:30 às 17:30
                        </p>
                      </div>

                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                        {agendamentosTarde.length}{" "}
                        {agendamentosTarde.length === 1 ? "pet" : "pets"}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {gruposTarde.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
                          <p className="text-sm text-gray-500">
                            Nenhum pet agendado à tarde.
                          </p>
                        </div>
                      ) : (
                        gruposTarde.map(renderGrupoTutor)
                      )}
                    </div>
                  </section>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {renovacao && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-emerald-950">🔄 Renovar ciclo</h3>
            <p className="mt-2 text-sm text-gray-600">Confira as datas antes de confirmar. O histórico será mantido.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold">Data do primeiro banho
                <input type="date" min={adicionarDias(renovacao.data, 1)} value={dataInicioRenovacao}
                  onChange={e => setDataInicioRenovacao(e.target.value)} className="mt-1 w-full rounded-xl border p-2" />
              </label>
              <label className="text-sm font-semibold">Turno
                <select value={horarioRenovacao} onChange={e => setHorarioRenovacao(e.target.value)} className="mt-1 w-full rounded-xl border p-2">
                  <option value="08:00">Manhã — 08:00</option><option value="13:30">Tarde — 13:30</option>
                </select>
              </label>
            </div>
            <div className="mt-4 rounded-xl bg-emerald-50 p-4">
              {(renovacoesGrupo.length ? renovacoesGrupo : [renovacao]).map(pet => (
                <div key={pet.pet_id} className="mb-3 border-b border-emerald-200 pb-2 last:border-0">
                  <p className="font-semibold">{pet.petNome || "Pet"} — {pet.plano} • Ciclo {Number(pet.ciclo) + 1}</p>
                  {ehAdmin && <p className="text-sm">Valor do novo ciclo: {valorComprovante(agendamentos.find(a => a.pet_id === pet.pet_id && a.ciclo === pet.ciclo && a.numero_banho === 1)?.valor_total ?? pet.valor_total)}</p>}
                  {dataValida(dataInicioRenovacao) && Array.from({ length: pet.plano === "Quinzenal" ? 2 : 4 }, (_, i) =>
                    adicionarDias(dataInicioRenovacao, i * (pet.plano === "Quinzenal" ? 14 : 7))).map((data, i) => (
                    <p key={data} className="text-sm">{i + 1}º banho: {formatarDataLocal(data)} às {horarioRenovacao}</p>
                  ))}
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm text-gray-600">O pagamento do novo ciclo ficará pendente na página Pagamentos.</p>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" disabled={salvandoRenovacao} onClick={() => {setRenovacao(null);setRenovacoesGrupo([]);}}
                className="rounded-xl border px-4 py-2">Cancelar</button>
              <button type="button" disabled={salvandoRenovacao || !dataValida(dataInicioRenovacao)}
                onClick={() => void confirmarRenovacao()} className="rounded-xl bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-50">
                {salvandoRenovacao ? "Salvando..." : "Confirmar e gerar ciclo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalAgendamento && perfilUsuario && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-emerald-100 bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {agendamentoSelecionado
                    ? "Editar agendamento"
                    : "Novo agendamento"}
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  {agendamentoSelecionado && estaConcluido(agendamentoSelecionado) ? "Banho concluído: somente o valor pode ser corrigido. Os pagamentos registrados serão preservados." : "Preencha os dados do atendimento."}
                </p>
              </div>

              <button
                type="button"
                onClick={fecharModalAgendamento}
                className="text-2xl text-gray-400 hover:text-gray-700"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="relative md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Pesquisar pet ou tutor
                </label>

                <input
                  type="text"
                  value={buscaPet}
                  disabled={Boolean(agendamentoSelecionado && estaConcluido(agendamentoSelecionado))}
                  onChange={(e) => {
                    setBuscaPet(e.target.value);
                    setPetSelecionado("");
                    setMostrarSugestoesPet(true);
                  }}
                  onFocus={() => setMostrarSugestoesPet(true)}
                  onBlur={() =>
                    setTimeout(
                      () => setMostrarSugestoesPet(false),
                      150
                    )
                  }
                  placeholder="Digite o nome do pet ou do tutor..."
                  autoComplete="off"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-500"
                />

                {mostrarSugestoesPet && petsFiltrados.length > 0 && (
                  <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                    {petsFiltrados.map((pet) => (
                      <button
                        key={pet.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selecionarPet(pet)}
                        className="block w-full border-b border-gray-100 px-4 py-3 text-left last:border-b-0 hover:bg-gray-50"
                      >
                        <span className="block font-semibold text-gray-900">
                          {pet.nome}
                        </span>

                        <span className="block text-sm text-gray-500">
                          Tutor: {pet.tutorNome}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {mostrarSugestoesPet &&
                  buscaPet.trim() &&
                  petsFiltrados.length === 0 && (
                    <div className="absolute z-20 mt-1 w-full rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500 shadow-lg">
                      Nenhum pet encontrado.
                    </div>
                  )}
              </div>

              {!agendamentoSelecionado && (
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Frequência do agendamento
                  </label>

                  <select
                    value={frequenciaAgendamento}
                    onChange={(e) =>
                      setFrequenciaAgendamento(
                        e.target.value as Frequencia
                      )
                    }
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-500"
                  >
                    <option value="Avulso">
                      Avulso — somente esta data
                    </option>

                    <option value="Quinzenal">
                      Quinzenal — 2 banhos, intervalo de 14 dias
                    </option>

                    <option value="Mensal">
                      Mensal — 4 banhos, intervalo de 7 dias
                    </option>
                  </select>

                  {frequenciaAgendamento !== "Avulso" && (
                    <p className="mt-2 text-sm text-amber-700">
                      Atenção: serão criados{" "}
                      {frequenciaAgendamento === "Quinzenal" ? 2 : 4}{" "}
                      agendamentos a partir da data escolhida.
                    </p>
                  )}
                </div>
              )}

              {agendamentoSelecionado && (
                <div className="md:col-span-2 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                  <h4 className="font-bold text-blue-950">📅 Como deseja reagendar?</h4>
                  <p className="mt-1 text-sm text-blue-800">Escolha se a mudança afeta um único banho ou todos os banhos do mesmo ciclo.</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <label className={`cursor-pointer rounded-xl border p-3 ${modoReagendamento === "unico" ? "border-blue-700 bg-white" : "border-blue-200"}`}>
                      <input type="radio" name="modo-reagendamento" checked={modoReagendamento === "unico"} onChange={() => setModoReagendamento("unico")} className="mr-2" />
                      <strong className="text-sm">Somente este banho</strong>
                      <p className="mt-1 text-xs text-slate-600">Os outros banhos permanecem como estão.</p>
                    </label>
                    <label className={`cursor-pointer rounded-xl border p-3 ${modoReagendamento === "ciclo" ? "border-blue-700 bg-white" : "border-blue-200"}`}>
                      <input type="radio" name="modo-reagendamento" checked={modoReagendamento === "ciclo"} onChange={() => setModoReagendamento("ciclo")} disabled={!cicloIdentificado || cicloTemConcluidos} className="mr-2" />
                      <strong className="text-sm">Todo o ciclo</strong>
                      <p className="mt-1 text-xs text-slate-600">Desloca todas as datas pelo mesmo número de dias e ajusta o turno.</p>
                    </label>
                  </div>
                  {!cicloIdentificado && ehPlano(agendamentoSelecionado) && <p className="mt-3 text-xs font-medium text-amber-800">Este pacote não pôde ser identificado com segurança. Você ainda pode alterar somente este banho.</p>}
                  {cicloTemConcluidos && <p className="mt-3 text-xs font-medium text-amber-800">Este ciclo possui banhos concluídos e não pode ser deslocado por inteiro.</p>}
                  {modoReagendamento === "ciclo" && cicloIdentificado && (
                    <div className="mt-4 rounded-xl bg-white p-3">
                      <p className="mb-2 text-sm font-bold text-slate-800">Prévia das novas datas</p>
                      {alteracoesCiclo.map(item => <div key={item.agendamento.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-2 text-sm last:border-0">
                        <span>{item.agendamento.numero_banho}º banho</span>
                        <span className="font-medium">{formatarDataLocal(item.agendamento.data)} → {formatarDataLocal(item.novaData)} • {item.novoHorario}</span>
                      </div>)}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Serviço
                </label>

                <select
                  disabled={Boolean(agendamentoSelecionado && estaConcluido(agendamentoSelecionado))}
                  value={servicoSelecionado}
                  onChange={(e) => {
                    const id = e.target.value;

                    setServicoSelecionado(id);

                    const item = servicos.find(
                      (servico) => servico.id === id
                    );

                    if (
                      item?.preco !== null &&
                      item?.preco !== undefined
                    ) {
                      setValorAgendamento(
                        String(item.preco).replace(".", ",")
                      );
                    }
                  }}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-500"
                >
                  <option value="">Selecione um serviço</option>

                  {servicos.map((servico) => (
                    <option key={servico.id} value={servico.id}>
                      {nomeServicoPadronizado(servico.nome)}
                    </option>
                  ))}
                </select>
              </div>

              {ehAdmin && <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  {agendamentoSelecionado ? "Valor — use o botão Corrigir valor para aplicar" : frequenciaAgendamento === "Avulso" ? "Valor do atendimento" : "Valor total do ciclo"}
                </label>

                <input
                  type="text"
                  inputMode="decimal"
                  value={valorAgendamento}
                  onChange={(e) =>
                    setValorAgendamento(e.target.value)
                  }
                  placeholder="0,00"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-500"
                />
              </div>}

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Data
                </label>

                <input
                  type="date"
                  value={dataAgendamento}
                  onChange={(e) => setDataAgendamento(e.target.value)}
                  disabled={Boolean(agendamentoSelecionado && estaConcluido(agendamentoSelecionado))}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Horário
                </label>

                <select
                  value={horarioAgendamento}
                  onChange={(e) =>
                    setHorarioAgendamento(e.target.value)
                  }
                  disabled={Boolean(agendamentoSelecionado && estaConcluido(agendamentoSelecionado))}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-500"
                >
                  <option value="08:00">08:00</option>
                  <option value="13:30">13:30</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Observações do serviço
                </label>

                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  disabled={Boolean(agendamentoSelecionado && estaConcluido(agendamentoSelecionado))}
                  rows={3}
                  placeholder="Observações do agendamento"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-500"
                />
              </div>
            </div>

            {ehAdmin && agendamentoSelecionado && (
              <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                <h4 className="font-bold text-emerald-950">Serviços extras deste banho</h4>
                <p className="mt-1 text-xs text-emerald-900">Adicionais cobrados à parte, sem alterar o valor do plano. Cada extra fica vinculado a este banho.</p>
                <div className="mt-3 space-y-2">
                  {extrasComprovantes.filter(extra => extra.agendamento_id === agendamentoSelecionado.id).length === 0 && (
                    <p className="text-sm text-gray-600">Nenhum adicional cadastrado.</p>
                  )}
                  {extrasComprovantes.filter(extra => extra.agendamento_id === agendamentoSelecionado.id).map(extra => (
                    <div key={extra.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-3 text-sm">
                      <span>{extra.nome_servico} — {formatarValor(Number(extra.valor))} ({extra.pagamento_status})</span>
                      {extra.pagamento_status === "Pendente" && (
                        <button type="button" disabled={salvandoExtra} onClick={() => void cancelarExtraAgendamento(extra)}
                          className="rounded-lg border border-rose-200 px-3 py-1 font-semibold text-rose-700 disabled:opacity-50">Cancelar extra</button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-sm font-semibold text-emerald-900">
                  Total de extras ativos: {formatarValor(extrasComprovantes.filter(extra => extra.agendamento_id === agendamentoSelecionado.id && extra.pagamento_status !== "Cancelado").reduce((total, extra) => total + Number(extra.valor || 0), 0))}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <select value={servicoExtraId} disabled={salvandoExtra}
                    onChange={e => { const id = e.target.value; setServicoExtraId(id); const servico = servicos.find(item => item.id === id); setValorExtra(servico?.preco == null ? "" : String(servico.preco).replace(".", ",")); }}
                    className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm">
                    <option value="">Selecione um serviço extra</option>
                    {servicos.map(servico => <option key={servico.id} value={servico.id}>{nomeServicoPadronizado(servico.nome)}</option>)}
                  </select>
                  <input type="text" inputMode="decimal" value={valorExtra} disabled={salvandoExtra}
                    onChange={e => setValorExtra(e.target.value)} placeholder="Valor (R$)"
                    className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm" />
                </div>
                {erroExtra && <p className="mt-2 text-sm text-red-700" role="alert">{erroExtra}</p>}
                <button type="button" disabled={salvandoExtra || !servicoExtraId}
                  onClick={() => void adicionarExtraAgendamento()}
                  className="mt-3 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  {salvandoExtra ? "Salvando..." : "+ Salvar serviço extra"}
                </button>
              </div>
            )}

            {ehAdmin && agendamentoSelecionado && <button type="button" disabled={salvandoValor || salvando} onClick={async () => { if (await salvarCorrecaoValor(agendamentoSelecionado, valorAgendamento)) { setModalAgendamento(false); setAgendamentoSelecionado(null); await carregarDados(); } }} className="mt-5 rounded-xl border border-emerald-600 px-4 py-3 font-semibold text-emerald-800 disabled:opacity-50">{salvandoValor ? "Salvando valor..." : "Corrigir valor do atendimento / ciclo"}</button>}
            {ehAdmin && agendamentoSelecionado && estaConcluido(agendamentoSelecionado) && (
              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="mb-3 text-sm text-amber-900">
                  Confirmou o comparecimento por engano? Você pode desfazer se não houver pagamento registrado. Os dados do agendamento ficam protegidos.
                </p>
                <button
                  type="button"
                  disabled={salvando}
                  onClick={() => void desfazerComparecimento(agendamentoSelecionado)}
                  className="rounded-xl border border-amber-500 px-4 py-2 font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                >
                  Desfazer comparecimento
                </button>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={fecharModalAgendamento}
                className="rounded-xl border border-emerald-200 px-5 py-3 font-medium text-emerald-800 hover:bg-emerald-50"
              >
                Cancelar
              </button>

              {!(agendamentoSelecionado && estaConcluido(agendamentoSelecionado)) && <button
                type="button"
                onClick={() => void salvarAgendamento()}
                disabled={salvando || salvandoValor}
                className="rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                  {salvando ? "Salvando..." : agendamentoSelecionado && modoReagendamento === "ciclo" ? "Confirmar ciclo completo" : "Salvar agendamento"}
              </button>}
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
