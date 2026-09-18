const fs = require('fs');
const path = require('path');

// Extract all agent filenames
const agentsDir = path.join(__dirname, 'src', 'agents');
const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('Agent.ts') && f !== 'masterOrchestrator.ts');

let imports = `import { Router, Request, Response } from 'express';\n`;
imports += `import { runMasterOrchestrator } from '../agents/masterOrchestrator.js';\n`;
let switchCases = `      case 'master-orchestrator':\n        result = await runMasterOrchestrator(input, tenantContext);\n        break;\n`;

files.forEach(file => {
  const baseName = file.replace('.ts', '');
  const functionName = 'run' + baseName.charAt(0).toUpperCase() + baseName.slice(1);
  
  // Try to parse the id from the file content to map route
  const content = fs.readFileSync(path.join(agentsDir, file), 'utf8');
  const idMatch = content.match(/id:\s*'([^']+)'/);
  const id = idMatch ? idMatch[1] : null;

  if (id) {
    imports += `import { ${functionName} } from '../agents/${baseName}.js';\n`;
    switchCases += `      case '${id}':\n        result = await ${functionName}(input, tenantContext);\n        break;\n`;
  }
});

const routeFileContent = `${imports}
const router = Router();

// Generic endpoint to run a specific agent
router.post('/run/:agentId', async (req: Request, res: Response) => {
  const { agentId } = req.params;
  const { input, tenantContext, rawInput } = req.body;

  // The orchestrator takes rawInput, others take input
  const payload = agentId === 'master-orchestrator' ? (rawInput || input) : input;

  if (!payload) {
    return res.status(400).json({ error: 'Input (or rawInput) is required' });
  }

  try {
    let result;

    switch (agentId) {
${switchCases}
      default:
        return res.status(404).json({ error: \`Agent \${agentId} not found or not implemented yet.\` });
    }

    if (result.status === 'error') {
      return res.status(500).json({ error: result.output || result.routingDecision });
    }

    res.json(result);
  } catch (error) {
    console.error(\`Error running agent \${agentId}:\`, error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
`;

fs.writeFileSync(path.join(__dirname, 'src', 'routes', 'agents.routes.ts'), routeFileContent);
console.log('agents.routes.ts successfully generated!');
