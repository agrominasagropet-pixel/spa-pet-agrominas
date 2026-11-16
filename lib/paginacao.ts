// O chamador deve ordenar por chave única (ou acrescentá-la como desempate).
// Uma falha descarta o carregamento: não devolver uma lista parcial como completa.
export async function paginar<T>(
  consultar: (inicio: number, fim: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  contexto: string,
) {
  const data: T[] = [];
  const tamanho = 500;
  for (let inicio = 0; ; inicio += tamanho) {
    const resposta = await consultar(inicio, inicio + tamanho - 1);
    if (resposta.error) throw new Error(`${contexto}: ${resposta.error.message}`);
    if (!resposta.data) throw new Error(`${contexto}: resposta de leitura não confirmada.`);
    data.push(...resposta.data);
    if (resposta.data.length < tamanho) break;
  }
  return { data, error: null };
}
