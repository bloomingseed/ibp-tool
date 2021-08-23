// CONSTANTS
const progressBar = document.querySelector('.progress-bar');
const importBtn = document.querySelector('#btn-import');
const idInput = document.querySelector('#input-blog-id');
const saveIdBtn = document.querySelector('#btn-save-blog-id');
const startBtn = document.querySelector('#btn-start');
const tbody = document.querySelector('#table-data>tbody');
const statusDiv = document.querySelector('#div-status');
const statusDivParent = document.querySelector('#div-status-parent');
const levelEnum = {
    'INFO':'INFO',
    'WARNING':'WARNING',
    'ERROR':'ERROR',
    'OK':'OK'
}
const keyEnum = {
    "BLOGGER_ID":"BLOGGER_ID"
}
// METHODS
function storageGet(KEY){
    return new Promise(resolve=>chrome.storage.local.get(KEY,obj=>resolve(obj[KEY])));
}
function storageSet(KEY, val){
    let data = {};
    data[KEY] = val;
    return new Promise(resolve=>chrome.storage.local.set(data,resolve));
}
function setProgress(progress){
    progressBar.style.width = progress+'%';
    globalThis.progress = progress;
    return progress;
}
/**
 * Sets the status value and color based on level enum
 */
function setStatus(val,level){
    const levelMapping = {
        'INFO':'bg-info',
        'WARNING':'bg-warning',
        'ERROR':'bg-danger',
        'OK':'bg-success'
    }
    statusDiv.innerHTML = val+'\n'+statusDiv.innerHTML;
    let clist = statusDivParent.classList;
    clist.replace(clist[0],levelMapping[level]);    // replaces first class value with one from level mapping
}
/**
 * Sets ready state.
 * Set the `isReady` variable in global scope and modify availability of start button.
 */
function setIsReady(val){
    globalThis.isReady =  val;  // sets global variable
    if(val){
        startBtn.removeAttribute('disabled');   // enables start button
    } else{
        startBtn.setAttribute('disabled',true); // disables start button
    }
}
function wait(sec){
    return new Promise(resolve=>setTimeout(resolve,sec*1000));
}
/**
 * Extracts data from a `file` and overwrite them to table and sets the global data variable.
 * Each file contains each row = each post; each row has 2 fields separated by '|'.
 */
async function importData(file){
    try{
        setIsReady(false);  // sets status of not ready
        setStatus('Reading file..',levelEnum.INFO);     // sets status string
        let rows = (await (()=>new Promise((solve,rej)=>file.text().then(solve).catch(rej)))()).split('\n');    // extracts data by lines
        // console.log(rows);
        globalThis.data = rows;     // saves imported data to global scope
        setIsReady(true);
        tbody.innerHTML = "";   // clears tbody
        setStatus(`Parsing ${rows.length} rows..`,levelEnum.INFO);  // sets status string
        let count = 0;
        let progress = setProgress(0);  // resets progress
        // rendering rows
        for(let row of rows){
            ++count;
            let tr = document.createElement('tr');
            let postData = row.split('|');
            // rows[count-1] = postData;
            await wait(0.001);
            if(postData.length!=2){
                setStatus(`Skipped row #${count}: Wrong format data.`,levelEnum.WARNING);
                continue;
            }
            postData.unshift(count);    // adds the count to post data
            // adding data to table row
            for(let i = 0; i<postData.length; ++i){
                let td = document.createElement('td');
                td.setAttribute('scope','row');
                td.innerText = postData[i];
                tr.appendChild(td);
            }
            tbody.appendChild(tr);  // appends row to table
            progress+=100/rows.length;  // increases unit progress
            setProgress(Number.parseInt(progress));
        }
        setStatus('Ready',levelEnum.OK);
        setProgress(100);   // fills the odds percentage
    }catch(e){
        setStatus(e,levelEnum.ERROR);
    }
}
/**
 * Checks if the url is for creating blog posts.
 */
function isCreatePostUrl(url,output){
    if(typeof(url)!='string') 
        return false;
    let pattern = /https:\/\/(www.)?blogger.com\/blog\/post\/edit\/\d+\/\d+$/;    // validates post and comment url with any parameters
    let matches = url.match(pattern);
    // console.log(TAG,url,"Regex matches: ",matches);
    if(!matches) 
        return false;
    return true;
}
/**
 * Checks if the url is for creating blog posts.
 */
function isIndexUrl(url,output){
    if(typeof(url)!='string') 
        return false;
        // https://www.blogger.com/blog/posts/3218872346089355433
    let pattern = /https:\/\/(www.)?blogger.com\/blog\/posts\/\d+$/;    // validates post and comment url with any parameters
    let matches = url.match(pattern);
    // console.log(TAG,url,"Regex matches: ",matches);
    if(!matches) 
        return false;
    return true;
}
function getTabIdsList(){
    if(!globalThis.idsList){
        globalThis.idsList = [];
    }
    return globalThis.idsList;
}
function onTabUpdatedListener(tabId,changeInfo,tab){
    const TAG = 'onTabUpdatedListener';
    console.log(TAG,`TabId ${tabId}, Url ${tab.url}: updated.`);
    let url = tab.url;
    if(isCreatePostUrl(url)){  // checks if the tab url isn't a create blogger post page
        console.log(TAG,'Found post url @',tabId);
        chrome.scripting.executeScript({    // inject content.js script
            target:{tabId},
            files: ['js/post.js']
        });
        console.log(TAG,'post.js script injected.',tabId);        
    } else if(isIndexUrl(url)){     // checks if url is blogger admin page
        let options = getTabIdsList()[tabId];
        if(options){    // checks if tabId is registered with options
            if(options.isDone==null){   // checks if it's freshly new
                // options.isDone = false;
                console.log(TAG,'Found new blogger index page.',tabId,url);
                // inject index.js
                chrome.scripting.executeScript({    // inject content.js script
                    target:{'tabId':tab.id},
                    files: ['js/index.js']
                });
            } else if(options.isDone==false){   // checks if it is resolvable
                // TODO: resolve
                console.log(TAG,'Found resolvable task.',tabId,url);
                // console.log(options.resolve);   // debugging
                options.resolve();
            }
        }
    }
    
}

