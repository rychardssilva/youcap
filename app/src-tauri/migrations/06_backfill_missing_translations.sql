INSERT INTO translations (id, word_id, language, translation, kind, source)
SELECT
  lower(hex(randomblob(16))),
  w.id,
  'pt-BR',
  trim(json_extract(lc.result_json, '$.translation')),
  'main',
  lc.source
FROM words w
INNER JOIN lookup_cache lc
  ON lower(w.normalized_term) = lower(trim(json_extract(lc.result_json, '$.word')))
  OR lower(w.normalized_term) = lower(trim(lc.normalized_query))
WHERE json_valid(lc.result_json)
  AND trim(COALESCE(json_extract(lc.result_json, '$.translation'), '')) != ''
  AND lower(trim(json_extract(lc.result_json, '$.translation'))) != lower('Tradução indisponível')
  AND NOT EXISTS (
    SELECT 1
    FROM translations tr
    WHERE tr.word_id = w.id
      AND trim(tr.translation) != ''
  );

WITH local_translations(term, translation) AS (
  VALUES
    ('a', 'um/uma'),
    ('an', 'um/uma'),
    ('i', 'eu'),
    ('the', 'o/a'),
    ('of', 'de'),
    ('to', 'para'),
    ('in', 'em'),
    ('on', 'em/sobre'),
    ('and', 'e'),
    ('or', 'ou'),
    ('but', 'mas'),
    ('is', 'é/está'),
    ('are', 'são/estão'),
    ('was', 'era/estava'),
    ('were', 'eram/estavam'),
    ('ago', 'atrás'),
    ('years', 'anos'),
    ('twelve', 'doze'),
    ('village', 'vila'),
    ('hidden', 'escondido'),
    ('car', 'carro'),
    ('context', 'contexto'),
    ('attack', 'ataque'),
    ('attacked', 'atacado'),
    ('time', 'tempo'),
    ('become', 'tornar-se'),
    ('i ran out of time', 'fiquei sem tempo'),
    ('ran out of time', 'ficar sem tempo')
)
INSERT INTO translations (id, word_id, language, translation, kind, source)
SELECT
  lower(hex(randomblob(16))),
  w.id,
  'pt-BR',
  lt.translation,
  'main',
  'local-backfill'
FROM words w
INNER JOIN local_translations lt ON lower(w.normalized_term) = lt.term
WHERE NOT EXISTS (
  SELECT 1
  FROM translations tr
  WHERE tr.word_id = w.id
    AND trim(tr.translation) != ''
);
