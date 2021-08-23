if(!globalThis.indexExisted){    // checks if this is first injection
    globalThis.indexExisted = true;
    let t = setInterval(()=>{
        let btn = document.querySelector('div[aria-label="Create New Post"]');
        console.log(btn);
        if(!btn){
            console.log('Create post button not found. Retrying..')
            return;
        }
        if(!globalThis.locked){
            globalThis.locked = true;
        }
        btn.click();
        clearInterval(t);
    },100);
}