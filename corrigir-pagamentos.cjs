const fs = require("fs");

const arquivo = "app/pagamentos/page.tsx";
const original = fs.readFileSync(arquivo, "utf8");

if (original.includes("async function cancelarCobranca(")) {
  console.log("A função de cancelamento já existe. Nenhuma alteração realizada.");
  process.exit(0);
}

function substituir(texto, antigo, novo, nome) {
  texto = texto.replace(/\r\n/g, "\n"); antigo = antigo.replace(/\r\n/g, "\n"); if (!texto.includes(antigo)) {
    throw new Error("Não encontrei o trecho: " + nome + ". Nenhum arquivo foi alterado.");
  }
  return texto.replace(antigo, novo);
}

let codigo = original.replace(/\r\n/g, "\n").replace(/\n[ \t]*\n/g, "\n");

codigo = substituir(
  codigo,
  'type Situacao = "pendente" | "pago" | "conferir";',
  'type Situacao = "pendente" | "pago" | "conferir" | "cancelado";',
  "Tipo Situacao"
);

codigo = substituir(
  codigo,
  'type Aba = "pendente" | "pago" | "conferir";',
  'type Aba = "pendente" | "pago" | "conferir" | "cancelado";',
  "Tipo Aba"
);

codigo = substituir(
  codigo,
  '  const [regularizando, setRegularizando] = useState(false);',
  '  const [regularizando, setRegularizando] = useState(false);\n  const [cancelando, setCancelando] = useState(false);',
  "Estado cancelando"
);

codigo = substituir(
  codigo,
  '      } else if (ativo) {\n        resultado.push({',
  '      } else if (ativo || grupo.every((a) => cancelado(a.status))) {\n          resultado.push({',
  "Listagem de ciclos"
);

codigo = substituir(
  codigo,
  '            situacao: pagoNaAgenda\n              ? "conferir"\n              : "pendente",',
  '            situacao: !ativo\n              ? "cancelado"\n              : pagoNaAgenda\n              ? "conferir"\n              : "pendente",',
  "Situação de ciclos cancelados"
);

codigo = substituir(
  codigo,
  '  function abrirPagamento(linha: Linha) {',
  `
  async function cancelarCobranca(linha: Linha) {
    if (cancelando || linha.tipo !== "plano" ||
        linha.ciclo === null || linha.situacao !== "pendente") return;

    const confirmou = window.confirm(
      "CANCELAR COBRANÇA?\\n\\n" +
      "Tutor: " + linha.tutor + "\\n" +
      "Pet: " + linha.pet + "\\n" +
      linha.titulo + "\\n" +
      "Valor: " + moeda(linha.valor) + "\\n\\n" +
      "Esta ação cancelará os agendamentos deste ciclo. " +
      "O cadastro, os pagamentos e os ciclos anteriores serão preservados."
    );

    if (!confirmou) return;

    setCancelando(true);
    setErro("");
    setAviso("");

    try {
      const consulta = await supabase
        .from("agendamentos")
        .select("id,status")
        .eq("pet_id", linha.petId)
        .eq("ciclo", linha.ciclo);

      if (consulta.error) throw consulta.error;

      const registros = consulta.data || [];
      if (!registros.length) {
        throw new Error("Nenhum agendamento encontrado neste ciclo.");
      }

      const pagamentos = await supabase
        .from("pagamentos_planos")
        .select("id")
        .eq("pet_id", linha.petId)
        .eq("ciclo", linha.ciclo)
        .limit(1);

      if (pagamentos.error) throw pagamentos.error;

      if (pagamentos.data?.length) {
        throw new Error("Este ciclo já possui pagamento registrado e não pode ser cancelado.");
      }

      const ids = registros.map((item) => item.id);

      const atendimentos = await supabase
        .from("atendimentos")
        .select("id")
        .in("agendamento_id", ids)
        .limit(1);

      if (atendimentos.error) throw atendimentos.error;

      if (atendimentos.data?.length) {
        throw new Error("Este ciclo possui atendimento registrado. Cancelamento bloqueado para preservar o histórico.");
      }

      const concluido = registros.some((item) =>
        ["concluido", "finalizado", "compareceu"].includes(normal(item.status))
      );

      if (concluido) {
        throw new Error("Este ciclo possui banho concluído. Não é possível cancelar a cobrança automaticamente.");
      }

      const atualizacao = await supabase
        .from("agendamentos")
        .update({ status: "Cancelado" })
        .in("id", ids)
        .eq("pet_id", linha.petId)
        .eq("ciclo", linha.ciclo)
        .select("id");

      if (atualizacao.error) throw atualizacao.error;

      if (atualizacao.data?.length !== ids.length) {
        throw new Error("Nem todos os agendamentos foram confirmados como cancelados. Atualize e confira.");
      }

      await carregar();
      setAba("cancelado");
      setAviso("Cobrança cancelada. Os ciclos anteriores foram preservados.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível cancelar a cobrança.");
    } finally {
      setCancelando(false);
    }
  }

  function abrirPagamento(linha: Linha) {`,
  "Função de cancelamento"
);

codigo = substituir(
  codigo,
  '  const quantidadeConferir = linhas.filter(',
  '  const quantidadeCancelados = linhas.filter((l) => l.situacao === "cancelado").length;\n\n  const quantidadeConferir = linhas.filter(',
  "Contador cancelados"
);

codigo = substituir(
  codigo,
  '      id: "conferir",\n      nome: "Conferir",\n      quantidade: quantidadeConferir,\n    },',
  '      id: "conferir",\n      nome: "Conferir",\n      quantidade: quantidadeConferir,\n    },\n    {\n      id: "cancelado",\n      nome: "Cancelados",\n      quantidade: quantidadeCancelados,\n    },',
  "Aba Cancelados"
);

codigo = substituir(
  codigo,
  '                    : "Pagamentos para conferir"}',
  '                    : aba === "cancelado"\n                    ? "Cobranças canceladas"\n                    : "Pagamentos para conferir"}',
  "Título da aba"
);

codigo = substituir(
  codigo,
  '                    : "Registros antigos que precisam de verificação antes de qualquer cobrança."}',
  '                    : aba === "cancelado"\n                    ? "Ciclos cancelados, fora do total a receber."\n                    : "Registros antigos que precisam de verificação antes de qualquer cobrança."}',
  "Descrição da aba"
);

codigo = substituir(
  codigo,
  '                        {linha.situacao === "pendente" && (',
  `                        {linha.situacao === "pendente" && linha.tipo === "plano" && (
                          <button
                            type="button"
                            disabled={cancelando}
                            onClick={() => void cancelarCobranca(linha)}
                            className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                          >
                            {cancelando ? "Aguarde..." : "Cancelar cobrança"}
                          </button>
                        )}

                        {linha.situacao === "cancelado" && (
                          <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700">
                            Cobrança cancelada
                          </span>
                        )}

                        {linha.situacao === "pendente" && (`,
  "Botão de cancelamento"
);

const backup = arquivo + ".backup-antes-cancelamento";
fs.copyFileSync(arquivo, backup);
fs.writeFileSync(arquivo, codigo, "utf8");

console.log("Arquivo atualizado com sucesso!");
console.log("Backup salvo em: " + backup);


