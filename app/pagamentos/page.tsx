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



type Situacao = "pendente" | "pago" | "conferir";

type Aba = "pendente" | "pago" | "conferir";

type Filtro = "todos" | "plano" | "avulso";



type Linha = {

  chave: string;

  tipo: "plano" | "avulso";

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



  const [carregando, setCarregando] = useState(true);

  const [erro, setErro] = useState("");

  const [aviso, setAviso] = useState("");



  const [aba, setAba] = useState<Aba>("pendente");

  const [busca, setBusca] = useState("");

  const [filtro, setFiltro] = useState<Filtro>("todos");

  const [limite, setLimite] = useState(20);



  const [selecionado, setSelecionado] = useState<Linha | null>(null);

  const [valor, setValor] = useState("");

  const [forma, setForma] = useState("");

  const [dataPagamento, setDataPagamento] = useState(hoje);

  const [salvando, setSalvando] = useState(false);

  const [erroModal, setErroModal] = useState("");



  const carregar = useCallback(async () => {

    setCarregando(true);

    setErro("");



    try {

      const [c, p, a, t, pg] = await Promise.all([

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

          "id,agendamento_id,pet_id,data,valor,forma_pagamento",

          "data"

        ),

        buscarTodos<PagamentoPlano>(

          "pagamentos_planos",

          "id,pet_id,ciclo,valor,forma_pagamento,data_pagamento",

          "data_pagamento"

        ),

      ]);



      setClientes(c);

      setPets(p);

      setAgendamentos(a);

      setAtendimentos(t);

      setPagamentos(pg);

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

      } else if (ativo) {

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

          ? at.data

          : "",

        forma: at.forma_pagamento || "",

        atendimentoId: at.id,

        observacao: at.forma_pagamento

          ? "Para avulsos, a data exibida é a do atendimento."

          : undefined,

      });

    }



    return resultado;

  }, [

    clientes,

    pets,

    agendamentos,

    atendimentos,

    pagamentos,

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

        `${linha.tutor} ${linha.pet} ${linha.titulo} ${linha.forma}`

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

    (total, l) => total + (l.valor || 0),

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



  function abrirPagamento(linha: Linha) {

    if (linha.situacao !== "pendente") return;



    setSelecionado(linha);

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

    const numero = parseDinheiro(valor);



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



    if (

      linha.tipo === "avulso" &&

      dataPagamento !== linha.data

    ) {

      setErroModal(

        "O sistema ainda não possui uma data de recebimento separada para avulsos. Só é possível registrar aqui quando o pagamento ocorreu no dia do atendimento."

      );

      return;

    }



    const confirmar = window.confirm(

      `Confirmar recebimento de ${moeda(numero)}?\n\n` +

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

      if (linha.tipo === "plano") {

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



        if (jaPago) {

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

      } else {

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

                          {linha.tipo === "plano"

                            ? "Plano"

                            : "Avulso"}

                        </span>

                      </div>



                      <p className="mt-1 text-sm text-gray-700">

                        🐾 {linha.pet}

                      </p>



                      <p className="mt-1 text-sm text-gray-500">

                        {linha.titulo}

                      </p>



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

                          {moeda(linha.valor)}

                        </p>



                        <p className="mt-1 text-xs text-gray-400">

                          {linha.tipo === "plano"

                            ? "Total do ciclo"

                            : "Atendimento"}

                        </p>

                      </div>



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

                        <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800">

                          ⚠ Conferir

                        </span>

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

              Para pagamentos avulsos, o cadastro atual

              utiliza a data do atendimento. O resumo mensal

              acima considera apenas os planos com data de

              recebimento registrada.

            </p>

          )}

        </section>

      </div>



      {/* JANELA DE PAGAMENTO */}

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

              <div>

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

              </div>



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

              <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">

                Para atendimentos avulsos, só é possível

                registrar nesta versão quando o pagamento

                ocorreu no mesmo dia do atendimento.

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
