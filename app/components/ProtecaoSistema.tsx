"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Perfil = {
  nome: string;
  perfil: "admin" | "operacional";
};

export default function ProtecaoSistema({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [estado, setEstado] = useState<{
    pathname: string;
    autorizado: boolean;
  } | null>(null);

  useEffect(() => {
    let ativo = true;
    let sequencia = 0;

    async function verificarAcesso() {
      const tentativa = ++sequencia;
      const valido = () => ativo && tentativa === sequencia;

      try {
        const {
          data: { session },
          error: erroSessao,
        } = await supabase.auth.getSession();
        if (!valido()) return;
        if (erroSessao) {
          setEstado({ pathname, autorizado: false });
          return;
        }

        if (!session?.user) {
          if (pathname !== "/login") router.replace("/login");
          setEstado({ pathname, autorizado: pathname === "/login" });
          return;
        }

        if (pathname === "/login") {
          router.replace("/");
          setEstado({ pathname, autorizado: false });
          return;
        }

        const { data: perfil, error: erroPerfil } = await supabase
          .from("perfis")
          .select("nome, perfil")
          .eq("id", session.user.id)
          .maybeSingle();
        if (!valido()) return;

        if (erroPerfil) {
          // Falhas temporárias de consulta não devem encerrar a sessão.
          setEstado({ pathname, autorizado: false });
          return;
        }

        if (!perfil) {
          await supabase.auth.signOut();
          if (!valido()) return;
          router.replace("/login");
          setEstado({ pathname, autorizado: false });
          return;
        }

        const perfilAtual = perfil as Perfil;
        const paginasRestritas = ["/relatorios", "/configuracoes"];
        const paginaRestrita = paginasRestritas.some(
          (pagina) => pathname === pagina || pathname.startsWith(`${pagina}/`)
        );

        if (perfilAtual.perfil === "operacional" && paginaRestrita) {
          router.replace("/");
          setEstado({ pathname, autorizado: false });
          return;
        }

        setEstado({ pathname, autorizado: true });
      } catch {
        if (valido()) setEstado({ pathname, autorizado: false });
      }
    }

    void verificarAcesso();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      // Evita executar operações do Supabase sincronamente no callback de auth.
      setTimeout(() => {
        if (ativo) void verificarAcesso();
      }, 0);
    });

    return () => {
      ativo = false;
      sequencia++;
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  if (!estado || estado.pathname !== pathname) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="text-4xl">🐾</div>
          <p className="mt-4 text-sm text-gray-500">
            Carregando SPA PET AGROMINAS...
          </p>
        </div>
      </main>
    );
  }

  if (!estado.autorizado) return null;

  return <>{children}</>;
}
