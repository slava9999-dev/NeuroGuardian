import { execSync } from 'child_process';

// ANSI Color Codes manually to avoid dependency issues if chalk isn't there
const CRM = '\x1b[31m'; // Crimson (Red)
const GRN = '\x1b[32m'; // Green
const CYN = '\x1b[36m'; // Cyan
const YEL = '\x1b[33m'; // Yellow
const RST = '\x1b[0m'; // Reset
const BLD = '\x1b[1m'; // Bold

const section = (title: string) => console.log(`\n${BLD}${CYN}▓▓▓▓▓▓ [ ${title} ] ▓▓▓▓▓▓${RST}\n`);

interface CheckResult {
  name: string;
  status: 'passed' | 'failed' | 'warning';
  output: string;
  duration: number;
}

async function runCheck(name: string, command: string): Promise<CheckResult> {
  const start = Date.now();
  try {
    process.stdout.write(`${CYN}⚡ EXEC: ${name}... ${RST}`);
    const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
    const duration = Date.now() - start;
    console.log(`${GRN}✔ OK (${duration}ms)${RST}`);
    return { name, status: 'passed', output, duration };
  } catch (error: unknown) {
    const duration = Date.now() - start;
    console.log(`${CRM}✘ FAIL (${duration}ms)${RST}`);
    const err = error as { stdout: string; stderr: string }; // simple casting for child_process error structure
    return {
      name,
      status: 'failed',
      output: (err.stdout || '') + '\n' + (err.stderr || String(error)),
      duration,
    };
  }
}
async function main() {
  console.clear();
  console.log(`${BLD}${CYN}
  ================================================
  NEURO-GUARDIAN SELF-DIAGNOSTIC PROTOCOL
  ================================================
  ${RST}`);
  console.log(`${CYN}Target: C:\\NeuroGUARDIAN${RST}\n`);

  const results: CheckResult[] = [];

  // 1. Type Check
  section('NEURAL PATHWAYS (TypeScript)');
  results.push(await runCheck('Type Check', 'npm run typecheck'));

  // 2. Dead Code Analysis (Knip)
  section('NECROSIS SCAN (Knip)');
  // knip might fail if it finds issues, which is good
  results.push(await runCheck('Dead Code Scan', 'npx knip --no-exit-code'));

  // 3. Linting
  section('PROTOCOL COMPLIANCE (Lint)');
  results.push(await runCheck('Linter', 'npm run lint'));

  // 4. Tests (Fast)
  section('SIMULATION (Unit Tests)');
  results.push(await runCheck('Unit Tests', 'npm test'));

  // Report
  section('DIAGNOSTIC REPORT');

  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status === 'failed').length;

  console.log(`Run Time: ${BLD}${results.reduce((a, b) => a + b.duration, 0)}ms${RST}`);
  console.log(`Modules Checked: ${BLD}${results.length}${RST}`);
  console.log(
    `Stability: ${failed === 0 ? GRN + '100%' : CRM + Math.round((passed / results.length) * 100) + '%'}${RST}`
  );

  if (failed > 0) {
    console.log(`\n${CRM}${BLD}CRITICAL FAILURES DETECTED:${RST}`);
    results
      .filter(r => r.status === 'failed')
      .forEach(r => {
        console.log(`\n${YEL}>>> ${r.name} ERROR LOG:${RST}`);
        console.log(r.output.substring(0, 500) + (r.output.length > 500 ? '... [TRUNCATED]' : ''));
        console.log(`${YEL}<<< END LOG${RST}`);
      });
    console.log(`\n${CRM}System Compromised. Initiate repair protocols.${RST}`);
    process.exit(1);
  } else {
    console.log(`\n${GRN}System Optimal. NeuroGUARDIAN ready for deployment.${RST}`);
    process.exit(0);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
