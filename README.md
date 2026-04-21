# 🛡️ PASSWORD VAULT

**A fully offline, natively-encrypted Chrome password manager.**

Native Vault is a custom-built Chrome Extension that entirely bypasses cloud storage. Instead of syncing your sensitive data to third-party servers, it uses **Chrome Native Messaging** to securely communicate with a local Python backend. Your credentials are encrypted using military-grade AES-GCM and stored locally in a SQLite database directly on your Windows hard drive.



## ✨ Features
* **Zero Cloud Tracking:** Your vault never touches the internet. All data lives locally.
* **OS-Level Encryption:** Passwords are encrypted/decrypted via a local Python engine before hitting the database.
* **Smart Auto-Fill:** Automatically detects login pages and injects credentials.
* **Seamless Capture:** Intercepts successful logins and bridges page-reloads to offer a smooth "Save Password?" prompt.
* **Emerald Vault UI:** A sleek, custom-built dark mode interface built with React.

## 🛠️ Tech Stack
* **Frontend:** React, TypeScript, Vite, Chrome Extension API (Manifest V3)
* **Backend:** Python, SQLite3, Cryptography (AES-GCM)
* **Bridge:** Chrome Native Messaging Protocol (Standard I/O)

---

## 🚀 How to Install (For Users)

Since Native Vault communicates directly with your operating system, installation requires linking the Chrome extension to the local database engine. 

1. **Download the Release:** Go to the [Releases](../../releases) tab on the right and download the latest `NativeVault-v1.x.zip` file.
2. **Extract the Folder:** Unzip the folder and place it somewhere safe on your computer (like `Documents` or `Program Files`). *Do not move the folder after step 5!*
3. **Load the Extension:**
   * Open Chrome and navigate to `chrome://extensions/`.
   * Enable **Developer mode** in the top right corner.
   * Click **Load unpacked** and select the `extension` folder from inside your extracted folder.
4. **Link the IDs:**
   * Chrome will generate an "ID" for your new extension (e.g., `abcdefghijklmnop...`). Copy this ID.
   * Open the `manifest.json` file in your main extracted folder using any text editor.
   * Replace `<YOUR_EXTENSION_ID>` with your copied ID and save the file.
5. **Run the Installer:** * Double-click the `install.bat` file. This securely registers the Native Messaging Host in your Windows Registry so Chrome knows where to find the database.

You are done! Click the Native Vault icon in your Chrome toolbar to get started.

---

## 💻 Developer Setup (Build from Source)

If you want to clone this repository and build the code yourself:

**1. Build the Frontend:**
```bash
# In the extension directory
npm install
npm run build
# This generates the /dist folder to load into Chrome
