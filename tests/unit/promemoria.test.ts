import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  descriviDestinatario,
  destinatarioPromemoria,
  giorni,
  livelloPromemoria,
  orizzontePromemoria,
  testoPromemoria,
  type SituazioneAttivita,
} from "../../src/lib/cron/promemoria";

const giulia = { id: "u-giulia", nome: "Giulia Bianchi", attivo: true };
const giuliaDisattivata = { ...giulia, attivo: false };
const marco = { id: "u-marco", nome: "Marco Neri", attivo: true };
const marcoDisattivato = { ...marco, attivo: false };

function situazione(s: Partial<SituazioneAttivita> & { clienteAttivo?: boolean; referente?: typeof marco | null }): SituazioneAttivita {
  return {
    assegnatario: s.assegnatario ?? null,
    cliente: s.cliente === null ? null : (s.cliente ?? { attivo: s.clienteAttivo ?? true, referente: s.referente ?? null }),
  };
}

describe("promemoria: chi riceve l'avviso", () => {
  it("l'assegnatario attivo riceve l'avviso", () => {
    assert.deepEqual(destinatarioPromemoria(situazione({ assegnatario: giulia, referente: marco })), {
      tipo: "ASSEGNATARIO",
      userId: "u-giulia",
    });
  });

  it("senza assegnatario l'avviso va al referente del cliente, non si perde", () => {
    const d = destinatarioPromemoria(situazione({ referente: marco }));
    assert.equal(d.tipo, "REFERENTE");
    assert.equal(d.tipo === "REFERENTE" && d.userId, "u-marco");
    assert.equal(d.tipo === "REFERENTE" && d.prefisso, "Da assegnare");
  });

  it("senza assegnatario e senza referente l'avviso va agli amministratori", () => {
    const d = destinatarioPromemoria(situazione({}));
    assert.equal(d.tipo, "AMMINISTRATORI");
    assert.match(d.tipo === "AMMINISTRATORI" ? d.motivo : "", /cliente senza referente/);
  });

  it("con l'assegnatario disattivato l'avviso ricade sul referente, marcato «Da riassegnare»", () => {
    const d = destinatarioPromemoria(situazione({ assegnatario: giuliaDisattivata, referente: marco }));
    assert.equal(d.tipo, "REFERENTE");
    assert.equal(d.tipo === "REFERENTE" && d.prefisso, "Da riassegnare");
    assert.match(d.tipo === "REFERENTE" ? d.motivo : "", /Giulia Bianchi/);
  });

  it("con assegnatario e referente entrambi disattivati l'avviso va agli amministratori", () => {
    const d = destinatarioPromemoria(situazione({ assegnatario: giuliaDisattivata, referente: marcoDisattivato }));
    assert.equal(d.tipo, "AMMINISTRATORI");
  });

  it("distingue il referente disattivato dal cliente senza referente", () => {
    const disattivato = destinatarioPromemoria(situazione({ referente: marcoDisattivato }));
    const mancante = destinatarioPromemoria(situazione({}));
    assert.match(disattivato.tipo === "AMMINISTRATORI" ? disattivato.motivo : "", /referente del cliente non più attivo \(Marco Neri\)/);
    assert.doesNotMatch(disattivato.tipo === "AMMINISTRATORI" ? disattivato.motivo : "", /senza referente/);
    assert.match(mancante.tipo === "AMMINISTRATORI" ? mancante.motivo : "", /senza referente/);
  });

  it("un'attività senza cliente e senza assegnatario va agli amministratori", () => {
    const d = destinatarioPromemoria(situazione({ cliente: null }));
    assert.equal(d.tipo, "AMMINISTRATORI");
    assert.doesNotMatch(d.tipo === "AMMINISTRATORI" ? d.motivo : "", /referente/);
  });

  it("un cliente archiviato non riversa avvisi sugli amministratori", () => {
    assert.equal(destinatarioPromemoria(situazione({ clienteAttivo: false })).tipo, "NESSUNO");
    assert.equal(destinatarioPromemoria(situazione({ clienteAttivo: false, referente: marco })).tipo, "NESSUNO");
  });

  it("un cliente archiviato continua ad avvisare l'assegnatario attivo, come prima", () => {
    assert.equal(destinatarioPromemoria(situazione({ assegnatario: giulia, clienteAttivo: false })).tipo, "ASSEGNATARIO");
  });

  it("la scheda attività dice a chi arriverà il promemoria, senza «a gli»", () => {
    assert.equal(descriviDestinatario(situazione({ assegnatario: giulia })), "all'assegnatario");
    assert.equal(descriviDestinatario(situazione({ referente: marco })), "al referente del cliente");
    assert.equal(descriviDestinatario(situazione({})), "agli amministratori dello studio");
  });
});

describe("promemoria: livello e orizzonte", () => {
  it("calcola il livello dovuto", () => {
    assert.equal(livelloPromemoria(-3, 7), "SCADUTA");
    assert.equal(livelloPromemoria(0, 7), "OGGI");
    assert.equal(livelloPromemoria(1, 7), "DOMANI");
    assert.equal(livelloPromemoria(7, 7), "PREAVVISO");
    assert.equal(livelloPromemoria(8, 7), null);
    assert.equal(livelloPromemoria(5, 1), null, "con preavviso 1 non c'è preavviso");
    assert.equal(livelloPromemoria(5, null), "PREAVVISO", "preavviso predefinito di 7 giorni");
  });

  it("l'orizzonte copre il preavviso più lungo impostato", () => {
    assert.equal(orizzontePromemoria(null), 60);
    assert.equal(orizzontePromemoria(7), 60);
    assert.equal(orizzontePromemoria(120), 120);
    assert.equal(orizzontePromemoria(999), 365);
  });
});

describe("promemoria: testi in italiano corretto", () => {
  it("concorda al singolare", () => {
    assert.equal(giorni(1), "1 giorno");
    assert.equal(giorni(3), "3 giorni");
    assert.equal(testoPromemoria("PREAVVISO", 2, "IVA").titolo, "Scade tra 2 giorni: IVA");
    assert.equal(testoPromemoria("SCADUTA", -1, "IVA").titolo, "Scaduta ieri: IVA");
    assert.equal(testoPromemoria("SCADUTA", -2, "IVA").titolo, "Scaduta da 2 giorni: IVA");
    assert.doesNotMatch(testoPromemoria("SCADUTA", -1, "IVA").titolo, /1 giorni/);
  });
});
