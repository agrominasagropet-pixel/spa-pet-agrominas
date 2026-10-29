CREATE OR REPLACE FUNCTION public.renovar_ciclos_agrominas(
  p_registros jsonb,
  p_atualizacao_pet jsonb DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $agrominas$
DECLARE
  v_pet uuid;
  v_ciclo integer;
  v_total integer;
  v_plano text;
  v_quantidade integer;
  v_registro record;
  v_inseridos integer := 0;
BEGIN

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão não autenticada.';
  END IF;

  IF p_registros IS NULL
     OR jsonb_typeof(p_registros) <> 'array' THEN
    RAISE EXCEPTION 'Formato de registros inválido.';
  END IF;

  IF jsonb_array_length(p_registros) = 0 THEN
    RAISE EXCEPTION 'Nenhum banho informado.';
  END IF;

  IF jsonb_array_length(p_registros) > 40 THEN
    RAISE EXCEPTION 'Quantidade de banhos acima do permitido.';
  END IF;

  -- Bloqueia os pets para impedir renovações simultâneas.
  FOR v_pet IN
    SELECT DISTINCT (r->>'pet_id')::uuid
    FROM jsonb_array_elements(p_registros) AS r
    ORDER BY 1
  LOOP

    PERFORM 1
    FROM public.pets
    WHERE id = v_pet
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Pet não encontrado ou sem permissão.';
    END IF;

  END LOOP;

  -- Valida cada ciclo informado.
  FOR v_pet, v_ciclo, v_plano, v_total, v_quantidade IN

    SELECT
      (r->>'pet_id')::uuid,
      (r->>'ciclo')::integer,
      MIN(r->>'plano'),
      COUNT(*)::integer,
      COUNT(DISTINCT (r->>'numero_banho')::integer)::integer
    FROM jsonb_array_elements(p_registros) AS r
    GROUP BY 1, 2

  LOOP

    IF v_ciclo IS NULL OR v_ciclo < 1 THEN
      RAISE EXCEPTION 'Número do ciclo inválido.';
    END IF;

    IF v_plano NOT IN ('Mensal', 'Quinzenal')
       OR v_plano IS NULL THEN
      RAISE EXCEPTION 'Tipo de plano inválido.';
    END IF;

    IF v_plano = 'Mensal' AND v_total <> 4 THEN
      RAISE EXCEPTION 'Plano mensal precisa ter 4 banhos.';
    END IF;

    IF v_plano = 'Quinzenal' AND v_total <> 2 THEN
      RAISE EXCEPTION 'Plano quinzenal precisa ter 2 banhos.';
    END IF;

    IF v_quantidade <> v_total THEN
      RAISE EXCEPTION 'Numeração de banhos duplicada.';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_registros) AS r
      WHERE (r->>'pet_id')::uuid = v_pet
        AND (r->>'ciclo')::integer = v_ciclo
        AND (
          (r->>'plano') IS DISTINCT FROM v_plano
          OR (r->>'numero_banho')::integer NOT BETWEEN 1 AND v_total
          OR (r->>'numero_banho') IS NULL
        )
    ) THEN
      RAISE EXCEPTION 'Dados inconsistentes no ciclo %.', v_ciclo;
    END IF;

    -- Impede criar um ciclo que já existe ou foi ultrapassado.
    IF EXISTS (
      SELECT 1
      FROM public.agendamentos AS a
      WHERE a.pet_id = v_pet
        AND a.ciclo IS NOT NULL
        AND a.ciclo >= v_ciclo
        AND LOWER(COALESCE(a.status, ''))
            NOT IN ('cancelado', 'cancelada')
    ) THEN
      RAISE EXCEPTION
        'Já existe este ciclo ou um ciclo posterior para o pet %.',
        v_pet;
    END IF;

    -- Impede datas já ocupadas pelo mesmo pet.
    IF EXISTS (
      SELECT 1
      FROM public.agendamentos AS a
      JOIN jsonb_array_elements(p_registros) AS r
        ON a.pet_id = (r->>'pet_id')::uuid
       AND a.data = (r->>'data')::date
      WHERE a.pet_id = v_pet
        AND LOWER(COALESCE(a.status, ''))
            NOT IN ('cancelado', 'cancelada')
    ) THEN
      RAISE EXCEPTION
        'Já existe um agendamento em uma das datas escolhidas.';
    END IF;

  END LOOP;

  -- Insere os banhos.
  FOR v_registro IN

    SELECT *
    FROM jsonb_to_recordset(p_registros) AS x(
      pet_id uuid,
      servico_id uuid,
      servico_nome text,
      observacoes text,
      valor_total numeric,
      data date,
      horario time,
      status text,
      plano text,
      numero_banho integer,
      ciclo integer,
      pagamento_status text,
      forma_pagamento_plano text
    )

  LOOP

    IF v_registro.data IS NULL
       OR v_registro.horario IS NULL
       OR v_registro.valor_total IS NULL
       OR v_registro.valor_total < 0
       OR v_registro.status IS DISTINCT FROM 'Agendado'
       OR v_registro.pagamento_status IS DISTINCT FROM 'Pendente'
       OR v_registro.forma_pagamento_plano IS NOT NULL
    THEN
      RAISE EXCEPTION 'Dados de agendamento inválidos.';
    END IF;

    INSERT INTO public.agendamentos (
      pet_id,
      servico_id,
      servico_nome,
      observacoes,
      valor_total,
      data,
      horario,
      status,
      plano,
      numero_banho,
      ciclo,
      pagamento_status,
      forma_pagamento_plano
    )
    VALUES (
      v_registro.pet_id,
      v_registro.servico_id,
      v_registro.servico_nome,
      v_registro.observacoes,
      v_registro.valor_total,
      v_registro.data,
      v_registro.horario,
      'Agendado',
      v_registro.plano,
      v_registro.numero_banho,
      v_registro.ciclo,
      'Pendente',
      NULL
    );

    v_inseridos := v_inseridos + 1;

  END LOOP;

  -- Atualiza o cadastro quando a renovação solicitar.
  IF p_atualizacao_pet IS NOT NULL THEN

    IF (p_atualizacao_pet->>'pet_id') IS NULL THEN
      RAISE EXCEPTION 'Pet da atualização não informado.';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_registros) AS r
      WHERE r->>'pet_id' = p_atualizacao_pet->>'pet_id'
    ) THEN
      RAISE EXCEPTION 'Pet da atualização não corresponde à renovação.';
    END IF;

    IF (p_atualizacao_pet->>'frequencia') IS NULL
       OR p_atualizacao_pet->>'frequencia'
          NOT IN ('Mensal', 'Quinzenal') THEN
      RAISE EXCEPTION 'Frequência inválida.';
    END IF;

    UPDATE public.pets
    SET
      frequencia = p_atualizacao_pet->>'frequencia',
      data_inicio = (p_atualizacao_pet->>'data_inicio')::date,
      turno = p_atualizacao_pet->>'turno',
      valor_total = (p_atualizacao_pet->>'valor_total')::numeric
    WHERE id = (p_atualizacao_pet->>'pet_id')::uuid;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Não foi possível atualizar o cadastro do pet.';
    END IF;

  END IF;

  RETURN v_inseridos;

END;
$agrominas$;

REVOKE ALL
ON FUNCTION public.renovar_ciclos_agrominas(jsonb, jsonb)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.renovar_ciclos_agrominas(jsonb, jsonb)
TO authenticated;