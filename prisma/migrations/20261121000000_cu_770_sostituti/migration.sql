-- CU e 770 riguardano chi agisce da sostituto d'imposta, anche senza partita IVA (condomini, enti non
-- commerciali): il catalogo li limitava ai regimi ordinario e semplificato, quindi a un condominio
-- (normalmente "non titolare di partita IVA") non venivano mai generati.
-- Si aggiornano solo i due adempimenti rimasti con la regola originale: una regola già modificata a mano
-- dallo studio non viene toccata.
UPDATE "AdempimentoTemplate"
SET "regimi" = '["ORDINARIO","SEMPLIFICATO","NON_TITOLARE"]'
WHERE "codice" IN ('CU', 'MODELLO_770')
  AND "regimi" = '["ORDINARIO","SEMPLIFICATO"]';
