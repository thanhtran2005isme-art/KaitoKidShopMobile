const { chromium } = require('C:/Users/Admin/AppData/Local/npm-cache/_npx/6bcb61ec6d5aea22/node_modules/playwright');
const fs = require('fs');
const path = require('path');
(async()=>{
  const browser = await chromium.launch({headless:true});
  const outDir = path.resolve('.codex-test');
  const baseURL='http://localhost:8081';
  const viewports=[{width:390,height:844},{width:393,height:873},{width:412,height:915}];
  const result={viewports:[],interaction:{},states:{}};
  for(const v of viewports){
    const c=await browser.newContext({viewport:v,reducedMotion:'reduce'}); const p=await c.newPage();
    const consoleIssues=[],pageErrors=[],httpErrors=[],requestFailures=[];
    p.on('console',m=>{if(['warning','error'].includes(m.type())) consoleIssues.push(`${m.type()}: ${m.text()}`)});
    p.on('pageerror',e=>pageErrors.push(e.message)); p.on('response',r=>{if(r.status()>=400) httpErrors.push(`${r.status()} ${r.url()}`)}); p.on('requestfailed',r=>requestFailures.push(`${r.url()} :: ${r.failure()?.errorText||'failed'}`));
    await p.goto(`${baseURL}/categories`,{waitUntil:'networkidle'});
    await p.waitForTimeout(2500);
    await p.getByText('Danh mục',{exact:true}).first().waitFor({state:'visible'});
    await p.getByText(/sản phẩm$/).last().waitFor({state:'visible'});
    const o=await p.evaluate(()=>({innerWidth:innerWidth,htmlScrollWidth:document.documentElement.scrollWidth,bodyScrollWidth:document.body.scrollWidth}));
    await p.screenshot({path:path.join(outDir,`categories-final-${v.width}x${v.height}.png`),fullPage:true});
    result.viewports.push({...v,...o,noHorizontalOverflow:o.htmlScrollWidth<=o.innerWidth&&o.bodyScrollWidth<=o.innerWidth,consoleIssues,pageErrors,httpErrors,requestFailures});
    await c.close();
  }
  const c=await browser.newContext({viewport:viewports[0],reducedMotion:'reduce'}); const p=await c.newPage(); await p.goto(`${baseURL}/categories`,{waitUntil:'networkidle'}); await p.waitForTimeout(2500);
  const female=p.getByLabel('Xem Nữ'); result.interaction.femaleVisible=await female.isVisible().catch(()=>false); if(result.interaction.femaleVisible){await female.click(); await p.waitForTimeout(1800); result.interaction.afterFemaleCount=await p.getByText(/sản phẩm$/).last().textContent();}
  const cat=p.getByLabel('Danh mục Áo'); result.interaction.categoryVisible=await cat.isVisible().catch(()=>false); if(result.interaction.categoryVisible){await cat.click(); await p.waitForTimeout(1800); result.interaction.afterCategoryCount=await p.getByText(/sản phẩm$/).last().textContent();}
  await p.goto(`${baseURL}/categories`,{waitUntil:'networkidle'}); await p.getByRole('button',{name:'Tìm kiếm sản phẩm'}).click(); await p.waitForTimeout(1200); result.interaction.searchUrl=p.url();
  await p.goto(`${baseURL}/categories`,{waitUntil:'networkidle'}); await p.waitForTimeout(2200); const prod=p.getByLabel('Xem Áo Polo Nam Pique Classic'); result.interaction.productLabel=await prod.getAttribute('aria-label').catch(()=>null); if(await prod.count()){await prod.click(); await p.waitForTimeout(1200);} result.interaction.productUrl=p.url(); await c.close();

  const ec=await browser.newContext({viewport:viewports[0],reducedMotion:'reduce'}); const ep=await ec.newPage(); await ep.route('**/api/products?**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:[],totalCount:0,page:1,pageSize:40,totalPages:0})})); await ep.goto(`${baseURL}/categories`,{waitUntil:'networkidle'}); await ep.waitForTimeout(2200); result.states.productEmptyVisible=await ep.getByText('Chưa có sản phẩm',{exact:true}).isVisible().catch(()=>false); result.states.productEmptyDescriptionVisible=await ep.getByText('Hiện chưa có sản phẩm phù hợp với lựa chọn này.',{exact:true}).isVisible().catch(()=>false); await ep.screenshot({path:path.join(outDir,'categories-final-empty-390x844.png'),fullPage:true}); await ec.close();

  const pc=await browser.newContext({viewport:viewports[0],reducedMotion:'reduce'}); const pp=await pc.newPage(); await pp.route('**/api/products?**',r=>r.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'test failure'})})); await pp.goto(`${baseURL}/categories`,{waitUntil:'networkidle'}); await pp.waitForTimeout(2200); result.states.productErrorVisible=await pp.getByText('Chưa tải được sản phẩm',{exact:true}).isVisible().catch(()=>false); result.states.productRetryVisible=await pp.getByLabel('Thử lại').last().isVisible().catch(()=>false); await pc.close();

  const cc=await browser.newContext({viewport:viewports[0],reducedMotion:'reduce'}); const cp=await cc.newPage(); await cp.route('**/api/categories**',r=>r.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'test failure'})})); await cp.goto(`${baseURL}/categories`,{waitUntil:'networkidle'}); await cp.waitForTimeout(2200); result.states.categoryErrorVisible=await cp.getByText('Chưa tải được danh mục',{exact:true}).isVisible().catch(()=>false); result.states.categoryRetryVisible=await cp.getByLabel('Thử lại').first().isVisible().catch(()=>false); await cc.close();

  fs.writeFileSync(path.join(outDir,'categories-final-audit.json'),JSON.stringify(result,null,2)); await browser.close();
  const ok=result.viewports.every(v=>v.noHorizontalOverflow&&v.pageErrors.length===0&&v.httpErrors.length===0&&v.requestFailures.length===0)&&result.states.productEmptyVisible&&result.states.productEmptyDescriptionVisible&&result.states.productErrorVisible&&result.states.categoryErrorVisible&&result.interaction.searchUrl.includes('/search')&&result.interaction.productUrl.includes('/product/');
  console.log(JSON.stringify(result,null,2)); if(!ok) process.exit(2);
})().catch(e=>{console.error(e);process.exit(1)});


