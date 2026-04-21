const trackedInputs = new WeakSet<HTMLInputElement>();
const savedPasswords = new WeakMap<HTMLInputElement, string>();

interface PendingCapture {
  url: string;
  username: string;
  password: string;
}

let pendingCaptures: PendingCapture | null = null;
// const [watchActivate, setWatchActivate] = useState<boolean>(false);
let watchActivate = false;

function extractCredentials(passwordInput: HTMLInputElement) {
  const container = passwordInput.closest("form") || document.body;

  const password = passwordInput.value;
  if (password.length === 0) return null;

  let username = "";

  const textInputs = Array.from(
    container.querySelectorAll(
      'input:not([type="password"]):not([type="hidden"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"])',
    ),
  ) as HTMLInputElement[];

  for (const input of textInputs) {
    const name = (input.name || "").toLowerCase();
    const id = (input.id || "").toLowerCase();
    const autocomplete = (input.autocomplete || "").toLowerCase();
    const placeholder = (input.placeholder || "").toLowerCase();

    if (autocomplete === "username" || autocomplete === "email") {
      username = input.value;
      break;
    }

    if (input.type === "email") {
      username = input.value;
      break;
    }

    const keywords = ["user", "email", "login", "mail"];
    const matchesKeyword = keywords.some(
      (kw) => name.includes(kw) || id.includes(kw) || placeholder.includes(kw), // ← placeholder check
    );

    if (matchesKeyword) {
      username = input.value;
      break;
    }
  }
  if (!username && passwordInput) {
    const allElements = Array.from(container.querySelectorAll("input"));
    const passIndex = allElements.indexOf(passwordInput);

    for (let i = passIndex - 1; i >= 0; i--) {
      const prev = allElements[i] as HTMLInputElement;
      if (
        prev.tagName === "INPUT" &&
        (prev.type === "text" || prev.type === "email") &&
        prev.value
      ) {
        username = prev.value;
        break;
      }
    }
  }
  console.log("saving on pending capture");
  pendingCaptures = {
    url: window.location.origin,
    username: username,
    password: password,
  };
}

async function captureAndSave(passwordInput: HTMLInputElement) {
  if (!passwordInput) return;

  if (savedPasswords.get(passwordInput) === passwordInput.value) {
    console.log("🔒 Local Vault: No changes detected.");
    return;
  }

  savedPasswords.set(passwordInput, passwordInput.value);

  extractCredentials(passwordInput);

  console.log(
    "🔒 Local Vault: Capturing SPA credentials for!!!",
    pendingCaptures?.url,
  );
  watchForSuccessfullLogin();
}

function setupPasswordInputs(passwordInput: HTMLInputElement) {
  if (trackedInputs.has(passwordInput)) return;
  trackedInputs.add(passwordInput);

  passwordInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      captureAndSave(passwordInput);
    }
  });

  passwordInput.addEventListener("blur", () => {
    captureAndSave(passwordInput);
  });

  const form = passwordInput.closest("form");

  if (form) {
    form.addEventListener("submit", () => {
      captureAndSave(passwordInput);
    });
  }
}

function watchForSuccessfullLogin() {
  if (!pendingCaptures || watchActivate) return;
  watchActivate = true;

  window.addEventListener(
    "beforeunload",
    () => {
      if (pendingCaptures) {
        triggerSavePrompt(pendingCaptures);
        pendingCaptures = null;
        watchActivate = false;
      }
    },
    { once: true },
  );

  const originUrl = window.location.href;
  const urlWatcher = setInterval(() => {
    if (window.location.href !== originUrl) {
      clearInterval(urlWatcher);
      if (pendingCaptures) {
        triggerSavePrompt(pendingCaptures);
        pendingCaptures = null;
        watchActivate = false;
      }
    }
  }, 500);

  const domWatcher = new MutationObserver(() => {
    const passwordFields = document.querySelectorAll('input[type="password"]');
    if (passwordFields.length === 0 && pendingCaptures) {
      domWatcher.disconnect();
      clearInterval(urlWatcher);
      triggerSavePrompt(pendingCaptures);
      pendingCaptures = null;
    }
  });
  domWatcher.observe(document.body, { childList: true, subtree: true });

  setTimeout(() => {
    if (pendingCaptures) {
      console.log("Login appears to have failed — not saving");
      domWatcher.disconnect();
      clearInterval(urlWatcher);
      watchActivate = false;
    }
  }, 5000);
}

