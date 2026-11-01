-- Carga da estrutura institucional aprovada (decisão D-001): o Comitê de
-- Desenvolvimento e os três comitês temáticos a ele subordinados.
-- Identificadores fixos, para que possam ser referenciados com segurança.

INSERT INTO comite (id, nome, tipo, comite_superior_id) VALUES
  ('0c000000-0000-4000-8000-000000000001', 'Comitê de Desenvolvimento', 'desenvolvimento', NULL);
--> statement-breakpoint
INSERT INTO comite (id, nome, tipo, comite_superior_id) VALUES
  ('0c000000-0000-4000-8000-000000000002', 'Comitê Temático de Infraestrutura', 'tematico', '0c000000-0000-4000-8000-000000000001'),
  ('0c000000-0000-4000-8000-000000000003', 'Comitê Temático de Atração de Investimentos', 'tematico', '0c000000-0000-4000-8000-000000000001'),
  ('0c000000-0000-4000-8000-000000000004', 'Comitê Temático de Inovação', 'tematico', '0c000000-0000-4000-8000-000000000001');
