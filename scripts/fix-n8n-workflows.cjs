#!/usr/bin/env node
/**
 * Исправление экспортированных n8n workflows
 * Заменяет \\n на правильные переносы строк в JavaScript коде
 */

const fs = require('fs');
const path = require('path');

const WORKFLOWS_DIR = './n8n-workflows';

function fixWorkflow(filePath) {
  console.log(`\n🔧 Исправляем: ${path.basename(filePath)}`);
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const workflow = JSON.parse(content);
  
  let fixed = false;
  
  // Исправляем все Code ноды
  workflow.nodes.forEach(node => {
    if (node.type === 'n8n-nodes-base.code' && node.parameters.jsCode) {
      const originalCode = node.parameters.jsCode;
      
      // Заменяем \\n на \n и \\\\n на \n
      let fixedCode = originalCode
        .replace(/\\\\n/g, '\n')
        .replace(/\\\\"/g, '"')
        .replace(/\\\\'/g, "'");
      
      if (originalCode !== fixedCode) {
        node.parameters.jsCode = fixedCode;
        fixed = true;
        console.log(`   ✅ Исправлена нода: ${node.name}`);
      }
    }
  });
  
  if (fixed) {
    // Сохраняем исправленный файл
    fs.writeFileSync(filePath, JSON.stringify(workflow, null, 2), 'utf-8');
    console.log(`   💾 Файл сохранен`);
    return true;
  } else {
    console.log(`   ℹ️  Исправлений не требуется`);
    return false;
  }
}

function main() {
  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║   n8n Workflows Fix Tool                       ║');
  console.log('║   NeuroGUARDIAN                                 ║');
  console.log('╚════════════════════════════════════════════════╝');

  const files = fs.readdirSync(WORKFLOWS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => path.join(WORKFLOWS_DIR, f));

  console.log(`\n📁 Найдено workflows: ${files.length}`);

  let fixedCount = 0;
  
  files.forEach(file => {
    if (fixWorkflow(file)) {
      fixedCount++;
    }
  });

  console.log('\n╔════════════════════════════════════════════════╗');
  console.log(`║  ✅ Исправлено: ${fixedCount}/${files.length} workflows`);
  console.log('╚════════════════════════════════════════════════╝\n');
  
  if (fixedCount > 0) {
    console.log('🚀 Теперь импортируйте workflows в n8n!');
    console.log('   Они должны работать корректно.\n');
  }
}

main();
