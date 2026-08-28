const fs = require('fs');
let code = fs.readFileSync('src/hooks/usePersistentState.ts', 'utf8');

code = code.replace(/setValue\(parsed\.data as T\);/g, `setValue((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(parsed.data)) return prev;
          return parsed.data as T;
        });`);
        
code = code.replace(/setValue\(detail\.value as T\);/g, `setValue((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(detail.value)) return prev;
        return detail.value as T;
      });`);

fs.writeFileSync('src/hooks/usePersistentState.ts', code);
