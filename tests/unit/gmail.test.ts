import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseAddress, parseAddressList, parseGmailMessage, sanitizeEmailHtml } from "../../src/lib/gmail-parse";

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");

describe("gmail parsing", () => {
  it("parseAddress gestisce nome + indirizzo e solo indirizzo", () => {
    assert.deepEqual(parseAddress('"Mario Rossi" <Mario@Rossi.IT>'), { name: "Mario Rossi", email: "mario@rossi.it" });
    assert.deepEqual(parseAddress("Mario Rossi <mario@rossi.it>"), { name: "Mario Rossi", email: "mario@rossi.it" });
    assert.deepEqual(parseAddress("  mario@rossi.it "), { name: null, email: "mario@rossi.it" });
    assert.deepEqual(parseAddressList("a@x.it, B <b@x.it>,,"), ["a@x.it", "b@x.it"]);
  });

  it("parseGmailMessage estrae intestazioni, corpo e allegati", () => {
    const parsed = parseGmailMessage({
      id: "m1",
      threadId: "t1",
      labelIds: ["INBOX", "UNREAD"],
      snippet: "anteprima",
      internalDate: String(Date.UTC(2026, 8, 1, 10, 0, 0)),
      payload: {
        mimeType: "multipart/mixed",
        headers: [
          { name: "From", value: "Studio <amministrazione@rossi-impianti.it>" },
          { name: "To", value: "a.missori@emvas.tax, Altro <altro@emvas.tax>" },
          { name: "Subject", value: "Fatture agosto" },
        ],
        parts: [
          {
            mimeType: "multipart/alternative",
            parts: [
              { mimeType: "text/plain", body: { data: b64("Ciao,\ninvio le fatture.") } },
              { mimeType: "text/html", body: { data: b64("<p>Ciao,<br>invio le fatture.</p><script>alert(1)</script>") } },
            ],
          },
          { mimeType: "application/pdf", filename: "fattura.pdf", body: { attachmentId: "att1", size: 1234 } },
        ],
      },
    });
    assert.equal(parsed.fromAddr, "amministrazione@rossi-impianti.it");
    assert.equal(parsed.fromName, "Studio");
    assert.deepEqual(parsed.toAddrs, ["a.missori@emvas.tax", "altro@emvas.tax"]);
    assert.equal(parsed.subject, "Fatture agosto");
    assert.equal(parsed.bodyText, "Ciao,\ninvio le fatture.");
    assert.ok(parsed.bodyHtml && !parsed.bodyHtml.includes("<script"));
    assert.equal(parsed.attachments.length, 1);
    assert.equal(parsed.attachments[0].filename, "fattura.pdf");
    assert.equal(parsed.isUnread, true);
    assert.equal(parsed.receivedAt.getTime(), Date.UTC(2026, 8, 1, 10, 0, 0));
  });

  it("sanitizeEmailHtml rimuove script, iframe e handler", () => {
    const out = sanitizeEmailHtml('<div onclick="x()">a</div><iframe src="x"></iframe><a href="javascript:alert(1)">b</a><style>p{}</style>');
    assert.ok(!out.includes("onclick"));
    assert.ok(!out.includes("<iframe"));
    assert.ok(!out.includes("javascript:"));
    assert.ok(!out.includes("<style"));
  });
});
