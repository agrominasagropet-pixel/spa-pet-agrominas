"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import MenuLateral from "@/app/components/MenuLateral";
type Atendimento = { id: string; agendamento_id: string | null; pet_id: string | null; data: string; data_pagamento: string | null; valor: number | null; forma_pagamento: string | null };
type Agendamento = { id: string; pet_id: string; data: string; status: string | null; servico_nome: string | null; observacoes: string | null; valor_total: number | null; plano: string | null; ciclo: number | null; numero_banho: number | null; pagamento_status: string | null; forma_pagamento_plano: string | null };
type PagamentoPlano = { id: string; pet_id: string; ciclo: number; valor: number; forma_pagamento: string | null; data_pagamento: string | null };
type Extra = { id: string; agendamento_id: string; pet_id: string; nome_servico: string; valor: number; pagamento_status: string; forma_pagamento: string | null; data_pagamento: string | null };


type Pet = { id: string; nome: string; cliente_id: string };
type Cliente = { id: string; nome: string };
type Receita = { id: string; petId: string | null; data: string; pet: string; tutor: string; descricao: string; forma: string; valor: number; origem: "Plano" | "Avulso" | "Extra"; dataAproximada: boolean };
type AtendimentoLinha = { id: string; petId: string | null; data: string; pet: string; tutor: string; servicos: string[]; plano: string; valorReferencia: number; forma: string };
type Pendente = { chave: string; pet: string; tutor: string; plano: string; valor: number; inicio: string };
type Conferencia = { chave: string; petId: string; ciclo: number; pet: string; tutor: string; plano: string; valor: number; forma: string; inicio: string; divergente: boolean };
const moeda = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataISO = (valor: string | null | undefined) => (valor || "").slice(0, 10);
const dataBR = (valor: string) => { const [a, m, d] = dataISO(valor).split("-"); return a && m && d ? `${d}/${m}/${a}` : "—"; };
const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const deslocarDias = (dias: number) => { const d = new Date(); d.setDate(d.getDate() + dias); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const inicioMes = () => hoje().slice(0, 7) + "-01";
const numero = (valor: number | null | undefined) => Number.isFinite(Number(valor)) ? Number(valor) : 0;
const normalizar = (s: string | null | undefined) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
const ehCancelado = (s: string | null) => ["cancelado", "cancelada"].includes(normalizar(s));
const ehPlano = (a: Agendamento | undefined) => !!a && !!a.plano && normalizar(a.plano) !== "avulso" && a.ciclo !== null;
const chaveCiclo = (pet: string, ciclo: number) => `${pet}::${ciclo}`;
const dentro = (data: string, inicio: string, fim: string) => !!data && data >= inicio && data <= fim;
const nomes: Record<string, string> = {
  "Banho": "Banho Completo", "Banho + Tosa Higiênica": "Banho com Tosa Higiênica", "Banho + Tosa Completa": "Banho com Tosa Completa",
  "Tosa Máquina": "Tosa na Máquina", "Tosa Bebê": "Tosa Estilo Bebê", "Tosa Tesoura": "Tosa na Tesoura", "Tosa Raça": "Tosa Padrão da Raça",
  "Acerto de Saia": "Acabamento de Saia", "Carding": "Remoção de Subpelo (Carding)", "Trimming": "Trimming — Acabamento Técnico",
  "Corte/Lixamento Unhas": "Corte e Lixamento de Unhas", "Botinha": "Acabamento Estilo Botinha", "Arredondamento Patinha": "Acabamento de Patinhas"
};
function servicosDo(a: Agendamento | undefined): string[] {
  if (!a) return ["Serviço não identificado"];
  const lista: string[] = [];
  const adicionar = (texto: string) => {
    texto.split(/\s*(?:\||;|\n)\s*/).forEach(parte => {
      const item = parte.trim().replace(/^[-•]\s*/, "");
      const nome = nomes[item] || item;
      if (nome && !lista.some(x => normalizar(x) === normalizar(nome))) lista.push(nome);
    });
  };
  if (a.servico_nome) adicionar(a.servico_nome);
  // Observações livres não são serviços; somente linhas com identificação explícita.
  (a.observacoes || "").split(/\n/).forEach(linha => {
    const m = linha.trim().match(/^(?:[-•]\s*)?(?:servi[cç]os?|banho|tosas?|adicionais?)\s*:\s*(.+)$/i);
    if (m) adicionar(m[1]);
  });
  return lista.length ? lista : ["Serviço não identificado"];
}
// Paginação: o Supabase costuma limitar cada resposta a 1.000 registros.
async function buscarTodos<T>(tabela: string, campos: string, ordenacao: string): Promise<T[]> {
  const resultado: T[] = [];
  const tamanho = 500;
  for (let inicio = 0; ; inicio += tamanho) {
    const { data, error } = await supabase.from(tabela).select(campos).order(ordenacao, { ascending: false }).range(inicio, inicio + tamanho - 1);
    if (error) throw new Error(`${tabela}: ${error.message}`);
    const lote = (data || []) as unknown as T[];
    resultado.push(...lote);
    if (lote.length < tamanho) break;
  }
  return resultado;
}
function baixarCSV(nome: string, linhas: (string | number)[][]) {
  const proteger = (valor: string | number) => {
    const texto = String(valor ?? "");
    const seguro = /^[\s]*[=+@-]/.test(texto) ? `'${texto}` : texto;
    return `"${seguro.replace(/"/g, '""')}"`;
  };
  const csv = "\uFEFF" + linhas.map(linha => linha.map(proteger).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a"); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
export default function RelatoriosPage() {
  const router = useRouter();
  const [acesso, setAcesso] = useState<"verificando" | "admin" | "negado">("verificando");
  useEffect(() => {
    let ativo = true;
    async function verificarAcesso() {
      try {
        const { data: usuario, error: erroUsuario } = await supabase.auth.getUser();
        if (erroUsuario || !usuario.user) {
          if (ativo) { setAcesso("negado"); router.replace("/login"); }
          return;
        }
        const { data: perfil, error: erroPerfil } = await supabase
          .from("perfis")
          .select("perfil")
          .eq("id", usuario.user.id)
          .maybeSingle();
        if (!ativo) return;
        if (!erroPerfil && perfil?.perfil === "admin") {
          setAcesso("admin");
        } else {
          setAcesso("negado");
          router.replace("/");
        }
      } catch {
        if (ativo) { setAcesso("negado"); router.replace("/login"); }
      }
    }
    void verificarAcesso();
    return () => { ativo = false; };
  }, [router]);
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [pagamentosPlanos, setPagamentosPlanos] = useState<PagamentoPlano[]>([]);

  const [extras, setExtras] = useState<Extra[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [periodo, setPeriodo] = useState("mes");
  const [dataInicio, setDataInicio] = useState(inicioMes);
  const [dataFim, setDataFim] = useState(hoje);
  const [aba, setAba] = useState<"financeiro" | "operacional">("financeiro");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const carregar = useCallback(async () => {
    if (acesso !== "admin") return;
    setCarregando(true); setErro("");
    try {
      const [ats, ags, pags, ps, cs, ex] = await Promise.all([
        buscarTodos<Atendimento>("atendimentos", "id,agendamento_id,pet_id,data,data_pagamento,valor,forma_pagamento", "data"),
        buscarTodos<Agendamento>("agendamentos", "id,pet_id,data,status,servico_nome,observacoes,valor_total,plano,ciclo,numero_banho,pagamento_status,forma_pagamento_plano", "data"),
        buscarTodos<PagamentoPlano>("pagamentos_planos", "id,pet_id,ciclo,valor,forma_pagamento,data_pagamento", "data_pagamento"),
        buscarTodos<Pet>("pets", "id,nome,cliente_id", "nome"),
        buscarTodos<Cliente>("clientes", "id,nome", "nome"),

        buscarTodos<Extra>("servicos_extras_agendamento", "id,agendamento_id,pet_id,nome_servico,valor,pagamento_status,forma_pagamento,data_pagamento", "criado_em")
      ]);
      setAtendimentos(ats); setAgendamentos(ags); setPagamentosPlanos(pags); setPets(ps); setClientes(cs); setExtras(ex);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar os relatórios.");
    } finally { setCarregando(false); }
  }, [acesso]);
  useEffect(() => { if (acesso === "admin") void carregar(); }, [carregar, acesso]);
  useEffect(() => { setPagina(1); }, [dataInicio, dataFim, aba, busca]);
  const selecionarPeriodo = (p: string) => {
    const fim = hoje(); setPeriodo(p); setDataFim(fim);
    setDataInicio(p === "hoje" ? fim : p === "7dias" ? deslocarDias(-6) : p === "30dias" ? deslocarDias(-29) : inicioMes());
  };
  const dados = useMemo(() => {
    const mapaPets = new Map(pets.map(p => [p.id, p]));
    const mapaClientes = new Map(clientes.map(c => [c.id, c]));
    const mapaAg = new Map(agendamentos.map(a => [a.id, a]));
    const nomesPet = (id: string | null) => {
      const p = id ? mapaPets.get(id) : undefined;
      return { pet: p?.nome || "Pet não identificado", tutor: p ? mapaClientes.get(p.cliente_id)?.nome || "Tutor não identificado" : "Tutor não identificado" };
    };
    const ciclosPagos = new Set(pagamentosPlanos.map(p => chaveCiclo(p.pet_id, p.ciclo)));
    const receitas: Receita[] = [];
    for (const p of pagamentosPlanos) {
      const n = nomesPet(p.pet_id);
      receitas.push({ id: `plano-${p.id}`, petId: p.pet_id, data: dataISO(p.data_pagamento), ...n, descricao: `Plano · ciclo ${p.ciclo}`, forma: p.forma_pagamento || "Não informada", valor: numero(p.valor), origem: "Plano", dataAproximada: false });
    }
    for (const at of atendimentos) {
      const a = at.agendamento_id ? mapaAg.get(at.agendamento_id) : undefined;
      // Planos são contabilizados exclusivamente por pagamentos_planos.
      if (ehPlano(a)) continue;
      if (!at.forma_pagamento) continue; // Sem pagamento confirmado, não é receita.
      const n = nomesPet(at.pet_id || a?.pet_id || null);
      receitas.push({ id: `avulso-${at.id}`, petId: at.pet_id || a?.pet_id || null, data: dataISO(at.data_pagamento || at.data), ...n, descricao: a?.servico_nome || "Atendimento avulso", forma: at.forma_pagamento, valor: numero(at.valor), origem: "Avulso", dataAproximada: !dataISO(at.data_pagamento) });
    }
    // Serviços extras são receitas independentes do valor do plano ou avulso.
    // Somente extras pagos, com data de recebimento registrada, entram no financeiro.
    for (const extra of extras) {
      if (normalizar(extra.pagamento_status) !== "pago") continue;
      const dataRecebimento = dataISO(extra.data_pagamento);
      const ag = mapaAg.get(extra.agendamento_id);
      const n = nomesPet(extra.pet_id || ag?.pet_id || null);
      const banho = ag?.numero_banho ? `${ag.numero_banho}º banho` : "Banho não identificado";
      const ciclo = ag?.ciclo !== null && ag?.ciclo !== undefined ? ` · ciclo ${ag.ciclo}` : "";
      receitas.push({
        id: `extra-${extra.id}`, petId: extra.pet_id, data: dataRecebimento,
        ...n, descricao: `${extra.nome_servico} · ${banho}${ciclo} · atendimento ${dataBR(ag?.data || "")}`,
        forma: extra.forma_pagamento || "Não informada", valor: numero(extra.valor),
        origem: "Extra", dataAproximada: !dataRecebimento
      });
    }

    const linhas: AtendimentoLinha[] = atendimentos.map(at => {
      const a = at.agendamento_id ? mapaAg.get(at.agendamento_id) : undefined;
      const n = nomesPet(at.pet_id || a?.pet_id || null);
      return { id: at.id, petId: at.pet_id || a?.pet_id || null, data: dataISO(at.data), ...n, servicos: servicosDo(a), plano: ehPlano(a) ? `${a?.plano} · ciclo ${a?.ciclo}` : "Avulso", valorReferencia: numero(at.valor), forma: at.forma_pagamento || "Não informada" };
    });
    // Um plano é pendente quando não há pagamento registrado nem marcação de pago.
    const grupos = new Map<string, Agendamento[]>();
    for (const a of agendamentos) {
      if (!ehPlano(a) || ehCancelado(a.status)) continue;
      const chave = chaveCiclo(a.pet_id, a.ciclo!);
      grupos.set(chave, [...(grupos.get(chave) || []), a]);
    }
    const pendentes: Pendente[] = [];
    const conferencias: Conferencia[] = [];
    for (const [chave, grupo] of grupos) {
      const primeiro = [...grupo].sort((a, b) => a.data.localeCompare(b.data))[0];
      const marcadoPago = grupo.some(a => normalizar(a.pagamento_status) === "pago");
      if (marcadoPago && !ciclosPagos.has(chave)) {
        const n = nomesPet(primeiro.pet_id);
        const valores = [...new Set(grupo.map(a => numero(a.valor_total)).filter(v => v > 0))];
        const formas = [...new Set(grupo.map(a => (a.forma_pagamento_plano || "").trim()).filter(Boolean))];
        conferencias.push({ chave, petId: primeiro.pet_id, ciclo: primeiro.ciclo!, ...n, plano: primeiro.plano || "Plano", valor: valores[0] || 0, forma: formas.length === 1 ? formas[0] : "", inicio: primeiro.data, divergente: valores.length > 1 || formas.length > 1 });
      }
      if (marcadoPago || ciclosPagos.has(chave)) continue;
      const n = nomesPet(primeiro.pet_id);
      pendentes.push({ chave, ...n, plano: `${primeiro.plano} · ciclo ${primeiro.ciclo}`, valor: numero(primeiro.valor_total), inicio: primeiro.data });
    }
    // Anexa adicionais ao banho correspondente, sem criar atendimentos fictícios.
    const extrasPorAg = new Map<string, string[]>();
    for (const e of extras) {
      if (normalizar(e.pagamento_status) === "cancelado") continue;
      const lista = extrasPorAg.get(e.agendamento_id) || [];
      lista.push(`${e.nome_servico} (adicional)`);
      extrasPorAg.set(e.agendamento_id, lista);
    }
    for (const linha of linhas) {
      const at = atendimentos.find(a => a.id === linha.id);
      for (const nome of extrasPorAg.get(at?.agendamento_id || "") || []) {
        if (!linha.servicos.includes(nome)) linha.servicos.push(nome);
      }
    }

    return { receitas, linhas, pendentes, conferencias, semRegistroFinanceiro: conferencias.length };
  }, [atendimentos, agendamentos, pagamentosPlanos, pets, clientes, extras]);
  const valido = dataInicio && dataFim && dataInicio <= dataFim;
  const receitasPeriodo = useMemo(() => dados.receitas.filter(r => dentro(r.data, dataInicio, dataFim)), [dados, dataInicio, dataFim]);
  const atendimentosPeriodo = useMemo(() => dados.linhas.filter(a => dentro(a.data, dataInicio, dataFim)), [dados, dataInicio, dataFim]);
  // Planos, extras e avulsos com data_pagamento têm data real de recebimento.
  const recebidosConfirmados = receitasPeriodo.filter(r => !r.dataAproximada).reduce((s, r) => s + r.valor, 0);
  const recebidosProvisorios = receitasPeriodo.filter(r => r.dataAproximada).reduce((s, r) => s + r.valor, 0);
  const planosRecebidos = receitasPeriodo.filter(r => r.origem === "Plano").reduce((s, r) => s + r.valor, 0);

  const extrasRecebidos = receitasPeriodo.filter(r => r.origem === "Extra" && !r.dataAproximada).reduce((s, r) => s + r.valor, 0);
  const petsAtendidos = new Set(atendimentosPeriodo.filter(a => a.petId).map(a => a.petId)).size;
  const pendentesPeriodo = dados.pendentes.filter(p => dentro(p.inicio, dataInicio, dataFim));
  const valorPendente = pendentesPeriodo.reduce((s, p) => s + p.valor, 0);
  const buscaNormalizada = normalizar(busca);
  const registros = (aba === "financeiro" ? receitasPeriodo : atendimentosPeriodo).filter(r => normalizar(`${r.pet} ${r.tutor} ${"descricao" in r ? r.descricao : r.servicos.join(" ")}`).includes(buscaNormalizada));
  const porPagina = 15;
  const totalPaginas = Math.max(1, Math.ceil(registros.length / porPagina));
  const exibidos = registros.slice((pagina - 1) * porPagina, pagina * porPagina);
  const pagamentosPorForma = useMemo(() => {
    const m = new Map<string, { quantidade: number; valor: number }>();
    receitasPeriodo.forEach(r => { const atual = m.get(r.forma) || { quantidade: 0, valor: 0 }; m.set(r.forma, { quantidade: atual.quantidade + 1, valor: atual.valor + r.valor }); });
    return [...m.entries()].map(([nome, d]) => ({ nome, ...d })).sort((a, b) => b.valor - a.valor);
  }, [receitasPeriodo]);
  const servicos = useMemo(() => {
    const m = new Map<string, number>();
    atendimentosPeriodo.forEach(a => a.servicos.forEach(s => m.set(s, (m.get(s) || 0) + 1)));
    return [...m.entries()].map(([nome, quantidade]) => ({ nome, quantidade })).sort((a, b) => b.quantidade - a.quantidade);
  }, [atendimentosPeriodo]);
  const graficoBanhos = useMemo(() => {
    const m = new Map<string, number>();
    atendimentosPeriodo.forEach(a => m.set(a.data, (m.get(a.data) || 0) + 1));
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-14);
  }, [atendimentosPeriodo]);
  const graficoRecebimentos = useMemo(() => {
    const m = new Map<string, number>();
    receitasPeriodo.filter(r => !r.dataAproximada).forEach(r => m.set(r.data, (m.get(r.data) || 0) + r.valor));
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-14);
  }, [receitasPeriodo]);
  const dias = useMemo(() => {
    const m = new Map<string, { banhos: number; recebido: number }>();
    atendimentosPeriodo.forEach(a => { const v = m.get(a.data) || { banhos: 0, recebido: 0 }; v.banhos++; m.set(a.data, v); });
    receitasPeriodo.filter(r => !r.dataAproximada).forEach(r => { const v = m.get(r.data) || { banhos: 0, recebido: 0 }; if (!r.dataAproximada) v.recebido += r.valor; m.set(r.data, v); });
    return [...m.entries()].map(([data, v]) => ({ data, ...v })).sort((a, b) => b.data.localeCompare(a.data));
  }, [atendimentosPeriodo, receitasPeriodo]);
  const exportar = () => {
    if (aba === "financeiro") baixarCSV(`agrominas-financeiro-${dataInicio}-${dataFim}.csv`, [
      ["Data", "Tutor", "Pet", "Descrição", "Tipo", "Forma", "Valor (R$)", "Data do pagamento"],
      ...registros.map(r => { const x = r as Receita; return [dataBR(x.data), x.tutor, x.pet, x.descricao, x.origem, x.forma, x.valor.toFixed(2).replace(".", ","), x.dataAproximada ? "Data do atendimento (provisória)" : "Registrada"]; })
    ]);
    else baixarCSV(`agrominas-atendimentos-${dataInicio}-${dataFim}.csv`, [
      ["Data", "Tutor", "Pet", "Serviços", "Plano"],
      ...registros.map(r => { const x = r as AtendimentoLinha; return [dataBR(x.data), x.tutor, x.pet, x.servicos.join(" | "), x.plano]; })
    ]);
  };
  const grafico = (titulo: string, valores: [string, number][], tipo: "banhos" | "dinheiro") => {
    const maior = Math.max(1, ...valores.map(x => x[1]));
    return <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold">{titulo}</h2>
      <p className="mt-1 text-xs text-gray-500">Últimos 14 dias com movimento dentro do período selecionado</p>
      {valores.length === 0 ? <p className="py-8 text-sm text-gray-500">Nenhum registro no período.</p> :
        <div className="mt-6 flex h-48 items-end gap-2 overflow-x-auto border-b border-gray-200 pb-2">
          {valores.map(([data, valor]) => <div key={data} className="flex h-full min-w-10 flex-1 flex-col items-center justify-end gap-1" title={`${dataBR(data)}: ${tipo === "dinheiro" ? moeda(valor) : `${valor} banho(s)`}`}>
            <span className="text-[10px] font-semibold text-gray-600">{tipo === "dinheiro" ? (valor >= 1000 ? `${(valor/1000).toFixed(1)}k` : valor.toFixed(0)) : valor}</span>
            <div className="w-full max-w-9 rounded-t-md bg-emerald-600" style={{height: `${Math.max(5, (valor / maior) * 130)}px`}} />
            <span className="whitespace-nowrap text-[10px] text-gray-500">{data.slice(8,10)}/{data.slice(5,7)}</span>
          </div>)}
        </div>}
    </div>;
  };
  const cartao = "rounded-2xl border border-gray-100 bg-white p-5 shadow-sm";
  const botao = "rounded-xl px-4 py-2 text-sm font-semibold transition";
  if (acesso !== "admin") {
    return <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6 text-gray-700">{acesso === "verificando" ? "Verificando acesso aos relatórios..." : "Acesso restrito à administração."}</main>;
  }
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="flex min-h-screen"><MenuLateral />
        <section className="min-w-0 flex-1 p-4 md:p-8">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div><p className="text-sm font-semibold text-emerald-700">AGROMINAS · Banho e Tosa</p><h1 className="mt-1 text-3xl font-bold">Relatórios</h1><p className="mt-1 text-sm text-gray-500">Acompanhe separadamente os pagamentos recebidos e os serviços realizados.</p></div>
            <button type="button" onClick={() => void carregar()} disabled={carregando} className={`${botao} bg-white text-gray-700 shadow-sm hover:bg-gray-100 disabled:opacity-50`}>{carregando ? "Atualizando..." : "↻ Atualizar dados"}</button>
          </header>
          <div className={cartao}>
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold">Período de análise</h2><div className="flex flex-wrap gap-2">{[["hoje", "Hoje"], ["7dias", "7 dias"], ["30dias", "30 dias"], ["mes", "Este mês"]].map(([v, nome]) => <button key={v} type="button" onClick={() => selecionarPeriodo(v)} className={`${botao} ${periodo === v ? "bg-emerald-700 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>{nome}</button>)}</div></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Data inicial<input type="date" value={dataInicio} onChange={e => { setDataInicio(e.target.value); setPeriodo("personalizado"); }} className="mt-1 block w-full rounded-xl border border-gray-200 p-3" /></label><label className="text-sm font-medium">Data final<input type="date" value={dataFim} onChange={e => { setDataFim(e.target.value); setPeriodo("personalizado"); }} className="mt-1 block w-full rounded-xl border border-gray-200 p-3" /></label></div>
            {!valido && <p className="mt-3 text-sm font-medium text-red-700">Selecione um período válido: a data inicial deve ser anterior ou igual à final.</p>}
          </div>
          {erro && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><strong>Erro ao consultar Supabase:</strong> {erro}. Os dados exibidos podem estar desatualizados. Verifique a tabela e as permissões de leitura.</div>}
          {carregando && <p className="mt-5 text-sm text-gray-500">Carregando dados...</p>}
          {!carregando && valido && <>
            {dados.semRegistroFinanceiro > 0 && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Atenção:</strong> {dados.semRegistroFinanceiro} ciclo(s) de plano estão marcados como pagos na agenda, mas não possuem registro correspondente em <code>pagamentos_planos</code>. Esses valores não foram somados ao recebido porque não há data de pagamento comprovada. Confira os ciclos na tabela abaixo. Não regularize pagamentos sem comprovação.</div>}
            {dados.conferencias.length > 0 && <div className={`${cartao} mt-5`}>
              <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-bold">Pagamentos para conferir</h2><p className="mt-1 text-sm text-gray-600">{dados.conferencias.length} ciclo(s) marcados como pagos na Agenda, mas sem registro em pagamentos_planos. Lista completa, independente do filtro de datas.</p></div><span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900">{dados.conferencias.length} para conferir</span></div>
              <p className="mt-3 text-sm text-amber-800">Consulte a página Pagamentos para conferir estes ciclos. Este relatório não registra nem altera recebimentos.</p>
              <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[730px] text-left text-sm"><thead><tr className="border-b text-gray-500"><th className="py-3 pr-3">Tutor / Pet</th><th className="py-3 pr-3">Plano / Ciclo</th><th className="py-3 pr-3">Valor na agenda</th><th className="py-3 pr-3">Forma registrada</th><th className="py-3 text-right">Ação</th></tr></thead><tbody>{dados.conferencias.map(item => <tr key={item.chave} className="border-b last:border-0"><td className="py-3 pr-3"><strong>{item.tutor}</strong><p className="text-gray-500">{item.pet}</p></td><td className="py-3 pr-3">{item.plano} · ciclo {item.ciclo}</td><td className="py-3 pr-3">{item.valor > 0 ? moeda(item.valor) : "Não informado"}{item.divergente && <p className="text-xs text-red-700">Dados divergentes entre banhos</p>}</td><td className="py-3 pr-3">{item.forma || "Não informada"}</td><td className="py-3 text-right"><a href="/pagamentos" className={`${botao} inline-block bg-amber-100 text-amber-950 hover:bg-amber-200`}>Ver em Pagamentos</a></td></tr>)}</tbody></table></div>
            </div>}
            {receitasPeriodo.some(r => r.dataAproximada) && <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><strong>Avulsos:</strong> registros antigos de avulsos sem <code>data_pagamento</code> utilizam provisoriamente a data do atendimento. Os avulsos com data de pagamento preenchida entram no recebido confirmado.</div>}
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Recebido com data confirmada", moeda(recebidosConfirmados), "Planos, avulsos e extras com data real"],
                ["Planos recebidos", moeda(planosRecebidos), "Sem duplicar ciclos entre banhos"],
                ["Datas provisórias", moeda(recebidosProvisorios), "Avulsos antigos sem data de recebimento"],
                ["Banhos realizados", String(atendimentosPeriodo.length), `${petsAtendidos} pets identificados por ID`]
              ].map(([titulo, valor, legenda]) => <div key={titulo} className={cartao}><p className="text-sm font-semibold text-gray-500">{titulo}</p><p className="mt-3 break-words text-2xl font-bold text-gray-900">{valor}</p><p className="mt-2 text-xs text-gray-500">{legenda}</p></div>)}
            </div>
                          <div className="mt-4 rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-gray-500">Serviços extras recebidos no período</p>
                <p className="mt-2 text-2xl font-bold text-emerald-800">{moeda(extrasRecebidos)}</p>
                <p className="mt-1 text-xs text-gray-500">Incluídos no recebido confirmado; não somados novamente aos planos.</p>
              </div>

