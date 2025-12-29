const { execSync } = require('child_process');

try {
  console.log('📋 Fetching workflows...');
  const json = execSync('docker exec ng_n8n n8n export:workflow --all').toString();
  const workflows = JSON.parse(json);
  
  console.log(`📊 Found ${workflows.length} workflows`);

  workflows.forEach(wf => {
    if (!wf.active) {
      console.log(`🚀 Activating "${wf.name}" (${wf.id})...`);
      try {
        // Try update:workflow first
        execSync(`docker exec ng_n8n n8n update:workflow --id=${wf.id} --active=true`);
        console.log('   ✅ Active');
      } catch (e) {
        console.log('   Warning: update:workflow failed, trying db update directly');
        // Fallback to SQLite update
        execSync(`docker exec ng_n8n sqlite3 /home/node/.n8n/database.sqlite "UPDATE workflow_entity SET active=1 WHERE id='${wf.id}';"`);
        console.log('   ✅ DB Updated');
      }
    } else {
      console.log(`✅ "${wf.name}" is already active`);
    }
  });
  
  console.log('\n🔄 Restarting n8n to ensure changes pick up...');
  execSync('docker restart ng_n8n');
  console.log('✅ Done');

} catch (error) {
  console.error('❌ Error:', error.message);
}
