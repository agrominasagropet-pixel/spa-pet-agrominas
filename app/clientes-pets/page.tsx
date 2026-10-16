"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Frequencia = "Avulso" | "Quinzenal" | "Mensal";
type Turno = "Manhã" | "Tarde";

type ServicosPet = {
  banhoTosa: string;
  tosas: string[];
  adicionais: string[];
  frequencia: Frequencia;
  dataInicio: string;
  turno: Turno;
  valorTotal: string;
};

type Pet = {
  id: string;
  nome: string;
  raca: string;
  sexo: string;
  dataNascimento: string;
  peso: string;
  observacoes: string;
  servicos: ServicosPet;
};

type Cliente = {
  id: string;
  nome: string;
  contato: string;
  cep: string;
  endereco: string;
  numero: string;
  bairro: string;
  observacoes: string;
  pets: Pet[];
};

const opcoesBanhoTosa = [
  "Banho",
  "Banho + Tosa Higiênica",
  "Banho + Tosa Completa",
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
  "Afghan Hound",
  "Affenpinscher",
  "Airedale Terrier",
  "Akita Americano",
  "Akita Inu",
  "Alaskan Malamute",
  "American Staffordshire Terrier",
  "Australian Cattle Dog",
  "Australian Shepherd",
  "Australian Silky Terrier",
  "Basenji",
  "Basset Hound",
  "Beagle",
  "Bearded Collie",
  "Beauceron",
  "Bedlington Terrier",
  "Bernese (Boiadeiro de Berna)",
  "Bichon Frisé",
  "Bloodhound",
  "Bobtail",
  "Border Collie",
  "Border Terrier",
  "Borzoi",
  "Boston Terrier",
  "Bouvier de Flandres",
  "Boxer",
  "Braco Alemão",
  "Braco de Weimar",
  "Briard",
  "Brittany",
  "Bull Terrier",
  "Bulldogue Americano",
  "Bulldogue Francês",
  "Bulldogue Inglês",
  "Bullmastiff",
  "Cairn Terrier",
  "Cane Corso",
  "Cão de Água Português",
  "Cão de Montanha dos Pirenéus",
  "Cão de Santo Humberto",
  "Cão Pastor Belga Groenendael",
  "Cão Pastor Belga Malinois",
  "Cão Pastor Belga Tervuren",
  "Cavalier King Charles Spaniel",
  "Chihuahua",
  "Chow Chow",
  "Cocker Spaniel Americano",
  "Cocker Spaniel Inglês",
  "Collie",
  "Coton de Tuléar",
  "Dachshund",
  "Dálmata",
  "Dobermann",
  "Dogue Alemão",
  "Dogue de Bordeaux",
  "Dogue de Canário",
  "Dogue de Tibet",
  "English Springer Spaniel",
  "Fox Terrier",
  "Fox Terrier Pelo Duro",
  "Fox Terrier Pelo Liso",
  "Galgo Inglês",
  "Golden Retriever",
  "Grande Boiadeiro Suíço",
  "Greyhound",
  "Griffon de Bruxelas",
  "Husky Siberiano",
  "Irish Setter",
  "Jack Russell Terrier",
  "Japanese Chin",
  "Keeshond",
  "Komondor",
  "Kuvasz",
  "Labrador Retriever",
  "Lakeland Terrier",
  "Lagotto Romagnolo",
  "Leonberger",
  "Lhasa Apso",
  "Löwchen",
  "Maltês",
  "Mastiff",
  "Mastim Napolitano",
  "Mastim Tibetano",
  "Maremmano-Abruzzês",
  "Manchester Terrier",
  "Miniature Pinscher",
  "Miniature Schnauzer",
  "Morkie",
  "Newfoundland",
  "Norfolk Terrier",
  "Norwich Terrier",
  "Nova Scotia Duck Tolling Retriever",
  "Old English Sheepdog",
  "Papillon",
  "Pastor Alemão",
  "Pastor Australiano",
  "Pastor de Shetland",
  "Pastor Holandês",
  "Pastor Maremano",
  "Pastor Polonês de Planície",
  "Pastor Suíço Branco",
  "Pekingese",
  "Pinscher",
  "Pit Bull",
  "Pointer Inglês",
  "Pomeranian",
  "Poodle",
  "Poodle Toy",
  "Prague Ratter",
  "Presa Canário",
  "Pug",
  "Puli",
  "Rhodesian Ridgeback",
  "Rottweiler",
  "Russian Toy",
  "Saint Bernard",
  "Saluki",
  "Samoyed",
  "Schnauzer",
  "Schnauzer Gigante",
  "Schnauzer Médio",
  "Scottish Terrier",
  "Shar Pei",
  "Shetland Sheepdog",
  "Shih-tzu",
  "Siberian Husky",
  "Skye Terrier",
  "Sloughi",
  "Soft Coated Wheaten Terrier",
  "Staffordshire Bull Terrier",
  "Standard Poodle",
  "Sussex Spaniel",
  "Teckel",
  "Terra Nova",
  "Thai Ridgeback",
  "Tibetan Spaniel",
  "Tibetan Terrier",
  "Toy Fox Terrier",
  "Vizsla",
  "Weimaraner",
  "Welsh Corgi Cardigan",
  "Welsh Corgi Pembroke",
  "Welsh Terrier",
  "West Highland White Terrier",
  "Whippet",
  "Yorkshire Terrier",
  "Yorkshire Terrier Mini",
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
  };
}

function converterPetDoBanco(pet: any): Pet {
  return {
    id: pet.id,
    nome: pet.nome ?? "",
    raca: pet["raça"] ?? "",
    sexo: pet.sexo ?? "",
    dataNascimento: pet.data_nascimento ?? "",
    peso:
      pet.peso !== null && pet.peso !== undefined
        ? String(pet.peso)
        : "",
    observacoes: pet.observacoes ?? "",
    servicos: {
      banhoTosa: pet.banho_tosa ?? "",
      tosas: Array.isArray(pet.tosas) ? pet.tosas : [],
      adicionais: Array.isArray(pet.adicionais)
        ? pet.adicionais
        : [],
      frequencia: pet.frequencia ?? "Avulso",
      dataInicio: pet.data_inicio ?? "",
      turno: pet.turno === "Tarde" ? "Tarde" : "Manhã",
      valorTotal:
        pet.valor_total !== null &&
        pet.valor_total !== undefined
          ? String(pet.valor_total)
          : "",
    },
  };
}

async function carregarClientes(): Promise<Cliente[]> {
  const { data: clientesData, error: clientesError } =
    await supabase
      .from("clientes")
      .select(
        `
          id,
          nome,
          whatsapp,
          telefone,
          cep,
          rua,
          numero,
          bairro,
          observacoes
        `
      )
      .order("nome");

  if (clientesError) {
    console.error("Erro ao carregar clientes:", clientesError);
    throw clientesError;
  }

  const clientes = clientesData ?? [];

  if (clientes.length === 0) {
    return [];
  }

  const idsClientes = clientes.map((cliente) => cliente.id);

  const { data: petsData, error: petsError } =
    await supabase
      .from("pets")
      .select(
        `
          id,
          cliente_id,
          nome,
          "raça",
          sexo,
          data_nascimento,
          peso,
          observacoes,
          banho_tosa,
          tosas,
          adicionais,
          frequencia,
          data_inicio,
          turno,
          valor_total
        `
      )
      .in("cliente_id", idsClientes);

  if (petsError) {
    console.error("Erro ao carregar pets:", petsError);
    throw petsError;
  }

  const pets = petsData ?? [];

  return clientes.map((cliente) => ({
    id: cliente.id,
    nome: cliente.nome ?? "",
    contato: cliente.whatsapp || cliente.telefone || "",
    cep: cliente.cep ?? "",
    endereco: cliente.rua ?? "",
    numero: cliente.numero ?? "",
    bairro: cliente.bairro ?? "",
    observacoes: cliente.observacoes ?? "",
    pets: pets
      .filter((pet) => pet.cliente_id === cliente.id)
      .map(converterPetDoBanco),
  }));
}

