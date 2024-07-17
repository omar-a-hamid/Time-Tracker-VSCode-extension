import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import simpleGit, { SimpleGit } from 'simple-git';
import { create } from 'domain';
import { Clock, ClockState } from './clock';


// command to build: vsce package
// command to install: code --install-extension time-analytics-0.0.1.vsix


const config =  vscode.workspace.getConfiguration('time-analytics');

const ENV_USE_RELATIVE_PATH:boolean = config.output.useRelativePath;

const folderPathArr = vscode.workspace.workspaceFolders;
const folderPath = folderPathArr?.[0]?.uri.fsPath.concat("\\");
const logDirName:string = config.output.directory+"/";
const logDir = path.join(ENV_USE_RELATIVE_PATH?folderPath??"":"",logDirName);
const logFilePath = path.join( logDir,config.output.filesLog);
const gitBranchesFilePath = path.join(logDir, config.output.branchesLog);
const summaryFilePath = path.join(logDir,config.output.summaryLog);
const git: SimpleGit = simpleGit(folderPath);

const SECOND = 1000;
const MINUTE = 60*SECOND;
const HOUR   =  60* MINUTE;

const PAUSE_TRACKING_TH = config.timeThreshold.pause*SECOND;
const STOP_TRACKING_TH  = config.timeThreshold.stop*SECOND;

const TICK_REFRESH_RATE = config.refreshRate;

const ENV_EXCLUDE_PATH:boolean = config.excludePatterns.currentPath;

let activeFile: string | null = null;
let startTime: number | null = null;
let currentBranch: string | null = null;
let files: { [key: string]: number } = {};
let branches: { [key: string]: { startTime: number, elapsedTime: number } } = {};
let gitIntervalId: string | number | NodeJS.Timeout | undefined;
let intervalId2: string | number | NodeJS.Timeout | undefined;
let killFlag: boolean = false;
let createDir: boolean| null = null;
let startLogging: boolean| null = null;

let intervalIdForResponse: string | number | NodeJS.Timeout | undefined;
let resumeResponse: boolean | null = null;

let changeEditorEvent:vscode.Disposable;

let promptResumeEvent:vscode.Disposable;

let hasResponded: boolean|null =null;
let clock: Clock|null = null;

let _context: vscode.ExtensionContext| null = null;

let clockState: ClockState = ClockState.STOPPED;
let prevState: ClockState|null = null; 



// const COMMON_PACKAGE_NAME:string = config.excludePatterns.files;
const ENV_EXCLUDE_FROM_FILE_NAME = config.excludePatterns.files;
const ENV_EXCLUDE_FROM_BRANCH_NAME = config.excludePatterns.branches;


// let elapsedTime: number =0;
let tickInterval: NodeJS.Timeout|null = null;

export let lastTimeStamp: number  =Date.now();


export async function activate(context: vscode.ExtensionContext) {

    let disposableStart = vscode.commands.registerCommand('extension.startTracking', () => startExtension());
    let disposable = vscode.commands.registerCommand('extension.pauseTracking', () => pause());
    let disposableStop = vscode.commands.registerCommand('extension.stopTracking', () => stop());
    let disposableResume = vscode.commands.registerCommand('extension.resumeTracking', () => resumeTracking());

    setState(ClockState.STOPPED);

    context.subscriptions.push(disposable);
    context.subscriptions.push(disposableStop);
    context.subscriptions.push(disposableResume);
    context.subscriptions.push(disposableStart);
    context.subscriptions.push(changeEditorEvent);




    clock = new Clock();

    const isValid = await validateFolder();
    if(!isValid)
        return;


    checkStartLogging();

}

async function validateFolder():Promise<boolean> {
    if(folderPath==null || logDir==null){
        showMsg(`this directory does not support logging check for ${logDirName} existence`);
        return false;
    }
    if(!folderExists(logDir)){

        await showCreateDirPrompt();
   
        if(createDir===true){
            createLogDir(logDir);
            
        }else{
            showMsg("end log");
            return false;
        }
        
    }
    return true;

}

