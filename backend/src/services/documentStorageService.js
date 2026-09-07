const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const root = path.resolve(process.env.DOCUMENT_STORAGE_PATH || "uploads/documents");
const signatures = { "application/pdf": Buffer.from("%PDF-"), "image/png": Buffer.from([0x89, 0x50, 0x4e, 0x47]), "image/jpeg": Buffer.from([0xff, 0xd8, 0xff]) };
async function store({ contentBase64, mimeType }) { const data = Buffer.from(contentBase64, "base64"); const signature = signatures[mimeType]; if (!signature || data.length === 0 || data.length > 5 * 1024 * 1024 || !data.subarray(0, signature.length).equals(signature)) throw new Error("Invalid document content."); const key = `${crypto.randomUUID()}`; await fs.mkdir(root, { recursive: true }); await fs.writeFile(path.join(root, key), data, { mode: 0o600 }); return { key, sizeBytes: data.length }; }
module.exports = { store };
