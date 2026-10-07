"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [entrando, setEntrando] = useState(false);

  async function entrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErro("");

    const nomeDigitado = usuario.trim();

    if (!nomeDigitado || !senha) {
      setErro("Digite o usuário e a senha.");
      return;
    }

    setEntrando(true);

    const { data: perfil, error: erroPerfil } = await supabase
      .from("perfis")
      .select("id, nome, perfil")
      .ilike("nome", nomeDigitado)
      .maybeSingle();

    if (erroPerfil || !perfil) {
      setErro("Usuário ou senha inválidos.");
      setEntrando(false);
      return;
    }

    let email = "";

    if (perfil.nome.toLowerCase() === "juliana") {
      email = "juliana@spa-pet-agrominas.local";
    }

    if (perfil.nome.toLowerCase() === "spapet") {
  email = "spa@spa-pet-agrominas.local";
}

    if (!email) {
      setErro("Usuário não configurado.");
      setEntrando(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      setErro("Usuário ou senha inválidos.");
      setEntrando(false);
      return;
    }

    router.replace("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 px-6">
      <div className="w-full max-w-md">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-900 text-3xl">
              🐾
            </div>

            <h1 className="mt-6 text-3xl font-bold text-gray-900">
              SPA PET
            </h1>

            <p className="mt-1 text-sm font-semibold tracking-wide text-gray-500">
              AGROMINAS
            </p>

            <p className="mt-4 text-sm text-gray-500">
              Acesse o sistema de banho e tosa.
            </p>
          </div>

          <form
            onSubmit={entrar}
            className="mt-8 space-y-5"
          >
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Usuário
              </label>

              <input
                type="text"
                value={usuario}
                onChange={(event) =>
                  setUsuario(event.target.value)
                }
                placeholder="Digite seu usuário"
                autoComplete="username"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Senha
              </label>

              <input
                type="password"
                value={senha}
                onChange={(event) =>
                  setSenha(event.target.value)
                }
                placeholder="Digite sua senha"
                autoComplete="current-password"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-400"
              />
            </div>

            {erro && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={entrando}
              className="w-full rounded-xl bg-gray-900 px-5 py-3 font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {entrando ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          SPA PET AGROMINAS • Banho e Tosa
        </p>
      </div>
    </main>
  );
}