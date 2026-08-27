const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

const searchStr = `          setNotes((prev) => [newCampNote, ...prev]);
          syncedCount++;
        }
      });

      await storage.logAudit({`;

const replaceStr = `          setNotes((prev) => [newCampNote, ...prev]);
          if (apiConfig.connectionStatus === "connected") {
            void handlePushNoteToObsidianApi(newCampNote);
          }
          syncedCount++;
        }
      });

      await storage.logAudit({`;

content = content.replace(searchStr, replaceStr);

const searchToast = `      showToast(
        "success",
        "Automação Executada!",
        syncedCount > 0
          ? \`\${syncedCount} notas de campanha estruturadas em 04_Campanhas.\`
          : "Todas as campanhas já estão sincronizadas em 04_Campanhas."
      );`;

const replaceToast = `      showToast(
        "success",
        "Automação Executada!",
        syncedCount > 0
          ? (apiConfig.connectionStatus === "connected" ? \`\${syncedCount} notas de campanha estruturadas em 04_Campanhas.\` : \`\${syncedCount} notas estruturadas apenas localmente (Cofre Desconectado).\`)
          : "Todas as campanhas já estão sincronizadas em 04_Campanhas."
      );`;

content = content.replace(searchToast, replaceToast);

fs.writeFileSync(file, content);
console.log('App.tsx patched for rule_auto_tasks');
