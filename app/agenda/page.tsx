"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import MenuLateral from "@/app/components/MenuLateral";

type Turno = "Manhã" | "Tarde";

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
  if (!data) {
    return "";
  }

  const partes = data.split("-");

  if (partes.length !== 3) {
    return data;
  }

  return partes[2] + "/" + partes[1] + "/" + partes[0];
}

function obterDataLocal() {
  const hoje = new Date();

  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");

  return ano + "-" + mes + "-" + dia;
}

function formatarValor(valor: number | null) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function normalizarTelefone(numero: string) {
  return numero.replace(/\D/g, "");
}

const NOME_JANELA_WHATSAPP =
  "SPA_PET_AGROMINAS_WHATSAPP";

let janelaWhatsApp: Window | null = null;

function obterArtigoPet(sexo: string | null) {
  const sexoNormalizado = (sexo || "")
    .toLowerCase()
    .trim();

  return sexoNormalizado === "fêmea" ||
    sexoNormalizado === "femea"
    ? "a"
    : "o";
}

/* =========================================================
   IDENTIFICAÇÃO DO BANHO
   ========================================================= */

function obterIdentificacaoBanho(
  agendamento: Agendamento
) {
  if (!agendamento.numero_banho) {
    return "";
  }

  const numero = agendamento.numero_banho;

  const ordinal = `${numero}º`;

  const plano = agendamento.plano
    ? ` • ${agendamento.plano}`
    : "";

  const ciclo =
    agendamento.ciclo &&
    agendamento.ciclo > 1
      ? ` • Ciclo ${agendamento.ciclo}`
      : "";

  return `${ordinal} banho${plano}${ciclo}`;
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
    alert("Este tutor não possui WhatsApp cadastrado.");
    return;
  }

  const artigo = obterArtigoPet(sexo);

  const petComArtigo =
    artigo === "a"
      ? `a ${petNome}`
      : `o ${petNome}`;

  const dataFormatada = formatarDataLocal(data);

  let mensagem = "";

  if (tipo === "lembrete") {
    mensagem =
      `🐾 Olá, ${tutorNome}! Tudo bem?\n\n` +
      `Aqui é do SPA PET AGROMINAS. 💚\n\n` +
      `Passando para lembrar do agendamento para ${petComArtigo} conosco. 🐶🐾\n\n` +
      `📅 Data: ${dataFormatada}\n` +
      `🕐 Horário: ${horario}\n` +
      `✂️ Serviço: ${servicoNome}\n\n` +
      `Esperamos vocês! 😊\n\n` +
      `Caso precise remarcar ou tenha alguma dúvida, estamos à disposição. 💚`;
  } else {
    mensagem =
      `🐾 Olá, ${tutorNome}! Tudo bem?\n\n` +
      `Aqui é do SPA PET AGROMINAS. 💚\n\n` +
      `✨ ${petComArtigo} já está prontinh${artigo === "a" ? "a" : "o"}!\n\n` +
      `✂️ Serviço: ${servicoNome}\n\n` +
      `O atendimento foi concluído e seu pet já está disponível para retirada. 🐶💚\n\n` +
      `Quando puder, pode passar para buscá-lo. 😊\n\n` +
      `Agradecemos a preferência! 🐾`;
  }

  const url =
    "https://web.whatsapp.com/send/?phone=55" +
    telefone +
    "&text=" +
    encodeURIComponent(mensagem);

  if (
    janelaWhatsApp &&
    !janelaWhatsApp.closed
  ) {
    janelaWhatsApp.location.href = url;
    janelaWhatsApp.focus();
    return;
  }

  janelaWhatsApp = window.open(
    url,
    NOME_JANELA_WHATSAPP
  );

  if (!janelaWhatsApp) {
    alert(
      "O Chrome bloqueou a abertura do WhatsApp. Permita pop-ups para o SPA PET AGROMINAS."
    );
  }
}

function abrirWhatsAppGrupo(
  numero: string,
  tutorNome: string,
  data: string,
  horario: string,
  itens: Array<{
    petNome: string;
    servicoNome: string;
    sexo: string | null;
  }>
) {
  const telefone = normalizarTelefone(numero);

  if (!telefone) {
    alert("Este tutor não possui WhatsApp cadastrado.");
    return;
  }

  const dataFormatada = formatarDataLocal(data);

  const listaPets = itens
    .map(function (item) {
      return (
        `🐾 ${item.petNome}\n` +
        `   ✂️ ${item.servicoNome}`
      );
    })
    .join("\n\n");

  const mensagem =
    `🐾 Olá, ${tutorNome}! Tudo bem?\n\n` +
    `Aqui é do SPA PET AGROMINAS. 💚\n\n` +
    `Passando para lembrar dos agendamentos dos seus pets conosco. 🐶🐾\n\n` +
    `📅 Data: ${dataFormatada}\n` +
    `🕐 Horário: ${horario}\n\n` +
    `${listaPets}\n\n` +
    `Esperamos vocês! 😊\n\n` +
    `Caso precise remarcar ou tenha alguma dúvida, estamos à disposição. 💚`;

  const url =
    "https://web.whatsapp.com/send/?phone=55" +
    telefone +
    "&text=" +
    encodeURIComponent(mensagem);

  if (
    janelaWhatsApp &&
    !janelaWhatsApp.closed
  ) {
    janelaWhatsApp.location.href = url;
    janelaWhatsApp.focus();
    return;
  }

  janelaWhatsApp = window.open(
    url,
    NOME_JANELA_WHATSAPP
  );

  if (!janelaWhatsApp) {
    alert(
      "O Chrome bloqueou a abertura do WhatsApp. Permita pop-ups para o SPA PET AGROMINAS."
    );
  }
}

/* =========================================================
   IMPRESSÃO INDIVIDUAL
   ========================================================= */

