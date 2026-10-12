// Parse as inert text. Never import or evaluate the recovered agent.
const fs = require('node:fs');
const path = require('node:path');
const parser = require('/Users/jared/.npm/_npx/dea9475797100b20/node_modules/@babel/parser');
const sourcePath = path.join(__dirname, 'agents-readable/main_agent.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const ast = parser.parse(source, {sourceType:'unambiguous'});
const targets = new Set(['GC','ve','g0e']);
const records = [];
function walk(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'VariableDeclarator' && targets.has(node.id?.name)) {
    records.push({name:node.id.name, kind:'class', start:node.start, end:node.end, startLine:node.loc.start.line, endLine:node.loc.end.line, text:'var '+source.slice(node.start,node.end)+';'});
  }
  if (node.type === 'FunctionDeclaration' && node.id?.name === '_0') {
    records.push({name:'_0',kind:'function',start:node.start,end:node.end,startLine:node.loc.start.line,endLine:node.loc.end.line,text:source.slice(node.start,node.end)});
  }
  for (const [key, value] of Object.entries(node)) {
    if (['loc','start','end','extra'].includes(key)) continue;
    if (Array.isArray(value)) value.forEach(walk);
    else if(value && typeof value === 'object') walk(value);
  }
}
walk(ast);
fs.mkdirSync(path.join(__dirname,'gift-scope'),{recursive:true});
for(const record of records) fs.writeFileSync(path.join(__dirname,'gift-scope',record.name+'.js'), '// Inert recovered excerpt; dependencies unresolved. Source: agents-readable/main_agent.js:'+record.startLine+'\n'+record.text+'\n');
fs.writeFileSync(path.join(__dirname,'gift-scope/source-map.json'),JSON.stringify(records.map(({text,...record})=>record),null,2));
console.log(records.map(({text,...record})=>record));
