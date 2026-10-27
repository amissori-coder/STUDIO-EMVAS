#!/bin/sh
set -e
# Applica le migrazioni versionate presenti in prisma/migrations.
#
# Si usa "migrate deploy" e non "db push": db push confronta lo schema con il database e
# adatta le tabelle da sé, quindi su un aggiornamento che rinomina o rimuove una colonna
# può cancellare dati senza chiedere nulla. "migrate deploy" esegue soltanto le migrazioni
# scritte e revisionate, in ordine, e si rifiuta di proseguire se il database è in uno stato
# che non riconosce: in quel caso l'applicazione non parte, ed e' il comportamento corretto
# (meglio non partire che perdere i documenti di un cliente).
#
# Primo avvio su un database vuoto: le migrazioni creano tutte le tabelle.
# Database preesistente creato con db push (installazioni anteriori alle migrazioni):
# allineare una volta sola con
#   docker compose run --rm app npx prisma migrate resolve --applied 20260101000000_init
# e poi riavviare normalmente.
if ! npx prisma migrate deploy; then
  echo "[avvio] ERRORE: le migrazioni del database non sono state applicate." >&2
  echo "[avvio] L'applicazione non viene avviata. Vedere docs/INSTALLAZIONE.md, sezione Aggiornamenti." >&2
  exit 1
fi

# Seed idempotente: amministratore iniziale + catalogo adempimenti.
npx tsx prisma/seed.ts || echo "[avvio] seed non eseguito"
exec "$@"
