const { execSync } = require('child_process');
const fs = require('fs');

console.log('process.cwd():', process.cwd());
console.log('process.env.USER/USERNAME:', process.env.USER, process.env.USERNAME);

try {
  const whoami = execSync('whoami', { encoding: 'utf8' }).trim();
  console.log('whoami:', whoami);
} catch (e) {
  console.error('Error running whoami:', e.message);
}

try {
  const gitVer = execSync('git --version', { encoding: 'utf8' }).trim();
  console.log('git version:', gitVer);
} catch (e) {
  console.error('Error running git --version:', e.message);
}

try {
  const gitStatus = execSync('git status', { encoding: 'utf8' }).trim();
  console.log('git status:', gitStatus);
} catch (e) {
  console.error('Error running git status:', e.message);
}
