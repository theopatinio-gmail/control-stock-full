const fs = require('fs');
const path = require('path');
const configPath = path.join(__dirname, 'ml_config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
config.snapshot_date = '2024-01-01';
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log('Updated snapshot_date to 2024-01-01');
