import datetime
  

FILE_TIME_THRESHOLD= "0:05:00"
BRANCH_TIME_THRESHOLD= "0:05:00"

LOGGER_FILE_NAME = "time-tracker/time-summary.log"
WEEKLY_OUTPUT_LOG_FILE = "time-tracker/weekly-summary.log"




# Define the start and end dates for the previous week (from Sunday to Saturday)  
today = datetime.date.today()  
# week = datetime.date.
last_sunday = today - datetime.timedelta(days=today.weekday()+1)
next_sunday = today - datetime.timedelta(days=today.weekday()+1,weeks=-1)

start_date = last_sunday
end_date = next_sunday

# adjust for correct day of week ,i.e from now get the past sunday and the future sunday


# Initialize variables to store the total time  
# total_time = datetime.timedelta()  
total_time = "00:00:00"  

# WEEKLY_THIS_WEEK_OUTPUT_LOG_FILE = str(last_sunday) + str(next_sunday)
WEEKLY_THIS_WEEK_OUTPUT_LOG_FILE_DIR = "time-tracker/archive/"
WEEKLY_THIS_WEEK_OUTPUT_LOG_FILE =  f"{WEEKLY_THIS_WEEK_OUTPUT_LOG_FILE_DIR}{start_date.strftime('%m-%d-%Y')}-To-{end_date.strftime('%m-%d-%Y')}.log" 


def addTime(timeStr,timeStr2): 
    total_seconds1 = int(timeStr.split(':')[0]) * 3600 + int(timeStr.split(':')[1]) * 60 + int(timeStr.split(':')[2])
    total_seconds2 = int(timeStr2.split(':')[0]) * 3600 + int(timeStr2.split(':')[1]) * 60 + int(timeStr2.split(':')[2])

    total_seconds = total_seconds1 + total_seconds2
    return str(datetime.timedelta(seconds=total_seconds))



branches = {}
files = {}
# Read the log file  
with open(LOGGER_FILE_NAME, "r") as file:  
    lines = file.readlines()  
  
# Process each line in the log file  

filesFlag = False
branchFlag = False
inRange = False
isTotalTime = False

for line in lines:  
    line = line.replace("\n","")

    if len(line.strip()) == 0: 
        filesFlag = False
        branchFlag = False
        inRange = False
        isTotalTime = False
        continue
    if "Branches" in line:
        branchFlag = True

        filesFlag = False
        isTotalTime = False

        continue
    
    elif "Files" in line:
        filesFlag = True

        branchFlag = False
        isTotalTime = False

        continue
    elif "Total Time:" in line:
        isTotalTime = True


    elif "Time summary:" in line:  
        # Extract the date from the line  
        date_str = line.split(" ")[0].strip("[]").split(",")[0]
        filesFlag = False
        branchFlag = False
        inRange = False
  
        # Convert the date string to a datetime object  
        log_date = datetime.datetime.strptime(date_str, "%m/%d/%Y").date()  
     
  
        # Check if the log date falls within the previous week  
        if start_date <= log_date <= end_date:  
            # Extract the time duration from the line  
            inRange = True
        else:
            inRange = False
        continue

    if inRange and (filesFlag or branchFlag or isTotalTime):
        trackableName,trackableTime = line.split(': ')
        trackableTime= trackableTime.replace(": ", "").strip()
        if(filesFlag):
            files[trackableName] = addTime(files.get(trackableName, "00:00:00"),  trackableTime)
        elif(branchFlag):
            branches[trackableName] = addTime(branches.get(trackableName, "00:00:00"),  trackableTime)
        elif(isTotalTime):
            total_time = addTime(total_time, trackableTime)

        
def time_to_seconds(time_str):
    # Split the string into hours, minutes, and seconds
    hours, minutes, seconds = map(int, time_str.split(':'))
    # Calculate total seconds
    total_seconds = hours * 3600 + minutes * 60 + seconds
    return total_seconds    
# print(files)

# print(branches)
  
# Log the total time in the same format  
log_summary = f"\n[{start_date.strftime('%m/%d/%Y')} - {end_date.strftime('%m/%d/%Y')}]\n"  
log_summary += f"Total Time: {str(total_time)}\n"  

log_summary += f"branches: \n" 
# sorted(my_dict.items(), key=lambda x: x[1]) 
# for branch in branches:

sortedBranches = dict(sorted(branches.items(), key=lambda x: -time_to_seconds(x[1])))

for branch, branchTime in sortedBranches.items():
    if(time_to_seconds(branchTime)<time_to_seconds(BRANCH_TIME_THRESHOLD)):
        break
    log_summary += f"{branch}: {branchTime}\n"


log_summary += f"files: \n"  
sortedFiles = dict(sorted(files.items(), key=lambda x: -time_to_seconds(x[1])))
for file,fileTime in sortedFiles.items():
    if(time_to_seconds(fileTime)<time_to_seconds(FILE_TIME_THRESHOLD)):
        break
    log_summary += f"{file}: {fileTime}\n"
  
# Append the log summary to the log file  
with open(WEEKLY_OUTPUT_LOG_FILE, "a") as file:  
    file.write(log_summary)  

with open(WEEKLY_THIS_WEEK_OUTPUT_LOG_FILE, "a") as file:  
    file.write(log_summary)  
