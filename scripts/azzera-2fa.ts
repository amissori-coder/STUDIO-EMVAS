// Azzera la verifica in due passaggi di un account, dal server. Serve quando l'unico amministratore (o
// chiunque non abbia un amministratore che lo faccia da Team) ha perso il telefono e i codici di recupero.
//
// Uso sul server (Docker):  docker compose exec app npx tsx scripts/azzera-2fa.ts nome@studio.it
// Uso in sviluppo:          npx tsx scripts/azzera-2fa.ts nome@studio.it
//
// L'account viene disconnesso ovunque; al prossimo accesso basta la password, poi la verifica va
// riattivata da Impostazioni. L'operazione resta nel registro come «azzerata dal server».
import { PrismaClient } from "@prisma/client";

try {
  process.loadEnvFile();
} catch {
  // nessun file .env: valgono le variabili d'ambiente (come nel container)
}

async function main() {
  const email = (process.argv[2] ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    console.error("Indica l'email dell'account: npx tsx scripts/azzera-2fa.ts nome@studio.it");
    process.exit(2);
  }
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, nome: true, totpAttivo: true, totpSecret: true } });
    if (!user) {
      console.error(`Nessun account con email ${email}.`);
      process.exit(1);
    }
    if (!user.totpAttivo && !user.totpSecret) {
      console.log(`${user.nome} (${email}) non ha la verifica in due passaggi attiva: nulla da fare.`);
      return;
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { totpAttivo: false, totpSecret: null, totpRecupero: null, totpConfermato: null, totpUltimoPasso: null, sessionVersion: { increment: 1 } },
    });
    await prisma.auditLog.create({
      data: { azione: "TOTP_AZZERATA_DA_SERVER", entita: "User", entitaId: user.id, dettagli: JSON.stringify({ nome: user.nome, email }) },
    });
    console.log(`Verifica in due passaggi di ${user.nome} (${email}) azzerata. Ora si accede con la sola password: riattivala subito da Impostazioni.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
