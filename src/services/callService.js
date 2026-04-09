const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/calls.json');

function readCalls() {
  const data = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(data);
}

function writeCalls(calls) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(calls, null, 2));
}

function saveCall(callData) {
  const calls = readCalls();
  calls.push(callData);
  writeCalls(calls);
  return callData;
}

function getCalls() {
  return readCalls();
}

function getCallsByResident(residentId) {
  return readCalls().filter(c => c.residentId === residentId);
}

module.exports = { saveCall, getCalls, getCallsByResident };
