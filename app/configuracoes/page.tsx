"use client";

import { useEffect, useState } from "react";
import MenuLateral from "@/app/components/MenuLateral";
import { supabase } from "@/lib/supabase";

type Configuracoes = {
  id: number;
  nome_estabelecimento: string;
  whatsapp: string;
  telefone: string;
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  horario_manha_inicio: string;
  horario_manha_fim: string;
  horario_tarde_inicio: string;
  horario_tarde_fim: string;
};

type Servico = {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  duracao_minutos: number;
  ativo: boolean;
};

type Perfil = {
  id: string;
  nome: string;
  perfil: string;
};

const configuracaoInicial: Configuracoes = {
  id: 0,
  nome_estabelecimento: "SPA PET AGROMINAS",
  whatsapp: "",
  telefone: "",
  cep: "",
  rua: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  horario_manha_inicio: "08:00",
  horario_manha_fim: "12:00",
  horario_tarde_inicio: "13:30",
  horario_tarde_fim: "17:30",
};

export default function ConfiguracoesPage() {
  const [config, setConfig] =
    useState<Configuracoes>(configuracaoInicial);

  const [servicos, setServicos] = useState<Servico[]>([]);
  const [perfis, setPerfis] = useState<Perfil[]>([]);

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [mensagem, setMensagem] = useState("");

  const [modalServico, setModalServico] = useState(false);
  const [servicoEditando, setServicoEditando] =
    useState<Servico | null>(null);

  const [servicoForm, setServicoForm] = useState({
    nome: "",
    descricao: "",
    preco: "",
    duracao_minutos: "",
    ativo: true,
  });

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    setCarregando(true);

    const { data: configuracao } = await supabase
      .from("configuracoes")
      .select("*")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (configuracao) {
      setConfig({
        ...configuracaoInicial,
        ...configuracao,
      });
    }

    const { data: servicosData } = await supabase
      .from("servicos")
      .select(
        "id, nome, descricao, preco, duracao_minutos, ativo"
      )
      .order("nome", { ascending: true });

    if (servicosData) {
      setServicos(servicosData as Servico[]);
    }

    const { data: perfisData } = await supabase
      .from("perfis")
      .select("id, nome, perfil")
      .order("nome", { ascending: true });

    if (perfisData) {
      setPerfis(perfisData as Perfil[]);
    }

    setCarregando(false);
  }

  function atualizarCampo(
    campo: keyof Configuracoes,
    valor: string
  ) {
    setConfig((atual) => ({
      ...atual,
      [campo]: valor,
    }));
  }

  function formatarCep(valor: string) {
    const numeros = valor.replace(/\D/g, "").slice(0, 8);

    if (numeros.length <= 5) {
      return numeros;
    }

    return `${numeros.slice(0, 5)}-${numeros.slice(5)}`;
  }

  function formatarTelefone(valor: string) {
    const numeros = valor.replace(/\D/g, "").slice(0, 11);

    if (numeros.length <= 2) {
      return numeros;
    }

    if (numeros.length <= 7) {
      return `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`;
    }

    if (numeros.length <= 10) {
      return `(${numeros.slice(0, 2)}) ${numeros.slice(
        2,
        6
      )}-${numeros.slice(6)}`;
    }

    return `(${numeros.slice(0, 2)}) ${numeros.slice(
      2,
      7
    )}-${numeros.slice(7)}`;
  }

  async function buscarCep() {
    const cep = config.cep.replace(/\D/g, "");

    if (cep.length !== 8) {
      return;
    }

    setBuscandoCep(true);

    try {
      const resposta = await fetch(
        `https://viacep.com.br/ws/${cep}/json/`
      );

      const dados = await resposta.json();

      if (!dados.erro) {
        setConfig((atual) => ({
          ...atual,
          rua: dados.logradouro || "",
          bairro: dados.bairro || "",
          cidade: dados.localidade || "",
          uf: dados.uf || "",
        }));
      }
    } catch {
      // Mantém a tela funcionando mesmo se o ViaCEP estiver indisponível.
    } finally {
      setBuscandoCep(false);
    }
  }

  async function salvarConfiguracoes() {
    setSalvando(true);
    setMensagem("");

    const dados = {
      nome_estabelecimento: config.nome_estabelecimento,
      whatsapp: config.whatsapp,
      telefone: config.telefone,
      cep: config.cep,
      rua: config.rua,
      numero: config.numero,
      complemento: config.complemento,
      bairro: config.bairro,
      cidade: config.cidade,
      uf: config.uf,
      horario_manha_inicio: config.horario_manha_inicio,
      horario_manha_fim: config.horario_manha_fim,
      horario_tarde_inicio: config.horario_tarde_inicio,
      horario_tarde_fim: config.horario_tarde_fim,
      atualizado_em: new Date().toISOString(),
    };

    let erro = null;

    if (config.id) {
      const resultado = await supabase
        .from("configuracoes")
        .update(dados)
        .eq("id", config.id);

      erro = resultado.error;
    } else {
      const resultado = await supabase
        .from("configuracoes")
        .insert(dados)
        .select()
        .single();

      erro = resultado.error;

      if (resultado.data) {
        setConfig((atual) => ({
          ...atual,
          ...resultado.data,
        }));
      }
    }

    if (erro) {
      setMensagem(
        "Não foi possível salvar as configurações."
      );
      setSalvando(false);
      return;
    }

    setMensagem("Configurações salvas com sucesso.");
    setSalvando(false);

    setTimeout(() => {
      setMensagem("");
    }, 3000);
  }

  function abrirNovoServico() {
    setServicoEditando(null);

    setServicoForm({
      nome: "",
      descricao: "",
      preco: "",
      duracao_minutos: "",
      ativo: true,
    });

    setModalServico(true);
  }

  function abrirEditarServico(servico: Servico) {
    setServicoEditando(servico);

    setServicoForm({
      nome: servico.nome,
      descricao: servico.descricao || "",
      preco: String(servico.preco ?? ""),
      duracao_minutos: String(
        servico.duracao_minutos ?? ""
      ),
      ativo: servico.ativo,
    });

    setModalServico(true);
  }

  async function salvarServico() {
    if (!servicoForm.nome.trim()) {
      alert("Informe o nome do serviço.");
      return;
    }

    const preco = Number(
      servicoForm.preco.replace(",", ".")
    );

    const duracao = Number(
      servicoForm.duracao_minutos
    );

    if (Number.isNaN(preco) || preco < 0) {
      alert("Informe um preço válido.");
      return;
    }

    if (Number.isNaN(duracao) || duracao <= 0) {
      alert("Informe uma duração válida.");
      return;
    }

    const dados = {
      nome: servicoForm.nome.trim(),
      descricao: servicoForm.descricao.trim() || null,
      preco,
      duracao_minutos: duracao,
      ativo: servicoForm.ativo,
    };

    if (servicoEditando) {
      const { error } = await supabase
        .from("servicos")
        .update(dados)
        .eq("id", servicoEditando.id);

      if (error) {
        alert("Não foi possível atualizar o serviço.");
        return;
      }
    } else {
      const { error } = await supabase
        .from("servicos")
        .insert(dados);

      if (error) {
        alert("Não foi possível cadastrar o serviço.");
        return;
      }
    }

    setModalServico(false);
    await carregarDados();
  }

  async function alternarServico(servico: Servico) {
    const { error } = await supabase
      .from("servicos")
      .update({
        ativo: !servico.ativo,
      })
      .eq("id", servico.id);

    if (error) {
      alert("Não foi possível alterar o status do serviço.");
      return;
    }

    setServicos((atuais) =>
      atuais.map((item) =>
        item.id === servico.id
          ? { ...item, ativo: !item.ativo }
          : item
      )
    );
  }

  function formatarMoeda(valor: number) {
    return Number(valor || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function formatarDuracao(minutos: number) {
    if (minutos < 60) {
      return `${minutos} min`;
    }

    const horas = Math.floor(minutos / 60);
    const resto = minutos % 60;

    if (!resto) {
      return `${horas}h`;
    }

    return `${horas}h ${resto}min`;
  }

  if (carregando) {
    return (
      <div className="min-h-screen bg-slate-50">
        <MenuLateral />

        <main className="min-h-screen bg-slate-50">
          <div className="flex min-h-screen items-center justify-center">
            <div className="text-center">
              <div className="text-5xl">🐾</div>

              <p className="mt-4 text-sm text-slate-500">
                Carregando configurações...
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <MenuLateral />

     <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">

          {/* CABEÇALHO */}
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-2xl shadow-sm">
                  ⚙️
                </div>

                <div>
                  <h1 className="text-2xl font-bold text-slate-800">
                    Configurações
                  </h1>

                  <p className="text-sm text-slate-500">
                    Configure o funcionamento do SPA PET AGROMINAS.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={salvarConfiguracoes}
              disabled={salvando}
              className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {salvando
                ? "Salvando..."
                : "Salvar configurações"}
            </button>
          </div>

          {mensagem && (
            <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              ✓ {mensagem}
            </div>
          )}

          {/* DADOS DO SPA */}
          <section className="mb-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-5">
              <h2 className="text-lg font-bold text-slate-800">
                🏢 Dados do SPA
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Informações principais do estabelecimento.
              </p>
            </div>

            <div className="grid gap-5 p-6 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Nome do estabelecimento
                </label>

                <input
                  value={config.nome_estabelecimento}
                  onChange={(e) =>
                    atualizarCampo(
                      "nome_estabelecimento",
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  WhatsApp
                </label>

                <input
                  value={config.whatsapp}
                  onChange={(e) =>
                    atualizarCampo(
                      "whatsapp",
                      formatarTelefone(e.target.value)
                    )
                  }
                  placeholder="(00) 00000-0000"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Telefone
                </label>

                <input
                  value={config.telefone}
                  onChange={(e) =>
                    atualizarCampo(
                      "telefone",
                      formatarTelefone(e.target.value)
                    )
                  }
                  placeholder="(00) 0000-0000"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            </div>
          </section>

          {/* ENDEREÇO */}
          <section className="mb-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-5">
              <h2 className="text-lg font-bold text-slate-800">
                📍 Endereço
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                O endereço pode ser preenchido automaticamente pelo CEP.
              </p>
            </div>

            <div className="grid gap-5 p-6 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  CEP
                </label>

                <div className="flex gap-2">
                  <input
                    value={config.cep}
                    onChange={(e) =>
                      atualizarCampo(
                        "cep",
                        formatarCep(e.target.value)
                      )
                    }
                    onBlur={buscarCep}
                    placeholder="00000-000"
                    className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />

                  <button
                    type="button"
                    onClick={buscarCep}
                    disabled={buscandoCep}
                    className="rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-60"
                  >
                    {buscandoCep ? "..." : "Buscar"}
                  </button>
                </div>
              </div>

              <div className="lg:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Rua
                </label>

                <input
                  value={config.rua}
                  onChange={(e) =>
                    atualizarCampo("rua", e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Número
                </label>

                <input
                  value={config.numero}
                  onChange={(e) =>
                    atualizarCampo("numero", e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Complemento
                </label>

                <input
                  value={config.complemento}
                  onChange={(e) =>
                    atualizarCampo(
                      "complemento",
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Bairro
                </label>

                <input
                  value={config.bairro}
                  onChange={(e) =>
                    atualizarCampo("bairro", e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Cidade
                </label>

                <input
                  value={config.cidade}
                  onChange={(e) =>
                    atualizarCampo("cidade", e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  UF
                </label>

                <input
                  value={config.uf}
                  onChange={(e) =>
                    atualizarCampo(
                      "uf",
                      e.target.value.toUpperCase().slice(0, 2)
                    )
                  }
                  maxLength={2}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm uppercase outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            </div>
          </section>

          {/* HORÁRIOS */}
          <section className="mb-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-5">
              <h2 className="text-lg font-bold text-slate-800">
                🕐 Horários de atendimento
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Defina os horários utilizados pela agenda de banho e tosa.
              </p>
            </div>

            <div className="grid gap-5 p-6 md:grid-cols-2">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="text-2xl">🌅</div>

                  <div>
                    <h3 className="font-bold text-slate-800">
                      Manhã
                    </h3>

                    <p className="text-xs text-slate-500">
                      Primeiro turno
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-xs font-semibold text-slate-600">
                      Início
                    </label>

                    <input
                      type="time"
                      value={config.horario_manha_inicio}
                      onChange={(e) =>
                        atualizarCampo(
                          "horario_manha_inicio",
                          e.target.value
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold text-slate-600">
                      Encerramento
                    </label>

                    <input
                      type="time"
                      value={config.horario_manha_fim}
                      onChange={(e) =>
                        atualizarCampo(
                          "horario_manha_fim",
                          e.target.value
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="text-2xl">🌤️</div>

                  <div>
                    <h3 className="font-bold text-slate-800">
                      Tarde
                    </h3>

                    <p className="text-xs text-slate-500">
                      Segundo turno
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-xs font-semibold text-slate-600">
                      Início
                    </label>

                    <input
                      type="time"
                      value={config.horario_tarde_inicio}
                      onChange={(e) =>
                        atualizarCampo(
                          "horario_tarde_inicio",
                          e.target.value
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold text-slate-600">
                      Encerramento
                    </label>

                    <input
                      type="time"
                      value={config.horario_tarde_fim}
                      onChange={(e) =>
                        atualizarCampo(
                          "horario_tarde_fim",
                          e.target.value
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SERVIÇOS */}
          <section className="mb-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  ✂️ Serviços de banho e tosa
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Gerencie os serviços oferecidos pelo SPA.
                </p>
              </div>

              <button
                type="button"
                onClick={abrirNovoServico}
                className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                + Novo serviço
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left">
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                      Serviço
                    </th>

                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                      Duração
                    </th>

                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                      Preço
                    </th>

                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                      Status
                    </th>

                    <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                      Ações
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {servicos.map((servico) => (
                    <tr
                      key={servico.id}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">
                          {servico.nome}
                        </div>

                        {servico.descricao && (
                          <div className="mt-1 text-xs text-slate-500">
                            {servico.descricao}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600">
                        {formatarDuracao(
                          servico.duracao_minutos
                        )}
                      </td>

                      <td className="px-6 py-4 text-sm font-semibold text-slate-700">
                        {formatarMoeda(servico.preco)}
                      </td>

                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() =>
                            alternarServico(servico)
                          }
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            servico.ativo
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {servico.ativo
                            ? "Ativo"
                            : "Inativo"}
                        </button>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            abrirEditarServico(servico)
                          }
                          className="rounded-lg px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}

                  {!servicos.length && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-10 text-center text-sm text-slate-500"
                      >
                        Nenhum serviço cadastrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* USUÁRIOS */}
          <section className="mb-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-5">
              <h2 className="text-lg font-bold text-slate-800">
                👤 Usuários e acessos
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Usuários cadastrados e seus níveis de acesso ao sistema.
              </p>
            </div>

            <div className="grid gap-4 p-6 md:grid-cols-2">
              {perfis.map((perfil) => (
                <div
                  key={perfil.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 p-5"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-xl">
                      👤
                    </div>

                    <div>
                      <p className="font-bold text-slate-800">
                        {perfil.nome}
                      </p>

                      <p className="text-xs text-slate-500">
                        {perfil.perfil === "admin"
                          ? "Administrador"
                          : "Operacional"}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      perfil.perfil === "admin"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {perfil.perfil === "admin"
                      ? "Acesso completo"
                      : "Acesso operacional"}
                  </span>
                </div>
              ))}
            </div>

            <div className="mx-6 mb-6 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
              <strong>Administrador:</strong> acesso completo ao sistema.
              <br />
              <strong>Operacional:</strong> acesso às funções de operação,
              sem relatórios, faturamento, configurações administrativas
              ou gerenciamento de usuários.
            </div>
          </section>

          {/* WHATSAPP */}
          <section className="mb-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-5">
              <h2 className="text-lg font-bold text-slate-800">
                💬 WhatsApp
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                O número configurado acima será utilizado nas funções de
                comunicação do SPA.
              </p>
            </div>

            <div className="p-6">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                <div className="flex gap-4">
                  <div className="text-3xl">🐾</div>

                  <div>
                    <h3 className="font-bold text-slate-800">
                      Comunicação com clientes
                    </h3>

                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      O WhatsApp será utilizado para compartilhar a agenda
                      e enviar mensagens aos tutores quando o pet estiver
                      pronto.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="pb-8 text-center text-xs text-slate-400">
            SPA PET AGROMINAS · Configurações do sistema
          </div>
        </div>
      </main>

      {/* MODAL SERVIÇO */}
      {modalServico && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  {servicoEditando
                    ? "Editar serviço"
                    : "Novo serviço"}
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Configure as informações do serviço.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setModalServico(false)}
                className="rounded-lg px-3 py-2 text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Nome do serviço
                </label>

                <input
                  value={servicoForm.nome}
                  onChange={(e) =>
                    setServicoForm((atual) => ({
                      ...atual,
                      nome: e.target.value,
                    }))
                  }
                  placeholder="Ex.: Banho + Tosa"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Descrição
                </label>

                <textarea
                  value={servicoForm.descricao}
                  onChange={(e) =>
                    setServicoForm((atual) => ({
                      ...atual,
                      descricao: e.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="Descrição do serviço"
                  className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Preço
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={servicoForm.preco}
                    onChange={(e) =>
                      setServicoForm((atual) => ({
                        ...atual,
                        preco: e.target.value,
                      }))
                    }
                    placeholder="0,00"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Duração (minutos)
                  </label>

                  <input
                    type="number"
                    min="1"
                    value={servicoForm.duracao_minutos}
                    onChange={(e) =>
                      setServicoForm((atual) => ({
                        ...atual,
                        duracao_minutos: e.target.value,
                      }))
                    }
                    placeholder="60"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-slate-50 p-4">
                <input
                  type="checkbox"
                  checked={servicoForm.ativo}
                  onChange={(e) =>
                    setServicoForm((atual) => ({
                      ...atual,
                      ativo: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 accent-emerald-600"
                />

                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    Serviço ativo
                  </p>

                  <p className="text-xs text-slate-500">
                    Serviços inativos não devem aparecer para novos
                    agendamentos.
                  </p>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-5">
              <button
                type="button"
                onClick={() => setModalServico(false)}
                className="rounded-xl px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={salvarServico}
                className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                {servicoEditando
                  ? "Salvar alterações"
                  : "Cadastrar serviço"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}