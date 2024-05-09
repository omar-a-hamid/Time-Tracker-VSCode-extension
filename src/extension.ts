import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import simpleGit, { SimpleGit } from 'simple-git';

const folderPathArr = vscode.workspace.workspaceFolders;
const folderPath = folderPathArr?.[0]?.uri.fsPath.concat("\\");


const logFilePath = path.join(vscode.workspace.rootPath ?? '', 'time-tracker/time-tracker.log');
const gitBranchesFilePath = path.join(vscode.workspace.rootPath ?? '', 'time-tracker/git-branches.log');
const summaryFilePath = path.join(vscode.workspace.rootPath ?? '', 'time-tracker/time-summary.log');
const git: SimpleGit = simpleGit(vscode.workspace.rootPath ?? '');

let activeFile: string | null = null;
let startTime: number | null = null;
let currentBranch: string | null = null;
let files: { [key: string]: number } = {};
let branches: { [key: string]: { startTime: number, elapsedTime: number } } = {};
let intervalId: string | number | NodeJS.Timeout | undefined;
let intervalId2: string | number | NodeJS.Timeout | undefined;
let killFlag: boolean = false;

const COMMON_PACKAGE_NAME = "src\\main\\java\\com\\siemens\\iess\\";

export function activate(context: vscode.ExtensionContext) {

	fs.appendFileSync(summaryFilePath, `\n[${getTime()}] started a new logging session:\n`);
	fs.appendFileSync(logFilePath, `\n[${getTime()}] started a new logging session:\n`);
	fs.appendFileSync(gitBranchesFilePath, `\n[${getTime()}] started a new logging session:\n`);

    // log(`fileName ${folderPath}`);
    // console.log(folderPath);



    vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
            const newActiveFile = editor.document.fileName.replace(String(folderPath),"").replace(COMMON_PACKAGE_NAME,"");
            if (newActiveFile !== activeFile) {
                if (activeFile) {
                    stopTracking();
                }
                startTracking(newActiveFile);
            }
            if(currentBranch==null){
                trackGitBranch();
            }
        }
    });

    // context.subscriptions.push(vscode.commands.registerCommand('extension.stopTracking', stopTracking));


    let disposable = vscode.commands.registerCommand('extension.stopTracking', () => deactivate());

    context.subscriptions.push(disposable);
}

async function trackGitBranch() {
    
    const branch = await git.branchLocal();
    currentBranch = branch.current;
    log(`Current Git branch: ${currentBranch}`);
    startBranchTracking(currentBranch);
    intervalId = setInterval(intervalFunction , 10000); // Check every 10 seconds
}

async function intervalFunction(){
    const newBranch = await git.branchLocal();
    if (newBranch.current !== currentBranch) {
        log(`Switched to branch ${newBranch.current}`);
        stopBranchTracking(currentBranch);
        currentBranch = newBranch.current;
        startBranchTracking(currentBranch);
        // logGitBranches(currentBranch);
    }

}

function startBranchTracking(branch: string) {

	logGitBranches(`Started tracking time for ${branch}`);

    if(branches[branch]==null){
        branches[branch] = { startTime: Date.now(), elapsedTime: 0 };
    }else{
        branches[branch].startTime = Date.now();
    }
}

function stopBranchTracking(branch: string | null) {
	if(branch == null){
		branch = currentBranch??"null";
	}
    if (branches[branch] && branches[branch].startTime) {

        const elapsedTime = Date.now() - branches[branch].startTime;
        branches[branch].elapsedTime += Date.now() - branches[branch].startTime;
        branches[branch].startTime = 0; // Reset startTime to indicate not tracking
        // const endTime = Date.now();
		// const elapsedTime = endTime - (branches[branch].startTime ?? endTime);
		log(`Stopped tracking time for ${branch}. Elapsed time: ${msToTime( elapsedTime)}`);
		logGitBranches(`tracking time for ${branch}. Elapsed time: ${msToTime( elapsedTime)}`);

    }
    currentBranch = null;
}

function startTracking(file: string) {
    activeFile = file;
    startTime = Date.now();
    log(`Started tracking time for ${activeFile}`);
}

function stopTracking() {
    if (activeFile) {
        const endTime = Date.now();
        const elapsedTime = endTime - (startTime ?? endTime);
        log(`Stopped tracking time for ${activeFile}. Elapsed time: ${msToTime(elapsedTime)}`);
        if (files[activeFile]) {
            files[activeFile] += elapsedTime;
        } else {
            files[activeFile] = elapsedTime;
        }
        activeFile = null;
        startTime = null;
    }
}


function msToTime(duration: number): string {
    const seconds = Math.floor((duration / 1000) % 60);
    const minutes = Math.floor((duration / (1000 * 60)) % 60);
    const hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

    const hoursStr = (hours < 10) ? "0" + hours : hours.toString();
    const minutesStr = (minutes < 10) ? "0" + minutes : minutes.toString();
    const secondsStr = (seconds < 10) ? "0" + seconds : seconds.toString();

    return hoursStr + ":" + minutesStr + ":" + secondsStr;
}

function logGitBranches(msg: string) {
    fs.appendFileSync(gitBranchesFilePath, `[${getTime()}] ${msg}\n`);
}

function log(message: string) {
    fs.appendFileSync(logFilePath, `[${getTime()}] ${message}\n`);
    
}

function getTime(){
    return new Date().toLocaleString();
}

export function deactivate() {
    stopTracking();
	stopBranchTracking(null);
    writeSummary();
    finalize();
    
}

function finalize(){

    files = {};
    finalizeBranchTracking();

}

function finalizeBranchTracking(){

    branches = {};
    clearInterval(intervalId);

}

function writeSummary() {
    const sortedFiles = Object.entries(files).sort((a, b) => b[1] - a[1]);
    const sortedBranches = Object.entries(branches).sort((a, b) => b[1].elapsedTime - a[1].elapsedTime);
    let totalTime =0;
    sortedBranches.forEach(([branch,data]) => {totalTime+=data.elapsedTime})
	fs.appendFileSync(summaryFilePath, `[${getTime()}] Time summary:\n`);
	fs.appendFileSync(summaryFilePath, `Total Time: ${msToTime(totalTime)}\n`);

    fs.appendFileSync(summaryFilePath, `Branches:\n`);
    sortedBranches.forEach(([branch, data]) => {
        fs.appendFileSync(summaryFilePath, `${branch}: ${msToTime(data.elapsedTime)}\n`);
    });


    fs.appendFileSync(summaryFilePath, `Files:\n`);
    sortedFiles.forEach(([file, time]) => {
        fs.appendFileSync(summaryFilePath, `${file}: ${msToTime(time)}\n`);
    });

	fs.appendFileSync(summaryFilePath, `\n`);

    log(`Summary written to ${summaryFilePath}`);
    logGitBranches(`Summary written to ${summaryFilePath}`);
    
}
