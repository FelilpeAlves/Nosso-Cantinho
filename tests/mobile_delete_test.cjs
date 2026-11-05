// Regressão: excluir tarefas precisa funcionar desde a tela inicial no celular.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const read = (name) => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const app = read('app.js');
const block = (start, end) => app.slice(app.indexOf('function ' + start + '('), app.indexOf('function ' + end + '('));
const task = {id: 't1', title: 'Lavar banheiro', category: 'banheiro', owner: 'Aline', frequency: 'weekly', done: false};
const html = vm.runInNewContext(block('taskCard','renderSpotlight') + '\ntaskCard(task)', {
  task, currentPage: 'home', isDone: () => false,
  CATEGORIES: {banheiro: {file: 'banheiro.svg'}}, FREQUENCIES: {weekly: 'Semanal'},
  escapeHTML: String, icon: String
});
assert.match(html, /data-action="delete"/);
assert.match(html, /data-action="edit"/);
assert.match(read('styles.css'), /min-height:42px/);
const state = {tasks: [task]};
let saved = 0;
const env = {state, window: {confirm: () => false}, $: () => ({value: ''}),
  resetForm: () => {}, update: () => {saved++;}, toast: () => {}};
const onClick = vm.runInNewContext('(' + block('onClick','exportBackup') + ')', env);
const event = {target: {closest: () => ({dataset: {action: 'delete', id: 't1'}})}};
onClick(event);
assert.equal(state.tasks.length, 1, 'cancelar não deve apagar');
env.window.confirm = () => true;
onClick(event);
assert.equal(state.tasks.length, 0, 'confirmar deve apagar');
assert.equal(saved, 1, 'exclusão deve persistir');
console.log('OK: editar/excluir visíveis, cancelar preserva e confirmar exclui.');
