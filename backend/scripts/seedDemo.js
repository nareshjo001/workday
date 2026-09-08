const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const env = require('../src/config/env');
const logger = require('../src/observability/logger');
const storage = require('../src/services/documentStorageService');
const { buildPdf } = require('../src/services/invoicePdfService');
const { connectWithRetry } = require('../src/utils/connectWithRetry');

const PASSWORD = 'DemoPassword!2026';
const DEMO_VENDOR = 'demo.vendor@workday.local';

function permitted() {
  return process.env.DEMO_SEED_ENABLED === 'true' && /(_demo|_restore)$/.test(env.db.name);
}

async function one(connection, sql, values) {
  const [rows] = await connection.query(sql, values);
  if (!rows.length) throw new Error('Expected demo record was not found after insert.');
  return rows[0].id;
}

async function run() {
  if (!permitted()) {
    throw new Error('Demo seed is disabled. Set DEMO_SEED_ENABLED=true and use an explicit *_demo or *_restore database.');
  }
  const connection = await connectWithRetry(() => mysql.createConnection({
    host: env.db.host, port: env.db.port, user: env.db.user, password: env.db.password, database: env.db.name,
  }), {
    attempts: env.startupDbRetries,
    delayMs: env.startupDbRetryMs,
    onRetry: ({ attempt, maxAttempts, error }) => logger.warn('demo_seed_database_connection_retry', {
      attempt, max_attempts: maxAttempts, error_message: error.message,
    }),
  });
  try {
    const [[existing]] = await connection.query('SELECT id FROM users WHERE email=?', [DEMO_VENDOR]);
    if (existing) {
      logger.info('demo_seed_complete', { created: false, reason: 'already_seeded' });
      return;
    }
    const hash = await bcrypt.hash(PASSWORD, 12);
    await connection.beginTransaction();
    await connection.query("INSERT INTO users (name,email,password_hash,role,password_set_at) VALUES (?,? ,?,'VENDOR',NOW()),(?,? ,?,'PM',NOW()),(?,? ,?,'CONTRACTOR',NOW()),(?,? ,?,'CONTRACTOR',NOW())", [
      'Demo Vendor', DEMO_VENDOR, hash,
      'Demo PM', 'demo.pm@workday.local', hash,
      'Demo Contractor', 'demo.contractor@workday.local', hash,
      'Demo Candidate', 'demo.candidate@workday.local', hash,
    ]);
    const vendorId = await one(connection, 'SELECT id FROM users WHERE email=?', [DEMO_VENDOR]);
    const pmId = await one(connection, 'SELECT id FROM users WHERE email=?', ['demo.pm@workday.local']);
    const contractorUserId = await one(connection, 'SELECT id FROM users WHERE email=?', ['demo.contractor@workday.local']);
    const candidateUserId = await one(connection, 'SELECT id FROM users WHERE email=?', ['demo.candidate@workday.local']);
    await connection.query("INSERT INTO client_companies (name,normalized_name) VALUES ('Demo Client Company','demo client company')");
    const companyId = await one(connection, 'SELECT id FROM client_companies WHERE normalized_name=?', ['demo client company']);
    await connection.query('INSERT INTO project_managers (user_id,company_id,department) VALUES (?,?,?)', [pmId, companyId, 'Demo Delivery']);
    await connection.query("INSERT INTO contractors (user_id,vendor_id,hourly_rate,status,skill,headline,total_experience_years) VALUES (?,?,?,'ACTIVE','BACKEND',?,?),(?,?,?,'ACTIVE','BACKEND',?,?)", [
      contractorUserId, vendorId, 75, 'Demo backend specialist', 6,
      candidateUserId, vendorId, 70, 'Candidate awaiting a PM decision', 4,
    ]);
    const contractorId = await one(connection, 'SELECT id FROM contractors WHERE user_id=?', [contractorUserId]);
    const candidateId = await one(connection, 'SELECT id FROM contractors WHERE user_id=?', [candidateUserId]);
    const skillId = await one(connection, "SELECT id FROM skills WHERE code='BACKEND'");
    await connection.query("INSERT INTO contractor_skills (contractor_id,skill_id,proficiency,years_experience,is_primary) VALUES (?,?,'EXPERT',6,1),(?,?,'ADVANCED',4,1)", [contractorId, skillId, candidateId, skillId]);
    await connection.query("INSERT INTO client_vendor_relationships (client_company_id,vendor_id,status,invited_by,accepted_at) VALUES (?,?,'ACTIVE',?,NOW())", [companyId, vendorId, pmId]);
    await connection.query("INSERT INTO projects (name,description,pm_id,start_date,end_date,expected_hours,budget,currency,max_hours_per_day,max_hours_per_week,allow_weekend,backdate_limit_days,candidate_response_sla_hours,status) VALUES ('Demo Platform Upgrade','Deterministic M22 lifecycle demonstration.',?,DATE_SUB(CURDATE(),INTERVAL 14 DAY),DATE_ADD(CURDATE(),INTERVAL 30 DAY),80,12000,'USD',12,50,FALSE,30,24,'ACTIVE')", [pmId]);
    const projectId = await one(connection, 'SELECT id FROM projects WHERE name=?', ['Demo Platform Upgrade']);
    await connection.query("INSERT INTO project_vendors (project_id,vendor_id,status) VALUES (?,?,'ACTIVE')", [projectId, vendorId]);
    await connection.query("INSERT INTO project_requirements (project_id,skill,skill_id,required_count,description,status) VALUES (?,'BACKEND',?,2,'Backend delivery capacity','OPEN')", [projectId, skillId]);
    const requirementId = await one(connection, 'SELECT id FROM project_requirements WHERE project_id=? AND skill_id=?', [projectId, skillId]);
    await connection.query("INSERT INTO rate_cards (client_company_id,vendor_id,skill_id,effective_from,effective_to,bill_rate,cost_rate,currency,status) VALUES (?,?,?,DATE_SUB(CURDATE(),INTERVAL 30 DAY),NULL,120,75,'USD','ACTIVE')", [companyId, vendorId, skillId]);
    const rateCardId = await one(connection, 'SELECT id FROM rate_cards WHERE client_company_id=? AND vendor_id=? AND skill_id=?', [companyId, vendorId, skillId]);
    await connection.query("INSERT INTO candidate_submissions (project_id,requirement_id,contractor_id,vendor_id,proposed_start_date,proposed_end_date,status,reviewed_at,reviewed_by,review_reason) VALUES (?,?,?,?,DATE_SUB(CURDATE(),INTERVAL 10 DAY),DATE_ADD(CURDATE(),INTERVAL 30 DAY),'ACCEPTED',NOW(),?,'Demo accepted candidate'),(?,?,?,?,CURDATE(),DATE_ADD(CURDATE(),INTERVAL 30 DAY),'REJECTED',NOW(),?,'Demo rejected candidate')", [projectId, requirementId, contractorId, vendorId, pmId, projectId, requirementId, candidateId, vendorId, pmId]);
    await connection.query("INSERT INTO project_assignments (contractor_id,project_id,requirement_id,assigned_date,start_date,end_date,planned_last_working_date,allocated_hours,bill_rate_snapshot,cost_rate_snapshot,currency,rate_card_id,status) VALUES (?,?,?,DATE_SUB(CURDATE(),INTERVAL 10 DAY),DATE_SUB(CURDATE(),INTERVAL 10 DAY),DATE_ADD(CURDATE(),INTERVAL 30 DAY),DATE_ADD(CURDATE(),INTERVAL 30 DAY),40,120,75,'USD',?,'ACTIVE')", [contractorId, projectId, requirementId, rateCardId]);
    await connection.query("INSERT INTO timesheets (contractor_id,project_id,work_date,hours_logged,description,status,submitted_at,reviewed_by,reviewed_at) VALUES (?, ?, DATE_SUB(CURDATE(),INTERVAL 5 DAY), 8, 'Approved demo work', 'APPROVED', NOW(), ?, NOW()), (?, ?, DATE_SUB(CURDATE(),INTERVAL 4 DAY), 4, 'Rejected demo work', 'REJECTED', NOW(), ?, NOW()), (?, ?, DATE_SUB(CURDATE(),INTERVAL 1 DAY), 4, 'Submitted demo work', 'SUBMITTED', NOW(), NULL, NULL)", [contractorId, projectId, pmId, contractorId, projectId, pmId, contractorId, projectId]);
    await connection.query("INSERT INTO milestones (project_id,name,description,sequence_order,due_date,threshold_hours,status,met_at) VALUES (?,'Demo delivery checkpoint','Approved-work billing example',1,DATE_ADD(CURDATE(),INTERVAL 7 DAY),8,'MET',NOW()),(?,'Demo E2E invoice checkpoint','Becomes eligible after the browser smoke approves its submitted hours.',2,DATE_ADD(CURDATE(),INTERVAL 14 DAY),12,'PENDING',NULL)", [projectId, projectId]);
    const milestoneId = await one(connection, 'SELECT id FROM milestones WHERE project_id=? AND name=?', [projectId, 'Demo delivery checkpoint']);
    await connection.query('INSERT INTO milestone_billings (milestone_id,contractor_id,approved_hours,hourly_rate,billing_amount) VALUES (?,?,?,?,?)', [milestoneId, contractorId, 8, 120, 960]);
    const billingId = await one(connection, 'SELECT id FROM milestone_billings WHERE milestone_id=? AND contractor_id=?', [milestoneId, contractorId]);
    await connection.query("INSERT INTO invoices (milestone_billing_id,project_id,contractor_id,vendor_id,client_company_id,currency,amount,status,generated_at,submitted_at,reviewed_by,reviewed_at,invoice_number,invoice_date,due_date,payment_terms_days,subtotal_amount,tax_amount,adjustment_amount,total_amount) VALUES (?,?,?,?,?,'USD',960,'APPROVED',NOW(),NOW(),?,NOW(),'DEMO-2026-0001',CURDATE(),DATE_SUB(CURDATE(),INTERVAL 1 DAY),30,960,0,0,960)", [billingId, projectId, contractorId, vendorId, companyId, pmId]);
    const invoiceId = await one(connection, 'SELECT id FROM invoices WHERE invoice_number=?', ['DEMO-2026-0001']);
    await connection.query("INSERT INTO invoice_items (invoice_id,milestone_billing_id,approved_hours,bill_rate,amount,contractor_name_snapshot,skill_name_snapshot,milestone_name_snapshot,billing_period_label) VALUES (?,?,?,?,?,'Demo Contractor','Backend','Demo delivery checkpoint','Demo approved work')", [invoiceId, billingId, 8, 120, 960]);
    const invoicePdf = buildPdf({
      invoice_number: 'DEMO-2026-0001', invoice_date: new Date().toISOString().slice(0, 10),
      due_date: new Date(Date.now() - 86400000).toISOString().slice(0, 10), project_name: 'Demo Platform Upgrade',
      currency: 'USD', subtotal_amount: 960, tax_rate: 0, tax_amount: 0, adjustment_amount: 0, total_amount: 960,
      items: [{ contractor_name_snapshot: 'Demo Contractor', skill_name_snapshot: 'Backend', milestone_name_snapshot: 'Demo delivery checkpoint', approved_hours: 8, bill_rate: 120, amount: 960 }], adjustments: [],
    });
    const invoiceDocument = await storage.store({ contentBase64: invoicePdf.toString('base64'), mimeType: 'application/pdf' });
    await connection.query('UPDATE invoices SET pdf_storage_key=?, pdf_size_bytes=?, pdf_generated_at=NOW(), document_frozen_at=NOW() WHERE id=?', [invoiceDocument.key, invoiceDocument.sizeBytes, invoiceId]);
    await connection.query("INSERT INTO payments (invoice_id,amount,currency,paid_at,reference,method,notes,recorded_by) VALUES (?,400,'USD',NOW(),'DEMO-PARTIAL-001','BANK_TRANSFER','Demo-only partial settlement',?)", [invoiceId, vendorId]);
    const demoPdf = Buffer.from('%PDF-1.4\nDemo document\n%%EOF').toString('base64');
    const documents = await Promise.all([storage.store({ contentBase64: demoPdf, mimeType: 'application/pdf' }), storage.store({ contentBase64: demoPdf, mimeType: 'application/pdf' }), storage.store({ contentBase64: demoPdf, mimeType: 'application/pdf' }), storage.store({ contentBase64: demoPdf, mimeType: 'application/pdf' })]);
    await connection.query("INSERT INTO contractor_documents (contractor_id,document_type,storage_key,original_filename,mime_type,size_bytes,status,expiry_date,verified_by,verified_at) VALUES (?,'QUALIFICATION',?,'demo-qualification.pdf','application/pdf',?,'VERIFIED',DATE_ADD(CURDATE(),INTERVAL 14 DAY),?,NOW()),(?,'IDENTITY',?,'candidate-identity.pdf','application/pdf',?,'VERIFIED',DATE_ADD(CURDATE(),INTERVAL 365 DAY),?,NOW()),(?,'TAX',?,'candidate-tax.pdf','application/pdf',?,'VERIFIED',DATE_ADD(CURDATE(),INTERVAL 365 DAY),?,NOW()),(?,'QUALIFICATION',?,'candidate-qualification.pdf','application/pdf',?,'VERIFIED',DATE_ADD(CURDATE(),INTERVAL 365 DAY),?,NOW())", [contractorId, documents[0].key, documents[0].sizeBytes, vendorId, candidateId, documents[1].key, documents[1].sizeBytes, vendorId, candidateId, documents[2].key, documents[2].sizeBytes, vendorId, candidateId, documents[3].key, documents[3].sizeBytes, vendorId]);
    await connection.commit();
    logger.info('demo_seed_complete', { created: true, vendor_email: DEMO_VENDOR, pm_email: 'demo.pm@workday.local', contractor_email: 'demo.contractor@workday.local' });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { await connection.end(); }
}

run().catch((error) => { logger.error('demo_seed_failed', { error_message: error.message }); process.exit(1); });
