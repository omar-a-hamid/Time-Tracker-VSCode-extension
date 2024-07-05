import * as vscode from 'vscode';


const STOP_ICON   = "$(debug-stop)";
const PAUSE_ICON  = "$(debug-pause)";
const START_ICON  = "$(debug-start)";
const RESUME_ICON = "$(debug-continue)";//


const START_TOOL_TIP  = "start timer";
const PAUSE_TOOL_TIP  = "pause timer";
const RESUME_TOOL_TIP = "resume timer";
const STOP_TOOL_TIP   = "stop timer";


let _instance: null|Clock = null;

export enum ClockState {
    RUNNING,
    PAUSED,
    STOPPED
}
 
export class Clock {
    // private _statusBarItem: vscode.StatusBarItem;


    private _interval: NodeJS.Timeout|null = null;

    private _counter = 0; 

    private _startTime:number|null = null;
    public _isPaused: boolean|null = null;

    private clockStatusBarItem: vscode.StatusBarItem | null = null;

    private clockPauseBarItem: vscode.StatusBarItem | null = null;
    private clockStartBarItem: vscode.StatusBarItem | null = null;
    private clockStopBarItem: vscode.StatusBarItem | null = null;
    private clockResumeBarItem: vscode.StatusBarItem | null = null;



    private elapsedTime: number =0;
    private beforePausedTime:number = 0;

    private clockState: ClockState = ClockState.STOPPED;
    private prevState: ClockState|null = null; 

    constructor() {
        if(_instance!=null){
            return _instance;
        }

        this.clockStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, -100);
        this.clockStatusBarItem.show();
        
        this.initButtons();
        this.refreshUI();

        
    }


    initButtons(){
        this.clockPauseBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, -99);
        this.clockPauseBarItem.command = "extension.pauseTracking";
        this.clockPauseBarItem.text = PAUSE_ICON;
        this.clockPauseBarItem.tooltip = PAUSE_TOOL_TIP;

        this.clockStartBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, -99);
        this.clockStartBarItem.command = "extension.startTracking";
        this.clockStartBarItem.text = START_ICON;
        this.clockStartBarItem.tooltip = START_TOOL_TIP;
        


        this.clockResumeBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, -99);
        this.clockResumeBarItem.command = "extension.resumeTracking";
        this.clockResumeBarItem.text = RESUME_ICON;
        this.clockResumeBarItem.tooltip = RESUME_TOOL_TIP;


        this.clockStopBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, -98);
        this.clockStopBarItem.command = "extension.stopTracking";
        this.clockStopBarItem.text = STOP_ICON;
        this.clockStopBarItem.tooltip = STOP_TOOL_TIP;

        this.refreshButtons();


    }

    dispose() {
        this.stop();
        this.clockStatusBarItem?.dispose();
        if(this._interval!=null)
            clearInterval(this._interval);
    }

    private refreshUI() {

        if(this.clockStatusBarItem==null){
            this.clockStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, -100);
        }
        if(this.clockState===ClockState.RUNNING){
            
            this.updateElapsedTime();
        }

        this.clockStatusBarItem.text = `${this.msToTime(this.elapsedTime)}`;
        
    }
    refreshButtons() {

        switch(this.clockState){

            case ClockState.RUNNING: 
                this.clockResumeBarItem?.hide();
                this.clockStartBarItem?.hide();
                this.clockPauseBarItem?.show();
                this.clockStopBarItem?.show();


                
                break;
            case ClockState.PAUSED: 
                this.clockPauseBarItem?.hide();
                this.clockStartBarItem?.hide();
                this.clockResumeBarItem?.show();
                this.clockStopBarItem?.show();
                
                break;

            case ClockState.STOPPED:
                this.clockPauseBarItem?.hide();
                this.clockResumeBarItem?.hide();
                this.clockStopBarItem?.hide();
                this.clockStartBarItem?.show();
                
                break;
        }

        
    }

    updateElapsedTime(){
        this.elapsedTime = this.beforePausedTime + (Date.now() - ((this._startTime)??Date.now()));
    }


    stop(){

        this.beforePausedTime = 0;
        this.elapsedTime = 0
        
    }

    setState(state: ClockState){

        
        if(this.prevState === state){
            return;
        }
        this.clockState = state;
        this.prevState = this.clockState; 



        switch(state){
            case ClockState.PAUSED:
                this.pause();
                break;
            case ClockState.RUNNING:
                this.resume();
                break;
            case ClockState.STOPPED:
                this.stop();
                break;
        }
        this.refreshUI();
        this.refreshButtons();

    }

    private pause(){
        this._startTime = null;
        this.beforePausedTime = this.elapsedTime;

    }

    private resume(){
        this._startTime = Date.now();
    }


    activate() {
        
        this.setState(ClockState.RUNNING);
        this._interval = setInterval(() => this.refreshUI(), 1000);//TODO there is a drift here, use time stamp and use this only for refresh not counting 
        this.refreshUI();
        if(this.clockStatusBarItem==null){
            this.clockStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, -100);
        }
        this._startTime = Date.now();
        this.clockStatusBarItem.show();

    }

    msToTime(duration: number): string {
        const seconds = Math.floor((duration / 1000) % 60);
        const minutes = Math.floor((duration / (1000 * 60)) % 60);
        const hours = Math.floor((duration / (1000 * 60 * 60)) % 24);
    
        const hoursStr = (hours < 10) ? "0" + hours : hours.toString();
        const minutesStr = (minutes < 10) ? "0" + minutes : minutes.toString();
        const secondsStr = (seconds < 10) ? "0" + seconds : seconds.toString();
    
        return hoursStr + ":" + minutesStr + ":" + secondsStr;
    }

    


    
}