<div className="mt-4 grid gap-4 sm:grid-cols-2"><div className={cartao}><p className="text-sm text-gray-500">Planos pendentes com início no período</p><p className="mt-2 text-2xl font-bold">{moeda(valorPendente)}</p><p className="mt-1 text-xs text-gray-500">{pendentesPeriodo.length} ciclo(s) · previsão, não dinheiro recebido</p></div><div className={cartao}><p className="text-sm text-gray-500">Média de atendimentos por pet</p><p className="mt-2 text-2xl font-bold">{petsAtendidos ? (atendimentosPeriodo.length / petsAtendidos).toFixed(1).replace(".", ",") : "0"}</p><p className="mt-1 text-xs text-gray-500">Atendimentos por pet no período</p></div></div>
            <div className="mt-6 grid gap-5 lg:grid-cols-2">
            {grafico("Banhos realizados por dia", graficoBanhos, "banhos")}
            {grafico("Recebimentos com data confirmada", graficoRecebimentos, "dinheiro")}
          </div>
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
              <div className={cartao}><h2 className="text-lg font-bold">Formas de pagamento</h2><p className="mb-4 text-sm text-gray-500">Registros financeiros, incluindo avulsos com data provisória</p>{pagamentosPorForma.length ? pagamentosPorForma.map(x => <div key={x.nome} className="flex justify-between gap-3 border-b py-3 text-sm last:border-0"><div><strong>{x.nome}</strong><p className="text-xs text-gray-500">{x.quantidade} registro(s)</p></div><strong>{moeda(x.valor)}</strong></div>) : <p className="py-6 text-sm text-gray-500">Nenhum recebimento no período.</p>}</div>
              <div className={cartao}><h2 className="text-lg font-bold">Serviços realizados</h2><p className="mb-4 text-sm text-gray-500">Quantidade, sem dividir artificialmente o valor dos pacotes</p>{servicos.length ? servicos.map(x => <div key={x.nome} className="flex justify-between gap-3 border-b py-3 text-sm last:border-0"><span>{x.nome}</span><strong>{x.quantidade}</strong></div>) : <p className="py-6 text-sm text-gray-500">Nenhum serviço no período.</p>}</div>
            </div>
            <div className={`${cartao} mt-5`}><h2 className="text-lg font-bold">Movimento diário</h2><p className="mb-4 text-sm text-gray-500">Banhos por data do serviço e recebimentos com data confirmada</p><div className="overflow-x-auto"><table className="w-full min-w-[420px] text-left text-sm"><thead><tr className="border-b text-gray-500"><th className="py-3">Data</th><th className="py-3 text-center">Banhos realizados</th><th className="py-3 text-right">Recebido confirmado</th></tr></thead><tbody>{dias.map(d => <tr key={d.data} className="border-b last:border-0"><td className="py-3">{dataBR(d.data)}</td><td className="py-3 text-center">{d.banhos}</td><td className="py-3 text-right font-semibold">{moeda(d.recebido)}</td></tr>)}</tbody></table>{!dias.length && <p className="py-5 text-sm text-gray-500">Nenhum movimento no período.</p>}</div></div>
            <div className={`${cartao} mt-5`}>
              <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Detalhamento</h2><p className="text-sm text-gray-500">Consulte e exporte os registros do período.</p></div><button type="button" onClick={exportar} className={`${botao} bg-emerald-700 text-white hover:bg-emerald-800`}>↓ Exportar CSV</button></div>
              <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => setAba("financeiro")} className={`${botao} ${aba === "financeiro" ? "bg-emerald-700 text-white" : "bg-gray-100 text-gray-700"}`}>Financeiro</button><button type="button" onClick={() => setAba("operacional")} className={`${botao} ${aba === "operacional" ? "bg-emerald-700 text-white" : "bg-gray-100 text-gray-700"}`}>Banhos realizados</button></div>
              <input type="search" placeholder="Buscar por tutor, pet ou serviço" value={busca} onChange={e => setBusca(e.target.value)} className="mt-4 w-full rounded-xl border border-gray-200 p-3 text-sm" />
              <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[660px] text-left text-sm"><thead><tr className="border-b text-gray-500"><th className="py-3 pr-3">Data</th><th className="py-3 pr-3">Tutor / Pet</th><th className="py-3 pr-3">{aba === "financeiro" ? "Recebimento" : "Serviços / Plano"}</th><th className="py-3 pr-3">{aba === "financeiro" ? "Forma" : "Tipo"}</th>{aba === "financeiro" && <th className="py-3 text-right">Valor</th>}</tr></thead><tbody>{exibidos.map(r => <tr key={r.id} className="border-b align-top last:border-0"><td className="py-3 pr-3 whitespace-nowrap">{dataBR(r.data)}</td><td className="py-3 pr-3"><strong>{r.pet}</strong><p className="text-xs text-gray-500">{r.tutor}</p></td>{"descricao" in r ? <><td className="py-3 pr-3">{r.descricao}{r.dataAproximada && <p className="text-xs text-amber-700">Data provisória</p>}</td><td className="py-3 pr-3">{r.forma}</td><td className="py-3 text-right font-semibold">{moeda(r.valor)}</td></> : <><td className="py-3 pr-3">{r.servicos.join(", ")}</td><td className="py-3 pr-3">{r.plano}</td></>}</tr>)}</tbody></table>{!registros.length && <p className="py-6 text-sm text-gray-500">Nenhum registro encontrado.</p>}</div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"><span className="text-gray-500">{registros.length} registro(s) · página {Math.min(pagina, totalPaginas)} de {totalPaginas}</span><div className="flex gap-2"><button type="button" disabled={pagina <= 1} onClick={() => setPagina(p => Math.max(1, p - 1))} className={`${botao} bg-gray-100 disabled:opacity-40`}>Anterior</button><button type="button" disabled={pagina >= totalPaginas} onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} className={`${botao} bg-gray-100 disabled:opacity-40`}>Próxima</button></div></div>
            </div>
          </>}
        </section>
      </div>
    </main>
  );
}
