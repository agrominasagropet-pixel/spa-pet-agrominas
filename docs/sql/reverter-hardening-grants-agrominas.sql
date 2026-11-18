BEGIN;

DO $rollback$
DECLARE
  v_item record;
  v_entry jsonb;
  v_relacao regclass;
  v_funcao regprocedure;
  v_grantee text;
  v_privilegio text;
  v_grant_option text;
  v_objeto text;
  v_quantidade integer;
BEGIN
  IF to_regclass('public._acl_snapshot_20261118110000') IS NULL THEN
    RAISE EXCEPTION
      'Snapshot ACL da migration não encontrado; rollback cancelado sem alterar privilégios.';
  END IF;

  SELECT count(*) INTO v_quantidade
  FROM public._acl_snapshot_20261118110000;
  IF v_quantidade <> 16 THEN
    RAISE EXCEPTION
      'Snapshot ACL incompleto (esperadas 16 entradas de objeto, encontradas %); rollback cancelado.',
      v_quantidade;
  END IF;

  FOR v_item IN
    SELECT object_type, object_identity, acl_entries
    FROM public._acl_snapshot_20261118110000
    ORDER BY object_type, object_identity
  LOOP
    IF v_item.object_type = 'table' THEN
      v_relacao := to_regclass(v_item.object_identity);
      IF v_relacao IS NULL THEN
        RAISE EXCEPTION
          'Tabela % do snapshot não encontrada; rollback cancelado.',
          v_item.object_identity;
      END IF;

      v_objeto := v_relacao::text;
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON TABLE %s FROM anon, authenticated',
        v_objeto
      );
    ELSE
      v_funcao := to_regprocedure(v_item.object_identity);
      IF v_funcao IS NULL THEN
        RAISE EXCEPTION
          'Função % do snapshot não encontrada; rollback cancelado.',
          v_item.object_identity;
      END IF;

      v_objeto := v_funcao::text;
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON FUNCTION %s FROM PUBLIC, anon, authenticated',
        v_objeto
      );
    END IF;

    FOR v_entry IN
      SELECT value FROM jsonb_array_elements(v_item.acl_entries)
    LOOP
      v_grantee := v_entry->>'grantee';
      v_privilegio := v_entry->>'privilege';
      v_grant_option := CASE
        WHEN (v_entry->>'grantable')::boolean THEN ' WITH GRANT OPTION'
        ELSE ''
      END;

      IF v_grantee NOT IN ('PUBLIC', 'anon', 'authenticated') THEN
        RAISE EXCEPTION
          'Grantee inesperado no snapshot (%); rollback cancelado.',
          v_grantee;
      END IF;

      IF v_item.object_type = 'table' THEN
        IF v_privilegio NOT IN (
          'SELECT', 'INSERT', 'UPDATE', 'DELETE',
          'TRUNCATE', 'REFERENCES', 'TRIGGER'
        ) THEN
          RAISE EXCEPTION
            'Privilégio de tabela inesperado no snapshot (%); rollback cancelado.',
            v_privilegio;
        END IF;
      ELSIF v_privilegio <> 'EXECUTE' THEN
        RAISE EXCEPTION
          'Privilégio de função inesperado no snapshot (%); rollback cancelado.',
          v_privilegio;
      END IF;

      IF v_grantee = 'PUBLIC' THEN
        EXECUTE format(
          'GRANT %s ON %s %s TO PUBLIC%s',
          v_privilegio,
          CASE WHEN v_item.object_type = 'table' THEN 'TABLE' ELSE 'FUNCTION' END,
          v_objeto,
          v_grant_option
        );
      ELSE
        EXECUTE format(
          'GRANT %s ON %s %s TO %I%s',
          v_privilegio,
          CASE WHEN v_item.object_type = 'table' THEN 'TABLE' ELSE 'FUNCTION' END,
          v_objeto,
          v_grantee,
          v_grant_option
        );
      END IF;
    END LOOP;
  END LOOP;

  DROP TABLE public._acl_snapshot_20261118110000;
END;
$rollback$;

COMMIT;