function sendMessageContentScript(tabId, message){
    chrome.tabs.sendMessage(tabId, message);
}
async function createWindowTab(url){
    // return await chrome.tabs.create({url});
    // return window.open(url,'_blank','width:500,height:300');
    return await chrome.windows.create({url,'width':768,'height':768});
}
async function closeWindowTab(windowId){
    await chrome.windows.remove(windowId);
}

function onTabMessageListener(request, sender, sendResponse){
    let TAG = "onTabMessageListener";
    let tabId = sender.tab.id;
    console.log(TAG,`TabId ${tabId}: sent: `,request); 
    let config = getTabIdsList()[tabId];  // gets arguments assigned to this tab id
    sendMessageContentScript(tabId,config.data);   // sends arguments to content script
    config.isDone = false;
}
/**
 * Sends blog ID to background service and cache it
 */
async function saveIdHandler(){
    let id = idInput.value;
    if(!id){
        setStatus('Blog ID is blank',levelEnum.ERROR);
    } else{
        setStatus('Saving blog ID as '+id+'..', levelEnum.INFO);
        await storageSet(keyEnum.BLOGGER_ID,id)
        setStatus('Ready', levelEnum.OK);
    }
}
function statusDivMouseEnterHandler(){
    statusDiv.style.overflow = "scroll";
}
function statusDivMouseLeaveHandler(){
    statusDiv.style.overflow = "hidden";
    // statusDiv.scroll(0,0);  // scrolls back to top-left
}
async function windowLoadHandler(){
    let id = await storageGet(keyEnum.BLOGGER_ID);
    if(!id){
        setStatus('No cached Blog ID',levelEnum.WARNING);
    } else{
        idInput.value = id;
    }
}
function wait(msec){
    return new Promise(resolve=>setTimeout(resolve,msec));
}

/**
 * Handles 'Start' button's logic
 */
async function startHandler(){
    let data = globalThis.data;     // retrieves global scope data from importData method
    if(!data){
        setStatus('Data not found. Please import data first.',levelEnum.ERROR);
        return;
    }
    setStatus('Posting..', levelEnum.INFO);
    let n = data.length;    // gets number of rows (lines) in data
    let blogId = await storageGet(keyEnum.BLOGGER_ID);
    let url = `https://www.blogger.com/blog/posts/${blogId}`;  // direct access to blog home page
    // let url = "https://www.blogger.com";
    let batchSize = 4;
    let tabIdsList = getTabIdsList();  // gets list of working tab ids
    for(let i = 0; i<n; i+=batchSize){
        let tasks = [];
        for(let j = i; j<Math.min(i+batchSize,n); ++j){
            let wt = await createWindowTab(url);    // creates tab in new window
            let tab = wt.tabs[0];   // gets first tab
            let args = data[j].split('|');
            args[1] = args[1][args[1].length-1]=='\r'?args[1].substring(0,args[1].length-1):args[1];
            tabIdsList[tab.id] = {
                'isDone':null,
                'data':data[j].split('|')
            }
            let resolve = undefined;
            let p = new Promise(r=>{
                resolve = ()=>{
                    closeWindowTab(wt.id);
                    tabIdsList[tab.id].isDone = true;
                    r();
                };
            });
            tabIdsList[tab.id].resolve = resolve;
            console.log(tabIdsList[tab.id]);    // debugging
            tasks.push(p);
            // chrome.scripting.executeScript({    // inject content.js script
            //     target:{'tabId':tab.id},
            //     files: ['js/index.js']
            // });
        }
        console.log(tasks);
        // await wait(5000);
        await Promise.all(tasks);   // waits for all tasks to finish
    }
    setStatus('Ready',levelEnum.OK);
}
// EVENTS REGISTERING
importBtn.addEventListener('change',async function(){ await importData(this.files[0])},false);
saveIdBtn.addEventListener('click',saveIdHandler);
startBtn.addEventListener('click',startHandler);
statusDivParent.addEventListener('mouseenter',statusDivMouseEnterHandler);
statusDivParent.addEventListener('mouseleave',statusDivMouseLeaveHandler);
window.addEventListener('load',windowLoadHandler);
chrome.tabs.onUpdated.addListener(onTabUpdatedListener);
chrome.runtime.onMessage.addListener(function(req,s,res){
    if(s.tab) {     // checks if message comes from a tab
        onTabMessageListener(req,s,res)
    } 
    return true;
});