-- Passo dell'ultimo codice a tempo accettato: impedisce di riusare un codice nei 30 secondi in cui è valido
ALTER TABLE "User" ADD COLUMN "totpUltimoPasso" INTEGER;
