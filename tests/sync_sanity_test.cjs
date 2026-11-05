// Testes estáticos/isolados; não substituem um teste com dois celulares no Firebase.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const dir = path.join(__dirname,'..');
const read = (file) => fs.readFileSync(path.join(dir,file),'utf8');
for(const file of ['app.js','cloud.js','firebase-config.js','sw.js']) {
  new vm.Script(read(file),{filename:file});
}
const html = read('index.html');
for(const f of ['app.js','cloud.js','firebase-config.js','styles.css','sw.js','firestore.rules'])
  assert.equal(fs.existsSync(path.join(dir,f)),true,`faltando ${f}`);
for(const f of ['app.js','cloud.js','firebase-config.js']) assert.match(html,new RegExp(f.replace('.','\\.')));
assert.match(read('cloud.js'),/api\.onSnapshot\(api\.collection\(db,'homes',id,'tasks'\)/);
assert.match(read('cloud.js'),/api\.onSnapshot\(api\.collection\(db,'homes',id,'messages'\)/);
assert.match(read('firestore.rules'),/function isMember\(homeId\)/);
assert.match(read('firestore.rules'),/allow delete: if isMember\(homeId\)/);
assert.match(read('firestore.rules'),/request\.resource\.data\.members\.size\(\) <= 2/);
assert.match(read('app.js'),/cloudWrite\('putTask'/);
assert.match(read('app.js'),/cloudWrite\('deleteTask'/);
assert.match(read('app.js'),/cloudWrite\('putMessage'/);
const persist = read('app.js').match(/function persist\(\)\s*\{[\s\S]*?\n  \}/)?.[0];
assert.ok(persist,'persist() não encontrado');
let writes=0;
const run=(cloudMode)=>vm.runInNewContext(persist+'\npersist()',{
  cloudMode, state:{tasks:[],messages:[]}, STORAGE_KEY:'local',
  safeWrite:()=>{writes++;return true;},JSON
});
run(true);assert.equal(writes,0,'sync não pode sobrescrever a lista local');
run(false);assert.equal(writes,1,'modo local precisa persistir');
console.log('OK: arquivos, escutas em tempo real, proteção da lista local e chamadas de escrita.');
