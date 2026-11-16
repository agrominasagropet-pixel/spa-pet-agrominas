// O cadastro persiste a coluna "raça"; o alias mantém o nome usado na interface.
export const CAMPOS_PETS_AGENDA = 'id, nome, cliente_id, sexo, raca:"raça"';

export class ErroLeituraAgenda extends Error {}

export function confirmarLeituraAgenda(
  resposta: { data: unknown[] | null; error: unknown },
  entidade: string,
) {
  if (resposta.error || !resposta.data) {
    throw new ErroLeituraAgenda(
      `Não foi possível carregar ${entidade}. Verifique sua sessão e as permissões de leitura ou tente novamente.`,
    );
  }
}

export function associarDadosAgenda<
  C extends { id: string; nome: string; whatsapp: string | null; telefone: string | null },
  P extends { id: string; nome: string; cliente_id: string; raca: string | null },
  A extends { pet_id: string },
>(clientes: C[], pets: P[], agendamentos: A[]) {
  const clientesPorId = new Map(clientes.map(cliente => [cliente.id, cliente]));
  const petsFormatados = pets.map(pet => {
    const cliente = clientesPorId.get(pet.cliente_id);
    if (!cliente || !cliente.nome?.trim() || !pet.nome?.trim()) {
      throw new ErroLeituraAgenda("Não foi possível identificar o pet e seu tutor. Confira os cadastros e as permissões de leitura de clientes e pets.");
    }
    return {
      ...pet,
      raca: pet.raca?.trim() || null,
      tutorNome: cliente.nome,
      whatsapp: cliente.whatsapp || cliente.telefone || "",
    };
  });
  const petsPorId = new Map(petsFormatados.map(pet => [pet.id, pet]));
  const agendamentosFormatados = agendamentos.map(agendamento => {
    const pet = petsPorId.get(agendamento.pet_id);
    if (!pet) {
      throw new ErroLeituraAgenda("Há agendamentos cujo pet não pôde ser consultado. Confira os cadastros e as permissões de leitura de pets antes de continuar.");
    }
    return { ...agendamento, petNome: pet.nome, tutorNome: pet.tutorNome, whatsapp: pet.whatsapp };
  });
  return { petsFormatados, agendamentosFormatados };
}
