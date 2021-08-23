function extensionClickListener(){
    if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
    } else {    // fallback
        window.open(chrome.runtime.getURL('options.html'));
    }
}

chrome.action.onClicked.addListener(extensionClickListener);