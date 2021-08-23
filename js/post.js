function sendMessageExtension(message,callback){
    const TAG = 'sendMessageExtension';
    chrome.runtime.sendMessage(message);
    console.log(TAG,'A message was sent to extension side: ',message);
    if(typeof(callback)=='function') {
        callback();
    }
}
function stimulateInput(input){
    input.dispatchEvent(new Event('focus',{bubbles:true}));
    input.dispatchEvent(new Event('input',{bubbles:true}));
}
function main(args){
    console.log(args);
    let t = setInterval(()=>{
        console.log('Checking form state..');
        let inputTitle = document.querySelector('input[aria-label="Title"]');
        let buttonCreateArray = document.querySelectorAll('div[aria-label="Publish"]');
        let frame = document.querySelector('iframe.editable');
        if(!inputTitle || !frame || !frame.contentWindow || !frame.contentWindow.document){
            return;
        }
        let buttonCreate = buttonCreateArray[buttonCreateArray.length-1];
        let inputContent = frame.contentWindow.document.body;
        clearInterval(t);
        console.log('Inserting from data..');
        inputTitle.value = args[0];
        stimulateInput(inputTitle);
        inputContent.innerHTML = args[1];
        stimulateInput(inputContent);
        if(!globalThis.lockPublish){
            globalThis.lockPublish = true;
            console.log('Publishing post..');
            buttonCreate.click();   // click publish button
            t = setInterval(()=>{
                console.log('Checking dialog state..');
                let btnsArray = document.querySelectorAll('div[role="alertdialog"] div[role="button"]');
                if(btnsArray.length!=4){
                    return;
                }
                let confirmBtn = btnsArray[btnsArray.length-1];
                console.log(confirmBtn);    //   debugging
                clearInterval(t);
                confirmBtn.click();     // clicks confirm
            },100);
        }
    },100);
}
if(!globalThis.existed){    // checks if this is first injection
    globalThis.existed = true;
    sendMessageExtension({type:'ready'});
chrome.runtime.onMessage.addListener(function(request,sender,sendResponse){
    const TAG = 'onMessage';
    console.log(TAG, 'Received message: ',request, 'Sender: ',sender);
    main(request);  // runs main procedure
    // TODO: fill in the form and sends, then return the done obj message
    // setTimeout(()=>sendMessageExtension({type:'done'}),5000);
});
} else {
    console.log('Script already injected. Init skipped.');
}