
"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type PerfilAcesso = "admin" | "operacional" | null;

const itensMenu = [
  { nome: "Início", href: "/", icone: "🏠", somenteAdmin: false },
  { nome: "Agenda", href: "/agenda", icone: "📅", somenteAdmin: false },
  { nome: "Clientes & Pets", href: "/clientes-pets", icone: "🐾", somenteAdmin: false },
  { nome: "Pagamentos", href: "/pagamentos", icone: "💳", somenteAdmin: true },
  { nome: "Relatórios", href: "/relatorios", icone: "📊", somenteAdmin: true },
  { nome: "Configurações", href: "/configuracoes", icone: "⚙️", somenteAdmin: true },
];

export default function MenuLateral() {
  const pathname = usePathname();
  const router = useRouter();

  const [saindo, setSaindo] = useState(false);
  const [nomeUsuario, setNomeUsuario] = useState("");
  const [perfilUsuario, setPerfilUsuario] = useState<PerfilAcesso>(null);
  const [carregandoPerfil, setCarregandoPerfil] = useState(true);
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => {
    let ativo = true;

    async function carregarUsuario() {
      if (!ativo) return;

      setCarregandoPerfil(true);
      setPerfilUsuario(null);
      setNomeUsuario("");

      try {
        const {
          data: { session },
          error: erroSessao,
        } = await supabase.auth.getSession();

        if (erroSessao) throw erroSessao;
        if (!ativo) return;

        if (!session?.user) {
          setCarregandoPerfil(false);
          return;
        }

        const { data: perfil, error: erroPerfil } =
          await supabase
            .from("perfis")
            .select("nome, perfil")
            .eq("id", session.user.id)
            .maybeSingle();

        if (erroPerfil) throw erroPerfil;
        if (!ativo) return;

        setNomeUsuario(perfil?.nome || "");

        if (
          perfil?.perfil === "admin" ||
          perfil?.perfil === "operacional"
        ) {
          setPerfilUsuario(perfil.perfil);
        }
      } catch (erro) {
        console.error("Não foi possível carregar o perfil:", erro);
      } finally {
        if (ativo) setCarregandoPerfil(false);
      }
    }

    void carregarUsuario();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      setTimeout(() => {
        if (ativo) void carregarUsuario();
      }, 0);
    });

    return () => {
      ativo = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setMenuAberto(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuAberto) return;

    const aoPressionar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") {
        setMenuAberto(false);
      }
    };

    window.addEventListener("keydown", aoPressionar);

    return () => {
      window.removeEventListener("keydown", aoPressionar);
    };
  }, [menuAberto]);

  async function sair() {
    if (saindo) return;

    setSaindo(true);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      setPerfilUsuario(null);
      setNomeUsuario("");

      router.replace("/login");
      router.refresh();
    } catch (erro) {
      console.error("Erro ao sair:", erro);
      alert("Não foi possível sair. Tente novamente.");
      setSaindo(false);
    }
  }

  const itensVisiveis = perfilUsuario
    ? itensMenu.filter(
        (item) =>
          !item.somenteAdmin ||
          perfilUsuario === "admin"
      )
    : [];

  const tipoUsuario =
    perfilUsuario === "admin"
      ? "Administrador"
      : "Operacional";

  const conteudo = (
    <>
      {/* LOGO OFICIAL AGROMINAS */}
      <div className="border-b border-emerald-900/10 px-5 pb-5 pt-7">
        <Link
          href="/"
          onClick={() => setMenuAberto(false)}
          className="flex flex-col items-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <Image
            src="/logo-agrominas.jpg"
            alt="Logo oficial AGROMINAS Agropecuária"
            width={230}
            height={230}
            priority
            className="h-auto w-full max-w-[185px] object-contain"
          />

          <p className="mt-1 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-800">
            SPA PET AGROMINAS
          </p>

          <p className="mt-1 text-center text-[11px] text-slate-500">
            Gestão de banho e tosa
          </p>
        </Link>
      </div>

      {/* NAVEGAÇÃO */}
      <nav
        className="min-h-0 flex-1 overflow-y-auto px-3 py-6"
        aria-label="Navegação principal"
      >
        <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
          Menu principal
        </p>

        {carregandoPerfil ? (
          <p className="px-3 text-sm text-slate-500">
            Carregando menu...
          </p>
        ) : !perfilUsuario ? (
          <p className="rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-800">
            Não foi possível identificar as permissões desta conta.
          </p>
        ) : (
          <div className="space-y-1.5">
            {itensVisiveis.map((item) => {
              const ativo =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuAberto(false)}
                  aria-current={
                    ativo ? "page" : undefined
                  }
                  className={`group flex min-h-12 items-center gap-3 rounded-xl border-l-[3px] px-3 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                    ativo
                      ? "border-emerald-600 bg-emerald-100 text-emerald-950"
                      : "border-transparent text-slate-600 hover:bg-emerald-50 hover:text-emerald-900"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg ${
                      ativo
                        ? "bg-white/80"
                        : "bg-slate-100 group-hover:bg-white"
                    }`}
                    aria-hidden="true"
                  >
                    {item.icone}
                  </span>

                  <span className="flex-1">
                    {item.nome}
                  </span>

                  {ativo && (
                    <span
                      className="h-2 w-2 rounded-full bg-emerald-600"
                      aria-hidden="true"
                    />
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* USUÁRIO E SAIR */}
      <div className="border-t border-emerald-900/10 p-4">
        {nomeUsuario && perfilUsuario ? (
          <div className="rounded-2xl border border-emerald-100 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-sm font-extrabold text-white"
                aria-hidden="true"
              >
                {nomeUsuario
                  .charAt(0)
                  .toLocaleUpperCase("pt-BR")}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-800">
                  {nomeUsuario}
                </p>

                <p className="text-xs text-slate-500">
                  {tipoUsuario}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void sair()}
              disabled={saindo}
              className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-wait disabled:opacity-50"
            >
              {saindo
                ? "Saindo..."
                : "↪ Sair da conta"}
            </button>
          </div>
        ) : (
          <div className="text-center">
            <p className="px-2 text-xs text-slate-400">
              SPA PET AGROMINAS
            </p>

            {!carregandoPerfil && (
              <button
                type="button"
                onClick={() => void sair()}
                disabled={saindo}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 disabled:opacity-50"
              >
                {saindo
                  ? "Saindo..."
                  : "↪ Sair da conta"}
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* BOTÃO DO MENU NO CELULAR */}
      <button
        type="button"
        onClick={() => setMenuAberto(true)}
        aria-label="Abrir menu"
        aria-expanded={menuAberto}
        aria-controls="menu-agrominas-mobile"
        className="fixed left-3 top-3 z-40 flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-200 bg-white text-xl text-emerald-900 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 md:hidden"
      >
        ☰
      </button>

      {/* MENU MOBILE */}
      {menuAberto && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/50"
            onClick={() => setMenuAberto(false)}
            aria-label="Fechar menu"
          />

          <aside
            id="menu-agrominas-mobile"
            className="absolute inset-y-0 left-0 flex w-[min(85vw,290px)] flex-col bg-[#f7faf8] shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setMenuAberto(false)}
              aria-label="Fechar menu"
              className="absolute right-3 top-3 z-10 rounded-lg px-2 py-1 text-2xl text-slate-500 hover:bg-emerald-50"
            >
              ×
            </button>

            {conteudo}
          </aside>
        </div>
      )}

      {/* MENU DESKTOP */}
      <aside className="sticky top-0 hidden h-screen w-[268px] shrink-0 flex-col border-r border-emerald-100 bg-[#f7faf8] md:flex">
        {conteudo}
      </aside>
    </>
  );
}