function adicionarDias(data: string, dias: number): string {
  const resultado = new Date(`${data}T12:00:00`);
  resultado.setDate(resultado.getDate() + dias);

  return resultado.toISOString().slice(0, 10);
}

function adicionarMeses(data: string, meses: number): string {
  const original = new Date(`${data}T12:00:00`);

  const ano = original.getFullYear();
  const mes = original.getMonth();
  const dia = original.getDate();

  const destino = new Date(ano, mes + meses, 1, 12);

  const ultimoDiaDoMes = new Date(
    destino.getFullYear(),
    destino.getMonth() + 1,
    0,
    12
  ).getDate();

  destino.setDate(Math.min(dia, ultimoDiaDoMes));

  return destino.toISOString().slice(0, 10);
}

function gerarDatasAgendamento(
  dataInicial: string,
  frequencia: Frequencia
): string[] {
  if (!dataInicial) {
    return [];
  }

  if (frequencia === "Avulso") {
    return [dataInicial];
  }

  const datas: string[] = [];
  let dataAtual = dataInicial;
  const limite = adicionarMeses(dataInicial, 12);

  while (dataAtual <= limite) {
    datas.push(dataAtual);

    if (frequencia === "Quinzenal") {
      dataAtual = adicionarDias(dataAtual, 14);
    } else {
      dataAtual = adicionarMeses(dataAtual, 1);
    }
  }

  return datas;
}

