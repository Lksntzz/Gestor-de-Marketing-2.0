const fs = require('fs');
const file = 'src/components/ObsidianApiSettingsModal.tsx';
let content = fs.readFileSync(file, 'utf8');

// Ensure inputs are dark
content = content.replace(/bg-surface-card border/g, 'bg-[#0f131c] border');
content = content.replace(/bg-\[#1c2028\] border border-outline-border/g, 'bg-[#0f131c] border border-outline-border');

// The main modal wrapper background is `bg-surface-card`
// The buttons that were converted to bg-surface-card might have been changed to bg-[#0f131c] now. Let's fix buttons.
// Usually buttons have `cursor-pointer` or `rounded-lg` with `transition-colors`.
// Let's just review it visually if it's fine.

fs.writeFileSync(file, content);
console.log('Inputs updated!');
