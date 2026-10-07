"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import MenuLateral from "@/app/components/MenuLateral";

type Atendimento = {
  id: string;
  agendamento_id: string | null;
  pet_id: string | null;
  data: string;
  valor: number | null;
  forma_pagamento: string | null;
};

type Pet = {
  id: string;
  nome: string;
  cliente_id: string;
};

type Cliente = {
  id: string;
  nome: string;
};

type Agendamento = {
  id: string;
  pet_id: string;
  data: string;
  horario: string | null;
  servico_nome: string | null;
  observacoes: string | null;
  valor_total: number | null;
};

type AtendimentoExibicao = {
  id: string;
  data: string;
  petNome: string;
  tutorNome: string;
  servicos: string[];
  valor: number;
  pagamento: string;
};

function obterDataLocal() {
  const hoje = new Date();

  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function formatarData(data: string) {
  if (!data) {
    return "-";
  }

  // Remove horário e fuso quando a data vier como:
  // 2026-10-05T00:00:00+00:00
  const dataSemHorario = data.split("T")[0];

  const partes = dataSemHorario.split("-");

  if (partes.length !== 3) {
    return data;
  }

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function formatarValor(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function obterPrimeiroDiaDoMes() {
  const hoje = new Date();

  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");

  return `${ano}-${mes}-01`;
}

function obterDataSeteDiasAtras() {
  const hoje = new Date();

  hoje.setDate(hoje.getDate() - 6);

  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function obterDataTrintaDiasAtras() {
  const hoje = new Date();

  hoje.setDate(hoje.getDate() - 29);

  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function limparServico(servico: string) {
  return servico
    .replace(/^[-•]\s*/, "")
    .replace(/^serviço\s*:\s*/i, "")
    .replace(/^serviços\s*:\s*/i, "")
    .trim();
}

function adicionarServico(
  lista: string[],
  servico: string
) {
  const limpo = limparServico(servico);

  if (!limpo) {
    return;
  }

  const partes = limpo
    .split(/\s*(?:\||;|\n)\s*/)
    .map((item) => item.trim())
    .filter(Boolean);

  partes.forEach((parte) => {
    const normalizado = parte.toLowerCase();

    const jaExiste = lista.some(
      (item) =>
        item.toLowerCase() === normalizado
    );

    if (!jaExiste) {
      lista.push(parte);
    }
  });
}

function obterServicosDoAgendamento(
  agendamento: Agendamento | undefined
) {
  const servicos: string[] = [];

  if (!agendamento) {
    return ["Banho e tosa"];
  }

  if (agendamento.servico_nome) {
    adicionarServico(
      servicos,
      agendamento.servico_nome
    );
  }

  const observacoes =
    agendamento.observacoes || "";

  if (observacoes) {
    const texto = observacoes.trim();

    const encontrouEstruturaDeServicos =
      /serviços?\s*:/i.test(texto) ||
      /banho\s*:/i.test(texto) ||
      /tosa[s]?\s*:/i.test(texto) ||
      /adicionais?\s*:/i.test(texto);

    if (encontrouEstruturaDeServicos) {
      const partes = texto
        .split(/\n+/)
        .map((item) => item.trim())
        .filter(Boolean);

      partes.forEach((parte) => {
        const semMarcador = parte
          .replace(/^[-•]\s*/, "")
          .trim();

        const partesLinha =
          semMarcador.split(/\s*\|\s*/);

        partesLinha.forEach((item) => {
          const valor = item.trim();

          if (!valor) {
            return;
          }

          const corresponde =
            valor.match(
              /^(serviços?|banho|tosa[s]?|adicionais?)\s*:\s*(.*)$/i
            );

          if (corresponde) {
            const conteudo =
              corresponde[2].trim();

            if (conteudo) {
              adicionarServico(
                servicos,
                conteudo
              );
            }
          } else if (
            !/^(observaç|observac)/i.test(
              valor
            )
          ) {
            adicionarServico(
              servicos,
              valor
            );
          }
        });
      });
    }
  }

  if (servicos.length === 0) {
    servicos.push("Banho e tosa");
  }

  return servicos;
}

export default function RelatoriosPage() {
  const [atendimentos, setAtendimentos] =
    useState<Atendimento[]>([]);

  const [pets, setPets] =
    useState<Pet[]>([]);

  const [clientes, setClientes] =
    useState<Cliente[]>([]);

  const [agendamentos, setAgendamentos] =
    useState<Agendamento[]>([]);

  const [carregando, setCarregando] =
    useState(true);

  const [periodo, setPeriodo] =
    useState("mes");

  const [dataInicio, setDataInicio] =
    useState(obterPrimeiroDiaDoMes());

  const [dataFim, setDataFim] =
    useState(obterDataLocal());

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    setCarregando(true);

    const [
      respostaAtendimentos,
      respostaPets,
      respostaClientes,
      respostaAgendamentos,
    ] = await Promise.all([
      supabase
        .from("atendimentos")
        .select(
          "id, agendamento_id, pet_id, data, valor, forma_pagamento"
        )
        .order("data", {
          ascending: false,
        }),

      supabase
        .from("pets")
        .select("id, nome, cliente_id")
        .order("nome", {
          ascending: true,
        }),

      supabase
        .from("clientes")
        .select("id, nome")
        .order("nome", {
          ascending: true,
        }),

      supabase
        .from("agendamentos")
        .select(
          "id, pet_id, data, horario, servico_nome, observacoes, valor_total"
        )
        .order("data", {
          ascending: false,
        }),
    ]);

    if (respostaAtendimentos.data) {
      setAtendimentos(
        respostaAtendimentos.data as Atendimento[]
      );
    }

    if (respostaPets.data) {
      setPets(
        respostaPets.data as Pet[]
      );
    }

    if (respostaClientes.data) {
      setClientes(
        respostaClientes.data as Cliente[]
      );
    }

    if (respostaAgendamentos.data) {
      setAgendamentos(
        respostaAgendamentos.data as Agendamento[]
      );
    }

    setCarregando(false);
  }

  function selecionarPeriodo(
    novoPeriodo: string
  ) {
    const hoje = obterDataLocal();

    if (novoPeriodo === "hoje") {
      setDataInicio(hoje);
      setDataFim(hoje);
    }

    if (novoPeriodo === "7dias") {
      setDataInicio(
        obterDataSeteDiasAtras()
      );
      setDataFim(hoje);
    }

    if (novoPeriodo === "30dias") {
      setDataInicio(
        obterDataTrintaDiasAtras()
      );
      setDataFim(hoje);
    }

    if (novoPeriodo === "mes") {
      setDataInicio(
        obterPrimeiroDiaDoMes()
      );
      setDataFim(hoje);
    }

    setPeriodo(novoPeriodo);
  }

  const atendimentosPeriodo =
    useMemo(() => {
      return atendimentos.filter(
        (atendimento) =>
          atendimento.data >= dataInicio &&
          atendimento.data <= dataFim
      );
    }, [
      atendimentos,
      dataInicio,
      dataFim,
    ]);

  const atendimentosExibicao =
    useMemo(() => {
      return atendimentosPeriodo.map(
        (atendimento) => {
          const pet = pets.find(
            (item) =>
              item.id ===
              atendimento.pet_id
          );

          const cliente = clientes.find(
            (item) =>
              item.id ===
              (pet
                ? pet.cliente_id
                : "")
          );

          const agendamento =
            agendamentos.find(
              (item) =>
                item.id ===
                atendimento.agendamento_id
            );

          return {
            id: atendimento.id,
            data: atendimento.data,
            petNome: pet
              ? pet.nome
              : "Pet",
            tutorNome: cliente
              ? cliente.nome
              : "Tutor",
            servicos:
              obterServicosDoAgendamento(
                agendamento
              ),
            valor: Number(
              atendimento.valor || 0
            ),
            pagamento:
              atendimento.forma_pagamento ||
              "Não informado",
          };
        }
      );
    }, [
      atendimentosPeriodo,
      pets,
      clientes,
      agendamentos,
    ]);

  const faturamento =
    useMemo(() => {
      return atendimentosPeriodo.reduce(
        (total, atendimento) =>
          total +
          Number(
            atendimento.valor || 0
          ),
        0
      );
    }, [atendimentosPeriodo]);

  const quantidadeAtendimentos =
    atendimentosPeriodo.length;

  const petsAtendidos =
    useMemo(() => {
      const ids = new Set<string>();

      atendimentosPeriodo.forEach(
        (atendimento) => {
          if (atendimento.pet_id) {
            ids.add(
              atendimento.pet_id
            );
          }
        }
      );

      return ids.size;
    }, [atendimentosPeriodo]);

  const ticketMedio =
    quantidadeAtendimentos > 0
      ? faturamento /
        quantidadeAtendimentos
      : 0;

  const servicos = useMemo(() => {
    const mapa = new Map<
      string,
      {
        quantidade: number;
        faturamento: number;
      }
    >();

    atendimentosExibicao.forEach(
      (atendimento) => {
        const quantidadeServicos =
          atendimento.servicos.length;

        atendimento.servicos.forEach(
          (nome) => {
            const atual =
              mapa.get(nome) || {
                quantidade: 0,
                faturamento: 0,
              };

            const valorProporcional =
              quantidadeServicos > 0
                ? atendimento.valor /
                  quantidadeServicos
                : atendimento.valor;

            mapa.set(nome, {
              quantidade:
                atual.quantidade + 1,
              faturamento:
                atual.faturamento +
                valorProporcional,
            });
          }
        );
      }
    );

    return Array.from(
      mapa.entries()
    )
      .map(([nome, dados]) => ({
        nome,
        quantidade:
          dados.quantidade,
        faturamento:
          dados.faturamento,
      }))
      .sort(
        (a, b) =>
          b.quantidade -
          a.quantidade
      );
  }, [atendimentosExibicao]);

  const pagamentos = useMemo(() => {
    const mapa = new Map<
      string,
      {
        quantidade: number;
        valor: number;
      }
    >();

    atendimentosExibicao.forEach(
      (atendimento) => {
        const nome =
          atendimento.pagamento;

        const atual =
          mapa.get(nome) || {
            quantidade: 0,
            valor: 0,
          };

        mapa.set(nome, {
          quantidade:
            atual.quantidade + 1,
          valor:
            atual.valor +
            atendimento.valor,
        });
      }
    );

    return Array.from(
      mapa.entries()
    )
      .map(([nome, dados]) => ({
        nome,
        quantidade:
          dados.quantidade,
        valor: dados.valor,
      }))
      .sort(
        (a, b) =>
          b.valor - a.valor
      );
  }, [atendimentosExibicao]);

  const atendimentosPorDia =
    useMemo(() => {
      const mapa = new Map<
        string,
        {
          quantidade: number;
          valor: number;
        }
      >();

      atendimentosExibicao.forEach(
        (atendimento) => {
          const atual =
            mapa.get(
              atendimento.data
            ) || {
              quantidade: 0,
              valor: 0,
            };

          mapa.set(
            atendimento.data,
            {
              quantidade:
                atual.quantidade + 1,
              valor:
                atual.valor +
                atendimento.valor,
            }
          );
        }
      );

      return Array.from(
        mapa.entries()
      )
        .map(([data, dados]) => ({
          data,
          quantidade:
            dados.quantidade,
          valor: dados.valor,
        }))
        .sort((a, b) =>
          b.data.localeCompare(
            a.data
          )
        );
    }, [atendimentosExibicao]);

  return (
    <main className="min-h-screen bg-gray-100">
      <div className="flex min-h-screen">
        <MenuLateral />

        <section className="flex-1 p-8">
          <div className="mb-8">
            <p className="text-sm font-medium text-gray-500">
              Gestão da operação
            </p>

            <h2 className="mt-1 text-3xl font-bold text-gray-900">
              Relatórios
            </h2>

            <p className="mt-1 text-gray-500">
              Acompanhe os resultados do
              banho e tosa do SPA PET
              AGROMINAS.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Período
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  Selecione o período que
                  deseja analisar.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  ["hoje", "Hoje"],
                  ["7dias", "7 dias"],
                  ["30dias", "30 dias"],
                  ["mes", "Este mês"],
                ].map(
                  ([valor, texto]) => (
                    <button
                      key={valor}
                      type="button"
                      onClick={() =>
                        selecionarPeriodo(
                          valor
                        )
                      }
                      className={
                        periodo === valor
                          ? "rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
                          : "rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200"
                      }
                    >
                      {texto}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Data inicial
                </label>

                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => {
                    setDataInicio(
                      e.target.value
                    );
                    setPeriodo(
                      "personalizado"
                    );
                  }}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-gray-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Data final
                </label>

                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => {
                    setDataFim(
                      e.target.value
                    );
                    setPeriodo(
                      "personalizado"
                    );
                  }}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-gray-400"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500">
                  Faturamento
                </p>
                <span className="text-xl">
                  💰
                </span>
              </div>

              <p className="mt-3 text-3xl font-bold text-gray-900">
                {carregando
                  ? "..."
                  : formatarValor(
                      faturamento
                    )}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                No período selecionado
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500">
                  Atendimentos
                </p>
                <span className="text-xl">
                  ✂️
                </span>
              </div>

              <p className="mt-3 text-3xl font-bold text-gray-900">
                {carregando
                  ? "..."
                  : quantidadeAtendimentos}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Atendimentos realizados
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500">
                  Pets atendidos
                </p>
                <span className="text-xl">
                  🐾
                </span>
              </div>

              <p className="mt-3 text-3xl font-bold text-gray-900">
                {carregando
                  ? "..."
                  : petsAtendidos}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Pets únicos
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500">
                  Ticket médio
                </p>
                <span className="text-xl">
                  📈
                </span>
              </div>

              <p className="mt-3 text-3xl font-bold text-gray-900">
                {carregando
                  ? "..."
                  : formatarValor(
                      ticketMedio
                    )}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Valor médio por atendimento
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Serviços realizados
                  </h3>

                  <p className="mt-1 text-sm text-gray-500">
                    Quantidade e faturamento
                    por serviço.
                  </p>
                </div>

                <span className="text-xl">
                  🛁
                </span>
              </div>

              {servicos.length ===
              0 ? (
                <div className="mt-6 rounded-xl border border-dashed border-gray-300 p-8 text-center">
                  <p className="text-sm text-gray-500">
                    Nenhum atendimento no
                    período.
                  </p>
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  {servicos.map(
                    (servico) => (
                      <div
                        key={
                          servico.nome
                        }
                        className="flex items-center justify-between rounded-xl bg-gray-50 p-4"
                      >
                        <div>
                          <p className="font-medium text-gray-900">
                            {
                              servico.nome
                            }
                          </p>

                          <p className="mt-1 text-xs text-gray-500">
                            {
                              servico.quantidade
                            }{" "}
                            atendimento
                            {servico.quantidade ===
                            1
                              ? ""
                              : "s"}
                          </p>
                        </div>

                        <p className="font-semibold text-gray-900">
                          {formatarValor(
                            servico.faturamento
                          )}
                        </p>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Formas de pagamento
                  </h3>

                  <p className="mt-1 text-sm text-gray-500">
                    Faturamento separado
                    por pagamento.
                  </p>
                </div>

                <span className="text-xl">
                  💳
                </span>
              </div>

              {pagamentos.length ===
              0 ? (
                <div className="mt-6 rounded-xl border border-dashed border-gray-300 p-8 text-center">
                  <p className="text-sm text-gray-500">
                    Nenhum pagamento no
                    período.
                  </p>
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  {pagamentos.map(
                    (pagamento) => (
                      <div
                        key={
                          pagamento.nome
                        }
                        className="flex items-center justify-between rounded-xl bg-gray-50 p-4"
                      >
                        <div>
                          <p className="font-medium text-gray-900">
                            {
                              pagamento.nome
                            }
                          </p>

                          <p className="mt-1 text-xs text-gray-500">
                            {
                              pagamento.quantidade
                            }{" "}
                            atendimento
                            {pagamento.quantidade ===
                            1
                              ? ""
                              : "s"}
                          </p>
                        </div>

                        <p className="font-semibold text-gray-900">
                          {formatarValor(
                            pagamento.valor
                          )}
                        </p>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Atendimentos por dia
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  Movimento diário dentro
                  do período selecionado.
                </p>
              </div>

              <span className="text-xl">
                📅
              </span>
            </div>

            {atendimentosPorDia.length ===
            0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-gray-300 p-8 text-center">
                <p className="text-sm text-gray-500">
                  Nenhum atendimento no
                  período.
                </p>
              </div>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b text-sm text-gray-500">
                      <th className="pb-3 font-medium">
                        Data
                      </th>

                      <th className="pb-3 font-medium">
                        Atendimentos
                      </th>

                      <th className="pb-3 text-right font-medium">
                        Faturamento
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {atendimentosPorDia.map(
                      (dia) => (
                        <tr
                          key={dia.data}
                          className="border-b last:border-b-0"
                        >
                          <td className="py-4 font-medium text-gray-900">
                            {formatarData(
                              dia.data
                            )}
                          </td>

                          <td className="py-4 text-gray-600">
                            {
                              dia.quantidade
                            }
                          </td>

                          <td className="py-4 text-right font-medium text-gray-900">
                            {formatarValor(
                              dia.valor
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Detalhamento dos
                  atendimentos
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  Todos os atendimentos
                  realizados no período
                  selecionado.
                </p>
              </div>

              <span className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-600">
                {
                  atendimentosExibicao.length
                }{" "}
                registros
              </span>
            </div>

            {carregando ? (
              <div className="mt-6 rounded-xl bg-gray-50 p-8 text-center text-gray-500">
                Carregando relatórios...
              </div>
            ) : atendimentosExibicao.length ===
              0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-gray-300 p-8 text-center">
                <p className="text-gray-500">
                  Nenhum atendimento
                  encontrado no período
                  selecionado.
                </p>
              </div>
            ) : (
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b text-sm text-gray-500">
                      <th className="pb-3 font-medium">
                        Data
                      </th>

                      <th className="pb-3 font-medium">
                        Pet
                      </th>

                      <th className="pb-3 font-medium">
                        Tutor
                      </th>

                      <th className="pb-3 font-medium">
                        Serviços
                      </th>

                      <th className="pb-3 text-right font-medium">
                        Valor
                      </th>

                      <th className="pb-3 text-right font-medium">
                        Pagamento
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {atendimentosExibicao.map(
                      (item) => (
                        <tr
                          key={item.id}
                          className="border-b last:border-b-0"
                        >
                          <td className="py-4 text-gray-600">
                            {formatarData(
                              item.data
                            )}
                          </td>

                          <td className="py-4 font-medium text-gray-900">
                            {
                              item.petNome
                            }
                          </td>

                          <td className="py-4 text-gray-600">
                            {
                              item.tutorNome
                            }
                          </td>

                          <td className="py-4">
                            <div className="space-y-1">
                              {item.servicos.map(
                                (
                                  servico
                                ) => (
                                  <div
                                    key={
                                      servico
                                    }
                                    className="text-sm text-gray-700"
                                  >
                                    <span className="mr-1 text-gray-400">
                                      •
                                    </span>
                                    {
                                      servico
                                    }
                                  </div>
                                )
                              )}
                            </div>
                          </td>

                          <td className="py-4 text-right font-medium text-gray-900">
                            {formatarValor(
                              item.valor
                            )}
                          </td>

                          <td className="py-4 text-right text-sm text-gray-500">
                            {
                              item.pagamento
                            }
                          </td>
                        </tr>
                      )
                    )}
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