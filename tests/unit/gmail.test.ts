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

  it("parseAddressList non spezza sulle virgole dentro le virgolette", () => {
    assert.deepEqual(parseAddressList('"Rossi, Mario" <mario@rossi.it>, "Bianchi, Anna" <anna@bianchi.it>'), ["mario@rossi.it", "anna@bianchi.it"]);
    assert.deepEqual(parseAddressList("undisclosed-recipients:;"), []);
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

  it("sanitizeEmailHtml resiste a tag annidati, attributi senza virgolette e schemi offuscati", () => {
    assert.equal(sanitizeEmailHtml("<img src=x onerror=alert(1)>"), '<img src="x">');
    assert.equal(sanitizeEmailHtml("<div onclick=alert(1)>x</div>"), "<div>x</div>");
    assert.equal(sanitizeEmailHtml('<a href="java&#x73;cript:alert(1)">b</a>'), "<a>b</a>");
    assert.equal(sanitizeEmailHtml('<a href="java\nscript:alert(1)">b</a>'), "<a>b</a>");
    assert.ok(!/<script/i.test(sanitizeEmailHtml("<scr<script></script>ipt>alert(1)</script>")));
    assert.ok(!/<meta/i.test(sanitizeEmailHtml('<me<meta>ta http-equiv=refresh content="0;url=http://evil">')));
    assert.ok(!/<style/i.test(sanitizeEmailHtml("<sty<style></style>le>body{display:none}</style>")));
    assert.equal(sanitizeEmailHtml('<img title="x>" onerror=alert(1) src=x>'), '<img title="x>" src="x">');
    assert.equal(sanitizeEmailHtml('<img alt=a"b onerror=alert(1) src=x>'), '<img alt="a&quot;b" src="x">');
    assert.equal(sanitizeEmailHtml("<script>unclosed"), "");
    assert.equal(sanitizeEmailHtml('<form action="http://evil"><input></form>'), "<input>");
    assert.equal(sanitizeEmailHtml("<svg onload=alert(1)><script>1</script></svg>"), "");
    assert.equal(sanitizeEmailHtml("<!-- commento --><p>ok</p>"), "<p>ok</p>");
  });

  it("sanitizeEmailHtml conserva l'HTML normale delle email", () => {
    const html =
      '<table><tr><td style="color:red">cell &amp; "quoted"</td></tr></table><a href="https://x.it/a?b=1&amp;c=2" target="_blank">ok</a><img src="data:image/png;base64,AAAA"><br>';
    assert.equal(sanitizeEmailHtml(html), html);
    assert.equal(sanitizeEmailHtml('<a href="mailto:a@b.it">m</a>'), '<a href="mailto:a@b.it">m</a>');
    assert.equal(sanitizeEmailHtml('<img src="data:text/html;base64,AAAA">'), "<img>");
  });
});
