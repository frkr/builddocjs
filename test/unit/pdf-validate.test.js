'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { analyzePdf, validatePdf } = require('../../src/pdf/validate');

// PDF mínimo A4 com 1 página, texto e EOF.
function makeMinimalPdf() {
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R >>\nendobj\n',
    '4 0 obj\n<< /Length 20 >>\nstream\nBT (Hello) Tj ET\nendstream\nendobj\n',
  ];
  const body = objects.join('');
  const xrefOffset = Buffer.byteLength(body, 'latin1');
  const xref = `xref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000210 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body + xref, 'latin1');
}

test('analyzePdf: detecta páginas, A4, texto e EOF', () => {
  const a = analyzePdf(makeMinimalPdf());
  assert.strictEqual(a.pageCount, 1);
  assert.ok(a.hasMediaBoxA4);
  assert.ok(a.textLen > 0);
  assert.ok(a.hasEOF);
});

test('validatePdf: aceita PDF válido', () => {
  const a = validatePdf(makeMinimalPdf(), { minPages: 1, requireA4: true, requireText: true });
  assert.strictEqual(a.pageCount, 1);
});

test('validatePdf: rejeita buffer vazio', () => {
  assert.throws(() => validatePdf(Buffer.alloc(0)));
});

test('validatePdf: rejeita PDF sem EOF', () => {
  const buf = makeMinimalPdf();
  const truncated = buf.subarray(0, buf.length - 10);
  assert.throws(() => validatePdf(truncated));
});

test('validatePdf: rejeita PDF sem texto quando requireText', () => {
  // PDF sem operador de texto (sem BT/ET, sem literais).
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] >>\nendobj\n',
  ];
  const body = objects.join('');
  const xrefOffset = Buffer.byteLength(body, 'latin1');
  const xref = `xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  const buf = Buffer.from(body + xref, 'latin1');
  assert.throws(() => validatePdf(buf, { requireText: true }));
});
