const escapePdfText = (value) => String(value ?? "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[\r\n]/g, " ");
const money = (value, currency) => `${currency || "USD"} ${Number(value || 0).toFixed(2)}`;

// A deliberately small, dependency-free PDF writer. It only renders trusted,
// server-derived invoice snapshots; callers never provide PDF commands.
function makePage(lines) {
  const commands = ["BT", "/F1 10 Tf", "50 790 Td"];
  lines.forEach((line, index) => {
    if (index) commands.push("0 -16 Td");
    commands.push(`(${escapePdfText(line)}) Tj`);
  });
  commands.push("ET");
  return commands.join("\n");
}

function buildPdf(invoice) {
  const lines = [
    "INVOICE",
    `Invoice number: ${invoice.invoice_number}`,
    `Invoice date: ${invoice.invoice_date || "-"}`,
    `Due date: ${invoice.due_date || "-"}`,
    `Project: ${invoice.project_name || invoice.project_id}`,
    "",
    "Line items",
  ];
  for (const item of invoice.items || []) {
    lines.push(`${item.contractor_name_snapshot || "Contractor"} | ${item.skill_name_snapshot || "Skill"} | ${item.milestone_name_snapshot || "Milestone"}`);
    lines.push(`${item.approved_hours} hours x ${money(item.bill_rate, invoice.currency)} = ${money(item.amount, invoice.currency)}`);
  }
  for (const adjustment of invoice.adjustments || []) lines.push(`Adjustment: ${adjustment.description} = ${money(adjustment.amount, invoice.currency)}`);
  lines.push("", `Subtotal: ${money(invoice.subtotal_amount, invoice.currency)}`, `Tax (${Number(invoice.tax_rate || 0).toFixed(2)}%): ${money(invoice.tax_amount, invoice.currency)}`);
  lines.push(`Adjustments: ${money(invoice.adjustment_amount, invoice.currency)}`, `Total: ${money(invoice.total_amount, invoice.currency)}`);
  const content = makePage(lines);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf, "utf8")); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "utf8");
}

module.exports = { buildPdf };
