import * as vscode from 'vscode';


const STOP_ICON: string = "$(debug-stop)";
const PAUSE_ICON = "$(debug-pause)";
const START_ICON = "$(debug-start)";

const START_TOOL_TIP = "start timer";
const PAUSE_TOOL_TIP = "pause timer";
const RESUME_TOOL_TIP = "resume timer";


let _instance: null|Clock = null;

enum ClockState {
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

    // private clockPauseBarItem: vscode.StatusBarItem | null = null;
    // private clockStartBarItem: vscode.StatusBarItem | null = null;
    // private clockStopBarItem: vscode.StatusBarItem | null = null;


    private elapsedTime: number =0;
    private beforePausedTime:number = 0;

    private clockState: ClockState = ClockState.STOPPED;

    constructor() {
        if(_instance!=null){
            return _instance;
        }
        // this._statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, -100);
        // // this._statusBarItem.command = 'clock.insertDateTime';
        // // this._statusBarItem.tooltip = 'Click to insert into selection';
        // this._statusBarItem.show();

        // this._isPaused = true;

        

        this.clockStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, -100);
        // this.clockPauseBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, -99);
        // this.clockStartBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, -99);
        // this.clockStopBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, -98);

        // this.clockStatusBarItem.command()
      
        this.clockStatusBarItem.command= "extension.startTracking";
        
        

        this.refreshUI();
        this.refreshCmd();
    }

    dispose() {
        this.stop();
        this.clockStatusBarItem?.dispose();
        if(this._interval!=null)
            clearInterval(this._interval);
    }

    refreshUI() {
        // this._statusBarItem.text = clockService();
        if(this.clockStatusBarItem==null){
            this.clockStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, -100);
        }
        if(this._isPaused===false){
            
            this.updateElapsedTime();
        }
        // this._counter++;
        
        // const icon = this._isPaused?"$(debug-start)":"$(debug-pause)";
        const icon = this.getIcon();

        this.clockStatusBarItem.text = `${icon}  ${this.msToTime(this.elapsedTime)}`;
        this.clockStatusBarItem.tooltip = this.getToolTip();
        this.clockStatusBarItem.show();

        
    }
    getToolTip(): string {
        let toolTip = "";
        switch(this.clockState){
            case ClockState.RUNNING: 
                toolTip = PAUSE_TOOL_TIP;
                break;
            case ClockState.PAUSED: 
                toolTip = RESUME_TOOL_TIP;
                break;
            case ClockState.STOPPED:
                toolTip = START_TOOL_TIP;
                break;
        }
        return toolTip
    }

    updateElapsedTime(){
        this.elapsedTime = this.beforePausedTime + (Date.now() - ((this._startTime)??Date.now()));
    }


    stop(){
        this.beforePausedTime = 0;
        this.elapsedTime = 0
        this.pause(null);
        if (this.clockStatusBarItem) {
            this.clockStatusBarItem.text = "$(debug-start)" + this.msToTime(0);
        }
        this.clockStatusBarItem?.show();
        this.elapsedTime = 0;
        


    }

    setState(state: ClockState){

        this.clockState = state;
    }

    pause(isPaused: boolean|null){
        if(isPaused===this._isPaused){
            return;
        }

        this._isPaused = isPaused;
        this.refreshUI();
        this.refreshCmd();
        if(isPaused===true){
            this.setState(ClockState.PAUSED);
            this._startTime = null;
            this.beforePausedTime = this.elapsedTime;
            
            
        }
        if(isPaused===false){//resumed
            this.setState(ClockState.RUNNING);
            this._startTime = Date.now();
        }
        if(isPaused===null){
            this.setState(ClockState.STOPPED);
        }
    }

    refreshCmd(){
        if(this.clockStatusBarItem==null)
            return;

        
        switch(this.clockState){
            case ClockState.RUNNING: 
                this.clockStatusBarItem.command ="extension.pauseTracking";
                break;
            case ClockState.PAUSED: 
                this.clockStatusBarItem.command ="extension.resumeTracking";
                break;
            case ClockState.STOPPED:
                this.clockStatusBarItem.command ="extension.startTracking";
                break;
        }
        // return icon;
        // if(this._isPaused==false){
        //     this.clockStatusBarItem.command ="extension.pauseTracking";
        // }else if(this._isPaused==true){
        //     this.clockStatusBarItem.command ="extension.resumeTracking";
        // }else if(this._isPaused==null){
        //     this.clockStatusBarItem.command ="extension.startTracking";

        // }
    }


    activate() {
        // Create a status bar item
        // clockStatusBarItem.command = 'extension.showClock';
        
        this.pause(false);
        this._interval = setInterval(() => this.refreshUI(), 1000);//TODO there is a drift here, use time stamp and use this only for refresh not counting 
        this.refreshCmd();
        if(this.clockStatusBarItem==null){
            this.clockStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, -100);
        }
        this._startTime = Date.now();
        this.clockStatusBarItem.text = 'Clock';
        this.clockStatusBarItem.show();

        // Register the command to show the clock
        // const showClockCommand = vscode.commands.registerCommand('extension.showClock', () => {
        // clock.showClockUI(clockStatusBarItem);
        // });

        // context.subscriptions.push(clockStatusBarItem);
        // context.subscriptions.push(showClockCommand);
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

    getIcon(): string{

        let icon = "";
        switch(this.clockState){
            case ClockState.RUNNING: 
                icon = PAUSE_ICON;
                break;
            case ClockState.PAUSED: 
                icon = START_ICON;
                break;
            case ClockState.STOPPED:
                icon = STOP_ICON;
                break;
        }
        return icon;

    }
    

    static showClockUI(statusBarItem: vscode.StatusBarItem) {
        const clockTime = new Date().toLocaleTimeString();
        const clockText = `$(clock) ${clockTime}`;
        const pauseButton = '$(debug-pause)';
        const stopButton = '$(debug-stop)';

        statusBarItem.text = `${clockText} ${pauseButton} ${stopButton}`;
    }

    
}




