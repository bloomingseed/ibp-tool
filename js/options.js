// CONSTANTS
const progressBar = document.querySelector('.progress-bar');
const importBtn = document.querySelector('#btn-import');
const idInput = document.querySelector('#input-blog-id');
const saveIdBtn = document.querySelector('#btn-save-blog-id');
const startBtn = document.querySelector('#btn-start');
const table = document.querySelector('#table-data>tbody');
const statusDiv = document.querySelector('#div-status');
const statusDivParent = document.querySelector('#div-status-parent');
const levelEnum = {
    'INFO':'INFO',
    'WARNING':'WARNING',
    'ERROR':'ERROR',
    'OK':'OK'
}
const keyEnum = {
    "BLOGGER_ID":"BLOGGER_ID",
    "OAUTH_TOKEN":"TOKEN"
}
// BACKGROUND METHODS
function storageGet(KEY){
    return new Promise(resolve=>chrome.storage.local.get(KEY,obj=>resolve(obj[KEY])));
}
function storageSet(KEY, val){
    let data = {};
    data[KEY] = val;
    return new Promise(resolve=>chrome.storage.local.set(data,resolve));
}
async function generatePayload(blogId, title, content){
    let json = {
        "kind": "blogger#post",
        "blog":{
            "id":blogId
        },
        title,
        content
    };
    return JSON.stringify(json);
}
/**
 * Method to get OAuth2 token, then automatically saves it to local storage (cache).
 * Returns the OAuth2 token.
 */
async function getTokenRemoteAndCache(){
    return new Promise(resolve=>{
        chrome.identity.getAuthToken({interactive:true}, token=>{
            storageSet(keyEnum.OAUTH_TOKEN,token);  // caches token
            resolve(token);     // returns token
        });
    });
}
/**
 * Entry method to make Blogger post, using the post description as JSON body in `payload`.
 * Param: maxRetry: a number defining max retry count.
 */
async function xhrWithAuth(postUrl, payload, maxRetry) {
    if(maxRetry<0){
        console.log('Max retry reached. Stop making request');
        return;
    }
    let token = await storageGet(keyEnum.OAUTH_TOKEN);  // retrieves the cached token
    if(!token){
        token = await getTokenRemoteAndCache();     // initializes new token
    }
    try{    // sends POST request
        let fetchOptions = {
            method:'POST',
            headers:{
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: payload
        }
        let response = await fetch(postUrl,fetchOptions);  // makes request and waits response
        console.log('Server responded',response,'body',response.json());   // debugging
        if(response.status == 401){     // possibly token has expired
            console.log('Server responded code 401. Retrying with new token..');
            let token = await getTokenRemoteAndCache();     // gets new token
            console.log('New token:',token);
            await xhrWithAuth(postUrl, payload, maxRetry-1);     // retry
        } else if(response.ok){
            console.log('Server sent "OK"');
        } else{
            console.log('Request failed with unknown solution');
        }
        return response;
    } catch(e){     // catches failing to make POST request
        console.log('Client failed to send request. Error:', e);
    }
}
// 4 options.html
function setProgress(progress){
    progressBar.style.width = progress+'%';
    globalThis.progress = progress;
    return progress;
}
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
 * Method to extract data from a `file` and append them to table.
 * Each file contains each row = each post; each row has 2 fields separated by '|'.
 */
async function importData(file){
    try{
        let wait = sec=>new Promise(resolve=>setTimeout(resolve,sec*1000));
        setStatus('Reading file..',levelEnum.INFO);
        let rows = (await (()=>new Promise((solve,rej)=>file.text().then(solve).catch(rej)))()).split('\n');
        setStatus(`Parsing ${rows.length} rows..`,levelEnum.INFO);
        let count = 0;
        let progress = setProgress(0);  // resets progress
        for(let row of rows){
            ++count;
            let tr = document.createElement('tr');
            let postData = row.split('|');
            rows[count-1] = postData;
            await wait(0.001);
            if(postData.length!=2){
                setStatus(`Skipped row #${count}: Wrong format data.`,levelEnum.WARNING);
                continue;
            }
            postData.unshift(count);    // adds the count to post data
            for(let i = 0; i<postData.length; ++i){
                let td = document.createElement('td');
                td.setAttribute('scope','row');
                td.innerText = postData[i];
                tr.appendChild(td);
            }
            table.appendChild(tr);
            postData.shift();   // removes the count data
            progress+=100/rows.length;
            setProgress(Number.parseInt(progress));
        }
        setStatus('Ready',levelEnum.OK);
        setProgress(100);   // fills the odds percentage
        globalThis.data = rows;
    }catch(e){
        setStatus(e,levelEnum.ERROR);
    }
}
// EVENTS HANDLING
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
function wait(msec){
    return new Promise(resolve=>setTimeout(resolve,msec));
}
/**
 * Handles 'Start' button's logic
 */
async function startHandler(){
    let data = globalThis.data;
    let progress = globalThis.progress;
    if(!data){
        setStatus('Data not found. Please import data first.',levelEnum.ERROR);
        return;
    }
    if(progress!=100){
        setStatus('Importing not done yet. Please hold on.',levelEnum.ERROR);
        return;
    }
    // TODO: handles mechanism
    try{
        let i = 0;
        let n = data.length;
        progress = setProgress(0);  // resets progress
        setStatus('Posting..',levelEnum.INFO);
        let tasks = [];
        let maxRetry = 1;
        let blogId = await storageGet(keyEnum.BLOGGER_ID);
        if(!blogId){
            throw 'Please set the blog ID first.';
        }
        const url = `https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/`;
        while(i<n){
            let k = Math.min(n,i+10);
            let start = Date.now();
            while(i<k){
                let payload = generatePayload(blogId,data[i][0],data[i][1]);
                tasks.push(xhrWithAuth(url,payload,maxRetry));
                ++i;
            }
            await Promise.all(tasks);
            progress+=100/(n/10);
            setProgress(progress);
            let elapsed = Date.now()-start;
            let delay = Math.max(1,10000-elapsed);
            await wait(delay);
        }
        setProgress(100);
        setStatus('Ready',levelEnum.OK);
    } catch(e){
        setStatus(e,levelEnum.ERROR);
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
// EVENTS REGISTERING
importBtn.addEventListener('change',async function(){ await importData(this.files[0])},false);
saveIdBtn.addEventListener('click',saveIdHandler);
startBtn.addEventListener('click',startHandler);
statusDivParent.addEventListener('mouseenter',statusDivMouseEnterHandler);
statusDivParent.addEventListener('mouseleave',statusDivMouseLeaveHandler);
window.addEventListener('load',windowLoadHandler);