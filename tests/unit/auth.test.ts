import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isSafeInternalPath, safeInternalPath } from "../../src/lib/auth/redirect";
import { checkRateLimit, recordAttempt, resetRateLimit, clientIpFromHeaders } from "../../src/lib/auth/rate-limit";

describe("redirect interno dopo il login", () => {
  it("accetta solo percorsi interni assoluti", () => {
    assert.equal(isSafeInternalPath("/clienti"), true);
    assert.equal(isSafeInternalPath("/clienti/1?tab=email"), true);
    assert.equal(isSafeInternalPath("/attivita?assegnatario=x&stato=aperte"), true);
    assert.equal(isSafeInternalPath("/"), true);
  });

  it("rifiuta open redirect (//host, backslash, schemi, caratteri di controllo)", () => {
    assert.equal(isSafeInternalPath("//evil.com"), false);
    assert.equal(isSafeInternalPath("/\\evil.com/phish"), false);
    assert.equal(isSafeInternalPath("/\\\\evil.com"), false);
    assert.equal(isSafeInternalPath("http://evil.com"), false);
    assert.equal(isSafeInternalPath("javascript:alert(1)"), false);
    assert.equal(isSafeInternalPath("/a\nb"), false);
    assert.equal(isSafeInternalPath("/x/../y"), false);
    assert.equal(isSafeInternalPath(""), false);
    assert.equal(isSafeInternalPath(null), false);
    assert.equal(safeInternalPath("//evil.com", "/dashboard"), "/dashboard");
    assert.equal(safeInternalPath("/clienti", "/dashboard"), "/clienti");
  });
});

describe("limite tentativi di login", () => {
  it("blocca dopo il numero massimo di tentativi nella finestra e si azzera", () => {
    const key = "test:" + Math.random();
    for (let i = 0; i < 3; i++) {
      assert.equal(checkRateLimit(key, 3, 60_000).ok, true);
      recordAttempt(key, 60_000);
    }
    const r = checkRateLimit(key, 3, 60_000);
    assert.equal(r.ok, false);
    assert.ok(r.retryAfterSec >= 1 && r.retryAfterSec <= 60);
    resetRateLimit(key);
    assert.equal(checkRateLimit(key, 3, 60_000).ok, true);
  });

  it("legge l'IP dagli header del reverse proxy", () => {
    const h = (map: Record<string, string>) => ({ get: (n: string) => map[n] ?? null });
    assert.equal(clientIpFromHeaders(h({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" })), "1.2.3.4");
    assert.equal(clientIpFromHeaders(h({ "x-real-ip": "5.6.7.8" })), "5.6.7.8");
    assert.equal(clientIpFromHeaders(h({})), "sconosciuto");
  });
});
