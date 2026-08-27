const fs = require('fs');
const file = 'src/components/ObsidianApiSettingsModal.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace backgrounds & text colors
content = content.replace(/bg-stone-900\/65/g, 'bg-[#0f131c]/80');
content = content.replace(/bg-white/g, 'bg-surface-card');
content = content.replace(/bg-stone-50\/70/g, 'bg-surface-container-low');
content = content.replace(/bg-stone-50\/30/g, 'bg-surface-container-low');
content = content.replace(/bg-stone-50/g, 'bg-[#1c2028]');
content = content.replace(/border-stone-100/g, 'border-outline-border');
content = content.replace(/border-stone-200\/80/g, 'border-outline-border');
content = content.replace(/border-stone-200/g, 'border-outline-border');
content = content.replace(/border-stone-300/g, 'border-outline-border');
content = content.replace(/border-stone-250/g, 'border-outline-border');

content = content.replace(/text-stone-950/g, 'text-text-primary');
content = content.replace(/text-stone-900/g, 'text-text-primary');
content = content.replace(/text-stone-800/g, 'text-text-primary');
content = content.replace(/text-stone-700/g, 'text-text-secondary');
content = content.replace(/text-stone-600/g, 'text-text-secondary');
content = content.replace(/text-stone-500/g, 'text-text-secondary');
content = content.replace(/text-stone-400/g, 'text-[#94A3B8]');

content = content.replace(/bg-stone-900/g, 'bg-[#334155]');
content = content.replace(/hover:bg-stone-800/g, 'hover:bg-[#475569]');

content = content.replace(/bg-purple-600/g, 'bg-pink-600');
content = content.replace(/hover:bg-purple-700/g, 'hover:bg-pink-700');
content = content.replace(/text-purple-600/g, 'text-pink-500');
content = content.replace(/focus:ring-purple-500/g, 'focus:ring-pink-500');
content = content.replace(/focus:border-purple-500/g, 'focus:border-pink-500');
content = content.replace(/border-purple-250/g, 'border-pink-500/30');
content = content.replace(/border-purple-150/g, 'border-pink-500/30');
content = content.replace(/border-purple-100\/50/g, 'border-pink-500/20');
content = content.replace(/border-purple-100/g, 'border-pink-500/30');
content = content.replace(/bg-purple-50\/40/g, 'bg-pink-500/5');
content = content.replace(/bg-purple-50\/80/g, 'bg-pink-500/10');
content = content.replace(/bg-purple-50\/75/g, 'bg-pink-500/10');
content = content.replace(/text-purple-950\/80/g, 'text-pink-200');

content = content.replace(/bg-emerald-50 /g, 'bg-emerald-500/10 ');
content = content.replace(/bg-emerald-50\/40/g, 'bg-emerald-500/10');
content = content.replace(/text-emerald-800/g, 'text-emerald-400');
content = content.replace(/text-emerald-900/g, 'text-emerald-400');
content = content.replace(/text-emerald-700/g, 'text-emerald-500');
content = content.replace(/border-emerald-200/g, 'border-emerald-500/30');
content = content.replace(/border-emerald-150/g, 'border-emerald-500/20');
content = content.replace(/bg-emerald-100/g, 'bg-emerald-500/20');

content = content.replace(/bg-amber-50 /g, 'bg-amber-500/10 ');
content = content.replace(/text-amber-900/g, 'text-amber-400');
content = content.replace(/border-amber-200/g, 'border-amber-500/30');

content = content.replace(/bg-red-50 /g, 'bg-red-500/10 ');
content = content.replace(/hover:bg-red-50 /g, 'hover:bg-red-500/10 ');
content = content.replace(/text-red-800/g, 'text-red-400');
content = content.replace(/text-red-700/g, 'text-red-400');
content = content.replace(/text-red-600/g, 'text-red-500');
content = content.replace(/border-red-200/g, 'border-red-500/30');

content = content.replace(/bg-blue-50 /g, 'bg-blue-500/10 ');
content = content.replace(/text-blue-600/g, 'text-blue-400');
content = content.replace(/border-blue-100/g, 'border-blue-500/30');

content = content.replace(/bg-rose-50\/30/g, 'bg-rose-500/10');
content = content.replace(/border-rose-200\/80/g, 'border-rose-500/20');
content = content.replace(/border-rose-200/g, 'border-rose-500/30');
content = content.replace(/text-rose-800/g, 'text-rose-400');
content = content.replace(/text-rose-700/g, 'text-rose-500');
content = content.replace(/bg-rose-600/g, 'bg-rose-600');
content = content.replace(/hover:bg-rose-700/g, 'hover:bg-rose-700');
content = content.replace(/hover:bg-rose-50 /g, 'hover:bg-rose-500/10 ');

content = content.replace(/hover:bg-stone-200\/60/g, 'hover:bg-[#334155]');
content = content.replace(/hover:bg-stone-200/g, 'hover:bg-[#334155]');
content = content.replace(/bg-stone-100/g, 'bg-[#0f131c]');
content = content.replace(/hover:bg-stone-100/g, 'hover:bg-[#0f131c]');
content = content.replace(/hover:text-stone-900/g, 'hover:text-text-primary');

// Fixing a few leftover hover:text-stone-700 overrides if previously replaced
content = content.replace(/hover:text-text-secondary/g, 'hover:text-text-primary'); 

fs.writeFileSync(file, content);
console.log('Theme updated!');
