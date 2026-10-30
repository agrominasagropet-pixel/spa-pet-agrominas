"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import MenuLateral from "@/app/components/MenuLateral";

type Frequencia = "Avulso" | "Quinzenal" | "Mensal";
type Turno = "Manhã" | "Tarde";
type PagamentoPlano = "Pago" | "Pendente";

type ServicosPet = {
  banhoTosa: string;
  tosas: string[];
  adicionais: string[];
  frequencia: Frequencia;
  dataInicio: string;
  turno: Turno;
  valorTotal: string;
};

type PlanoResumo = {
  ciclo: number;
  totalBanhos: number;
  banhosConcluidos: number;
  banhosRestantes: number;
  pagamento: PagamentoPlano;
  formaPagamento: string;
  dataInicio: string;
  dataFim: string;
  renovacaoDisponivel: boolean;
};

type BanhoHistorico = {
  id: string;
  data: string;
  servico: string;
  plano: string;
  ciclo: number | null;
  numeroBanho: number | null;
  observacoes: string;
};

type Pet = {
  historicoBanhos?: BanhoHistorico[];
  id: string;
  nome: string;
  raca: string;
  sexo: string;
  dataNascimento: string;
  peso: string;
  observacoes: string;
  servicos: ServicosPet;
  plano?: PlanoResumo | null;
};

type Cliente = {
  id: string;
  nome: string;
  cpf: string;
  contato: string;
  cep: string;
  endereco: string;
  numero: string;
  bairro: string;
  observacoes: string;
  pets: Pet[];
};

type AgendamentoBanco = {
  id: string;
  pet_id: string;
  data: string;
  status: string | null;
  plano: string | null;
  numero_banho: number | null;
  ciclo: number | null;
  pagamento_status: string | null;
  forma_pagamento_plano: string | null;
};

// Padroniza nomes antigos sem modificar registros históricos no banco.
function padronizarServico(nome: string): string {
  const original = String(nome || "").trim();
  const chave = original.toLocaleLowerCase("pt-BR");
  const nomes: Record<string, string> = {
    "banho completo": "Banho",
    "banho": "Banho",
    "banho + tosa": "Banho com Tosa Completa",
    "banho + tosa completa": "Banho com Tosa Completa",
    "banho com tosa completa": "Banho com Tosa Completa",
    "tosa higiênica": "Banho com Tosa Higiênica",
    "banho + tosa higiênica": "Banho com Tosa Higiênica",
    "banho com tosa higiênica": "Banho com Tosa Higiênica",
    "tosa na máquina": "Tosa na Máquina",
    "tosa na tesoura": "Tosa na Tesoura",
  };
  return nomes[chave] || original;
}

const opcoesBanhoTosa = [
  "Banho",
  "Banho com Tosa Higiênica",
  "Banho com Tosa Completa",
];

const opcoesTosas = [
  "Tosa na máquina",
  "Tosa bebê",
  "Tosa na tesoura",
  "Tosa da raça",
  "Acerto de saia",
  "Carding",
  "Trimming",
];

const opcoesAdicionais = [
  "Escovação de dentes",
  "Corte de unhas",
  "Lixamento de unhas",
  "Harmonização facial",
  "Patinha raspada (botinha)",
  "Arredondamento de patinha",
  "Desembolo",
  "Penteados",
  "Hidratação",
];

const racas = [
  "Akita",
  "American Bully",
  "American Staffordshire Terrier",
  "Basset Hound",
  "Beagle",
  "Bernese (Boiadeiro de Berna)",
  "Bichon Frisé",
  "Border Collie",
  "Boston Terrier",
  "Boxer",
  "Bulldog Francês",
  "Bulldog Inglês",
  "Bull Terrier",
  "Cane Corso",
  "Cavalier King Charles Spaniel",
  "Chihuahua",
  "Chow Chow",
  "Cocker Spaniel",
  "Dachshund",
  "Dálmata",
  "Doberman",
  "Dogo Argentino",
  "Fila Brasileiro",
  "Fox Paulistinha",
  "Golden Retriever",
  "Husky Siberiano",
  "Jack Russell Terrier",
  "Labrador Retriever",
  "Lhasa Apso",
  "Maltês",
  "Mastiff",
  "Pastor Alemão",
  "Pastor Australiano",
  "Pastor Belga",
  "Pequinês",
  "Pinscher",
  "Pit Bull",
  "Poodle",
  "Pug",
  "Rottweiler",
  "Schnauzer",
  "Shih Tzu",
  "Spitz Alemão",
  "Staffordshire Bull Terrier",
  "Yorkshire Terrier",
  "SRD",
  "Outra raça",
].sort((a, b) => a.localeCompare(b, "pt-BR"));

function criarPet(id: string): Pet {
  return {
    id,
    nome: "",
    raca: "",
    sexo: "",
    dataNascimento: "",
    peso: "",
    observacoes: "",
    servicos: {
      banhoTosa: "",
      tosas: [],
      adicionais: [],
      frequencia: "Avulso",
      dataInicio: "",
      turno: "Manhã",
      valorTotal: "",
    },
    plano: null,
  };
}

type RegistroBanco = {
  id?: string;
  nome?: string;
  frequencia?: string;
  peso?: string | number | null;
  tosas?: string[];
  adicionais?: string[];
  "raça"?: string;
  raca?: string;
  sexo?: string;
  data_nascimento?: string;
  observacoes?: string;
  banho_tosa?: string;
  data_inicio?: string;
  turno?: string;
  valor_total?: string | number | null;
  cliente_id?: string;
};

function converterPetDoBanco(pet: RegistroBanco): Pet {
  const frequencia: Frequencia =
    pet?.frequencia === "Mensal"
      ? "Mensal"
      : pet?.frequencia === "Quinzenal"
      ? "Quinzenal"
      : "Avulso";

  return {
    id: String(pet?.id || ""),
    nome: pet?.nome || "",
    raca: pet?.["raça"] || pet?.raca || "",
    sexo: pet?.sexo || "",
    dataNascimento: pet?.data_nascimento || "",
    peso:
      pet?.peso !== null &&
      pet?.peso !== undefined
        ? String(pet.peso)
        : "",
    observacoes: pet?.observacoes || "",
    servicos: {
      banhoTosa: padronizarServico(pet?.banho_tosa || ""),
      tosas: Array.isArray(pet?.tosas)
        ? pet.tosas
        : [],
      adicionais: Array.isArray(
        pet?.adicionais
      )
        ? pet.adicionais
        : [],
      frequencia,
      dataInicio: pet?.data_inicio || "",
      turno:
        pet?.turno === "Tarde"
          ? "Tarde"
          : "Manhã",
      valorTotal:
        pet?.valor_total !== null &&
        pet?.valor_total !== undefined
          ? String(pet.valor_total)
          : "",
    },
    plano: null,
  };
}

