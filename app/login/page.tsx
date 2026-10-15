
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const USUARIOS: Record<string, string> = {
  juliana: "juliana@spa-pet-agrominas.local",
  spapet: "spa@spa-pet-agrominas.local",
};

export default function LoginPage() {
  const router = useRouter();

  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [entrando, setEntrando] = useState(false);

  async function entrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (entrando) return;

    setErro("");

    const nomeDigitado = usuario.trim().toLowerCase();

    if (!nomeDigitado || !senha) {
      setErro("Digite o usuário e a senha.");
      return;
    }

    const email = USUARIOS[nomeDigitado];

    if (!email) {
      setErro("Usuário ou senha inválidos.");
      return;
    }

    setEntrando(true);

    try {
      // Primeiro autentica o usuário e a senha.
      const { data, error: erroLogin } =
        await supabase.auth.signInWithPassword({
          email,
          password: senha,
        });

      if (erroLogin || !data.user) {
        setErro("Usuário ou senha inválidos.");
        return;
      }

      // Somente após autenticar, consulta o perfil.
      const { data: perfil, error: erroPerfil } =
        await supabase
          .from("perfis")
          .select("id, nome, perfil")
          .eq("id", data.user.id)
          .maybeSingle();

      if (
        erroPerfil ||
        !perfil ||
        !["admin", "operacional"].includes(perfil.perfil)
      ) {
        await supabase.auth.signOut();
        setErro("Usuário sem permissão para acessar o sistema.");
        return;
      }

      setSenha("");
      setErro("");

      router.replace("/");
      router.refresh();
    } catch (error) {
      console.error("Erro no login:", error);
      setErro("Não foi possível entrar. Tente novamente.");
    } finally {
      setEntrando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f2f8f4] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-emerald-100 bg-white p-7 shadow-xl shadow-emerald-900/5 sm:p-9">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-700 text-3xl text-white shadow-sm">
              🐾
            </div>

            <p className="mt-5 text-xs font-bold uppercase tracking-[0.22em] text-emerald-700">
              SPA PET
            </p>

            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-emerald-950">
              AGROMINAS
            </h1>

            <p className="mt-3 text-sm text-slate-500">
              Gestão de banho e tosa
            </p>
          </div>

          <form
            onSubmit={entrar}
            autoComplete="off"
            className="mt-8 space-y-5"
          >
            <div>
              <label
                htmlFor="usuario"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Usuário
              </label>

              <input
                id="usuario"
                name="agrominas_usuario"
                type="text"
                value={usuario}
                onChange={(event) =>
                  setUsuario(event.target.value)
                }
                placeholder="Digite seu usuário"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label
                htmlFor="senha"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Senha
              </label>

              <input
                id="senha"
                name="agrominas_senha"
                type="password"
                value={senha}
                onChange={(event) =>
                  setSenha(event.target.value)
                }
                placeholder="Digite sua senha"
                autoComplete="off"
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            {erro && (
              <p
                role="alert"
                className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700"
              >
                {erro}
              </p>
            )}

            <button
              type="submit"
              disabled={entrando}
              className="w-full rounded-xl bg-emerald-700 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"
            >
              {entrando
                ? "Entrando..."
                : "Entrar no sistema"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          SPA PET AGROMINAS • Banho e Tosa
        </p>
      </div>
    </main>
  );
}
