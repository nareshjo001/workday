# Testing

`m15-rate-cards.test.js` validates active relationship scope, same-skill overlap rejection, and adjacent future periods. `m15-rate-card-snapshots.test.js` exercises the real Vendor submit → PM accept lifecycle, verifies bill/cost/currency/card snapshots, verifies used-card immutability, and confirms PM receives bill rate but not cost rate. Full backend coverage and frontend lint/build remain mandatory gates.
