#!/usr/bin/env node

import fs from 'node:fs';
import childProcess from 'node:child_process';
import process from 'node:process';
import { globSync } from 'glob';

const readSourceFile = (filePath) => fs.readFileSync(new URL(filePath, import.meta.url), 'utf8');
const workflowFindRaw = readSourceFile('./workflow-find.txt');
const workflowFind = new RegExp(RegExp.escape(workflowFindRaw).replaceAll(/v\d/g, 'v\\d'), 'g');
const workflowReplace = readSourceFile('./workflow-replace.txt');

const spawn = (...args) => {
  const result = childProcess.spawnSync(...args);
  if (result.status !== 0) {
    process.exit(result.status);
  }
};

const migrate = () => {
  const dir = fs.readdirSync('./');

  if (!dir.includes('package.json')) {
    console.error('no package.json found!');
    return;
  }

  /* package.json */

  const packageJsonString = fs.readFileSync('package.json', 'utf8');
  let packageJson = {};
  try {
    packageJson = JSON.parse(packageJsonString);
  } catch {
    console.error('could not parse package.json!');
    return;
  }

  delete packageJson.packageManager;

  if (packageJson.scripts?.preinstall === 'npx only-allow pnpm') {
    delete packageJson.scripts.preinstall;
  }
  for (const key of Object.keys(packageJson.scripts)) {
    packageJson.scripts[key] = packageJson.scripts[key]
      .replaceAll('pnpm run', 'npm run')
      .replaceAll('pnpm test', 'npm test')
      .replaceAll('pnpm', 'npm run');
  }

  if (packageJson.engines?.npm?.includes('please-use')) {
    delete packageJson.engines;
  }

  fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n', {
    flag: 'w+',
  });

  /* workflows */

  for (const filePath of globSync('.github/workflows/*')) {
    let workflow = fs.readFileSync(filePath, 'utf8');

    workflow = workflow.replaceAll(workflowFind, workflowReplace);
    workflow = workflow
      .replaceAll('pnpm run', 'npm run')
      .replaceAll('pnpm test', 'npm test')
      .replaceAll('pnpm', 'npm run');

    fs.writeFileSync(filePath, workflow, {
      flag: 'w+',
    });
  }

  /* */

  fs.rmSync('./pnpm-lock.yaml', { force: true });
  fs.rmSync('./pnpm-workspace.yaml', { force: true });
  fs.rmSync('./node_modules', { recursive: true, force: true });

  spawn('npm', ['i'], { stdio: 'inherit' });

  if (packageJson.resolutions) {
    console.log('you must change resolutions to overrides!');
  }

  console.log(
    'you may want to run `npm approve-scripts --all --allow-scripts-pin=false` or similar!',
  );
  console.log('you may want to run `utd`');
  console.log('you may want to run `ncu -i`');
  console.log('you may commit as `build: Change package managers to NPM`');
};

migrate();
