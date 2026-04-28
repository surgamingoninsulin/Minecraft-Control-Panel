Option Explicit

Const ForWriting = 2
Const ForAppending = 8

Dim shell, fso, scriptDir, logDir, latestLogPath
Dim backendDir, frontendDir, backendCmd, frontendCmd, siteUrl
Dim backendOutputLogPath, frontendOutputLogPath, installLogPath
Dim backendRunning, frontendRunning

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = scriptDir

logDir = scriptDir & "\logs"
latestLogPath = logDir & "\latest.log"
backendOutputLogPath = logDir & "\backend.log"
frontendOutputLogPath = logDir & "\frontend.log"
installLogPath = logDir & "\install.log"

InitLogs
LogMessage "=== start.vbs run started ==="
LogMessage "Script: " & WScript.ScriptFullName
LogMessage "Host: " & WScript.FullName

' If launched via cscript (console host), relaunch with wscript to stay hidden.
If InStr(1, LCase(WScript.FullName), "cscript.exe", vbTextCompare) > 0 Then
  LogMessage "Detected cscript host. Relaunching with wscript hidden."
  shell.Run "wscript.exe """ & WScript.ScriptFullName & """", 0, False
  WScript.Quit
End If

backendDir = scriptDir & "\backend"
frontendDir = scriptDir & "\frontend"
LogMessage "Backend dir: " & backendDir
LogMessage "Frontend dir: " & frontendDir

EnsureNodeModules backendDir
EnsureNodeModules frontendDir

backendCmd = "cmd /c cd /d """ & backendDir & """ && npm start >> """ & backendOutputLogPath & """ 2>&1"
frontendCmd = "cmd /c cd /d """ & frontendDir & """ && npm run dev >> """ & frontendOutputLogPath & """ 2>&1"
siteUrl = "http://localhost:5173"
backendRunning = IsPortListening(3000)
frontendRunning = IsPortListening(5173)
LogMessage "Port 3000 listening: " & CStr(backendRunning)
LogMessage "Port 5173 listening: " & CStr(frontendRunning)

' 0 = hidden window, False = don't wait for completion.
If Not backendRunning Then
  LaunchHiddenNoWait backendCmd, "Start backend (npm start)"
Else
  LogMessage "Backend already running. Skipping launch."
End If

If Not frontendRunning Then
  LaunchHiddenNoWait frontendCmd, "Start frontend (npm run dev)"
Else
  LogMessage "Frontend already running. Skipping launch."
End If

' Open the site after a short startup delay.
LogMessage "Waiting 6000ms before opening browser."
WScript.Sleep 6000
shell.Run siteUrl, 1, False
LogMessage "Requested browser open: " & siteUrl

backendRunning = IsPortListening(3000)
frontendRunning = IsPortListening(5173)
LogMessage "Post-launch port 3000 listening: " & CStr(backendRunning)
LogMessage "Post-launch port 5173 listening: " & CStr(frontendRunning)
LogMessage "Logs: " & latestLogPath
LogMessage "Backend output log: " & backendOutputLogPath
LogMessage "Frontend output log: " & frontendOutputLogPath
LogMessage "Install output log: " & installLogPath
LogMessage "=== start.vbs run finished ==="

Function IsPortListening(port)
  Dim checkCmd, exitCode
  checkCmd = "cmd /c netstat -ano | findstr /R /C:"":" & port & " .*LISTENING"" >nul"
  exitCode = shell.Run(checkCmd, 0, True)
  IsPortListening = (exitCode = 0)
End Function

Sub EnsureNodeModules(projectDir)
  Dim packageJsonPath, nodeModulesPath, installCmd, installExitCode
  packageJsonPath = projectDir & "\package.json"
  nodeModulesPath = projectDir & "\node_modules"

  If Not fso.FileExists(packageJsonPath) Then
    LogMessage "No package.json found in " & projectDir & ". Skipping npm install check."
    Exit Sub
  End If

  If fso.FileExists(packageJsonPath) And (Not fso.FolderExists(nodeModulesPath)) Then
    LogMessage "node_modules missing in " & projectDir & ". Running npm install."
    installCmd = "cmd /c cd /d """ & projectDir & """ && npm install >> """ & installLogPath & """ 2>&1"
    installExitCode = shell.Run(installCmd, 0, True)
    LogMessage "npm install exit code for " & projectDir & ": " & CStr(installExitCode)
  Else
    LogMessage "node_modules already present in " & projectDir & "."
  End If
End Sub

Sub InitLogs()
  If Not fso.FolderExists(logDir) Then
    fso.CreateFolder logDir
  End If

  ResetLogFile latestLogPath
  ResetLogFile backendOutputLogPath
  ResetLogFile frontendOutputLogPath
  ResetLogFile installLogPath
End Sub

Sub ResetLogFile(filePath)
  Dim stream
  Set stream = fso.OpenTextFile(filePath, ForWriting, True)
  stream.Write ""
  stream.Close
End Sub

Sub LogMessage(msg)
  Dim stream, stamp
  stamp = Now()
  Set stream = fso.OpenTextFile(latestLogPath, ForAppending, True)
  stream.WriteLine CStr(stamp) & " | " & msg
  stream.Close
End Sub

Sub LaunchHiddenNoWait(cmd, label)
  LogMessage "Launching: " & label
  LogMessage "Command: " & cmd
  shell.Run cmd, 0, False
  LogMessage "Launch requested for: " & label
End Sub
