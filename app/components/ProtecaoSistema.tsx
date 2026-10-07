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

  const [carregando, setCarregando] = useState(true);
  const [autorizado, setAutorizado] = useState(false);

  useEffect(() => {
    verificarAcesso();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      verificarAcesso();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [pathname]);

  async function verificarAcesso() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      if (pathname !== "/login") {
        router.replace("/login");
      }

      setAutorizado(pathname === "/login");
      setCarregando(false);

      return;
    }

    if (pathname === "/login") {
      router.replace("/");
      setAutorizado(false);
      setCarregando(false);

      return;
    }

    const { data: perfil } = await supabase
      .from("perfis")
      .select("nome, perfil")
      .eq("id", session.user.id)
      .maybeSingle();

    if (!perfil) {
      await supabase.auth.signOut();
      router.replace("/login");
      setAutorizado(false);
      setCarregando(false);

      return;
    }

    const perfilAtual = perfil as Perfil;

    const paginasRestritas = [
      "/relatorios",
      "/configuracoes",
    ];

    const paginaRestrita = paginasRestritas.some(
      (pagina) =>
        pathname === pagina ||
        pathname.startsWith(`${pagina}/`)
    );

    if (
      perfilAtual.perfil === "operacional" &&
      paginaRestrita
    ) {
      router.replace("/");
      setAutorizado(false);
      setCarregando(false);

      return;
    }

    setAutorizado(true);
    setCarregando(false);
  }

  if (carregando) {
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

  if (!autorizado) {
    return null;
  }

  return <>{children}</>;
}