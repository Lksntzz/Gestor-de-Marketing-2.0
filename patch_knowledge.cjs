const fs = require('fs');
const file = 'src/components/AddKnowledgeView.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace('syncedWithApi: true,', 'syncedWithApi: apiConfig.connectionStatus === "connected",');
content = content.replace('Nota Gravada com Sucesso no Cofre!', '{apiConfig.connectionStatus === "connected" ? "Nota Gravada com Sucesso no Cofre!" : "Nota Adicionada Apenas ao Painel Local!"}');

const h4Find = '<h4 className={`font-bold text-sm ${progress >= 90 ? \'text-blue-400\' : \'text-[#94A3B8]\'}`}>Gravação no Cofre</h4>';
const h4Replace = '<h4 className={`font-bold text-sm ${progress >= 90 ? \'text-blue-400\' : \'text-[#94A3B8]\'}`}>{apiConfig.connectionStatus === "connected" ? "Gravação no Cofre" : "Salvar no Painel"}</h4>';
content = content.replace(h4Find, h4Replace);

const pFind = '<p className="text-xs text-[#94A3B8] mt-0.5">Salvando arquivo Markdown estruturado.</p>';
const pReplace = '<p className="text-xs text-[#94A3B8] mt-0.5">{apiConfig.connectionStatus === "connected" ? "Salvando arquivo Markdown estruturado." : "Salvo localmente (sem API)."}</p>';
content = content.replace(pFind, pReplace);

fs.writeFileSync(file, content);
console.log('AddKnowledgeView.tsx patched successfully');