function formatarMoeda(valor: string): string {
  const numero = Number(
    valor.replace(/\./g, "").replace(",", ".")
  );

  if (Number.isNaN(numero)) {
    return "";
  }

  return numero.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function valorNumerico(valor: string): number {
  const numero = Number(
    valor.replace(/\./g, "").replace(",", ".")
  );

  return Number.isNaN(numero) ? 0 : numero;
}

function horarioDoTurno(turno: Turno): string {
  return turno === "Tarde" ? "13:30" : "08:00";
}

export default function ClientesPets() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState("");

  const [modalCadastro, setModalCadastro] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [clienteEditandoId, setClienteEditandoId] =
    useState<string | null>(null);

  const [clienteSelecionado, setClienteSelecionado] =
    useState<Cliente | null>(null);

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);

  const [nomeCliente, setNomeCliente] = useState("");
  const [contato, setContato] = useState("");
  const [cep, setCep] = useState("");
  const [endereco, setEndereco] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [observacoesCliente, setObservacoesCliente] =
    useState("");

  const [pets, setPets] = useState<Pet[]>([
    criarPet("novo-1"),
  ]);

  async function atualizarLista() {
    try {
      setCarregando(true);

      const dados = await carregarClientes();

      setClientes(dados);
    } catch (erro) {
      console.error("Erro ao atualizar lista:", erro);

      alert(
        "Não foi possível carregar os clientes. Verifique a conexão com o Supabase."
      );
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    atualizarLista();
  }, []);

  function limparFormulario() {
    setNomeCliente("");
    setContato("");
    setCep("");
    setEndereco("");
    setNumero("");
    setBairro("");
    setObservacoesCliente("");
    setPets([criarPet(`novo-${Date.now()}`)]);
    setModoEdicao(false);
    setClienteEditandoId(null);
  }

  function abrirCadastro() {
    limparFormulario();
    setModalCadastro(true);
  }

  function abrirEdicao(cliente: Cliente) {
    setClienteSelecionado(null);

    setModoEdicao(true);
    setClienteEditandoId(cliente.id);

    setNomeCliente(cliente.nome);
    setContato(cliente.contato);
    setCep(cliente.cep);
    setEndereco(cliente.endereco);
    setNumero(cliente.numero);
    setBairro(cliente.bairro);
    setObservacoesCliente(cliente.observacoes);

    setPets(
      cliente.pets.length > 0
        ? cliente.pets.map((pet) => ({
            ...pet,
            servicos: {
              ...pet.servicos,
              tosas: [...pet.servicos.tosas],
              adicionais: [...pet.servicos.adicionais],
              turno:
                pet.servicos.turno === "Tarde"
                  ? "Tarde"
                  : "Manhã",
            },
          }))
        : [criarPet(`novo-${Date.now()}`)]
    );

    setModalCadastro(true);
  }

  function fecharCadastro() {
    if (!salvando) {
      setModalCadastro(false);
    }
  }

  async function buscarCep(valor: string) {
    const somenteNumeros = valor.replace(/\D/g, "");

    setCep(somenteNumeros);

    if (somenteNumeros.length !== 8) {
      return;
    }

    setBuscandoCep(true);

    try {
      const resposta = await fetch(
        `https://viacep.com.br/ws/${somenteNumeros}/json/`
      );

      if (!resposta.ok) {
        throw new Error("Erro ao consultar CEP.");
      }

      const dados = await resposta.json();

      if (dados.erro) {
        alert("CEP não encontrado.");
        setEndereco("");
        setBairro("");
        return;
      }

      setEndereco(dados.logradouro ?? "");
      setBairro(dados.bairro ?? "");
    } catch (erro) {
      console.error("Erro ao consultar CEP:", erro);
      alert("Não foi possível consultar o CEP.");
    } finally {
      setBuscandoCep(false);
    }
  }

  function atualizarPet(
    id: string,
    campo: keyof Pet,
    valor: string
  ) {
    setPets((listaAtual) =>
      listaAtual.map((pet) =>
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
    setPets((listaAtual) =>
      listaAtual.map((pet) =>
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
    campo: "tosas" | "adicionais",
    valor: string
  ) {
    setPets((listaAtual) =>
      listaAtual.map((pet) => {
        if (pet.id !== id) {
          return pet;
        }

        const listaAtualServico = pet.servicos[campo];

        const novaLista = listaAtualServico.includes(valor)
          ? listaAtualServico.filter((item) => item !== valor)
          : [...listaAtualServico, valor];

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
    setPets((listaAtual) => [
      ...listaAtual,
      criarPet(`novo-${Date.now()}-${listaAtual.length}`),
    ]);
  }

  function removerPet(id: string) {
    const pet = pets.find((item) => item.id === id);

    if (modoEdicao && pet && !pet.id.startsWith("novo-")) {
      alert(
        "Para não afetar o histórico e os agendamentos deste pet, ele não pode ser removido por aqui. Use a exclusão do cadastro quando realmente precisar excluir o tutor."
      );
      return;
    }

    if (pets.length === 1) {
      return;
    }

    setPets((listaAtual) =>
      listaAtual.filter((pet) => pet.id !== id)
    );
  }

  async function criarAgendamentosDoPet(
    petId: string,
    pet: Pet
  ) {
    const datas = gerarDatasAgendamento(
      pet.servicos.dataInicio,
      pet.servicos.frequencia
    );

    if (datas.length === 0) {
      return;
    }

    const valorFinal = valorNumerico(
      pet.servicos.valorTotal
    );

    const observacoes = [
      pet.servicos.banhoTosa,
      ...pet.servicos.tosas,
      ...pet.servicos.adicionais,
    ]
      .filter(Boolean)
      .join(" + ");

    const horario = horarioDoTurno(
      pet.servicos.turno
    );

    const agendamentos = datas.map((data) => ({
      pet_id: petId,
      servico_id: null,
      data,
      horario,
      status: "Agendado",
      observacoes,
      valor_total: valorFinal,
    }));

    const { error } = await supabase
      .from("agendamentos")
      .insert(agendamentos);

    if (error) {
      console.error(
        "Erro ao criar agendamentos do pet:",
        error
      );

      throw new Error(
        `O pet foi cadastrado, mas não foi possível criar a programação automática: ${error.message}`
      );
    }
  }

  async function atualizarClienteExistente() {
    if (!clienteEditandoId) {
      throw new Error(
        "Não foi possível identificar o cliente que será editado."
      );
    }

    const { error: erroCliente } = await supabase
      .from("clientes")
      .update({
        nome: nomeCliente.trim(),
        whatsapp: contato.trim(),
        telefone: contato.trim(),
        cep: cep || null,
        rua: endereco || null,
        numero: numero || null,
        bairro: bairro || null,
        observacoes:
          observacoesCliente.trim() || null,
      })
      .eq("id", clienteEditandoId);

    if (erroCliente) {
      console.error(
        "Erro ao atualizar cliente:",
        erroCliente
      );

      throw new Error(
        `Não foi possível atualizar o cliente: ${erroCliente.message}`
      );
    }

    for (const pet of pets) {
      const valorFinal = valorNumerico(
        pet.servicos.valorTotal
      );

      if (pet.id.startsWith("novo-")) {
        const {
          data: petInserido,
          error: erroPet,
        } = await supabase
          .from("pets")
          .insert({
            cliente_id: clienteEditandoId,
            nome: pet.nome.trim(),
            especie: "Cachorro",
            "raça": pet.raca || null,
            sexo: pet.sexo || null,
            data_nascimento:
              pet.dataNascimento || null,
            peso: pet.peso
              ? Number(
                  pet.peso.replace(",", ".")
                )
              : null,
            observacoes:
              pet.observacoes.trim() || null,
            banho_tosa: pet.servicos.banhoTosa,
            tosas: pet.servicos.tosas,
            adicionais: pet.servicos.adicionais,
            frequencia: pet.servicos.frequencia,
            data_inicio:
              pet.servicos.dataInicio || null,
            turno: pet.servicos.turno,
            valor_total: valorFinal,
          })
          .select("id")
          .single();

        if (erroPet || !petInserido) {
          console.error(
            "Erro ao adicionar novo pet:",
            erroPet
          );

          throw new Error(
            "Não foi possível adicionar um dos novos pets."
          );
        }

        await criarAgendamentosDoPet(
          petInserido.id,
          pet
        );

        continue;
      }

      const { error: erroPet } = await supabase
        .from("pets")
        .update({
          nome: pet.nome.trim(),
          "raça": pet.raca || null,
          sexo: pet.sexo || null,
          data_nascimento:
            pet.dataNascimento || null,
          peso: pet.peso
            ? Number(
                pet.peso.replace(",", ".")
              )
            : null,
          observacoes:
            pet.observacoes.trim() || null,
          banho_tosa: pet.servicos.banhoTosa,
          tosas: pet.servicos.tosas,
          adicionais: pet.servicos.adicionais,
          frequencia: pet.servicos.frequencia,
          data_inicio:
            pet.servicos.dataInicio || null,
          turno: pet.servicos.turno,
          valor_total: valorFinal,
        })
        .eq("id", pet.id);

      if (erroPet) {
        console.error(
          "Erro ao atualizar pet:",
          erroPet
        );

        throw new Error(
          `Não foi possível atualizar o pet ${pet.nome}: ${erroPet.message}`
        );
      }
    }
  }

  async function salvarCliente() {
    if (!nomeCliente.trim()) {
      alert("Informe o nome do tutor.");
      return;
    }

    if (!contato.trim()) {
      alert("Informe o WhatsApp / Telefone.");
      return;
    }

    if (pets.length === 0) {
      alert("Cadastre pelo menos um pet.");
      return;
    }

    const petSemNome = pets.find(
      (pet) => !pet.nome.trim()
    );

    if (petSemNome) {
      alert("Informe o nome de todos os pets.");
      return;
    }

    const petSemServico = pets.find(
      (pet) =>
        !pet.servicos.banhoTosa &&
        pet.servicos.tosas.length === 0 &&
        pet.servicos.adicionais.length === 0
    );

    if (petSemServico) {
      alert(
        "Selecione pelo menos um serviço (Banho e Tosa, Tosas ou Adicionais) para todos os pets."
      );
      return;
    }

    const petSemData = pets.find(
      (pet) => !pet.servicos.dataInicio
    );

    if (petSemData) {
      alert(
        "Informe a data do primeiro banho para todos os pets."
      );
      return;
    }

    const petSemValor = pets.find(
      (pet) => !pet.servicos.valorTotal.trim()
    );

    if (petSemValor) {
      alert(
        "Informe o valor total para todos os pets."
      );
      return;
    }

    const valoresInvalidos = pets.find((pet) => {
      const valor = valorNumerico(
        pet.servicos.valorTotal
      );

      return Number.isNaN(valor) || valor < 0;
    });

    if (valoresInvalidos) {
      alert(
        "Informe um valor total válido para todos os pets."
      );
      return;
    }

    setSalvando(true);

    let clienteId: string | null = null;
    const petsCriados: string[] = [];

    try {
      if (modoEdicao) {
        await atualizarClienteExistente();

        await atualizarLista();

        setModalCadastro(false);
        setModoEdicao(false);
        setClienteEditandoId(null);

        setNomeCliente("");
        setContato("");
        setCep("");
        setEndereco("");
        setNumero("");
        setBairro("");
        setObservacoesCliente("");
        setPets([
          criarPet(`novo-${Date.now()}`),
        ]);

        alert(
          "Cadastro atualizado com sucesso!"
        );

        return;
      }

      const {
        data: clienteInserido,
        error: erroCliente,
      } = await supabase
        .from("clientes")
        .insert({
          nome: nomeCliente.trim(),
          whatsapp: contato.trim(),
          telefone: contato.trim(),
          cep: cep || null,
          rua: endereco || null,
          numero: numero || null,
          bairro: bairro || null,
          observacoes:
            observacoesCliente.trim() || null,
        })
        .select("id")
        .single();

      if (erroCliente || !clienteInserido) {
        console.error(
          "Erro ao salvar cliente:",
          erroCliente
        );

        throw new Error(
          "Não foi possível salvar o cliente."
        );
      }

      clienteId = clienteInserido.id;

      for (const pet of pets) {
        const valorNumericoPet =
          valorNumerico(
            pet.servicos.valorTotal
          );

        const {
          data: petInserido,
          error: erroPet,
        } = await supabase
          .from("pets")
          .insert({
            cliente_id: clienteInserido.id,
            nome: pet.nome.trim(),
            especie: "Cachorro",
            "raça": pet.raca || null,
            sexo: pet.sexo || null,
            data_nascimento:
              pet.dataNascimento || null,
            peso: pet.peso
              ? Number(
                  pet.peso.replace(",", ".")
                )
              : null,
            observacoes:
              pet.observacoes.trim() || null,
            banho_tosa: pet.servicos.banhoTosa,
            tosas: pet.servicos.tosas,
            adicionais: pet.servicos.adicionais,
            frequencia: pet.servicos.frequencia,
            data_inicio:
              pet.servicos.dataInicio || null,
            turno: pet.servicos.turno,
            valor_total: valorNumericoPet,
          })
          .select("id")
          .single();

        if (erroPet || !petInserido) {
          console.error(
            "Erro ao salvar pet:",
            erroPet
          );

          throw new Error(
            "Não foi possível salvar um dos pets."
          );
        }

        petsCriados.push(petInserido.id);

        await criarAgendamentosDoPet(
          petInserido.id,
          pet
        );
      }

      await atualizarLista();

      setModalCadastro(false);

      limparFormulario();

      alert(
        "Tutor, pets e programação de banho cadastrados com sucesso!"
      );
    } catch (erro) {
      console.error(
        "Erro completo ao salvar cadastro:",
        erro
      );

      if (!modoEdicao) {
        if (petsCriados.length > 0) {
          await supabase
            .from("pets")
            .delete()
            .in("id", petsCriados);
        }

        if (clienteId) {
          await supabase
            .from("clientes")
            .delete()
            .eq("id", clienteId);
        }
      }

      alert(
        erro instanceof Error
          ? erro.message
          : "Não foi possível salvar o cadastro."
      );
    } finally {
      setSalvando(false);
    }
  }

  async function excluirCliente(cliente: Cliente) {
    if (excluindo) {
      return;
    }

    const confirmar = window.confirm(
      `Tem certeza que deseja excluir o cadastro de "${cliente.nome}"?\n\nTodos os pets vinculados a este tutor e seus agendamentos também serão excluídos.\n\nEssa ação não pode ser desfeita.`
    );

    if (!confirmar) {
      return;
    }

    setExcluindo(true);

    try {
      const idsPets = cliente.pets.map(
        (pet) => pet.id
      );

      if (idsPets.length > 0) {
        const { error: erroAgendamentos } =
          await supabase
            .from("agendamentos")
            .delete()
            .in("pet_id", idsPets);

        if (erroAgendamentos) {
          console.error(
            "Erro ao excluir agendamentos:",
            erroAgendamentos
          );
        }
      }

      const { error: erroPets } = await supabase
        .from("pets")
        .delete()
        .eq("cliente_id", cliente.id);

      if (erroPets) {
        throw new Error(
          `Erro ao excluir os pets: ${erroPets.message}`
        );
      }

      const { error: erroCliente } = await supabase
        .from("clientes")
        .delete()
        .eq("id", cliente.id);

      if (erroCliente) {
        throw new Error(
          `Erro ao excluir o cliente: ${erroCliente.message}`
        );
      }

      const {
        data: clienteAindaExiste,
        error: erroVerificacao,
      } = await supabase
        .from("clientes")
        .select("id")
        .eq("id", cliente.id)
        .maybeSingle();

      if (erroVerificacao) {
        throw new Error(
          `Não foi possível confirmar a exclusão: ${erroVerificacao.message}`
        );
      }

      if (clienteAindaExiste) {
        throw new Error(
          "O Supabase não confirmou a exclusão do cliente."
        );
      }

      const dadosAtualizados =
        await carregarClientes();

      setClientes(dadosAtualizados);
      setClienteSelecionado(null);

      alert("Cadastro excluído com sucesso!");
    } catch (erro) {
      console.error(
        "Erro completo ao excluir cadastro:",
        erro
      );

      alert(
        erro instanceof Error
          ? erro.message
          : "Não foi possível excluir o cadastro."
      );
    } finally {
      setExcluindo(false);
    }
  }

  const clientesFiltrados = useMemo(() => {
    const texto = busca.trim().toLowerCase();

    if (!texto) {
      return clientes;
    }

    return clientes.filter((cliente) => {
      const encontrouCliente = cliente.nome
        .toLowerCase()
        .includes(texto);

      const encontrouContato = cliente.contato
        .toLowerCase()
        .includes(texto);

      const encontrouPet = cliente.pets.some((pet) =>
        pet.nome.toLowerCase().includes(texto)
      );

      const encontrouRaca = cliente.pets.some((pet) =>
        pet.raca.toLowerCase().includes(texto)
      );

      return (
        encontrouCliente ||
        encontrouContato ||
        encontrouPet ||
        encontrouRaca
      );
    });
  }, [clientes, busca]);

  const clientesVisiveis = useMemo(() => {
    if (busca.trim()) {
      return clientesFiltrados;
    }

    return clientesFiltrados.slice(0, 5);
  }, [clientesFiltrados, busca]);

  return (
    <main className="min-h-screen bg-[#f6f7f9]">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">

        {/* TOPO */}
        <div className="mb-7">
          <a
            href="/"
            className="mb-6 inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
          >
            ← Início
          </a>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-900 text-lg">
                  🐾
                </span>

                <span className="text-sm font-bold tracking-wide text-gray-500">
                  SPA PET AGROMINAS
                </span>
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
                Clientes & Pets
              </h1>

              <p className="mt-2 max-w-xl text-gray-500">
                Encontre rapidamente os tutores e seus pets,
                consulte os dados e mantenha os cadastros
                organizados.
              </p>
            </div>

            <button
              type="button"
              onClick={abrirCadastro}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800"
            >
              <span className="text-lg">+</span>
              Novo cliente
            </button>
          </div>
        </div>

        {/* BUSCA */}
        <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="flex-1">
              <label className="mb-2 block text-sm font-semibold text-gray-800">
                Buscar cliente ou pet
              </label>

              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-gray-400">
                  🔎
                </span>

                <input
                  type="text"
                  value={busca}
                  onChange={(e) =>
                    setBusca(e.target.value)
                  }
                  placeholder="Digite o nome do tutor, pet, telefone ou raça..."
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3.5 pl-12 pr-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-400 focus:bg-white focus:ring-4 focus:ring-gray-100"
                />

                {busca && (
                  <button
                    type="button"
                    onClick={() => setBusca("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-500">
              <span className="font-semibold text-gray-800">
                {busca
                  ? clientesFiltrados.length
                  : clientes.length}
              </span>{" "}
              {busca
                ? clientesFiltrados.length === 1
                  ? "resultado encontrado"
                  : "resultados encontrados"
                : clientes.length === 1
                ? "cliente cadastrado"
                : "clientes cadastrados"}
            </div>
          </div>
        </section>

        {/* LISTA */}
        <section className="mt-7">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {busca
                  ? "Resultados da busca"
                  : "Cadastros"}
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                {busca
                  ? "Confira os cadastros encontrados."
                  : clientes.length > 5
                  ? "Mostrando uma prévia dos cadastros. Use a busca para encontrar qualquer cliente."
                  : "Tutors e pets cadastrados no sistema."}
              </p>
            </div>
          </div>

          {carregando ? (
            <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-xl">
                🐾
              </div>

              <p className="mt-4 font-semibold text-gray-700">
                Carregando cadastros...
              </p>

              <p className="mt-1 text-sm text-gray-400">
                Aguarde um momento.
              </p>
            </div>
          ) : clientesVisiveis.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-12 text-center shadow-sm">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-3xl">
                🐾
              </div>

              <h3 className="mt-5 text-lg font-bold text-gray-800">
                {busca
                  ? "Nenhum cadastro encontrado"
                  : "Nenhum cliente cadastrado"}
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
                {busca
                  ? "Tente pesquisar pelo nome do tutor, nome do pet, telefone ou raça."
                  : "Cadastre o primeiro tutor e seus pets para começar a utilizar o sistema."}
              </p>

              {!busca && (
                <button
                  type="button"
                  onClick={abrirCadastro}
                  className="mt-6 rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
                >
                  + Cadastrar primeiro cliente
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                {clientesVisiveis.map((cliente) => (
                  <article
                    key={cliente.id}
                    className="group overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setClienteSelecionado(cliente)
                      }
                      className="w-full text-left"
                    >
                      {/* CLIENTE */}
                      <div className="p-5 md:p-6">
                        <div className="flex items-start gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gray-900 text-lg font-bold text-white">
                            {cliente.nome
                              .trim()
                              .charAt(0)
                              .toUpperCase() || "?"}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h3 className="truncate text-lg font-bold text-gray-900">
                                  {cliente.nome}
                                </h3>

                                <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
                                  <span>📱</span>
                                  <span className="truncate">
                                    {cliente.contato ||
                                      "Contato não informado"}
                                  </span>
                                </p>
                              </div>

                              <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                                {cliente.pets.length}{" "}
                                {cliente.pets.length === 1
                                  ? "pet"
                                  : "pets"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* PETS */}
                        {cliente.pets.length > 0 ? (
                          <div className="mt-5 space-y-3">
                            {cliente.pets.map((pet) => (
                              <div
                                key={pet.id}
                                className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4 transition group-hover:border-gray-200"
                              >
                                <div className="flex items-start gap-3">
                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-lg shadow-sm">
                                    🐶
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                      <div className="min-w-0">
                                        <p className="font-bold text-gray-800">
                                          {pet.nome}
                                        </p>

                                        <p className="mt-1 truncate text-xs text-gray-500">
                                          {pet.raca ||
                                            "Raça não informada"}
                                        </p>
                                      </div>

                                      <div className="flex flex-wrap gap-2 sm:justify-end">
                                        <span className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 shadow-sm">
                                          {pet.servicos.turno ===
                                          "Tarde"
                                            ? "🌤️ 13:30"
                                            : "☀️ 08:00"}
                                        </span>

                                        {pet.servicos
                                          .valorTotal && (
                                          <span className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-gray-800 shadow-sm">
                                            {formatarMoeda(
                                              pet.servicos
                                                .valorTotal
                                            )}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    <div className="mt-3 flex items-center gap-2">
                                      <span className="text-sm">
                                        🛁
                                      </span>

                                      <span className="text-sm font-medium text-gray-700">
                                        {pet.servicos
                                          .banhoTosa ||
                                          pet.servicos.tosas.concat(pet.servicos.adicionais).join(" + ") ||
                                          "Serviço não informado"}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-5 rounded-2xl border border-dashed border-gray-200 p-5 text-center">
                            <p className="text-sm text-gray-400">
                              Nenhum pet cadastrado.
                            </p>
                          </div>
                        )}
                      </div>
                    </button>

                    {/* AÇÕES */}
                    <div className="flex items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/50 px-5 py-4 md:px-6">
                      <span className="text-xs text-gray-400">
                        Clique no cadastro para visualizar
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          abrirEdicao(cliente)
                        }
                        className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
                      >
                        ✏️ Editar
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              {!busca && clientes.length > 5 && (
                <div className="mt-5 rounded-2xl border border-gray-200 bg-white px-5 py-4 text-center shadow-sm">
                  <p className="text-sm text-gray-500">
                    Existem{" "}
                    <strong className="text-gray-800">
                      {clientes.length - 5}
                    </strong>{" "}
                    outros cadastros.
                  </p>

                  <p className="mt-1 text-xs text-gray-400">
                    Use a busca acima para encontrar qualquer tutor ou pet.
                  </p>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {/* MODAL CADASTRO / EDIÇÃO */}
      {modalCadastro && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-950/50 p-3 backdrop-blur-sm md:p-6">
          <div className="mx-auto my-4 max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl md:my-8">

            <div className="border-b border-gray-100 bg-gray-50/80 px-5 py-5 md:px-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-900 text-base">
                      🐾
                    </span>

                    <span className="text-xs font-bold tracking-wide text-gray-500">
                      SPA PET AGROMINAS
                    </span>
                  </div>

                  <h2 className="mt-4 text-2xl font-bold text-gray-900">
                    {modoEdicao
                      ? "Editar cliente"
                      : "Novo cliente"}
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    {modoEdicao
                      ? "Atualize os dados do tutor e dos pets."
                      : "Cadastre o tutor e todos os pets vinculados."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={fecharCadastro}
                  disabled={salvando}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-400 transition hover:bg-white hover:text-gray-700 disabled:opacity-50"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-5 md:p-8">
              {/* TUTOR */}
              <section className="rounded-3xl border border-gray-200 bg-white p-5 md:p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
                    👤
                  </div>

                  <div>
                    <h3 className="font-bold text-gray-900">
                      Dados do tutor
                    </h3>

                    <p className="text-xs text-gray-500">
                      Informações de contato e endereço.
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold text-gray-700">
                      Nome do tutor *
                    </label>

                    <input
                      value={nomeCliente}
                      onChange={(e) =>
                        setNomeCliente(e.target.value)
                      }
                      placeholder="Nome completo"
                      className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-gray-400 focus:bg-white focus:ring-4 focus:ring-gray-100"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-700">
                      WhatsApp / Telefone *
                    </label>

                    <input
                      value={contato}
                      onChange={(e) =>
                        setContato(e.target.value)
                      }
                      placeholder="(00) 00000-0000"
                      className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-gray-400 focus:bg-white focus:ring-4 focus:ring-gray-100"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-700">
                      CEP
                    </label>

                    <input
                      value={cep}
                      maxLength={8}
                      onChange={(e) =>
                        buscarCep(e.target.value)
                      }
                      placeholder="00000000"
                      className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-gray-400 focus:bg-white focus:ring-4 focus:ring-gray-100"
                    />

                    {buscandoCep && (
                      <p className="mt-1.5 text-xs text-gray-400">
                        Buscando endereço...
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-700">
                      Rua
                    </label>

                    <input
                      value={endereco}
                      onChange={(e) =>
                        setEndereco(e.target.value)
                      }
                      placeholder="Rua"
                      className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-gray-400 focus:bg-white focus:ring-4 focus:ring-gray-100"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-700">
                      Número
                    </label>

                    <input
                      value={numero}
                      onChange={(e) =>
                        setNumero(e.target.value)
                      }
                      placeholder="Número"
                      className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-gray-400 focus:bg-white focus:ring-4 focus:ring-gray-100"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-700">
                      Bairro
                    </label>

                    <input
                      value={bairro}
                      onChange={(e) =>
                        setBairro(e.target.value)
                      }
                      placeholder="Bairro"
                      className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-gray-400 focus:bg-white focus:ring-4 focus:ring-gray-100"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="text-sm font-semibold text-gray-700">
                    Observações do tutor
                  </label>

                  <textarea
                    value={observacoesCliente}
                    onChange={(e) =>
                      setObservacoesCliente(e.target.value)
                    }
                    rows={3}
                    placeholder="Observações..."
                    className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-gray-400 focus:bg-white focus:ring-4 focus:ring-gray-100"
                  />
                </div>
              </section>

              {/* PETS */}
              <div className="mt-6 space-y-6">
                {pets.map((pet, index) => (
                  <section
                    key={pet.id}
                    className="rounded-3xl border border-gray-200 bg-white p-5 md:p-6"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-lg">
                          🐶
                        </div>

                        <div>
                          <h3 className="font-bold text-gray-900">
                            Pet {index + 1}
                          </h3>

                          <p className="text-xs text-gray-500">
                            Informações e programação do pet.
                          </p>
                        </div>
                      </div>

                      {pets.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            removerPet(pet.id)
                          }
                          className="rounded-xl px-3 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-50"
                        >
                          Remover
                        </button>
                      )}
                    </div>

                    {/* DADOS DO PET */}
                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="text-sm font-semibold text-gray-700">
                          Nome do pet *
                        </label>

                        <input
                          value={pet.nome}
                          onChange={(e) =>
                            atualizarPet(
                              pet.id,
                              "nome",
                              e.target.value
                            )
                          }
                          placeholder="Nome do pet"
                          className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-gray-400 focus:bg-white focus:ring-4 focus:ring-gray-100"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-semibold text-gray-700">
                          Raça
                        </label>

                        <input
                          list={`racas-${pet.id}`}
                          value={pet.raca}
                          onChange={(e) =>
                            atualizarPet(
                              pet.id,
                              "raca",
                              e.target.value
                            )
                          }
                          placeholder="Digite para pesquisar a raça..."
                          className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-gray-400 focus:bg-white focus:ring-4 focus:ring-gray-100"
                        />

                        <datalist id={`racas-${pet.id}`}>
                          {racas.map((raca) => (
                            <option
                              key={raca}
                              value={raca}
                            />
                          ))}
                        </datalist>
                      </div>

                      <div>
                        <label className="text-sm font-semibold text-gray-700">
                          Sexo
                        </label>

                        <select
                          value={pet.sexo}
                          onChange={(e) =>
                            atualizarPet(
                              pet.id,
                              "sexo",
                              e.target.value
                            )
                          }
                          className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-gray-400 focus:bg-white focus:ring-4 focus:ring-gray-100"
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
                        <label className="text-sm font-semibold text-gray-700">
                          Data de nascimento
                        </label>

                        <input
                          type="date"
                          value={pet.dataNascimento}
                          onChange={(e) =>
                            atualizarPet(
                              pet.id,
                              "dataNascimento",
                              e.target.value
                            )
                          }
                          className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-gray-400 focus:bg-white focus:ring-4 focus:ring-gray-100"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-semibold text-gray-700">
                          Peso
                        </label>

                        <input
                          type="number"
                          step="0.1"
                          value={pet.peso}
                          onChange={(e) =>
                            atualizarPet(
                              pet.id,
                              "peso",
                              e.target.value
                            )
                          }
                          placeholder="Ex.: 8,5"
                          className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-gray-400 focus:bg-white focus:ring-4 focus:ring-gray-100"
                        />
                      </div>
                    </div>

                    {/* SERVIÇO PRINCIPAL */}
                    <div className="mt-7 border-t border-gray-100 pt-7">
                      <h4 className="font-bold text-gray-900">
                        🛁 Banho e Tosa
                      </h4>

                      <p className="mt-1 text-sm text-gray-500">
                        Opcional: selecione Banho e Tosa ou escolha somente Tosas e/ou Adicionais abaixo.
                      </p>

                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        {opcoesBanhoTosa.map((opcao) => {
                          const selecionado =
                            pet.servicos.banhoTosa ===
                            opcao;

                          return (
                            <button
                              type="button"
                              key={opcao}
                              onClick={() =>
                                atualizarServico(
                                  pet.id,
                                  "banhoTosa",
                                  selecionado ? "" : opcao
                                )
                              }
                              className={`rounded-2xl border p-4 text-left transition ${
                                selecionado
                                  ? "border-gray-900 bg-gray-900 text-white shadow-sm"
                                  : "border-gray-200 bg-gray-50 hover:bg-white hover:shadow-sm"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-xl">
                                  {selecionado
                                    ? "☑"
                                    : "☐"}
                                </span>

                                <span className="text-sm font-semibold">
                                  {opcao}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* TOSAS */}
                    <div className="mt-7 border-t border-gray-100 pt-7">
                      <h4 className="font-bold text-gray-900">
                        ✂️ Tosas
                      </h4>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {opcoesTosas.map((opcao) => {
                          const selecionado =
                            pet.servicos.tosas.includes(
                              opcao
                            );

                          return (
                            <button
                              type="button"
                              key={opcao}
                              onClick={() =>
                                alternarListaServico(
                                  pet.id,
                                  "tosas",
                                  opcao
                                )
                              }
                              className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${
                                selecionado
                                  ? "border-gray-300 bg-gray-50"
                                  : "border-gray-200 hover:bg-gray-50"
                              }`}
                            >
                              <span className="text-xl">
                                {selecionado
                                  ? "☑"
                                  : "☐"}
                              </span>

                              <span className="text-sm font-semibold text-gray-700">
                                {opcao}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* ADICIONAIS */}
                    <div className="mt-7 border-t border-gray-100 pt-7">
                      <h4 className="font-bold text-gray-900">
                        ➕ Adicionais
                      </h4>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {opcoesAdicionais.map((opcao) => {
                          const selecionado =
                            pet.servicos.adicionais.includes(
                              opcao
                            );

                          return (
                            <button
                              type="button"
                              key={opcao}
                              onClick={() =>
                                alternarListaServico(
                                  pet.id,
                                  "adicionais",
                                  opcao
                                )
                              }
                              className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${
                                selecionado
                                  ? "border-gray-300 bg-gray-50"
                                  : "border-gray-200 hover:bg-gray-50"
                              }`}
                            >
                              <span className="text-xl">
                                {selecionado
                                  ? "☑"
                                  : "☐"}
                              </span>

                              <span className="text-sm font-semibold text-gray-700">
                                {opcao}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* FREQUÊNCIA */}
                    <div className="mt-7 border-t border-gray-100 pt-7">
                      <h4 className="font-bold text-gray-900">
                        🔄 Frequência e agenda
                      </h4>

                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        {[
                          "Avulso",
                          "Quinzenal",
                          "Mensal",
                        ].map((opcao) => {
                          const selecionado =
                            pet.servicos.frequencia ===
                            opcao;

                          return (
                            <button
                              type="button"
                              key={opcao}
                              onClick={() =>
                                atualizarServico(
                                  pet.id,
                                  "frequencia",
                                  opcao
                                )
                              }
                              className={`rounded-2xl border p-4 text-left transition ${
                                selecionado
                                  ? "border-gray-900 bg-gray-900 text-white"
                                  : "border-gray-200 bg-gray-50 hover:bg-white"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-xl">
                                  {selecionado
                                    ? "◉"
                                    : "○"}
                                </span>

                                <span className="text-sm font-semibold">
                                  {opcao}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-5">
                        <label className="text-sm font-semibold text-gray-700">
                          Primeiro banho *
                        </label>

                        <input
                          type="date"
                          value={
                            pet.servicos.dataInicio
                          }
                          onChange={(e) =>
                            atualizarServico(
                              pet.id,
                              "dataInicio",
                              e.target.value
                            )
                          }
                          className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-gray-400 focus:bg-white focus:ring-4 focus:ring-gray-100"
                        />
                      </div>

                      {/* TURNO */}
                      <div className="mt-5">
                        <label className="text-sm font-semibold text-gray-700">
                          Turno do banho *
                        </label>

                        <p className="mt-1 text-xs text-gray-400">
                          O pet será programado para o horário escolhido.
                        </p>

                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          {(["Manhã", "Tarde"] as Turno[]).map(
                            (opcao) => {
                              const selecionado =
                                pet.servicos.turno ===
                                opcao;

                              return (
                                <button
                                  type="button"
                                  key={opcao}
                                  onClick={() =>
                                    atualizarServico(
                                      pet.id,
                                      "turno",
                                      opcao
                                    )
                                  }
                                  className={`rounded-2xl border p-4 text-left transition ${
                                    selecionado
                                      ? "border-gray-900 bg-gray-900 text-white shadow-sm"
                                      : "border-gray-200 bg-gray-50 hover:bg-white"
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="font-bold">
                                        {opcao ===
                                        "Manhã"
                                          ? "☀️ Manhã"
                                          : "🌤️ Tarde"}
                                      </p>

                                      <p
                                        className={`mt-1 text-sm ${
                                          selecionado
                                            ? "text-gray-300"
                                            : "text-gray-500"
                                        }`}
                                      >
                                        {opcao ===
                                        "Manhã"
                                          ? "Atendimento às 08:00"
                                          : "Atendimento às 13:30"}
                                      </p>
                                    </div>

                                    <span className="text-xl">
                                      {selecionado
                                        ? "◉"
                                        : "○"}
                                    </span>
                                  </div>
                                </button>
                              );
                            }
                          )}
                        </div>

                        <p className="mt-3 rounded-xl bg-gray-50 px-4 py-3 text-xs text-gray-500">
                          {pet.servicos.frequencia ===
                            "Avulso" &&
                            "Será criado somente este agendamento."}

                          {pet.servicos.frequencia ===
                            "Quinzenal" &&
                            "O sistema criará automaticamente os banhos a cada 14 dias durante 12 meses."}

                          {pet.servicos.frequencia ===
                            "Mensal" &&
                            "O sistema criará automaticamente os banhos mensais durante 12 meses."}
                        </p>

                        {modoEdicao &&
                          !pet.id.startsWith("novo-") && (
                            <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-700">
                              ⚠️ Alterar a frequência, a data
                              ou o turno muda a configuração
                              habitual do pet, mas não altera
                              os agendamentos que já estão na
                              Agenda.
                            </p>
                          )}
                      </div>
                    </div>

                    {/* VALOR */}
                    <div className="mt-7 border-t border-gray-100 pt-7">
                      <h4 className="font-bold text-gray-900">
                        💰 Valor habitual
                      </h4>

                      <p className="mt-1 text-sm text-gray-500">
                        Informe o valor total habitual deste pet.
                      </p>

                      <div className="mt-4 max-w-sm">
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-gray-400">
                            R$
                          </span>

                          <input
                            type="text"
                            inputMode="decimal"
                            value={
                              pet.servicos.valorTotal
                            }
                            onChange={(e) =>
                              atualizarServico(
                                pet.id,
                                "valorTotal",
                                e.target.value.replace(
                                  /[^\d,]/g,
                                  ""
                                )
                              )
                            }
                            placeholder="0,00"
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-12 pr-4 text-lg font-bold outline-none transition focus:border-gray-400 focus:bg-white focus:ring-4 focus:ring-gray-100"
                          />
                        </div>

                        {pet.servicos.valorTotal && (
                          <p className="mt-2 text-sm text-gray-500">
                            Valor cadastrado:{" "}
                            <strong className="text-gray-800">
                              {formatarMoeda(
                                pet.servicos.valorTotal
                              )}
                            </strong>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* OBSERVAÇÕES */}
                    <div className="mt-7 border-t border-gray-100 pt-7">
                      <label className="text-sm font-semibold text-gray-700">
                        Observações do pet
                      </label>

                      <textarea
                        value={pet.observacoes}
                        onChange={(e) =>
                          atualizarPet(
                            pet.id,
                            "observacoes",
                            e.target.value
                          )
                        }
                        rows={3}
                        placeholder="Comportamento, cuidados especiais, observações..."
                        className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-gray-400 focus:bg-white focus:ring-4 focus:ring-gray-100"
                      />
                    </div>
                  </section>
                ))}
              </div>

              {/* ADICIONAR PET */}
              <button
                type="button"
                onClick={adicionarPet}
                className="mt-6 w-full rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-4 text-sm font-semibold text-gray-700 transition hover:bg-white"
              >
                + Adicionar outro pet
              </button>

              {/* BOTÕES */}
              <div className="mt-8 flex flex-col-reverse gap-3 border-t border-gray-100 pt-6 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={fecharCadastro}
                  disabled={salvando}
                  className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={salvarCliente}
                  disabled={salvando}
                  className="rounded-xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {salvando
                    ? modoEdicao
                      ? "Salvando alterações..."
                      : "Salvando e criando agenda..."
                    : modoEdicao
                    ? "Salvar alterações"
                    : "Salvar cliente"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALHES */}
      {clienteSelecionado && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-950/50 p-3 backdrop-blur-sm md:p-6">
          <div className="mx-auto my-4 max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl md:my-8">

            {/* CABEÇALHO */}
            <div className="border-b border-gray-100 bg-gray-50/80 px-5 py-6 md:px-8">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gray-900 text-xl font-bold text-white">
                  {clienteSelecionado.nome
                    .trim()
                    .charAt(0)
                    .toUpperCase() || "?"}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    Cliente cadastrado
                  </p>

                  <h2 className="mt-1 truncate text-2xl font-bold text-gray-900">
                    {clienteSelecionado.nome}
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    📱{" "}
                    {clienteSelecionado.contato ||
                      "Contato não informado"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setClienteSelecionado(null)
                  }
                  disabled={excluindo}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-400 transition hover:bg-white hover:text-gray-700 disabled:opacity-50"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-5 md:p-8">
              {/* DADOS DO TUTOR */}
              <section>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
                    👤
                  </div>

                  <div>
                    <h3 className="font-bold text-gray-900">
                      Dados do tutor
                    </h3>

                    <p className="text-xs text-gray-500">
                      Informações cadastradas.
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {[
                    [
                      "Nome",
                      clienteSelecionado.nome,
                    ],
                    [
                      "WhatsApp / Telefone",
                      clienteSelecionado.contato ||
                        "Não informado",
                    ],
                    [
                      "CEP",
                      clienteSelecionado.cep ||
                        "Não informado",
                    ],
                    [
                      "Rua",
                      clienteSelecionado.endereco ||
                        "Não informado",
                    ],
                    [
                      "Número",
                      clienteSelecionado.numero ||
                        "Não informado",
                    ],
                    [
                      "Bairro",
                      clienteSelecionado.bairro ||
                        "Não informado",
                    ],
                  ].map(([label, valor]) => (
                    <div
                      key={label}
                      className="rounded-2xl bg-gray-50 p-4"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        {label}
                      </p>

                      <p className="mt-1 text-sm font-medium text-gray-800">
                        {valor}
                      </p>
                    </div>
                  ))}
                </div>

                {clienteSelecionado.observacoes && (
                  <div className="mt-3 rounded-2xl bg-gray-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Observações
                    </p>

                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                      {clienteSelecionado.observacoes}
                    </p>
                  </div>
                )}
              </section>

              {/* PETS */}
              <section className="mt-8 border-t border-gray-100 pt-8">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
                      🐶
                    </div>

                    <div>
                      <h3 className="font-bold text-gray-900">
                        Pets
                      </h3>

                      <p className="text-xs text-gray-500">
                        Pets vinculados a este tutor.
                      </p>
                    </div>
                  </div>

                  <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-600">
                    {clienteSelecionado.pets.length}{" "}
                    {clienteSelecionado.pets.length === 1
                      ? "pet"
                      : "pets"}
                  </span>
                </div>

                {clienteSelecionado.pets.length === 0 ? (
                  <div className="mt-5 rounded-2xl border border-dashed border-gray-300 p-8 text-center">
                    <p className="text-sm text-gray-500">
                      Nenhum pet cadastrado para este tutor.
                    </p>
                  </div>
                ) : (
                  <div className="mt-5 space-y-5">
                    {clienteSelecionado.pets.map(
                      (pet, index) => (
                        <div
                          key={pet.id}
                          className="rounded-3xl border border-gray-200 p-5 md:p-6"
                        >
                          <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-xl">
                              🐶
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                                Pet {index + 1}
                              </p>

                              <h4 className="mt-1 text-xl font-bold text-gray-900">
                                {pet.nome}
                              </h4>

                              <p className="mt-1 text-sm text-gray-500">
                                {pet.raca ||
                                  "Raça não informada"}
                              </p>
                            </div>

                            <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600">
                              {pet.servicos.frequencia ||
                                "Avulso"}
                            </span>
                          </div>

                          {/* RESUMO */}
                          <div className="mt-5 grid gap-3 md:grid-cols-3">
                            <div className="rounded-2xl bg-gray-50 p-4">
                              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                                Serviço
                              </p>

                              <p className="mt-1 text-sm font-bold text-gray-800">
                                {pet.servicos.banhoTosa ||
                                  "Não informado"}
                              </p>
                            </div>

                            <div className="rounded-2xl bg-gray-50 p-4">
                              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                                Horário
                              </p>

                              <p className="mt-1 text-sm font-bold text-gray-800">
                                {pet.servicos.turno ===
                                "Tarde"
                                  ? "🌤️ Tarde — 13:30"
                                  : "☀️ Manhã — 08:00"}
                              </p>
                            </div>

                            <div className="rounded-2xl bg-gray-50 p-4">
                              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                                Valor
                              </p>

                              <p className="mt-1 text-sm font-bold text-gray-800">
                                {pet.servicos.valorTotal
                                  ? formatarMoeda(
                                      pet.servicos.valorTotal
                                    )
                                  : "Não informado"}
                              </p>
                            </div>
                          </div>

                          {/* DADOS */}
                          <div className="mt-5 grid gap-3 border-t border-gray-100 pt-5 md:grid-cols-2">
                            <p className="text-sm text-gray-600">
                              <strong className="text-gray-800">
                                Raça:
                              </strong>{" "}
                              {pet.raca ||
                                "Não informado"}
                            </p>

                            <p className="text-sm text-gray-600">
                              <strong className="text-gray-800">
                                Sexo:
                              </strong>{" "}
                              {pet.sexo ||
                                "Não informado"}
                            </p>

                            <p className="text-sm text-gray-600">
                              <strong className="text-gray-800">
                                Data de nascimento:
                              </strong>{" "}
                              {pet.dataNascimento
                                ? new Date(
                                    `${pet.dataNascimento}T00:00:00`
                                  ).toLocaleDateString(
                                    "pt-BR"
                                  )
                                : "Não informado"}
                            </p>

                            <p className="text-sm text-gray-600">
                              <strong className="text-gray-800">
                                Peso:
                              </strong>{" "}
                              {pet.peso
                                ? `${pet.peso} kg`
                                : "Não informado"}
                            </p>

                            <p className="text-sm text-gray-600">
                              <strong className="text-gray-800">
                                Primeiro banho:
                              </strong>{" "}
                              {pet.servicos.dataInicio
                                ? new Date(
                                    `${pet.servicos.dataInicio}T00:00:00`
                                  ).toLocaleDateString(
                                    "pt-BR"
                                  )
                                : "Não informado"}
                            </p>
                          </div>

                          {/* TOSAS */}
                          {pet.servicos.tosas.length >
                            0 && (
                            <div className="mt-5 border-t border-gray-100 pt-5">
                              <p className="text-sm font-bold text-gray-700">
                                ✂️ Tosas
                              </p>

                              <div className="mt-2 flex flex-wrap gap-2">
                                {pet.servicos.tosas.map(
                                  (tosa) => (
                                    <span
                                      key={tosa}
                                      className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600"
                                    >
                                      {tosa}
                                    </span>
                                  )
                                )}
                              </div>
                            </div>
                          )}

                          {/* ADICIONAIS */}
                          {pet.servicos.adicionais.length >
                            0 && (
                            <div className="mt-5">
                              <p className="text-sm font-bold text-gray-700">
                                ➕ Adicionais
                              </p>

                              <div className="mt-2 flex flex-wrap gap-2">
                                {pet.servicos.adicionais.map(
                                  (adicional) => (
                                    <span
                                      key={adicional}
                                      className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600"
                                    >
                                      {adicional}
                                    </span>
                                  )
                                )}
                              </div>
                            </div>
                          )}

                          {/* PROGRAMAÇÃO */}
                          <div className="mt-5 rounded-2xl bg-gray-50 p-4">
                            <p className="text-sm font-bold text-gray-700">
                              🔄 Programação
                            </p>

                            <p className="mt-2 text-sm text-gray-600">
                              {pet.servicos.frequencia ===
                                "Avulso" &&
                                "Agendamento único."}

                              {pet.servicos.frequencia ===
                                "Quinzenal" &&
                                "Banho a cada 14 dias durante 12 meses."}

                              {pet.servicos.frequencia ===
                                "Mensal" &&
                                "Banho mensal durante 12 meses."}
                            </p>
                          </div>

                          {/* OBSERVAÇÕES */}
                          {pet.observacoes && (
                            <div className="mt-5 rounded-2xl border border-gray-100 bg-white p-4">
                              <p className="text-sm font-bold text-gray-700">
                                Observações
                              </p>

                              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">
                                {pet.observacoes}
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                )}
              </section>

              {/* AÇÕES */}
              <div className="mt-8 flex flex-col gap-3 border-t border-gray-100 pt-6 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() =>
                    abrirEdicao(clienteSelecionado)
                  }
                  disabled={excluindo}
                  className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  ✏️ Editar cadastro
                </button>

                <button
                  type="button"
                  onClick={() =>
                    excluirCliente(
                      clienteSelecionado
                    )
                  }
                  disabled={excluindo}
                  className="rounded-xl border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {excluindo
                    ? "Excluindo..."
                    : "🗑️ Excluir cadastro"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setClienteSelecionado(null)
                  }
                  disabled={excluindo}
                  className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
