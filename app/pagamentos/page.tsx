"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

import MenuLateral from "@/app/components/MenuLateral";

type Cliente = {

  id: string;

  nome: string;

};

type Pet = {

  id: string;

  nome: string;

  cliente_id: string;

};

type Agendamento = {

  id: string;

  pet_id: string;

  data: string;

  status: string | null;

  plano: string | null;

  ciclo: number | null;

  numero_banho: number | null;

  valor_total: number | null;

  pagamento_status: string | null;

  forma_pagamento_plano: string | null;

  servico_nome: string | null;

};

type Atendimento = {

  id: string;

  agendamento_id: string | null;

  pet_id: string | null;

  data: string;

  data_pagamento: string | null;

  valor: number | null;

  forma_pagamento: string | null;

};

type PagamentoPlano = {

  id: string;

  pet_id: string;

  ciclo: number;

  valor: number;

  forma_pagamento: string | null;

  data_pagamento: string | null;

};

type Extra = { id: string; agendamento_id: string; pet_id: string; nome_servico: string; valor: number; pagamento_status: string; forma_pagamento: string | null; data_pagamento: string | null; };
type ExtraExibicao = Extra & { banho: string; dataBanho: string; cicloExtra: number | null };

type Situacao = "pendente" | "pago" | "conferir";

type Aba = "pendente" | "pago" | "conferir";

type Filtro = "todos" | "plano" | "avulso";

type Linha = {

  chave: string;

  tipo: "plano" | "avulso" | "extras";
  extras?: ExtraExibicao[];

  situacao: Situacao;

  petId: string;

  pet: string;

  tutor: string;

  titulo: string;

  ciclo: number | null;

  valor: number | null;

  data: string;

  dataPagamento: string;

  forma: string;

  atendimentoId?: string;

  observacao?: string;

};

function hoje() {

  const d = new Date();

  return [

    d.getFullYear(),

    String(d.getMonth() + 1).padStart(2, "0"),

    String(d.getDate()).padStart(2, "0"),

  ].join("-");

}

function moeda(valor: number | null) {

  if (valor === null) return "Valor a conferir";

  return valor.toLocaleString("pt-BR", {

    style: "currency",

    currency: "BRL",

  });

}

function dataBR(data: string) {

  const [ano, mes, dia] = (data || "")

    .slice(0, 10)

    .split("-");

  if (!ano || !mes || !dia) return "Não informada";

  return `${dia}/${mes}/${ano}`;

}

function normal(valor: string | null | undefined) {

  return (valor || "")

    .normalize("NFD")

    .replace(/[\u0300-\u036f]/g, "")

    .toLowerCase()

    .trim();

}

function cancelado(status: string | null) {

  return ["cancelado", "cancelada"].includes(normal(status));

}

function planoValido(a: Agendamento) {

  return (

    !!a.plano &&

    normal(a.plano) !== "avulso" &&

    a.ciclo !== null

  );

}

function valorValido(valor: number | null | undefined) {

  if (

    valor === null ||

    valor === undefined ||

    !Number.isFinite(Number(valor)) ||

    Number(valor) < 0

  ) {

    return null;

  }

  return Number(valor);

}

function parseDinheiro(texto: string) {

  const limpo = texto.trim().replace(/\s/g, "");

  if (!limpo) return null;

  const convertido = limpo.includes(",")

    ? limpo.replace(/\./g, "").replace(",", ".")

    : limpo;

  const numero = Number(convertido);

  if (!Number.isFinite(numero) || numero < 0) {

    return null;

  }

  return numero;

}

function dataValida(data: string) {

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {

    return false;

  }

  const d = new Date(`${data}T12:00:00`);

  return (

    !Number.isNaN(d.getTime()) &&

    d.toISOString().slice(0, 10) === data

  );

}

async function buscarTodos<T>(

  tabela: string,

  campos: string,

  ordem: string

): Promise<T[]> {

  const resultado: T[] = [];

  for (let inicio = 0; ; inicio += 500) {

    const { data, error } = await supabase

      .from(tabela)

      .select(campos)

      .order(ordem, { ascending: false })

      .range(inicio, inicio + 499);

    if (error) {

      throw new Error(`${tabela}: ${error.message}`);

    }

    const lote = (data || []) as unknown as T[];

    resultado.push(...lote);

    if (lote.length < 500) break;

  }

  return resultado;

}