async function checkStartLogging(){

    await promptStart();
    if(startLogging===true){
        startExtension();
    }else{
        showMsg("end log");

    }

} 

function resumeTracking(){
    setState(ClockState.RUNNING);
    editorChangeHandler();

}

function setState(state: ClockState):boolean{

    if(prevState === state){
        return false;
    }
    clockState = state;
    prevState = clockState; 

    clock?.setState(state);

    return true;
}

async function promptStart(){
    
    await vscode.window.showWarningMessage(
        'Start time tracking?',
        'Yes',
        'No'
    ).then(selectedAction => {
        startLogging = selectedAction === 'Yes';
    });
    
    
}


function wakeUpFromShortSleepHandler(){
    
    log(`woke up after short inactive period, wrapping up and pausing previous session`);
    pause();

}
function wakeUpFromLongSleepHandler(){
    
    log(`woke up after long inactive period: wrapping up and stopping previous session`);
    stop();

}

function updateTimestamp(overrideSleepCheck = false){

    const deltaTime = Date.now() - lastTimeStamp; 
    if(overrideSleepCheck != true){

        if(deltaTime > STOP_TRACKING_TH ){
            wakeUpFromLongSleepHandler();
        }else if(deltaTime > PAUSE_TRACKING_TH){
            wakeUpFromShortSleepHandler();
        }
    }
    lastTimeStamp = Date.now();

}

function tick(){

    updateTimestamp();

}

async function startExtension(){

    const isValid = await validateFolder();
    if(!isValid)
        return;

    if(clockState === ClockState.PAUSED){
        resumeTracking();
        return;
    }
   
    
    if(!setState(ClockState.RUNNING)){
        // if no change, do nth
        return;
    }
    
    updateTimestamp(true);
    tickInterval = setInterval(() => tick(), TICK_REFRESH_RATE);
    

    showMsg(`started logging session, saving to ${logDir}`);
	fs.appendFileSync(summaryFilePath, `\n[${getTime()}] started a new logging session:\n`);
	fs.appendFileSync(logFilePath, `\n[${getTime()}] started a new logging session:\n`);
	fs.appendFileSync(gitBranchesFilePath, `\n[${getTime()}] started a new logging session:\n`);

    if(clock==null){
        clock = new Clock();
    }
    clock?.activate();


    startTimeTracking();

}

function startTimeTracking(){

    let firstFile =  getCurrentFile()??"null";
    
    startTracking(firstFile);
    trackGitBranch();
    
    changeEditorEvent = vscode.window.onDidChangeActiveTextEditor(async editor => editorChangeHandler());



}
function removePatternFromBranchName(str: string|undefined):string|null{
    if(str === undefined)
        return null;
    return removeArrayFromString(str, ENV_EXCLUDE_FROM_BRANCH_NAME);
}

function removePatternFromFileName(str: string|undefined):string|null{
    if(str === undefined)
        return null;
    return removeArrayFromString(str, ENV_EXCLUDE_FROM_FILE_NAME);
}
function removeArrayFromString(str: string, array: string[]): string{

    const escapedArray = array.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = escapedArray.join('|');
    const regex = new RegExp(pattern, 'g');
    
    return str.replace(regex, '');

}

function getCurrentFile():string|null{

    let fileName =  vscode.window.activeTextEditor?.document.fileName;
    if(fileName===undefined)
        return null;
    if(ENV_EXCLUDE_PATH===true){
        fileName = fileName.replace(String(folderPath),"")
    }

    return removePatternFromFileName(fileName);
}


