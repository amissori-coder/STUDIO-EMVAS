import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { emailVisibile, puoVedereEmail } from "../../src/modules/email/visibilita";

const casellaDiGiulia = { userId: "u-giulia" };

describe("email: chi può leggerle", () => {
  it("un'email non associata la vede solo il titolare della casella", () => {
    const privata = { clientId: null, taskId: null, account: casellaDiGiulia };
    assert.equal(puoVedereEmail("u-giulia", privata), true);
    assert.equal(puoVedereEmail("u-admin", privata), false, "nemmeno l'amministratore");
    assert.equal(puoVedereEmail("u-marco", privata), false);
  });

  it("un'email associata a un cliente è corrispondenza dello studio, visibile a tutti", () => {
    const delCliente = { clientId: "c-rossi", taskId: null, account: casellaDiGiulia };
    assert.equal(puoVedereEmail("u-admin", delCliente), true);
    assert.equal(puoVedereEmail("u-marco", delCliente), true);
  });

  it("anche l'associazione a un'attività la rende condivisa", () => {
    assert.equal(puoVedereEmail("u-marco", { clientId: null, taskId: "t-1", account: casellaDiGiulia }), true);
  });

  it("la condizione per il database esprime la stessa regola", () => {
    assert.deepEqual(emailVisibile("u-giulia"), {
      OR: [{ clientId: { not: null } }, { taskId: { not: null } }, { account: { userId: "u-giulia" } }],
    });
  });
});
