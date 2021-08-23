let t = setInterval(()=>{
    let btn = document.querySelector('div[aria-label="Create New Post"]');
    console.log(btn);
    if(!btn){
        return;
    }
    if(!globalThis.locked){
        globalThis.locked = true;
    }
    btn.click();
    clearInterval(t);
},100);