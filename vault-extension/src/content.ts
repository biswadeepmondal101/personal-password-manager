// import { useState } from "react";

const trackedInputs = new WeakSet<HTMLInputElement>();
const savedPasswords = new WeakMap<HTMLInputElement, string>();
// const loadedPasswords = new WeakMap<HTMLInputElement, string>();

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
      console.log("found at autocomplete");
      username = input.value;
      break;
    }

    if (input.type === "email") {
      console.log("found at email");
      username = input.value;
      break;
    }

    const keywords = ["user", "email", "login", "mail"];
    const matchesKeyword = keywords.some(
      (kw) => name.includes(kw) || id.includes(kw) || placeholder.includes(kw), // ← placeholder check
    );

    if (matchesKeyword) {
      console.log("found at keyword");
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
        console.log("found at prev");
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
  console.log("pendingCaptures", pendingCaptures);
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
      console.log("beforeunload enter");
      if (pendingCaptures) {
        chrome.runtime.sendMessage({
          action: "save_credential",
          payload: pendingCaptures,
        });
        console.log("beforeunload");
        pendingCaptures = null;
        watchActivate = false;
      }
    },
    { once: true },
  );

  const originUrl = window.location.href;
  const urlWatcher = setInterval(() => {
    console.log("urlWatcher enter");
    if (window.location.href !== originUrl) {
      clearInterval(urlWatcher);
      if (pendingCaptures) {
        chrome.runtime.sendMessage({
          action: "save_credential",
          payload: pendingCaptures,
        });
        console.log("urlWatcher");
        pendingCaptures = null;
        watchActivate = false;
      }
    }
  }, 500);

  const domWatcher = new MutationObserver(() => {
    console.log("domWatcher enter");
    const passwordFields = document.querySelectorAll('input[type="password"]');
    if (passwordFields.length === 0 && pendingCaptures) {
      domWatcher.disconnect();
      clearInterval(urlWatcher);
      chrome.runtime.sendMessage({
        action: "save_credential",
        payload: pendingCaptures,
      });
      console.log("domWatcher");
      pendingCaptures = null;
      // setWatchActivate(false);
    }
  });
  domWatcher.observe(document.body, { childList: true, subtree: true });

  setTimeout(() => {
    if (pendingCaptures) {
      console.log("Login appears to have failed — not saving");
      domWatcher.disconnect();
      clearInterval(urlWatcher);
      // setWatchActivate(false);
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
    console.log("Response from backend:", data);
    if (data && data.status === "success") {
      savedPasswords.set(passwordInput, data.data.password);

      injectReactText(passwordInput, data.data.password);

      if (data.data.username) {
        const form = passwordInput.closest("form") || document;
        const allInputs = Array.from(form.querySelectorAll("input"));

        for (const input of allInputs) {
          if (input.type === "text" || input.type === "email") {
            injectReactText(input, data.data.username);
            break;
          }
        }
      }
    } else
      console.log("Local Vault: No saved credentials found for this site.");
  } catch (error) {
    console.error("Local Vault Error: Could not connect to backend.", error);
  }
}

function injectReactText(input: HTMLInputElement, text: string) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;
  nativeInputValueSetter?.call(input, text);

  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  console.log("filled", input.value);
  console.log("input", input);
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
