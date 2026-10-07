"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const itensMenu = [
  {
    nome: "Início",
    href: "/",
    icone: "🏠",
  },
  {
    nome: "Agenda",
    href: "/agenda",
    icone: "📅",
  },
  {
    nome: "Clientes & Pets",
    href: "/clientes-pets",
    icone: "👥",
  },
  {
    nome: "Relatórios",
    href: "/relatorios",
    icone: "📊",
  },
  {
    nome: "Configurações",
    href: "/configuracoes",
    icone: "⚙️",
  },
];

export default function MenuLateral() {
  const pathname = usePathname();
  const router = useRouter();

  const [saindo, setSaindo] = useState(false);
  const [nomeUsuario, setNomeUsuario] = useState("");
  const [tipoUsuario, setTipoUsuario] = useState("");

  useEffect(() => {
    carregarUsuario();
  }, []);

  async function carregarUsuario() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return;
    }

    const { data: perfil } = await supabase
      .from("perfis")
      .select("nome, perfil")
      .eq("id", session.user.id)
      .maybeSingle();

    if (!perfil) {
      return;
    }

    setNomeUsuario(perfil.nome);

    setTipoUsuario(
      perfil.perfil === "admin"
        ? "Administrador"
        : "Operacional"
    );
  }

  async function sair() {
    setSaindo(true);

    await supabase.auth.signOut();

    router.replace("/login");
  }

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-gray-200 bg-white">
      {/* CABEÇALHO */}
      <div className="shrink-0 p-6">
        <h1 className="text-2xl font-bold text-gray-900">
          SPA PET
        </h1>

        <p className="text-sm font-medium text-gray-500">
          AGROMINAS
        </p>

        {/* USUÁRIO LOGADO */}
        {nomeUsuario && (
          <div className="mt-5 rounded-xl bg-gray-50 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-900 text-sm font-bold text-white">
                {nomeUsuario.charAt(0).toUpperCase()}
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">
                  {nomeUsuario}
                </p>

                <p className="text-xs text-gray-500">
                  {tipoUsuario}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={sair}
              disabled={saindo}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
            >
              <span>🚪</span>

              <span>
                {saindo ? "Saindo..." : "Sair"}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* MENU */}
      <nav className="flex-1 overflow-y-auto space-y-2 px-4">
        {itensMenu.map((item) => {
          const ativo =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                ativo
                  ? "flex items-center gap-3 rounded-xl bg-gray-100 px-4 py-3 font-medium text-gray-900"
                  : "flex items-center gap-3 rounded-xl px-4 py-3 text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
              }
            >
              <span className="text-lg">
                {item.icone}
              </span>

              <span>{item.nome}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}