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
  "Banho": "Banho Completo",
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
          `O ${nomePet} já está prontinho no SPA PET AGROMINAS. ${cachorro}${coracao}`,
          "",
          "O banho e tosa foram concluídos e ele já pode ser retirado.",
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
      .marca { text-align: center; font-size: 23px; font-weight: 900; letter-spacing: 1.1px; }
      .submarca { text-align: center; font-size: 10px; letter-spacing: 1.8px; margin-top: 1px; }
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
    <div class="marca">SPA PET AGROMINAS</div>
    <div class="submarca">BANHO E TOSA</div>
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
  setTimeout(() => { if (!janela.closed) janela.print(); }, 450);
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
  itens: ItemComprovanteGrupo[]
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
      <div class="linha"><span class="rotulo">${item.plano ? "Total do ciclo" : "Valor"}</span><span class="valor"><strong>${nome(valorComprovante(item.valor))}</strong></span></div>
      <div class="detalhe"><strong>${item.pago ? "PAGO" : "PENDENTE"}</strong>${item.pago && item.forma ? ` • ${nome(item.forma)}` : ""}</div>
      ${repetido ? `<div class="observacao">Mesmo ciclo: valor contabilizado uma única vez.</div>` : ""}
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
    <div class="etiqueta" style="text-align:center;margin-top:10px">TOTAL PENDENTE${faltamValores ? " CONHECIDO" : ""}</div>
    <div class="montante">${formatarValor(totalPendente)}</div>
    ${faltamValores ? `<div class="observacao"><strong>ATENÇÃO:</strong> Há valores de ciclos/serviços a conferir. O total acima está incompleto; não utilize como valor final de cobrança.</div>` : ""}
    <div class="observacao">Planos: os valores são referentes ao ciclo completo e cada ciclo identificado é somado apenas uma vez.</div>`;
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
  const [horarioAgendamento, setHorarioAgendamento] = useState("08:00");
  const [observacoes, setObservacoes] = useState("");
  const [valorAgendamento, setValorAgendamento] = useState("");
  const [salvando, setSalvando] = useState(false);
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
        ...(ehAdmin || !agendamentoSelecionado ? { valor_total: valor } : {}),
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
    } catch (erro: any) {
      console.error("Erro ao concluir atendimento:", erro);
      alert(erro?.message || "Não foi possível concluir o atendimento.");
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

  function renderPetDoGrupo(agendamento: Agendamento) {
    const concluido = estaConcluido(agendamento);
    const cancelado = estaCancelado(agendamento);
    const pagamento = ehAdmin ? obterPagamentoDoCiclo(agendamento) : null;

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

                <span
                  className={
                    cancelado
                      ? "rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-800"
                      : concluido
                        ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800"
                        : "rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800"
                  }
                >
                  {cancelado ? "Cancelado" : concluido ? "Concluído" : "Pendente"}
                </span>
              </div>

              {identificacao && (
                <p className="mt-1 text-sm font-semibold text-emerald-700">
                  🛁 {identificacao}
                </p>
              )}

              <p className="mt-1 text-sm text-gray-600">
                {obterNomeServico(agendamento)} •{" "}
                {formatarValor(agendamento.valor_total)}
              </p>

            </div>
          </div>

          <div className="flex flex-wrap gap-2">
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
              onClick={() =>
                abrirWhatsApp(
                  "pronto",
                  agendamento.whatsapp || "",
                  agendamento.petNome || "Pet",
                  agendamento.tutorNome || "Tutor",
                  formatarHorario(agendamento.horario),
                  pet?.sexo || null,
                  obterNomeServico(agendamento),
                  agendamento.data
                )
              }
              disabled={!agendamento.whatsapp || cancelado || !concluido}
              className="rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              🐶 Pet pronto
            </button>

            <button
              type="button"
              onClick={() => abrirEdicao(agendamento)}
              disabled={concluido || cancelado}
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
                      valor: pagamento.valor ?? agendamento.valor_total,
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

            <button
              type="button"
              onClick={() => abrirNovoAgendamento()}
              className="rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-emerald-800"
            >
              + Novo agendamento
            </button>
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
                            (selecionado ? "bg-white" : "bg-emerald-600")
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
              {carregando ? (
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
                  Preencha os dados do atendimento.
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

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Data
                </label>

                <input
                  type="date"
                  value={dataAgendamento}
                  onChange={(e) => setDataAgendamento(e.target.value)}
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
                  rows={3}
                  placeholder="Observações do agendamento"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-500"
                />
              </div>
            </div>

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
