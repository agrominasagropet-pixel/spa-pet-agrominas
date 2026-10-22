"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
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
  "Banho Completo": "Banho",
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
  if (!horario) return "08:30";

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

function ajustarServicoPorBanho(
  servico: string | null | undefined,
  plano: string | null | undefined,
  numeroBanho: number | null | undefined
) {
  const nome = nomeServicoPadronizado(servico);
  if ((plano === "Mensal" || plano === "Quinzenal") && Number(numeroBanho) > 1) {
    return nome.replace(/banho\s*(?:\+|com)\s*tosa\s*higi[eê]nica/gi, "Banho");
  }
  return nome;
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

function abrirMensagemWhatsApp(numero: string, mensagem: string) {
  const telefone = normalizarTelefone(numero);
  if (!telefone) { alert("Este tutor não possui WhatsApp cadastrado."); return; }
  const parametros = new URLSearchParams({ phone: telefone, text: mensagem });
  const janela = window.open(`https://web.whatsapp.com/send/?${parametros.toString()}`, NOME_JANELA_WHATSAPP);
  if (janela) janela.focus();
  else alert("Permita pop-ups para abrir o WhatsApp Web.");
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

  const horarioFormatado = formatarHorario(horario || "08:30");
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
function normalizarStatusPagamento(status: string | null) {
  return (status || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// Impressão térmica AGROMINAS: valores de ciclos só são exibidos quando confiáveis.
type DadosPagamentoComprovante = {
  pago: boolean;
  forma: string | null;
  valor?: number | null;
};

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
      alert("A logo não foi carregada. Verifique se o arquivo PNG está na pasta public.");
    }, { once: true });
  } else {
    setTimeout(iniciarImpressao, 250);
  }
}

