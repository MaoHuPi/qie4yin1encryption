'use strict';

import * as path from 'path';
import * as fs from 'fs';
import * as puppeteer from 'puppeteer';

const dataDir = './data';
const grabSEVFile = path.join(dataDir, 'grabSEV.json');
function sleep(ms){
    return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
    const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox']});
    const page = await browser.newPage();
    async function getDataBySEV(selectElementsValue){
        var targetUrl = `https://dict.concised.moe.edu.tw/searchP.jsp?${selectElementsValue[0] ? `SN=${selectElementsValue[0]}&` : ''}${selectElementsValue[1] ? `SN2=${selectElementsValue[1]}&` : ''}${selectElementsValue[2] ? `word=${selectElementsValue[2]}&size=-1` : ''}`;
        console.log(targetUrl);
        try{
            await page.goto(targetUrl, {waitUntil: 'networkidle2'});
        }
        catch(err){
            console.log('---retry---');
            await sleep(1e3);
            try{
                await page.goto(targetUrl, {waitUntil: 'networkidle2'});
            }
            catch(err){
                console.log('---fail---');
                return;
            }
        }
        await page.$('body');
        var inject_getDataList = () => {
            function getDataList(){
                const eachPartRegex = (() => {
                    let beginNum = 12549;
                    var parts = [21, 13, 3].map(n => {
                        var text = new Array(n).fill(0).map((_, i) => String.fromCharCode(beginNum+i)).join('');
                        beginNum += n;
                        return text;
                    });
                    return new RegExp(`([${parts[0]}]*)([${parts[2]}]*)([${parts[1]}]*)([ˊˇˋ]*)`, 'g');
                })();
                function getWordData(){
                    var wordData = [...document.querySelectorAll('#searchL > tbody > tr')]
                    .map(tr =>[...tr.querySelectorAll('td')]
                        .map(td => td.innerText)
                    )
                    .filter(item => item[1].length == 2)
                    .map(item => [item[1], item[2]]);
                    return wordData;
                }
                function bopomofoIsError(bomopofo){
                    var eachPartRegex_ = new RegExp(eachPartRegex);
                    let acceptPartGroups = {
                        "ㄧ": "ㄚㄛㄝㄠㄡㄢㄣㄤㄥ", 
                        "ㄨ": "ㄚㄛㄞㄟㄢㄣㄤㄥ", 
                        "ㄩ": "ㄝㄢㄣㄥ", 
                    }
                    let parts = eachPartRegex_.exec(bomopofo).slice(1, 5);
                    if(
                        ((parts[0] !== '') && (!/[ㄓㄔㄕㄖㄗㄘㄙ]/.test(parts[0])) && (parts[1] === '') && (parts[2] === '')) || 
                        ((parts[1] !== '') && (parts[2] !== '') && (acceptPartGroups[parts[1]].indexOf(parts[2]) == -1))
                    ){return false;}
                    return true;
                }
                function toBopomofoKey(oriBopomofo){
                    var bopomofoKey = oriBopomofo.split(' ');
                    bopomofoKey[0] = bopomofoKey[0].replace(eachPartRegex, '$1');
                    bopomofoKey[1] = bopomofoKey[1].replace(eachPartRegex, '$2$3$4');
                    bopomofoKey = bopomofoKey.join('');
                    return bopomofoKey;
                }
                let wordData = getWordData();
                wordData.forEach(item => {
                    item[1] = toBopomofoKey(item[1]);
                });
                wordData = wordData.filter(item => bopomofoIsError(item[1]));
                return wordData;
            }
            if(document.querySelector('#searchL')){
                return(getDataList());
            }
        }
        var dataList;
        try{
            dataList = await page.evaluate(inject_getDataList);
        }
        catch(err){
            // console.log(err);
            console.log('---retry---');
            await sleep(1e3);
            try{
                dataList = await page.evaluate(inject_getDataList);
            }
            catch(err){
                // console.log(err);
                console.log('---fail---');
            }
        }
        // console.log(dataList);
        return dataList;
    }
    async function getNextSEV(){
        var selectElementsValue = await page.evaluate(() => {
            function nextPage(){
                var selectElements = [...document.querySelectorAll('main > section > label')]
                .map(label => label.querySelector('select'));
                if(selectElements.length == 3){
                    for(let i = 2; i >= 0; i--){
                        let valueList = [...selectElements[i].querySelectorAll('option')]
                        .map(option => option.value);
                        let valueIndex = valueList.indexOf(selectElements[i].value);
                        if(valueIndex < selectElements[i].length - 1){
                            selectElements[i].value = valueList[valueIndex+1];
                            // var changeEvent = new Event("change");
                            // selectElements[i].dispatchEvent(changeEvent);
                            break;
                        }
                        else{
                            selectElements.pop();
                        }
                    }
                    return selectElements.map(select => select.value);
                }
                else{
                    // document.querySelector('.selectL > [role="listitem"]').click();
                    var selectElementsValue = selectElements.map(select => select.value);
                    selectElementsValue.push(document.querySelector('.selectL > [role="listitem"]').innerText);
                    return selectElementsValue;
                }
            }
            return nextPage();
        });
        return selectElementsValue;
    }

    let sev = ['ㄅ', 'ㄅㄚ', '八'];
    if(fs.existsSync(grabSEVFile)){
        var content = await fs.readFileSync(grabSEVFile, 'utf8');
        try{sev = JSON.parse(content);}catch(err){}
    }
    console.log(sev);
    let i = 1;
    while(true){
        console.log(i);
        (data => {
            if(data){
                data.forEach(item => {
                    let key = item[1], word = item[0];
                    let keyFile = path.join(dataDir, 'key2word', `${key}.txt`);
                    if(fs.existsSync(keyFile)){
                        fs.readFile(keyFile, 'utf8', (err, oldContent) => {
                            if(err){
                                console.log(err);
                                return;
                            }
                            if(oldContent.indexOf(word) == -1){
                                fs.appendFile(keyFile, `\n${word}`, err => {if (err) console.log(err);});
                            }
                        });
                    }
                    else{
                        fs.writeFile(keyFile, word, err => {if (err) console.log(err);});
                    }
                });
            }
        })(await getDataBySEV(sev));
        sev = await getNextSEV();
        fs.writeFile(grabSEVFile, JSON.stringify(sev), err => {if (err) console.log(err);});
        console.log(sev);
        i++;
    }
    await browser.close();
})();