chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  console.log("Background forwarding to Python:", request);

  const tryNativeMessage = (retriesLeft: number) => {
    chrome.runtime.sendNativeMessage(
      "com.localvault.host",
      request,
      (nativeResponse) => {
        if (chrome.runtime.lastError) {
          console.warn(
            `Native error (retries left: ${retriesLeft}):`,
            chrome.runtime.lastError.message,
          );

          if (retriesLeft > 0) {
            setTimeout(() => tryNativeMessage(retriesLeft - 1), 100);
          } else {
            sendResponse({
              status: "error",
              message: chrome.runtime.lastError.message,
            });
          }
          return;
        }

        console.log("Native response received:", nativeResponse);
        sendResponse(nativeResponse);
      },
    );
  };

  tryNativeMessage(2);
  return true;
});