function imprimirComprovante(
  agendamento: Agendamento,
  servicoNome: string,
  pagamento: DadosPagamentoComprovante
) {
  const plano = Boolean(agendamento.plano && agendamento.plano !== "Avulso");
  // Nos planos desta Agenda, valor_total representa o pacote inteiro,
  // repetido em cada agendamento do mesmo ciclo.
  const valor = pagamento.valor ?? agendamento.valor_total;
  const nome = escaparHTMLComprovante;
  const identificacao = obterIdentificacaoBanho(agendamento);
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
    <div class="pagamento"><strong>${pagamento.pago ? "PAGO" : "PENDENTE / A CONFERIR"}</strong>${pagamento.pago && pagamento.forma ? `<span>${nome(pagamento.forma)}</span>` : ""}</div>
    ${plano ? `<div class="observacao">O valor indicado refere-se ao ciclo completo do plano, não apenas ao banho desta data.${valor === null || valor === undefined ? " Confira o valor total do plano no cadastro antes de cobrar." : ""}</div>` : ""}`;
  documentoComprovante(dados, "COMPROVANTE DE ATENDIMENTO");
}

function imprimirComprovanteGrupo(
  tutorNome: string,
  data: string,
  horario: string,
  itens: ItemComprovanteGrupo[],
  mostrarValores = true
) {
  if (itens.length === 0) return;
  const nome = escaparHTMLComprovante;
  const ciclosContabilizados = new Set<string>();
  let totalPago = 0;
  let totalPendente = 0;
  let faltamValores = false;
  const linhas = itens.map((item, indice) => {
    // Não agrupar ciclos antigos sem identificador: podem ser ciclos diferentes.
    const chave = item.plano && item.ciclo !== null
      ? `${item.petId}|${item.ciclo}` : `item-${indice}`;
    const repetido = ciclosContabilizados.has(chave);
    ciclosContabilizados.add(chave);
    if (!repetido) {
      if (item.valor === null || !Number.isFinite(item.valor)) faltamValores = true;
      else if (item.pago) totalPago += item.valor;
      else totalPendente += item.valor;
    }
    const tipo = item.plano ? `Plano ${item.tipoPlano || ""}${item.ciclo !== null ? ` • Ciclo ${item.ciclo}` : ""}` : "Atendimento avulso";
    return `<div class="pet">
      <div class="nome-pet">${nome(item.petNome)}</div>
      <div>${nome(item.servicoNome)}</div>
      <div class="detalhe">${nome(tipo)}</div>
      ${item.identificacao ? `<div class="detalhe">${nome(item.identificacao)}</div>` : ""}
      ${mostrarValores ? `<div class="linha"><span class="rotulo">${item.plano ? "Total do ciclo" : "Valor"}</span><span class="valor"><strong>${nome(valorComprovante(item.valor))}</strong></span></div>` : ""}
      ${mostrarValores ? `<div class="detalhe"><strong>${item.pago ? "PAGO" : "PENDENTE"}</strong>${item.pago && item.forma ? ` • ${nome(item.forma)}` : ""}</div>` : ""}
      ${mostrarValores && repetido ? `<div class="observacao">Mesmo ciclo: valor contabilizado uma única vez.</div>` : ""}
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
    ${mostrarValores ? `<div class="linha"><span class="rotulo">VALORES JÁ PAGOS</span><span class="valor"><strong>${formatarValor(totalPago)}</strong></span></div>
    <div class="etiqueta" style="text-align:center;margin-top:10px">TOTAL PENDENTE${faltamValores ? " CONHECIDO" : ""}</div>
    <div class="montante">${formatarValor(totalPendente)}</div>
    ${faltamValores ? `<div class="observacao"><strong>ATENÇÃO:</strong> Há valores de ciclos/serviços a conferir. O total acima está incompleto; não utilize como valor final de cobrança.</div>` : ""}
    <div class="observacao">Planos: os valores são referentes ao ciclo completo e cada ciclo identificado é somado apenas uma vez.</div>` : ""}`;
  documentoComprovante(dados, "COMPROVANTE CONJUNTO");
}

export default function AgendaPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [pagamentosPlanos, setPagamentosPlanos] = useState<PagamentoPlano[]>([]);
  const [carregando, setCarregando] = useState(true);
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
  const [horarioAgendamento, setHorarioAgendamento] = useState("08:30");
  const [observacoes, setObservacoes] = useState("");
  const [valorAgendamento, setValorAgendamento] = useState("");
  const [salvandoValor, setSalvandoValor] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [renovacao, setRenovacao] = useState<Agendamento | null>(null);
  const [renovacoesGrupo, setRenovacoesGrupo] = useState<Agendamento[]>([]);
  const [tutorRenovacao, setTutorRenovacao] = useState<{ nome: string; whatsapp: string } | null>(null);
  const [dataInicioRenovacao, setDataInicioRenovacao] = useState("");
  const [horarioRenovacao, setHorarioRenovacao] = useState("08:30");
  const [salvandoRenovacao, setSalvandoRenovacao] = useState(false);
  const registroAtendimentoEmAndamento = useRef(false);
  const [modoReagendamento, setModoReagendamento] = useState<"unico" | "ciclo">("unico");
  const [buscaAgenda, setBuscaAgenda] = useState("");
  const [perfilUsuario, setPerfilUsuario] = useState<"admin" | "operacional" | null>(null);
  const ehAdmin = perfilUsuario === "admin";

  useEffect(() => {
    void carregarDados();
  }, []);

  // Recarrega ao voltar de outra aba, para refletir pagamentos feitos no sistema.
  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState === "visible" && !registroAtendimentoEmAndamento.current) {
        void carregarDados();
      }
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, []);

  async function carregarDados() {
    setCarregando(true);

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
      ] = await Promise.all([
        supabase
          .from("clientes")
          .select("id, nome, whatsapp, telefone")
          .order("nome"),
        supabase
          .from("pets")
          .select("id, nome, cliente_id, sexo")
          .order("nome"),
        supabase
          .from("servicos")
          .select("id, nome, preco, duracao_minutos")
          .order("nome"),
        supabase
          .from("agendamentos")
          .select(
            "id, pet_id, servico_id, data, horario, status, observacoes, valor_total, servico_nome, plano, numero_banho, ciclo, pagamento_status, forma_pagamento_plano"
          )
          .order("data")
          .order("horario"),
        administrador
          ? supabase
              .from("atendimentos")
              .select("id, agendamento_id, pet_id, data, valor, forma_pagamento")
              .order("data")
          : supabase
              .from("atendimentos")
              .select("id, agendamento_id, pet_id, data")
              .order("data"),
        administrador
          ? supabase.from("pagamentos_planos")
              .select("id, pet_id, ciclo, valor, forma_pagamento, data_pagamento")
              .order("data_pagamento")
          : Promise.resolve({ data: [] as PagamentoPlano[], error: null }),
      ]);

      if (clientesR.error) console.error(clientesR.error);
      if (petsR.error) console.error(petsR.error);
      if (servicosR.error) console.error(servicosR.error);
      if (agendamentosR.error) console.error(agendamentosR.error);
      if (atendimentosR.error) console.error(atendimentosR.error);
      if (pagamentosR.error) {
        console.error("Erro ao carregar pagamentos:", pagamentosR.error);
      }

      const listaClientes = (clientesR.data || []) as Cliente[];
      const listaPetsBanco = petsR.data || [];
      const listaServicos = (servicosR.data || []) as Servico[];
      const listaAgendamentos = (agendamentosR.data || []) as Agendamento[];
      const registrosAtendimentos = (atendimentosR.data || []) as unknown as Array<
        Pick<Atendimento, "id" | "agendamento_id" | "pet_id" | "data"> &
          Partial<Pick<Atendimento, "valor" | "forma_pagamento">>
      >;
      const listaAtendimentos: Atendimento[] = registrosAtendimentos.map(
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

      const petsFormatados: Pet[] = listaPetsBanco.map((pet: any) => {
        const cliente = listaClientes.find(
          (item) => item.id === pet.cliente_id
        );

        return {
          id: pet.id,
          nome: pet.nome,
          cliente_id: pet.cliente_id,
          sexo: pet.sexo || null,
          whatsapp: cliente?.whatsapp || cliente?.telefone || "",
          tutorNome: cliente?.nome || "Tutor não informado",
        };
      });

      const agendamentosFormatados = listaAgendamentos.map((agendamento) => {
        const pet = petsFormatados.find(
          (item) => item.id === agendamento.pet_id
        );

        return {
          ...agendamento,
          petNome: pet?.nome || "Pet",
          tutorNome: pet?.tutorNome || "Tutor não informado",
          whatsapp: pet?.whatsapp || "",
        };
      });

      setClientes(listaClientes);
      setPets(petsFormatados);
      setServicos(listaServicos);
      setAgendamentos(agendamentosFormatados);
      setAtendimentos(listaAtendimentos);
      setPagamentosPlanos(listaPagamentos);
    } catch (erro) {
      setPerfilUsuario(null);
      setClientes([]); setPets([]); setServicos([]);
      setAgendamentos([]); setAtendimentos([]); setPagamentosPlanos([]);
      console.error("Erro ao carregar a agenda:", erro);
      alert("Não foi possível carregar todos os dados da agenda.");
    } finally {
      setCarregando(false);
    }
  }

  function obterNomeServico(agendamento: Agendamento) {
    return nomeServicoPadronizado(
      ajustarServicoPorBanho(
        agendamento.servico_nome ||
          servicos.find((item) => item.id === agendamento.servico_id)?.nome,
        agendamento.plano,
        agendamento.numero_banho
      )
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
    if (ehPlano(agendamento)) {
      const pagamento = pagamentosPlanos.find(
        (item) =>
          item.pet_id === agendamento.pet_id &&
          item.ciclo === agendamento.ciclo
      );

      if (pagamento) {
        return {
          pago: true,
          texto: "PAGO",
          forma: pagamento.forma_pagamento,
          valor: Number(pagamento.valor),
        };
      }

      if (
        normalizarStatusPagamento(agendamento.pagamento_status) === "pago"
      ) {
        return {
          pago: true,
          texto: "A CONFERIR",
          forma: agendamento.forma_pagamento_plano || null,
          valor: agendamento.valor_total,
        };
      }

      return {
        pago: false,
        texto: "NÃO PAGO",
        forma: null,
        valor: agendamento.valor_total,
      };
    }

    const atendimento = atendimentos.find(
      (item) => item.agendamento_id === agendamento.id
    );

    const pago = Boolean(atendimento?.forma_pagamento);

    return {
      pago,
      texto: pago ? "PAGO" : "NÃO PAGO",
      forma: atendimento?.forma_pagamento || null,
      valor: atendimento?.valor ?? agendamento.valor_total,
    };
  }

  // Renovação manual: somente no último banho do ciclo mais recente.
  // Não gera agenda anual nem modifica registros de ciclos anteriores.
  function podeRenovarCiclo(ag: Agendamento) {
    if (estaCancelado(ag) || !ehPlano(ag)) return false;
    const total = ag.plano === "Quinzenal" ? 2 : ag.plano === "Mensal" ? 4 : 0;
    if (!total || ag.numero_banho !== total || ag.ciclo === null) return false;
    const ciclos = agendamentos.filter(a =>
      a.pet_id === ag.pet_id && a.ciclo !== null && !estaCancelado(a)
    );
    const maiorCiclo = Math.max(0, ...ciclos.map(a => Number(a.ciclo) || 0));
    if (Number(ag.ciclo) !== maiorCiclo) return false;
    // Não permitir renovação enquanto houver banhos anteriores pendentes.
    const doCiclo = ciclos.filter(a => a.ciclo === ag.ciclo);
    // Aceita registros históricos repetidos, mas exige todos os banhos numerados
    // concluídos. Um ciclo posterior continua impedindo nova renovação.
    if (!Array.from({ length: total }, (_, i) => i + 1).every(n =>
      doCiclo.some(a => Number(a.numero_banho) === n && estaConcluido(a))
    )) return false;
    if (doCiclo.some(a => !estaConcluido(a))) return false;
    return true;
  }

  // Botão de aviso em todo primeiro banho de pacote Mensal/Quinzenal, inclusive ciclo 1.
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
      const valor = valorSugerido(ag);
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

  function abrirRenovacaoGrupo(grupo: GrupoTutor) {
    const elegiveis = grupo.agendamentos.filter(a => podeRenovarCiclo(a));
    const unicos = elegiveis.filter((a, indice) => elegiveis.findIndex(b => b.pet_id === a.pet_id) === indice);
    if (!unicos.length) return;
    const primeiro = unicos[0];
    const intervalo = primeiro.plano === "Quinzenal" ? 14 : 7;
    setDataInicioRenovacao(adicionarDias(primeiro.data, intervalo));
    setHorarioRenovacao(formatarHorario(primeiro.horario));
    setRenovacoesGrupo(unicos);
    setTutorRenovacao({ nome: grupo.tutorNome, whatsapp: grupo.whatsapp });
    setRenovacao(primeiro);
  }

  function abrirRenovacao(ag: Agendamento) {
    if (!podeRenovarCiclo(ag)) {
      alert("Conclua os banhos do ciclo atual antes de renovar.");
      return;
    }
    const intervalo = ag.plano === "Quinzenal" ? 14 : 7;
    setDataInicioRenovacao(adicionarDias(ag.data, intervalo));
    setHorarioRenovacao(formatarHorario(ag.horario));
    setRenovacoesGrupo([ag]);
    setTutorRenovacao({ nome: ag.tutorNome || "Tutor", whatsapp: ag.whatsapp || "" });
    setRenovacao(ag);
  }

  const quantidadeRenovacao = renovacao?.plano === "Quinzenal" ? 2 : 4;
  const intervaloRenovacao = renovacao?.plano === "Quinzenal" ? 14 : 7;
  const datasRenovacao = renovacao && dataValida(dataInicioRenovacao)
    ? Array.from({ length: quantidadeRenovacao }, (_, i) =>
        adicionarDias(dataInicioRenovacao, i * intervaloRenovacao))
    : [];

  async function confirmarRenovacao() {
    if (!renovacao || salvandoRenovacao || !perfilUsuario) return;
    const selecionados = renovacoesGrupo.length ? renovacoesGrupo : [renovacao];
    if (!selecionados.every(podeRenovarCiclo)) {
      alert("Há ciclos que não estão prontos para renovação. Atualize a Agenda."); return;
    }
    if (!dataValida(dataInicioRenovacao) || !["08:30", "13:30"].includes(horarioRenovacao)) {
      alert("Informe uma data e um turno válidos."); return;
    }
    const planos = selecionados.map(ag => {
      const quantidade = ag.plano === "Quinzenal" ? 2 : 4;
      const intervalo = ag.plano === "Quinzenal" ? 14 : 7;
      return {
        ag,
        ciclo: Number(ag.ciclo) + 1,
        datas: Array.from({ length: quantidade }, (_, i) => adicionarDias(dataInicioRenovacao, i * intervalo))
      };
    });
    if (planos.some(item => dataInicioRenovacao <= item.ag.data)) {
      alert("O novo ciclo precisa começar depois do último banho de todos os pets."); return;
    }
    const previa = planos.map(item =>
      `${item.ag.petNome} — ${item.ag.plano} (ciclo ${item.ciclo})\n` +
      item.datas.map((data, i) => `${i + 1}º banho: ${formatarDataLocal(data)} às ${horarioRenovacao}`).join("\n")
    ).join("\n\n");
    if (!window.confirm(`Confirmar renovação?\n\n${previa}\n\nO pagamento ficará pendente.`)) return;
    setSalvandoRenovacao(true);
    try {
      // Valida todos os pets antes de criar qualquer agendamento.
      for (const item of planos) {
        const { data: existentes, error } = await supabase.from("agendamentos")
          .select("id, ciclo, data, numero_banho, status").eq("pet_id", item.ag.pet_id);
        if (error) throw error;
        const ativos = (existentes || []).filter(a =>
          !["cancelado", "cancelada"].includes(statusNormalizado(a.status)));
        if (ativos.some(a => a.ciclo !== null && Number(a.ciclo) >= item.ciclo))
          throw new Error(`Já existe ciclo posterior para ${item.ag.petNome}.`);
        if (ativos.some(a => item.datas.includes(a.data)))
          throw new Error(`Já existe banho agendado nas novas datas para ${item.ag.petNome}.`);
        const origem = ativos.filter(a => Number(a.ciclo) === Number(item.ag.ciclo));
        const concluidoNoBanco = (a: typeof origem[number]) =>
          ["concluido", "finalizado"].includes(statusNormalizado(a.status)) ||
          atendimentos.some(at => at.agendamento_id === a.id);
        if (origem.some(a => !concluidoNoBanco(a)) ||
            !item.datas.every((_, i) => origem.some(a => Number(a.numero_banho) === i + 1 && concluidoNoBanco(a))))
          throw new Error(`O ciclo de ${item.ag.petNome} não está completamente concluído.`);
      }
      const registros = planos.flatMap(item => {
        const primeiroBanho = agendamentos.find(a => a.pet_id === item.ag.pet_id &&
          a.ciclo === item.ag.ciclo && a.numero_banho === 1);
        const servicoBase = primeiroBanho?.servico_nome || item.ag.servico_nome ||
          servicos.find(s => s.id === item.ag.servico_id)?.nome || null;
        return item.datas.map((data, i) => ({
          pet_id: item.ag.pet_id,
          servico_id: item.ag.servico_id,
          servico_nome: ajustarServicoPorBanho(servicoBase, item.ag.plano, i + 1) || null,
          observacoes: item.ag.observacoes,
          valor_total: valorSugerido(item.ag),
          data, horario: horarioRenovacao, status: "Agendado",
          plano: item.ag.plano, numero_banho: i + 1, ciclo: item.ciclo,
          pagamento_status: "Pendente", forma_pagamento_plano: null
        }));
      });
      const { data: inseridos, error: erroInsercao } = await supabase
        .from("agendamentos").insert(registros).select("id");
      if (erroInsercao) throw erroInsercao;
      if (inseridos?.length !== registros.length)
        throw new Error("A gravação não foi confirmada integralmente. Confira a agenda.");
      const tutor = tutorRenovacao;
      setRenovacao(null);
      setRenovacoesGrupo([]);
      setTutorRenovacao(null);
      await carregarDados();
      alert(`${planos.length} ${planos.length === 1 ? "ciclo renovado" : "ciclos renovados"}! ${registros.length} banhos agendados.`);
      if (tutor?.whatsapp && window.confirm("Deseja abrir o WhatsApp com as próximas datas dos banhos?")) {
        const valoresPlanos = planos.map(item => valorSugerido(item.ag));
        const totalConfirmado = valoresPlanos.every(v => v !== null && v !== undefined && Number(v) > 0);
        const totalPacotes = valoresPlanos.reduce<number>((s, v) => s + (Number(v) > 0 ? Number(v) : 0), 0);
        const mensagem = [
          `Olá, ${tutor.nome}! 🐾💚`, "",
          "Os novos banhos foram agendados no SPA PET AGROMINAS! 🐶🛁", "",
          ...planos.flatMap((item, indice) => [
            `🐾 ${item.ag.petNome} — Plano ${item.ag.plano}`,
            ...item.datas.map((data, i) => `📅 ${i + 1}º banho: ${formatarDataLocal(data)} às ${horarioRenovacao}`),
            `💰 Valor do pacote: ${Number(valoresPlanos[indice]) > 0 ? formatarValor(valoresPlanos[indice]) : "A confirmar"}`,
            ""
          ]),
          `💚 Valor total: ${totalConfirmado ? formatarValor(totalPacotes) : "A confirmar (há pacote sem valor cadastrado)"}`,
          "", "Agradecemos pela confiança e esperamos vocês! 💚🐾"
        ].join("\n");
        abrirMensagemWhatsApp(tutor.whatsapp, mensagem);
      }
    } catch (erro: any) {
      console.error("Erro ao renovar ciclos:", erro);
      alert(erro?.message || "Não foi possível renovar os ciclos.");
      await carregarDados();
    } finally { setSalvandoRenovacao(false); }
  }

  function abrirNovoAgendamento(data?: string) {
    setAgendamentoSelecionado(null);
    setPetSelecionado("");
    setBuscaPet("");
    setMostrarSugestoesPet(false);
    setFrequenciaAgendamento("Avulso");
    setServicoSelecionado("");
    setDataAgendamento(data || dataSelecionada);
    setHorarioAgendamento("08:30");
    setObservacoes("");
    setValorAgendamento("");
    setModoReagendamento("unico");
    setModalAgendamento(true);
  }

  // Para pacotes, o valor pertence ao ciclo inteiro, não a um banho isolado.
  function banhosDoMesmoCiclo(ag: Agendamento) {
    if (!ehPlano(ag)) return [ag];
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
    if (!ehAdmin || salvandoValor) return false;
    const texto = textoDigitado.trim();
    const valor = Number(texto.replace(",", "."));
    if (!texto || !/^\d+(?:[,.]\d{1,2})?$/.test(texto) || !Number.isFinite(valor)) {
      alert("Informe um valor válido, por exemplo 180,00."); return false;
    }
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
    } catch (erro: any) {
      console.error("Erro ao corrigir valor:", erro);
      alert(erro?.message || "Não foi possível corrigir o valor.");
      await carregarDados();
      return false;
    } finally { setSalvandoValor(false); }
  }

  function abrirEdicao(agendamento: Agendamento) {
    setAgendamentoSelecionado(agendamento);
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
      valorSugerido(agendamento) !== null
        ? String(valorSugerido(agendamento)).replace(".", ",")
        : ""
    );

    setModoReagendamento("unico");
    setModalAgendamento(true);
  }

  function fecharModalAgendamento() {
    if (salvando) return;

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
      if (!ehAdmin) return;
      if (dataAgendamento !== agendamentoSelecionado.data ||
          formatarHorario(horarioAgendamento) !== formatarHorario(agendamentoSelecionado.horario) ||
          observacoes !== (agendamentoSelecionado.observacoes || "")) {
        alert("Em banhos concluídos, somente o valor pode ser alterado.");
        return;
      }
      const ok = await salvarCorrecaoValor(agendamentoSelecionado, valorAgendamento);
      if (ok) { setModalAgendamento(false); setAgendamentoSelecionado(null); }
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

      const valor = agendamentoSelecionado
        ? agendamentoSelecionado.valor_total
        : !ehAdmin
          ? (servico?.preco ?? null)
          : valorAgendamento.trim() === ""
            ? null
            : Number(valorAgendamento.replace(",", "."));

      if (valor !== null && (!Number.isFinite(valor) || valor < 0)) {
        alert("Informe um valor válido.");
        return;
      }

      // Na edição/reagendamento, serviço, pet e valor são preservados exatamente
      // como foram registrados. A agenda não deve recalcular preços do cadastro
      // nem substituir o serviço específico do banho (ex.: 2º banho sem higiênica).
      const dadosBase = agendamentoSelecionado
        ? {
            horario: formatarHorario(horarioAgendamento),
            observacoes: observacoes || null,
          }
        : {
            pet_id: petSelecionado,
            servico_id: servicoSelecionado || null,
            horario: formatarHorario(horarioAgendamento),
            status: "Agendado",
            observacoes: observacoes || null,
            valor_total: valor,
            servico_nome: servico?.nome || null,
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
              servico_nome: ajustarServicoPorBanho(
                dadosBase.servico_nome, frequenciaAgendamento, i + 1
              ) || null,
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

      if (agendamentoSelecionado && ehAdmin &&
          valorAgendamento.trim() !== "" &&
          Number(valorAgendamento.replace(",", ".")) !== agendamentoSelecionado.valor_total) {
        const ok = await salvarCorrecaoValor(agendamentoSelecionado, valorAgendamento);
        if (!ok) {
          alert("As alterações do agendamento podem ter sido salvas, mas o valor não foi confirmado. Confira antes de continuar.");
          return;
        }
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
    } catch (erro: any) {
      console.error("Erro ao salvar agendamento:", erro);

      alert(
        "Não foi possível salvar o agendamento.\n\n" +
          (erro?.message || "Verifique os dados e tente novamente.")
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
    } catch (erro: any) {
      console.error("Erro ao desfazer comparecimento:", erro);
      alert(erro?.message || "Não foi possível desfazer o comparecimento.");
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
      // Atualização local: mantém a lista montada, a posição de rolagem e a ordem.
      setAgendamentos(anteriores => anteriores.map(item =>
        item.id === ag.id ? { ...item, status: "Concluído" } : item
      ));
      setAtendimentos(anteriores => [...anteriores, {
        id: insercao.data![0].id,
        agendamento_id: ag.id,
        pet_id: ag.pet_id,
        data: ag.data,
        valor: ehAdmin ? (ag.valor_total ?? 0) : null,
        forma_pagamento: null,
      }]);
    } catch (erro: any) {
      console.error("Erro ao concluir atendimento:", erro);
      alert(erro?.message || "Não foi possível concluir o atendimento.");
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
      formatarHorario(a.horario).localeCompare(formatarHorario(b.horario)) ||
      (a.tutorNome || "").localeCompare(b.tutorNome || "", "pt-BR") ||
      (a.petNome || "").localeCompare(b.petNome || "", "pt-BR") ||
      a.id.localeCompare(b.id)
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
        item.data === data
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

  // Agenda de trabalho do SPA: somente informações operacionais.
  // A imagem é copiada, não salva no computador.
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
    const larguras = [46, 265, 170, 180, 440, 315];
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
      { titulo: "MANHÃ", horario: "08:30", linhas: [] },
      { titulo: "TARDE", horario: "13:30", linhas: [] },
    ];

    for (const ag of lista) {
      const plano = ag.plano === "Mensal" || ag.plano === "Quinzenal" ? ag.plano : "Avulso";
      const banho = ag.numero_banho ? `${ag.numero_banho}º${ag.ciclo && ag.ciclo > 1 ? ` / C${ag.ciclo}` : ""}` : "1º";
      const textosBase = ["", ag.tutorNome || "Tutor não informado", ag.petNome || "Pet",
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
    escrever(nomeDiaSelecionado, 692, 121, "#d1fae5", "26px Arial, sans-serif");
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
    const concluido = estaConcluido(agendamento);
    const cancelado = estaCancelado(agendamento);
    const pagamento = ehAdmin ? obterPagamentoDoCiclo(agendamento) : null;
    const rotuloPagamento = !pagamento ? null : pagamento.texto === "PAGO" ? "Pago" : pagamento.texto === "A CONFERIR" ? "A conferir" : "Em aberto";

    const pet = pets.find(
      (item) => item.id === agendamento.pet_id
    );

    const identificacao = obterIdentificacaoBanho(agendamento);

    return (
      <div
        key={agendamento.id}
        className={`rounded-2xl border border-l-4 p-5 shadow-sm transition-all hover:shadow-md md:p-6 ${cancelado ? "border-rose-200 border-l-rose-400 bg-rose-50/70 opacity-80" : concluido ? "border-emerald-200 border-l-emerald-500 bg-emerald-50/50" : "border-slate-200 border-l-amber-400 bg-white"}`}
      >
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-lg text-emerald-700 shadow-sm ring-1 ring-emerald-100">
              🐾
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-base font-extrabold tracking-tight text-slate-900">
                  {agendamento.petNome || "Pet"}
                </h4>
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-extrabold tracking-wide ${agendamento.plano === "Mensal" ? "border-violet-200 bg-violet-50 text-violet-700" : agendamento.plano === "Quinzenal" ? "border-sky-200 bg-sky-50 text-sky-700" : "border-slate-200 bg-slate-100 text-slate-700"}`}>
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
                  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-extrabold ${pagamento?.texto === "PAGO" ? "border-emerald-200 bg-emerald-100 text-emerald-800" : pagamento?.texto === "A CONFERIR" ? "border-yellow-300 bg-yellow-50 text-yellow-900" : "border-orange-200 bg-orange-100 text-orange-800"}`}>
                    {pagamento?.texto === "PAGO" ? "✓ " : pagamento?.texto === "A CONFERIR" ? "⚠ " : "○ "}{rotuloPagamento}
                  </span>
                )}
              </div>

              {identificacao && (
                <p className="mt-1 text-sm font-semibold text-emerald-700">
                  🛁 {identificacao}
                </p>
              )}

              <p className="mt-2 text-sm font-semibold text-slate-700">🛁 {obterNomeServico(agendamento)}</p>
              {ehAdmin && <p className="mt-1 text-sm text-slate-600">{ehPlano(agendamento) ? "Valor do ciclo" : "Valor do atendimento"}: <strong>{pagamento?.valor == null ? "A conferir" : formatarValor(pagamento.valor)}</strong></p>}
              {agendamento.observacoes?.trim() && (
                <p className="mt-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-700">📝 {agendamento.observacoes.trim()}</p>
              )}

            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-slate-200/80 pt-4">
            {ehAdmin && pagamento && <button
              type="button"
              disabled={cancelado}
              onClick={() =>
                imprimirComprovante(
                  agendamento,
                  obterNomeServico(agendamento),
                  pagamento
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
        className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 shadow-sm md:p-5"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-xl shadow-sm">
              👤
            </div>

            <div>
              <h4 className="text-base font-extrabold text-slate-900">
                {grupo.tutorNome}
              </h4>

              <p className="text-sm text-gray-500">
                {grupo.horario} • {grupo.agendamentos.length}{" "}
                {grupo.agendamentos.length === 1 ? "pet" : "pets"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(() => {
              const ativos = grupo.agendamentos.filter(a => !estaCancelado(a));
              const todosProntos = ativos.length > 0 && ativos.every(estaConcluido);
              const renovaveis = ativos.filter(a => podeRenovarCiclo(a));
              const avisaveis = ativos.filter(ehPrimeiroBanhoDeRenovacao);
              return <>
                {todosProntos && <button type="button"
                  disabled={!grupo.whatsapp}
                  onClick={() => avisarPetsProntos(grupo.whatsapp, grupo.tutorNome,
                    ativos.map(a => ({ nome: a.petNome || "Pet", sexo: pets.find(p => p.id === a.pet_id)?.sexo || null })))}
                  className="rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-40">
                  🐶 {ativos.length > 1 ? "Pets prontos" : "Pet pronto"}
                </button>}
                {avisaveis.length > 0 && <button type="button"
                  disabled={!grupo.whatsapp}
                  onClick={() => avisarRenovacaoWhatsApp(grupo)}
                  className="rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-bold text-sky-900 hover:bg-sky-100 disabled:opacity-40">
                  📲 Enviar renovação
                </button>}
                {renovaveis.length > 0 && <button type="button"
                  disabled={salvandoRenovacao}
                  onClick={() => abrirRenovacaoGrupo(grupo)}
                  className="rounded-xl border border-emerald-600 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50">
                  🔄 Renovar {renovaveis.length > 1 ? "ciclos" : "ciclo"}
                </button>}
              </>;
            })()}
            {grupo.agendamentos.filter(a => !estaCancelado(a)).length > 1 && (
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
                      valor: pagamento.valor ?? agendamento.valor_total,
                      pago: pagamento.pago,
                      forma: pagamento.forma,
                      plano,
                      tipoPlano: agendamento.plano,
                      ciclo: agendamento.ciclo,
                      petId: agendamento.pet_id,
                    };
                  }),
                  ehAdmin
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

  const agendamentosAtivosDoDia = agendamentos.filter(
    (item) => item.data === dataSelecionada && !estaCancelado(item)
  );
  const totalDia = agendamentosAtivosDoDia.length;
  const concluidosDia = agendamentosAtivosDoDia.filter(estaConcluido).length;
  const pendentesDia = totalDia - concluidosDia;
  const pagosDia = ehAdmin ? agendamentosAtivosDoDia.filter(
    (item) => obterPagamentoDoCiclo(item).texto === "PAGO"
  ).length : 0;
  const abertosDia = ehAdmin ? agendamentosAtivosDoDia.filter(
    (item) => obterPagamentoDoCiclo(item).texto === "NÃO PAGO"
  ).length : 0;
  const conferirDia = ehAdmin ? agendamentosAtivosDoDia.filter(
    (item) => obterPagamentoDoCiclo(item).texto === "A CONFERIR"
  ).length : 0;
  const planosDia = agendamentosAtivosDoDia.filter(
    (item) => item.plano === "Mensal" || item.plano === "Quinzenal"
  ).length;
  const nomeDiaSelecionado = (() => {
    const [ano, mes, dia] = dataSelecionada.split("-").map(Number);
    return new Date(ano, mes - 1, dia).toLocaleDateString("pt-BR", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    });
  })();
  const quantidadePorDia = new Map<string, number>();
  agendamentos.forEach((item) => {
    if (!estaCancelado(item)) quantidadePorDia.set(item.data, (quantidadePorDia.get(item.data) || 0) + 1);
  });

  return (
    <main className="min-h-screen bg-[#f5f7f8]">
      <div className="flex min-h-screen">
        <MenuLateral />

        <section className="min-w-0 flex-1 px-4 py-6 md:px-7 md:py-8 xl:px-10">
          <div className="mx-auto max-w-[1560px]">
            <header className="relative mb-6 overflow-hidden rounded-[28px] bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-800 p-6 text-white shadow-lg shadow-emerald-950/10 md:p-8">
              <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border-[45px] border-white/5" />
              <div className="pointer-events-none absolute -bottom-24 right-40 h-52 w-52 rounded-full bg-emerald-400/10 blur-2xl" />
              <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold tracking-[0.12em] text-emerald-50">
                    🐾 SPA PET AGROMINAS <span className="text-emerald-300">/</span> BANHO E TOSA
                  </p>
                  <h1 className="text-3xl font-black tracking-tight md:text-4xl">Agenda de atendimentos</h1>
                  <p className="mt-2 max-w-2xl text-sm text-emerald-100 md:text-base">Organize os pets, acompanhe os banhos e gerencie os planos em um só lugar.</p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
                  <button type="button" onClick={() => void compartilharAgendaImagem()}
                    disabled={carregando || totalDia === 0}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-white/40 bg-white/15 px-5 py-3.5 text-sm font-extrabold text-white transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-40">
                    📲 Compartilhar agenda
                  </button>
                  <button type="button" onClick={() => abrirNovoAgendamento()}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-extrabold text-emerald-900 shadow-md transition hover:-translate-y-0.5 hover:bg-emerald-50 hover:shadow-lg">
                    <span className="text-xl leading-none">+</span> Novo agendamento
                  </button>
                </div>
              </div>
            </header>

            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
              {[
                { titulo: "Pets do dia", valor: totalDia, detalhe: "agendamentos ativos", icone: "🐾", cor: "bg-emerald-50 text-emerald-800" },
                { titulo: "Ainda não vieram", valor: pendentesDia, detalhe: "aguardando atendimento", icone: "⏳", cor: "bg-amber-50 text-amber-800" },
                { titulo: "Compareceram", valor: concluidosDia, detalhe: "atendimentos registrados", icone: "✓", cor: "bg-teal-50 text-teal-800" },
                { titulo: "Em planos", valor: planosDia, detalhe: "quinzenais e mensais", icone: "✦", cor: "bg-violet-50 text-violet-800" },
                ...(ehAdmin ? [
                  { titulo: "Pagos", valor: pagosDia, detalhe: "pagamentos confirmados", icone: "✓", cor: "bg-emerald-50 text-emerald-800" },
                  { titulo: "Em aberto", valor: abertosDia, detalhe: "pagamentos não registrados", icone: "R$", cor: "bg-orange-50 text-orange-800" },
                  ...(conferirDia ? [{ titulo: "A conferir", valor: conferirDia, detalhe: "registros antigos sem confirmação", icone: "!", cor: "bg-yellow-50 text-yellow-800" }] : []),
                ] : []),
              ].map((indicador) => (
                <div key={indicador.titulo} className="rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-sm md:p-5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold text-slate-500 md:text-sm">{indicador.titulo}</span>
                    <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg font-bold ${indicador.cor}`}>{indicador.icone}</span>
                  </div>
                  <div className="mt-2 text-3xl font-black tracking-tight text-slate-900">{carregando ? "—" : indicador.valor}</div>
                  <p className="mt-1 text-xs text-slate-500">{indicador.detalhe}</p>
                </div>
              ))}
            </div>

            <div className="grid items-start gap-6 xl:grid-cols-[330px_minmax(0,1fr)]">
              <aside className="space-y-4 xl:sticky xl:top-6">
                <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-5 flex items-center justify-between gap-2">
                    <button type="button" onClick={() => mudarMes(-1)} aria-label="Mês anterior"
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-lg text-slate-600 transition hover:bg-slate-50">‹</button>
                    <h2 className="text-center text-base font-extrabold capitalize text-slate-900">{nomeMes}</h2>
                    <button type="button" onClick={() => mudarMes(1)} aria-label="Próximo mês"
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-lg text-slate-600 transition hover:bg-slate-50">›</button>
                  </div>
                  <div className="mb-2 grid grid-cols-7 text-center text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((dia) => <span key={dia}>{dia}</span>)}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {diasDoMes.map((dia, index) => {
                      if (dia === null) return <div key={`vazio-${index}`} className="h-11" />;
                      const data = `${mesAtual.getFullYear()}-${String(mesAtual.getMonth() + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
                      const selecionado = data === dataSelecionada;
                      const hoje = data === obterDataLocal();
                      const quantidade = quantidadePorDia.get(data) || 0;
                      return (
                        <button key={data} type="button" onClick={() => selecionarDia(dia)}
                          aria-label={`${formatarDataLocal(data)}${quantidade ? `, ${quantidade} pets agendados` : ""}`}
                          aria-pressed={selecionado}
                          className={`relative flex h-11 flex-col items-center justify-center rounded-xl text-sm transition ${selecionado ? "bg-emerald-700 font-extrabold text-white shadow-md shadow-emerald-700/20" : hoje ? "bg-emerald-50 font-extrabold text-emerald-800 ring-1 ring-emerald-200" : "font-medium text-slate-700 hover:bg-slate-100"}`}>
                          {dia}
                          {quantidade > 0 && <span className={`absolute bottom-1.5 h-1 w-1 rounded-full ${selecionado ? "bg-white" : "bg-emerald-500"}`} />}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                    <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-500"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Dias com agendamentos</span>
                    <button type="button" onClick={irParaHoje} className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-extrabold text-emerald-800 transition hover:bg-emerald-100">Hoje</button>
                  </div>
                </div>
                <div className="rounded-[22px] border border-emerald-100 bg-emerald-50 p-5">
                  <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-700">Horários de entrada</p>
                  <div className="mt-4 flex items-center justify-between border-b border-emerald-200/70 pb-3"><span className="text-sm font-medium text-emerald-950">☀️ Manhã</span><strong className="text-emerald-950">08:30</strong></div>
                  <div className="flex items-center justify-between pt-3"><span className="text-sm font-medium text-emerald-950">🌤️ Tarde</span><strong className="text-emerald-950">13:30</strong></div>
                </div>
              </aside>

              <div className="min-w-0 overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-5 md:px-7 md:py-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-emerald-700">Agenda do dia</p>
                      <h2 className="mt-1 text-xl font-black capitalize tracking-tight text-slate-900 md:text-2xl">{nomeDiaSelecionado}</h2>
                      <p className="mt-1 text-sm text-slate-500">{totalDia} {totalDia === 1 ? "pet agendado" : "pets agendados"} neste dia</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button type="button" onClick={irParaDiaAnterior} aria-label="Dia anterior" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-xl text-slate-600 hover:bg-slate-50">‹</button>
                      <button type="button" onClick={irParaHoje} className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">Hoje</button>
                      <button type="button" onClick={irParaProximoDia} aria-label="Próximo dia" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-xl text-slate-600 hover:bg-slate-50">›</button>
                    </div>
                  </div>
                  <div className="mt-4">
                    <button type="button" onClick={() => void compartilharAgendaImagem()}
                      disabled={carregando || totalDia === 0}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto">
                      📲 Compartilhar agenda
                    </button>
                    <p className="mt-2 text-xs text-slate-500">Imagem para a equipe com tutor, pet, plano/banho, serviço e observações. Sem situação, dados financeiros ou telefone.</p>
                  </div>
                  <div className="relative mt-5">
                    <label htmlFor="busca-agenda" className="sr-only">Buscar pet ou tutor neste dia</label>
                    <span aria-hidden="true" className="pointer-events-none absolute left-4 top-3 text-lg text-slate-400">⌕</span>
                    <input id="busca-agenda" type="search" value={buscaAgenda} onChange={(e) => setBuscaAgenda(e.target.value)}
                      placeholder="Buscar pet ou tutor neste dia..." className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100" />
                  </div>
                </div>
                {carregando ? (
                  <div className="p-12 text-center text-sm font-medium text-slate-500">Carregando agenda...</div>
                ) : (
                  <div className="space-y-8 px-4 py-6 md:px-7 md:py-7">
                    {([
                      { nome: "Manhã", horario: "08:30", icone: "☀️", lista: agendamentosManha, grupos: gruposManha },
                      { nome: "Tarde", horario: "13:30", icone: "🌤️", lista: agendamentosTarde, grupos: gruposTarde },
                    ] as const).map((turno) => (
                      <section key={turno.nome}>
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-xl">{turno.icone}</span>
                            <div><h3 className="text-lg font-black text-slate-900">{turno.nome}</h3><p className="text-xs font-semibold text-slate-500">Entrada às {turno.horario}</p></div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-extrabold text-slate-700">{turno.lista.length} {turno.lista.length === 1 ? "pet" : "pets"}</span>
                            <button type="button" onClick={() => { abrirNovoAgendamento(dataSelecionada); setHorarioAgendamento(turno.horario); }}
                              className="rounded-xl border border-emerald-200 px-3 py-2 text-xs font-extrabold text-emerald-800 transition hover:bg-emerald-50">+ Adicionar</button>
                          </div>
                        </div>
                        {turno.grupos.length === 0 ? (
                          <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/70 px-5 py-9 text-center">
                            <div className="text-3xl">🐶</div>
                            <p className="mt-2 text-sm font-bold text-slate-700">Nenhum pet agendado para este turno</p>
                            <p className="mt-1 text-xs text-slate-500">Os novos agendamentos aparecerão aqui.</p>
                          </div>
                        ) : <div className="space-y-3">{turno.grupos.map(renderGrupoTutor)}</div>}
                      </section>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {renovacao && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[3px]">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl md:p-8">
            <h3 className="text-xl font-extrabold text-emerald-950">🔄 Renovar ciclo</h3>
            <p className="mt-2 text-sm text-gray-600">
              Tutor: <strong>{tutorRenovacao?.nome || renovacao.tutorNome}</strong> • {renovacoesGrupo.length || 1} {(renovacoesGrupo.length || 1) === 1 ? "pet" : "pets"}
            </p>
            <p className="mt-1 text-sm text-gray-600">
              Confira as datas dos novos ciclos antes de confirmar.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">Data do primeiro banho</label>
                <input type="date" value={dataInicioRenovacao}
                  min={adicionarDias(renovacao.data, 1)}
                  onChange={e => setDataInicioRenovacao(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">Turno</label>
                <select value={horarioRenovacao} onChange={e => setHorarioRenovacao(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2">
                  <option value="08:30">Manhã — 08:30</option>
                  <option value="13:30">Tarde — 13:30</option>
                </select>
              </div>
            </div>
            <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
              <p className="mb-3 font-bold text-emerald-950">Confira as datas antes de salvar</p>
              {(renovacoesGrupo.length ? renovacoesGrupo : [renovacao]).map(pet => {
                const quantidade = pet.plano === "Quinzenal" ? 2 : 4;
                const intervalo = pet.plano === "Quinzenal" ? 14 : 7;
                const datas = dataValida(dataInicioRenovacao)
                  ? Array.from({length: quantidade}, (_, i) => adicionarDias(dataInicioRenovacao, i * intervalo)) : [];
                return <div key={pet.pet_id} className="mb-3 border-b border-emerald-200 pb-2 last:border-0">
                  <p className="font-bold text-emerald-950">🐾 {pet.petNome} — {pet.plano}</p>
                  {datas.map((data, i) => <p key={data} className="py-1 text-sm">
                    <strong>{i + 1}º banho:</strong> {formatarDataLocal(data)} • {horarioRenovacao}
                  </p>)}
                </div>;
              })}
              {datasRenovacao.length === 0 && <p className="text-sm text-red-700">Informe uma data válida.</p>}
            </div>
            <p className="mt-4 text-sm text-gray-600">
              O histórico será mantido. O pagamento do novo ciclo ficará pendente e deverá ser tratado na página Pagamentos.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => { setRenovacao(null); setRenovacoesGrupo([]); setTutorRenovacao(null); }} disabled={salvandoRenovacao}
                className="rounded-xl border border-gray-300 px-4 py-3 font-semibold text-gray-700 disabled:opacity-50">
                Cancelar
              </button>
              <button type="button" onClick={() => void confirmarRenovacao()}
                disabled={salvandoRenovacao || datasRenovacao.length === 0}
                className="rounded-xl bg-emerald-700 px-4 py-3 font-bold text-white hover:bg-emerald-800 disabled:opacity-50">
                {salvandoRenovacao ? "Salvando..." : "Confirmar e gerar ciclo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalAgendamento && perfilUsuario && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[3px]">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl md:p-8">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {agendamentoSelecionado
                    ? "Editar agendamento"
                    : "Novo agendamento"}
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  {agendamentoSelecionado
                    ? "Altere os dados e o valor. Em banhos concluídos, somente o valor pode ser corrigido."
                    : "Preencha os dados do atendimento."}
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
                  readOnly={Boolean(agendamentoSelecionado)}
                  onChange={(e) => {
                    if (agendamentoSelecionado) return;
                    setBuscaPet(e.target.value);
                    setPetSelecionado("");
                    setMostrarSugestoesPet(true);
                  }}
                  onFocus={() => { if (!agendamentoSelecionado) setMostrarSugestoesPet(true); }}
                  onBlur={() =>
                    setTimeout(
                      () => setMostrarSugestoesPet(false),
                      150
                    )
                  }
                  placeholder="Digite o nome do pet ou do tutor..."
                  autoComplete="off"
                  className={`w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-500 ${agendamentoSelecionado ? "bg-slate-100 text-slate-600" : ""}`}
                />

                {!agendamentoSelecionado && mostrarSugestoesPet && petsFiltrados.length > 0 && (
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

                {!agendamentoSelecionado && mostrarSugestoesPet &&
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

              {agendamentoSelecionado && !estaConcluido(agendamentoSelecionado) && (
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
                      <input type="radio" name="modo-reagendamento" checked={modoReagendamento === "ciclo"} onChange={() => setModoReagendamento("ciclo")} disabled={!cicloIdentificado || cicloTemConcluidos || estaConcluido(agendamentoSelecionado)} className="mr-2" />
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

              {agendamentoSelecionado ? (
                <>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Serviço do banho</label>
                    <div className="min-h-12 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-950">
                      {obterNomeServico(agendamentoSelecionado)}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Preenchido automaticamente pelo agendamento do pet.</p>
                  </div>
                  {ehAdmin && (
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        {ehPlano(agendamentoSelecionado) ? "Valor total do ciclo" : "Valor do atendimento"}
                      </label>
                      <input type="text" inputMode="decimal" value={valorAgendamento}
                        onChange={e => setValorAgendamento(e.target.value)} placeholder="Ex.: 180,00"
                        className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-emerald-500" />
                      <p className="mt-1 text-xs text-slate-500">Valor sugerido automaticamente, mas editável. Para planos, vale para todo o ciclo. Pagamentos anteriores não são alterados.</p>
                    </div>
                  )}
                </>
              ) : (
                <>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Serviço
                </label>

                <select
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
                  Valor
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

                </>
              )}

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
                  <option value="08:30">08:30</option>
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

              <button
                type="button"
                onClick={() => void salvarAgendamento()}
                disabled={salvando}
                className="rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                  {salvando ? "Salvando..." : agendamentoSelecionado && modoReagendamento === "ciclo" ? "Confirmar ciclo completo" : "Salvar agendamento"}
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