async function editorChangeHandler(){
    let editorFileName = getCurrentFile(); 
    if(editorFileName===null)
        return;
    if(clockState===ClockState.PAUSED){
        
        await promptResume();
        if(resumeResponse===false){
            deactivate();
            return;
        }else if(resumeResponse===null){
            return;
        }else{
            resumeTracking();
        }
        
    }
    const newActiveFile = editorFileName;
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

async function trackGitBranch() {
    
    const branch = await git.branchLocal();
    currentBranch = branch.current;
    log(`Current Git branch: ${currentBranch}`);
    startBranchTracking(currentBranch);
    gitIntervalId = setInterval(() => intervalFunction() , 10000); // Check every 10 seconds
}

function stopGitBranchTracking(){

}

async function intervalFunction(){
    const newBranch = await git.branchLocal();
    if (newBranch.current !== currentBranch) {
        let newBranchDisplayName = removePatternFromBranchName(newBranch.current)??"null";
        log(`Switched to branch ${newBranchDisplayName}`);
        stopBranchTracking(currentBranch);
        currentBranch = newBranchDisplayName;
        startBranchTracking(currentBranch);
    }

}

function startBranchTracking(branch: string) {

	logGitBranches(`Started tracking time for ${branch}`);

    if(branches[branch]==null){
        branches[branch] = { startTime: lastTimeStamp, elapsedTime: 0 };
    }else{
        branches[branch].startTime = lastTimeStamp;
    }
}

function stopBranchTracking(branch: string|null = currentBranch) {
	if(branch == null){
		branch = currentBranch??"null";
	}
    if (branches[branch] && branches[branch].startTime) {

        const elapsedTime = lastTimeStamp - branches[branch].startTime;
        branches[branch].elapsedTime += lastTimeStamp - branches[branch].startTime;
        branches[branch].startTime = 0; // Reset startTime to indicate not tracking

		log(`${branch} [${msToTime( elapsedTime)}]`);
		logGitBranches(`tracking time for ${branch}. Elapsed time: ${msToTime( elapsedTime)}`);

    }
    currentBranch = null;
}

function startTracking(file: string) {
    activeFile = file;
    startTime = lastTimeStamp;
}

function stopTracking(stopFromTS: number = lastTimeStamp) {
    if (activeFile) {
        const endTime = stopFromTS;
        const elapsedTime = endTime - (startTime ?? endTime);
        log(`${activeFile}  [${msToTime(elapsedTime)}]`);
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

function stop(){
    deactivate();
}

export function deactivate() {
    
    changeEditorEvent.dispose();
    if(clockState===ClockState.RUNNING){

        pause();
    }

    setState(ClockState.STOPPED);
    showMsg(`ended logging session, saving to ${logDir}`);


}

function pause(){

  
    if(!setState(ClockState.PAUSED)){
        return;
    }
    clearInterval(gitIntervalId);
    stopTracking();
	stopBranchTracking();
    writeSummary();
    finalize();
    showMsg(`paused logging session, saving to ${logDir}`);
}


function finalize(){

    files = {};
    finalizeBranchTracking();

}

function finalizeBranchTracking(){

    branches = {};
    // clearInterval(gitIntervalId);

}

function showMsg(msg: string){

    vscode.window.showInformationMessage(msg);

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

function folderExists(path: string): boolean {
    try {
        // Check if the path exists and is a directory
        return fs.statSync(path).isDirectory();
    } catch (error) {
        // Handle errors (e.g., folder does not exist)
        return false;
    }
}

async function showCreateDirPrompt(){

    await vscode.window.showWarningMessage(
        'Directory does not exist. Do you want to create it?',
        'Yes',
        'No'
    ).then(selectedAction => {
        createDir = selectedAction === 'Yes';
    });

    
}

async function promptResume(){

    hasResponded = false;
    await vscode.window.showWarningMessage(
        'resume tracking?',
        'Yes',
        'No',
    ).then(selectedAction => {
        if(selectedAction==="Yes"){
            resumeResponse = true;
        }else if(selectedAction ==="No"){
            resumeResponse= false;
        }else{
            resumeResponse = null;

        }
    });
    hasResponded=true;
}


function createLogDir(dir: string){

    fs.mkdir(dir, (err) => {
        if (err) {
            console.error('Error creating directory:', err);
        } else {
            console.log('Directory created successfully.');
        }
    });
}