async function checkAndAutoFill(passwordInput: HTMLInputElement) {
  const targetUrl = window.location.origin;
  try {
    const data = await chrome.runtime.sendMessage({
      action: "get_credenial",
      payload: { url: targetUrl },
    });
    if (data.data) {
      console.log("Password Vault: Found saved credentials for this site....");
      const accounts = data.data;
      if (accounts.length === 1) {
        fillCredentials(passwordInput, accounts[0]);
      } else {
        showAccountSelector(passwordInput, accounts);
      }
    } else
      console.log(
        data.message ||
          "Password Vault: No saved credentials found for this site.",
      );
  } catch (error) {
    console.error("Local Vault Error: Could not connect to backend.", error);
  }
}

function promptToSave(credentials: PendingCapture) {
  if (document.getElementById("native-vault-save-prompt")) return;

  const popup = document.createElement("div");
  popup.id = "native-vault-save-prompt";
  popup.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: #1e1e24; 
    border: 1px solid #3f3f46;
    border-radius: 12px;
    box-shadow: 0 8px 30px rgba(0,0,0,0.5);
    z-index: 2147483647;
    padding: 16px;
    font-family: sans-serif;
    width: 320px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    color: #f8f9fa;
  `;
  const hasUsername = !!credentials.username;
  popup.innerHTML = `
    <div style="font-size: 16px; font-weight: bold; color: #10b981; border-bottom: 1px solid #3f3f46; padding-bottom: 8px;">
      🛡️ Save password?
    </div>
    <div style="font-size: 13px; color: #9ca3af;">
      ${
        hasUsername
          ? `Do you want Password Vault to save the password for <b>${credentials.username}</b>?`
          : `We couldn't detect a username. Please enter one below to save:`
      }
    </div>
  `;

  let usernameInput: HTMLInputElement | null = null;
  if (!hasUsername) {
    usernameInput = document.createElement("input");
    usernameInput.type = "text";
    usernameInput.placeholder = "Enter username / email...";
    usernameInput.style.cssText = `
      padding: 8px; 
      background-color: #2b2b36;
      border: 1px solid #3f3f46;
      border-radius: 4px; 
      font-size: 13px; 
      width: 100%; 
      box-sizing: border-box;
      outline: none;
    `;
    usernameInput.onfocus = () =>
      (usernameInput!.style.borderColor = "#10b981");
    usernameInput.onblur = () => (usernameInput!.style.borderColor = "#10b981");

    popup.appendChild(usernameInput);
  }

  const btnContainer = document.createElement("div");
  btnContainer.style.cssText = "display: flex; gap: 10px; margin-top: 5px;";

  const nopeBtn = document.createElement("button");
  nopeBtn.innerText = "Never";
  nopeBtn.style.cssText =
    "flex: 1; padding: 8px; background-color: #3f3f46;; border: none; border-radius: 4px; cursor: pointer; color: #f8f9fa; font-weight: bold;transition: background 0.2s";
  nopeBtn.onclick = () => {
    chrome.storage.local.remove("vaultPendingSave");
    popup.remove();
  };

  const saveBtn = document.createElement("button");
  saveBtn.innerText = "Save";
  saveBtn.style.cssText =
    "flex: 1; padding: 8px;background-color: #10b981; color: #1e1e24; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; transition: opacity 0.2s;";
  saveBtn.onmouseover = () => (saveBtn.style.opacity = "0.8");
  saveBtn.onmouseout = () => (saveBtn.style.opacity = "1");
  saveBtn.onclick = () => {
    if (usernameInput) {
      credentials.username = usernameInput.value;
    }

    chrome.runtime.sendMessage({
      action: "save_credential",
      payload: credentials,
    });
    chrome.storage.local.remove("vaultPendingSave");
    popup.remove();
  };

  btnContainer.appendChild(nopeBtn);
  btnContainer.appendChild(saveBtn);
  popup.appendChild(btnContainer);
  document.body.appendChild(popup);
}

chrome.storage.local.get(
  ["vaultPendingSave"],
  (data: { [key: string]: any }) => {
    if (data.vaultPendingSave) {
      promptToSave(data.vaultPendingSave as PendingCapture);
    }
  },
);

function triggerSavePrompt(captures: PendingCapture) {
  chrome.storage.local.set({ vaultPendingSave: captures });
  promptToSave(captures);
}

function fillCredentials(passwordInput: HTMLInputElement, account: any) {
  savedPasswords.set(passwordInput, account.password);
  injectReactText(passwordInput, account.password);

  if (account.username) {
    const form = passwordInput.closest("form") || document;
    const allInputs = Array.from(form.querySelectorAll("input"));

    for (const input of allInputs) {
      if (input.type === "text" || input.type === "email") {
        injectReactText(input, account.username);
        break;
      }
    }
  }
}

function showAccountSelector(passwordInput: HTMLInputElement, accounts: any[]) {
  const existingPopup = document.getElementById("native-vault-popup");
  if (existingPopup) {
    existingPopup.remove();
  }

  const rect = passwordInput.getBoundingClientRect();
  const top = rect.top + window.scrollY + 5;
  const left = rect.left + window.scrollX;

  const popup = document.createElement("div");
  popup.id = "native-vault-popup";
  popup.style.cssText = `
    position: absolute;
    top: ${top}px;
    left: ${left}px;
    background-color: #1e1e24;
  border: 1px solid #3f3f46;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 2147483647; /* Maximum z-index to stay on top of everything */
    min-width: 200px;
    font-family: sans-serif;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  `;

  const header = document.createElement("div");
  header.innerText = "🛡️ Select Account";
  header.style.cssText =
    "font-size: 14px; color: #10b981; padding-bottom: 5px; border-bottom: 1px solid #3f3f46; margin-bottom: 5px; text-align: center;background-color: #1e1e24;";
  popup.appendChild(header);

  accounts.forEach((account) => {
    const btn = document.createElement("button");
    btn.innerHTML = `
    <div style="color: #f8f9fa; font-weight: bold; font-size: 14px; margin-bottom: 4px;">
      ${account.username || "No Username"}
    </div>
    <div style="color: #9ca3af; font-size: 12px;">
      ••••••••••••
    </div>
  `;
    btn.style.cssText = `
      padding: 8px;
      border: none;
      background: transparent;
      border-radius: 4px;
      cursor: pointer;
      text-align: left;
      font-size: 14px;
      color: #333;
      transition: background 0.2s;
    `;
    btn.onmouseover = () => (btn.style.background = "#2b2b36");
    btn.onmouseout = () => (btn.style.background = "transparent");

    btn.onclick = (e) => {
      e.preventDefault();
      fillCredentials(passwordInput, account);
      popup.remove();
    };
    popup.appendChild(btn);
  });
  const closePopup = (e: MouseEvent) => {
    if (!popup.contains(e.target as Node) && e.target !== passwordInput) {
      popup.remove();
      document.removeEventListener("click", closePopup);
    }
  };

  document.addEventListener("click", closePopup);

  document.body.appendChild(popup);
}

function injectReactText(input: HTMLInputElement, text: string) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;
  nativeInputValueSetter?.call(input, text);

  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function scanForInputs() {
  document.querySelectorAll("input[type='password']").forEach((input) => {
    const passwordInput = input as HTMLInputElement;
    if (!trackedInputs.has(passwordInput)) {
      setupPasswordInputs(passwordInput);
      checkAndAutoFill(passwordInput);
    }
  });
}
scanForInputs();

const observer = new MutationObserver(scanForInputs);
observer.observe(document.body, { childList: true, subtree: true });
