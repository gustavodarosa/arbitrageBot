const { execSync } = require('child_process');
const fs = require('fs');
function run(cmd, opts = {}){
  try{
    return execSync(cmd, { stdio: 'pipe', encoding: 'utf8', ...opts });
  }catch(e){
    return e.stdout ? e.stdout.toString() : (e.message || String(e));
  }
}
console.log('=== REPO QUICK AUDIT ' + new Date().toUTCString() + ' ===\n');
console.log('[info] pwd:', process.cwd());
console.log('[info] git branch:', run('git rev-parse --abbrev-ref HEAD 2>/dev/null || echo no-git'));
console.log('[info] last commits (10):');
console.log(run('git --no-pager log -n 10 --oneline || true'));
console.log('\n[scan] searching for likely secret filenames...');
console.log(run('git ls-files'));
console.log('\n[scan] grep for suspicious tokens in tracked files (PRIVATE_KEY, API_KEY, SECRET, mnemonic)');
console.log(run('git grep -I --line-number -E "PRIVATE_KEY|PRIVATE_KEYS|API_KEY|SECRET|mnemonic|PASSWORD" || true'));
console.log('\n=== .env.example (if exists) ===');
if(fs.existsSync('.env.example')){
  console.log(fs.readFileSync('.env.example','utf8').split('\n').slice(0,200).join('\n'));
}else console.log('(no .env.example)');
console.log('\n=== package.json ===');
if(fs.existsSync('package.json')){
  console.log(fs.readFileSync('package.json','utf8').split('\n').slice(0,300).join('\n'));
}else console.log('(no package.json)');
console.log('\n[info] node:');
try{ console.log(run('node -v')); }catch(e){ console.log('node not installed'); }
console.log('[info] npm:');
try{ console.log(run('npm -v')); }catch(e){ console.log('npm not installed'); }
console.log('\n[action] running npm ci (may take a while)...');
if(run('which npm >/dev/null 2>&1 || echo no').includes('no')){
  console.log('npm not available');
} else {
  console.log(run('npm ci --silent || echo npm-ci-failed'));
}
console.log('\n[action] TypeScript build check (tsc) if configured...');
if(fs.existsSync('tsconfig.json')){
  console.log(run('npx -y tsc --noEmit || echo tsc-errors-or-not-configured'));
} else console.log('no tsconfig.json');
console.log('\n[action] running npm audit --json (output to audit.json)...');
if(run('which npm >/dev/null 2>&1 || echo no').includes('no')){
  console.log('npm not available');
} else {
  try{
    fs.writeFileSync('audit.json', run('npm audit --json || echo {}'));
    console.log('audit.json written (first 200 chars):');
    console.log(fs.readFileSync('audit.json','utf8').slice(0,200) + '\n...[truncated]');
  }catch(e){ console.log('audit failed', e.message || e); }
}
console.log('\n=== Key source files preview (first 200 lines each) ===');
const files = ['package.json','src/index.ts'].concat(
  (fs.existsSync('src/arbitrage')? fs.readdirSync('src/arbitrage').filter(f=>f.endsWith('.ts')).map(f=>'src/arbitrage/'+f):[])
).concat(
  (fs.existsSync('src/utils')? fs.readdirSync('src/utils').filter(f=>f.endsWith('.ts')).map(f=>'src/utils/'+f):[])
).concat(['.env.example','README.md']);
files.forEach(f=>{
  if(fs.existsSync(f)){
    console.log('\n----- ' + f + ' -----');
    console.log(fs.readFileSync(f,'utf8').split('\n').slice(0,200).join('\n'));
  }
});
console.log('\n[info] repo size (du -sh .):');
try{ console.log(run('du -sh . || echo du-not-available')); }catch(e){ console.log('du not available'); }
console.log('\n=== END OF AUDIT ===');