function imprimirComprovante(
  agendamento: Agendamento,
  pet: Pet | undefined,
  servicoNome: string
) {
  const petNome =
    agendamento.petNome ||
    pet?.nome ||
    "Pet";

  const tutorNome =
    agendamento.tutorNome ||
    pet?.tutorNome ||
    "Tutor";

  const data =
    formatarDataLocal(
      agendamento.data
    );

  const horario =
    agendamento.horario ||
    "08:00";

  const valor =
    formatarValor(
      agendamento.valor_total
    );

  const identificacaoBanho =
    obterIdentificacaoBanho(
      agendamento
    );

  const servicosRealizados =
    agendamento.observacoes
      ? agendamento.observacoes
          .split("|")
          .map(function (item) {
            return item.trim();
          })
          .filter(function (item) {
            return item.length > 0;
          })
      : [];

  const listaServicos =
    servicosRealizados.length > 0
      ? servicosRealizados
      : [servicoNome];

  const servicosHtml =
    listaServicos
      .map(function (servico) {
        return (
          '<div class="servico-item">' +
          '<span class="servico-bolinha">•</span>' +
          "<span>" +
          servico +
          "</span>" +
          "</div>"
        );
      })
      .join("");

  const janela = window.open(
    "",
    "_blank",
    "width=500,height=700"
  );

  if (!janela) {
    alert(
      "Não foi possível abrir a impressão. Verifique se o navegador bloqueou a janela."
    );
    return;
  }

  janela.document.write(`
<!DOCTYPE html>
<html lang="pt-BR">

<head>

  <meta charset="UTF-8" />

  <title>Comprovante - ${petNome}</title>

  <style>

    @page {
      size: 80mm auto;
      margin: 0;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      width: 80mm;
      background: #ffffff;
      color: #111111;
      font-family:
        Arial,
        Helvetica,
        sans-serif;
    }

    body {
      padding:
        3mm
        5mm
        8mm
        5mm;
    }

    .comprovante {
      width: 100%;
    }

    .cabecalho {
      text-align: center;
      margin-bottom: 6px;
    }

    .icone {
      font-size: 23px;
      line-height: 1;
      margin-bottom: 4px;
    }

    .nome {
      font-size: 19px;
      font-weight: 900;
      letter-spacing: 0.4px;
      line-height: 1.1;
    }

    .subtitulo {
      margin-top: 3px;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 1.8px;
    }

    .linha {
      border-top:
        1px dashed #444444;
      margin:
        8px 0;
    }

    .titulo {
      text-align: center;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.8px;
      margin:
        6px 0;
    }

    .informacoes {
      margin-top: 3px;
    }

    .campo {
      margin:
        7px 0;
      font-size: 11px;
      line-height: 1.35;
      font-weight: 700;
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    .campo-label {
      font-weight: 800;
    }

    .campo-valor {
      font-weight: 700;
    }

    .banho-box {
      margin-top: 9px;
      padding:
        7px
        8px;
      border:
        1px solid #d0d0d0;
      border-radius: 5px;
      text-align: center;
      background: #f7f7f7;
    }

    .banho-label {
      font-size: 8px;
      font-weight: 800;
      letter-spacing: 0.8px;
      margin-bottom: 3px;
    }

    .banho-valor {
      font-size: 12px;
      font-weight: 900;
    }

    .servicos-box {
      margin-top: 9px;
      padding:
        8px
        8px
        7px
        8px;
      border:
        1px solid #d0d0d0;
      border-radius: 5px;
    }

    .servicos-titulo {
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 0.8px;
      margin-bottom: 5px;
    }

    .servico-item {
      display: flex;
      gap: 5px;
      font-size: 10px;
      line-height: 1.4;
      font-weight: 700;
      margin: 2px 0;
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    .servico-bolinha {
      font-weight: 900;
    }

    .valor-box {
      margin-top: 11px;
      border:
        1.5px solid #111111;
      border-radius: 5px;
      padding:
        8px
        6px
        9px
        6px;
      text-align: center;
    }

    .valor-label {
      font-size: 8px;
      font-weight: 800;
      letter-spacing: 1.2px;
      margin-bottom: 3px;
    }

    .valor {
      font-size: 22px;
      font-weight: 900;
      line-height: 1.1;
    }

    .status {
      margin-top: 8px;
      text-align: center;
      font-size: 8px;
      font-weight: 800;
      letter-spacing: 0.8px;
    }

    .rodape {
      margin-top: 14px;
      padding-top: 8px;
      border-top:
        1px dashed #444444;
      text-align: center;
      font-size: 8px;
      line-height: 1.5;
      color: #444444;
    }

    .agradecimento {
      font-weight: 800;
      color: #111111;
      margin-bottom: 2px;
    }

    @media print {

      html,
      body {
        width: 80mm;
      }

      body {
        padding:
          3mm
          5mm
          8mm
          5mm;
      }

    }

  </style>

</head>

<body>

  <div class="comprovante">

    <div class="cabecalho">

      <div class="icone">
        🐾
      </div>

      <div class="nome">
        SPA PET AGROMINAS
      </div>

      <div class="subtitulo">
        BANHO E TOSA
      </div>

    </div>

    <div class="linha"></div>

    <div class="titulo">
      COMPROVANTE DE ATENDIMENTO
    </div>

    <div class="linha"></div>

    <div class="informacoes">

      <div class="campo">
        <span class="campo-label">
          PET -
        </span>

        <span class="campo-valor">
          ${petNome}
        </span>
      </div>

      <div class="campo">
        <span class="campo-label">
          TUTOR -
        </span>

        <span class="campo-valor">
          ${tutorNome}
        </span>
      </div>

      <div class="campo">
        <span class="campo-label">
          DATA -
        </span>

        <span class="campo-valor">
          ${data}
        </span>
      </div>

      <div class="campo">
        <span class="campo-label">
          HORÁRIO -
        </span>

        <span class="campo-valor">
          ${horario}
        </span>
      </div>

    </div>

    ${
      identificacaoBanho
        ? `
    <div class="banho-box">

      <div class="banho-label">
        PLANO / BANHO
      </div>

      <div class="banho-valor">
        ${identificacaoBanho}
      </div>

    </div>
    `
        : ""
    }

    <div class="servicos-box">

      <div class="servicos-titulo">
        SERVIÇOS REALIZADOS
      </div>

      ${servicosHtml}

    </div>

    <div class="valor-box">

      <div class="valor-label">
        VALOR A COBRAR
      </div>

      <div class="valor">
        ${valor}
      </div>

    </div>

    <div class="status">
      AGUARDANDO PAGAMENTO
    </div>

    <div class="rodape">

      <div class="agradecimento">
        🐾 Obrigado pela preferência!
      </div>

      <div>
        SPA PET AGROMINAS
      </div>

    </div>

  </div>

  <script>

    window.onload = function () {
      window.focus();
      window.print();
    };

    window.onafterprint = function () {
      window.close();
    };

  </script>

</body>

</html>
  `);

  janela.document.close();
}

/* =========================================================
   IMPRESSÃO DE TODOS OS PETS DO MESMO TUTOR
   ========================================================= */

