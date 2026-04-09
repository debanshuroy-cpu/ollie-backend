const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/residents.json');

function readResidents() {
  const data = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(data);
}

function writeResidents(residents) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(residents, null, 2));
}

function getAllResidents() {
  return readResidents();
}

function getResidentById(id) {
  const residents = readResidents();
  return residents.find(r => r.id === id) || null;
}

function createResident(data) {
  const residents = readResidents();
  const slug = (data.name || 'resident').toLowerCase().replace(/\s+/g, '-');
  const id = `${slug}-${Date.now()}`;
  const newResident = { id, ...data };
  residents.push(newResident);
  writeResidents(residents);
  return newResident;
}

function updateResident(id, updates) {
  const residents = readResidents();
  const index = residents.findIndex(r => r.id === id);
  if (index === -1) return null;
  residents[index] = { ...residents[index], ...updates };
  writeResidents(residents);
  return residents[index];
}

module.exports = { getAllResidents, getResidentById, createResident, updateResident };
