const { execSync } = require('child_process');
const gitPath = '"C:\\Program Files\\Git\\cmd\\git.exe"';
const workspacePath = 'c:\\Users\\User\\Desktop\\LOGICIEL_EASY\\gestion_pro_workspace\\apps\\web';

try {
  const log = execSync(`${gitPath} -C "${workspacePath}" log -n 5`).toString();
  const status = execSync(`${gitPath} -C "${workspacePath}" status`).toString();
  console.log("--- GIT LOG ---\n" + log + "\n--- GIT STATUS ---\n" + status);
} catch (e) {
  console.log("ERROR RUNNING GIT:\n" + e.message + "\n" + (e.stdout ? e.stdout.toString() : ''));
}

process.exit(1); // Force failure to show stdout in task notification