function imprimirComprovanteGrupo(
  grupo: {
    tutorNome: string;
    horario: string;
    data: string;
    agendamentos: Agendamento[];
  },
  pets: Pet[],
  obterNomeServico: (
    agendamento: Agendamento
  ) => string
) {
  const tutorNome =
    grupo.tutorNome ||
    "Tutor";

  const data =
    formatarDataLocal(
      grupo.data
    );

  const horario =
    grupo.horario ||
    "08:00";

  const total =
    grupo.agendamentos.reduce(
      function (
        soma,
        agendamento
      ) {
        return (
          soma +
          Number(
            agendamento.valor_total ||
              0
          )
        );
      },
      0
    );

  const petsHtml =
    grupo.agendamentos
      .map(function (agendamento) {
        const pet =
          pets.find(function (item) {
            return (
              item.id ===
              agendamento.pet_id
            );
          });

        const petNome =
          agendamento.petNome ||
          pet?.nome ||
          "Pet";

        const servicoNome =
          obterNomeServico(
            agendamento
          );

        const valor =
          formatarValor(
            agendamento.valor_total
          );

        const identificacaoBanho =
          obterIdentificacaoBanho(
            agendamento
          );

        const servicosRealizados =
          agendamento.observacoes
            ? agendamento.observacoes
                .split("|")
                .map(function (item) {
                  return item.trim();
                })
                .filter(function (item) {
                  return item.length > 0;
                })
            : [];

        const listaServicos =
          servicosRealizados.length >
          0
            ? servicosRealizados
            : [servicoNome];

        const servicosHtml =
          listaServicos
            .map(function (servico) {
              return (
                '<div class="servico-item">' +
                '<span class="servico-bolinha">•</span>' +
                "<span>" +
                servico +
                "</span>" +
                "</div>"
              );
            })
            .join("");

        return `
          <div class="pet-box">

            <div class="pet-cabecalho">

              <div class="pet-nome">
                🐾 ${petNome}
              </div>

              <div class="pet-valor">
                ${valor}
              </div>

            </div>

            ${
              identificacaoBanho
                ? `
            <div class="banho">
              🛁 ${identificacaoBanho}
            </div>
            `
                : ""
            }

            <div class="servicos-titulo">
              SERVIÇO
            </div>

            ${servicosHtml}

          </div>
        `;
      })
      .join("");

  const quantidadePets =
    grupo.agendamentos.length;

  const janela = window.open(
    "",
    "_blank",
    "width=500,height=800"
  );

  if (!janela) {
    alert(
      "Não foi possível abrir a impressão. Verifique se o navegador bloqueou a janela."
    );
    return;
  }

  janela.document.write(`
<!DOCTYPE html>
<html lang="pt-BR">

<head>

  <meta charset="UTF-8" />

  <title>
    Comprovante - ${tutorNome}
  </title>

  <style>

    @page {
      size: 80mm auto;
      margin: 0;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      width: 80mm;
      background: #ffffff;
      color: #111111;
      font-family:
        Arial,
        Helvetica,
        sans-serif;
    }

    body {
      padding:
        3mm
        5mm
        8mm
        5mm;
    }

    .comprovante {
      width: 100%;
    }

    .cabecalho {
      text-align: center;
      margin-bottom: 6px;
    }

    .icone {
      font-size: 23px;
      line-height: 1;
      margin-bottom: 4px;
    }

    .nome {
      font-size: 19px;
      font-weight: 900;
      letter-spacing: 0.4px;
      line-height: 1.1;
    }

    .subtitulo {
      margin-top: 3px;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 1.8px;
    }

    .linha {
      border-top:
        1px dashed #444444;
      margin:
        8px 0;
    }

    .titulo {
      text-align: center;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.8px;
      margin:
        6px 0;
    }

    .informacoes {
      margin-top: 3px;
    }

    .campo {
      margin:
        7px 0;
      font-size: 11px;
      line-height: 1.35;
      font-weight: 700;
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    .campo-label {
      font-weight: 800;
    }

    .campo-valor {
      font-weight: 700;
    }

    .quantidade {
      margin-top: 8px;
      text-align: center;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.5px;
    }

    .pet-box {
      margin-top: 10px;
      padding:
        8px
        8px
        9px
        8px;
      border:
        1px solid #d0d0d0;
      border-radius: 5px;
      page-break-inside: avoid;
    }

    .pet-cabecalho {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 6px;
    }

    .pet-nome {
      font-size: 12px;
      font-weight: 900;
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    .pet-valor {
      font-size: 11px;
      font-weight: 900;
      white-space: nowrap;
    }

    .banho {
      margin:
        2px 0
        7px 0;
      font-size: 10px;
      font-weight: 900;
    }

    .servicos-titulo {
      font-size: 8px;
      font-weight: 900;
      letter-spacing: 0.8px;
      margin-bottom: 4px;
    }

    .servico-item {
      display: flex;
      gap: 5px;
      font-size: 10px;
      line-height: 1.4;
      font-weight: 700;
      margin: 2px 0;
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    .servico-bolinha {
      font-weight: 900;
    }

    .valor-box {
      margin-top: 12px;
      border:
        1.5px solid #111111;
      border-radius: 5px;
      padding:
        8px
        6px
        9px
        6px;
      text-align: center;
    }

    .valor-label {
      font-size: 8px;
      font-weight: 800;
      letter-spacing: 1.2px;
      margin-bottom: 3px;
    }

    .valor {
      font-size: 22px;
      font-weight: 900;
      line-height: 1.1;
    }

    .status {
      margin-top: 8px;
      text-align: center;
      font-size: 8px;
      font-weight: 800;
      letter-spacing: 0.8px;
    }

    .rodape {
      margin-top: 14px;
      padding-top: 8px;
      border-top:
        1px dashed #444444;
      text-align: center;
      font-size: 8px;
      line-height: 1.5;
      color: #444444;
    }

    .agradecimento {
      font-weight: 800;
      color: #111111;
      margin-bottom: 2px;
    }

    @media print {

      html,
      body {
        width: 80mm;
      }

      body {
        padding:
          3mm
          5mm
          8mm
          5mm;
      }

    }

  </style>

</head>

<body>

  <div class="comprovante">

    <div class="cabecalho">

      <div class="icone">
        🐾
      </div>

      <div class="nome">
        SPA PET AGROMINAS
      </div>

      <div class="subtitulo">
        BANHO E TOSA
      </div>

    </div>

    <div class="linha"></div>

    <div class="titulo">
      COMPROVANTE DE ATENDIMENTO
    </div>

    <div class="linha"></div>

    <div class="informacoes">

      <div class="campo">
        <span class="campo-label">
          TUTOR -
        </span>

        <span class="campo-valor">
          ${tutorNome}
        </span>
      </div>

      <div class="campo">
        <span class="campo-label">
          DATA -
        </span>

        <span class="campo-valor">
          ${data}
        </span>
      </div>

      <div class="campo">
        <span class="campo-label">
          HORÁRIO -
        </span>

        <span class="campo-valor">
          ${horario}
        </span>
      </div>

    </div>

    <div class="quantidade">

      ${quantidadePets}
      ${
        quantidadePets === 1
          ? "PET AGENDADO"
          : "PETS AGENDADOS"
      }

    </div>

    ${petsHtml}

    <div class="valor-box">

      <div class="valor-label">
        VALOR TOTAL
      </div>

      <div class="valor">
        ${formatarValor(total)}
      </div>

    </div>

    <div class="status">
      AGUARDANDO PAGAMENTO
    </div>

    <div class="rodape">

      <div class="agradecimento">
        🐾 Obrigado pela preferência!
      </div>

      <div>
        SPA PET AGROMINAS
      </div>

    </div>

  </div>

  <script>

    window.onload = function () {
      window.focus();
      window.print();
    };

    window.onafterprint = function () {
      window.close();
    };

  </script>

</body>

</html>
  `);

  janela.document.close();
}

