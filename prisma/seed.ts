/* eslint-disable no-console */
// Seed iniziale: amministratore + catalogo adempimenti. Idempotente.
// Con SEED_DEMO=1 crea anche dati dimostrativi (clienti, attività, assenze, chat).
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CATALOGO_ADEMPIMENTI } from "../src/lib/adempimenti/catalogo";
import { CARTELLE_DEFAULT } from "../src/lib/constants";

const prisma = new PrismaClient();

async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL ?? "admin@studio.local").trim().toLowerCase();
  const nome = process.env.ADMIN_NOME ?? "Amministratore";
  const password = process.env.ADMIN_PASSWORD ?? "CambiaSubito123!";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Amministratore già presente: ${email}`);
    return existing;
  }
  const user = await prisma.user.create({
    data: { email, nome, ruolo: "ADMIN", passwordHash: await bcrypt.hash(password, 10), colore: "#2563eb" },
  });
  console.log(`Creato amministratore ${email} (password iniziale da ADMIN_PASSWORD)`);
  return user;
}

async function seedCatalogo() {
  let creati = 0;
  let aggiornati = 0;
  for (const [i, t] of CATALOGO_ADEMPIMENTI.entries()) {
    const data = {
      nome: t.nome,
      descrizione: t.descrizione,
      categoria: t.categoria,
      ricorrenza: t.ricorrenza,
      scadenze: JSON.stringify(t.scadenze),
      regimi: JSON.stringify(t.regimi ?? []),
      tipiSoggetto: JSON.stringify(t.tipiSoggetto ?? []),
      soloConDipendenti: t.soloConDipendenti ?? null,
      soloConIva: t.soloConIva ?? null,
      periodicitaIva: t.periodicitaIva ?? null,
      soloSuRichiesta: t.soloSuRichiesta ?? false,
      giorniPreavviso: t.giorniPreavviso ?? 7,
      ordine: i,
    };
    const existing = await prisma.adempimentoTemplate.findUnique({ where: { codice: t.codice } });
    if (existing) {
      // Non sovrascrive le personalizzazioni: aggiorna solo l'ordine.
      await prisma.adempimentoTemplate.update({ where: { codice: t.codice }, data: { ordine: i } });
      aggiornati++;
    } else {
      await prisma.adempimentoTemplate.create({ data: { codice: t.codice, ...data } });
      creati++;
    }
  }
  console.log(`Catalogo adempimenti: ${creati} creati, ${aggiornati} già presenti`);
}

async function seedDemo(adminId: string) {
  if (await prisma.client.count()) {
    console.log("Dati demo: clienti già presenti, salto.");
    return;
  }
  const collab = await prisma.user.upsert({
    where: { email: "collaboratore@studio.local" },
    update: {},
    create: {
      email: "collaboratore@studio.local",
      nome: "Giulia Bianchi",
      ruolo: "COLLABORATORE",
      passwordHash: await bcrypt.hash("Collaboratore123!", 10),
      colore: "#16a34a",
    },
  });
  const clienti = await Promise.all([
    prisma.client.create({
      data: {
        denominazione: "Rossi Impianti S.r.l.",
        tipoSoggetto: "SRL",
        regimeFiscale: "ORDINARIO",
        periodicitaIva: "MENSILE",
        haDipendenti: true,
        partitaIva: "01234567890",
        codiceFiscale: "01234567890",
        codiceAteco: "43.22.01",
        attivita: "Installazione impianti idraulici",
        email: "amministrazione@rossi-impianti.it",
        pec: "rossiimpianti@pec.it",
        telefono: "06 1234567",
        comune: "Roma",
        provincia: "RM",
        referenteId: adminId,
        cartelle: { create: CARTELLE_DEFAULT.map((c, i) => ({ nome: c.nome, descrizione: c.descrizione, ordine: i })) },
        contatti: { create: [{ nome: "Mario Rossi", email: "mario.rossi@rossi-impianti.it", ruolo: "Amministratore" }] },
      },
    }),
    prisma.client.create({
      data: {
        denominazione: "Laura Verdi",
        tipoSoggetto: "PROFESSIONISTA",
        regimeFiscale: "FORFETTARIO",
        periodicitaIva: "NESSUNA",
        haDipendenti: false,
        partitaIva: "09876543210",
        codiceFiscale: "VRDLRA85A41H501Z",
        codiceAteco: "74.10.21",
        attivita: "Graphic designer",
        email: "laura.verdi@gmail.com",
        comune: "Milano",
        provincia: "MI",
        referenteId: collab.id,
        cartelle: { create: CARTELLE_DEFAULT.map((c, i) => ({ nome: c.nome, descrizione: c.descrizione, ordine: i })) },
      },
    }),
    prisma.client.create({
      data: {
        denominazione: "Bar Centrale di Neri Paolo",
        tipoSoggetto: "DITTA_INDIVIDUALE",
        regimeFiscale: "SEMPLIFICATO",
        periodicitaIva: "TRIMESTRALE",
        haDipendenti: true,
        partitaIva: "11223344556",
        codiceFiscale: "NREPLA70C15F205X",
        codiceAteco: "56.30.00",
        attivita: "Bar e caffetteria",
        email: "barcentrale@libero.it",
        comune: "Firenze",
        provincia: "FI",
        referenteId: collab.id,
        cartelle: { create: CARTELLE_DEFAULT.map((c, i) => ({ nome: c.nome, descrizione: c.descrizione, ordine: i })) },
      },
    }),
  ]);

  // Utente portale per il primo cliente
  const clienteUser = await prisma.user.create({
    data: {
      email: "cliente@rossi-impianti.it",
      nome: "Mario Rossi",
      ruolo: "CLIENTE",
      passwordHash: await bcrypt.hash("Cliente123!", 10),
      accessiClienti: { create: { clientId: clienti[0].id } },
    },
  });

  // Attività di esempio
  const oggi = new Date();
  const d = (giorni: number) => {
    const r = new Date(oggi);
    r.setDate(r.getDate() + giorni);
    r.setHours(12, 0, 0, 0);
    return r;
  };
  await prisma.task.createMany({
    data: [
      { titolo: "Registrazione fatture di acquisto agosto", clientId: clienti[0].id, scadenza: d(-2), assigneeId: adminId, createdById: adminId, priorita: "ALTA" },
      { titolo: "Invio F24 ritenute dipendenti", clientId: clienti[0].id, scadenza: d(0), assigneeId: adminId, createdById: adminId, priorita: "ALTA" },
      { titolo: "Controllo corrispettivi trimestre", clientId: clienti[2].id, scadenza: d(3), assigneeId: collab.id, createdById: adminId },
      { titolo: "Predisposizione fattura elettronica per cliente estero", clientId: clienti[1].id, scadenza: d(5), assigneeId: collab.id, createdById: adminId, stato: "IN_CORSO" },
      { titolo: "Aggiornamento fascicolo antiriciclaggio", clientId: clienti[1].id, scadenza: d(12), assigneeId: adminId, createdById: adminId, priorita: "BASSA" },
      { titolo: "Riunione annuale con il cliente", clientId: clienti[0].id, scadenza: d(-10), assigneeId: adminId, createdById: adminId, stato: "COMPLETATA", completatoAt: d(-9) },
    ],
  });

  await prisma.absence.create({
    data: { userId: collab.id, tipo: "FERIE", dataInizio: d(1), dataFine: d(7), stato: "APPROVATA", approvedById: adminId, note: "Ferie estive" },
  });

  await prisma.chatMessage.createMany({
    data: [
      { clientId: clienti[0].id, authorId: adminId, testo: "Il cliente ha inviato le fatture di agosto, le trovate nella cartella Fatture di acquisto." },
      { clientId: clienti[0].id, authorId: collab.id, testo: "Perfetto, procedo con la registrazione entro domani." },
    ],
  });

  await prisma.notification.create({
    data: { userId: adminId, tipo: "SISTEMA", titolo: "Benvenuto in Studio EMVAS", corpo: "Questi sono dati dimostrativi. Puoi eliminarli dall'area Clienti.", link: "/clienti" },
  });

  console.log(`Dati demo creati: ${clienti.length} clienti, collaboratore ${collab.email} (Collaboratore123!), utente portale ${clienteUser.email} (Cliente123!)`);
}

async function main() {
  const admin = await seedAdmin();
  await seedCatalogo();
  if (process.env.SEED_DEMO === "1") await seedDemo(admin.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
