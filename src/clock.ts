import * as vscode from 'vscode';

export class Clock {
    // private _statusBarItem: vscode.StatusBarItem;
    private _interval: NodeJS.Timeout;

    private _counter = 0; 

    private _startTime:number|null = null;
    public _isPaused: boolean|null = null;

    private clockStatusBarItem: vscode.StatusBarItem | null = null;

    private elapsedTime: number =0;
    private beforePausedTime:number = 0;

    constructor(context: vscode.ExtensionContext) {
        // this._statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, -100);
        // // this._statusBarItem.command = 'clock.insertDateTime';
        // // this._statusBarItem.tooltip = 'Click to insert into selection';
        // this._statusBarItem.show();

        this._isPaused = false;
        this._interval = setInterval(() => this.refreshUI(), 1000);//TODO there is a drift here, use time stamp and use this only for refresh not counting 

        

        this.clockStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, -100);
        // this.clockStatusBarItem.command()
      
        this.clockStatusBarItem.command= "extension.pauseTracking";
        
        

        this.refreshUI();
    }

    dispose() {
        this.stop();
        this.clockStatusBarItem?.dispose();
        clearInterval(this._interval);
    }

    refreshUI() {
        // this._statusBarItem.text = clockService();
        if(this.clockStatusBarItem==null){
            this.clockStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, -100);
        }
        if(!this._isPaused){
            
            this.updateElapsedTime();
        }
        // this._counter++;
        const icon = this._isPaused?"$(debug-start)":"$(debug-pause)";
        this.clockStatusBarItem.text = icon+this.msToTime(this.elapsedTime);
        this.clockStatusBarItem.show();

        
    }

    updateElapsedTime(){
        this.elapsedTime = this.beforePausedTime + (Date.now() - ((this._startTime)??Date.now()));
    }


    stop(){
        this.beforePausedTime = 0;
        this.elapsedTime = 0
        this.pause(true);
        if (this.clockStatusBarItem) {
            this.clockStatusBarItem.text = "$(debug-start)" + this.msToTime(0);
        }
        this.clockStatusBarItem?.show();
        this.elapsedTime = 0;

    }

    pause(isPaused: boolean){
        if(isPaused===this._isPaused){
            return;
        }

        this._isPaused = isPaused;
        this.refreshUI();
        this.refreshCmd();
        if(isPaused){
            this.beforePausedTime = this.elapsedTime;
            
        }
        if(!isPaused){//resumed
            
            this._startTime = Date.now();
        }
    }

    refreshCmd(){
        if(this.clockStatusBarItem==null)
            return;
        if(!this._isPaused){
            this.clockStatusBarItem.command ="extension.pauseTracking";
        }else if(this._isPaused){
            this.clockStatusBarItem.command ="extension.resumeTracking";
        }
    }


    activate() {
        // Create a status bar item
        // clockStatusBarItem.command = 'extension.showClock';
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
    

    static showClockUI(statusBarItem: vscode.StatusBarItem) {
        const clockTime = new Date().toLocaleTimeString();
        const clockText = `$(clock) ${clockTime}`;
        const pauseButton = '$(debug-pause)';
        const stopButton = '$(debug-stop)';

        statusBarItem.text = `${clockText} ${pauseButton} ${stopButton}`;
    }
}


