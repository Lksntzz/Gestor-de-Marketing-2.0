const fs = require('fs');
const file = 'src/components/ObsidianApiSettingsModal.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/text-purple-700/g, 'text-pink-500');
content = content.replace(/text-purple-900/g, 'text-text-primary');
content = content.replace(/text-purple-950/g, 'text-text-primary');
content = content.replace(/text-stone-100/g, 'text-[#F8FAFC]');

content = content.replace(/text-amber-600/g, 'text-amber-400');
content = content.replace(/text-emerald-600/g, 'text-emerald-400');

content = content.replace(/bg-blue-600/g, 'bg-blue-500/20');
content = content.replace(/hover:bg-blue-700/g, 'hover:bg-blue-500/30 border border-blue-500/30 text-blue-400');

fs.writeFileSync(file, content);
console.log('Theme leftover updated!');
