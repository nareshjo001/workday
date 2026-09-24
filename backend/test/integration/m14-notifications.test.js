process.env.NODE_ENV="test";process.env.DB_NAME=process.env.DB_NAME||"vms_test";process.env.JWT_SECRET="m14-test";
const assert=require("node:assert/strict"),{before,after,test}=require("node:test"),{resetTestDatabase}=require("../helpers/testDatabase"),app=require("../../src/app"),{pool}=require("../../src/config/db");let server,base,n=0;const email=x=>`m14-${x}-${Date.now()}-${++n}@test.example`;async function req(m,p,b,t){const h={"Content-Type":"application/json",...(t?{Authorization:`Bearer ${t}`}:{})},r=await fetch(`${base}${p}`,{method:m,headers:h,body:b===undefined?undefined:JSON.stringify(b)}),text=await r.text();return{r,data:text?JSON.parse(text):null};}async function signup(role){const e=email(role),body={name:role,email:e,password:"Password123!",role,...(role==="PM"?{companyName:`M14 ${n}`}:{})};assert.equal((await req("POST","/auth/signup",body)).r.status,201);return{email:e,token:(await req("POST","/auth/login",{email:e,password:"Password123!"})).data.token};}before(async()=>{await resetTestDatabase();await new Promise(ok=>server=app.listen(0,"127.0.0.1",ok));base=`http://127.0.0.1:${server.address().port}/api`;});after(async()=>{await new Promise(ok=>server.close(ok));await pool.end();});test("M14 creates idempotent, recipient-scoped notifications after candidate commit",async()=>{const pm=await signup("PM"),vendor=await signup("VENDOR"),ce=email("c"),c=await req("POST","/vendor/contractors",{name:"C",email:ce,password:"Password123!",hourly_rate:50},vendor.token),ct=(await req("POST","/auth/login",{email:ce,password:"Password123!"})).data.token;await req("PATCH","/contractor/profile/skill",{skill:"FRONTEND"},ct);const p=await req("POST","/pm/projects",{name:"M14",start_date:new Date().toISOString().slice(0,10),expected_hours:8,requirements:[{skill:"FRONTEND",required_count:1}]},pm.token),s=await req("POST",`/vendor/projects/${p.data.id}/requirements/${p.data.requirements[0].id}/candidates`,{contractor_id:c.data.id},vendor.token);assert.equal(s.r.status,201);const inbox=await req("GET","/pm/notifications",undefined,pm.token);assert.equal(inbox.data.unread_count,1);assert.equal(inbox.data.items[0].event_type,"CANDIDATE_SUBMITTED");assert.equal((await req("GET","/vendor/notifications",undefined,vendor.token)).data.items.length,0);assert.equal((await req("PUT","/pm/notification-preferences/CANDIDATE_SUBMITTED",{in_app_enabled:false},pm.token)).r.status,204);assert.equal((await req("PATCH",`/pm/notifications/${inbox.data.items[0].id}/read`,undefined,pm.token)).r.status,204);});
test("Notification endpoint supports pagination and preserves global unread count across pages", async () => {
  const vendor = await signup("VENDOR");
  const [userRow] = await pool.query("SELECT id FROM users WHERE email=?", [vendor.email]);
  const userId = userRow[0].id;

  // Insert 15 notifications: 10 unread, 5 read
  for (let i = 1; i <= 15; i++) {
    const isRead = i > 10;
    await pool.query(
      "INSERT INTO notifications (recipient_id, event_type, entity_type, entity_id, message, deep_link, read_at, created_at) VALUES (?, 'INVOICE_APPROVED', 'invoice', ?, ?, '/vendor/invoices', ?, DATE_SUB(NOW(), INTERVAL ? MINUTE))",
      [userId, i, `Invoice notification #${i}`, isRead ? new Date() : null, 15 - i]
    );
  }

  // Fetch Page 1 with limit 10
  const page1Res = await req("GET", "/vendor/notifications?page=1&limit=10", undefined, vendor.token);
  assert.equal(page1Res.r.status, 200);
  assert.equal(page1Res.data.items.length, 10);
  assert.equal(page1Res.data.unread_count, 10);
  assert.deepEqual(page1Res.data.pagination, {
    page: 1,
    limit: 10,
    total: 15,
    total_pages: 2,
  });

  // Fetch Page 2 with limit 10
  const page2Res = await req("GET", "/vendor/notifications?page=2&limit=10", undefined, vendor.token);
  assert.equal(page2Res.r.status, 200);
  assert.equal(page2Res.data.items.length, 5);
  // unread_count remains global (10) across entire account
  assert.equal(page2Res.data.unread_count, 10);
  assert.deepEqual(page2Res.data.pagination, {
    page: 2,
    limit: 10,
    total: 15,
    total_pages: 2,
  });

  // Mark all read
  const readAllRes = await req("PATCH", "/vendor/notifications/read-all", undefined, vendor.token);
  assert.equal(readAllRes.r.status, 204);

  // Re-fetch page 1
  const afterReadAll = await req("GET", "/vendor/notifications?page=1&limit=10", undefined, vendor.token);
  assert.equal(afterReadAll.r.status, 200);
  assert.equal(afterReadAll.data.unread_count, 0);
  assert.ok(afterReadAll.data.items.every((item) => item.read_at !== null));
});
