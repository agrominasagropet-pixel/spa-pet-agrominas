const fs = require("fs");
const path = "app/pagamentos/page.tsx";
const original = fs.readFileSync(path, "utf8");

if (original.includes("async function cancelarCobranca(")) {
  console.log("O botão já foi instalado.");
  process.exit(0);
}

let codigo = original;

function alterar(regex, novo, descricao) {
  if (!regex.test(codigo)) {
    throw new Error("Não encontrei: " + descricao + ". Nenhuma alteração salva.");
  }
  codigo = codigo.replace(regex, novo);
}

alterar(
  /const \[regularizando, setRegularizando\] = useState\(false\);/,
  `const [regularizando, setRegularizando] = useState(false);
  const [cancelando, setCancelando] = useState(false);`,
  "Estado de cancelamento"
);

alterar(
  /  function abrirPagamento\(linha: Linha\) \{/,
  `  async function cancelarCobranca(linha: Linha) {
    if (cancelando || linha.tipo !== "plano" ||
        linha.situacao !== "pendente" || linha.ciclo === null) return;

    const confirmou = window.confirm(
      "Cancelar cobrança do pet " + linha.pet +
      " - ciclo " + linha.ciclo + "?\\n\\n" +
      "Valor: " + moeda(linha.valor) + "\\n\\n" +
      "Os ciclos anteriores serão preservados."
    );
    if (!confirmou) return;

    setCancelando(true);
    setErro("");
    setAviso("");

    try {
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
        throw new Error("Este ciclo possui pagamento registrado.");
      }

      if (ags.some(a => normal(a.pagamento_status) === "pago")) {
        throw new Error("Este ciclo está marcado como pago. Confira antes de cancelar.");
      }

      if (ags.some(a =>
        ["concluido", "finalizado", "compareceu"].includes(normal(a.status))
      )) {
        throw new Error("Este ciclo possui banho concluído.");
      }

      const ids = ags.map(a => a.id);

      const { data: atendimentos, error: erroAt } = await supabase
        .from("atendimentos")
        .select("id")
        .in("agendamento_id", ids)
        .limit(1);

      if (erroAt) throw erroAt;
      if (atendimentos?.length) {
        throw new Error("Existe atendimento registrado neste ciclo.");
      }

      const { data: atualizados, error: erroUpdate } = await supabase
        .from("agendamentos")
        .update({ status: "Cancelado" })
        .in("id", ids)
        .eq("pet_id", linha.petId)
        .eq("ciclo", linha.ciclo)
        .select("id");

      if (erroUpdate) throw erroUpdate;
      if (atualizados?.length !== ids.length) {
        throw new Error("Não foi possível confirmar todos os cancelamentos. Atualize a página.");
      }

      await carregar();
      setAviso("Cobrança cancelada! Os ciclos anteriores foram preservados.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao cancelar cobrança.");
    } finally {
      setCancelando(false);
    }
  }

  function abrirPagamento(linha: Linha) {`,
  "Função de cancelamento"
);

alterar(
  /\{linha\.situacao === "pendente" && \(/,
  `{linha.situacao === "pendente" && linha.tipo === "plano" && (
    <button
      type="button"
      disabled={cancelando}
      onClick={() => void cancelarCobranca(linha)}
      className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
    >
      {cancelando ? "Aguarde..." : "Cancelar cobrança"}
    </button>
  )}
  {linha.situacao === "pendente" && (`,
  "Botão de cancelamento"
);

fs.copyFileSync(path, path + ".backup-cancelamento");
fs.writeFileSync(path, codigo, "utf8");

console.log("SUCESSO! Botão Cancelar cobrança instalado.");
console.log("Backup criado.");
