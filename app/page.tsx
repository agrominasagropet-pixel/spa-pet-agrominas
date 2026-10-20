
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import MenuLateral from "@/app/components/MenuLateral";

type Pet = {
  id: string;
  nome: string;
  cliente_id: string;
};

type Cliente = {
  id: string;
  nome: string;
  whatsapp: string | null;
  telefone: string | null;
};

type Agendamento = {
  id: string;
  pet_id: string;
  data: string;
  horario: string | null;
  status: string | null;
  servico_nome: string | null;
  valor_total: number | null;
};

type Atendimento = {
  id: string;
  agendamento_id: string | null;
  pet_id: string | null;
  data: string;
  valor: number | null;
  forma_pagamento: string | null;
};

type AtendimentoExibicao = {
  id: string;
  petNome: string;
  tutorNome: string;
  data: string;
  servico: string;
  valor: number;
  pagamento: string;
};

type Renovacao = {
  id: string;
  petId: string;
  petNome: string;
  tutorNome: string;
  data: string;
  horario: string;
  dias: number;
  whatsapp: string;
};

type PetPesquisado = {
  id: string;
  petNome: string;
  tutorNome: string;
  whatsapp: string;
  renovacao: Renovacao | undefined;
};

function formatarData(data: string) {
  if (!data) return "-";

  const partes = data.split("-");

  if (partes.length !== 3) return data;

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function formatarHorario(horario: string | null | undefined) {
  if (!horario) return "08:30";

  const partes = horario.split(":");
  const horas = (partes[0] || "08").padStart(2, "0");
  const minutos = (partes[1] || "00").padStart(2, "0");

  return `${horas}:${minutos}`;
}

function formatarValor(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function obterDataLocal() {
  const hoje = new Date();

  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function calcularDias(data: string) {
  const hoje = new Date(`${obterDataLocal()}T00:00:00`);
  const destino = new Date(`${data}T00:00:00`);

  return Math.round(
    (destino.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)
  );
}

function adicionarDias(data: string, quantidade: number) {
  const partes = data.split("-");

  const novaData = new Date(
    Number(partes[0]),
    Number(partes[1]) - 1,
    Number(partes[2])
  );

  novaData.setDate(novaData.getDate() + quantidade);

  const ano = novaData.getFullYear();
  const mes = String(novaData.getMonth() + 1).padStart(2, "0");
  const dia = String(novaData.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function obterSaudacao() {
  const hora = new Date().getHours();

  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";

  return "Boa noite";
}

function normalizarTelefone(numero: string) {
  const telefone = numero.replace(/\D/g, "");

  if (!telefone) return "";

  // Evita adicionar o código do Brasil duas vezes.
  if (telefone.startsWith("55")) {
    return telefone;
  }

  return `55${telefone}`;
}

function normalizarTexto(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function abrirWhatsApp(numero: string, petNome: string) {
  const telefoneOriginal = normalizarTelefone(numero);

  if (!telefoneOriginal) {
    alert("Este cliente não possui WhatsApp ou telefone cadastrado.");
    return;
  }

  const mensagem =
    `Olá! Tudo bem? 🐾💚\n\n` +
    `Aqui é da equipe do *SPA PET AGROMINAS*! 🐶\n\n` +
    `Estamos entrando em contato porque está chegando o momento de renovar o banho e tosa do *${petNome}*. 🛁✂️\n\n` +
    `Gostaríamos de saber se podemos agendar o próximo atendimento. 📅\n\n` +
    `Será um prazer receber vocês novamente!\n\n` +
    `Agradecemos pela confiança e preferência. 💚🐾\n\n` +
    `*SPA PET AGROMINAS — Cuidado e carinho em cada detalhe!*`;

  const url =
    `https://web.whatsapp.com/send/?phone=${telefoneOriginal}` +
    `&text=${encodeURIComponent(mensagem)}`;

  window.open(url, "_blank", "noopener,noreferrer");
}

export default function Home() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [pesquisaRenovacao, setPesquisaRenovacao] = useState("");

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    setCarregando(true);

    try {
      const [
        respostaPets,
        respostaClientes,
        respostaAgendamentos,
        respostaAtendimentos,
      ] = await Promise.all([
        supabase
          .from("pets")
          .select("id, nome, cliente_id")
          .order("nome", { ascending: true }),

        supabase
          .from("clientes")
          .select("id, nome, whatsapp, telefone")
          .order("nome", { ascending: true }),

        supabase
          .from("agendamentos")
          .select(
            "id, pet_id, data, horario, status, servico_nome, valor_total"
          )
          .order("data", { ascending: true })
          .order("horario", { ascending: true }),

        supabase
          .from("atendimentos")
          .select(
            "id, agendamento_id, pet_id, data, valor, forma_pagamento"
          )
          .order("data", { ascending: false }),
      ]);

      if (respostaPets.error) {
        console.error("Erro ao carregar pets:", respostaPets.error);
      }

      if (respostaClientes.error) {
        console.error("Erro ao carregar clientes:", respostaClientes.error);
      }

      if (respostaAgendamentos.error) {
        console.error(
          "Erro ao carregar agendamentos:",
          respostaAgendamentos.error
        );
      }

      if (respostaAtendimentos.error) {
        console.error(
          "Erro ao carregar atendimentos:",
          respostaAtendimentos.error
        );
      }

      if (respostaPets.data) {
        setPets(respostaPets.data as Pet[]);
      }

      if (respostaClientes.data) {
        setClientes(respostaClientes.data as Cliente[]);
      }

      if (respostaAgendamentos.data) {
        setAgendamentos(respostaAgendamentos.data as Agendamento[]);
      }

      if (respostaAtendimentos.data) {
        setAtendimentos(respostaAtendimentos.data as Atendimento[]);
      }
    } catch (erro) {
      console.error("Erro inesperado ao carregar o painel:", erro);
    } finally {
      setCarregando(false);
    }
  }

  const hoje = obterDataLocal();

  const agendamentosAtivos = agendamentos.filter(function (agendamento) {
    return normalizarTexto(agendamento.status || "") !== "cancelado";
  });

  const agendamentosHoje = agendamentosAtivos.filter(function (agendamento) {
    return agendamento.data === hoje;
  });

  const agendamentosManha = agendamentosHoje
    .filter(function (agendamento) {
      return formatarHorario(agendamento.horario) < "13:30";
    })
    .sort(function (a, b) {
      return formatarHorario(a.horario).localeCompare(
        formatarHorario(b.horario)
      );
    });

  const agendamentosTarde = agendamentosHoje
    .filter(function (agendamento) {
      return formatarHorario(agendamento.horario) >= "13:30";
    })
    .sort(function (a, b) {
      return formatarHorario(a.horario).localeCompare(
        formatarHorario(b.horario)
      );
    });

  const ultimosAtendimentos: AtendimentoExibicao[] = atendimentos
    .slice(0, 6)
    .map(function (atendimento) {
      const pet = pets.find(function (item) {
        return item.id === atendimento.pet_id;
      });

      const cliente = clientes.find(function (item) {
        return item.id === (pet ? pet.cliente_id : "");
      });

      const agendamento = agendamentos.find(function (item) {
        return item.id === atendimento.agendamento_id;
      });

      return {
        id: atendimento.id,
        petNome: pet ? pet.nome : "Pet",
        tutorNome: cliente ? cliente.nome : "Tutor",
        data: atendimento.data,
        servico: agendamento?.servico_nome || "Banho e tosa",
        valor: Number(atendimento.valor || 0),
        pagamento: atendimento.forma_pagamento || "Não informado",
      };
    });

  // Renovações previstas para hoje e os próximos sete dias.
  const renovacoes: Renovacao[] = [];

  pets.forEach(function (pet) {
    const futuros = agendamentosAtivos
      .filter(function (agendamento) {
        return agendamento.pet_id === pet.id && agendamento.data >= hoje;
      })
      .sort(function (a, b) {
        const dataA =
          a.data + " " + formatarHorario(a.horario);
        const dataB =
          b.data + " " + formatarHorario(b.horario);

        return dataA.localeCompare(dataB);
      });

    if (futuros.length === 0) return;

    const proximo = futuros[0];

    const cliente = clientes.find(function (item) {
      return item.id === pet.cliente_id;
    });

    if (!cliente) return;

    const telefone = cliente.whatsapp || cliente.telefone || "";
    const dataRenovacao = adicionarDias(proximo.data, 7);
    const dias = calcularDias(dataRenovacao);

    if (dias < 0 || dias > 7) return;

    renovacoes.push({
      id: proximo.id,
      petId: pet.id,
      petNome: pet.nome,
      tutorNome: cliente.nome,
      data: dataRenovacao,
      horario: formatarHorario(proximo.horario),
      dias,
      whatsapp: telefone,
    });
  });

  renovacoes.sort(function (a, b) {
    return a.dias - b.dias;
  });

  const termoPesquisa = normalizarTexto(pesquisaRenovacao);

  // Pesquisa todos os pets, sem limitar aos próximos sete dias.
  const petsPesquisados: PetPesquisado[] = pets
    .filter(function (pet) {
      const cliente = clientes.find(function (item) {
        return item.id === pet.cliente_id;
      });

      return (
        normalizarTexto(pet.nome).includes(termoPesquisa) ||
        normalizarTexto(cliente?.nome || "").includes(termoPesquisa)
      );
    })
    .map(function (pet) {
      const cliente = clientes.find(function (item) {
        return item.id === pet.cliente_id;
      });

      const proximosAgendamentos = agendamentosAtivos
        .filter(function (agendamento) {
          return agendamento.pet_id === pet.id && agendamento.data >= hoje;
        })
        .sort(function (a, b) {
          const dataA =
            a.data + " " + formatarHorario(a.horario);
          const dataB =
            b.data + " " + formatarHorario(b.horario);

          return dataA.localeCompare(dataB);
        });

      const proximo = proximosAgendamentos[0];

      const dataRenovacao = proximo
        ? adicionarDias(proximo.data, 7)
        : "";

      const diasRenovacao = dataRenovacao
        ? calcularDias(dataRenovacao)
        : 0;

      const renovacao: Renovacao | undefined = proximo
        ? {
            id: proximo.id,
            petId: pet.id,
            petNome: pet.nome,
            tutorNome: cliente?.nome || "Tutor não identificado",
            data: dataRenovacao,
            horario: formatarHorario(proximo.horario),
            dias: diasRenovacao,
            whatsapp: cliente?.whatsapp || cliente?.telefone || "",
          }
        : undefined;

      return {
        id: pet.id,
        petNome: pet.nome,
        tutorNome: cliente?.nome || "Tutor não identificado",
        whatsapp: cliente?.whatsapp || cliente?.telefone || "",
        renovacao,
      };
    });

  const renovacoesExibidas = renovacoes.slice(0, 5);

  function textoRenovacao(dias: number) {
    if (dias === 0) return "Renovar hoje";
    if (dias === 1) return "Amanhã";

    return `Em ${dias} dias`;
  }

  function obterNomePet(agendamento: Agendamento) {
    const pet = pets.find(function (item) {
      return item.id === agendamento.pet_id;
    });

    return pet ? pet.nome : "Pet";
  }

  function obterStatus(status: string | null) {
    const valor = normalizarTexto(status || "");

    if (valor === "concluido") return "Concluído";
    if (valor === "cancelado") return "Cancelado";

    return "Agendado";
  }

  function classeStatus(status: string | null) {
    const valor = normalizarTexto(status || "");

    if (valor === "concluido") {
      return "bg-gray-200 text-gray-700";
    }

    if (valor === "cancelado") {
      return "bg-gray-100 text-gray-400";
    }

    return "bg-gray-900 text-white";
  }

  function renderAgendamento(agendamento: Agendamento) {
    const nomePet = obterNomePet(agendamento);

    return (
      <div
        key={agendamento.id}
        className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 p-4"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-xl shadow-sm">
            🐾
          </div>

          <div>
            <p className="font-semibold text-gray-900">{nomePet}</p>

            <p className="text-sm text-gray-500">
              {formatarHorario(agendamento.horario)}
              {" • "}
              {agendamento.servico_nome || "Banho e tosa"}
            </p>
          </div>
        </div>

        <span
          className={
            "rounded-lg px-3 py-2 text-xs font-medium " +
            classeStatus(agendamento.status)
          }
        >
          {obterStatus(agendamento.status)}
        </span>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100">
      <div className="flex min-h-screen">
        <MenuLateral />

        <section className="flex-1 p-8">
          <div className="mb-8">
            <p className="text-sm font-medium text-gray-500">
              {new Date().toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "2-digit",
                month: "long",
              })}
            </p>

            <h2 className="mt-1 text-3xl font-bold text-gray-900">
              {obterSaudacao()}!
            </h2>

            <p className="mt-1 text-gray-500">
              Aqui está o resumo da operação de hoje no SPA PET AGROMINAS.
            </p>
          </div>

          {/* Cartões de resumo */}
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500">
                  Agendamentos hoje
                </p>
                <span className="text-xl">📅</span>
              </div>

              <p className="mt-3 text-3xl font-bold text-gray-900">
                {carregando ? "..." : agendamentosHoje.length}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Pets programados
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500">
                  Pets cadastrados
                </p>
                <span className="text-xl">🐾</span>
              </div>

              <p className="mt-3 text-3xl font-bold text-gray-900">
                {carregando ? "..." : pets.length}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Total no sistema
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500">
                  Renovações próximas
                </p>
                <span className="text-xl">🔄</span>
              </div>

              <p className="mt-3 text-3xl font-bold text-gray-900">
                {carregando ? "..." : renovacoes.length}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Próximos 7 dias
              </p>
            </div>
          </div>

          {/* Renovações e pesquisa */}
          <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  🔄 Renovações
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  Pesquise qualquer pet ou confira as renovações próximas.
                </p>
              </div>

              <span className="w-fit rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-600">
                {termoPesquisa
                  ? `${petsPesquisados.length} encontrados`
                  : `${renovacoes.length} próximas`}
              </span>
            </div>

            <div className="mt-5">
              <label
                htmlFor="pesquisa-renovacao"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Procurar pet ou tutor
              </label>

              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
                  🔎
                </span>

                <input
                  id="pesquisa-renovacao"
                  type="text"
                  value={pesquisaRenovacao}
                  onChange={function (e) {
                    setPesquisaRenovacao(e.target.value);
                  }}
                  placeholder="Digite o nome do pet ou do tutor..."
                  className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-10 pr-4 text-sm text-gray-900 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
                />
              </div>
            </div>

            {carregando ? (
              <div className="mt-6 rounded-xl bg-gray-50 p-6 text-center text-gray-500">
                Carregando pets e renovações...
              </div>
            ) : termoPesquisa ? (
              petsPesquisados.length === 0 ? (
                <div className="mt-6 rounded-xl border border-dashed border-gray-300 p-8 text-center">
                  <p className="text-gray-700">
                    Nenhum pet ou tutor encontrado.
                  </p>
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  {petsPesquisados.map(function (pet) {
                    return (
                      <div
                        key={pet.id}
                        className="flex flex-col gap-4 rounded-xl bg-gray-50 p-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-xl shadow-sm">
                            🐾
                          </div>

                          <div>
                            <p className="font-semibold text-gray-900">
                              {pet.petNome}
                            </p>

                            <p className="text-sm text-gray-500">
                              Tutor: {pet.tutorNome}
                            </p>

                            {pet.renovacao ? (
                              <p className="mt-1 text-sm font-medium text-gray-700">
                                Próxima renovação prevista:{" "}
                                {formatarData(pet.renovacao.data)}
                                {" às "}
                                {formatarHorario(pet.renovacao.horario)}
                              </p>
                            ) : (
                              <p className="mt-1 text-sm text-gray-500">
                                Nenhuma próxima renovação cadastrada.
                              </p>
                            )}
                          </div>
                        </div>

                        {pet.whatsapp ? (
                          <button
                            type="button"
                            onClick={function () {
                              abrirWhatsApp(pet.whatsapp, pet.petNome);
                            }}
                            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                          >
                            WhatsApp
                          </button>
                        ) : (
                          <span className="text-xs text-gray-500">
                            Sem contato
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            ) : renovacoesExibidas.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-gray-300 p-8 text-center">
                <p className="font-medium text-gray-700">
                  Nenhuma renovação próxima.
                </p>

                <p className="mt-2 text-sm text-gray-500">
                  Os pets aparecerão aqui quando faltarem até 7 dias para a renovação.
                </p>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {renovacoesExibidas.map(function (renovacao) {
                  return (
                    <div
                      key={renovacao.id}
                      className="flex flex-col gap-4 rounded-xl bg-gray-50 p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-xl shadow-sm">
                          🐾
                        </div>

                        <div>
                          <p className="font-semibold text-gray-900">
                            {renovacao.petNome}
                          </p>

                          <p className="text-sm text-gray-500">
                            Tutor: {renovacao.tutorNome}
                          </p>

                          <p className="mt-1 text-sm text-gray-600">
                            Renovação: {formatarData(renovacao.data)}
                            {" às "}
                            {formatarHorario(renovacao.horario)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700">
                          {textoRenovacao(renovacao.dias)}
                        </span>

                        {renovacao.whatsapp ? (
                          <button
                            type="button"
                            onClick={function () {
                              abrirWhatsApp(
                                renovacao.whatsapp,
                                renovacao.petNome
                              );
                            }}
                            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                          >
                            WhatsApp
                          </button>
                        ) : (
                          <span className="rounded-lg bg-gray-200 px-3 py-2 text-xs text-gray-500">
                            Sem contato
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Agenda de hoje */}
          <div className="mt-8">
            <div className="mb-5">
              <h3 className="text-xl font-semibold text-gray-900">
                Agenda de hoje
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Acompanhe os pets do turno da manhã e da tarde.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      ☀️ Manhã
                    </h4>

                    <p className="text-sm text-gray-500">
                      08:00 às 12:00
                    </p>
                  </div>

                  <span className="rounded-lg bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                    {agendamentosManha.length} pets
                  </span>
                </div>

                <div className="mt-5 space-y-3">
                  {agendamentosManha.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center">
                      <p className="text-sm text-gray-500">
                        Nenhum pet agendado pela manhã.
                      </p>
                    </div>
                  ) : (
                    agendamentosManha.map(renderAgendamento)
                  )}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      🌤️ Tarde
                    </h4>

                    <p className="text-sm text-gray-500">
                      13:30 às 17:30
                    </p>
                  </div>

                  <span className="rounded-lg bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                    {agendamentosTarde.length} pets
                  </span>
                </div>

                <div className="mt-5 space-y-3">
                  {agendamentosTarde.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center">
                      <p className="text-sm text-gray-500">
                        Nenhum pet agendado à tarde.
                      </p>
                    </div>
                  ) : (
                    agendamentosTarde.map(renderAgendamento)
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 text-right">
              <a
                href="/agenda"
                className="text-sm font-medium text-gray-700 hover:underline"
              >
                Abrir agenda completa →
              </a>
            </div>
          </div>

          {/* Últimos atendimentos */}
          <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Últimos atendimentos
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  Histórico dos atendimentos realizados
                </p>
              </div>

              <a
                href="/agenda"
                className="text-sm font-medium text-gray-700 hover:underline"
              >
                Ver histórico →
              </a>
            </div>

            {carregando ? (
              <div className="mt-6 rounded-xl bg-gray-50 p-6 text-center text-gray-500">
                Carregando...
              </div>
            ) : ultimosAtendimentos.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-gray-300 p-8 text-center">
                <p className="text-gray-500">
                  Nenhum atendimento registrado ainda.
                </p>
              </div>
            ) : (
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b text-sm text-gray-500">
                      <th className="pb-3 font-medium">Pet</th>
                      <th className="pb-3 font-medium">Tutor</th>
                      <th className="pb-3 font-medium">Serviço</th>
                      <th className="pb-3 font-medium">Data</th>
                      <th className="pb-3 text-right font-medium">Valor</th>
                      <th className="pb-3 text-right font-medium">
                        Pagamento
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {ultimosAtendimentos.map(function (item) {
                      return (
                        <tr
                          key={item.id}
                          className="border-b last:border-b-0"
                        >
                          <td className="py-4 font-medium text-gray-900">
                            {item.petNome}
                          </td>

                          <td className="py-4 text-gray-600">
                            {item.tutorNome}
                          </td>

                          <td className="py-4 text-gray-600">
                            {item.servico}
                          </td>

                          <td className="py-4 text-gray-600">
                            {formatarData(item.data)}
                          </td>

                          <td className="py-4 text-right font-medium text-gray-900">
                            {formatarValor(item.valor)}
                          </td>

                          <td className="py-4 text-right text-sm text-gray-500">
                            {item.pagamento}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
