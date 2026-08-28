const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
if (!code.includes('console.log("App renders"')) {
  code = code.replace(/export default function App\(\) \{/, `export default function App() {
  console.log("App renders", { activeTab });`);
  fs.writeFileSync('src/App.tsx', code);
}
