const fs = require('fs');
const path = require('path');

const jsonPath = path.resolve(__dirname, '../src/data/migrasi_redeem_data.json');
const tsPath = path.resolve(__dirname, '../src/data/migrasi_redeem_data.ts');

const json = fs.readFileSync(jsonPath, 'utf8');
const tsContent = `import type { MigrasiRedeemItem } from '../types';\n\nexport const initialMigrasiRedeemData: MigrasiRedeemItem[] = ${json};\n`;

fs.writeFileSync(tsPath, tsContent, 'utf8');
console.log('Created src/data/migrasi_redeem_data.ts');
