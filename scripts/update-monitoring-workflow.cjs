// Update Monitoring Workflow to use get-system-metrics endpoint
const fs = require('fs');

const workflow = JSON.parse(fs.readFileSync('n8n-workflows/monitoring-workflow.json', 'utf-8'));

// Update Health Check node to use new endpoint
const healthCheckNode = workflow.nodes.find(n => n.name === 'API Health Check');
if (healthCheckNode) {
  console.log('Old URL:', healthCheckNode.parameters.url);
  healthCheckNode.parameters.url = "={{ $('Configuration').first().json.apiBaseUrl }}?action=get-system-metrics";
  healthCheckNode.parameters.sendHeaders = true;
  healthCheckNode.parameters.headerParameters = {
    parameters: [
      {
        name: 'Authorization',
        value: "=Bearer {{ $('Configuration').first().json.cronSecret }}"
      }
    ]
  };
  console.log('✅ Updated Health Check node');
}

// Add cronSecret to Configuration node
const configNode = workflow.nodes.find(n => n.name === 'Configuration');
if (configNode) {
  const hasCronSecret = configNode.parameters.assignments.assignments.find(a => a.name === 'cronSecret');
  if (!hasCronSecret) {
    configNode.parameters.assignments.assignments.push({
      id: 'id-cron',
      name: 'cronSecret',
      value: '={{ $env.CRON_SECRET }}',
      type: 'string'
    });
    console.log('✅ Added cronSecret to Configuration');
  }
}

// Update Analyze Health node with enhanced logic
const analyzeNode = workflow.nodes.find(n => n.name === 'Analyze Health');
if (analyzeNode) {
  analyzeNode.parameters.jsCode = `const metricsResult = $input.first()?.json || {};

const issues = [];
let status = 'healthy';

// Check API health
if (!metricsResult.success) {
  issues.push('❌ API не отвечает');
  status = 'critical';
}

// Check expiring subscriptions
const expiringCount = metricsResult.metrics?.subscriptions?.expiring_soon?.length || 0;
if (expiringCount > 0) {
  issues.push(\`⚠️ Истекает подписок: \${expiringCount}\`);
  if (status === 'healthy') status = 'warning';
}

// Check Sentinel errors
const sentinelErrors = metricsResult.metrics?.sentinel?.errors_last_hour || 0;
if (sentinelErrors > 10) {
  issues.push(\`⚠️ Sentinel ошибок за час: \${sentinelErrors}\`);
  if (status === 'healthy') status = 'warning';
}

let message = '';
if (status === 'healthy') {
  message = \`✅ *NeuroGUARDIAN Health Report*\\\\n\\\\n\` +
    \`🟢 API: Работает\\\\n\` +
    \`🛡️ Sentinel: OK\\\\n\` +
    \`📊 Подписки: OK\\\\n\` +
    \`⏰ \${new Date().toLocaleString('ru-RU')}\`;
} else {
  message = \`⚠️ *NeuroGUARDIAN Alert*\\\\n\\\\n\` +
    \`Status: \${status.toUpperCase()}\\\\n\\\\n\` +
    \`Проблемы:\\\\n\${issues.join('\\\\n')}\\\\n\\\\n\` +
    \`⏰ \${new Date().toLocaleString('ru-RU')}\`;
}

return {
  json: {
    status: status,
    issues: issues,
    message: message,
    shouldNotify: status !== 'healthy',
    metricsResult: metricsResult
  }
};`;
  console.log('✅ Updated Analyze Health node');
}

fs.writeFileSync('n8n-workflows/monitoring-workflow.json', JSON.stringify(workflow, null, 2));
console.log('\n✅ Monitoring workflow enhanced with system metrics');