export default function AgendaPage() {
  const [clientes, setClientes] =
    useState<Cliente[]>([]);

  const [pets, setPets] =
    useState<Pet[]>([]);

  const [servicos, setServicos] =
    useState<Servico[]>([]);

  const [agendamentos, setAgendamentos] =
    useState<Agendamento[]>([]);

  const [atendimentos, setAtendimentos] =
    useState<Atendimento[]>([]);

  const [carregando, setCarregando] =
    useState(true);

  const [mesAtual, setMesAtual] =
    useState(new Date());

  const [dataSelecionada, setDataSelecionada] =
    useState(obterDataLocal());

  const [modalAgendamento, setModalAgendamento] =
    useState(false);

  const [modalAtendimento, setModalAtendimento] =
    useState(false);

  const [modalPagamento, setModalPagamento] =
    useState(false);

  const [agendamentoSelecionado, setAgendamentoSelecionado] =
    useState<Agendamento | null>(null);

  const [petSelecionado, setPetSelecionado] =
    useState("");

  const [servicoSelecionado, setServicoSelecionado] =
    useState("");

  const [dataAgendamento, setDataAgendamento] =
    useState("");

  const [horarioAgendamento, setHorarioAgendamento] =
    useState("08:00");

  const [observacoes, setObservacoes] =
    useState("");

  const [valorAgendamento, setValorAgendamento] =
    useState("");

  const [valorAtendimento, setValorAtendimento] =
    useState("");

  const [formaPagamento, setFormaPagamento] =
    useState("");

  const [salvando, setSalvando] =
    useState(false);

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    setCarregando(true);

    const [
      respostaClientes,
      respostaPets,
      respostaServicos,
      respostaAgendamentos,
      respostaAtendimentos,
    ] = await Promise.all([
      supabase
        .from("clientes")
        .select(
          "id, nome, whatsapp, telefone"
        )
        .order("nome"),

      supabase
        .from("pets")
        .select(
          "id, nome, cliente_id, sexo"
        )
        .order("nome"),

      supabase
        .from("servicos")
        .select(
          "id, nome, preco, duracao_minutos"
        )
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
        .select(
          "id, agendamento_id, pet_id, data, valor, forma_pagamento"
        )
        .order("data", {
          ascending: false,
        }),
    ]);

    if (respostaClientes.error) {
      console.error(
        respostaClientes.error
      );
    }

    if (respostaPets.error) {
      console.error(
        respostaPets.error
      );
    }

    if (respostaServicos.error) {
      console.error(
        respostaServicos.error
      );
    }

    if (respostaAgendamentos.error) {
      console.error(
        respostaAgendamentos.error
      );
    }

    if (respostaAtendimentos.error) {
      console.error(
        respostaAtendimentos.error
      );
    }

    const clientesData =
      (respostaClientes.data ||
        []) as Cliente[];

    const petsData = (
      (respostaPets.data ||
        []) as Pet[]
    ).map(function (pet) {
      const cliente =
        clientesData.find(
          function (item) {
            return (
              item.id ===
              pet.cliente_id
            );
          }
        );

      const contato =
        cliente?.whatsapp ||
        cliente?.telefone ||
        "";

      return {
        ...pet,
        tutorNome:
          cliente?.nome ||
          "Tutor",
        whatsapp: contato,
      };
    });

    const agendamentosData =
      (respostaAgendamentos.data ||
        []) as Agendamento[];

    const agendamentosComDados =
      agendamentosData.map(
        function (agendamento) {
          const pet =
            petsData.find(
              function (item) {
                return (
                  item.id ===
                  agendamento.pet_id
                );
              }
            );

          return {
            ...agendamento,
            petNome:
              pet?.nome ||
              "Pet",
            tutorNome:
              pet?.tutorNome ||
              "Tutor",
            whatsapp:
              pet?.whatsapp ||
              "",
          };
        }
      );

    setClientes(clientesData);

    setPets(petsData);

    setServicos(
      (respostaServicos.data ||
        []) as Servico[]
    );

    setAgendamentos(
      agendamentosComDados
    );

    setAtendimentos(
      (respostaAtendimentos.data ||
        []) as Atendimento[]
    );

    setCarregando(false);
  }

  function obterNomeServico(
    agendamento: Agendamento
  ) {
    if (
      agendamento.servico_nome
    ) {
      return agendamento.servico_nome;
    }

    const servico =
      servicos.find(
        function (item) {
          return (
            item.id ===
            agendamento.servico_id
          );
        }
      );

    return (
      servico?.nome ||
      "Banho e tosa"
    );
  }

  function obterTurno(
    horario: string | null
  ): Turno {
    if (!horario) {
      return "Manhã";
    }

    return horario < "13:30"
      ? "Manhã"
      : "Tarde";
  }

  function abrirNovoAgendamento(
    data?: string
  ) {
    setAgendamentoSelecionado(null);
    setPetSelecionado("");
    setServicoSelecionado("");

    setDataAgendamento(
      data ||
        dataSelecionada
    );

    setHorarioAgendamento(
      "08:00"
    );

    setObservacoes("");
    setValorAgendamento("");

    setModalAgendamento(true);
  }

  function abrirEdicao(
    agendamento: Agendamento
  ) {
    setAgendamentoSelecionado(
      agendamento
    );

    setPetSelecionado(
      agendamento.pet_id
    );

    setServicoSelecionado(
      agendamento.servico_id ||
        ""
    );

    setDataAgendamento(
      agendamento.data
    );

    setHorarioAgendamento(
      agendamento.horario ||
        "08:00"
    );

    setObservacoes(
      agendamento.observacoes ||
        ""
    );

    setValorAgendamento(
      agendamento.valor_total !==
        null
        ? String(
            agendamento.valor_total
          )
        : ""
    );

    setModalAgendamento(true);
  }

  function fecharModalAgendamento() {
    if (salvando) {
      return;
    }

    setModalAgendamento(false);
  }

  async function salvarAgendamento() {
    if (!petSelecionado) {
      alert("Selecione um pet.");
      return;
    }

    if (!dataAgendamento) {
      alert("Selecione a data.");
      return;
    }

    setSalvando(true);

    const servico =
      servicos.find(
        function (item) {
          return (
            item.id ===
            servicoSelecionado
          );
        }
      );

    const dados = {
      pet_id:
        petSelecionado,

      servico_id:
        servicoSelecionado ||
        null,

      data:
        dataAgendamento,

      horario:
        horarioAgendamento,

      status:
        agendamentoSelecionado
          ? agendamentoSelecionado.status ||
            "Agendado"
          : "Agendado",

      observacoes:
        observacoes || null,

      valor_total:
        valorAgendamento === ""
          ? null
          : Number(
              valorAgendamento.replace(
                ",",
                "."
              )
            ),

      servico_nome:
        servico?.nome ||
        agendamentoSelecionado?.servico_nome ||
        null,
    };

    if (
      agendamentoSelecionado
    ) {
      const resposta =
        await supabase
          .from("agendamentos")
          .update(dados)
          .eq(
            "id",
            agendamentoSelecionado.id
          );

      if (resposta.error) {
        console.error(
          resposta.error
        );

        alert(
          "Não foi possível atualizar o agendamento."
        );

        setSalvando(false);
        return;
      }
    } else {
      const resposta =
        await supabase
          .from("agendamentos")
          .insert(dados);

      if (resposta.error) {
        console.error(
          resposta.error
        );

        alert(
          "Não foi possível salvar o agendamento."
        );

        setSalvando(false);
        return;
      }
    }

    setModalAgendamento(false);
    setSalvando(false);

    await carregarDados();
  }

  async function excluirAgendamento(
    agendamento: Agendamento
  ) {
    const confirmar =
      window.confirm(
        "Deseja realmente excluir este agendamento?"
      );

    if (!confirmar) {
      return;
    }

    const resposta =
      await supabase
        .from("agendamentos")
        .delete()
        .eq(
          "id",
          agendamento.id
        );

    if (resposta.error) {
      console.error(
        resposta.error
      );

      alert(
        "Não foi possível excluir o agendamento."
      );

      return;
    }

    await carregarDados();
  }

  function abrirAtendimento(
    agendamento: Agendamento
  ) {
    setAgendamentoSelecionado(
      agendamento
    );

    const atendimentoExistente =
      atendimentos.find(
        function (item) {
          return (
            item.agendamento_id ===
            agendamento.id
          );
        }
      );

    setValorAtendimento(
      atendimentoExistente
        ? String(
            atendimentoExistente.valor ||
              0
          )
        : String(
            agendamento.valor_total ||
              0
          )
    );

    setFormaPagamento(
      atendimentoExistente?.forma_pagamento ||
        ""
    );

    setModalAtendimento(
      true
    );
  }

  async function salvarAtendimento() {
    if (!agendamentoSelecionado) {
      return;
    }

    const valor = Number(
      valorAtendimento.replace(
        ",",
        "."
      )
    );

    setSalvando(true);

    const atendimentoExistente =
      atendimentos.find(
        function (item) {
          return (
            item.agendamento_id ===
            agendamentoSelecionado.id
          );
        }
      );

    if (atendimentoExistente) {
      const resposta =
        await supabase
          .from("atendimentos")
          .update({
            pet_id:
              agendamentoSelecionado.pet_id,

            data:
              agendamentoSelecionado.data,

            valor:
              valor,

            forma_pagamento:
              formaPagamento ||
              null,
          })
          .eq(
            "id",
            atendimentoExistente.id
          );

      if (resposta.error) {
        console.error(
          resposta.error
        );

        alert(
          "Não foi possível atualizar o atendimento."
        );

        setSalvando(false);
        return;
      }
    } else {
      const resposta =
        await supabase
          .from("atendimentos")
          .insert({
            agendamento_id:
              agendamentoSelecionado.id,

            pet_id:
              agendamentoSelecionado.pet_id,

            data:
              agendamentoSelecionado.data,

            valor:
              valor,

            forma_pagamento:
              formaPagamento ||
              null,
          });

      if (resposta.error) {
        console.error(
          resposta.error
        );

        alert(
          "Não foi possível registrar o atendimento."
        );

        setSalvando(false);
        return;
      }
    }

    const atualizarAgendamento =
      await supabase
        .from("agendamentos")
        .update({
          status:
            "Concluído",

          valor_total:
            valor,
        })
        .eq(
          "id",
          agendamentoSelecionado.id
        );

    if (
      atualizarAgendamento.error
    ) {
      console.error(
        atualizarAgendamento.error
      );
    }

    setModalAtendimento(
      false
    );

    setSalvando(false);

    await carregarDados();
  }

  function abrirPagamento(
    agendamento: Agendamento
  ) {
    setAgendamentoSelecionado(
      agendamento
    );

    const atendimento =
      atendimentos.find(
        function (item) {
          return (
            item.agendamento_id ===
            agendamento.id
          );
        }
      );

    setFormaPagamento(
      atendimento?.forma_pagamento ||
        ""
    );

    setModalPagamento(true);
  }

  async function salvarPagamento() {
    if (!agendamentoSelecionado) {
      return;
    }

    if (!formaPagamento) {
      alert(
        "Selecione a forma de pagamento."
      );

      return;
    }

    const atendimento =
      atendimentos.find(
        function (item) {
          return (
            item.agendamento_id ===
            agendamentoSelecionado.id
          );
        }
      );

    if (!atendimento) {
      alert(
        "Registre o atendimento antes de registrar o pagamento."
      );

      return;
    }

    setSalvando(true);

    const resposta =
      await supabase
        .from("atendimentos")
        .update({
          forma_pagamento:
            formaPagamento,
        })
        .eq(
          "id",
          atendimento.id
        );

    if (resposta.error) {
      console.error(
        resposta.error
      );

      alert(
        "Não foi possível registrar o pagamento."
      );

      setSalvando(false);
      return;
    }

    setModalPagamento(false);
    setSalvando(false);

    await carregarDados();
  }

  function irParaDiaAnterior() {
    const data = new Date(
      dataSelecionada +
        "T00:00:00"
    );

    data.setDate(
      data.getDate() - 1
    );

    const ano =
      data.getFullYear();

    const mes = String(
      data.getMonth() + 1
    ).padStart(2, "0");

    const dia = String(
      data.getDate()
    ).padStart(2, "0");

    setDataSelecionada(
      ano +
        "-" +
        mes +
        "-" +
        dia
    );
  }

  function irParaProximoDia() {
    const data = new Date(
      dataSelecionada +
        "T00:00:00"
    );

    data.setDate(
      data.getDate() + 1
    );

    const ano =
      data.getFullYear();

    const mes = String(
      data.getMonth() + 1
    ).padStart(2, "0");

    const dia = String(
      data.getDate()
    ).padStart(2, "0");

    setDataSelecionada(
      ano +
        "-" +
        mes +
        "-" +
        dia
    );
  }

  function irParaHoje() {
    const hoje =
      obterDataLocal();

    setDataSelecionada(
      hoje
    );

    const data = new Date(
      hoje +
        "T00:00:00"
    );

    setMesAtual(data);
  }

  function mudarMes(
    direcao: number
  ) {
    const novaData =
      new Date(
        mesAtual
      );

    novaData.setMonth(
      novaData.getMonth() +
        direcao
    );

    setMesAtual(
      novaData
    );
  }

  function selecionarDia(
    dia: number
  ) {
    const ano =
      mesAtual.getFullYear();

    const mes = String(
      mesAtual.getMonth() + 1
    ).padStart(2, "0");

    const diaFormatado =
      String(dia).padStart(
        2,
        "0"
      );

    setDataSelecionada(
      ano +
        "-" +
        mes +
        "-" +
        diaFormatado
    );
  }

  const diasDoMes = useMemo(
    function () {
      const ano =
        mesAtual.getFullYear();

      const mes =
        mesAtual.getMonth();

      const primeiroDia =
        new Date(
          ano,
          mes,
          1
        );

      const ultimoDia =
        new Date(
          ano,
          mes + 1,
          0
        );

      const primeiroDiaSemana =
        primeiroDia.getDay();

      const quantidadeDias =
        ultimoDia.getDate();

      const dias: Array<
        number | null
      > = [];

      for (
        let i = 0;
        i <
        primeiroDiaSemana;
        i++
      ) {
        dias.push(null);
      }

      for (
        let dia = 1;
        dia <= quantidadeDias;
        dia++
      ) {
        dias.push(dia);
      }

      return dias;
    },
    [mesAtual]
  );

  const agendamentosDoDia =
    agendamentos
      .filter(
        function (
          agendamento
        ) {
          return (
            agendamento.data ===
              dataSelecionada &&
            agendamento.status !==
              "Cancelado"
          );
        }
      )
      .sort(
        function (a, b) {
          return (
            a.horario || ""
          ).localeCompare(
            b.horario || ""
          );
        }
      );

  const agendamentosManha =
    agendamentosDoDia.filter(
      function (
        agendamento
      ) {
        return (
          obterTurno(
            agendamento.horario
          ) === "Manhã"
        );
      }
    );

  const agendamentosTarde =
    agendamentosDoDia.filter(
      function (agendamento) {
        return (
          obterTurno(
            agendamento.horario
          ) === "Tarde"
        );
      }
    );

  function existeAgendamentoNoDia(
    dia: number
  ) {
    const ano =
      mesAtual.getFullYear();

    const mes = String(
      mesAtual.getMonth() + 1
    ).padStart(2, "0");

    const diaFormatado =
      String(dia).padStart(
        2,
        "0"
      );

    const data =
      ano +
      "-" +
      mes +
      "-" +
      diaFormatado;

    return agendamentos.some(
      function (item) {
        return (
          item.data ===
            data &&
          item.status !==
            "Cancelado"
        );
      }
    );
  }

  function estaConcluido(
    agendamento: Agendamento
  ) {
    const status =
      (agendamento.status || "")
        .normalize("NFD")
        .replace(
          /[\u0300-\u036f]/g,
          ""
        )
        .toLowerCase()
        .trim();

    const statusConcluido =
      status === "concluido" ||
      status === "finalizado";

    const atendimentoRegistrado =
      atendimentos.some(
        function (item) {
          return (
            item.agendamento_id ===
            agendamento.id
          );
        }
      );

    return (
      statusConcluido ||
      atendimentoRegistrado
    );
  }

  function obterPagamento(
    agendamento: Agendamento
  ) {
    const atendimento =
      atendimentos.find(
        function (item) {
          return (
            item.agendamento_id ===
            agendamento.id
          );
        }
      );

    return (
      atendimento?.forma_pagamento ||
      ""
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

  function agruparPorTutor(
    lista: Agendamento[]
  ): GrupoTutor[] {
    const grupos: GrupoTutor[] = [];

    lista.forEach(function (agendamento) {
      const chave =
        (agendamento.tutorNome || "Tutor") +
        "|" +
        (agendamento.whatsapp || "") +
        "|" +
        (agendamento.data || "") +
        "|" +
        (agendamento.horario || "08:00");

      const grupoExistente =
        grupos.find(function (grupo) {
          return grupo.chave === chave;
        });

      if (grupoExistente) {
        grupoExistente.agendamentos.push(
          agendamento
        );
      } else {
        grupos.push({
          chave,
          tutorNome:
            agendamento.tutorNome ||
            "Tutor",
          whatsapp:
            agendamento.whatsapp ||
            "",
          horario:
            agendamento.horario ||
            "08:00",
          data:
            agendamento.data,
          agendamentos: [
            agendamento,
          ],
        });
      }
    });

    return grupos;
  }

  function renderPetDoGrupo(
    agendamento: Agendamento
  ) {
    const concluido =
      estaConcluido(
        agendamento
      );

    const pagamento =
      obterPagamento(
        agendamento
      );

    const pet =
      pets.find(
        function (item) {
          return (
            item.id ===
            agendamento.pet_id
          );
        }
      );

    const identificacaoBanho =
      obterIdentificacaoBanho(
        agendamento
      );

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
                  {agendamento.petNome ||
                    "Pet"}
                </h4>

                <span
                  className={
                    concluido
                      ? "rounded-full bg-gray-200 px-2 py-1 text-xs text-gray-700"
                      : "rounded-full bg-gray-900 px-2 py-1 text-xs text-white"
                  }
                >
                  {concluido
                    ? "Concluído"
                    : "Agendado"}
                </span>

              </div>

              {identificacaoBanho && (
                <p className="mt-1 text-sm font-bold text-gray-900">
                  🛁 {identificacaoBanho}
                </p>
              )}

              <p className="mt-1 text-sm text-gray-600">
                {obterNomeServico(
                  agendamento
                )}
                {" • "}
                {formatarValor(
                  agendamento.valor_total
                )}
              </p>

              {pagamento && (
                <p className="mt-1 text-xs text-gray-500">
                  Pagamento:{" "}
                  {pagamento}
                </p>
              )}

            </div>

          </div>

          <div className="flex flex-wrap gap-2">

            <button
              type="button"
              onClick={function () {
                imprimirComprovante(
                  agendamento,
                  pet,
                  obterNomeServico(
                    agendamento
                  )
                );
              }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              🖨️ Imprimir
            </button>

            {concluido && (
              <button
                type="button"
                onClick={function () {
                  abrirWhatsApp(
                    "pronto",
                    agendamento.whatsapp || "",
                    agendamento.petNome || "Pet",
                    agendamento.tutorNome || "Tutor",
                    agendamento.horario || "08:00",
                    pet?.sexo || null,
                    obterNomeServico(
                      agendamento
                    ),
                    agendamento.data
                  );
                }}
                disabled={
                  !agendamento.whatsapp
                }
                className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                🐶 Pet pronto
              </button>
            )}

            <button
              type="button"
              onClick={function () {
                abrirEdicao(
                  agendamento
                );
              }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Editar
            </button>

            {!concluido ? (
              <button
                type="button"
                onClick={function () {
                  abrirAtendimento(
                    agendamento
                  );
                }}
                className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                Registrar atendimento
              </button>
            ) : (
              <button
                type="button"
                onClick={function () {
                  abrirPagamento(
                    agendamento
                  );
                }}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                💰 Registrar pagamento
              </button>
            )}

            <button
              type="button"
              onClick={function () {
                excluirAgendamento(
                  agendamento
                );
              }}
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              Excluir
            </button>

          </div>

        </div>
      </div>
    );
  }

  function renderGrupoTutor(
    grupo: GrupoTutor
  ): ReactNode {
    const itensWhatsApp =
      grupo.agendamentos.map(
        function (agendamento) {
          const pet =
            pets.find(
              function (item) {
                return (
                  item.id ===
                  agendamento.pet_id
                );
              }
            );

          return {
            petNome:
              agendamento.petNome ||
              "Pet",
            servicoNome:
              obterNomeServico(
                agendamento
              ),
            sexo:
              pet?.sexo ||
              null,
          };
        }
      );

    return (
      <div
        key={grupo.chave}
        className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
      >

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

          <div>

            <div className="flex flex-wrap items-center gap-3">

              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-xl">
                👤
              </div>

              <div>

                <h4 className="font-semibold text-gray-900">
                  {grupo.tutorNome}
                </h4>

                <p className="text-sm text-gray-500">
                  {grupo.horario}
                  {" • "}
                  {grupo.agendamentos.length}{" "}
                  {grupo.agendamentos.length === 1
                    ? "pet"
                    : "pets"}
                </p>

              </div>

            </div>

          </div>

          <div className="flex flex-wrap gap-2">

            {grupo.agendamentos.length > 1 && (
              <button
                type="button"
                onClick={function () {
                  imprimirComprovanteGrupo(
                    grupo,
                    pets,
                    obterNomeServico
                  );
                }}
                className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                🖨️ Imprimir todos
              </button>
            )}

            <button
              type="button"
              onClick={function () {
                abrirWhatsAppGrupo(
                  grupo.whatsapp,
                  grupo.tutorNome,
                  grupo.data,
                  grupo.horario,
                  itensWhatsApp
                );
              }}
              disabled={
                !grupo.whatsapp
              }
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              📅 Lembrar agendamento
            </button>

          </div>

        </div>

        <div className="mt-4 space-y-3">

          {grupo.agendamentos.map(
            renderPetDoGrupo
          )}

        </div>

      </div>
    );
  }

  const gruposManha =
    agruparPorTutor(
      agendamentosManha
    );

  const gruposTarde =
    agruparPorTutor(
      agendamentosTarde
    );

  const nomeMes =
    mesAtual.toLocaleDateString(
      "pt-BR",
      {
        month: "long",
        year: "numeric",
      }
    );

  return (
    <main className="min-h-screen bg-gray-100">

      <div className="flex min-h-screen">

        <MenuLateral />

        <section className="flex-1 p-8">

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
              onClick={function () {
                abrirNovoAgendamento();
              }}
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
                  onClick={function () {
                    mudarMes(-1);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-gray-100"
                >
                  ←
                </button>

                <h3 className="font-semibold capitalize text-gray-900">
                  {nomeMes}
                </h3>

                <button
                  type="button"
                  onClick={function () {
                    mudarMes(1);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-gray-100"
                >
                  →
                </button>

              </div>

              <div className="mb-2 grid grid-cols-7 text-center text-xs font-medium text-gray-400">

                <span>Dom</span>
                <span>Seg</span>
                <span>Ter</span>
                <span>Qua</span>
                <span>Qui</span>
                <span>Sex</span>
                <span>Sáb</span>

              </div>

              <div className="grid grid-cols-7 gap-1">

                {diasDoMes.map(
                  function (
                    dia,
                    index
                  ) {

                    if (
                      dia ===
                      null
                    ) {
                      return (
                        <div
                          key={
                            "vazio-" +
                            index
                          }
                          className="h-10"
                        />
                      );
                    }

                    const ano =
                      mesAtual.getFullYear();

                    const mes =
                      String(
                        mesAtual.getMonth() +
                          1
                      ).padStart(
                        2,
                        "0"
                      );

                    const data =
                      ano +
                      "-" +
                      mes +
                      "-" +
                      String(
                        dia
                      ).padStart(
                        2,
                        "0"
                      );

                    const selecionado =
                      data ===
                      dataSelecionada;

                    const hoje =
                      data ===
                      obterDataLocal();

                    const temAgendamento =
                      existeAgendamentoNoDia(
                        dia
                      );

                    return (
                      <button
                        key={data}
                        type="button"
                        onClick={function () {
                          selecionarDia(
                            dia
                          );
                        }}
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
                              (selecionado
                                ? "bg-white"
                                : "bg-gray-900")
                            }
                          />
                        )}

                      </button>
                    );
                  }
                )}

              </div>

              <button
                type="button"
                onClick={
                  irParaHoje
                }
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
                    {formatarDataLocal(
                      dataSelecionada
                    )}
                  </h3>

                </div>

                <div className="flex items-center gap-2">

                  <button
                    type="button"
                    onClick={
                      irParaDiaAnterior
                    }
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                  >
                    ←
                  </button>

                  <button
                    type="button"
                    onClick={
                      irParaHoje
                    }
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
                  >
                    Hoje
                  </button>

                  <button
                    type="button"
                    onClick={
                      irParaProximoDia
                    }
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
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
                        {
                          agendamentosManha.length
                        }{" "}
                        {agendamentosManha.length === 1
                          ? "pet"
                          : "pets"}
                      </span>

                    </div>

                    <div className="space-y-3">

                      {agendamentosManha.length ===
                      0 ? (

                        <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">

                          <p className="text-sm text-gray-500">
                            Nenhum pet agendado pela manhã.
                          </p>

                        </div>

                      ) : (

                        gruposManha.map(
                          renderGrupoTutor
                        )

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
                        {
                          agendamentosTarde.length
                        }{" "}
                        {agendamentosTarde.length === 1
                          ? "pet"
                          : "pets"}
                      </span>

                    </div>

                    <div className="space-y-3">

                      {agendamentosTarde.length ===
                      0 ? (

                        <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">

                          <p className="text-sm text-gray-500">
                            Nenhum pet agendado à tarde.
                          </p>

                        </div>

                      ) : (

                        gruposTarde.map(
                          renderGrupoTutor
                        )

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
                onClick={
                  fecharModalAgendamento
                }
                className="text-2xl text-gray-400 hover:text-gray-700"
              >
                ×
              </button>

            </div>

            <div className="grid gap-5 md:grid-cols-2">

              <div className="md:col-span-2">

                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Pet
                </label>

                <select
                  value={
                    petSelecionado
                  }
                  onChange={function (
                    event
                  ) {
                    setPetSelecionado(
                      event.target.value
                    );
                  }}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-500"
                >

                  <option value="">
                    Selecione um pet
                  </option>

                  {pets.map(
                    function (
                      pet
                    ) {

                      return (
                        <option
                          key={
                            pet.id
                          }
                          value={
                            pet.id
                          }
                        >
                          {
                            pet.nome
                          }{" "}
                          —{" "}
                          {
                            pet.tutorNome
                          }
                        </option>
                      );

                    }
                  )}

                </select>

              </div>

              <div>

                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Serviço
                </label>

                <select
                  value={
                    servicoSelecionado
                  }
                  onChange={function (
                    event
                  ) {
                    setServicoSelecionado(
                      event.target.value
                    );
                  }}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-500"
                >

                  <option value="">
                    Selecione um serviço
                  </option>

                  {servicos.map(
                    function (
                      servico
                    ) {

                      return (
                        <option
                          key={
                            servico.id
                          }
                          value={
                            servico.id
                          }
                        >
                          {
                            servico.nome
                          }
                        </option>
                      );

                    }
                  )}

                </select>

              </div>

              <div>

                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Valor
                </label>

                <input
                  type="text"
                  inputMode="decimal"
                  value={
                    valorAgendamento
                  }
                  onChange={function (
                    event
                  ) {
                    setValorAgendamento(
                      event.target.value
                    );
                  }}
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
                  value={
                    dataAgendamento
                  }
                  onChange={function (
                    event
                  ) {
                    setDataAgendamento(
                      event.target.value
                    );
                  }}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-500"
                />

              </div>

              <div>

                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Horário
                </label>

                <select
                  value={
                    horarioAgendamento
                  }
                  onChange={function (
                    event
                  ) {
                    setHorarioAgendamento(
                      event.target.value
                    );
                  }}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-500"
                >

                  <option value="08:00">
                    08:00
                  </option>

                  <option value="13:30">
                    13:30
                  </option>

                </select>

              </div>

              <div className="md:col-span-2">

                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Observações do serviço
                </label>

                <textarea
                  value={
                    observacoes
                  }
                  onChange={function (
                    event
                  ) {
                    setObservacoes(
                      event.target.value
                    );
                  }}
                  rows={3}
                  placeholder="Observações do agendamento"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-500"
                />

              </div>

            </div>

            <div className="mt-6 flex justify-end gap-3">

              <button
                type="button"
                onClick={
                  fecharModalAgendamento
                }
                className="rounded-xl border border-gray-300 px-5 py-3 font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={
                  salvarAgendamento
                }
                disabled={
                  salvando
                }
                className="rounded-xl bg-gray-900 px-5 py-3 font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {salvando
                  ? "Salvando..."
                  : "Salvar agendamento"}
              </button>

            </div>

          </div>

        </div>

      )}

      {modalAtendimento &&
        agendamentoSelecionado && (

          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">

              <div className="mb-6 flex items-center justify-between">

                <div>

                  <h3 className="text-xl font-bold text-gray-900">
                    Registrar atendimento
                  </h3>

                  <p className="mt-1 text-sm text-gray-500">
                    {
                      agendamentoSelecionado.petNome
                    }
                    {" • "}
                    {obterNomeServico(
                      agendamentoSelecionado
                    )}
                  </p>

                  {obterIdentificacaoBanho(
                    agendamentoSelecionado
                  ) && (
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      🛁{" "}
                      {obterIdentificacaoBanho(
                        agendamentoSelecionado
                      )}
                    </p>
                  )}

                </div>

                <button
                  type="button"
                  onClick={function () {
                    setModalAtendimento(
                      false
                    );
                  }}
                  className="text-2xl text-gray-400 hover:text-gray-700"
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
                    {
                      agendamentoSelecionado.tutorNome
                    }
                  </p>

                </div>

                <div>

                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Data
                  </label>

                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-700">
                    {formatarDataLocal(
                      agendamentoSelecionado.data
                    )}
                  </div>

                </div>

                <div>

                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Valor do atendimento
                  </label>

                  <input
                    type="text"
                    inputMode="decimal"
                    value={
                      valorAtendimento
                    }
                    onChange={function (
                      event
                    ) {
                      setValorAtendimento(
                        event.target.value
                      );
                    }}
                    placeholder="0,00"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-500"
                  />

                </div>

                <div>

                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Forma de pagamento
                  </label>

                  <select
                    value={
                      formaPagamento
                    }
                    onChange={function (
                      event
                    ) {
                      setFormaPagamento(
                        event.target.value
                      );
                    }}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-500"
                  >

                    <option value="">
                      Selecionar depois
                    </option>

                    <option value="Dinheiro">
                      Dinheiro
                    </option>

                    <option value="Pix">
                      Pix
                    </option>

                    <option value="Débito">
                      Débito
                    </option>

                    <option value="Crédito">
                      Crédito
                    </option>

                    <option value="Outro">
                      Outro
                    </option>

                  </select>

                </div>

              </div>

              <div className="mt-6 flex justify-end gap-3">

                <button
                  type="button"
                  onClick={function () {
                    setModalAtendimento(
                      false
                    );
                  }}
                  className="rounded-xl border border-gray-300 px-5 py-3 font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={
                    salvarAtendimento
                  }
                  disabled={
                    salvando
                  }
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

      {modalPagamento &&
        agendamentoSelecionado && (

          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">

              <div className="mb-6 flex items-center justify-between">

                <div>

                  <h3 className="text-xl font-bold text-gray-900">
                    Registrar pagamento
                  </h3>

                  <p className="mt-1 text-sm text-gray-500">
                    {
                      agendamentoSelecionado.petNome
                    }
                  </p>

                  {obterIdentificacaoBanho(
                    agendamentoSelecionado
                  ) && (
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      🛁{" "}
                      {obterIdentificacaoBanho(
                        agendamentoSelecionado
                      )}
                    </p>
                  )}

                </div>

                <button
                  type="button"
                  onClick={function () {
                    setModalPagamento(
                      false
                    );
                  }}
                  className="text-2xl text-gray-400 hover:text-gray-700"
                >
                  ×
                </button>

              </div>

              <div>

                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Forma de pagamento
                </label>

                <select
                  value={
                    formaPagamento
                  }
                  onChange={function (
                    event
                  ) {
                    setFormaPagamento(
                      event.target.value
                    );
                  }}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-gray-500"
                >

                  <option value="">
                    Selecione
                  </option>

                  <option value="Dinheiro">
                    Dinheiro
                  </option>

                  <option value="Pix">
                    Pix
                  </option>

                  <option value="Débito">
                    Débito
                  </option>

                  <option value="Crédito">
                    Crédito
                  </option>

                  <option value="Outro">
                    Outro
                  </option>

                </select>

              </div>

              <div className="mt-6 flex justify-end gap-3">

                <button
                  type="button"
                  onClick={function () {
                    setModalPagamento(
                      false
                    );
                  }}
                  className="rounded-xl border border-gray-300 px-5 py-3 font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={
                    salvarPagamento
                  }
                  disabled={
                    salvando
                  }
                  className="rounded-xl bg-gray-900 px-5 py-3 font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {salvando
                    ? "Salvando..."
                    : "Salvar pagamento"}
                </button>

              </div>

            </div>

          </div>

        )}

    </main>
  );
}