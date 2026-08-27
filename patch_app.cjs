const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'showToast("success", "Nota Automatizada", `[[${newNote.title}]] inserida com sucesso no cofre.`);\n                confetti({ particleCount: 35, spread: 65 });',
  `if (apiConfig.connectionStatus === "connected") {
                  void handlePushNoteToObsidianApi(newNote);
                } else {
                  showToast("info", "Nota Salva Localmente", \`[[\${newNote.title}]] adicionada ao painel (Cofre Desconectado).\`);
                }
                confetti({ particleCount: 35, spread: 65 });`
);

fs.writeFileSync(file, content);
console.log('App.tsx patched for AddKnowledgeView onAddNote');