export default function PagamentosPage() {

  const router = useRouter();

  const [acesso, setAcesso] = useState<"verificando" | "admin" | "negado">("verificando");

  const [clientes, setClientes] = useState<Cliente[]>([]);

  const [pets, setPets] = useState<Pet[]>([]);

  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);

  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);

  const [pagamentos, setPagamentos] = useState<PagamentoPlano[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [extrasSelecionados, setExtrasSelecionados] = useState<string[]>([]);
  const [incluirPrincipal, setIncluirPrincipal] = useState(true);

  const [carregando, setCarregando] = useState(true);

  const [erro, setErro] = useState("");

  const [aviso, setAviso] = useState("");

  const [aba, setAba] = useState<Aba>("pendente");

  const [busca, setBusca] = useState("");

  const [filtro, setFiltro] = useState<Filtro>("todos");

  const [limite, setLimite] = useState(20);

  const [selecionado, setSelecionado] = useState<Linha | null>(null);

  const [conferindo, setConferindo] = useState<Linha | null>(null);

  const [erroConferencia, setErroConferencia] = useState("");

  const [salvandoConferencia, setSalvandoConferencia] = useState(false);

  const [valor, setValor] = useState("");

  const [forma, setForma] = useState("");

  const [dataPagamento, setDataPagamento] = useState(hoje);

  const [salvando, setSalvando] = useState(false);

  const [erroModal, setErroModal] = useState("");

  const [regularizando, setRegularizando] = useState(false);

  const [cancelando, setCancelando] = useState(false);

  const carregar = useCallback(async () => {

    setCarregando(true);

    setErro("");

    try {

      const [c, p, a, t, pg, ex] = await Promise.all([

        buscarTodos<Cliente>(

          "clientes",

          "id,nome",

          "nome"

        ),

        buscarTodos<Pet>(

          "pets",

          "id,nome,cliente_id",

          "nome"

        ),

        buscarTodos<Agendamento>(

          "agendamentos",

          "id,pet_id,data,status,plano,ciclo,numero_banho,valor_total,pagamento_status,forma_pagamento_plano,servico_nome",

          "data"

        ),

        buscarTodos<Atendimento>(

          "atendimentos",

          "id,agendamento_id,pet_id,data,data_pagamento,valor,forma_pagamento",

          "data"

        ),

        buscarTodos<PagamentoPlano>(

          "pagamentos_planos",

          "id,pet_id,ciclo,valor,forma_pagamento,data_pagamento",

                    "data_pagamento"
        ),
        buscarTodos<Extra>("servicos_extras_agendamento", "id,agendamento_id,pet_id,nome_servico,valor,pagamento_status,forma_pagamento,data_pagamento", "criado_em"),
      ]);

      setClientes(c);

      setPets(p);

      setAgendamentos(a);

      setAtendimentos(t);

      setPagamentos(pg);
      setExtras(ex);

    } catch (e: unknown) {

      setErro(

        e instanceof Error

          ? e.message

          : "Não foi possível carregar os pagamentos."

      );

    } finally {

      setCarregando(false);

    }

  }, []);

  // A tela só consulta os pagamentos após confirmar o perfil administrador.

  // A proteção real dos dados deve ser feita também nas políticas RLS do Supabase.

  useEffect(() => {

    let ativo = true;

    async function verificarAcesso() {

      try {

        const { data: usuario, error: erroUsuario } = await supabase.auth.getUser();

        if (erroUsuario || !usuario.user) {

          if (ativo) {

            setAcesso("negado");

            router.replace("/login");

          }

          return;

        }

        const { data: perfil, error: erroPerfil } = await supabase

          .from("perfis")

          .select("perfil")

          .eq("id", usuario.user.id)

          .maybeSingle();

        if (!ativo) return;

        if (erroPerfil || perfil?.perfil !== "admin") {

          setAcesso("negado");

          router.replace("/");

          return;

        }

        setAcesso("admin");

      } catch (erro) {

        console.error("Erro ao verificar permissão de Pagamentos:", erro);

        if (ativo) {

          setAcesso("negado");

          router.replace("/");

        }

      }

    }

    void verificarAcesso();

    return () => { ativo = false; };

  }, [router]);

  useEffect(() => {

    if (acesso === "admin") void carregar();

  }, [carregar, acesso]);

  const linhas = useMemo(() => {

    const petMap = new Map(

      pets.map((pet) => [pet.id, pet])

    );

    const clienteMap = new Map(

      clientes.map((cliente) => [cliente.id, cliente])

    );

    const agMap = new Map(

      agendamentos.map((a) => [a.id, a])

    );

    function identificar(petId: string) {

      const pet = petMap.get(petId);

      return {

        pet: pet?.nome || "Pet não identificado",

        tutor: pet

          ? clienteMap.get(pet.cliente_id)?.nome ||

            "Tutor não identificado"

          : "Tutor não identificado",

      };

    }

    const grupos = new Map<string, Agendamento[]>();

    for (const ag of agendamentos) {

      if (!planoValido(ag)) continue;

      const chave = `${ag.pet_id}::${ag.ciclo}`;

      const grupo = grupos.get(chave) || [];

      grupo.push(ag);

      grupos.set(chave, grupo);

    }

    const pagamentosMap = new Map<

      string,

      PagamentoPlano[]

    >();

    for (const pg of pagamentos) {

      const chave = `${pg.pet_id}::${pg.ciclo}`;

      const grupo = pagamentosMap.get(chave) || [];

      grupo.push(pg);

      pagamentosMap.set(chave, grupo);

    }

    const resultado: Linha[] = [];

    for (const [chave, grupo] of grupos) {

      const ordenados = [...grupo].sort((a, b) =>

        a.data.localeCompare(b.data)

      );

      const primeiro = ordenados[0];

      const registros = pagamentosMap.get(chave) || [];

      const pagoNaAgenda = grupo.some(

        (a) => normal(a.pagamento_status) === "pago"

      );

      const ativo = grupo.some(

        (a) => !cancelado(a.status)

      );

      const valores = [

        ...new Set(

          grupo

            .map((a) => valorValido(a.valor_total))

            .filter((v): v is number => v !== null)

        ),

      ];

      const info = identificar(primeiro.pet_id);

      if (registros.length > 0) {

        for (const pg of registros) {

          resultado.push({

            chave: `plano-pago-${pg.id}`,

            tipo: "plano",

            situacao: "pago",

            petId: pg.pet_id,

            ...info,

            titulo: `Plano ${primeiro.plano || ""} · Ciclo ${pg.ciclo}`,

            ciclo: pg.ciclo,

            valor: valorValido(pg.valor),

            data: primeiro.data,

            dataPagamento: (pg.data_pagamento || "").slice(0, 10),

            forma: pg.forma_pagamento || "Não informada",

            observacao:

              registros.length > 1

                ? "Existem múltiplos registros financeiros neste ciclo."

                : undefined,

          });

        }

       } else if (ativo && !grupo.some((a) => cancelado(a.pagamento_status))) {

        resultado.push({

          chave: `plano-${chave}`,

          tipo: "plano",

          situacao: pagoNaAgenda

            ? "conferir"

            : "pendente",

          petId: primeiro.pet_id,

          ...info,

          titulo: `Plano ${primeiro.plano || ""} · Ciclo ${primeiro.ciclo}`,

          ciclo: primeiro.ciclo,

          valor:

            valores.length === 1

              ? valores[0]

              : null,

          data: primeiro.data,

          dataPagamento: "",

          forma:

            grupo.find((a) => a.forma_pagamento_plano)

              ?.forma_pagamento_plano || "",

          observacao: pagoNaAgenda

            ? "Marcado como pago na Agenda, mas sem registro financeiro. Confira antes de cobrar."

            : valores.length > 1

            ? "Os banhos do ciclo possuem valores diferentes."

            : undefined,

        });

      }

    }

    // Preserva pagamentos de planos cujos

    // agendamentos não foram encontrados.

    for (const [chave, registros] of pagamentosMap) {

      if (grupos.has(chave)) continue;

      for (const pg of registros) {

        resultado.push({

          chave: `plano-pago-${pg.id}`,

          tipo: "plano",

          situacao: "pago",

          petId: pg.pet_id,

          ...identificar(pg.pet_id),

          titulo: `Plano · Ciclo ${pg.ciclo}`,

          ciclo: pg.ciclo,

          valor: valorValido(pg.valor),

          data: "",

          dataPagamento: (pg.data_pagamento || "").slice(0, 10),

          forma: pg.forma_pagamento || "Não informada",

          observacao: "Agendamento original não localizado.",

        });

      }

    }

    // Atendimentos avulsos.

    for (const at of atendimentos) {

      const ag = at.agendamento_id

        ? agMap.get(at.agendamento_id)

        : undefined;

      if (ag && planoValido(ag)) continue;

      const petId = at.pet_id || ag?.pet_id || "";

      resultado.push({

        chave: `avulso-${at.id}`,

        tipo: "avulso",

        situacao: at.forma_pagamento

          ? "pago"

          : "pendente",

        petId,

        ...identificar(petId),

        titulo: ag?.servico_nome || "Atendimento avulso",

        ciclo: null,

        valor:

          valorValido(at.valor) ??

          valorValido(ag?.valor_total),

        data: at.data,

        dataPagamento: at.forma_pagamento

          ? (at.data_pagamento || at.data).slice(0, 10)

          : "",

        forma: at.forma_pagamento || "",

        atendimentoId: at.id,

        observacao: at.forma_pagamento && !at.data_pagamento

          ? "Pagamento antigo sem data de recebimento registrada; exibimos a data do atendimento como referência."

          : undefined,

      });

    }

        // Serviços extras são vinculados ao banho, sem alterar o valor do plano.
    const extrasExibidos: ExtraExibicao[] = extras.filter(e => normal(e.pagamento_status) !== "cancelado").map(e => {
      const ag = agMap.get(e.agendamento_id);
      return { ...e, banho: ag?.numero_banho ? `${ag.numero_banho}º banho` : "Banho não identificado", dataBanho: ag?.data || "", cicloExtra: ag?.ciclo ?? null };
    });
    const pendentesExtras = extrasExibidos.filter(e => normal(e.pagamento_status) === "pendente");
    const pagosExtras = extrasExibidos.filter(e => normal(e.pagamento_status) === "pago");
    const associados = new Set<string>();
    // Exibe extras pendentes na mesma cobrança do plano/atendimento pendente.
    for (const linha of resultado) {
      if (linha.situacao !== "pendente") continue;
      const relacionados = pendentesExtras.filter(e => e.pet_id === linha.petId && (linha.tipo === "plano" ? e.cicloExtra === linha.ciclo : linha.atendimentoId ? atendimentos.some(at => at.id === linha.atendimentoId && at.agendamento_id === e.agendamento_id) : false));
      if (relacionados.length) { linha.extras = relacionados; relacionados.forEach(e => associados.add(e.id)); }
    }
    // Quando o plano já foi pago, ou não há cobrança principal, mantém os extras
    // no mesmo painel de Pagamentos como cobrança vinculada ao pet/ciclo.
    const gruposExtras = new Map<string, ExtraExibicao[]>();
    for (const e of pendentesExtras.filter(e => !associados.has(e.id))) {
      const chave = `${e.pet_id}::${e.cicloExtra ?? e.agendamento_id}`;
      gruposExtras.set(chave, [...(gruposExtras.get(chave) || []), e]);
    }
    for (const [chave, grupo] of gruposExtras) {
      const primeiro = grupo[0];
      const info = identificar(primeiro.pet_id);
      resultado.push({ chave: `extras-${chave}`, tipo: "extras", situacao: "pendente", petId: primeiro.pet_id, ...info, titulo: primeiro.cicloExtra === null ? "Adicionais do atendimento" : `Serviços extras · Ciclo ${primeiro.cicloExtra}`, ciclo: primeiro.cicloExtra, valor: 0, data: primeiro.dataBanho, dataPagamento: "", forma: "", extras: grupo });
    }
    // Pagamentos de extras mantêm histórico próprio e data real de recebimento.
    for (const e of pagosExtras) {
      resultado.push({ chave: `extra-pago-${e.id}`, tipo: "extras", situacao: "pago", petId: e.pet_id, ...identificar(e.pet_id), titulo: `+ ${e.nome_servico} · ${e.banho}${e.cicloExtra === null ? "" : ` · Ciclo ${e.cicloExtra}`}`, ciclo: e.cicloExtra, valor: Number(e.valor), data: e.dataBanho, dataPagamento: (e.data_pagamento || "").slice(0,10), forma: e.forma_pagamento || "Não informada" });
    }
    return resultado;
  }, [

    clientes,

    pets,

    agendamentos,

    atendimentos,

        pagamentos,
    extras,
  ]);

  const filtradas = useMemo(() => {

    const termo = normal(busca);

    return linhas.filter((linha) => {

      if (linha.tipo !== filtro && filtro !== "todos") {

        return false;

      }

      if (linha.situacao !== aba) {

        return false;

      }

      if (!termo) return true;

      return normal(

        `${linha.tutor} ${linha.pet} ${linha.titulo} ${linha.forma} ${(linha.extras || []).map(e => e.nome_servico).join(" ")}`

      ).includes(termo);

    });

  }, [linhas, busca, filtro, aba]);

  const ordenadas = useMemo(() => {

    return [...filtradas].sort((a, b) => {

      if (aba === "pago") {

        return b.dataPagamento.localeCompare(

          a.dataPagamento

        );

      }

      return a.data.localeCompare(b.data);

    });

  }, [filtradas, aba]);

  const quantidadePendentes = linhas.filter(

    (l) => l.situacao === "pendente"

  ).length;

  const quantidadePagos = linhas.filter(

    (l) => l.situacao === "pago"

  ).length;

  const quantidadeConferir = linhas.filter(

    (l) => l.situacao === "conferir"

  ).length;

  const pendentes = linhas.filter(

    (l) => l.situacao === "pendente"

  );

    const totalPendente = pendentes.reduce(
    (total, l) => total + (l.valor || 0) + (l.extras || []).reduce((t,e) => t + Number(e.valor || 0), 0),

    0

  );

  const semValor = pendentes.filter(

    (l) => l.valor === null

  ).length;

  const pagosMes = linhas.filter(

    (l) =>

      l.situacao === "pago" &&

      l.tipo === "plano" &&

      l.dataPagamento.startsWith(hoje().slice(0, 7))

  );

  const totalMes = pagosMes.reduce(

    (total, l) => total + (l.valor || 0),

    0

  );

  function abrirConferencia(linha: Linha) {

    if (linha.situacao !== "conferir" || linha.tipo !== "plano") return;

    setErroConferencia("");

    setConferindo(linha);

  }

  async function resolverConferencia(jaRecebeu: boolean) {

    if (!conferindo || salvandoConferencia || conferindo.ciclo === null) return;

    const linha = conferindo;

    if (!window.confirm(jaRecebeu

      ? `Confirmar que o plano de ${linha.pet} (ciclo ${linha.ciclo}) JÁ FOI RECEBIDO? Será criado um registro financeiro.`

      : `Confirmar que o plano de ${linha.pet} (ciclo ${linha.ciclo}) AINDA NÃO FOI RECEBIDO? Ele voltará para Pendentes.`)) return;

    setSalvandoConferencia(true);

    setErroConferencia("");

    try {

      const existente = await supabase.from("pagamentos_planos")

        .select("id").eq("pet_id", linha.petId).eq("ciclo", linha.ciclo).limit(1);

      if (existente.error) throw existente.error;

      if (existente.data?.length) throw new Error("Já existe pagamento financeiro para este ciclo. Atualize a página antes de continuar.");

      if (jaRecebeu) {

        // Exige dados reais: não inventa valor, data nem forma de pagamento.

        setConferindo(null);

                  setSelecionado({ ...linha, situacao: "pendente" });
          setIncluirPrincipal(true);
          setExtrasSelecionados([]);

        setRegularizando(true);

        setValor(linha.valor === null ? "" : linha.valor.toFixed(2).replace(".", ","));

        setForma("");

        setDataPagamento(hoje());

        setErroModal("");

        setAviso("Informe a data, a forma e o valor efetivamente recebidos para regularizar este ciclo.");

      } else {

        const resultado = await supabase.from("agendamentos")

          .update({ pagamento_status: "Pendente", forma_pagamento_plano: null })

          .eq("pet_id", linha.petId).eq("ciclo", linha.ciclo).select("id");

        if (resultado.error) throw resultado.error;

        if (!resultado.data?.length) throw new Error("Nenhum agendamento foi atualizado. Verifique as permissões do Supabase.");

        setConferindo(null);

        await carregar();

        setAba("pendente");

        setAviso("Ciclo corrigido para pendente. Nenhum pagamento foi criado.");

      }

    } catch (e: unknown) {

      setErroConferencia(e instanceof Error ? e.message : "Não foi possível conferir o ciclo.");

    } finally {

      setSalvandoConferencia(false);

    }

  }

  async function cancelarCobranca(linha: Linha) {

    if (cancelando || linha.tipo !== "plano" ||

        linha.situacao !== "pendente" || linha.ciclo === null) return;



    const confirmou = window.confirm(

      "Cancelar SOMENTE a cobrança financeira?\n\n" +

      "Tutor: " + linha.tutor + "\n" +

      "Pet: " + linha.pet + "\n" +

      "Ciclo: " + linha.ciclo + "\n" +

      "Valor: " + moeda(linha.valor) + "\n\n" +

      "O banho concluído e os atendimentos serão preservados. " +

      "Nenhum recebimento será registrado."

    );

    if (!confirmou) return;



    setCancelando(true);

    setErro("");

    setAviso("");



    try {

      const { data: usuario, error: erroUsuario } = await supabase.auth.getUser();

      if (erroUsuario || !usuario.user) {

        throw new Error("Sessão expirada. Entre novamente como administradora.");

      }



      const { data: perfil, error: erroPerfil } = await supabase

        .from("perfis")

        .select("perfil")

        .eq("id", usuario.user.id)

        .maybeSingle();

      if (erroPerfil || perfil?.perfil !== "admin") {

        throw new Error("Somente a administradora pode cancelar cobranças.");

      }



      const { data: ags, error: erroAg } = await supabase

        .from("agendamentos")

        .select("id,status,pagamento_status")

        .eq("pet_id", linha.petId)

        .eq("ciclo", linha.ciclo);

      if (erroAg) throw erroAg;

      if (!ags?.length) throw new Error("Ciclo não encontrado.");



      const { data: pagamentos, error: erroPg } = await supabase

        .from("pagamentos_planos")

        .select("id")

        .eq("pet_id", linha.petId)

        .eq("ciclo", linha.ciclo)

        .limit(1);

      if (erroPg) throw erroPg;

      if (pagamentos?.length) {

        throw new Error("Este ciclo já possui pagamento registrado. Não pode ser cancelado por esta ação.");

      }

      if (ags.some(a => normal(a.pagamento_status) === "pago")) {

        throw new Error("Este ciclo está marcado como pago. Confira antes de cancelar.");

      }

      if (ags.every(a => cancelado(a.pagamento_status))) {

        await carregar();

        setAviso("Esta cobrança já estava cancelada.");

        return;

      }



      // Cancela apenas a obrigação financeira, nunca o banho nem o atendimento.

      const ids = ags.map(a => a.id);

      const { data: atualizados, error: erroUpdate } = await supabase

        .from("agendamentos")

        .update({ pagamento_status: "Cancelado" })

        .in("id", ids)

        .eq("pet_id", linha.petId)

        .eq("ciclo", linha.ciclo)

        .select("id");

      if (erroUpdate) throw erroUpdate;

      if (atualizados?.length !== ids.length) {

        throw new Error("O banco não confirmou o cancelamento de todo o ciclo. Confira antes de tentar novamente.");

      }



      await carregar();

      setAviso("Cobrança financeira cancelada. Banhos e atendimentos preservados.");

    } catch (e: unknown) {

      const mensagem = e instanceof Error ? e.message : "Erro ao cancelar cobrança.";

      setErro(mensagem);

      window.alert("Não foi possível cancelar a cobrança: " + mensagem);

    } finally {

      setCancelando(false);

    }

  }



  function abrirPagamento(linha: Linha) {

    if (linha.situacao !== "pendente") return;

        setRegularizando(false);
    setSelecionado(linha);
    setExtrasSelecionados((linha.extras || []).map(e => e.id));
    setIncluirPrincipal(linha.tipo !== "extras");

    setValor(

      linha.valor === null

        ? ""

        : linha.valor.toFixed(2).replace(".", ",")

    );

    setForma("");

    setDataPagamento(hoje());

    setErroModal("");

    setAviso("");

  }

    async function registrarPagamento() {
    if (!selecionado || salvando) return;
    const linha = selecionado;
    const cobrarPrincipal = linha.tipo !== "extras" && incluirPrincipal;
    const selecionados = (linha.extras || []).filter(e => extrasSelecionados.includes(e.id));
    if (!cobrarPrincipal && !selecionados.length) { setErroModal("Selecione pelo menos um item."); return; }
    const numero = cobrarPrincipal ? parseDinheiro(valor) : 0;

    if (

      numero === null ||

      !forma ||

      !dataValida(dataPagamento) ||

      dataPagamento > hoje()

    ) {

      setErroModal(

        "Informe um valor válido, a forma de pagamento e uma data válida."

      );

      return;

    }

        const totalReceber = (numero || 0) + selecionados.reduce((t,e) => t + Number(e.valor), 0);
    const confirmar = window.confirm(
      `Confirmar recebimento de ${moeda(totalReceber)}?\n\n` +

        `Tutor: ${linha.tutor}\n` +

        `Pet: ${linha.pet}\n` +

        `Forma: ${forma}\n` +

        `Data: ${dataBR(dataPagamento)}`

    );

    if (!confirmar) return;

    setSalvando(true);

    setErroModal("");

    let pagamentoGravado = false;

    try {

            if (cobrarPrincipal && linha.tipo === "plano") {

        if (linha.ciclo === null) {

          throw new Error("Ciclo não identificado.");

        }

        const consulta = await supabase

          .from("pagamentos_planos")

          .select("id")

          .eq("pet_id", linha.petId)

          .eq("ciclo", linha.ciclo)

          .limit(1);

        if (consulta.error) throw consulta.error;

        if (consulta.data?.length) {

          throw new Error(

            "Este ciclo já possui um pagamento registrado. Atualize a página."

          );

        }

        const marcacoes = await supabase

          .from("agendamentos")

          .select("pagamento_status")

          .eq("pet_id", linha.petId)

          .eq("ciclo", linha.ciclo);

        if (marcacoes.error) throw marcacoes.error;

        const jaPago = marcacoes.data?.some(

          (a) => normal(a.pagamento_status) === "pago"

        );

        if (jaPago && !regularizando) {

          throw new Error(

            "Este ciclo está marcado como pago na Agenda. Confira antes de registrar novamente."

          );

        }

        const resultado = await supabase

          .from("pagamentos_planos")

          .insert({

            pet_id: linha.petId,

            ciclo: linha.ciclo,

            valor: numero,

            forma_pagamento: forma,

            data_pagamento: dataPagamento,

          })

          .select("id");

        if (resultado.error) throw resultado.error;

        if (!resultado.data?.length) {

          throw new Error(

            "O Supabase não confirmou o pagamento."

          );

        }

        pagamentoGravado = true;

        const atualizar = await supabase

          .from("agendamentos")

          .update({

            pagamento_status: "Pago",

            forma_pagamento_plano: forma,

          })

          .eq("pet_id", linha.petId)

          .eq("ciclo", linha.ciclo);

        if (atualizar.error) {

          throw new Error(

            "O pagamento foi salvo, mas a Agenda não foi atualizada. Não registre novamente. Atualize a página e confira."

          );

        }

            } else if (cobrarPrincipal && linha.tipo === "avulso") {
        if (!linha.atendimentoId) {

          throw new Error("Atendimento não identificado.");

        }

        const consulta = await supabase

          .from("atendimentos")

          .select("id,forma_pagamento")

          .eq("id", linha.atendimentoId)

          .single();

        if (consulta.error) throw consulta.error;

        if (consulta.data.forma_pagamento) {

          throw new Error(

            "Este atendimento já consta como pago."

          );

        }

        const resultado = await supabase

          .from("atendimentos")

          .update({

            valor: numero,

            forma_pagamento: forma,

            data_pagamento: dataPagamento,

          })

          .eq("id", linha.atendimentoId)

          .is("forma_pagamento", null)

          .select("id");

        if (resultado.error) throw resultado.error;

        if (!resultado.data?.length) {

          throw new Error(

            "Não foi possível confirmar a gravação."

          );

        }

                pagamentoGravado = true;
      }
      if (selecionados.length) {
        // Função SQL instalada: todos os extras selecionados são pagos ou nenhum.
        // A cobrança principal usa o fluxo financeiro já existente, independente.
        const { data: qtd, error: erroExtras } = await supabase.rpc("receber_extras_agrominas", {
          p_ids: selecionados.map(e => e.id), p_forma: forma, p_data: dataPagamento,
        });
        if (erroExtras) throw new Error(erroExtras.message + (pagamentoGravado ? " O pagamento principal já foi salvo. Atualize antes de tentar novamente." : ""));
        if (Number(qtd) !== selecionados.length) throw new Error("Quantidade de adicionais recebidos não confirmada. Atualize antes de tentar novamente.");
        pagamentoGravado = true;
      }
      setSelecionado(null);

      setAviso("Pagamento registrado com sucesso!");

      await carregar();

      setAba("pago");

    } catch (e: unknown) {

      const mensagem =

        e instanceof Error

          ? e.message

          : "Não foi possível registrar o pagamento.";

      if (pagamentoGravado) {

        setSelecionado(null);

        setAviso(`Atenção: ${mensagem}`);

        await carregar();

      } else {

        setErroModal(mensagem);

      }

    } finally {

      setSalvando(false);

    }

  }

  function mudarAba(novaAba: Aba) {

    setAba(novaAba);

    setLimite(20);

  }

  const abas: {

    id: Aba;

    nome: string;

    quantidade: number;

  }[] = [

    {

      id: "pendente",

      nome: "Pendentes",

      quantidade: quantidadePendentes,

    },

    {

      id: "pago",

      nome: "Recebidos",

      quantidade: quantidadePagos,

    },

    {

      id: "conferir",

      nome: "Conferir",

      quantidade: quantidadeConferir,

    },

  ];

  if (acesso !== "admin") {

    return (

      <main className="flex min-h-screen items-center justify-center bg-[#f7faf8] p-6">

        <p className="text-sm font-medium text-emerald-900">

          {acesso === "verificando" ? "Verificando permissão de acesso..." : "Acesso restrito à administradora. Redirecionando..."}

        </p>

      </main>

    );

  }

  return (

    <main className="min-h-screen bg-gray-50">

      <div className="flex min-h-screen">

        <MenuLateral />

        <section className="min-w-0 flex-1 p-4 md:p-8">

          {/* CABEÇALHO */}

          <header className="mb-6 flex flex-wrap items-center justify-between gap-4">

            <div>

              <h1 className="text-3xl font-bold text-gray-900">

                Pagamentos

              </h1>

              <p className="mt-1 text-sm text-gray-500">

                Recebimentos de banho e tosa

              </p>

            </div>

            <button

              type="button"

              onClick={() => void carregar()}

              disabled={carregando || salvando}

              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"

            >

              ↻ Atualizar

            </button>

          </header>

          {erro && (

            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">

              Erro ao carregar: {erro}

            </div>

          )}

          {aviso && (

            <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">

              {aviso}

            </div>

          )}

          {/* RESUMO */}

          <div className="mb-6 grid gap-4 sm:grid-cols-2">

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">

              <p className="text-sm font-medium text-gray-500">

                A receber

              </p>

              <p className="mt-2 text-3xl font-bold text-gray-900">

                {carregando ? "..." : moeda(totalPendente)}

              </p>

              <p className="mt-2 text-sm text-gray-500">

                {quantidadePendentes} pendência(s)

                {semValor > 0

                  ? ` · ${semValor} sem valor definido`

                  : ""}

              </p>

            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">

              <p className="text-sm font-medium text-gray-500">

                Planos recebidos neste mês

              </p>

              <p className="mt-2 text-3xl font-bold text-green-700">

                {carregando ? "..." : moeda(totalMes)}

              </p>

              <p className="mt-2 text-sm text-gray-500">

                Conforme a data registrada do pagamento

              </p>

            </div>

          </div>

          {/* PESQUISA */}

          <div className="mb-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">

            <div className="grid gap-3 md:grid-cols-[1fr_180px]">

              <input

                type="text"

                value={busca}

                onChange={(e) => {

                  setBusca(e.target.value);

                  setLimite(20);

                }}

                placeholder="🔍 Buscar tutor ou pet..."

                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-green-600"

              />

              <select

                value={filtro}

                onChange={(e) => {

                  setFiltro(e.target.value as Filtro);

                  setLimite(20);

                }}

                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-green-600"

              >

                <option value="todos">Todos os tipos</option>

                <option value="plano">Planos</option>

                <option value="avulso">Avulsos</option>

              </select>

            </div>

          </div>

          {/* ABAS */}

          <div className="mb-5 flex flex-wrap gap-2">

            {abas.map((item) => {

              const ativo = aba === item.id;

              return (

                <button

                  key={item.id}

                  type="button"

                  onClick={() => mudarAba(item.id)}

                  className={

                    ativo

                      ? "rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white shadow-sm"

                      : "rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-600 hover:bg-gray-100"

                  }

                >

                  {item.nome} ({item.quantidade})

                </button>

              );

            })}

          </div>

          {/* LISTA */}

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">

            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-5">

              <div>

                <h2 className="text-lg font-bold text-gray-900">

                  {aba === "pendente"

                    ? "Pagamentos pendentes"

                    : aba === "pago"

                    ? "Pagamentos recebidos"

                    : "Pagamentos para conferir"}

                </h2>

                <p className="mt-1 text-sm text-gray-500">

                  {aba === "pendente"

                    ? "Clientes com recebimentos ainda não registrados."

                    : aba === "pago"

                    ? "Histórico de recebimentos registrados."

                    : "Registros antigos que precisam de verificação antes de qualquer cobrança."}

                </p>

              </div>

              <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-700">

                {ordenadas.length}

              </span>

            </div>

            {carregando ? (

              <div className="p-12 text-center text-gray-500">

                Carregando pagamentos...

              </div>

            ) : ordenadas.length === 0 ? (

              <div className="p-12 text-center">

                <p className="text-base font-semibold text-gray-700">

                  Nenhum registro encontrado

                </p>

                <p className="mt-2 text-sm text-gray-500">

                  Experimente alterar a pesquisa ou o filtro.

                </p>

              </div>

            ) : (

              <>

                {ordenadas.slice(0, limite).map((linha) => (

                  <div

                    key={linha.chave}

                    className="flex flex-col gap-4 border-b border-gray-100 p-5 last:border-b-0 hover:bg-gray-50 lg:flex-row lg:items-center lg:justify-between"

                  >

                    <div className="min-w-0 flex-1">

                      <div className="flex flex-wrap items-center gap-2">

                        <h3 className="font-bold text-gray-900">

                          {linha.tutor}

                        </h3>

                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">

                                                    {linha.tipo === "plano" ? "Plano" : linha.tipo === "avulso" ? "Avulso" : "Adicionais"}

                        </span>

                      </div>

                      <p className="mt-1 text-sm text-gray-700">

                        🐾 {linha.pet}

                      </p>

                                            <p className="mt-1 text-sm text-gray-500">{linha.titulo}</p>
                      {!!linha.extras?.length && (
                        <div className="mt-2 space-y-1 text-sm text-gray-600">
                          {linha.tipo !== "extras" && <p>Valor do {linha.tipo === "plano" ? "plano" : "atendimento"}: {moeda(linha.valor)}</p>}
                          {linha.extras.map(e => <p key={e.id}>+ {e.nome_servico}: <strong>{moeda(Number(e.valor))}</strong> <span className="text-xs text-gray-500">· {e.banho}{e.cicloExtra === null ? "" : ` do ciclo ${e.cicloExtra}`} · {e.dataBanho ? `Data: ${dataBR(e.dataBanho)}` : "Data não identificada"}</span></p>)}
                          <p className="font-semibold text-gray-800">Total pendente: {moeda((linha.tipo === "extras" ? 0 : (linha.valor || 0)) + linha.extras.reduce((t,e) => t + Number(e.valor), 0))}</p>
                        </div>
                      )} 

                      <p className="mt-2 text-xs text-gray-400">

                        {linha.situacao === "pago"

                          ? `Recebido em ${dataBR(linha.dataPagamento)} · ${linha.forma}`

                          : `Referência: ${dataBR(linha.data)}`}

                      </p>

                      {linha.observacao && (

                        <p className="mt-2 max-w-xl text-xs text-amber-700">

                          {linha.observacao}

                        </p>

                      )}

                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4 lg:justify-end">

                      <div className="lg:text-right">

                        <p className="text-xl font-bold text-gray-900">

                                                      {linha.valor === null && !linha.extras?.length ? moeda(null) : moeda((linha.valor || 0) + (linha.extras || []).reduce((t,e) => t + Number(e.valor), 0))}
                          </p>
                          <p className="mt-1 text-xs text-gray-400">

                                                      {linha.extras?.length ? "Total com adicionais" : linha.tipo === "plano" ? "Total do ciclo" : linha.tipo === "avulso" ? "Atendimento" : "Serviço extra"}

                        </p>

                      </div>

                      {linha.situacao === "pendente" && linha.tipo === "plano" && (

    <button

      type="button"

      disabled={cancelando}

      onClick={() => void cancelarCobranca(linha)}

      className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"

    >

      {cancelando ? "Aguarde..." : "Cancelar cobrança"}

    </button>

  )}

  {linha.situacao === "pendente" && (

                        <button

                          type="button"

                          onClick={() => abrirPagamento(linha)}

                          className="rounded-xl bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-800"

                        >

                          Registrar pagamento

                        </button>

                      )}

                      {linha.situacao === "pago" && (

                        <span className="rounded-full bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-800">

                          ✓ Recebido

                        </span>

                      )}

                      {linha.situacao === "conferir" && (

                        <button type="button" onClick={() => abrirConferencia(linha)} className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-200">⚠ Conferir</button>

                      )}

                    </div>

                  </div>

                ))}

                {ordenadas.length > limite && (

                  <div className="p-5 text-center">

                    <button

                      type="button"

                      onClick={() => setLimite((n) => n + 20)}

                      className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"

                    >

                      Mostrar mais pagamentos

                    </button>

                  </div>

                )}

              </>

            )}

          </div>

          {aba === "conferir" && (

            <p className="mt-4 text-sm text-amber-800">

              Atenção: esses registros estão marcados como

              pagos na Agenda, mas não possuem lançamento

              financeiro correspondente. Confira o

              recebimento antes de regularizar nos Relatórios.

            </p>

          )}

          {aba === "pago" && (

            <p className="mt-4 text-xs text-gray-500">

              Os avulsos novos usam a data real do recebimento.

              Pagamentos antigos sem data separada mostram a data do atendimento como referência.

              O resumo mensal acima considera apenas os planos.

            </p>

          )}

        </section>

      </div>

      {/* JANELA DE PAGAMENTO */}

        {conferindo && (

          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">

            <div role="dialog" aria-modal="true" aria-labelledby="titulo-conferencia" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">

              <h2 id="titulo-conferencia" className="text-xl font-bold text-gray-900">Conferir pagamento</h2>

              <p className="mt-3 text-sm text-gray-700">Tutor: <strong>{conferindo.tutor}</strong></p>

              <p className="mt-1 text-sm text-gray-700">Pet: <strong>{conferindo.pet}</strong></p>

              <p className="mt-1 text-sm text-gray-700">{conferindo.titulo}</p>

              <p className="mt-1 text-sm text-gray-700">Valor previsto: <strong>{moeda(conferindo.valor)}</strong></p>

              <p className="mt-3 text-sm text-amber-800">Marcado como pago na Agenda, mas sem lançamento financeiro. Confirme a situação antes de alterar.</p>

              {erroConferencia && <p className="mt-3 text-sm text-red-700">{erroConferencia}</p>}

              <div className="mt-5 flex flex-wrap gap-2">

                <button type="button" disabled={salvandoConferencia} onClick={() => void resolverConferencia(true)} className="rounded-xl bg-green-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Já recebeu</button>

                <button type="button" disabled={salvandoConferencia} onClick={() => void resolverConferencia(false)} className="rounded-xl border border-amber-300 px-4 py-3 text-sm font-semibold text-amber-900 disabled:opacity-50">Ainda está devendo</button>

                <button type="button" disabled={salvandoConferencia} onClick={() => setConferindo(null)} className="rounded-xl border border-gray-200 px-4 py-3 text-sm">Cancelar</button>

              </div>

            </div>

          </div>

        )}

      {selecionado && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">

          <div

            role="dialog"

            aria-modal="true"

            aria-labelledby="titulo-pagamento"

            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"

          >

            <div className="flex items-start justify-between gap-3">

              <div>

                <h2

                  id="titulo-pagamento"

                  className="text-xl font-bold text-gray-900"

                >

                  Registrar pagamento

                </h2>

                <p className="mt-2 text-sm text-gray-600">

                  {selecionado.tutor}

                </p>

                <p className="text-sm text-gray-500">

                  🐾 {selecionado.pet}

                </p>

                <p className="mt-1 text-xs text-gray-400">

                  {selecionado.titulo}

                </p>

              </div>

              <button

                type="button"

                disabled={salvando}

                onClick={() => setSelecionado(null)}

                className="text-2xl text-gray-400 hover:text-gray-700"

                aria-label="Fechar"

              >

                ×

              </button>

            </div>

                          <div className="mt-6 space-y-4">
                {!!selecionado.extras?.length && (
                  <div className="space-y-3 rounded-xl border border-gray-200 p-4">
                    <p className="font-semibold text-gray-800">Selecione o que será recebido</p>
                    {selecionado.tipo !== "extras" && (
                      <label className="flex items-center justify-between gap-3 text-sm"><span><input type="checkbox" checked={incluirPrincipal} onChange={e => setIncluirPrincipal(e.target.checked)} className="mr-2" />{selecionado.tipo === "plano" ? "Plano" : "Atendimento"}</span><strong>{moeda(selecionado.valor)}</strong></label>
                    )}
                    {selecionado.extras.map(e => <label key={e.id} className="flex items-start justify-between gap-3 text-sm"><span><input type="checkbox" checked={extrasSelecionados.includes(e.id)} onChange={event => setExtrasSelecionados(atual => event.target.checked ? [...atual,e.id] : atual.filter(id => id !== e.id))} className="mr-2" />{e.nome_servico}<span className="block pl-5 text-xs text-gray-500">{e.banho}{e.cicloExtra === null ? "" : ` · Ciclo ${e.cicloExtra}`} · {dataBR(e.dataBanho)}</span></span><strong>{moeda(Number(e.valor))}</strong></label>)}
                    <p className="border-t border-gray-100 pt-2 font-bold text-green-800">Total selecionado: {moeda((incluirPrincipal && selecionado.tipo !== "extras" ? (parseDinheiro(valor) || 0) : 0) + selecionado.extras.filter(e => extrasSelecionados.includes(e.id)).reduce((t,e) => t + Number(e.valor),0))}</p>
                    {selecionado.tipo !== "extras" && <p className="text-xs text-amber-700">Plano/atendimento e adicionais usam registros financeiros independentes. Se uma etapa falhar, confira os pagamentos antes de repetir.</p>}
                  </div>
                )}
                {selecionado.tipo !== "extras" && incluirPrincipal && <div>
                  <label
                    htmlFor="valor-pagamento"

                  className="mb-2 block text-sm font-semibold text-gray-700"

                >

                  Valor recebido (R$)

                </label>

                <input

                  id="valor-pagamento"

                  type="text"

                  inputMode="decimal"

                  value={valor}

                  onChange={(e) => setValor(e.target.value)}

                  placeholder="0,00"

                  className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-600"

                />

                              </div>}
                <div>
                  <label
                    htmlFor="forma-pagamento"

                  className="mb-2 block text-sm font-semibold text-gray-700"

                >

                  Forma de pagamento

                </label>

                <select

                  id="forma-pagamento"

                  value={forma}

                  onChange={(e) => setForma(e.target.value)}

                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-green-600"

                >

                  <option value="">Selecione</option>

                  <option value="Pix">Pix</option>

                  <option value="Dinheiro">Dinheiro</option>

                  <option value="Débito">

                    Cartão de débito

                  </option>

                  <option value="Crédito">

                    Cartão de crédito

                  </option>

                  <option value="Outro">Outro</option>

                </select>

              </div>

              <div>

                <label

                  htmlFor="data-pagamento"

                  className="mb-2 block text-sm font-semibold text-gray-700"

                >

                  Data do recebimento

                </label>

                <input

                  id="data-pagamento"

                  type="date"

                  max={hoje()}

                  value={dataPagamento}

                  onChange={(e) =>

                    setDataPagamento(e.target.value)

                  }

                  className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-green-600"

                />

              </div>

            </div>

            {selecionado.tipo === "avulso" && (

              <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">

                A data original do atendimento será preservada. Informe a data em que o pagamento foi realmente recebido.

              </p>

            )}

            {erroModal && (

              <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">

                {erroModal}

              </p>

            )}

            <div className="mt-6 flex flex-wrap justify-end gap-3">

              <button

                type="button"

                disabled={salvando}

                onClick={() => setSelecionado(null)}

                className="rounded-xl border border-gray-200 px-5 py-3 font-semibold text-gray-700 hover:bg-gray-100"

              >

                Cancelar

              </button>

              <button

                type="button"

                disabled={salvando}

                onClick={() => void registrarPagamento()}

                className="rounded-xl bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800 disabled:opacity-50"

              >

                {salvando

                  ? "Salvando..."

                  : "Confirmar pagamento"}

              </button>

            </div>

          </div>

        </div>

      )}

    </main>

  );

}
