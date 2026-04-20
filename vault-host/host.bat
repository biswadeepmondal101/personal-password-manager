@echo off
echo Chrome successfully triggered the batch file! > "C:\Users\U\Coding\Django\NativeVault\vault-host\bat_log.txt"

"C:\Users\U\Coding\Django\NativeVault\vault-host\.venv\Scripts\python.exe" -u "C:\Users\U\Coding\Django\NativeVault\vault-host\engine.py" 2> "C:\Users\U\Coding\Django\NativeVault\vault-host\error_log.txt"