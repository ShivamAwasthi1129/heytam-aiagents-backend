const fs = require('fs');
const path = require('path');

const agentsDir = path.join(__dirname, 'src', 'agents');
const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.ts'));

let fixed = 0;
files.forEach(file => {
  let content = fs.readFileSync(path.join(agentsDir, file), 'utf8');

  // Replace tools with tools: tools as any
  content = content.replace(/tools,\n/g, 'tools: tools as any,\n');
  content = content.replace(/tools: tools as any as any,/g, 'tools: tools as any,');

  // Replace maxSteps: X with stopWhen: ({ stepCount }: any) => stepCount >= X
  content = content.replace(/maxSteps:\s*(\d+),/g, 'stopWhen: ({ stepCount }: any) => stepCount >= $1,');

  fs.writeFileSync(path.join(agentsDir, file), content);
  fixed++;
});

console.log(`Updated ${fixed} agent files.`);
