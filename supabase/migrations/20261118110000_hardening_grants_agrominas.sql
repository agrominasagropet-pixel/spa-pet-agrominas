BEGIN;

CREATE TABLE public._acl_snapshot_20261118110000 (
  object_type text NOT NULL CHECK (object_type IN ('table', 'function')),
  object_identity text NOT NULL,
  acl_entries jsonb NOT NULL,
  PRIMARY KEY (object_type, object_identity)
);

REVOKE ALL PRIVILEGES
ON TABLE public._acl_snapshot_20261118110000
FROM PUBLIC, anon, authenticated;

DO $agrominas$
DECLARE
  v_tabela text;
  v_relacao regclass;
  v_rls_ativo boolean;
  v_funcao regprocedure;
  v_assinatura text;
  v_anon_esperado boolean;
  v_funcoes text[][] := ARRAY[
    ARRAY['public.converter_avulso_em_plano_agrominas(uuid,text,numeric,text)', 'true'],
    ARRAY['public.desfazer_pagamento_agrominas(text,uuid,text)', 'false'],
    ARRAY['public.proteger_pagamento_atendimento()', 'true'],
    ARRAY['public.proteger_pagamento_novo_agendamento()', 'true'],
    ARRAY['public.proteger_pagamentos_agendamentos()', 'true'],
    ARRAY['public.proteger_valor_agendamento()', 'true'],
    ARRAY['public.proteger_valor_atendimento()', 'true'],
    ARRAY['public.receber_extras_agrominas(uuid[],text,date)', 'true'],
    ARRAY['public.receber_saldo_conversao_agrominas(uuid,numeric,text)', 'true'],
    ARRAY['public.registrar_pagamento_plano_agrominas(uuid,integer,numeric,text,date,boolean)', 'false'],
    ARRAY['public.renovar_ciclos_agrominas(jsonb,jsonb)', 'false'],
    ARRAY['public.usuario_e_admin()', 'true']
  ];
  v_item text[];
  v_acl jsonb;
  v_owner oid;
BEGIN
  FOREACH v_tabela IN ARRAY ARRAY[
    'backup_agendamentos_0800_20261020',
    'conversoes_avulso_plano',
    'recebimentos_parciais_planos',
    'servicos_extras_agendamento'
  ]
  LOOP
    v_relacao := to_regclass(format('public.%I', v_tabela));
    IF v_relacao IS NULL THEN
      RAISE EXCEPTION 'Tabela public.% não encontrada; migration cancelada.', v_tabela;
    END IF;

    SELECT c.relrowsecurity, c.relowner
    INTO v_rls_ativo, v_owner
    FROM pg_catalog.pg_class AS c
    WHERE c.oid = v_relacao;

    IF NOT v_rls_ativo THEN
      RAISE EXCEPTION
        'RLS não está ativo em public.%; migration cancelada.',
        v_tabela;
    END IF;

    SELECT COALESCE(
      jsonb_agg(jsonb_build_object(
        'grantee', CASE WHEN acl.grantee = 0 THEN 'PUBLIC' ELSE r.rolname END,
        'privilege', acl.privilege_type,
        'grantable', acl.is_grantable
      )),
      '[]'::jsonb
    )
    INTO v_acl
    FROM pg_catalog.pg_class AS c
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(c.relacl, pg_catalog.acldefault('r', c.relowner))
    ) AS acl
    LEFT JOIN pg_catalog.pg_roles AS r ON r.oid = acl.grantee
    WHERE c.oid = v_relacao
      AND acl.grantee IN (
        0,
        (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'anon'),
        (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'authenticated')
      );

    INSERT INTO public._acl_snapshot_20261118110000
      (object_type, object_identity, acl_entries)
    VALUES ('table', format('public.%I', v_tabela), v_acl);

    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_acl) AS entry
      WHERE entry->>'grantee' = 'PUBLIC'
    ) THEN
      RAISE EXCEPTION
        'public.% possui grants diretos a PUBLIC não contemplados na auditoria; migration cancelada.',
        v_tabela;
    END IF;
  END LOOP;

  FOREACH v_item SLICE 1 IN ARRAY v_funcoes
  LOOP
    v_assinatura := v_item[1];
    v_anon_esperado := v_item[2]::boolean;
    v_funcao := to_regprocedure(v_assinatura);
    IF v_funcao IS NULL THEN
      RAISE EXCEPTION
        'Função % não encontrada; migration cancelada.',
        v_assinatura;
    END IF;

    IF has_function_privilege('anon', v_funcao, 'EXECUTE')
         IS DISTINCT FROM v_anon_esperado
       OR NOT has_function_privilege('authenticated', v_funcao, 'EXECUTE')
    THEN
      RAISE EXCEPTION
        'Privilégio EXECUTE efetivo de anon/authenticated diverge da auditoria para %; migration cancelada.',
        v_assinatura;
    END IF;

    SELECT p.proowner
    INTO v_owner
    FROM pg_catalog.pg_proc AS p
    WHERE p.oid = v_funcao;

    SELECT COALESCE(
      jsonb_agg(jsonb_build_object(
        'grantee', CASE WHEN acl.grantee = 0 THEN 'PUBLIC' ELSE r.rolname END,
        'privilege', acl.privilege_type,
        'grantable', acl.is_grantable
      )),
      '[]'::jsonb
    )
    INTO v_acl
    FROM pg_catalog.pg_proc AS p
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))
    ) AS acl
    LEFT JOIN pg_catalog.pg_roles AS r ON r.oid = acl.grantee
    WHERE p.oid = v_funcao
      AND acl.grantee IN (
        0,
        (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'anon'),
        (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'authenticated')
      );

    INSERT INTO public._acl_snapshot_20261118110000
      (object_type, object_identity, acl_entries)
    VALUES ('function', v_assinatura, v_acl);
  END LOOP;
END;
$agrominas$;

REVOKE ALL PRIVILEGES
ON TABLE
  public.backup_agendamentos_0800_20261020,
  public.conversoes_avulso_plano,
  public.recebimentos_parciais_planos,
  public.servicos_extras_agendamento
FROM anon, authenticated;

GRANT SELECT
ON TABLE
  public.conversoes_avulso_plano,
  public.recebimentos_parciais_planos
TO authenticated;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.servicos_extras_agendamento
TO authenticated;

REVOKE ALL PRIVILEGES
ON FUNCTION
  public.converter_avulso_em_plano_agrominas(uuid, text, numeric, text),
  public.desfazer_pagamento_agrominas(text, uuid, text),
  public.proteger_pagamento_atendimento(),
  public.proteger_pagamento_novo_agendamento(),
  public.proteger_pagamentos_agendamentos(),
  public.proteger_valor_agendamento(),
  public.proteger_valor_atendimento(),
  public.receber_extras_agrominas(uuid[], text, date),
  public.receber_saldo_conversao_agrominas(uuid, numeric, text),
  public.registrar_pagamento_plano_agrominas(uuid, integer, numeric, text, date, boolean),
  public.renovar_ciclos_agrominas(jsonb, jsonb),
  public.usuario_e_admin()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION
  public.converter_avulso_em_plano_agrominas(uuid, text, numeric, text),
  public.desfazer_pagamento_agrominas(text, uuid, text),
  public.receber_extras_agrominas(uuid[], text, date),
  public.receber_saldo_conversao_agrominas(uuid, numeric, text),
  public.registrar_pagamento_plano_agrominas(uuid, integer, numeric, text, date, boolean),
  public.renovar_ciclos_agrominas(jsonb, jsonb),
  public.usuario_e_admin()
TO authenticated;

COMMIT;