function adicionarDias(data: string, dias: number) {
  const partes = data.split("-");

  if (partes.length !== 3) {
    return data;
  }

  const dataObj = new Date(
    Number(partes[0]),
    Number(partes[1]) - 1,
    Number(partes[2])
  );

  dataObj.setDate(dataObj.getDate() + dias);

  const ano = dataObj.getFullYear();
  const mes = String(
    dataObj.getMonth() + 1
  ).padStart(2, "0");
  const dia = String(
    dataObj.getDate()
  ).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function hojeISO() {
  const hoje = new Date();

  const ano = hoje.getFullYear();
  const mes = String(
    hoje.getMonth() + 1
  ).padStart(2, "0");
  const dia = String(
    hoje.getDate()
  ).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function formatarData(data: string) {
  if (!data) return "-";

  const partes = data.split("-");

  if (partes.length !== 3) {
    return data;
  }

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function formatarMoeda(
  valor: string | number | null | undefined
) {
  const numero = Number(valor || 0);

  return numero.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function valorNumerico(valor: string) {
  if (!valor) return 0;

  const limpo = valor
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  return Number(limpo) || 0;
}

function horarioDoTurno(turno: Turno) {
  return turno === "Tarde"
    ? "13:30"
    : "08:30";
}

function formatarCep(valor: string) {
  const numeros = valor
    .replace(/\D/g, "")
    .slice(0, 8);

  if (numeros.length <= 5) {
    return numeros;
  }

  return `${numeros.slice(
    0,
    5
  )}-${numeros.slice(5)}`;
}

function formatarCpf(valor: string) {
  const numeros = valor
    .replace(/\D/g, "")
    .slice(0, 11);

  if (numeros.length <= 3) {
    return numeros;
  }

  if (numeros.length <= 6) {
    return `${numeros.slice(
      0,
      3
    )}.${numeros.slice(3)}`;
  }

  if (numeros.length <= 9) {
    return `${numeros.slice(
      0,
      3
    )}.${numeros.slice(
      3,
      6
    )}.${numeros.slice(6)}`;
  }

  return `${numeros.slice(
    0,
    3
  )}.${numeros.slice(
    3,
    6
  )}.${numeros.slice(
    6,
    9
  )}-${numeros.slice(9)}`;
}

function formatarContato(valor: string) {
  const numeros = valor
    .replace(/\D/g, "")
    .slice(0, 11);

  if (numeros.length <= 2) {
    return numeros;
  }

  if (numeros.length <= 7) {
    return `(${numeros.slice(
      0,
      2
    )}) ${numeros.slice(2)}`;
  }

  if (numeros.length === 10) {
    return `(${numeros.slice(
      0,
      2
    )}) ${numeros.slice(
      2,
      6
    )}-${numeros.slice(6)}`;
  }

  return `(${numeros.slice(
    0,
    2
  )}) ${numeros.slice(
    2,
    7
  )}-${numeros.slice(7)}`;
}

function quantidadeBanhosPorCiclo(
  frequencia: Frequencia
) {
  if (frequencia === "Mensal") return 4;
  if (frequencia === "Quinzenal") return 2;
  return 1;
}

function intervaloEntreBanhos(
  frequencia: Frequencia
) {
  if (frequencia === "Mensal") return 7;
  if (frequencia === "Quinzenal") return 14;
  return 0;
}

function descricaoFrequencia(
  frequencia: Frequencia
) {
  if (frequencia === "Mensal") {
    return "4 banhos por ciclo";
  }

  if (frequencia === "Quinzenal") {
    return "2 banhos por ciclo";
  }

  return "1 banho";
}

function statusConcluido(
  status: string | null | undefined
) {
  const valor = String(
    status || ""
  ).toLowerCase();

  return (
    valor.includes("conclu") ||
    valor.includes("finaliz") ||
    valor.includes("realiz") ||
    valor.includes("pronto")
  );
}

function criarResumoPlano(
  pet: Pet,
  agendamentos: AgendamentoBanco[]
): PlanoResumo | null {
  // O histórico avulso não integra o novo plano mensal/quinzenal.
  const doPet = agendamentos.filter(
    (item) =>
      String(item.pet_id) === String(pet.id) &&
      String(item.plano || "Avulso") === pet.servicos.frequencia
  );

  if (!doPet.length) {
    return null;
  }

  const ciclos = Array.from(
    new Set(
      doPet.map((item) => {
        const numero = Number(
          item.ciclo
        );

        return Number.isFinite(numero) &&
          numero > 0
          ? numero
          : 1;
      })
    )
  ).sort((a, b) => a - b);

  const hoje = hojeISO();

  let cicloAtual = ciclos.find(
    (ciclo) => {
      const itens = doPet.filter(
        (item) =>
          Number(item.ciclo || 1) ===
          ciclo
      );

      const ultimaData = itens
        .map((item) => item.data)
        .filter(Boolean)
        .sort()
        .at(-1);

      return ultimaData
        ? ultimaData >= hoje
        : false;
    }
  );

  if (!cicloAtual) {
    cicloAtual =
      ciclos[ciclos.length - 1] || 1;
  }

  const itensCiclo = doPet
    .filter(
      (item) =>
        Number(item.ciclo || 1) ===
        cicloAtual
    )
    .sort((a, b) =>
      String(a.data).localeCompare(
        String(b.data)
      )
    );

  const totalBanhos =
    quantidadeBanhosPorCiclo(
      pet.servicos.frequencia
    );

  const banhosConcluidos =
    itensCiclo.filter((item) =>
      statusConcluido(item.status)
    ).length;

  const banhosRestantes = Math.max(
    totalBanhos - banhosConcluidos,
    0
  );

  /*
   * O ciclo somente é considerado PAGO
   * quando todos os agendamentos daquele
   * ciclo estão pagos.
   */
  const pago =
    itensCiclo.length >= totalBanhos &&
    itensCiclo.every(
      (item) =>
        String(
          item.pagamento_status || ""
        ).toLowerCase() === "pago"
    );

  const primeiro =
    itensCiclo[0]?.data ||
    pet.servicos.dataInicio ||
    "";

  const ultimo =
    itensCiclo[
      itensCiclo.length - 1
    ]?.data ||
    pet.servicos.dataInicio ||
    "";

  const cicloFinalizado =
    itensCiclo.length >= totalBanhos &&
    itensCiclo.every((item) =>
      statusConcluido(item.status)
    );

  const cicloVencido =
    !!ultimo && ultimo < hoje;

  const formaPagamento =
    itensCiclo.find(
      (item) =>
        item.forma_pagamento_plano
    )?.forma_pagamento_plano ||
    "";

  return {
    ciclo: cicloAtual,
    totalBanhos,
    banhosConcluidos,
    banhosRestantes,
    pagamento: pago
      ? "Pago"
      : "Pendente",
    formaPagamento,
    dataInicio: primeiro,
    dataFim: ultimo,
    renovacaoDisponivel:
      pet.servicos.frequencia !==
        "Avulso" &&
      (cicloFinalizado ||
        cicloVencido),
  };
}

type ConversaoPlano = { id: string; pet_id: string; agendamento_avulso_id: string; atendimento_original_id: string; ciclo: number; plano_destino: string; valor_plano: number; credito_avulso: number };
type ParcelaPlano = { id: string; conversao_id: string; valor: number; forma_pagamento: string; data_pagamento: string };

export default function ClientesPetsPage() {
  const [avulsosConvertiveis, setAvulsosConvertiveis] = useState<Record<string, {id:string;data:string;valor:number;pago:boolean}[]>>({});
  const [modoInicioPlano, setModoInicioPlano] = useState<Record<string, "novo" | "aproveitar">>({});
  const [convertendo, setConvertendo] = useState(false);
  const [conversaoAberta, setConversaoAberta] = useState<string | null>(null);
  async function converterAvulso(pet: Pet, agId: string, credito: number, planoTexto: "Quinzenal" | "Mensal", precoTexto: string) {
    const preco = valorNumerico(precoTexto);
    if(!Number.isFinite(preco) || preco < credito || preco <= 0) { window.alert("Valor inválido: não pode ser inferior ao crédito já pago.");return; }
    if(!window.confirm(`Converter banho concluído em primeiro banho do plano ${planoTexto}?\nCrédito: R$ ${credito.toFixed(2)}\nSaldo: R$ ${(preco-credito).toFixed(2)}`))return;
    setConvertendo(true);
    try {
      const {error} = await supabase.rpc("converter_avulso_em_plano_agrominas",{p_agendamento_id:agId,p_plano:planoTexto,p_valor_plano:preco,p_turno:pet.servicos.turno});
      if(error) throw error;
      window.alert("Conversão registrada. Confira os banhos restantes na Agenda e o saldo em Pagamentos.");
      await carregarClientes();
      setConversaoAberta(null);
      setModalCadastro(false);
      setClienteSelecionado(null);
    } catch(e) {window.alert(e instanceof Error ? e.message : "Não foi possível converter o banho.");}
    finally {setConvertendo(false);}
  }

  const [anotacaoEditando, setAnotacaoEditando] = useState<string | null>(null);
  const [textoAnotacao, setTextoAnotacao] = useState("");
  const [salvandoAnotacao, setSalvandoAnotacao] = useState(false);

  async function salvarAnotacaoBanho(agendamentoId: string) {
    if (salvandoAnotacao) return;
    setSalvandoAnotacao(true);
    try {
      const { error } = await supabase
        .from("agendamentos")
        .update({ observacoes: textoAnotacao.trim() })
        .eq("id", agendamentoId);
      if (error) throw error;
      await carregarClientes();
      setAnotacaoEditando(null);
    } catch (erro) {
      window.alert(erro instanceof Error ? erro.message : "Erro ao salvar anotação.");
    } finally {
      setSalvandoAnotacao(false);
    }
  }

  const [clientes, setClientes] =
    useState<Cliente[]>([]);

  const [busca, setBusca] =
    useState("");

  const [modalCadastro, setModalCadastro] =
    useState(false);

  const [modoEdicao, setModoEdicao] =
    useState(false);

  const [
    clienteEditandoId,
    setClienteEditandoId,
  ] = useState<string | null>(null);

  const [
    clienteSelecionado,
    setClienteSelecionado,
  ] = useState<Cliente | null>(null);

  useEffect(() => {
    let ativo = true;
    async function consultar() {
      const [ags, ats, cvs] = await Promise.all([
        supabase.from("agendamentos").select("id,pet_id,data,plano,status"),
        supabase.from("atendimentos").select("agendamento_id,valor,data_pagamento"),
        supabase.from("conversoes_avulso_plano").select("agendamento_avulso_id")
      ]);
      if (ags.error || ats.error || cvs.error || !ativo) return;
      const convertidos = new Set((cvs.data || []).map(c => c.agendamento_avulso_id));
      // Soma todos os recebimentos efetivamente confirmados por agendamento.
      const pagos = new Map<string, number>();
      for (const at of ats.data || []) {
        if (!at.agendamento_id || !at.data_pagamento || Number(at.valor) <= 0) continue;
        pagos.set(at.agendamento_id, (pagos.get(at.agendamento_id) || 0) + Number(at.valor));
      }
      const mapa: Record<string,{id:string;data:string;valor:number;pago:boolean}[]> = {};
      for (const a of ags.data || []) {
        if (a.plano && a.plano !== "Avulso") continue;
        if (!["concluido","concluído","realizado","compareceu","finalizado"].includes((a.status || "").trim().toLowerCase())) continue;
        if (convertidos.has(a.id)) continue;
        const valor = Math.round((pagos.get(a.id) || 0) * 100) / 100;
        (mapa[a.pet_id] ||= []).push({ id: a.id, data: a.data, valor, pago: valor > 0 });
      }
      for (const itens of Object.values(mapa)) itens.sort((a,b) => b.data.localeCompare(a.data));
      if(ativo) setAvulsosConvertiveis(mapa);
    }
    void consultar(); return () => {ativo=false};
  }, [clienteSelecionado]);

  const [carregando, setCarregando] =
    useState(true);

  const [salvando, setSalvando] =
    useState(false);

  const [excluindo, setExcluindo] =
    useState(false);

  const [buscandoCep, setBuscandoCep] =
    useState(false);

  const [nomeCliente, setNomeCliente] =
    useState("");

  const [cpf, setCpf] =
    useState("");

  const [clienteCpfExistente, setClienteCpfExistente] =
    useState<{ id: string; nome: string } | null>(null);
  const [consultandoCpf, setConsultandoCpf] = useState(false);
  const [erroConsultaCpf, setErroConsultaCpf] = useState(false);

  // Consulta automaticamente ao completar 11 dígitos, sem exigir outros campos.
  useEffect(() => {
    const cpfNumeros = cpf.replace(/\D/g, "");
    if (!modalCadastro || cpfNumeros.length !== 11) {
      return;
    }

    let cancelado = false;
    const temporizador = setTimeout(async () => {
      setClienteCpfExistente(null);
      setErroConsultaCpf(false);
      setConsultandoCpf(true);
      try {
        // Busca no banco, inclusive registros antigos com CPF pontuado.
        const { data, error } = await supabase
          .from("clientes")
          .select("id,nome,cpf");
        if (error) throw error;
        if (cancelado) return;

        const encontrado = (data || []).find((item) =>
          String(item.cpf || "").replace(/\D/g, "") === cpfNumeros &&
          String(item.id) !== String(clienteEditandoId || "")
        );
        setClienteCpfExistente(
          encontrado
            ? { id: String(encontrado.id), nome: String(encontrado.nome || "Cliente") }
            : null
        );
      } catch (erro) {
        if (!cancelado) {
          console.error("Erro ao consultar CPF:", erro);
          setErroConsultaCpf(true);
        }
      } finally {
        if (!cancelado) setConsultandoCpf(false);
      }
    }, 250);

    return () => {
      cancelado = true;
      clearTimeout(temporizador);
    };
  }, [cpf, modalCadastro, clienteEditandoId]);

  const [contato, setContato] =
    useState("");

  const [cep, setCep] =
    useState("");

  const [endereco, setEndereco] =
    useState("");

  const [numero, setNumero] =
    useState("");

  const [bairro, setBairro] =
    useState("");

  const [
    observacoesCliente,
    setObservacoesCliente,
  ] = useState("");

  const [pets, setPets] =
    useState<Pet[]>([
      criarPet("novo-1"),
    ]);

  const [
    modalPlanoPet,
    setModalPlanoPet,
  ] = useState<{
    clienteId: string;
    petId: string;
  } | null>(null);

  const [
    frequenciaRenovacao,
    setFrequenciaRenovacao,
  ] = useState<Frequencia>(
    "Mensal"
  );

  const [
    dataInicioRenovacao,
    setDataInicioRenovacao,
  ] = useState("");

  const [
    turnoRenovacao,
    setTurnoRenovacao,
  ] = useState<Turno>("Manhã");

  const [
    valorRenovacao,
    setValorRenovacao,
  ] = useState("");

  const [
    renovandoPetId,
    setRenovandoPetId,
  ] = useState<string | null>(null);

 /*
   * ============================================================
   * CARREGAR CLIENTES
   * ============================================================
   *
   * Aqui usamos select("*") de propósito.
   *
   * Isso evita que a página inteira fique vazia caso exista
   * alguma diferença entre as colunas do banco e a lista
   * de colunas escrita manualmente no select.
   *
   * Clientes são carregados primeiro.
   * Se houver algum problema em pets/agendamentos, os clientes
   * continuam aparecendo.
   */

  async function carregarClientes() {
    setCarregando(true);

    try {
      const {
        data: clientesBanco,
        error: erroClientes,
      } = await supabase
        .from("clientes")
        .select("*")
        .order("nome", {
          ascending: true,
        });

      if (erroClientes) {
        console.error(
          "ERRO AO CARREGAR CLIENTES:",
          erroClientes
        );

        throw erroClientes;
      }

      /*
       * PETS
       */
      let petsBanco: RegistroBanco[] = [];

      const {
        data: petsData,
        error: erroPets,
      } = await supabase
        .from("pets")
        .select("*")
        .order("nome", {
          ascending: true,
        });

      if (erroPets) {
        console.error(
          "ERRO AO CARREGAR PETS:",
          erroPets
        );

        /*
         * Não interrompe o carregamento dos clientes.
         */
        petsBanco = [];
      } else {
        petsBanco = petsData || [];
      }

      /*
       * AGENDAMENTOS
       */
      let agendamentos: AgendamentoBanco[] =
        [];

      const idsPets = petsBanco
        .map((pet) => pet?.id)
        .filter(Boolean);

      if (idsPets.length > 0) {
        const {
          data: agendamentosData,
          error: erroAgendamentos,
        } = await supabase
          .from("agendamentos")
          .select("*")
          .in("pet_id", idsPets)
          .order("data", {
            ascending: true,
          });

        if (erroAgendamentos) {
          console.error(
            "ERRO AO CARREGAR AGENDAMENTOS:",
            erroAgendamentos
          );
        } else {
          agendamentos =
            (agendamentosData ||
              []) as AgendamentoBanco[];
        }
      }

      /*
       * CONVERTE OS PETS
       */
      const petsConvertidos: Pet[] =
        petsBanco.map(
          (petBanco) =>
            converterPetDoBanco(
              petBanco
            )
        );

      /*
       * MONTA OS CLIENTES
       */
      const clientesFormatados: Cliente[] =
        (clientesBanco || []).map(
          (cliente: { id?: string; nome?: string; cpf?: string; contato?: string; whatsapp?: string; telefone?: string; cep?: string; endereco?: string; rua?: string; numero?: string; bairro?: string; observacoes?: string }) => {
            const petsDoCliente =
              petsConvertidos
                .filter((pet) => {
                  const petBanco =
                    petsBanco.find(
                      (item) =>
                        String(
                          item?.id
                        ) ===
                        String(pet.id)
                    );

                  return (
                    String(
                      petBanco?.cliente_id ||
                        ""
                    ) ===
                    String(
                      cliente?.id ||
                        ""
                    )
                  );
                })
                .map((pet) => {
                  const plano =
                    criarResumoPlano(
                      pet,
                      agendamentos
                    );

                  const historicoBanhos: BanhoHistorico[] = agendamentos
                    .filter((agendamento) =>
                      String(agendamento.pet_id) === String(pet.id) &&
                      statusConcluido(agendamento.status)
                    )
                    .sort((a, b) => String(b.data).localeCompare(String(a.data)))
                    .map((agendamento) => {
                      const registro = agendamento as AgendamentoBanco & {
                        servico_nome?: string | null;
                        observacoes?: string | null;
                      };
                      return {
                        id: String(agendamento.id),
                        data: agendamento.data,
                        servico: registro.servico_nome || "Banho",
                        plano: agendamento.plano || "Avulso",
                        ciclo: agendamento.ciclo,
                        numeroBanho: agendamento.numero_banho,
                        observacoes: registro.observacoes || "",
                      };
                    });

                  return {
                    ...pet,
                    plano,
                    historicoBanhos,
                  };
                });

            return {
              id: String(
                cliente?.id || ""
              ),

              nome:
                cliente?.nome || "",

              cpf:
                cliente?.cpf || "",

              contato:
                cliente?.whatsapp ||
                cliente?.telefone ||
                "",

              cep:
                cliente?.cep || "",

              endereco:
                cliente?.rua || "",

              numero:
                cliente?.numero || "",

              bairro:
                cliente?.bairro || "",

              observacoes:
                cliente?.observacoes ||
                "",

              pets: petsDoCliente,
            };
          }
        );

      console.log(
        "CLIENTES CARREGADOS:",
        clientesFormatados
      );

      setClientes(
        clientesFormatados
      );

      return clientesFormatados;
    } catch (error: unknown) {
      console.error(
        "ERRO COMPLETO AO CARREGAR CLIENTES:",
        error
      );

      alert(
        `Erro ao carregar clientes: ${
          (error instanceof Error ? error.message : null) ||
          "erro desconhecido"
        }`
      );

      setClientes([]);

      return [];
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    const temporizador = window.setTimeout(() => { void carregarClientes(); }, 0);
    return () => window.clearTimeout(temporizador);
  }, []);

  function limparFormulario() {
    setNomeCliente("");
    setCpf("");
    setContato("");
    setCep("");
    setEndereco("");
    setNumero("");
    setBairro("");
    setObservacoesCliente("");

    setPets([
      criarPet(
        `novo-${crypto.randomUUID()}`
      ),
    ]);

    setModoEdicao(false);
    setClienteEditandoId(null);
  }

  function abrirCadastro() {
    limparFormulario();
    setModalCadastro(true);
  }

  function abrirEdicao(
    cliente: Cliente
  ) {
    setModoEdicao(true);

    setClienteEditandoId(
      cliente.id
    );

    setNomeCliente(
      cliente.nome
    );

    setCpf(cliente.cpf);

    setContato(
      cliente.contato
    );

    setCep(cliente.cep);

    setEndereco(
      cliente.endereco
    );

    setNumero(
      cliente.numero
    );

    setBairro(
      cliente.bairro
    );

    setObservacoesCliente(
      cliente.observacoes
    );

    setPets(
      cliente.pets.length
        ? cliente.pets.map(
            (pet) => ({
              ...pet,
            })
          )
        : [
            criarPet(
              `novo-${crypto.randomUUID()}`
            ),
          ]
    );

    setClienteSelecionado(
      null
    );

    setModalCadastro(true);
  }

  function fecharCadastro() {
    if (!salvando) {
      setModalCadastro(false);
      limparFormulario();
    }
  }

  async function buscarCep(
    valor: string
  ) {
    const cepNumeros =
      valor.replace(/\D/g, "");

    if (
      cepNumeros.length !== 8
    ) {
      return;
    }

    setBuscandoCep(true);

    try {
      const resposta =
        await fetch(
          `https://viacep.com.br/ws/${cepNumeros}/json/`
        );

      const dados =
        await resposta.json();

      if (dados.erro) {
        alert(
          "CEP não encontrado."
        );

        return;
      }

      setEndereco(
        dados.logradouro || ""
      );

      setBairro(
        dados.bairro || ""
      );
    } catch {
      alert(
        "Não foi possível consultar o CEP."
      );
    } finally {
      setBuscandoCep(false);
    }
  }

  function atualizarPet(
    id: string,
    campo: keyof Pet,
    valor: string
  ) {
    setPets((lista) =>
      lista.map((pet) =>
        pet.id === id
          ? {
              ...pet,
              [campo]: valor,
            }
          : pet
      )
    );
  }

  function atualizarServico(
    id: string,
    campo: keyof ServicosPet,
    valor: string
  ) {
    setPets((lista) =>
      lista.map((pet) =>
        pet.id === id
          ? {
              ...pet,
              servicos: {
                ...pet.servicos,
                [campo]: valor,
              },
            }
          : pet
      )
    );
  }

  function alternarListaServico(
    id: string,
    campo:
      | "tosas"
      | "adicionais",
    valor: string
  ) {
    setPets((lista) =>
      lista.map((pet) => {
        if (pet.id !== id) {
          return pet;
        }

        const atual =
          pet.servicos[campo];

        const novaLista =
          atual.includes(valor)
            ? atual.filter(
                (item) =>
                  item !== valor
              )
            : [
                ...atual,
                valor,
              ];

        return {
          ...pet,
          servicos: {
            ...pet.servicos,
            [campo]: novaLista,
          },
        };
      })
    );
  }

  function adicionarPet() {
    setPets((lista) => [
      ...lista,
      criarPet(
        `novo-${crypto.randomUUID()}`
      ),
    ]);
  }

  function removerPet(
    id: string
  ) {
    if (pets.length === 1) {
      alert(
        "O cliente precisa ter pelo menos um pet."
      );

      return;
    }

    if (
      modoEdicao &&
      !id.startsWith("novo-")
    ) {
      alert(
        "Pets já cadastrados não podem ser removidos por este botão. Use a exclusão do cadastro."
      );

      return;
    }

    setPets((lista) =>
      lista.filter(
        (pet) => pet.id !== id
      )
    );
  }

  function montarAgendamentosDoPetParaRenovacao(
    petId: string, pet: Pet, ciclo: number, dataInicioForcada: string
  ) {
    const dataInicio = dataInicioForcada;
    const frequencia = pet.servicos.frequencia;
    const quantidade = quantidadeBanhosPorCiclo(frequencia);
    const intervalo = intervaloEntreBanhos(frequencia);
    const valorFinal = valorNumerico(pet.servicos.valorTotal);
    const agendamentos =
      Array.from(
        {
          length: quantidade,
        },
        (_, index) => ({
          pet_id: petId,
          servico_id: null,

          data: adicionarDias(
            dataInicio,
            index *
              intervalo
          ),

          horario:
            horarioDoTurno(
              pet.servicos
                .turno
            ),

          status:
            "Agendado",

          observacoes:
            pet.observacoes ||
            null,

          valor_total:
            valorFinal,

          servico_nome:
            [
              index > 0 && frequencia !== "Avulso" &&
              /banho\s*(?:\+|com)\s*tosa\s*higi[eê]nica/i.test(pet.servicos.banhoTosa)
                ? "Banho" : pet.servicos.banhoTosa,
              ...pet.servicos.tosas,
              ...pet.servicos.adicionais,
            ].filter(Boolean).join(" + ") || null,

          plano:
            frequencia,

          numero_banho:
            index + 1,

          ciclo,

          pagamento_status: "Pendente",
          forma_pagamento_plano: null,
        })
      );

    return agendamentos;
  }

  async function criarAgendamentosDoPet(
    petId: string,
    pet: Pet,
    ciclo = 1,
    dataInicioForcada?: string
  ) {
    const dataInicio =
      dataInicioForcada ||
      pet.servicos.dataInicio;

    if (!dataInicio) {
      throw new Error(
        `Informe a data do atendimento do pet ${pet.nome}.`
      );
    }

    const frequencia =
      pet.servicos.frequencia;

    const quantidade =
      quantidadeBanhosPorCiclo(
        frequencia
      );

    const intervalo =
      intervaloEntreBanhos(
        frequencia
      );

    const valorFinal =
      valorNumerico(
        pet.servicos.valorTotal
      );

    const agendamentos =
      Array.from(
        {
          length: quantidade,
        },
        (_, index) => ({
          pet_id: petId,
          servico_id: null,

          data: adicionarDias(
            dataInicio,
            index *
              intervalo
          ),

          horario:
            horarioDoTurno(
              pet.servicos
                .turno
            ),

          status:
            "Agendado",

          observacoes:
            pet.observacoes ||
            null,

          valor_total:
            valorFinal,

          servico_nome:
            [
              index > 0 && frequencia !== "Avulso" &&
              /banho\s*(?:\+|com)\s*tosa\s*higi[eê]nica/i.test(pet.servicos.banhoTosa)
                ? "Banho" : pet.servicos.banhoTosa,
              ...pet.servicos.tosas,
              ...pet.servicos.adicionais,
            ].filter(Boolean).join(" + ") || null,

          plano:
            frequencia,

          numero_banho:
            index + 1,

          ciclo,

          pagamento_status: "Pendente",
          forma_pagamento_plano: null,
        })
      );

    const { data, error } =
      await supabase
        .from("agendamentos")
        .insert(agendamentos)
        .select("id");

    if (error) {
      throw error;
    }

    return (data || []).map((item) => String(item.id));
  }

  async function atualizarClienteExistente() {
    if (!clienteEditandoId) {
      throw new Error(
        "Cliente não identificado."
      );
    }

    // Identifica somente a passagem de Avulso para um plano, antes de salvar.
    const mudancasDePlano = new Map<string, { ciclo: number; pet: Pet }>();

    for (const pet of pets) {
      if (pet.id.startsWith("novo-") || pet.servicos.frequencia === "Avulso") continue;
      if (modoInicioPlano[pet.id] === "aproveitar") {
        throw new Error(`Para ${pet.nome}, confirme a conversão pelo botão dentro de Plano e Renovação. Não use Salvar alterações.`);
      }

      const { data: cadastroAtual, error: erroConsultaPet } = await supabase
        .from("pets")
        .select("frequencia")
        .eq("id", pet.id)
        .single();

      if (erroConsultaPet) throw erroConsultaPet;

      // Também recupera a conversão que já salvou Mensal/Quinzenal
      // sem criar os agendamentos (caso de cadastros afetados).
      const eraAvulso = cadastroAtual?.frequencia === "Avulso";
      if (!eraAvulso && cadastroAtual?.frequencia !== pet.servicos.frequencia) continue;

      const inicio = pet.servicos.dataInicio;
      if (!inicio || inicio < hojeISO()) {
        throw new Error(`Para iniciar o plano de ${pet.nome}, escolha a data de hoje ou uma data futura para o primeiro atendimento.`);
      }

      const quantidade = quantidadeBanhosPorCiclo(pet.servicos.frequencia);
      const intervalo = intervaloEntreBanhos(pet.servicos.frequencia);
      const datas = Array.from({ length: quantidade }, (_, i) => adicionarDias(inicio, i * intervalo));
      const horario = horarioDoTurno(pet.servicos.turno);

      const { data: anteriores, error: erroAgenda } = await supabase
        .from("agendamentos")
        .select("ciclo,data,horario,status,plano")
        .eq("pet_id", pet.id);

      if (erroAgenda) throw erroAgenda;
      const existentes = anteriores || [];
      const jaTemPlano = existentes.some((item) =>
        String(item.plano) === pet.servicos.frequencia
      );
      if (jaTemPlano) continue;
      // Recupera também um plano salvo no cadastro sem agendamentos,
      // mesmo que o pet não possua histórico de atendimento avulso.
      // A confirmação e a checagem de conflitos abaixo permanecem obrigatórias.

      const conflito = existentes.some((item) =>
        datas.includes(String(item.data)) &&
        String(item.horario || "").slice(0, 5) === horario &&
        !String(item.status || "").toLowerCase().includes("cancel")
      );
      if (conflito) {
        throw new Error(`Já existe um atendimento de ${pet.nome} em uma das datas do novo plano. Confira a agenda antes de salvar.`);
      }

      const maiorCiclo = existentes.reduce((maior, item) => Math.max(maior, Number(item.ciclo || 1)), 0);
      mudancasDePlano.set(pet.id, { ciclo: maiorCiclo + 1, pet });

      const confirmou = window.confirm(
        `Criar novo plano para ${pet.nome}?\n\n` +
        `Plano: ${pet.servicos.frequencia} (${quantidade} banhos)\n` +
        `Primeiro atendimento: ${formatarData(inicio)} às ${horario}\n` +
        `Datas: ${datas.map(formatarData).join(", ")}\n` +
        `Valor do ciclo: ${formatarMoeda(valorNumerico(pet.servicos.valorTotal))}\n\n` +
        `O banho avulso anterior e seu pagamento serão preservados.`
      );
      if (!confirmou) return false;
    }

    const {
      error: erroCliente,
    } = await supabase
      .from("clientes")
      .update({
        nome:
          nomeCliente.trim(),

        cpf:
          cpf.replace(
            /\D/g,
            ""
          ),

        whatsapp:
          contato.replace(
            /\D/g,
            ""
          ),

        telefone: null,

        cep:
          cep.replace(
            /\D/g,
            ""
          ),

        rua:
          endereco.trim(),

        numero:
          numero.trim(),

        bairro:
          bairro.trim(),

        observacoes:
          observacoesCliente.trim() ||
          null,
      })
      .eq(
        "id",
        clienteEditandoId
      );

    if (erroCliente) {
      throw erroCliente;
    }

    for (const pet of pets) {
      const dadosPet = {
        cliente_id:
          clienteEditandoId,

        nome:
          pet.nome.trim(),

        "raça":
          pet.raca,

        sexo:
          pet.sexo || null,

        data_nascimento:
          pet.dataNascimento ||
          null,

        peso: pet.peso
          ? Number(
              pet.peso.replace(
                ",",
                "."
              )
            )
          : null,

        observacoes:
          pet.observacoes.trim() ||
          null,

        banho_tosa:
          pet.servicos
            .banhoTosa ||
          null,

        tosas:
          pet.servicos.tosas,

        adicionais:
          pet.servicos
            .adicionais,

        frequencia:
          pet.servicos
            .frequencia,

        data_inicio:
          pet.servicos
            .dataInicio ||
          null,

        turno:
          pet.servicos
            .turno,

        valor_total:
          valorNumerico(
            pet.servicos
              .valorTotal
          ),
      };

      if (
        pet.id.startsWith(
          "novo-"
        )
      ) {
        const {
          data,
          error,
        } = await supabase
          .from("pets")
          .insert(
            dadosPet
          )
          .select("id")
          .single();

        if (error) {
          throw error;
        }

        await criarAgendamentosDoPet(
          data.id,
          pet
        );
      } else {
        const novoPlano = mudancasDePlano.get(pet.id);
        let idsCriados: string[] = [];

        if (novoPlano) {
          // Cria um ciclo separado; não altera o atendimento avulso anterior.
          idsCriados = await criarAgendamentosDoPet(
            pet.id, novoPlano.pet, novoPlano.ciclo, novoPlano.pet.servicos.dataInicio
          );
        }

        const { error } =
          await supabase
            .from("pets")
            .update(
              dadosPet
            )
            .eq(
              "id",
              pet.id
            );

        if (error) {
          if (idsCriados.length) {
            const { error: erroLimpeza } = await supabase
              .from("agendamentos")
              .delete()
              .in("id", idsCriados);
            if (erroLimpeza) console.error("Falha ao desfazer novo ciclo:", erroLimpeza);
          }
          throw error;
        }
      }
    }
    return true;
  }

  async function salvarCliente() {
    if (salvando) return;

    if (!nomeCliente.trim()) {
      alert(
        "Informe o nome do cliente."
      );

      return;
    }

    if (
      cpf.replace(
        /\D/g,
        ""
      ).length !== 11
    ) {
      alert(
        "Informe um CPF válido com 11 dígitos."
      );

      return;
    }

    if (
      contato.replace(
        /\D/g,
        ""
      ).length < 10
    ) {
      alert(
        "Informe um WhatsApp ou telefone válido."
      );

      return;
    }

    if (!pets.length) {
      alert(
        "Cadastre pelo menos um pet."
      );

      return;
    }

    for (const pet of pets) {
      if (!pet.nome.trim()) {
        alert(
          "Informe o nome de todos os pets."
        );

        return;
      }

      if (
        !pet.servicos.banhoTosa &&
        pet.servicos.tosas.length === 0 &&
        pet.servicos.adicionais.length === 0
      ) {
        alert(
          `Selecione pelo menos um serviço para o pet ${pet.nome}.`
        );

        return;
      }

      if (
        !pet.servicos
          .dataInicio
      ) {
        alert(
          `Informe a data do atendimento do pet ${pet.nome}.`
        );

        return;
      }

      if (
        !pet.servicos
          .valorTotal
      ) {
        alert(
          `Informe o valor do serviço/plano do pet ${pet.nome}.`
        );

        return;
      }
    }

    setSalvando(true);

    try {
      // Confere no banco antes de criar OU alterar, incluindo CPFs antigos formatados.
      const cpfInformado = cpf.replace(/\D/g, "");
      const { data: cpfsExistentes, error: erroCpf } = await supabase
        .from("clientes")
        .select("id,nome,cpf");

      if (erroCpf) throw erroCpf;

      const duplicado = (cpfsExistentes || []).find((registro) =>
        String(registro.cpf || "").replace(/\D/g, "") === cpfInformado &&
        String(registro.id) !== String(clienteEditandoId || "")
      );

      if (duplicado) {
        alert(`Este CPF já está cadastrado para ${duplicado.nome || "outro cliente"}.\nProcure o cadastro existente e utilize a opção Editar.`);
        return;
      }

      if (modoEdicao) {
        const atualizado = await atualizarClienteExistente();
        if (!atualizado) return;

        const dadosAtualizados =
          await carregarClientes();

        const clienteAtualizado =
          dadosAtualizados.find(
            (cliente) =>
              cliente.id ===
              clienteEditandoId
          );

        if (
          clienteAtualizado
        ) {
          setClienteSelecionado(
            clienteAtualizado
          );
        }

        setModalCadastro(
          false
        );

        limparFormulario();

        alert(
          "Cadastro atualizado com sucesso!"
        );

        return;
      }

      const {
        data: cliente,
        error: erroCliente,
      } = await supabase
        .from("clientes")
        .insert({
          nome:
            nomeCliente.trim(),

          cpf:
            cpf.replace(
              /\D/g,
              ""
            ),

          whatsapp:
            contato.replace(
              /\D/g,
              ""
            ),

          telefone: null,

          cep:
            cep.replace(
              /\D/g,
              ""
            ),

          rua:
            endereco.trim(),

          numero:
            numero.trim(),

          bairro:
            bairro.trim(),

          observacoes:
            observacoesCliente.trim() ||
            null,
        })
        .select("id")
        .single();

      if (erroCliente) {
        throw erroCliente;
      }

      const petsCriados: string[] =
        [];

      try {
        for (const pet of pets) {
          const {
            data: petCriado,
            error,
          } = await supabase
            .from("pets")
            .insert({
              cliente_id:
                cliente.id,

              nome:
                pet.nome.trim(),

              "raça":
                pet.raca,

              sexo:
                pet.sexo ||
                null,

              data_nascimento:
                pet.dataNascimento ||
                null,

              peso: pet.peso
                ? Number(
                    pet.peso.replace(
                      ",",
                      "."
                    )
                  )
                : null,

              observacoes:
                pet.observacoes.trim() ||
                null,

              banho_tosa:
                pet.servicos
                  .banhoTosa ||
                null,

              tosas:
                pet.servicos
                  .tosas,

              adicionais:
                pet.servicos
                  .adicionais,

              frequencia:
                pet.servicos
                  .frequencia,

              data_inicio:
                pet.servicos
                  .dataInicio ||
                null,

              turno:
                pet.servicos
                  .turno,

              valor_total:
                valorNumerico(
                  pet.servicos
                    .valorTotal
                ),
            })
            .select("id")
            .single();

          if (error) {
            throw error;
          }

          petsCriados.push(
            petCriado.id
          );

          /*
           * PRIMEIRO CICLO:
           *
           * Avulso = 1 atendimento
           * Quinzenal = 2 banhos
           * Mensal = 4 banhos
           */
          await criarAgendamentosDoPet(
            petCriado.id,
            pet,
            1
          );
        }
      } catch (erroPets) {
        if (
          petsCriados.length
        ) {
          await supabase
            .from(
              "agendamentos"
            )
            .delete()
            .in(
              "pet_id",
              petsCriados
            );

          await supabase
            .from("pets")
            .delete()
            .in(
              "id",
              petsCriados
            );
        }

        await supabase
          .from("clientes")
          .delete()
          .eq(
            "id",
            cliente.id
          );

        throw erroPets;
      }

      await carregarClientes();

      setModalCadastro(
        false
      );

      limparFormulario();

      alert(
        "Cliente e pets cadastrados com sucesso!"
      );
    } catch (error: unknown) {
      console.error(
        "ERRO AO SALVAR:",
        error
      );

      alert(
        `Não foi possível salvar o cadastro: ${
          (error instanceof Error ? error.message : null) ||
          "erro desconhecido"
        }`
      );
    } finally {
      setSalvando(false);
    }
  }

  async function excluirCliente() {
    if (!clienteSelecionado)
      return;

    const confirmou =
      window.confirm(
        `Tem certeza que deseja excluir o cadastro de ${clienteSelecionado.nome}?`
      );

    if (!confirmou) return;

    setExcluindo(true);

    try {
      const idsPets =
        clienteSelecionado.pets.map(
          (pet) => pet.id
        );

      if (
        idsPets.length
      ) {
        const {
          error:
            erroAgendamentos,
        } = await supabase
          .from(
            "agendamentos"
          )
          .delete()
          .in(
            "pet_id",
            idsPets
          );

        if (
          erroAgendamentos
        ) {
          throw erroAgendamentos;
        }

        const {
          error: erroPets,
        } = await supabase
          .from("pets")
          .delete()
          .in(
            "id",
            idsPets
          );

        if (erroPets) {
          throw erroPets;
        }
      }

      const {
        error: erroCliente,
      } = await supabase
        .from("clientes")
        .delete()
        .eq(
          "id",
          clienteSelecionado.id
        );

      if (erroCliente) {
        throw erroCliente;
      }

      setClienteSelecionado(
        null
      );

      await carregarClientes();

      alert(
        "Cadastro excluído com sucesso."
      );
    } catch (error: unknown) {
      console.error(error);

      alert(
        `Não foi possível excluir o cadastro: ${
          (error instanceof Error ? error.message : null) ||
          "erro desconhecido"
        }`
      );
    } finally {
      setExcluindo(false);
    }
  }

  async function recarregarESelecionarCliente(
    clienteId: string
  ) {
    const dados =
      await carregarClientes();

    const atualizado =
      dados.find(
        (cliente) =>
          cliente.id ===
          clienteId
      );

    setClienteSelecionado(
      atualizado || null
    );
  }

  function abrirRenovacao(
    cliente: Cliente,
    pet: Pet
  ) {
    setModalPlanoPet({
      clienteId:
        cliente.id,
      petId: pet.id,
    });

    setFrequenciaRenovacao(
      pet.servicos
        .frequencia ===
        "Avulso"
        ? "Mensal"
        : pet.servicos
            .frequencia
    );

    setDataInicioRenovacao(
      hojeISO()
    );

    setTurnoRenovacao(
      pet.servicos.turno
    );

    setValorRenovacao(
      pet.servicos
        .valorTotal
    );

  }

  function fecharRenovacao() {
    if (!renovandoPetId) {
      setModalPlanoPet(null);
    }
  }

  async function renovarPlano() {
    if (!modalPlanoPet)
      return;

    const cliente =
      clientes.find(
        (item) =>
          item.id ===
          modalPlanoPet.clienteId
      );

    const pet =
      cliente?.pets.find(
        (item) =>
          item.id ===
          modalPlanoPet.petId
      );

    if (!cliente || !pet) {
      alert(
        "Não foi possível localizar o pet."
      );

      return;
    }

    if (!dataInicioRenovacao) {
      alert(
        "Informe a data do primeiro atendimento do novo ciclo."
      );

      return;
    }

    if (!valorRenovacao) {
      alert(
        "Informe o valor do novo ciclo."
      );

      return;
    }

    setRenovandoPetId(
      pet.id
    );

    try {
      const {
        data:
          agendamentosExistentes,
        error,
      } = await supabase
        .from(
          "agendamentos"
        )
        .select(
          "id,ciclo"
        )
        .eq(
          "pet_id",
          pet.id
        );

      if (error) {
        throw error;
      }

      const maiorCiclo =
        (
          agendamentosExistentes ||
          []
        ).reduce(
          (
            maior: number,
            item: { ciclo?: number | null }
          ) =>
            Math.max(
              maior,
              Number(
                item.ciclo ||
                  1
              )
            ),
          0
        );

      const novoCiclo =
        maiorCiclo + 1;

      const novaPet: Pet = {
        ...pet,

        servicos: {
          ...pet.servicos,

          frequencia:
            frequenciaRenovacao,

          dataInicio:
            dataInicioRenovacao,

          turno:
            turnoRenovacao,

          valorTotal:
            valorRenovacao,

        },
      };

      /*
       * SOMENTE O NOVO CICLO É CRIADO.
       */
      const registrosRenovacao = montarAgendamentosDoPetParaRenovacao(
        pet.id, novaPet, novoCiclo, dataInicioRenovacao
      );
      const { data: quantidadeInserida, error: erroRenovacao } = await supabase
        .rpc("renovar_ciclos_agrominas", {
          p_registros: registrosRenovacao,
          p_atualizacao_pet: {
            pet_id: pet.id,
            frequencia: frequenciaRenovacao,
            data_inicio: dataInicioRenovacao,
            turno: turnoRenovacao,
            valor_total: valorNumerico(valorRenovacao),
          },
        });
      if (erroRenovacao) throw erroRenovacao;
      if (Number(quantidadeInserida) !== registrosRenovacao.length)
        throw new Error("A renovação não foi confirmada integralmente.");

      setModalPlanoPet(
        null
      );

      await recarregarESelecionarCliente(
        cliente.id
      );

      alert(
        `Ciclo ${novoCiclo} criado com sucesso!\n\n${quantidadeBanhosPorCiclo(
          frequenciaRenovacao
        )} banho(s) foram adicionados à agenda.`
      );
    } catch (error: unknown) {
      console.error(
        "ERRO AO RENOVAR:",
        error
      );

      alert(
        `Não foi possível renovar o plano: ${
          (error instanceof Error ? error.message : null) ||
          "erro desconhecido"
        }`
      );
    } finally {
      setRenovandoPetId(
        null
      );
    }
  }

  const clientesFiltrados =
    useMemo(() => {
      const termo =
        busca
          .trim()
          .toLowerCase();

      if (!termo) {
        return clientes;
      }

      return clientes.filter(
        (cliente) => {
          const dadosCliente = [
            cliente.nome,
            cliente.cpf,
            cliente.contato,
            cliente.cep,
            cliente.endereco,
            cliente.bairro,
          ]
            .join(" ")
            .toLowerCase();

          const dadosPets =
            cliente.pets
              .map(
                (pet) =>
                  [
                    pet.nome,
                    pet.raca,
                    pet.servicos
                      .banhoTosa,
                  ].join(" ")
              )
              .join(" ")
              .toLowerCase();

          return (
            dadosCliente.includes(
              termo
            ) ||
            dadosPets.includes(
              termo
            )
          );
        }
      );
    }, [
      clientes,
      busca,
    ]);

  const clientesVisiveis =
    busca.trim()
      ? clientesFiltrados
      : clientesFiltrados.slice(
          0,
          8
        );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="fixed inset-y-0 left-0 z-40 h-screen">
        <MenuLateral />
      </div>

      <main className="ml-0 min-h-screen pt-0 lg:ml-64">
        <div className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
            <div>
              <p className="text-sm font-semibold text-emerald-600">
                SPA PET AGROMINAS
              </p>

              <h1 className="mt-1 text-2xl font-bold text-slate-900">
                Clientes & Pets
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Cadastre e acompanhe os clientes,
                pets e planos de banho e tosa.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">

              <button
                type="button"
                onClick={abrirCadastro}
                className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
              >
                + Novo cliente
              </button>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl space-y-6 px-5 py-6 lg:px-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3">
              <h2 className="font-bold text-slate-900">
                Buscar cliente ou pet
              </h2>

              <p className="text-sm text-slate-500">
                Pesquise pelo nome do tutor,
                contato, CPF ou nome do pet.
              </p>
            </div>

            <div className="relative">
              <input
                value={busca}
                onChange={(e) =>
                  setBusca(
                    e.target.value
                  )
                }
                placeholder="Digite o nome do cliente ou pet..."
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 pl-11 text-sm outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
              />

              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                🔎
              </span>
            </div>
          </div>

          {carregando ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
              <div className="text-sm text-slate-500">
                Carregando clientes...
              </div>
            </div>
          ) : clientesVisiveis.length ===
            0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <div className="text-4xl">
                🐾
              </div>

              <h2 className="mt-3 text-lg font-bold text-slate-900">
                Nenhum cadastro encontrado
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Cadastre um cliente e seus pets
                para começar.
              </p>

              {!busca && (
                <button
                  onClick={
                    abrirCadastro
                  }
                  className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700"
                >
                  Cadastrar primeiro cliente
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-5">
              {clientesVisiveis.map(
                (cliente) => (
                  <div
                    key={
                      cliente.id
                    }
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white px-5 py-5">
                      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                        <div>
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-xl">
                              👤
                            </div>

                            <div>
                              <h2 className="font-bold text-slate-900">
                                {
                                  cliente.nome
                                }
                              </h2>

                              <p className="text-sm text-slate-500">
                                {cliente.contato ||
                                  "Sem contato"}

                                {cliente.cpf
                                  ? ` • CPF ${formatarCpf(
                                      cliente.cpf
                                    )}`
                                  : ""}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl bg-white px-4 py-3 shadow-sm">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Pets
                          </p>

                          <p className="text-lg font-bold text-slate-900">
                            {
                              cliente
                                .pets
                                .length
                            }
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 p-5">
                      {cliente.pets.length ===
                        0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500 md:col-span-2">
                          Este cliente ainda não possui pets cadastrados.
                        </div>
                      ) : (
                        cliente.pets.map(
                          (pet) => (
                            <div
                              key={
                                pet.id
                              }
                              className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                            >
                              <div className="grid gap-5 lg:grid-cols-[minmax(260px,0.85fr)_minmax(0,1.4fr)]">
                                <div className="min-w-0">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-xl shadow-sm">
                                    🐶
                                  </div>

                                  <div>
                                    <h3 className="font-bold text-slate-900">
                                      {
                                        pet.nome
                                      }
                                    </h3>

                                    <p className="text-xs text-slate-500">
                                      {pet.raca ||
                                        "Raça não informada"}
                                    </p>
                                  </div>
                                </div>

                                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                                  {pet.servicos
                                    .turno ===
                                  "Tarde"
                                    ? "🌤️ 13:30"
                                    : "☀️ 08:30"}
                                </span>
                              </div>

                              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                                <div className="rounded-xl bg-white p-3">
                                  <p className="text-slate-400">
                                    Plano
                                  </p>

                                  <p className="mt-1 font-bold text-slate-800">
                                    {
                                      pet.servicos
                                        .frequencia
                                    }
                                  </p>
                                </div>

                                <div className="rounded-xl bg-white p-3">
                                  <p className="text-slate-400">
                                    Valor
                                  </p>

                                  <p className="mt-1 font-bold text-slate-800">
                                    {formatarMoeda(
                                      pet.servicos
                                        .valorTotal
                                    )}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-2 rounded-xl bg-white p-3 text-xs">
                                <p className="text-slate-400">
                                  Serviço
                                </p>

                                <p className="mt-1 font-semibold text-slate-800">
                                  {[pet.servicos.banhoTosa, ...pet.servicos.tosas, ...pet.servicos.adicionais]
                                    .filter(Boolean).join(" + ") || "Não informado"}
                                </p>
                              </div>

                              {pet.plano && (
                                <div className="mt-3 flex items-center justify-between rounded-xl bg-white p-3">
                                  <div>
                                    <p className="text-xs text-slate-400">
                                      Ciclo{" "}
                                      {
                                        pet.plano
                                          .ciclo
                                      }
                                    </p>

                                    <p className="text-sm font-bold text-slate-800">
                                      {
                                        pet.plano
                                          .banhosConcluidos
                                      }
                                      /
                                      {
                                        pet.plano
                                          .totalBanhos
                                      }{" "}
                                      banhos
                                    </p>
                                  </div>


                                </div>
                              )}
                                </div>
                                <section className="min-w-0 rounded-2xl border border-emerald-100 bg-white p-4">
                                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                    <h4 className="text-sm font-bold text-emerald-800">
                                      Histórico de banhos
                                    </h4>
                                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                                      {pet.historicoBanhos?.length ?? 0} realizados
                                    </span>
                                  </div>
                                  {(pet.historicoBanhos?.length ?? 0) === 0 ? (
                                    <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                                      Nenhum banho concluído registrado.
                                    </p>
                                  ) : (
                                    <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                                      {pet.historicoBanhos?.map((banho) => (
                                        <div key={banho.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                          <div className="flex flex-wrap items-start justify-between gap-2">
                                            <div>
                                              <p className="text-sm font-bold text-slate-800">
                                                {formatarData(banho.data)}
                                              </p>
                                              <p className="mt-1 text-xs text-slate-600">{banho.servico}</p>
                                              <p className="mt-1 text-xs text-slate-500">
                                                {banho.plano}
                                                {banho.ciclo ? ` · Ciclo ${banho.ciclo}` : ""}
                                                {banho.numeroBanho ? ` · Banho ${banho.numeroBanho}` : ""}
                                              </p>
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setAnotacaoEditando(banho.id);
                                                setTextoAnotacao(banho.observacoes);
                                              }}
                                              className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
                                            >
                                              {banho.observacoes ? "Editar anotação" : "+ Anotação"}
                                            </button>
                                          </div>
                                          {anotacaoEditando === banho.id ? (
                                            <div className="mt-3 space-y-2">
                                              <textarea
                                                value={textoAnotacao}
                                                onChange={(evento) => setTextoAnotacao(evento.target.value)}
                                                rows={2}
                                                placeholder="Escreva uma observação sobre este banho..."
                                                className="w-full resize-y rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-800 outline-none focus:border-emerald-500"
                                              />
                                              <div className="flex justify-end gap-2">
                                                <button type="button" onClick={() => setAnotacaoEditando(null)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600">Cancelar</button>
                                                <button type="button" disabled={salvandoAnotacao} onClick={() => void salvarAnotacaoBanho(banho.id)} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
                                                  {salvandoAnotacao ? "Salvando..." : "Salvar"}
                                                </button>
                                              </div>
                                            </div>
                                          ) : banho.observacoes ? (
                                            <p className="mt-2 whitespace-pre-wrap rounded-lg bg-white p-2 text-xs text-slate-700">{banho.observacoes}</p>
                                          ) : null}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </section>
                              </div>
                            </div>
                          )
                        )
                      )}
                    </div>

                    <div className="flex justify-end border-t border-slate-100 px-5 py-4">
                      <button
                        onClick={() =>
                          setClienteSelecionado(
                            cliente
                          )
                        }
                        className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800"
                      >
                        Visualizar
                      </button>

                      <button
                        onClick={() =>
                          abrirEdicao(
                            cliente
                          )
                        }
                        className="ml-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                      >
                        Editar
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </main>

      {/* ========================================================= */}
      {/* MODAL CADASTRO / EDIÇÃO                                    */}
      {/* ========================================================= */}

      {modalCadastro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm">
          <div className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-sm font-semibold text-emerald-600">
                  SPA PET AGROMINAS
                </p>

                <h2 className="text-xl font-bold text-slate-900">
                  {modoEdicao
                    ? "Editar cliente e pets"
                    : "Novo cliente e pets"}
                </h2>
              </div>

              <button
                onClick={
                  fecharCadastro
                }
                className="rounded-full p-2 text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <div className="overflow-y-auto p-6">
              <div className="space-y-6">
                <section className="rounded-2xl border border-slate-200 p-5">
                  <div className="mb-5">
                    <h3 className="font-bold text-slate-900">
                      Dados do cliente
                    </h3>

                    <p className="text-sm text-slate-500">
                      Informações do tutor.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className="text-sm font-semibold text-slate-700">
                        Nome
                      </label>

                      <input
                        value={
                          nomeCliente
                        }
                        onChange={(e) =>
                          setNomeCliente(
                            e.target
                              .value
                          )
                        }
                        placeholder="Nome completo"
                        className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-slate-700">
                        CPF
                      </label>

                      <input
                        value={formatarCpf(
                          cpf
                        )}
                        onChange={(e) =>
                          setCpf(
                            e.target
                              .value
                          )
                        }
                        placeholder="000.000.000-00"
                        className={`mt-1 w-full rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 ${clienteCpfExistente ? "border-red-500 bg-red-50 focus:ring-red-100" : "border-slate-300 focus:border-emerald-500 focus:ring-emerald-100"}`}
                      />
                      {consultandoCpf && (
                        <p className="mt-2 text-xs text-slate-500" role="status">Consultando CPF...</p>
                      )}
                      {clienteCpfExistente && (
                        <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
                          <strong>CPF já cadastrado!</strong> Este CPF pertence a {clienteCpfExistente.nome}.
                          <p className="mt-1">Pesquise esse cliente na lista e clique em Editar para adicionar outro pet.</p>
                        </div>
                      )}
                      {erroConsultaCpf && (
                        <p className="mt-2 text-xs text-amber-700" role="alert">Não foi possível consultar o CPF agora. Tente novamente antes de salvar.</p>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-slate-700">
                        WhatsApp ou telefone
                      </label>

                      <input
                        value={formatarContato(
                          contato
                        )}
                        onChange={(e) =>
                          setContato(
                            e.target
                              .value
                          )
                        }
                        placeholder="(00) 00000-0000"
                        className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-slate-700">
                        CEP
                      </label>

                      <div className="relative">
                        <input
                          value={formatarCep(
                            cep
                          )}
                          onChange={(e) => {
                            const valor =
                              formatarCep(
                                e
                                  .target
                                  .value
                              );

                            setCep(
                              valor
                            );

                            if (
                              valor.replace(
                                /\D/g,
                                ""
                              )
                                .length ===
                              8
                            ) {
                              buscarCep(
                                valor
                              );
                            }
                          }}
                          placeholder="00000-000"
                          className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                        />

                        {buscandoCep && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-emerald-600">
                            Buscando...
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-slate-700">
                        Rua
                      </label>

                      <input
                        value={
                          endereco
                        }
                        onChange={(e) =>
                          setEndereco(
                            e.target
                              .value
                          )
                        }
                        placeholder="Rua"
                        className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-slate-700">
                        Número
                      </label>

                      <input
                        value={
                          numero
                        }
                        onChange={(e) =>
                          setNumero(
                            e.target
                              .value
                          )
                        }
                        placeholder="Número"
                        className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-slate-700">
                        Bairro
                      </label>

                      <input
                        value={
                          bairro
                        }
                        onChange={(e) =>
                          setBairro(
                            e.target
                              .value
                          )
                        }
                        placeholder="Bairro"
                        className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-sm font-semibold text-slate-700">
                        Observações
                      </label>

                      <textarea
                        value={
                          observacoesCliente
                        }
                        onChange={(e) =>
                          setObservacoesCliente(
                            e.target
                              .value
                          )
                        }
                        rows={3}
                        placeholder="Observações sobre o cliente..."
                        className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                    </div>
                  </div>
                </section>

                {pets.map(
                  (pet, index) => (
                    <section
                      key={
                        pet.id
                      }
                      className="rounded-2xl border border-slate-200 p-5"
                    >
                      <div className="mb-5 flex items-center justify-between">
                        <div>
                          <h3 className="font-bold text-slate-900">
                            🐾 Pet{" "}
                            {index +
                              1}
                          </h3>

                          <p className="text-sm text-slate-500">
                            Dados do pet.
                          </p>
                        </div>

                        {pets.length >
                          1 && (
                          <button
                            onClick={() =>
                              removerPet(
                                pet.id
                              )
                            }
                            className="rounded-xl px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                          >
                            Remover
                          </button>
                        )}
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="text-sm font-semibold text-slate-700">
                            Nome do pet
                          </label>

                          <input
                            value={
                              pet.nome
                            }
                            onChange={(
                              e
                            ) =>
                              atualizarPet(
                                pet.id,
                                "nome",
                                e
                                  .target
                                  .value
                              )
                            }
                            placeholder="Nome do pet"
                            className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                          />
                        </div>

                        <div>
                          <label className="text-sm font-semibold text-slate-700">
                            Raça
                          </label>

                          <select
                            value={
                              pet.raca
                            }
                            onChange={(
                              e
                            ) =>
                              atualizarPet(
                                pet.id,
                                "raca",
                                e
                                  .target
                                  .value
                              )
                            }
                            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                          >
                            <option value="">
                              Selecione a raça
                            </option>

                            {racas.map(
                              (
                                raca
                              ) => (
                                <option
                                  key={
                                    raca
                                  }
                                  value={
                                    raca
                                  }
                                >
                                  {
                                    raca
                                  }
                                </option>
                              )
                            )}
                          </select>
                        </div>

                        <div>
                          <label className="text-sm font-semibold text-slate-700">
                            Sexo
                          </label>

                          <select
                            value={
                              pet.sexo
                            }
                            onChange={(
                              e
                            ) =>
                              atualizarPet(
                                pet.id,
                                "sexo",
                                e
                                  .target
                                  .value
                              )
                            }
                            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                          >
                            <option value="">
                              Selecione
                            </option>

                            <option value="Macho">
                              Macho
                            </option>

                            <option value="Fêmea">
                              Fêmea
                            </option>
                          </select>
                        </div>

                        <div>
                          <label className="text-sm font-semibold text-slate-700">
                            Data de nascimento
                          </label>

                          <input
                            type="date"
                            value={
                              pet.dataNascimento
                            }
                            onChange={(
                              e
                            ) =>
                              atualizarPet(
                                pet.id,
                                "dataNascimento",
                                e
                                  .target
                                  .value
                              )
                            }
                            className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                          />
                        </div>

                        <div>
                          <label className="text-sm font-semibold text-slate-700">
                            Peso
                          </label>

                          <input
                            type="number"
                            step="0.1"
                            value={
                              pet.peso
                            }
                            onChange={(
                              e
                            ) =>
                              atualizarPet(
                                pet.id,
                                "peso",
                                e
                                  .target
                                  .value
                              )
                            }
                            placeholder="Ex.: 8,5"
                            className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                          />
                        </div>
                      </div>

                      <div className="mt-6 border-t border-slate-200 pt-6">
                        <h4 className="font-bold text-slate-900">
                          Serviço de banho e tosa (opcional)
                        </h4>
                        <p className="mt-1 text-sm text-slate-500">
                          Se o pet vier somente para tosa ou adicionais, deixe o banho sem selecionar.
                        </p>

                        <div className="mt-3 grid gap-2 md:grid-cols-3">
                          {opcoesBanhoTosa.map(
                            (
                              opcao
                            ) => (
                              <button
                                key={
                                  opcao
                                }
                                type="button"
                                onClick={() =>
                                  atualizarServico(
                                    pet.id,
                                    "banhoTosa",
                                    pet.servicos.banhoTosa === opcao ? "" : opcao
                                  )
                                }
                                className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                                  pet
                                    .servicos
                                    .banhoTosa ===
                                  opcao
                                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                    : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300"
                                }`}
                              >
                                {
                                  opcao
                                }
                              </button>
                            )
                          )}
                        </div>
                      </div>

                      <div className="mt-6">
                        <h4 className="font-bold text-slate-900">
                          Tosas
                        </h4>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {opcoesTosas.map(
                            (
                              opcao
                            ) => {
                              const selecionado =
                                pet.servicos.tosas.includes(
                                  opcao
                                );

                              return (
                                <button
                                  key={
                                    opcao
                                  }
                                  type="button"
                                  onClick={() =>
                                    alternarListaServico(
                                      pet.id,
                                      "tosas",
                                      opcao
                                    )
                                  }
                                  className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                                    selecionado
                                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                      : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300"
                                  }`}
                                >
                                  {
                                    opcao
                                  }
                                </button>
                              );
                            }
                          )}
                        </div>
                      </div>

                      <div className="mt-6">
                        <h4 className="font-bold text-slate-900">
                          Adicionais
                        </h4>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {opcoesAdicionais.map(
                            (
                              opcao
                            ) => {
                              const selecionado =
                                pet.servicos.adicionais.includes(
                                  opcao
                                );

                              return (
                                <button
                                  key={
                                    opcao
                                  }
                                  type="button"
                                  onClick={() =>
                                    alternarListaServico(
                                      pet.id,
                                      "adicionais",
                                      opcao
                                    )
                                  }
                                  className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                                    selecionado
                                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                      : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300"
                                  }`}
                                >
                                  {
                                    opcao
                                  }
                                </button>
                              );
                            }
                          )}
                        </div>
                      </div>

                      <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
                        <div className="mb-5">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">
                              🔄
                            </span>

                            <h4 className="font-bold text-slate-900">
                              Plano e Renovação
                            </h4>
                          </div>

                          <p className="mt-1 text-sm text-slate-500">
                            Defina o ciclo atual do
                            pet. A renovação cria
                            um novo ciclo sem alterar
                            os anteriores.
                          </p>
                        </div>

                        <div className="grid gap-3 md:grid-cols-3">
                          {([
                            "Avulso",
                            "Quinzenal",
                            "Mensal",
                          ] as Frequencia[]).map(
                            (
                              frequencia: Frequencia
                            ) => (
                              <button
                                key={
                                  frequencia
                                }
                                type="button"
                                onClick={() =>
                                  atualizarServico(
                                    pet.id,
                                    "frequencia",
                                    frequencia
                                  )
                                }
                                className={`rounded-xl border p-4 text-left transition ${
                                  pet
                                    .servicos
                                    .frequencia ===
                                  frequencia
                                    ? "border-emerald-500 bg-white shadow-sm"
                                    : "border-slate-200 bg-white/70 hover:border-emerald-300"
                                }`}
                              >
                                <p className="font-bold text-slate-900">
                                  {
                                    frequencia
                                  }
                                </p>

                                <p className="mt-1 text-xs text-slate-500">
                                  {descricaoFrequencia(
                                    frequencia
                                  )}
                                </p>
                              </button>
                            )
                          )}
                        </div>

                        {modoEdicao && !pet.id.startsWith("novo-") && pet.servicos.frequencia !== "Avulso" && (avulsosConvertiveis[pet.id] || []).length > 0 && (
                          <div className="mt-5 rounded-xl border border-emerald-200 bg-white p-4">
                            <p className="text-sm font-bold text-slate-900">Como deseja iniciar o plano?</p>
                            <div className="mt-3 grid gap-2 md:grid-cols-2">
                              <button type="button" onClick={() => setModoInicioPlano(v => ({...v,[pet.id]:"aproveitar"}))}
                                className={`rounded-xl border p-3 text-left text-sm ${modoInicioPlano[pet.id] === "aproveitar" ? "border-emerald-600 bg-emerald-50" : "border-slate-200"}`}>
                                <strong>Aproveitar último banho Avulso</strong><span className="mt-1 block text-xs text-slate-600">O banho realizado será o primeiro do plano.</span>
                              </button>
                              <button type="button" onClick={() => {setModoInicioPlano(v => ({...v,[pet.id]:"novo"}));setConversaoAberta(null);}}
                                className={`rounded-xl border p-3 text-left text-sm ${modoInicioPlano[pet.id] !== "aproveitar" ? "border-emerald-600 bg-emerald-50" : "border-slate-200"}`}>
                                <strong>Iniciar novo ciclo</strong><span className="mt-1 block text-xs text-slate-600">Mantém o banho anterior e agenda todos os banhos.</span>
                              </button>
                            </div>
                            {modoInicioPlano[pet.id] === "aproveitar" && (
                              <div className="mt-4 space-y-3">
                                <p className="text-xs text-slate-600">Selecione o atendimento a aproveitar:</p>
                                {(avulsosConvertiveis[pet.id] || []).map(a => (
                                  <div key={a.id} className="rounded-lg border border-slate-200 p-3">
                                    <label className="flex items-center gap-2 text-sm font-semibold">
                                      <input type="radio" name={`avulso-${pet.id}`} checked={conversaoAberta === a.id} onChange={() => setConversaoAberta(a.id)} />
                                      {formatarData(a.data)} — {a.pago ? `Recebido: ${formatarMoeda(a.valor)}` : "Sem pagamento registrado"}
                                    </label>
                                    {conversaoAberta === a.id && (
                                      <div className="mt-3 space-y-2">
                                        <p className="text-sm">Plano: <strong>{pet.servicos.frequencia}</strong> · Total: <strong>{formatarMoeda(valorNumerico(pet.servicos.valorTotal))}</strong></p>
                                        <p className="text-sm">Crédito confirmado: <strong>{formatarMoeda(a.valor)}</strong> · Saldo: <strong>{formatarMoeda(Math.max(0,valorNumerico(pet.servicos.valorTotal)-a.valor))}</strong></p>
                                        <button type="button" disabled={convertendo || valorNumerico(pet.servicos.valorTotal) < a.valor || valorNumerico(pet.servicos.valorTotal) <= 0}
                                          onClick={() => void converterAvulso(pet,a.id,a.valor,pet.servicos.frequencia as "Mensal" | "Quinzenal",pet.servicos.valorTotal)}
                                          className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-40">
                                          {convertendo ? "Convertendo..." : "Confirmar aproveitamento do banho"}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                                <p className="text-xs text-slate-500">Use o botão de conversão acima. Não clique em Salvar alterações para aproveitar o banho.</p>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="mt-4 grid gap-4 md:grid-cols-3">
                          <div>
                            <label className="text-sm font-semibold text-slate-700">
                              Data do primeiro atendimento
                            </label>

                            <input
                              type="date"
                              value={
                                pet
                                  .servicos
                                  .dataInicio
                              }
                              onChange={(
                                e
                              ) =>
                                atualizarServico(
                                  pet.id,
                                  "dataInicio",
                                  e
                                    .target
                                    .value
                                )
                              }
                              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                            />
                          </div>

                          <div>
                            <label className="text-sm font-semibold text-slate-700">
                              Turno
                            </label>

                            <select
                              value={
                                pet
                                  .servicos
                                  .turno
                              }
                              onChange={(
                                e
                              ) =>
                                atualizarServico(
                                  pet.id,
                                  "turno",
                                  e
                                    .target
                                    .value
                                )
                              }
                              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                            >
                              <option value="Manhã">
                                Manhã — 08:30
                              </option>

                              <option value="Tarde">
                                Tarde — 13:30
                              </option>
                            </select>
                          </div>

                          <div>
                            <label className="text-sm font-semibold text-slate-700">
                              Valor do ciclo
                            </label>

                            <input
                              value={
                                pet
                                  .servicos
                                  .valorTotal
                              }
                              onChange={(
                                e
                              ) =>
                                atualizarServico(
                                  pet.id,
                                  "valorTotal",
                                  e
                                    .target
                                    .value
                                )
                              }
                              placeholder="Ex.: 160,00"
                              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                            />
                          </div>
                        </div>

                        {modoEdicao && (
                          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
                            <strong>
                              Atenção:
                            </strong>{" "}
                            ao escolher Iniciar novo ciclo e mudar de Avulso para Quinzenal ou Mensal,
                            confirme a data futura do primeiro atendimento.
                            Ao salvar, um novo ciclo será criado na agenda,
                            sem alterar o banho avulso anterior.
                            Para renovar um plano existente, use{" "}
                            <strong>Renovar plano</strong>.
                          </div>
                        )}
                      </div>

                      <div className="mt-6">
                        <label className="text-sm font-semibold text-slate-700">
                          Observações do pet
                        </label>

                        <textarea
                          value={
                            pet.observacoes
                          }
                          onChange={(e) =>
                            atualizarPet(
                              pet.id,
                              "observacoes",
                              e.target.value
                            )
                          }
                          rows={3}
                          placeholder="Comportamento, cuidados, observações importantes..."
                          className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                        />
                      </div>
                    </section>
                  )
                )}

                <button
                  type="button"
                  onClick={
                    adicionarPet
                  }
                  className="w-full rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50 py-4 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100"
                >
                  + Adicionar outro pet
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                onClick={
                  fecharCadastro
                }
                disabled={salvando}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                onClick={
                  salvarCliente
                }
                disabled={salvando}
                className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {salvando
                  ? "Salvando..."
                  : modoEdicao
                  ? "Salvar alterações"
                  : "Cadastrar cliente"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL DETALHES                                             */}
      {/* ========================================================= */}

      {clienteSelecionado && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm">
          <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-sm font-semibold text-emerald-600">
                  CLIENTE
                </p>

                <h2 className="text-xl font-bold text-slate-900">
                  {
                    clienteSelecionado.nome
                  }
                </h2>

                <p className="text-sm text-slate-500">
                  {
                    clienteSelecionado
                      .contato ||
                    "Sem contato"
                  }
                </p>
              </div>

              <button
                onClick={() =>
                  setClienteSelecionado(
                    null
                  )
                }
                className="rounded-full p-2 text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <div className="overflow-y-auto p-6">
              <div className="mb-6 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-400">
                    CPF
                  </p>

                  <p className="mt-1 font-semibold text-slate-800">
                    {formatarCpf(
                      clienteSelecionado.cpf
                    ) || "-"}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-400">
                    Endereço
                  </p>

                  <p className="mt-1 font-semibold text-slate-800">
                    {
                      clienteSelecionado
                        .endereco
                    }

                    {clienteSelecionado
                      .numero
                      ? `, ${clienteSelecionado.numero}`
                      : ""}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-400">
                    Bairro
                  </p>

                  <p className="mt-1 font-semibold text-slate-800">
                    {
                      clienteSelecionado
                        .bairro ||
                      "-"
                    }
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                {clienteSelecionado.pets.map(
                  (pet) => (
                    <div
                      key={
                        pet.id
                      }
                      className="rounded-2xl border border-slate-200 p-5"
                    >
                      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-2xl">
                            🐾
                          </div>

                          <div>
                            <h3 className="text-lg font-bold text-slate-900">
                              {
                                pet.nome
                              }
                            </h3>

                            <p className="text-sm text-slate-500">
                              {pet.raca ||
                                "Raça não informada"}
                            </p>
                          </div>
                        </div>

                        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">
                          {pet.servicos
                            .turno ===
                          "Tarde"
                            ? "🌤️ 13:30"
                            : "☀️ 08:30"}
                        </span>
                      </div>

                      <div className="mt-5 grid gap-3 md:grid-cols-3">
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-xs text-slate-400">
                            Serviço
                          </p>

                          <p className="mt-1 text-sm font-bold text-slate-800">
                            {
                              pet.servicos
                                .banhoTosa ||
                              "-"
                            }
                          </p>
                        </div>

                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-xs text-slate-400">
                            Plano
                          </p>

                          <p className="mt-1 text-sm font-bold text-slate-800">
                            {
                              pet.servicos
                                .frequencia
                            }
                          </p>
                        </div>

                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-xs text-slate-400">
                            Valor
                          </p>

                          <p className="mt-1 text-sm font-bold text-slate-800">
                            {formatarMoeda(
                              pet.servicos
                                .valorTotal
                            )}
                          </p>
                        </div>

                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-xs text-slate-400">
                            Peso
                          </p>

                          <p className="mt-1 text-sm font-bold text-slate-800">
                            {pet.peso
                              ? `${pet.peso} kg`
                              : "-"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
                        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xl">
                                🔄
                              </span>

                              <h4 className="font-bold text-slate-900">
                                Plano e Renovação
                              </h4>
                            </div>

                            <p className="mt-1 text-sm text-slate-500">
                              Acompanhe o ciclo atual
                              e faça a renovação quando
                              ele terminar.
                            </p>
                          </div>

                          {pet.plano &&
                            pet.plano
                              .renovacaoDisponivel && (
                              <button
                                onClick={() =>
                                  abrirRenovacao(
                                    clienteSelecionado,
                                    pet
                                  )
                                }
                                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
                              >
                                Renovar plano
                              </button>
                            )}
                        </div>

                        {pet.plano ? (
                          <>
                            <div className="mt-5 grid gap-3 md:grid-cols-3">
                              <div className="rounded-xl bg-white p-4">
                                <p className="text-xs text-slate-400">
                                  Plano atual
                                </p>

                                <p className="mt-1 font-bold text-slate-900">
                                  {
                                    pet.servicos
                                      .frequencia
                                  }
                                </p>

                                <p className="mt-1 text-xs text-slate-500">
                                  {descricaoFrequencia(
                                    pet.servicos
                                      .frequencia
                                  )}
                                </p>
                              </div>

                              <div className="rounded-xl bg-white p-4">
                                <p className="text-xs text-slate-400">
                                  Ciclo atual
                                </p>

                                <p className="mt-1 font-bold text-slate-900">
                                  Ciclo{" "}
                                  {
                                    pet.plano
                                      .ciclo
                                  }
                                </p>

                                <p className="mt-1 text-xs text-slate-500">
                                  {formatarData(
                                    pet.plano
                                      .dataInicio
                                  )}{" "}
                                  até{" "}
                                  {formatarData(
                                    pet.plano
                                      .dataFim
                                  )}
                                </p>
                              </div>

                              <div className="rounded-xl bg-white p-4">
                                <p className="text-xs text-slate-400">
                                  Banhos
                                </p>

                                <p className="mt-1 font-bold text-slate-900">
                                  {
                                    pet.plano
                                      .banhosConcluidos
                                  }{" "}
                                  /{" "}
                                  {
                                    pet.plano
                                      .totalBanhos
                                  }
                                </p>

                                <p className="mt-1 text-xs text-slate-500">
                                  {
                                    pet.plano
                                      .banhosRestantes
                                  }{" "}
                                  restante(s)
                                </p>
                              </div>


                            </div>

                            {pet.plano
                              .renovacaoDisponivel &&
                              pet.servicos
                                .frequencia !==
                                "Avulso" && (
                              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 md:flex-row md:items-center md:justify-between">
                                <div>
                                  <p className="text-sm font-bold text-emerald-800">
                                    Este ciclo está pronto para renovação.
                                  </p>

                                  <p className="mt-1 text-xs text-emerald-700">
                                    O próximo ciclo será criado separado deste.
                                  </p>
                                </div>

                                <button
                                  onClick={() =>
                                    abrirRenovacao(
                                      clienteSelecionado,
                                      pet
                                    )
                                  }
                                  className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
                                >
                                  Renovar
                                </button>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="mt-5 rounded-xl bg-white p-4">
                            <p className="text-sm font-semibold text-slate-700">
                              Nenhum ciclo encontrado
                              para este pet.
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="mt-5 grid gap-3 md:grid-cols-3">
                        <div className="rounded-xl bg-slate-50 p-4">
                          <p className="text-xs text-slate-400">
                            Sexo
                          </p>

                          <p className="mt-1 text-sm font-semibold text-slate-800">
                            {pet.sexo ||
                              "-"}
                          </p>
                        </div>

                        <div className="rounded-xl bg-slate-50 p-4">
                          <p className="text-xs text-slate-400">
                            Nascimento
                          </p>

                          <p className="mt-1 text-sm font-semibold text-slate-800">
                            {pet.dataNascimento
                              ? formatarData(
                                  pet.dataNascimento
                                )
                              : "-"}
                          </p>
                        </div>

                        <div className="rounded-xl bg-slate-50 p-4">
                          <p className="text-xs text-slate-400">
                            Primeiro atendimento
                          </p>

                          <p className="mt-1 text-sm font-semibold text-slate-800">
                            {pet.servicos
                              .dataInicio
                              ? formatarData(
                                  pet.servicos
                                    .dataInicio
                                )
                              : "-"}
                          </p>
                        </div>
                      </div>

                      {pet.servicos
                        .tosas.length >
                        0 && (
                        <div className="mt-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Tosas
                          </p>

                          <div className="mt-2 flex flex-wrap gap-2">
                            {pet.servicos.tosas.map(
                              (item) => (
                                <span
                                  key={
                                    item
                                  }
                                  className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
                                >
                                  {
                                    item
                                  }
                                </span>
                              )
                            )}
                          </div>
                        </div>
                      )}

                      {pet.servicos
                        .adicionais
                        .length >
                        0 && (
                        <div className="mt-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Adicionais
                          </p>

                          <div className="mt-2 flex flex-wrap gap-2">
                            {pet.servicos.adicionais.map(
                              (item) => (
                                <span
                                  key={
                                    item
                                  }
                                  className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"
                                >
                                  {
                                    item
                                  }
                                </span>
                              )
                            )}
                          </div>
                        </div>
                      )}

                      {pet.observacoes && (
                        <div className="mt-4 rounded-xl bg-amber-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                            Observações
                          </p>

                          <p className="mt-1 text-sm text-amber-900">
                            {
                              pet.observacoes
                            }
                          </p>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="flex flex-wrap justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                onClick={
                  excluirCliente
                }
                disabled={
                  excluindo
                }
                className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {excluindo
                  ? "Excluindo..."
                  : "Excluir cadastro"}
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const cliente =
                      clienteSelecionado;

                    setClienteSelecionado(
                      null
                    );

                    abrirEdicao(
                      cliente
                    );
                  }}
                  className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
                >
                  Editar cadastro
                </button>

                <button
                  onClick={() =>
                    setClienteSelecionado(
                      null
                    )
                  }
                  className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL RENOVAÇÃO                                            */}
      {/* ========================================================= */}

      {modalPlanoPet && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-5">
              <p className="text-sm font-semibold text-emerald-600">
                SPA PET AGROMINAS
              </p>

              <h2 className="mt-1 text-xl font-bold text-slate-900">
                Renovar plano
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                O novo ciclo será criado separadamente do ciclo anterior.
              </p>
            </div>

            <div className="space-y-5 p-6">
              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Plano
                </label>

                <div className="mt-2 grid grid-cols-3 gap-2">
                  {([
                    "Avulso",
                    "Quinzenal",
                    "Mensal",
                  ] as Frequencia[]).map(
                    (
                      frequencia: Frequencia
                    ) => (
                      <button
                        key={
                          frequencia
                        }
                        type="button"
                        onClick={() =>
                          setFrequenciaRenovacao(
                            frequencia
                          )
                        }
                        className={`rounded-xl border p-3 text-sm font-bold ${
                          frequenciaRenovacao ===
                          frequencia
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 text-slate-600"
                        }`}
                      >
                        {
                          frequencia
                        }

                        <span className="mt-1 block text-[10px] font-normal">
                          {quantidadeBanhosPorCiclo(
                            frequencia
                          )}{" "}
                          banho(s)
                        </span>
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    Primeiro atendimento
                  </label>

                  <input
                    type="date"
                    value={
                      dataInicioRenovacao
                    }
                    onChange={(e) =>
                      setDataInicioRenovacao(
                        e.target
                          .value
                      )
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    Turno
                  </label>

                  <select
                    value={
                      turnoRenovacao
                    }
                    onChange={(e) =>
                      setTurnoRenovacao(
                        e.target
                          .value as Turno
                      )
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500"
                  >
                    <option value="Manhã">
                      Manhã — 08:30
                    </option>

                    <option value="Tarde">
                      Tarde — 13:30
                    </option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Valor do ciclo
                </label>

                <input
                  value={
                    valorRenovacao
                  }
                  onChange={(e) =>
                    setValorRenovacao(
                      e.target
                        .value
                    )
                  }
                  placeholder="Ex.: 160,00"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-bold text-emerald-800">
                  Este ciclo terá{" "}
                  {quantidadeBanhosPorCiclo(
                    frequenciaRenovacao
                  )}{" "}
                  banho(s).
                </p>

                <p className="mt-1 text-xs text-emerald-700">
                  O pagamento do novo ciclo deve ser registrado na página Pagamentos. Os ciclos anteriores permanecem inalterados.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                onClick={
                  fecharRenovacao
                }
                disabled={
                  !!renovandoPetId
                }
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                onClick={
                  renovarPlano
                }
                disabled={
                  !!renovandoPetId
                }
                className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {renovandoPetId
                  ? "Renovando..."
                  : "Criar novo ciclo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
