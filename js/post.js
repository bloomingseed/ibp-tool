function sendMessageExtension(message,callback){
    const TAG = 'sendMessageExtension';
    chrome.runtime.sendMessage(message);
    console.log(TAG,'A message was sent to extension side: ',message);
    if(typeof(callback)=='function') {
        callback();
    }
}
if(!globalThis.existed){
    globalThis.existed = true;
    sendMessageExtension({type:'ready'});
chrome.runtime.onMessage.addListener(function(request,sender,sendResponse){
    const TAG = 'onMessage';
    console.log(TAG, 'Received message: ',request, 'Sender: ',sender);
    // main(request);  // runs main procedure
    // TODO: fill in the form and sends, then return the done obj message
    setTimeout(()=>sendMessageExtension({type:'done'}),5000);
});
} else {
    console.log('Script already injected. Init skipped.');
}