"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
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

const NOME_JANELA_WHATSAPP = "SPA_PET_AGROMINAS_WHATSAPP";

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

function imprimirComprovante(
  agendamento: Agendamento,
  servicoNome: string,
  pagamento: {
    pago: boolean;
    forma: string | null;
    valor?: number | null;
  }
) {
  const janela = window.open("", "_blank", "width=400,height=700");

  if (!janela) {
    alert("Não foi possível abrir a impressão.");
    return;
  }

  const escaparHTML = (valor: string) =>
    valor.replace(/[&<>"']/g, (caractere) => {
      const mapa: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };

      return mapa[caractere];
    });

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>Comprovante - SPA PET AGROMINAS</title>
    <style>
      @page { size: 80mm auto; margin: 0; }
      * { box-sizing: border-box; }
      body { width: 80mm; margin: 0; padding: 8mm 5mm; font-family: Arial, sans-serif; color: #000; font-size: 12px; }
      .center { text-align: center; }
      .title { font-size: 16px; font-weight: bold; }
      .subtitle { margin-top: 3px; font-size: 11px; }
      .line { border-top: 1px dashed #000; margin: 10px 0; }
      .row { display: flex; justify-content: space-between; gap: 8px; margin: 5px 0; }
      .label { font-weight: bold; }
      .total { font-size: 16px; font-weight: bold; margin-top: 10px; }
      .payment { margin-top: 10px; padding: 7px; border: 1px solid #000; text-align: center; font-weight: bold; }
      .footer { margin-top: 18px; text-align: center; font-size: 10px; }
    </style>
  </head>
  <body>
    <div class="center title">SPA PET AGROMINAS</div>
    <div class="center subtitle">BANHO E TOSA</div>
    <div class="line"></div>
    <div class="center"><strong>COMPROVANTE DE ATENDIMENTO</strong></div>
    <div class="line"></div>
    <div class="row"><span class="label">Pet:</span><span>${escaparHTML(agendamento.petNome || "Pet")}</span></div>
    <div class="row"><span class="label">Tutor:</span><span>${escaparHTML(agendamento.tutorNome || "Tutor")}</span></div>
    <div class="row"><span class="label">Data:</span><span>${formatarDataLocal(agendamento.data)}</span></div>
    <div class="row"><span class="label">Horário:</span><span>${escaparHTML(formatarHorario(agendamento.horario))}</span></div>
    ${
      obterIdentificacaoBanho(agendamento)
        ? `<div class="row"><span class="label">Banho:</span><span>${escaparHTML(obterIdentificacaoBanho(agendamento))}</span></div>`
        : ""
    }
    <div class="line"></div>
    <div class="row"><span class="label">Serviço:</span><span>${escaparHTML(servicoNome)}</span></div>
    <div class="row total"><span>VALOR:</span><span>${formatarValor(pagamento.valor ?? agendamento.valor_total)}</span></div>
    <div class="payment">${pagamento.pago ? "PAGO" : "NÃO PAGO"}${pagamento.pago && pagamento.forma ? `<br>${escaparHTML(pagamento.forma)}` : ""}</div>
    <div class="footer">Obrigado pela confiança!</div>
  </body>
  </html>`;

  janela.document.open();
  janela.document.write(html);
  janela.document.close();
  janela.focus();

  setTimeout(() => janela.print(), 300);
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
  const [modalAtendimento, setModalAtendimento] = useState(false);
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
  const [valorAtendimento, setValorAtendimento] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [valorPagamentoPlano, setValorPagamentoPlano] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    void carregarDados();
  }, []);

  async function carregarDados() {
    setCarregando(true);

    try {
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
        supabase
          .from("atendimentos")
          .select("id, agendamento_id, pet_id, data, valor, forma_pagamento")
          .order("data"),
        supabase
          .from("pagamentos_planos")
          .select("id, pet_id, ciclo, valor, forma_pagamento, data_pagamento")
          .order("data_pagamento"),
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
      const listaAtendimentos = (atendimentosR.data || []) as Atendimento[];
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
      console.error("Erro ao carregar a agenda:", erro);
      alert("Não foi possível carregar todos os dados da agenda.");
    } finally {
      setCarregando(false);
    }
  }

  function obterNomeServico(agendamento: Agendamento) {
    if (agendamento.servico_nome) return agendamento.servico_nome;

    return (
      servicos.find((item) => item.id === agendamento.servico_id)?.nome ||
      "Banho e tosa"
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
          texto: "PAGO",
          forma: agendamento.forma_pagamento_plano || null,
          valor: agendamento.valor_total,
        };
      }

      return {
        pago: false,
        texto: "NÃO PAGO",
        forma: null,
        valor: null,
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

  async function salvarAgendamento() {
    if (!petSelecionado) {
      alert("Pesquise e selecione um pet na lista.");
      return;
    }

    if (!dataAgendamento) {
      alert("Selecione a data.");
      return;
    }

    if (!horarioAgendamento) {
      alert("Selecione o horário.");
      return;
    }

    setSalvando(true);

    try {
      const servico = servicos.find(
        (item) => item.id === servicoSelecionado
      );

      const valor =
        valorAgendamento.trim() === ""
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
        valor_total: valor,
        servico_nome:
          servico?.nome || agendamentoSelecionado?.servico_nome || null,
      };

      if (agendamentoSelecionado) {
        const resposta = await supabase
          .from("agendamentos")
          .update({
            ...dadosBase,
            data: dataAgendamento,
          })
          .eq("id", agendamentoSelecionado.id);

        if (resposta.error) throw resposta.error;
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

          for (let i = 0; i < quantidade; i++) {
            const intervalo =
              frequenciaAgendamento === "Quinzenal" ? 14 : 7;

            const data = adicionarDias(dataAgendamento, i * intervalo);

            registros.push({
              ...dadosBase,
              data,
              plano: frequenciaAgendamento,
              numero_banho: i + 1,
              ciclo: null,
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

  function abrirAtendimento(agendamento: Agendamento) {
    setAgendamentoSelecionado(agendamento);

    const atendimento = atendimentos.find(
      (item) => item.agendamento_id === agendamento.id
    );

    const pagamentoPlano = ehPlano(agendamento)
      ? pagamentosPlanos.find(
          (item) =>
            item.pet_id === agendamento.pet_id &&
            item.ciclo === agendamento.ciclo
        )
      : undefined;

    setValorAtendimento(
      atendimento?.valor !== null && atendimento?.valor !== undefined
        ? String(atendimento.valor).replace(".", ",")
        : agendamento.valor_total !== null
          ? String(agendamento.valor_total).replace(".", ",")
          : ""
    );

    setFormaPagamento(atendimento?.forma_pagamento || "");

    setValorPagamentoPlano(
      pagamentoPlano
        ? String(pagamentoPlano.valor).replace(".", ",")
        : agendamento.valor_total !== null
          ? String(agendamento.valor_total).replace(".", ",")
          : ""
    );

    setModalAtendimento(true);
  }

  async function salvarAtendimento() {
    if (!agendamentoSelecionado) return;

    const plano = ehPlano(agendamentoSelecionado);

    const valorAtend =
      valorAtendimento.trim() === ""
        ? null
        : Number(valorAtendimento.replace(",", "."));

    const valorPlano =
      valorPagamentoPlano.trim() === ""
        ? null
        : Number(valorPagamentoPlano.replace(",", "."));

    const pagamentoExistente = plano
      ? pagamentosPlanos.find(
          (item) =>
            item.pet_id === agendamentoSelecionado.pet_id &&
            item.ciclo === agendamentoSelecionado.ciclo
        )
      : undefined;

    if (plano && !pagamentoExistente) {
      if (
        valorPlano === null ||
        !Number.isFinite(valorPlano) ||
        valorPlano < 0
      ) {
        alert("Informe o valor total do plano.");
        return;
      }

      if (!formaPagamento) {
        alert("Selecione a forma de pagamento do plano.");
        return;
      }
    }

    if (
      !plano &&
      (valorAtend === null ||
        !Number.isFinite(valorAtend) ||
        valorAtend < 0)
    ) {
      alert("Informe um valor válido para o atendimento.");
      return;
    }

    setSalvando(true);

    try {
      const atendimentoExistente = atendimentos.find(
        (item) => item.agendamento_id === agendamentoSelecionado.id
      );

      const valorRegistro = plano
        ? Number(agendamentoSelecionado.valor_total ?? 0)
        : valorAtend!;

      const dadosAtendimento = {
        valor: valorRegistro,
        forma_pagamento: plano
          ? pagamentoExistente?.forma_pagamento || formaPagamento || null
          : formaPagamento || null,
      };

      let erro: any = null;

      if (atendimentoExistente) {
        const resposta = await supabase
          .from("atendimentos")
          .update(dadosAtendimento)
          .eq("id", atendimentoExistente.id);

        erro = resposta.error;
      } else {
        const resposta = await supabase.from("atendimentos").insert({
          agendamento_id: agendamentoSelecionado.id,
          pet_id: agendamentoSelecionado.pet_id,
          data: agendamentoSelecionado.data,
          ...dadosAtendimento,
        });

        erro = resposta.error;
      }

      if (!erro && plano && !pagamentoExistente) {
        const respostaPagamento = await supabase
          .from("pagamentos_planos")
          .insert({
            pet_id: agendamentoSelecionado.pet_id,
            ciclo: agendamentoSelecionado.ciclo,
            valor: valorPlano,
            forma_pagamento: formaPagamento,
          });

        erro = respostaPagamento.error;
      }

      if (!erro) {
        const respostaAgendamento = await supabase
          .from("agendamentos")
          .update({ status: "Concluído" })
          .eq("id", agendamentoSelecionado.id);

        erro = respostaAgendamento.error;
      }

      if (erro) throw erro;

      setModalAtendimento(false);
      setAgendamentoSelecionado(null);

      await carregarDados();
    } catch (erro: any) {
      console.error("Erro ao registrar atendimento/pagamento:", erro);

      alert(
        "Não foi possível registrar o atendimento ou pagamento.\n\n" +
          (erro?.message || "Verifique os dados e tente novamente.")
      );
    } finally {
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
        (item.status || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() !== "cancelado"
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
        item.data === data &&
        (item.status || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() !== "cancelado"
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
    const pagamento = obterPagamentoDoCiclo(agendamento);

    const pet = pets.find(
      (item) => item.id === agendamento.pet_id
    );

    const identificacao = obterIdentificacaoBanho(agendamento);

    return (
      <div
        key={agendamento.id}
        className="rounded-xl border border-gray-200 bg-gray-50 p-4"
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-lg shadow-sm">
              🐾
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-semibold text-gray-900">
                  {agendamento.petNome || "Pet"}
                </h4>

                <span
                  className={
                    concluido
                      ? "rounded-full bg-gray-200 px-2 py-1 text-xs text-gray-700"
                      : "rounded-full bg-gray-900 px-2 py-1 text-xs text-white"
                  }
                >
                  {concluido ? "Concluído" : "Agendado"}
                </span>
              </div>

              {identificacao && (
                <p className="mt-1 text-sm font-bold text-gray-900">
                  🛁 {identificacao}
                </p>
              )}

              <p className="mt-1 text-sm text-gray-600">
                {obterNomeServico(agendamento)} •{" "}
                {formatarValor(agendamento.valor_total)}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={
                    pagamento.pago
                      ? "inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700"
                      : "inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700"
                  }
                >
                  {pagamento.pago ? "🟢 PAGO" : "🔴 NÃO PAGO"}
                </span>

                {pagamento.pago && pagamento.forma && (
                  <span className="text-xs text-gray-500">
                    {pagamento.forma}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                imprimirComprovante(
                  agendamento,
                  obterNomeServico(agendamento),
                  pagamento
                )
              }
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              🖨️ Imprimir
            </button>

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
              disabled={!agendamento.whatsapp}
              className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              🐶 Pet pronto
            </button>

            <button
              type="button"
              onClick={() => abrirEdicao(agendamento)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Editar
            </button>

            {!concluido && (
              <button
                type="button"
                onClick={() => abrirAtendimento(agendamento)}
                className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                Registrar atendimento
              </button>
            )}

            <button
              type="button"
              onClick={() => void excluirAgendamento(agendamento)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              Excluir
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderGrupoTutor(grupo: GrupoTutor): ReactNode {
    const itensWhatsApp = grupo.agendamentos.map((agendamento) => {
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
        className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-xl">
              👤
            </div>

            <div>
              <h4 className="font-semibold text-gray-900">
                {grupo.tutorNome}
              </h4>

              <p className="text-sm text-gray-500">
                {grupo.horario} • {grupo.agendamentos.length}{" "}
                {grupo.agendamentos.length === 1 ? "pet" : "pets"}
              </p>
            </div>
          </div>

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
            disabled={!grupo.whatsapp}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            📅 Lembrar agendamento
          </button>
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

  const pagamentoPlanoSelecionado =
    agendamentoSelecionado && ehPlano(agendamentoSelecionado)
      ? pagamentosPlanos.find(
          (item) =>
            item.pet_id === agendamentoSelecionado.pet_id &&
            item.ciclo === agendamentoSelecionado.ciclo
        )
      : undefined;

  return (
    <main className="min-h-screen bg-gray-100">
      <div className="flex min-h-screen">
        <MenuLateral />

        <section className="flex-1 p-4 md:p-8">
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">
                Agenda
              </h2>

              <p className="mt-1 text-gray-500">
                Organize os atendimentos de banho e tosa.
              </p>
            </div>

            <button
              type="button"
              onClick={() => abrirNovoAgendamento()}
              className="rounded-xl bg-gray-900 px-5 py-3 font-medium text-white hover:bg-gray-800"
            >
              + Novo agendamento
            </button>
          </div>

          <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => mudarMes(-1)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-gray-100"
                  aria-label="Mês anterior"
                >
                  ←
                </button>

                <h3 className="font-semibold capitalize text-gray-900">
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
                          ? "bg-gray-900 font-semibold text-white"
                          : hoje
                            ? "bg-gray-100 font-semibold text-gray-900"
                            : "text-gray-700 hover:bg-gray-100")
                      }
                    >
                      {dia}

                      {temAgendamento && (
                        <span
                          className={
                            "absolute bottom-1 h-1 w-1 rounded-full " +
                            (selecionado ? "bg-white" : "bg-gray-900")
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

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm text-gray-500">
                    Dia selecionado
                  </p>

                  <h3 className="mt-1 text-2xl font-bold text-gray-900">
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

              {carregando ? (
                <div className="rounded-xl bg-gray-50 p-10 text-center text-gray-500">
                  Carregando agenda...
                </div>
              ) : (
                <div className="space-y-8">
                  <section>
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-gray-900">
                          ☀️ Manhã
                        </h4>

                        <p className="text-sm text-gray-500">
                          08:00 às 12:00
                        </p>
                      </div>

                      <span className="rounded-lg bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
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
                        <h4 className="font-semibold text-gray-900">
                          🌤️ Tarde
                        </h4>

                        <p className="text-sm text-gray-500">
                          13:30 às 17:30
                        </p>
                      </div>

                      <span className="rounded-lg bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
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

      {modalAgendamento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
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
                      {servico.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
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
              </div>

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
                className="rounded-xl border border-gray-300 px-5 py-3 font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => void salvarAgendamento()}
                disabled={salvando}
                className="rounded-xl bg-gray-900 px-5 py-3 font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {salvando ? "Salvando..." : "Salvar agendamento"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalAtendimento && agendamentoSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Registrar atendimento
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  {agendamentoSelecionado.petNome} •{" "}
                  {obterNomeServico(agendamentoSelecionado)}
                </p>

                {obterIdentificacaoBanho(agendamentoSelecionado) && (
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    🛁 {obterIdentificacaoBanho(agendamentoSelecionado)}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setModalAtendimento(false)}
                className="text-2xl text-gray-400 hover:text-gray-700"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <div className="space-y-5">
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-xs font-medium uppercase text-gray-400">
                  Tutor
                </p>

                <p className="mt-1 font-medium text-gray-900">
                  {agendamentoSelecionado.tutorNome}
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Data
                </label>

                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-700">
                  {formatarDataLocal(agendamentoSelecionado.data)}
                </div>
              </div>

              {ehPlano(agendamentoSelecionado) ? (
                <>
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                    <strong>Pagamento por ciclo do plano</strong>

                    <p className="mt-1">
                      O valor do plano será registrado uma única vez para
                      este pet e ciclo. Os outros banhos do mesmo ciclo
                      não gerarão outro pagamento.
                    </p>

                    <p className="mt-2 font-semibold">
                      Ciclo: {agendamentoSelecionado.ciclo}
                    </p>

                    {pagamentoPlanoSelecionado && (
                      <p className="mt-1">
                        Este ciclo já está pago:{" "}
                        {formatarValor(pagamentoPlanoSelecionado.valor)} —{" "}
                        {pagamentoPlanoSelecionado.forma_pagamento}
                      </p>
                    )}
                  </div>

                  {!pagamentoPlanoSelecionado && (
                    <>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Valor total do plano/ciclo
                        </label>

                        <input
                          type="text"
                          inputMode="decimal"
                          value={valorPagamentoPlano}
                          onChange={(e) =>
                            setValorPagamentoPlano(e.target.value)
                          }
                          placeholder="Ex.: 120,00"
                          className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-500"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Forma de pagamento do plano
                        </label>

                        <select
                          value={formaPagamento}
                          onChange={(e) =>
                            setFormaPagamento(e.target.value)
                          }
                          className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-500"
                        >
                          <option value="">
                            Selecione a forma de pagamento
                          </option>
                          <option value="Dinheiro">Dinheiro</option>
                          <option value="Pix">Pix</option>
                          <option value="Débito">Débito</option>
                          <option value="Crédito">Crédito</option>
                          <option value="Outro">Outro</option>
                        </select>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Valor do atendimento
                    </label>

                    <input
                      type="text"
                      inputMode="decimal"
                      value={valorAtendimento}
                      onChange={(e) =>
                        setValorAtendimento(e.target.value)
                      }
                      placeholder="0,00"
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-500"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Forma de pagamento
                    </label>

                    <select
                      value={formaPagamento}
                      onChange={(e) =>
                        setFormaPagamento(e.target.value)
                      }
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-500"
                    >
                      <option value="">Selecionar depois</option>
                      <option value="Dinheiro">Dinheiro</option>
                      <option value="Pix">Pix</option>
                      <option value="Débito">Débito</option>
                      <option value="Crédito">Crédito</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalAtendimento(false)}
                className="rounded-xl border border-gray-300 px-5 py-3 font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => void salvarAtendimento()}
                disabled={salvando}
                className="rounded-xl bg-gray-900 px-5 py-3 font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {salvando
                  ? "Salvando..."
                  : "Concluir atendimento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
